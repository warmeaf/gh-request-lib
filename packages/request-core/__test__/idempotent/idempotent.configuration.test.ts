import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IdempotentFeature } from '../../src/features/idempotent'
import { RequestError, RequestErrorType } from '../../src/interface'
import {
  IdempotentMockRequestor,
  createIdempotentMockRequestor,
  createIdempotentFeature,
  cleanupIdempotentTest,
  IDEMPOTENT_TEST_CONFIGS,
  IDEMPOTENT_TEST_RESPONSES,
  IdempotentTestDataGenerator,
  MockIdempotentValidationError,
  delay
} from './idempotent-test-helpers'

describe('IdempotentFeature - Configuration Tests', () => {
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

  describe('TTL 配置测试', () => {
    it('应该使用默认TTL配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // 不指定TTL，使用默认值
      await idempotentFeature.requestIdempotent(config)
      await idempotentFeature.requestIdempotent(config)
      
      // 验证第二次请求被缓存
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.cacheHits).toBe(1)
      expect(stats.actualNetworkRequests).toBe(1)
    })

    it('应该正确处理自定义TTL配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const customTTLs = [1000, 5000, 10000, 30000, 60000]
      
      for (const ttl of customTTLs) {
        // 重置功能以避免缓存干扰
        await idempotentFeature.clearIdempotentCache()
        idempotentFeature.resetStats()
        
        const ttlConfig = { ttl }
        
        // 执行第一次请求
        await idempotentFeature.requestIdempotent(config, ttlConfig)
        
        // 在TTL期间内的请求应该被缓存
        await idempotentFeature.requestIdempotent(config, ttlConfig)
        
        const stats = idempotentFeature.getIdempotentStats()
        expect(stats.cacheHits).toBe(1)
        expect(stats.totalRequests).toBe(2)
        expect(stats.actualNetworkRequests).toBe(1)
      }
    })

    it('应该验证TTL配置的有效性', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      
      const invalidTTLs = [0, -1, -100, 1.5, NaN, Infinity]
      
      for (const ttl of invalidTTLs) {
        const ttlConfig = { ttl }
        
        await expect(
          idempotentFeature.requestIdempotent(config, ttlConfig)
        ).rejects.toThrow(RequestError)
        
        try {
          await idempotentFeature.requestIdempotent(config, ttlConfig)
        } catch (error) {
          expect(error).toBeInstanceOf(RequestError)
          const reqError = error as RequestError
          expect(reqError.type).toBe(RequestErrorType.VALIDATION_ERROR)
          expect(reqError.message).toContain('TTL must be a positive integer')
        }
      }
    })

    it('应该处理TTL过期后的缓存清理', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const shortTTL = { ttl: 500 }
      
      // 第一次请求建立缓存
      await idempotentFeature.requestIdempotent(config, shortTTL)
      
      // TTL期间内应该命中缓存
      await idempotentFeature.requestIdempotent(config, shortTTL)
      
      let stats = idempotentFeature.getIdempotentStats()
      expect(stats.cacheHits).toBe(1)
      
      // 等待TTL过期
      vi.advanceTimersByTime(1000)
      
      // TTL过期后应该重新执行网络请求
      await idempotentFeature.requestIdempotent(config, shortTTL)
      
      stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.actualNetworkRequests).toBe(2)
      expect(stats.cacheHits).toBe(1) // 只有中间的请求命中缓存
    })
  })

  describe('键生成配置测试', () => {
    it('应该支持自定义键配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const customKeys = ['my-custom-key', 'user-123-action', 'session-abc-def']
      
      for (let i = 0; i < customKeys.length; i++) {
        const keyConfig = { key: customKeys[i] }
        
        await idempotentFeature.requestIdempotent(config, keyConfig)
        await idempotentFeature.requestIdempotent(config, keyConfig)
        
        // 验证自定义键工作正常
        const stats = idempotentFeature.getIdempotentStats()
        expect(stats.totalRequests).toBe((i + 1) * 2)
        expect(stats.cacheHits).toBe(i + 1)
      }
    })

    it('应该为不同的自定义键生成不同的缓存条目', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const key1Config = { key: 'custom-key-1' }
      const key2Config = { key: 'custom-key-2' }
      
      // 使用不同的自定义键执行相同的请求
      await idempotentFeature.requestIdempotent(config, key1Config)
      await idempotentFeature.requestIdempotent(config, key2Config)
      
      // 验证生成了不同的缓存条目（两次网络请求）
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.actualNetworkRequests).toBe(2)
      expect(stats.duplicatesBlocked).toBe(0)
      
      // 重复使用相同的键应该命中缓存
      await idempotentFeature.requestIdempotent(config, key1Config)
      await idempotentFeature.requestIdempotent(config, key2Config)
      
      const finalStats = idempotentFeature.getIdempotentStats()
      expect(finalStats.totalRequests).toBe(4)
      expect(finalStats.actualNetworkRequests).toBe(2)
      expect(finalStats.cacheHits).toBe(2)
    })

    it('应该正确处理空字符串和特殊字符的自定义键', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const specialKeys = [
        '',
        ' ',
        '中文键',
        'key-with-spaces and symbols!@#$%',
        'key\nwith\nnewlines',
        'key\twith\ttabs'
      ]
      
      for (const key of specialKeys) {
        const keyConfig = { key }

        // 特殊键也应该能正常工作
        await idempotentFeature.requestIdempotent(config, keyConfig)
        await idempotentFeature.requestIdempotent(config, keyConfig)
      }
      
      // 验证所有特殊键都被正确处理
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(specialKeys.length * 2)
      expect(stats.cacheHits).toBe(specialKeys.length)
    })
  })

  describe('头部包含配置测试', () => {
    it('应该支持选择性包含指定头部', async () => {
      const baseConfig = {
        url: '/api/headers-test',
        method: 'GET' as const,
        headers: {
          'Authorization': 'Bearer token123',
          'X-API-Key': 'api-key-456',
          'Content-Type': 'application/json',
          'User-Agent': 'Test Agent',
          'X-Custom': 'custom-value'
        }
      }
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(baseConfig.url, expectedResponse)
      
      const headersConfig = {
        includeHeaders: ['authorization', 'x-api-key'],
        includeAllHeaders: false
      }
      
      // 执行请求
      await idempotentFeature.requestIdempotent(baseConfig, headersConfig)
      await idempotentFeature.requestIdempotent(baseConfig, headersConfig)
      
      // 验证缓存命中
      let stats = idempotentFeature.getIdempotentStats()
      expect(stats.cacheHits).toBe(1)
      
      // 修改未包含的头部，应该仍然命中缓存
      const modifiedConfig = {
        ...baseConfig,
        headers: {
          ...baseConfig.headers,
          'User-Agent': 'Different Agent',
          'X-Custom': 'different-value'
        }
      }
      
      await idempotentFeature.requestIdempotent(modifiedConfig, headersConfig)
      
      stats = idempotentFeature.getIdempotentStats()
      expect(stats.cacheHits).toBe(2) // 仍然命中缓存
      
      // 修改包含的头部，应该不命中缓存
      const modifiedIncludedConfig = {
        ...baseConfig,
        headers: {
          ...baseConfig.headers,
          'Authorization': 'Bearer different-token'
        }
      }
      
      await idempotentFeature.requestIdempotent(modifiedIncludedConfig, headersConfig)
      
      stats = idempotentFeature.getIdempotentStats()
      expect(stats.actualNetworkRequests).toBe(2) // 应该有两次网络请求
    })

    it('应该支持包含所有头部的配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.WITH_HEADERS
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const allHeadersConfig = { includeAllHeaders: true }
      
      // 执行请求
      await idempotentFeature.requestIdempotent(config, allHeadersConfig)
      await idempotentFeature.requestIdempotent(config, allHeadersConfig)
      
      // 验证缓存命中
      let stats = idempotentFeature.getIdempotentStats()
      expect(stats.cacheHits).toBe(1)
      
      // 修改任何头部都应该影响缓存
      const modifiedConfig = {
        ...config,
        headers: {
          ...config.headers!,
          'Authorization': 'Bearer different-token'
        }
      }
      
      await idempotentFeature.requestIdempotent(modifiedConfig, allHeadersConfig)
      
      stats = idempotentFeature.getIdempotentStats()
      expect(stats.actualNetworkRequests).toBe(2) // 应该有两次网络请求
    })

    it('应该正确验证头部配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      
      const invalidHeadersConfigs = [
        { includeHeaders: 'not-an-array' }, // 不是数组
        { includeHeaders: 123 }, // 数字
        { includeHeaders: null }, // null
        { includeHeaders: {} } // 对象
      ]
      
      for (const headersConfig of invalidHeadersConfigs) {
        await expect(
          idempotentFeature.requestIdempotent(config, headersConfig as any)
        ).rejects.toThrow(RequestError)
        
        try {
          await idempotentFeature.requestIdempotent(config, headersConfig as any)
        } catch (error) {
          expect(error).toBeInstanceOf(RequestError)
          const reqError = error as RequestError
          expect(reqError.type).toBe(RequestErrorType.VALIDATION_ERROR)
          expect(reqError.message).toContain('includeHeaders must be an array')
        }
      }
    })

    it('应该处理空头部配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const emptyHeadersConfigs = [
        { includeHeaders: [] },
        { includeHeaders: [], includeAllHeaders: false }
      ]
      
      for (const headersConfig of emptyHeadersConfigs) {
        // 清除之前的缓存和统计
        await idempotentFeature.clearIdempotentCache()
        idempotentFeature.resetStats()
        
        await idempotentFeature.requestIdempotent(config, headersConfig)
        await idempotentFeature.requestIdempotent(config, headersConfig)
        
        // 验证空头部配置也能正常工作
        const stats = idempotentFeature.getIdempotentStats()
        expect(stats.cacheHits).toBe(1)
      }
    })
  })

  describe('哈希算法配置测试', () => {
    it('应该支持不同的哈希算法', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.COMPLEX_DATA
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const algorithms = ['fnv1a', 'xxhash', 'simple'] as const
      
      for (const algorithm of algorithms) {
        // 清除之前的缓存
        await idempotentFeature.clearIdempotentCache()
        idempotentFeature.resetStats()
        
        const algorithmConfig = { hashAlgorithm: algorithm }
        
        // 执行请求测试哈希算法
        await idempotentFeature.requestIdempotent(config, algorithmConfig)
        await idempotentFeature.requestIdempotent(config, algorithmConfig)
        
        // 验证哈希算法工作正常
        const stats = idempotentFeature.getIdempotentStats()
        expect(stats.totalRequests).toBe(2)
        expect(stats.actualNetworkRequests).toBe(1)
        expect(stats.cacheHits).toBe(1)
      }
    })

    it('应该验证哈希算法配置的有效性', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      
      const invalidAlgorithms = ['md5', 'sha1', 'invalid', '', null, 123, {}]
      
      for (const algorithm of invalidAlgorithms) {
        const algorithmConfig = { hashAlgorithm: algorithm }
        
        await expect(
          idempotentFeature.requestIdempotent(config, algorithmConfig as any)
        ).rejects.toThrow(RequestError)
        
        try {
          await idempotentFeature.requestIdempotent(config, algorithmConfig as any)
        } catch (error) {
          expect(error).toBeInstanceOf(RequestError)
          const reqError = error as RequestError
          expect(reqError.type).toBe(RequestErrorType.VALIDATION_ERROR)
          expect(reqError.message).toContain('hashAlgorithm must be one of: fnv1a, xxhash, simple')
        }
      }
    })

    it('应该为不同哈希算法生成不同的键', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.COMPLEX_DATA
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // 使用不同的哈希算法执行相同的请求
      await idempotentFeature.requestIdempotent(config, { hashAlgorithm: 'fnv1a' })
      await idempotentFeature.requestIdempotent(config, { hashAlgorithm: 'xxhash' })
      await idempotentFeature.requestIdempotent(config, { hashAlgorithm: 'simple' })
      
      // 验证产生了不同的缓存条目（3次网络请求）
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.actualNetworkRequests).toBe(3)
      expect(stats.duplicatesBlocked).toBe(0)
    })
  })

  describe('组合配置测试', () => {
    it('应该支持复杂的组合配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.WITH_HEADERS
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const complexConfig = {
        ttl: 15000,
        includeHeaders: ['authorization', 'content-type'],
        includeAllHeaders: false,
        hashAlgorithm: 'xxhash' as const,
        onDuplicate: vi.fn()
      }
      
      // 执行请求
      await idempotentFeature.requestIdempotent(config, complexConfig)
      await idempotentFeature.requestIdempotent(config, complexConfig)
      
      // 验证所有配置都正确应用
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.actualNetworkRequests).toBe(1)
      expect(stats.cacheHits).toBe(1)
      
      // 验证回调被调用
      expect(complexConfig.onDuplicate).toHaveBeenCalledTimes(1)
    })

    it('应该处理配置冲突的情况', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.WITH_HEADERS
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // includeAllHeaders 应该覆盖 includeHeaders
      const conflictConfig = {
        includeHeaders: ['authorization'],
        includeAllHeaders: true
      }
      
      await idempotentFeature.requestIdempotent(config, conflictConfig)
      
      // 修改不在 includeHeaders 中但在所有头部中的头部
      const modifiedConfig = {
        ...config,
        headers: {
          ...config.headers!,
          'Content-Type': 'application/xml' // 修改content-type
        }
      }
      
      await idempotentFeature.requestIdempotent(modifiedConfig, conflictConfig)
      
      // 由于 includeAllHeaders: true，应该检测到差异并执行新的网络请求
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.actualNetworkRequests).toBe(2)
    })

    it('应该支持部分配置更新', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.WITH_HEADERS
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 第一次使用默认配置（不包含头部）
      await idempotentFeature.requestIdempotent(config)

      // 第二次指定包含特定头部
      await idempotentFeature.requestIdempotent(config, { includeHeaders: ['authorization'] })

      // 第三次指定包含所有头部
      await idempotentFeature.requestIdempotent(config, { includeAllHeaders: true })

      const stats = idempotentFeature.getIdempotentStats()

      // 由于头部配置不同，应该产生不同的键
      expect(stats.totalRequests).toBe(3)
      expect(stats.actualNetworkRequests).toBeGreaterThan(1)
    })
  })

  describe('默认配置测试', () => {
    it('应该使用正确的默认配置值', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // 不提供任何配置，应该使用默认值
      await idempotentFeature.requestIdempotent(config)

      const stats = idempotentFeature.getIdempotentStats()

      // 验证默认配置工作正常
      expect(stats.totalRequests).toBe(1)
      expect(stats.actualNetworkRequests).toBe(1)
      expect(stats.keyGenerationTime).toBeGreaterThanOrEqual(0)
    })

    it('应该在实例级别正确设置默认缓存键配置', async () => {
      // 创建带有自定义默认配置的实例
      const customKeyConfig = {
        includeHeaders: true,
        headersWhitelist: ['x-custom-header'],
        hashAlgorithm: 'simple' as const
      }
      
      const customFeature = new IdempotentFeature(mockRequestor, customKeyConfig)
      
      try {
        const config = {
          url: '/api/custom-config-test',
          method: 'GET' as const,
          headers: {
            'X-Custom-Header': 'custom-value',
            'Authorization': 'Bearer token'
          }
        }
        
        const expectedResponse = { success: true }
        mockRequestor.setUrlResponse(config.url, expectedResponse)
        
        // 执行请求
        await customFeature.requestIdempotent(config)
        await customFeature.requestIdempotent(config)
        
        const stats = customFeature.getIdempotentStats()
        expect(stats.cacheHits).toBe(1)
        
        // 修改不在白名单中的头部，应该仍然命中缓存
        const modifiedConfig = {
          ...config,
          headers: {
            ...config.headers,
            'Authorization': 'Bearer different-token'
          }
        }
        
        await customFeature.requestIdempotent(modifiedConfig)
        
        const finalStats = customFeature.getIdempotentStats()
        expect(finalStats.cacheHits).toBe(2) // 仍然命中缓存
        
      } finally {
        await customFeature.destroy()
      }
    })
  })

  describe('配置验证边界测试', () => {
    it('应该处理极值TTL配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      // 测试最小有效TTL
      const minTTLConfig = { ttl: 1 }
      await expect(idempotentFeature.requestIdempotent(config, minTTLConfig)).resolves.toEqual(expectedResponse)
      
      // 测试很大的TTL
      const maxTTLConfig = { ttl: Number.MAX_SAFE_INTEGER }
      await expect(idempotentFeature.requestIdempotent(config, maxTTLConfig)).resolves.toEqual(expectedResponse)
      
      // 测试普通大数值TTL
      const largeTTLConfig = { ttl: 86400000 } // 24小时
      await expect(idempotentFeature.requestIdempotent(config, largeTTLConfig)).resolves.toEqual(expectedResponse)
    })

    it('应该处理很长的头部列表', async () => {
      const manyHeaders = Array.from({ length: 50 }, (_, i) => `x-header-${i}`)
      const config = {
        ...IDEMPOTENT_TEST_CONFIGS.BASIC_GET,
        headers: manyHeaders.reduce((acc, header, i) => {
          acc[header] = `value-${i}`
          return acc
        }, {} as Record<string, string>)
      }
      
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const manyHeadersConfig = {
        includeHeaders: manyHeaders,
        includeAllHeaders: false
      }
      
      // 应该能处理很多头部
      await expect(
        idempotentFeature.requestIdempotent(config, manyHeadersConfig)
      ).resolves.toEqual(expectedResponse)
    })

    it('应该处理Unicode字符在配置中的情况', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)
      
      const unicodeConfigs = [
        { key: '中文键名' },
        { key: '🚀🔥💯' },
        { key: 'ключ-на-русском' },
        { includeHeaders: ['授权', 'Авторизация'] }
      ]
      
      for (const unicodeConfig of unicodeConfigs) {
        // Unicode配置应该能正常工作
        await expect(
          idempotentFeature.requestIdempotent(config, unicodeConfig as any)
        ).resolves.toEqual(expectedResponse)
      }
    })
  })
})
