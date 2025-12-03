import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig, RequestInterceptor, GlobalConfig } from '../../src/interface'
import { StorageType } from '../../src/cache/storage-adapter'
import {
  CoreMockRequestor,
  createCoreMockRequestor,
  createTestInterceptor,
  cleanupCoreTest,
  CORE_MOCK_RESPONSES,
  CORE_TEST_URLS,
  waitFor
} from './core-test-helpers'

describe('RequestCore 集成测试', () => {
  let mockRequestor: CoreMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = createCoreMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupCoreTest(mockRequestor, requestCore)
  })

  describe('完整工作流集成', () => {
    test('应该支持完整的请求生命周期', async () => {
      // 设置全局配置
      const globalConfig: GlobalConfig = {
        baseURL: 'https://api.test.com',
        timeout: 5000,
        headers: {
          'X-API-Key': 'test-key',
          'Content-Type': 'application/json'
        }
      }
      requestCore.setGlobalConfig(globalConfig)

      // 添加拦截器
      const requestInterceptor: RequestInterceptor = {
        onRequest: vi.fn((config: RequestConfig) => ({
          ...config,
          headers: {
            ...config.headers,
            'Authorization': 'Bearer intercepted-token'
          }
        }))
      }

      const responseInterceptor: RequestInterceptor = {
        onResponse: vi.fn((data: any) => ({
          ...data,
          transformed: true,
          timestamp: Date.now()
        }))
      }

      requestCore.addInterceptor(requestInterceptor)
      requestCore.addInterceptor(responseInterceptor)

      // 设置 mock 响应
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      // 执行请求
      const result = await requestCore.get('/users/1', {
        headers: { 'X-Request-ID': 'req-123' },
        timeout: 8000 // 覆盖全局超时
      })

      // 验证拦截器被调用
      expect(requestInterceptor.onRequest).toHaveBeenCalled()
      // onResponse 接收两个参数：响应数据和配置对象
      expect(responseInterceptor.onResponse).toHaveBeenCalledWith(
        CORE_MOCK_RESPONSES.USER,
        expect.objectContaining({
          url: expect.stringContaining('/users/1'),
          method: 'GET'
        })
      )

      // 验证最终结果
      expect(result).toEqual({
        ...CORE_MOCK_RESPONSES.USER,
        transformed: true,
        timestamp: expect.any(Number)
      })

      // 验证最终请求配置
      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers).toMatchObject({
        'X-API-Key': 'test-key',
        'Content-Type': 'application/json',
        'Authorization': 'Bearer intercepted-token',
        'X-Request-ID': 'req-123'
      })
      expect(lastRequest?.timeout).toBe(8000)
    })

    test('应该支持链式调用与功能特性的组合', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // 使用链式调用 + 缓存功能
      const result = await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .method('GET')
        .headers({ 'Accept': 'application/json' })
        .params({ page: 1, limit: 10 })
        .timeout(10000)
        .cache(300000) // 5分钟缓存
        .debug(true)
        .send()

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.metadata?.cacheConfig).toEqual(expect.objectContaining({ ttl: 300000 }))
    })

    test('应该支持多个功能特性的协同工作', async () => {
      // 设置一个会失败然后重试的场景
      let attemptCount = 0
      mockRequestor.getMock().mockImplementation(() => {
        attemptCount++
        if (attemptCount < 3) {
          return Promise.reject(new Error('Network error'))
        }
        return Promise.resolve(CORE_MOCK_RESPONSES.SUCCESS)
      })

      const config: RequestConfig = {
        url: CORE_TEST_URLS.ERROR,
        method: 'GET',
        metadata: {
          retryConfig: { retries: 3, delay: 100 }
        }
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
      expect(attemptCount).toBe(3) // 应该尝试了3次
    })
  })

  describe('并发请求集成', () => {
    test('应该支持并发请求与错误处理', async () => {
      // 设置不同的响应
      mockRequestor.getMock()
        .mockResolvedValueOnce(CORE_MOCK_RESPONSES.USER)
        .mockRejectedValueOnce(new Error('Server error'))
        .mockResolvedValueOnce(CORE_MOCK_RESPONSES.SUCCESS)

      // Mock 并发功能
      const requestConcurrentSpy = vi.spyOn(requestCore, 'requestConcurrent')
      requestConcurrentSpy.mockImplementation(async (configs) => {
        const results: any[] = []
        for (let i = 0; i < configs.length; i++) {
          try {
            const data = await requestCore.request(configs[i])
            results.push({ success: true, data, config: configs[i], index: i })
          } catch (error) {
            results.push({ success: false, error, config: configs[i], index: i })
          }
        }
        return results
      })

      const configs = [
        { url: CORE_TEST_URLS.USER_DETAIL, method: 'GET' as const },
        { url: CORE_TEST_URLS.ERROR, method: 'GET' as const },
        { url: CORE_TEST_URLS.USERS, method: 'GET' as const }
      ]

      const results = await requestCore.requestConcurrent(configs)

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[0].data).toEqual(CORE_MOCK_RESPONSES.USER)
      expect(results[1].success).toBe(false)
      expect(results[1].error).toBeInstanceOf(Error)
      expect(results[2].success).toBe(true)
      expect(results[2].data).toEqual(CORE_MOCK_RESPONSES.SUCCESS)

      requestConcurrentSpy.mockRestore()
    })

    test('应该支持并发结果的筛选和处理', async () => {
      const mockResults = [
        { success: true, data: CORE_MOCK_RESPONSES.USER, config: { url: CORE_TEST_URLS.USER_DETAIL, method: 'GET' as const }, index: 0 },
        { success: false, error: new Error('Failed'), config: { url: CORE_TEST_URLS.ERROR, method: 'GET' as const }, index: 1 },
        { success: true, data: CORE_MOCK_RESPONSES.SUCCESS, config: { url: CORE_TEST_URLS.USERS, method: 'GET' as const }, index: 2 }
      ]

      // Mock 并发功能和结果处理方法
      const requestConcurrentSpy = vi.spyOn(requestCore, 'requestConcurrent')
      requestConcurrentSpy.mockResolvedValue(mockResults)

      const getSuccessfulResultsSpy = vi.spyOn(requestCore, 'getSuccessfulResults')
      getSuccessfulResultsSpy.mockReturnValue([CORE_MOCK_RESPONSES.USER, CORE_MOCK_RESPONSES.SUCCESS])

      const getFailedResultsSpy = vi.spyOn(requestCore, 'getFailedResults')
      getFailedResultsSpy.mockReturnValue([mockResults[1]])

      const hasConcurrentFailuresSpy = vi.spyOn(requestCore, 'hasConcurrentFailures')
      hasConcurrentFailuresSpy.mockReturnValue(true)

      const configs = [
        { url: CORE_TEST_URLS.USER_DETAIL, method: 'GET' as const },
        { url: CORE_TEST_URLS.ERROR, method: 'GET' as const },
        { url: CORE_TEST_URLS.USERS, method: 'GET' as const }
      ]

      const results = await requestCore.requestConcurrent(configs)
      const successfulResults = requestCore.getSuccessfulResults(results)
      const failedResults = requestCore.getFailedResults(results)
      const hasFailures = requestCore.hasConcurrentFailures(results)

      expect(successfulResults).toEqual([CORE_MOCK_RESPONSES.USER, CORE_MOCK_RESPONSES.SUCCESS])
      expect(failedResults).toHaveLength(1)
      expect(hasFailures).toBe(true)

      requestConcurrentSpy.mockRestore()
      getSuccessfulResultsSpy.mockRestore()
      getFailedResultsSpy.mockRestore()
      hasConcurrentFailuresSpy.mockRestore()
    })
  })

  describe('串行请求集成', () => {
    test('应该支持串行请求队列管理', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const serialKey = 'user-operations'
      
      // 执行串行请求 - 使用 request 方法配合 serialKey
      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'POST',
        serialKey,
        data: { name: 'John' }
      }

      const result = await requestCore.request(config)
      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)

      // 清除队列
      const cleared = requestCore.clearSerialQueue(serialKey)
      expect(cleared).toBe(true)
    })
  })

  describe('缓存与幂等性集成', () => {
    test('应该支持缓存和幂等性的组合使用', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      // 使用缓存请求 - 通过 metadata 配置
      const cacheResult = await requestCore.get(CORE_TEST_URLS.USER_DETAIL, {
        metadata: {
          cacheConfig: { ttl: 300000 }
        }
      })
      expect(cacheResult).toEqual(CORE_MOCK_RESPONSES.USER)

      // 使用幂等请求 - 通过 metadata 配置
      const idempotentResult = await requestCore.post(CORE_TEST_URLS.USERS, { name: 'John' }, {
        metadata: {
          idempotentConfig: { ttl: 600000 }
        }
      })
      expect(idempotentResult).toEqual(CORE_MOCK_RESPONSES.USER)
    })
  })

  describe('功能集成验证', () => {
    test('应该正确集成各种功能特性', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // 测试缓存功能
      const cacheResult = await requestCore.get(CORE_TEST_URLS.USERS, {
        metadata: {
          cacheConfig: { ttl: 300000 }
        }
      })
      expect(cacheResult).toEqual(CORE_MOCK_RESPONSES.SUCCESS)

      // 测试幂等功能
      const idempotentResult = await requestCore.post(CORE_TEST_URLS.USERS, { name: 'John' }, {
        metadata: {
          idempotentConfig: { ttl: 600000 }
        }
      })
      expect(idempotentResult).toEqual(CORE_MOCK_RESPONSES.SUCCESS)

      // 测试重试功能
      const retryResult = await requestCore.get(CORE_TEST_URLS.USERS, {
        metadata: {
          retryConfig: { retries: 3 }
        }
      })
      expect(retryResult).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
    })
  })

  describe('复杂场景集成', () => {
    test('应该处理包含所有功能的复杂请求流程', async () => {
      // 设置全局配置和拦截器
      const globalConfig: GlobalConfig = {
        baseURL: 'https://api.test.com',
        timeout: 10000,
        headers: { 'X-API-Version': 'v1' },
        interceptors: [createTestInterceptor('global-interceptor')]
      }
      requestCore.setGlobalConfig(globalConfig)

      // 添加额外拦截器
      requestCore.addInterceptor(createTestInterceptor('additional-interceptor'))

      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // Mock 功能特性
      const batchRequestsSpy = vi.spyOn(requestCore, 'batchRequests')
      batchRequestsSpy.mockResolvedValue([
        CORE_MOCK_RESPONSES.USER,
        CORE_MOCK_RESPONSES.SUCCESS,
        CORE_MOCK_RESPONSES.CREATED
      ])

      // 执行批量请求
      const requests = [
        { url: '/users/1', method: 'GET' as const },
        { url: '/users', method: 'GET' as const },
        { url: '/users', method: 'POST' as const, data: { name: 'John' } }
      ]

      const results = await requestCore.batchRequests(requests, {
        concurrency: 2,
        ignoreErrors: true
      })

      expect(results).toHaveLength(3)
      expect(results).toEqual([
        CORE_MOCK_RESPONSES.USER,
        CORE_MOCK_RESPONSES.SUCCESS,
        CORE_MOCK_RESPONSES.CREATED
      ])

      // 验证拦截器数量
      expect(requestCore.getInterceptors()).toHaveLength(2)

      batchRequestsSpy.mockRestore()
    })

    test('应该正确处理资源清理', async () => {
      // 添加各种配置和拦截器
      requestCore.setGlobalConfig({
        baseURL: 'https://api.test.com',
        interceptors: [createTestInterceptor('test-interceptor')]
      })

      // Mock 一些操作
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)
      await requestCore.get('/test')

      // 执行资源清理 - destroy() 是异步的，需要等待
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      requestCore.destroy()
      
      // 等待 destroy() 完成
      await new Promise(resolve => setTimeout(resolve, 100))

      expect(consoleSpy).toHaveBeenCalledWith('[RequestCore] All resources have been cleaned up')
      
      consoleSpy.mockRestore()
    })
  })

  describe('错误传播集成', () => {
    test('应该正确处理拦截器链中的错误', async () => {
      // 添加一个会抛出错误的拦截器
      const errorInterceptor: RequestInterceptor = {
        onRequest: vi.fn(() => {
          throw new Error('Interceptor validation failed')
        })
      }

      requestCore.addInterceptor(errorInterceptor)

      await expect(requestCore.get(CORE_TEST_URLS.USERS)).rejects.toThrow()

      // 确保实际请求没有被执行
      expect(mockRequestor.getRequestCount()).toBe(0)
    })

    test('应该正确处理功能特性中的错误', async () => {
      // Mock 一个会失败的功能特性
      mockRequestor.getMock().mockRejectedValue(new Error('Retry failed after max attempts'))

      await expect(
        requestCore.request({
          url: CORE_TEST_URLS.ERROR,
          method: 'GET',
          metadata: {
            retryConfig: { retries: 3 }
          }
        })
      ).rejects.toThrow('Retry failed after max attempts')
    })
  })
})
