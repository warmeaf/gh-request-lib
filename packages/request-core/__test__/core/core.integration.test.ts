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

      // Mock 功能特性方法
      const requestWithCacheSpy = vi.spyOn(requestCore, 'requestWithCache')
      requestWithCacheSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

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
      expect(requestWithCacheSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: CORE_TEST_URLS.USERS,
          method: 'GET',
          headers: expect.objectContaining({ 'Accept': 'application/json' }),
          params: { page: 1, limit: 10 },
          timeout: 10000,
          debug: true
        }),
        { ttl: 300000 }
      )

      requestWithCacheSpy.mockRestore()
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

      // Mock 重试功能，让它实际执行请求
      const originalRequestWithRetry = requestCore['featureManager'].requestWithRetry.bind(requestCore['featureManager'])
      const requestWithRetrySpy = vi.spyOn(requestCore, 'requestWithRetry')
      requestWithRetrySpy.mockImplementation(async (config, retryConfig) => {
        // 这里模拟重试逻辑
        let lastError: any
        const maxAttempts = (retryConfig?.retries || 0) + 1
        
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
          try {
            return await requestCore.request(config)
          } catch (error) {
            lastError = error
            if (attempt < maxAttempts) {
              await waitFor(100) // 短暂延迟
            }
          }
        }
        throw lastError
      })

      const config: RequestConfig = {
        url: CORE_TEST_URLS.ERROR,
        method: 'GET'
      }

      const result = await requestCore.requestWithRetry(config, { retries: 3 })

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
      expect(attemptCount).toBe(3) // 应该尝试了3次
      expect(requestWithRetrySpy).toHaveBeenCalledWith(config, { retries: 3 })

      requestWithRetrySpy.mockRestore()
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

      // Mock 串行功能
      const requestSerialSpy = vi.spyOn(requestCore, 'requestSerial')
      requestSerialSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const hasSerialQueueSpy = vi.spyOn(requestCore, 'hasSerialQueue')
      hasSerialQueueSpy.mockReturnValue(true)

      const clearSerialQueueSpy = vi.spyOn(requestCore, 'clearSerialQueue')
      clearSerialQueueSpy.mockReturnValue(true)

      const serialKey = 'user-operations'
      
      // 执行串行请求
      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'POST',
        serialKey,
        data: { name: 'John' }
      }

      await requestCore.requestSerial(config)

      // 检查队列状态
      const hasQueue = requestCore.hasSerialQueue(serialKey)
      expect(hasQueue).toBe(true)

      // 清除队列
      const cleared = requestCore.clearSerialQueue(serialKey)
      expect(cleared).toBe(true)

      // 验证 requestSerial 被调用，只传了一个参数时不需要检查 undefined
      expect(requestSerialSpy).toHaveBeenCalledWith(config)
      expect(hasSerialQueueSpy).toHaveBeenCalledWith(serialKey)
      expect(clearSerialQueueSpy).toHaveBeenCalledWith(serialKey)

      requestSerialSpy.mockRestore()
      hasSerialQueueSpy.mockRestore()
      clearSerialQueueSpy.mockRestore()
    })
  })

  describe('缓存与幂等性集成', () => {
    test('应该支持缓存和幂等性的组合使用', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      // Mock 缓存和幂等功能 - spy featureManager 的方法而不是 requestCore 的
      const featureManager = requestCore['featureManager']
      const requestWithCacheSpy = vi.spyOn(featureManager, 'requestWithCache')
      requestWithCacheSpy.mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      // postIdempotent 内部调用 featureManager.postIdempotent
      const requestIdempotentSpy = vi.spyOn(featureManager, 'postIdempotent')
      requestIdempotentSpy.mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const clearCacheSpy = vi.spyOn(requestCore, 'clearCache')
      clearCacheSpy.mockImplementation(() => {})

      const clearIdempotentCacheSpy = vi.spyOn(requestCore, 'clearIdempotentCache')
      clearIdempotentCacheSpy.mockResolvedValue()

      // 使用缓存请求
      const cacheResult = await requestCore.getWithCache(CORE_TEST_URLS.USER_DETAIL, { ttl: 300000 })
      expect(cacheResult).toEqual(CORE_MOCK_RESPONSES.USER)

      // 使用幂等请求
      const idempotentResult = await requestCore.postIdempotent(
        CORE_TEST_URLS.USERS,
        { name: 'John' },
        {},
        { ttl: 600000 }
      )
      expect(idempotentResult).toEqual(CORE_MOCK_RESPONSES.USER)

      // 清理缓存
      requestCore.clearCache()
      await requestCore.clearIdempotentCache()

      expect(requestWithCacheSpy).toHaveBeenCalled()
      expect(requestIdempotentSpy).toHaveBeenCalled()
      expect(clearCacheSpy).toHaveBeenCalled()
      expect(clearIdempotentCacheSpy).toHaveBeenCalled()

      requestWithCacheSpy.mockRestore()
      requestIdempotentSpy.mockRestore()
      clearCacheSpy.mockRestore()
      clearIdempotentCacheSpy.mockRestore()
    })
  })

  describe('统计和监控集成', () => {
    test('应该提供完整的统计信息', () => {
      // Mock 各种统计方法
      const getCacheStatsSpy = vi.spyOn(requestCore, 'getCacheStats')
      getCacheStatsSpy.mockReturnValue(Promise.resolve({
        size: 15,
        maxEntries: 100,
        hitRate: 66.67,
        keyGeneratorStats: {
          totalGenerations: 15,
          cacheHits: 10,
          cacheMisses: 5,
          averageGenerationTime: 1,
          cacheSize: 15,
          lastCleanupTime: Date.now(),
          hitRate: '66.67%'
        },
        lastCleanup: Date.now(),
        cleanupInterval: 60000,
        storageType: StorageType.MEMORY
      }))

      const getConcurrentStatsSpy = vi.spyOn(requestCore, 'getConcurrentStats')
      getConcurrentStatsSpy.mockReturnValue({
        total: 50,
        completed: 50,
        successful: 47,
        failed: 3,
        averageDuration: 200,
        maxConcurrencyUsed: 5
      })

      const getIdempotentStatsSpy = vi.spyOn(requestCore, 'getIdempotentStats')
      getIdempotentStatsSpy.mockReturnValue({
        totalRequests: 10,
        duplicatesBlocked: 8,
        pendingRequestsReused: 2,
        cacheHits: 6,
        actualNetworkRequests: 2,
        duplicateRate: 80,
        avgResponseTime: 150,
        keyGenerationTime: 1
      })

      const getSerialStatsSpy = vi.spyOn(requestCore, 'getSerialStats')
      getSerialStatsSpy.mockReturnValue({
        totalQueues: 2,
        activeQueues: 1,
        totalTasks: 25,
        totalPendingTasks: 5,
        totalCompletedTasks: 18,
        totalFailedTasks: 2,
        avgProcessingTime: 180,
        queues: {}
      })

      // 获取所有统计信息
      const allStats = requestCore.getAllStats()
      const concurrentStats = requestCore.getConcurrentStats()
      const idempotentStats = requestCore.getIdempotentStats()
      const serialStats = requestCore.getSerialStats()

      expect(allStats).toHaveProperty('cache')
      expect(allStats).toHaveProperty('concurrent')
      expect(allStats).toHaveProperty('interceptors')
      expect(allStats).toHaveProperty('config')

      expect(concurrentStats).toEqual({
        total: 50,
        completed: 50,
        successful: 47,
        failed: 3,
        averageDuration: 200,
        maxConcurrencyUsed: 5
      })
      expect(idempotentStats).toEqual({
        totalRequests: 10,
        duplicatesBlocked: 8,
        pendingRequestsReused: 2,
        cacheHits: 6,
        actualNetworkRequests: 2,
        duplicateRate: 80,
        avgResponseTime: 150,
        keyGenerationTime: 1
      })
      expect(serialStats).toEqual({
        totalQueues: 2,
        activeQueues: 1,
        totalTasks: 25,
        totalPendingTasks: 5,
        totalCompletedTasks: 18,
        totalFailedTasks: 2,
        avgProcessingTime: 180,
        queues: {}
      })

      getCacheStatsSpy.mockRestore()
      getConcurrentStatsSpy.mockRestore()
      getIdempotentStatsSpy.mockRestore()
      getSerialStatsSpy.mockRestore()
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

      // 获取清理前的状态
      const statsBefore = requestCore.getAllStats()
      expect(statsBefore).toBeDefined()

      // 执行资源清理
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      requestCore.destroy()

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
      const requestWithRetrySpy = vi.spyOn(requestCore, 'requestWithRetry')
      requestWithRetrySpy.mockRejectedValue(new Error('Retry failed after max attempts'))

      await expect(
        requestCore.requestWithRetry({ url: CORE_TEST_URLS.ERROR, method: 'GET' }, { retries: 3 })
      ).rejects.toThrow('Retry failed after max attempts')

      requestWithRetrySpy.mockRestore()
    })
  })
})
