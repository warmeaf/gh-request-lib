import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IdempotentFeature } from '../../src/features/idempotent'
import {
  IdempotentMockRequestor,
  createIdempotentMockRequestor,
  createIdempotentFeature,
  cleanupIdempotentTest,
  IDEMPOTENT_TEST_CONFIGS,
  IDEMPOTENT_CONFIGS,
  IDEMPOTENT_TEST_RESPONSES,
  IdempotentTestAssertions,
  IdempotentPerformanceHelper,
  IdempotentTestDataGenerator,
  delay
} from './idempotent-test-helpers'

describe('IdempotentFeature - Advanced Functionality', () => {
  let mockRequestor: IdempotentMockRequestor
  let idempotentFeature: IdempotentFeature

  beforeEach(() => {
    vi.useFakeTimers()
    mockRequestor = createIdempotentMockRequestor()
    idempotentFeature = new IdempotentFeature(mockRequestor)
  })

  afterEach(async () => {
    vi.useRealTimers()
    await cleanupIdempotentTest(idempotentFeature, mockRequestor)
  })

  describe('并发请求处理', () => {
    it('应该正确处理并发的相同幂等请求', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      
      // 不设置延迟 - 并发测试不需要依赖时间，而是依赖并发执行时序
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // 并发执行5个相同的请求
      const concurrency = 5
      const promises = Array.from({ length: concurrency }, () =>
        idempotentFeature.requestIdempotent(config)
      )
      
      const results = await Promise.all(promises)
      
      // 验证所有结果都相同
      results.forEach(result => {
        expect(result).toEqual(expectedResponse)
      })
      
      // 验证统计信息 - 应该只有一次网络请求
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(concurrency)
      expect(stats.actualNetworkRequests).toBe(1)
      expect(stats.duplicatesBlocked).toBe(concurrency - 1)
      
      // 验证pending request reused统计
      expect(stats.pendingRequestsReused).toBe(concurrency - 1)
      
      // 验证只有一次实际的网络调用
      const callHistory = mockRequestor.getCallHistory()
      expect(callHistory).toHaveLength(1)
    })

    it('应该正确处理并发的不同幂等请求', async () => {
      const configs = IdempotentTestDataGenerator.generateRequestConfigs(3, '/api/concurrent-test')
      const expectedResponses = configs.map((config, index) => ({
        id: index,
        url: config.url,
        success: true
      }))
      
      // 设置每个URL的响应
      configs.forEach((config, index) => {
        mockRequestor.setUrlResponse(config.url, expectedResponses[index])
      })
      
      // 并发执行不同的请求
      const promises = configs.map(config =>
        idempotentFeature.requestIdempotent(config)
      )
      
      const results = await Promise.all(promises)
      
      // 验证每个请求都得到正确响应
      results.forEach((result, index) => {
        expect(result).toEqual(expectedResponses[index])
      })
      
      // 验证统计信息 - 应该有3次网络请求
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.actualNetworkRequests).toBe(3)
      expect(stats.duplicatesBlocked).toBe(0)
    })

    it('应该处理混合的并发请求（相同和不同）', async () => {
      const config1 = { url: '/api/test-1', method: 'GET' as const }
      const config2 = { url: '/api/test-2', method: 'GET' as const }
      const response1 = { id: 1, data: 'test-1' }
      const response2 = { id: 2, data: 'test-2' }
      
      mockRequestor.setUrlResponse(config1.url, response1)
      mockRequestor.setUrlResponse(config2.url, response2)
      
      // 创建混合的并发请求：3个config1，2个config2
      const promises = [
        idempotentFeature.requestIdempotent(config1),
        idempotentFeature.requestIdempotent(config1),
        idempotentFeature.requestIdempotent(config2),
        idempotentFeature.requestIdempotent(config1),
        idempotentFeature.requestIdempotent(config2)
      ]
      
      const results = await Promise.all(promises)
      
      // 验证结果
      expect(results[0]).toEqual(response1)
      expect(results[1]).toEqual(response1)
      expect(results[2]).toEqual(response2)
      expect(results[3]).toEqual(response1)
      expect(results[4]).toEqual(response2)
      
      // 验证统计信息
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(5)
      expect(stats.actualNetworkRequests).toBe(2) // 只有两个不同的请求
      expect(stats.duplicatesBlocked).toBe(3) // 3个重复请求被阻止
    })
  })

  describe('复杂缓存策略', () => {
    it('应该正确处理不同TTL的缓存策略', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // 使用短TTL执行第一次请求
      const shortTTLConfig = { ttl: 1000 }
      await idempotentFeature.requestIdempotent(config, shortTTLConfig)
      
      // 在TTL期间内的请求应该被缓存
      await idempotentFeature.requestIdempotent(config, shortTTLConfig)
      
      let stats = idempotentFeature.getIdempotentStats()
      expect(stats.cacheHits).toBe(1)
      
      // 等待TTL过期
      vi.advanceTimersByTime(2000)
      
      // 使用长TTL执行请求 - 因为缓存过期，应该重新执行
      const longTTLConfig = { ttl: 60000 }
      await idempotentFeature.requestIdempotent(config, longTTLConfig)
      
      stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.actualNetworkRequests).toBe(2)
    })

    it('应该处理大量缓存条目的情况', async () => {
      const configs = IdempotentTestDataGenerator.generateRequestConfigs(100, '/api/cache-stress')
      
      // 为每个URL设置响应
      configs.forEach((config, index) => {
        mockRequestor.setUrlResponse(config.url, { id: index, data: `response-${index}` })
      })
      
      // 执行所有请求建立缓存
      for (const config of configs) {
        await idempotentFeature.requestIdempotent(config)
      }
      
      // 再次执行所有请求 - 应该全部命中缓存
      for (const config of configs) {
        await idempotentFeature.requestIdempotent(config)
      }
      
      // 验证统计信息
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(200)
      expect(stats.actualNetworkRequests).toBe(100)
      expect(stats.cacheHits).toBe(100)
    })

    it('应该支持缓存项的访问统计', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // 执行多次相同请求
      for (let i = 0; i < 5; i++) {
        await idempotentFeature.requestIdempotent(config)
      }
      
      // 验证统计信息
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(5)
      expect(stats.actualNetworkRequests).toBe(1)
      expect(stats.cacheHits).toBe(4)
      
      // 验证缓存访问统计正确更新
      // 这里主要验证没有报错，具体的缓存项访问统计在缓存功能中验证
    })
  })

  describe('内存和资源管理', () => {
    it('应该正确清理过期的缓存条目', async () => {
      const configs = IdempotentTestDataGenerator.generateRequestConfigs(5, '/api/expire-test')
      
      // 设置响应
      configs.forEach((config, index) => {
        mockRequestor.setUrlResponse(config.url, { id: index })
      })
      
      // 使用短TTL执行请求
      const shortTTLConfig = { ttl: 1000 }
      for (const config of configs) {
        await idempotentFeature.requestIdempotent(config, shortTTLConfig)
      }
      
      // 等待TTL过期
      vi.advanceTimersByTime(2000)
      
      // 再次执行请求 - 应该清理过期条目并重新执行
      for (const config of configs) {
        await idempotentFeature.requestIdempotent(config, shortTTLConfig)
      }
      
      // 验证统计信息
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(10)
      expect(stats.actualNetworkRequests).toBe(10) // 全部重新执行
      expect(stats.cacheHits).toBe(0) // 无缓存命中（因为都过期了）
    })
  })

  describe('边界条件和异常场景', () => {
    it('应该处理极短TTL的情况', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const veryShortTTLConfig = { ttl: 1 } // 1ms TTL
      
      // 执行请求
      await idempotentFeature.requestIdempotent(config, veryShortTTLConfig)
      
      // 等待TTL过期
      vi.advanceTimersByTime(2)
      
      // 再次执行 - 应该重新执行
      await idempotentFeature.requestIdempotent(config, veryShortTTLConfig)
      
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.actualNetworkRequests).toBe(2)
    })

    it('应该处理极长TTL的情况', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const veryLongTTLConfig = { ttl: Number.MAX_SAFE_INTEGER }
      
      // 执行请求
      await idempotentFeature.requestIdempotent(config, veryLongTTLConfig)
      
      // 推进很长时间
      vi.advanceTimersByTime(1000000)
      
      // 再次执行 - 应该仍然命中缓存
      await idempotentFeature.requestIdempotent(config, veryLongTTLConfig)
      
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.actualNetworkRequests).toBe(1)
      expect(stats.cacheHits).toBe(1)
    })

    it('应该处理空数据的请求', async () => {
      const config = {
        url: '/api/empty-data',
        method: 'POST' as const,
        data: null
      }
      const expectedResponse = { processed: true }
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // 执行请求
      const result = await idempotentFeature.requestIdempotent(config)
      expect(result).toEqual(expectedResponse)
      
      // 再次执行相同请求
      const result2 = await idempotentFeature.requestIdempotent(config)
      expect(result2).toEqual(expectedResponse)
      
      // 验证幂等性
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.duplicatesBlocked).toBe(1)
    })

    it('应该处理大型复杂数据的请求', async () => {
      const largeData = {
        users: Array.from({ length: 100 }, (_, i) => ({
          id: i,
          name: `User ${i}`,
          email: `user${i}@example.com`,
          metadata: {
            created: new Date().toISOString(),
            tags: Array.from({ length: 10 }, (_, j) => `tag-${i}-${j}`)
          }
        })),
        settings: {
          theme: 'dark',
          notifications: true,
          features: Array.from({ length: 50 }, (_, i) => `feature-${i}`)
        }
      }
      
      const config = {
        url: '/api/large-data',
        method: 'POST' as const,
        data: largeData
      }
      const expectedResponse = { success: true, processedItems: 100 }
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // 执行请求
      const result = await idempotentFeature.requestIdempotent(config)
      expect(result).toEqual(expectedResponse)
      
      // 再次执行相同请求 - 应该命中缓存
      const result2 = await idempotentFeature.requestIdempotent(config)
      expect(result2).toEqual(expectedResponse)
      
      // 验证幂等性
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.actualNetworkRequests).toBe(1)
      expect(stats.cacheHits).toBe(1)
    })
  })

  describe('高级配置场景', () => {
    it('应该正确处理复杂的头部配置', async () => {
      const config = {
        url: '/api/complex-headers',
        method: 'POST' as const,
        headers: {
          'Authorization': 'Bearer token123',
          'X-API-Key': 'api-key-456',
          'Content-Type': 'application/json',
          'X-Request-ID': 'req-789',
          'User-Agent': 'Test Agent'
        },
        data: { test: true }
      }
      
      const expectedResponse = { authenticated: true }
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // 测试包含所有头部的配置
      const allHeadersConfig = { includeAllHeaders: true }
      
      await idempotentFeature.requestIdempotent(config, allHeadersConfig)
      await idempotentFeature.requestIdempotent(config, allHeadersConfig)
      
      let stats = idempotentFeature.getIdempotentStats()
      expect(stats.cacheHits).toBe(1)
      
      // 重置并测试选择性头部配置
      idempotentFeature.resetStats()
      
      const selectiveHeadersConfig = {
        includeHeaders: ['authorization', 'x-api-key'],
        includeAllHeaders: false
      }
      
      await idempotentFeature.requestIdempotent(config, selectiveHeadersConfig)
      await idempotentFeature.requestIdempotent(config, selectiveHeadersConfig)
      
      stats = idempotentFeature.getIdempotentStats()
      expect(stats.cacheHits).toBe(1)
    })

    it('应该支持不同哈希算法的键生成', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.COMPLEX_DATA
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const algorithms = ['fnv1a', 'xxhash', 'simple'] as const
      
      for (const algorithm of algorithms) {
        const algorithmConfig = { hashAlgorithm: algorithm }
        
        // 每种算法都应该能正常工作
        await idempotentFeature.requestIdempotent(config, algorithmConfig)
        await idempotentFeature.requestIdempotent(config, algorithmConfig)
      }
      
      // 验证所有请求都正常执行
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(algorithms.length * 2)
      // 每种算法产生不同的键，所以实际网络请求数等于算法数
      expect(stats.actualNetworkRequests).toBe(algorithms.length)
    })

    it('应该处理重复请求回调', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const onDuplicateMock = vi.fn()
      const callbackConfig = {
        onDuplicate: onDuplicateMock
      }
      
      // 执行两次相同请求
      await idempotentFeature.requestIdempotent(config, callbackConfig)
      await idempotentFeature.requestIdempotent(config, callbackConfig)
      
      // 验证回调被调用
      expect(onDuplicateMock).toHaveBeenCalledTimes(1)
      expect(onDuplicateMock).toHaveBeenCalledWith(
        expect.objectContaining(config),
        expect.objectContaining(config)
      )
      
      // 再执行一次
      await idempotentFeature.requestIdempotent(config, callbackConfig)
      
      // 回调应该再次被调用
      expect(onDuplicateMock).toHaveBeenCalledTimes(2)
    })
  })
})
