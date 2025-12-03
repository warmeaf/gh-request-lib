import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig } from '../../src/interface'
import { RetryConfig } from '../../src/features/retry'
import { CacheConfig } from '../../src/features/cache'
import { ConcurrentConfig } from '../../src/features/concurrent'
import {
  CoreMockRequestor,
  createCoreMockRequestor,
  cleanupCoreTest,
  CORE_MOCK_RESPONSES,
  CORE_TEST_URLS
} from './core-test-helpers'

describe('RequestCore 功能特性测试', () => {
  let mockRequestor: CoreMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = createCoreMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupCoreTest(mockRequestor, requestCore)
  })

  describe('重试功能 - 通过 metadata 配置', () => {
    test('应该支持通过 metadata.retryConfig 配置重试', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'GET',
        metadata: {
          retryConfig: { retries: 3, delay: 100 } as RetryConfig
        }
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
    })

    test('应该支持 GET 请求通过 metadata 配置重试', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const result = await requestCore.get(CORE_TEST_URLS.USER_DETAIL, {
        metadata: {
          retryConfig: { retries: 2, delay: 50 } as RetryConfig
        }
      })

      expect(result).toEqual(CORE_MOCK_RESPONSES.USER)
    })
  })

  describe('缓存功能 - 通过 metadata 配置', () => {
    test('应该支持通过 metadata.cacheConfig 配置缓存', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'GET',
        metadata: {
          cacheConfig: { ttl: 300000 } as CacheConfig
        }
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
    })

    test('clearCache() 应该正常工作', () => {
      // clearCache 方法仍然保留
      expect(() => requestCore.clearCache('test-key')).not.toThrow()
      expect(() => requestCore.clearCache()).not.toThrow()
    })
  })

  describe('幂等功能 - 通过 metadata 配置', () => {
    test('应该支持通过 metadata.idempotentConfig 配置幂等', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'POST',
        data: { name: 'John' },
        metadata: {
          idempotentConfig: { ttl: 600000 }
        }
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
    })

    test('clearIdempotentCache() 应该正常工作', async () => {
      await expect(requestCore.clearIdempotentCache('test-key')).resolves.not.toThrow()
      await expect(requestCore.clearIdempotentCache()).resolves.not.toThrow()
    })
  })

  describe('并发功能', () => {
    test('requestConcurrent() 应该正常工作', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce(CORE_MOCK_RESPONSES.USER)
        .mockResolvedValueOnce(CORE_MOCK_RESPONSES.SUCCESS)

      const configs = [
        { url: CORE_TEST_URLS.USER_DETAIL, method: 'GET' as const },
        { url: CORE_TEST_URLS.USERS, method: 'GET' as const }
      ]
      const concurrentConfig: ConcurrentConfig = { maxConcurrency: 2 }

      const result = await requestCore.requestConcurrent(configs, concurrentConfig)

      expect(result).toHaveLength(2)
      expect(result[0].success).toBe(true)
      expect(result[1].success).toBe(true)
    })

    test('并发结果辅助方法应该正常工作', () => {
      const mockResults = [
        { success: true, data: 'success1', config: { url: '/test1', method: 'GET' as const }, index: 0 },
        { success: false, error: new Error('failed'), config: { url: '/test2', method: 'GET' as const }, index: 1 },
        { success: true, data: 'success2', config: { url: '/test3', method: 'GET' as const }, index: 2 }
      ]

      const successfulResults = requestCore.getSuccessfulResults(mockResults)
      expect(successfulResults).toEqual(['success1', 'success2'])

      const failedResults = requestCore.getFailedResults(mockResults)
      expect(failedResults).toHaveLength(1)
      expect(failedResults[0].success).toBe(false)

      const hasFailures = requestCore.hasConcurrentFailures(mockResults)
      expect(hasFailures).toBe(true)
    })
  })

  describe('串行功能', () => {
    test('应该支持通过 serialKey 配置串行请求', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'POST',
        serialKey: 'user-operations'
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
    })

    test('串行队列管理方法应该正常工作', () => {
      expect(() => requestCore.clearSerialQueue('test-key')).not.toThrow()
      expect(() => requestCore.clearAllSerialQueues()).not.toThrow()
    })
  })

  describe('批量请求功能', () => {
    test('batchRequests() 应该正常工作', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce(CORE_MOCK_RESPONSES.USER)
        .mockResolvedValueOnce(CORE_MOCK_RESPONSES.SUCCESS)

      const requests = [
        { url: CORE_TEST_URLS.USER_DETAIL, method: 'GET' as const },
        { url: CORE_TEST_URLS.USERS, method: 'GET' as const }
      ]
      const options = { concurrency: 2, ignoreErrors: true }

      const result = await requestCore.batchRequests(requests, options)

      expect(result).toHaveLength(2)
    })
  })

  describe('资源清理', () => {
    test('destroy() 应该正常工作', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      requestCore.destroy()
      
      // 等待 destroy() 完成（它是异步的）
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(consoleSpy).toHaveBeenCalledWith('[RequestCore] All resources have been cleaned up')

      consoleSpy.mockRestore()
    })
  })
})
