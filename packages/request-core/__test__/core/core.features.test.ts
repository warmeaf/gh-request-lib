import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig } from '../../src/interface'
import { RetryConfig } from '../../src/features/retry'
import { CacheConfig } from '../../src/features/cache'
import { ConcurrentConfig } from '../../src/features/concurrent'
import { MockRequestor, TEST_URLS } from '../test-helpers'

describe('RequestCore - 功能特性委托', () => {
  let mockRequestor: MockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new MockRequestor()
    requestCore = new RequestCore(mockRequestor)
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (requestCore) {
      requestCore.destroy()
    }
  })

  describe('重试功能', () => {
    it('应该执行重试请求', async () => {
      const mockResponse = { success: true }
      const requestWithRetrySpy = vi.spyOn(requestCore, 'requestWithRetry').mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }
      const retryConfig: RetryConfig = { retries: 3 }

      const result = await requestCore.requestWithRetry(config, retryConfig)

      expect(result).toEqual(mockResponse)
      expect(requestWithRetrySpy).toHaveBeenCalledWith(config, retryConfig)

      requestWithRetrySpy.mockRestore()
    })

    it('应该执行带重试的 GET 请求', async () => {
      const mockResponse = { data: 'test' }
      const getWithRetrySpy = vi.spyOn(requestCore, 'getWithRetry').mockResolvedValue(mockResponse)

      const result = await requestCore.getWithRetry(TEST_URLS.TEST, { retries: 2 })

      expect(result).toEqual(mockResponse)
      expect(getWithRetrySpy).toHaveBeenCalledWith(TEST_URLS.TEST, { retries: 2 })

      getWithRetrySpy.mockRestore()
    })

    it('应该执行带重试的 POST 请求', async () => {
      const mockResponse = { created: true }
      const postWithRetrySpy = vi.spyOn(requestCore, 'postWithRetry').mockResolvedValue(mockResponse)

      const postData = { name: 'test' }
      const result = await requestCore.postWithRetry(TEST_URLS.TEST, postData, { retries: 2 })

      expect(result).toEqual(mockResponse)
      expect(postWithRetrySpy).toHaveBeenCalledWith(TEST_URLS.TEST, postData, { retries: 2 })

      postWithRetrySpy.mockRestore()
    })
  })

  describe('缓存功能', () => {
    it('应该执行缓存请求', async () => {
      const mockResponse = { cached: true }
      const requestWithCacheSpy = vi.spyOn(requestCore, 'requestWithCache').mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }
      const cacheConfig: CacheConfig = { ttl: 60000 }

      const result = await requestCore.requestWithCache(config, cacheConfig)

      expect(result).toEqual(mockResponse)
      expect(requestWithCacheSpy).toHaveBeenCalledWith(config, cacheConfig)

      requestWithCacheSpy.mockRestore()
    })

    it('应该执行带缓存的 GET 请求', async () => {
      const mockResponse = { data: 'cached' }
      const getWithCacheSpy = vi.spyOn(requestCore, 'getWithCache').mockResolvedValue(mockResponse)

      const result = await requestCore.getWithCache(TEST_URLS.TEST, { ttl: 30000 })

      expect(result).toEqual(mockResponse)
      expect(getWithCacheSpy).toHaveBeenCalledWith(TEST_URLS.TEST, { ttl: 30000 })

      getWithCacheSpy.mockRestore()
    })

    it('应该清除缓存', () => {
      const clearCacheSpy = vi.spyOn(requestCore, 'clearCache').mockImplementation(() => {})

      requestCore.clearCache('test-key')

      expect(clearCacheSpy).toHaveBeenCalledWith('test-key')

      clearCacheSpy.mockRestore()
    })
  })

  describe('并发功能', () => {
    it('应该执行并发请求', async () => {
      const mockResults = [
        { success: true, data: 'result1', config: { url: 'test1', method: 'GET' } as RequestConfig, index: 0 },
        { success: true, data: 'result2', config: { url: 'test2', method: 'GET' } as RequestConfig, index: 1 }
      ]
      const requestConcurrentSpy = vi.spyOn(requestCore, 'requestConcurrent').mockResolvedValue(mockResults)

      const configs: RequestConfig[] = [
        { url: `${TEST_URLS.TEST}1`, method: 'GET' },
        { url: `${TEST_URLS.TEST}2`, method: 'GET' }
      ]
      const concurrentConfig: ConcurrentConfig = { maxConcurrency: 2 }

      const results = await requestCore.requestConcurrent(configs, concurrentConfig)

      expect(results).toEqual(mockResults)
      expect(requestConcurrentSpy).toHaveBeenCalledWith(configs, concurrentConfig)

      requestConcurrentSpy.mockRestore()
    })

    it('应该执行多重请求', async () => {
      const mockResults = [
        { success: true, data: 'result1', config: { url: 'test', method: 'GET' } as RequestConfig, index: 0 },
        { success: true, data: 'result2', config: { url: 'test', method: 'GET' } as RequestConfig, index: 1 }
      ]
      const requestMultipleSpy = vi.spyOn(requestCore, 'requestMultiple').mockResolvedValue(mockResults)

      const config: RequestConfig = { url: TEST_URLS.TEST, method: 'GET' }
      const count = 2
      const concurrentConfig: ConcurrentConfig = { maxConcurrency: 2 }

      const results = await requestCore.requestMultiple(config, count, concurrentConfig)

      expect(results).toEqual(mockResults)
      expect(requestMultipleSpy).toHaveBeenCalledWith(config, count, concurrentConfig)

      requestMultipleSpy.mockRestore()
    })

    it('应该执行并发 GET 请求', async () => {
      const mockResults = [
        { success: true, data: 'result1', config: { url: 'test1', method: 'GET' } as RequestConfig, index: 0 },
        { success: true, data: 'result2', config: { url: 'test2', method: 'GET' } as RequestConfig, index: 1 }
      ]
      const getConcurrentSpy = vi.spyOn(requestCore, 'getConcurrent').mockResolvedValue(mockResults)

      const urls = [`${TEST_URLS.TEST}1`, `${TEST_URLS.TEST}2`]
      const concurrentConfig: ConcurrentConfig = { maxConcurrency: 2 }

      const results = await requestCore.getConcurrent(urls, concurrentConfig)

      expect(results).toEqual(mockResults)
      expect(getConcurrentSpy).toHaveBeenCalledWith(urls, concurrentConfig)

      getConcurrentSpy.mockRestore()
    })

    it('应该执行并发 POST 请求', async () => {
      const mockResults = [
        { success: true, data: 'result1', config: { url: 'test1', method: 'POST' } as RequestConfig, index: 0 },
        { success: true, data: 'result2', config: { url: 'test2', method: 'POST' } as RequestConfig, index: 1 }
      ]
      const postConcurrentSpy = vi.spyOn(requestCore, 'postConcurrent').mockResolvedValue(mockResults)

      const requests = [
        { url: `${TEST_URLS.TEST}1`, data: { name: 'test1' } },
        { url: `${TEST_URLS.TEST}2`, data: { name: 'test2' } }
      ]
      const concurrentConfig: ConcurrentConfig = { maxConcurrency: 2 }

      const results = await requestCore.postConcurrent(requests, concurrentConfig)

      expect(results).toEqual(mockResults)
      expect(postConcurrentSpy).toHaveBeenCalledWith(requests, concurrentConfig)

      postConcurrentSpy.mockRestore()
    })
  })
})
