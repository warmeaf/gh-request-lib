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

describe('RequestCore 功能特性委托测试', () => {
  let mockRequestor: CoreMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = createCoreMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupCoreTest(mockRequestor, requestCore)
  })

  describe('重试功能委托', () => {
    test('requestWithRetry() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'requestWithRetry')
      featureManagerSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'GET'
      }
      const retryConfig: RetryConfig = { retries: 3, delay: 1000 }

      const result = await requestCore.requestWithRetry(config, retryConfig)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
      expect(featureManagerSpy).toHaveBeenCalledWith(config, retryConfig)

      featureManagerSpy.mockRestore()
    })

    test('getWithRetry() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'getWithRetry')
      featureManagerSpy.mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const retryConfig: RetryConfig = { retries: 5, delay: 500 }
      const result = await requestCore.getWithRetry(CORE_TEST_URLS.USER_DETAIL, retryConfig)

      expect(result).toEqual(CORE_MOCK_RESPONSES.USER)
      expect(featureManagerSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USER_DETAIL, retryConfig)

      featureManagerSpy.mockRestore()
    })

    test('postWithRetry() 应该使用默认重试配置', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'postWithRetry')
      featureManagerSpy.mockResolvedValue(CORE_MOCK_RESPONSES.CREATED)

      const userData = { name: 'John', email: 'john@example.com' }
      const result = await requestCore.postWithRetry(CORE_TEST_URLS.USERS, userData)

      expect(result).toEqual(CORE_MOCK_RESPONSES.CREATED)
      expect(featureManagerSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USERS, userData, { retries: 3 })

      featureManagerSpy.mockRestore()
    })
  })

  describe('缓存功能委托', () => {
    test('requestWithCache() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'requestWithCache')
      featureManagerSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'GET'
      }
      const cacheConfig: CacheConfig = { ttl: 300000 }

      const result = await requestCore.requestWithCache(config, cacheConfig)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
      expect(featureManagerSpy).toHaveBeenCalledWith(config, cacheConfig)

      featureManagerSpy.mockRestore()
    })

    test('getWithCache() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'getWithCache')
      featureManagerSpy.mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const cacheConfig: CacheConfig = { ttl: 600000 }
      const result = await requestCore.getWithCache(CORE_TEST_URLS.USER_DETAIL, cacheConfig)

      expect(result).toEqual(CORE_MOCK_RESPONSES.USER)
      expect(featureManagerSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USER_DETAIL, cacheConfig)

      featureManagerSpy.mockRestore()
    })

    test('clearCache() 应该委托给 FeatureManager', () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'clearCache')

      requestCore.clearCache('test-key')

      expect(featureManagerSpy).toHaveBeenCalledWith('test-key')

      featureManagerSpy.mockRestore()
    })
  })

  describe('幂等功能委托', () => {
    test('requestIdempotent() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'requestIdempotent')
      featureManagerSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'POST',
        data: { name: 'John' }
      }
      const idempotentConfig = { ttl: 600000 }

      const result = await requestCore.requestIdempotent(config, idempotentConfig)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
      expect(featureManagerSpy).toHaveBeenCalledWith(config, idempotentConfig)

      featureManagerSpy.mockRestore()
    })

    test('所有幂等便利方法应该正确委托', async () => {
      const methods = [
        'getIdempotent',
        'postIdempotent', 
        'putIdempotent',
        'patchIdempotent',
        'deleteIdempotent'
      ] as const

      for (const method of methods) {
        const featureManagerSpy = vi.spyOn(requestCore['featureManager'], method)
        featureManagerSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

        if (method === 'getIdempotent' || method === 'deleteIdempotent') {
          await (requestCore as any)[method](CORE_TEST_URLS.USER_DETAIL, {}, {})
        } else {
          await (requestCore as any)[method](CORE_TEST_URLS.USERS, { name: 'test' }, {}, {})
        }

        expect(featureManagerSpy).toHaveBeenCalled()
        featureManagerSpy.mockRestore()
      }
    })

    test('clearIdempotentCache() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'clearIdempotentCache')
      featureManagerSpy.mockResolvedValue()

      await requestCore.clearIdempotentCache('test-key')

      expect(featureManagerSpy).toHaveBeenCalledWith('test-key')

      featureManagerSpy.mockRestore()
    })

    test('getIdempotentStats() 应该委托给 FeatureManager', () => {
      const mockStats = {
        totalRequests: 15,
        duplicatesBlocked: 10,
        pendingRequestsReused: 3,
        cacheHits: 7,
        actualNetworkRequests: 5,
        duplicateRate: 66.67,
        avgResponseTime: 150,
        keyGenerationTime: 1
      }
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'getIdempotentStats')
      featureManagerSpy.mockReturnValue(mockStats)

      const result = requestCore.getIdempotentStats()

      expect(result).toEqual(mockStats)
      expect(featureManagerSpy).toHaveBeenCalled()

      featureManagerSpy.mockRestore()
    })
  })

  describe('并发功能委托', () => {
    test('requestConcurrent() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'requestConcurrent')
      const configs = [
        { url: CORE_TEST_URLS.USER_DETAIL, method: 'GET' as const },
        { url: CORE_TEST_URLS.USERS, method: 'GET' as const }
      ]
      const mockResults = [
        { success: true, data: CORE_MOCK_RESPONSES.USER, config: configs[0], index: 0 },
        { success: true, data: CORE_MOCK_RESPONSES.SUCCESS, config: configs[1], index: 1 }
      ]
      featureManagerSpy.mockResolvedValue(mockResults)

      const concurrentConfig: ConcurrentConfig = { maxConcurrency: 2 }

      const result = await requestCore.requestConcurrent(configs, concurrentConfig)

      expect(result).toEqual(mockResults)
      expect(featureManagerSpy).toHaveBeenCalledWith(configs, concurrentConfig)

      featureManagerSpy.mockRestore()
    })

    test('requestMultiple() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'requestMultiple')
      const config: RequestConfig = { url: CORE_TEST_URLS.USERS, method: 'GET' }
      const mockResults = Array(3).fill(null).map((_, index) => ({
        success: true,
        data: CORE_MOCK_RESPONSES.SUCCESS,
        config,
        index
      }))
      featureManagerSpy.mockResolvedValue(mockResults)

      const concurrentConfig: ConcurrentConfig = { maxConcurrency: 2 }

      const result = await requestCore.requestMultiple(config, 3, concurrentConfig)

      expect(result).toEqual(mockResults)
      expect(featureManagerSpy).toHaveBeenCalledWith(config, 3, concurrentConfig)

      featureManagerSpy.mockRestore()
    })

    test('getConcurrent() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'getConcurrent')
      const urls = [CORE_TEST_URLS.USER_DETAIL, CORE_TEST_URLS.USERS]
      const mockResults = [
        { success: true, data: CORE_MOCK_RESPONSES.USER, config: { url: urls[0], method: 'GET' as const }, index: 0 },
        { success: true, data: CORE_MOCK_RESPONSES.USERS, config: { url: urls[1], method: 'GET' as const }, index: 1 }
      ]
      featureManagerSpy.mockResolvedValue(mockResults)

      const concurrentConfig: ConcurrentConfig = { maxConcurrency: 2 }

      const result = await requestCore.getConcurrent(urls, concurrentConfig)

      expect(result).toEqual(mockResults)
      expect(featureManagerSpy).toHaveBeenCalledWith(urls, concurrentConfig)

      featureManagerSpy.mockRestore()
    })

    test('并发结果辅助方法应该委托给 FeatureManager', () => {
      const mockResults = [
        { success: true, data: 'success1', config: { url: '/test1', method: 'GET' as const }, index: 0 },
        { success: false, error: new Error('failed'), config: { url: '/test2', method: 'GET' as const }, index: 1 },
        { success: true, data: 'success2', config: { url: '/test3', method: 'GET' as const }, index: 2 }
      ]

      // 测试 getSuccessfulResults
      const getSuccessfulSpy = vi.spyOn(requestCore['featureManager'], 'getSuccessfulResults')
      getSuccessfulSpy.mockReturnValue(['success1', 'success2'])

      const successfulResults = requestCore.getSuccessfulResults(mockResults)
      expect(successfulResults).toEqual(['success1', 'success2'])
      expect(getSuccessfulSpy).toHaveBeenCalledWith(mockResults)

      // 测试 getFailedResults
      const getFailedSpy = vi.spyOn(requestCore['featureManager'], 'getFailedResults')
      getFailedSpy.mockReturnValue([mockResults[1]])

      const failedResults = requestCore.getFailedResults(mockResults)
      expect(failedResults).toEqual([mockResults[1]])
      expect(getFailedSpy).toHaveBeenCalledWith(mockResults)

      // 测试 hasConcurrentFailures
      const hasFailuresSpy = vi.spyOn(requestCore['featureManager'], 'hasConcurrentFailures')
      hasFailuresSpy.mockReturnValue(true)

      const hasFailures = requestCore.hasConcurrentFailures(mockResults)
      expect(hasFailures).toBe(true)
      expect(hasFailuresSpy).toHaveBeenCalledWith(mockResults)

      getSuccessfulSpy.mockRestore()
      getFailedSpy.mockRestore()
      hasFailuresSpy.mockRestore()
    })
  })

  describe('串行功能委托', () => {
    test('requestSerial() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'requestSerial')
      featureManagerSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'POST',
        serialKey: 'user-operations'
      }
      const queueConfig = { priority: 1 }

      const result = await requestCore.requestSerial(config, queueConfig)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
      expect(featureManagerSpy).toHaveBeenCalledWith(config, queueConfig)

      featureManagerSpy.mockRestore()
    })

    test('所有串行便利方法应该正确委托', async () => {
      const serialMethods = [
        'getSerial',
        'postSerial',
        'putSerial',
        'deleteSerial',
        'patchSerial'
      ] as const

      for (const method of serialMethods) {
        const featureManagerSpy = vi.spyOn(requestCore['featureManager'], method)
        featureManagerSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

        const serialKey = `test-${method}`
        const queueConfig = { priority: 1 }

        if (method === 'getSerial' || method === 'deleteSerial') {
          await (requestCore as any)[method](CORE_TEST_URLS.USER_DETAIL, serialKey, {}, queueConfig)
          expect(featureManagerSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USER_DETAIL, serialKey, {}, queueConfig)
        } else {
          const data = { name: 'test' }
          await (requestCore as any)[method](CORE_TEST_URLS.USERS, serialKey, data, {}, queueConfig)
          expect(featureManagerSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USERS, serialKey, data, {}, queueConfig)
        }

        featureManagerSpy.mockRestore()
      }
    })

    test('串行队列管理方法应该委托给 FeatureManager', () => {
      const managementMethods = [
        'clearSerialQueue',
        'clearAllSerialQueues',
        'getSerialStats'
      ] as const

      for (const method of managementMethods) {
        const featureManagerSpy = vi.spyOn(requestCore['featureManager'], method)
        
        if (method === 'clearSerialQueue') {
          featureManagerSpy.mockReturnValue(true)
          const result = requestCore.clearSerialQueue('test-key')
          expect(result).toBe(true)
          expect(featureManagerSpy).toHaveBeenCalledWith('test-key')
        } else if (method === 'clearAllSerialQueues') {
          featureManagerSpy.mockReturnValue(undefined)
          requestCore.clearAllSerialQueues()
          expect(featureManagerSpy).toHaveBeenCalled()
        } else if (method === 'getSerialStats') {
          const mockStats = {
            totalQueues: 2,
            activeQueues: 1,
            totalTasks: 10,
            totalPendingTasks: 3,
            totalCompletedTasks: 7,
            totalFailedTasks: 0,
            avgProcessingTime: 180,
            queues: {}
          }
          featureManagerSpy.mockReturnValue(mockStats)
          const result = requestCore.getSerialStats()
          expect(result).toEqual(mockStats)
          expect(featureManagerSpy).toHaveBeenCalled()
        }

        featureManagerSpy.mockRestore()
      }
    })

    test('串行队列检查方法应该委托给 SerialFeature', () => {
      const serialFeatureMock = {
        hasQueue: vi.fn().mockReturnValue(true),
        removeQueue: vi.fn().mockReturnValue(true),
        removeAllQueues: vi.fn()
      }

      const getSerialFeatureSpy = vi.spyOn(requestCore['featureManager'], 'getSerialFeature')
      getSerialFeatureSpy.mockReturnValue(serialFeatureMock as any)

      // 测试 hasSerialQueue
      const hasQueue = requestCore.hasSerialQueue('test-key')
      expect(hasQueue).toBe(true)
      expect(serialFeatureMock.hasQueue).toHaveBeenCalledWith('test-key')

      // 测试 removeSerialQueue
      const removed = requestCore.removeSerialQueue('test-key')
      expect(removed).toBe(true)
      expect(serialFeatureMock.removeQueue).toHaveBeenCalledWith('test-key')

      // 测试 removeAllSerialQueues
      requestCore.removeAllSerialQueues()
      expect(serialFeatureMock.removeAllQueues).toHaveBeenCalled()

      getSerialFeatureSpy.mockRestore()
    })
  })

  describe('批量请求功能', () => {
    test('batchRequests() 应该委托给 FeatureManager', async () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'batchRequests')
      const mockResults = [CORE_MOCK_RESPONSES.USER, CORE_MOCK_RESPONSES.SUCCESS]
      featureManagerSpy.mockResolvedValue(mockResults)

      const requests = [
        { url: CORE_TEST_URLS.USER_DETAIL, method: 'GET' as const },
        { url: CORE_TEST_URLS.USERS, method: 'GET' as const }
      ]
      const options = { concurrency: 2, ignoreErrors: true }

      const result = await requestCore.batchRequests(requests, options)

      expect(result).toEqual(mockResults)
      expect(featureManagerSpy).toHaveBeenCalledWith(requests, options)

      featureManagerSpy.mockRestore()
    })
  })

  describe('统计方法委托', () => {
    test('getCacheStats() 应该委托给 FeatureManager', () => {
      const mockStats = Promise.resolve({
        size: 60,
        maxEntries: 100,
        hitRate: 83.33,
        keyGeneratorStats: {
          totalGenerations: 60,
          cacheHits: 50,
          cacheMisses: 10,
          averageGenerationTime: 1,
          cacheSize: 60,
          lastCleanupTime: Date.now(),
          hitRate: '83.33%'
        },
        lastCleanup: Date.now(),
        cleanupInterval: 60000,
        storageType: 'memory' as any
      })
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'getCacheStats')
      featureManagerSpy.mockReturnValue(mockStats)

      const result = requestCore.getCacheStats()

      expect(result).toEqual(mockStats)
      expect(featureManagerSpy).toHaveBeenCalled()

      featureManagerSpy.mockRestore()
    })

    test('getConcurrentStats() 应该委托给 FeatureManager', () => {
      const mockStats = {
        total: 100,
        completed: 100,
        successful: 95,
        failed: 5,
        averageDuration: 200,
        maxConcurrencyUsed: 5
      }
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'getConcurrentStats')
      featureManagerSpy.mockReturnValue(mockStats)

      const result = requestCore.getConcurrentStats()

      expect(result).toEqual(mockStats)
      expect(featureManagerSpy).toHaveBeenCalled()

      featureManagerSpy.mockRestore()
    })
  })

  describe('资源清理委托', () => {
    test('destroy() 应该调用 FeatureManager.destroy()', () => {
      const featureManagerSpy = vi.spyOn(requestCore['featureManager'], 'destroy')
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      requestCore.destroy()

      expect(featureManagerSpy).toHaveBeenCalled()
      expect(consoleSpy).toHaveBeenCalledWith('[RequestCore] All resources have been cleaned up')

      featureManagerSpy.mockRestore()
      consoleSpy.mockRestore()
    })
  })
})
