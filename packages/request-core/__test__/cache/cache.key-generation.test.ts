import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../src/cache/cache-key-generator'
import { RequestConfig } from '../../src/interface'
import {
  CACHE_REQUEST_CONFIGS,
  CACHE_TEST_DATA
} from './cache-test-helpers'

describe('Cache Key Generation Tests', () => {
  let keyGenerator: CacheKeyGenerator

  beforeEach(() => {
    keyGenerator = new CacheKeyGenerator()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('基本键生成功能', () => {
    it('should generate consistent keys for same request config', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      const key1 = keyGenerator.generateCacheKey(config)
      const key2 = keyGenerator.generateCacheKey(config)

      expect(key1).toBe(key2)
      expect(key1).toBeTypeOf('string')
      expect(key1.length).toBeGreaterThan(0)
    })

    it('should generate different keys for different URLs', () => {
      const config1 = CACHE_REQUEST_CONFIGS.GET_USERS
      const config2 = CACHE_REQUEST_CONFIGS.GET_USER_BY_ID

      const key1 = keyGenerator.generateCacheKey(config1)
      const key2 = keyGenerator.generateCacheKey(config2)

      expect(key1).not.toBe(key2)
    })

    it('should generate different keys for different HTTP methods', () => {
      const getConfig = CACHE_REQUEST_CONFIGS.GET_USERS
      const postConfig = CACHE_REQUEST_CONFIGS.POST_USER

      const getKey = keyGenerator.generateCacheKey(getConfig)
      const postKey = keyGenerator.generateCacheKey(postConfig)

      expect(getKey).not.toBe(postKey)
    })

    it('should generate different keys for requests with different data', () => {
      const config1 = {
        url: 'https://api.example.com/users',
        method: 'POST' as const,
        data: { name: 'John', age: 25 }
      }

      const config2 = {
        url: 'https://api.example.com/users',
        method: 'POST' as const,
        data: { name: 'Jane', age: 30 }
      }

      const key1 = keyGenerator.generateCacheKey(config1)
      const key2 = keyGenerator.generateCacheKey(config2)

      expect(key1).not.toBe(key2)
    })

    it('should handle requests with query parameters', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_WITH_PARAMS

      const key = keyGenerator.generateCacheKey(config)

      expect(key).toBeTypeOf('string')
      expect(key.length).toBeGreaterThan(0)

      // 相同参数应该生成相同的键
      const key2 = keyGenerator.generateCacheKey(config)
      expect(key).toBe(key2)
    })
  })

  describe('自定义键支持', () => {
    it('should use custom key when provided', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_USERS
      const customKey = 'my-custom-cache-key'

      const key = keyGenerator.generateCacheKey(config, customKey)

      expect(key).toBe(customKey)
    })

    it('should ignore request config when custom key is provided', () => {
      const config1 = CACHE_REQUEST_CONFIGS.GET_USERS
      const config2 = CACHE_REQUEST_CONFIGS.GET_USER_BY_ID
      const customKey = 'same-custom-key'

      const key1 = keyGenerator.generateCacheKey(config1, customKey)
      const key2 = keyGenerator.generateCacheKey(config2, customKey)

      expect(key1).toBe(customKey)
      expect(key2).toBe(customKey)
      expect(key1).toBe(key2)
    })

    it('should reject empty custom keys', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      expect(() => {
        keyGenerator.generateCacheKey(config, '')
      }).toThrow('Custom cache key must be a non-empty string')
    })
  })

  describe('请求头处理', () => {
    it('should ignore headers by default', () => {
      const configWithHeaders = CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS
      const configWithoutHeaders = {
        ...configWithHeaders,
        headers: undefined
      }

      const key1 = keyGenerator.generateCacheKey(configWithHeaders)
      const key2 = keyGenerator.generateCacheKey(configWithoutHeaders)

      expect(key1).toBe(key2)
    })

    it('should include headers when configured', () => {
      const keyGenWithHeaders = new CacheKeyGenerator({
        includeHeaders: true,
        headersWhitelist: ['authorization', 'content-type']
      })

      const configWithHeaders = CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS
      const configWithoutHeaders = {
        ...configWithHeaders,
        headers: undefined
      }

      const key1 = keyGenWithHeaders.generateCacheKey(configWithHeaders)
      const key2 = keyGenWithHeaders.generateCacheKey(configWithoutHeaders)

      expect(key1).not.toBe(key2)
    })

    it('should only include whitelisted headers', () => {
      const keyGenWithHeaders = new CacheKeyGenerator({
        includeHeaders: true,
        headersWhitelist: ['authorization'] // 只包含authorization
      })

      const config1 = {
        ...CACHE_REQUEST_CONFIGS.GET_USERS,
        headers: {
          'authorization': 'Bearer token123',
          'x-custom-header': 'custom-value'
        }
      }

      const config2 = {
        ...CACHE_REQUEST_CONFIGS.GET_USERS,
        headers: {
          'authorization': 'Bearer token123',
          'x-custom-header': 'different-value' // 不同的非白名单header
        }
      }

      const key1 = keyGenWithHeaders.generateCacheKey(config1)
      const key2 = keyGenWithHeaders.generateCacheKey(config2)

      // 由于只考虑authorization header，键应该相同
      expect(key1).toBe(key2)
    })

    it('should generate different keys for different whitelisted headers', () => {
      const keyGenWithHeaders = new CacheKeyGenerator({
        includeHeaders: true,
        headersWhitelist: ['authorization']
      })

      const config1 = {
        ...CACHE_REQUEST_CONFIGS.GET_USERS,
        headers: { authorization: 'Bearer token123' }
      }

      const config2 = {
        ...CACHE_REQUEST_CONFIGS.GET_USERS,
        headers: { authorization: 'Bearer token456' }
      }

      const key1 = keyGenWithHeaders.generateCacheKey(config1)
      const key2 = keyGenWithHeaders.generateCacheKey(config2)

      expect(key1).not.toBe(key2)
    })
  })

  describe('键长度限制', () => {
    it('should respect maximum key length', () => {
      const keyGenWithLimit = new CacheKeyGenerator({
        maxKeyLength: 50
      })

      // 创建会产生长键的配置
      const longConfig = {
        url: 'https://api.example.com/users/very/long/path/with/many/segments',
        method: 'POST' as const,
        data: {
          veryLongPropertyName: 'very long property value',
          anotherLongProperty: 'another very long value'
        }
      }

      const key = keyGenWithLimit.generateCacheKey(longConfig)

      expect(key.length).toBeLessThanOrEqual(50)
    })

    it('should handle very small key length limits', () => {
      const keyGenWithSmallLimit = new CacheKeyGenerator({
        maxKeyLength: 10
      })

      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      const key = keyGenWithSmallLimit.generateCacheKey(config)

      expect(key.length).toBeLessThanOrEqual(10)
      expect(key.length).toBeGreaterThan(0) // 仍应该有值
    })

    it('should not truncate keys when limit is large enough', () => {
      const keyGenWithLargeLimit = new CacheKeyGenerator({
        maxKeyLength: 1000
      })

      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      const key = keyGenWithLargeLimit.generateCacheKey(config)
      const unlimitedKey = keyGenerator.generateCacheKey(config)

      // 如果限制足够大，应该产生相同的键
      expect(key).toBe(unlimitedKey)
    })
  })

  describe('哈希算法配置', () => {
    it('should support different hash algorithms', () => {
      const fnvGenerator = new CacheKeyGenerator({ hashAlgorithm: 'fnv1a' })
      const simpleGenerator = new CacheKeyGenerator({ hashAlgorithm: 'simple' })

      // 使用包含数据的配置，确保哈希算法被调用
      const config = CACHE_REQUEST_CONFIGS.POST_USER

      const fnvKey = fnvGenerator.generateCacheKey(config)
      const simpleKey = simpleGenerator.generateCacheKey(config)

      expect(fnvKey).toBeTypeOf('string')
      expect(simpleKey).toBeTypeOf('string')
      // 不同算法应该产生不同的键（大概率）
      expect(fnvKey).not.toBe(simpleKey)
    })

    it('should maintain consistency within same algorithm', () => {
      const algorithms = ['fnv1a', 'simple'] as const

      for (const algorithm of algorithms) {
        const generator = new CacheKeyGenerator({ hashAlgorithm: algorithm })
        const config = CACHE_REQUEST_CONFIGS.GET_USERS

        const key1 = generator.generateCacheKey(config)
        const key2 = generator.generateCacheKey(config)

        expect(key1).toBe(key2)
      }
    })
  })

  describe('哈希缓存机制', () => {
    it('should use hash cache when enabled', () => {
      const keyGenWithCache = new CacheKeyGenerator({
        enableHashCache: true
      })

      // 使用包含复杂数据的配置，确保会调用hashObjectStructure
      const config = CACHE_REQUEST_CONFIGS.POST_USER

      // 第一次生成
      const key1 = keyGenWithCache.generateCacheKey(config)
      
      // 获取统计信息
      const stats1 = keyGenWithCache.getStats()
      const initialCacheHits = stats1.cacheHits

      // 第二次生成相同配置
      const key2 = keyGenWithCache.generateCacheKey(config)
      
      const stats2 = keyGenWithCache.getStats()

      expect(key1).toBe(key2)
      // 缓存命中应该增加
      expect(stats2.cacheHits).toBeGreaterThan(initialCacheHits)
    })

    it('should not use hash cache when disabled', () => {
      const keyGenWithoutCache = new CacheKeyGenerator({
        enableHashCache: false
      })

      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      keyGenWithoutCache.generateCacheKey(config)
      keyGenWithoutCache.generateCacheKey(config)
      
      const stats = keyGenWithoutCache.getStats()

      expect(stats.cacheHits).toBe(0) // 应该没有缓存命中
    })

    it('should handle cache overflow gracefully', () => {
      const keyGenWithSmallCache = new CacheKeyGenerator({
        enableHashCache: true
      })

      // 生成大量不同的键以填满缓存
      for (let i = 0; i < 1200; i++) { // 超过默认缓存大小1000
        keyGenWithSmallCache.generateCacheKey({
          url: `https://api.example.com/users/${i}`,
          method: 'GET' as const
        })
      }

      // 应该仍然正常工作，不崩溃
      const key = keyGenWithSmallCache.generateCacheKey(CACHE_REQUEST_CONFIGS.GET_USERS)
      expect(key).toBeTypeOf('string')
    })
  })

  describe('统计信息收集', () => {
    it('should track key generation statistics', () => {
      const initialStats = keyGenerator.getStats()
      expect(initialStats.totalGenerations).toBe(0)

      // 生成一些键
      keyGenerator.generateCacheKey(CACHE_REQUEST_CONFIGS.GET_USERS)
      keyGenerator.generateCacheKey(CACHE_REQUEST_CONFIGS.GET_USER_BY_ID)

      const updatedStats = keyGenerator.getStats()
      expect(updatedStats.totalGenerations).toBe(2)
    })

    it('should track cache hit/miss ratios', () => {
      const keyGenWithCache = new CacheKeyGenerator({
        enableHashCache: true
      })

      // 使用包含复杂数据的配置，确保会调用hashObjectStructure
      const config = CACHE_REQUEST_CONFIGS.POST_USER

      // 第一次生成 - 应该是缓存未命中
      keyGenWithCache.generateCacheKey(config)
      
      let stats = keyGenWithCache.getStats()
      expect(stats.cacheMisses).toBeGreaterThan(0)
      
      // 第二次生成相同配置 - 应该是缓存命中
      keyGenWithCache.generateCacheKey(config)
      
      stats = keyGenWithCache.getStats()
      expect(stats.cacheHits).toBeGreaterThan(0)
    })

    it('should track generation timing', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      keyGenerator.generateCacheKey(config)

      const stats = keyGenerator.getStats()
      expect(stats.averageGenerationTime).toBeGreaterThanOrEqual(0)
    })

    it('should allow resetting statistics', () => {
      // 生成一些统计数据
      keyGenerator.generateCacheKey(CACHE_REQUEST_CONFIGS.GET_USERS)
      keyGenerator.generateCacheKey(CACHE_REQUEST_CONFIGS.GET_USER_BY_ID)

      let stats = keyGenerator.getStats()
      expect(stats.totalGenerations).toBeGreaterThan(0)

      // 重置统计
      keyGenerator.resetStats()

      stats = keyGenerator.getStats()
      expect(stats.totalGenerations).toBe(0)
      expect(stats.cacheHits).toBe(0)
      expect(stats.cacheMisses).toBe(0)
      expect(stats.averageGenerationTime).toBe(0)
    })
  })

  describe('配置更新和缓存管理', () => {
    it('should allow updating configuration', () => {
      // 初始配置不包含header
      const initialConfig = CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS
      const key1 = keyGenerator.generateCacheKey(initialConfig)

      // 更新配置以包含header
      keyGenerator.updateConfig({
        includeHeaders: true,
        headersWhitelist: ['authorization']
      })

      const key2 = keyGenerator.generateCacheKey(initialConfig)

      // 由于配置变化，键应该不同
      expect(key1).not.toBe(key2)
    })

    it('should support clearing hash cache', () => {
      const keyGenWithCache = new CacheKeyGenerator({
        enableHashCache: true
      })

      const config = CACHE_REQUEST_CONFIGS.POST_USER

      // 生成键并建立缓存
      keyGenWithCache.generateCacheKey(config)
      keyGenWithCache.generateCacheKey(config) // 这应该命中缓存

      let stats = keyGenWithCache.getStats()
      expect(stats.cacheHits).toBeGreaterThan(0)

      // 清除缓存
      keyGenWithCache.clearCache()

      // 重置统计以验证缓存被清除
      keyGenWithCache.resetStats()

      // 再次生成相同配置，应该是缓存未命中
      keyGenWithCache.generateCacheKey(config)
      keyGenWithCache.generateCacheKey(config)

      stats = keyGenWithCache.getStats()
      // 由于缓存被清除，应该有新的未命中
      expect(stats.cacheMisses).toBeGreaterThan(0)
    })

    it('should support cache warmup', () => {
      const keyGenWithCache = new CacheKeyGenerator({
        enableHashCache: true
      })

      // 使用包含复杂数据的配置，确保会调用hashObjectStructure
      const configs = [
        CACHE_REQUEST_CONFIGS.POST_USER,
        CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS,
        {
          url: 'https://api.example.com/complex',
          method: 'POST' as const,
          data: { user: { id: 1, name: 'John' }, metadata: { version: '1.0' } }
        }
      ]

      // 执行预热
      keyGenWithCache.warmupCache(configs)

      // 验证预热后的缓存命中
      keyGenWithCache.resetStats() // 重置统计以便测量

      configs.forEach(config => {
        keyGenWithCache.generateCacheKey(config)
      })

      const stats = keyGenWithCache.getStats()
      // 预热后应该有缓存命中
      expect(stats.cacheHits).toBeGreaterThan(0)
    })
  })

  describe('复杂数据结构处理', () => {
    it.skip('should handle nested objects in request data', () => {
      const config1 = {
        url: 'https://api.example.com/users',
        method: 'POST' as const,
        data: CACHE_TEST_DATA.NESTED_OBJECT
      }

      const config2 = {
        url: 'https://api.example.com/users',
        method: 'POST' as const,
        data: {
          ...CACHE_TEST_DATA.NESTED_OBJECT,
          user: {
            ...CACHE_TEST_DATA.NESTED_OBJECT.user,
            profile: {
              ...CACHE_TEST_DATA.NESTED_OBJECT.user.profile,
              name: 'Different Name' // 改变嵌套值
            }
          }
        }
      }

      const key1 = keyGenerator.generateCacheKey(config1)
      const key2 = keyGenerator.generateCacheKey(config2)

      expect(key1).not.toBe(key2) // 应该检测到嵌套变化
    })

    it('should handle arrays in request data', () => {
      const config1 = {
        url: 'https://api.example.com/users',
        method: 'POST' as const,
        data: { items: [1, 2, 3] }
      }

      const config2 = {
        url: 'https://api.example.com/users',
        method: 'POST' as const,
        data: { items: [1, 2, 4] } // 不同的数组
      }

      const key1 = keyGenerator.generateCacheKey(config1)
      const key2 = keyGenerator.generateCacheKey(config2)

      expect(key1).not.toBe(key2)
    })

    it('should handle null and undefined values consistently', () => {
      const config1 = {
        url: 'https://api.example.com/users',
        method: 'POST' as const,
        data: { value: null }
      }

      const config2 = {
        url: 'https://api.example.com/users',
        method: 'POST' as const,
        data: { value: undefined }
      }

      const config3 = {
        url: 'https://api.example.com/users',
        method: 'POST' as const,
        data: {} // 没有value属性
      }

      const key1 = keyGenerator.generateCacheKey(config1)
      const key2 = keyGenerator.generateCacheKey(config2)
      const key3 = keyGenerator.generateCacheKey(config3)

      // null和undefined应该产生不同的键
      expect(key1).not.toBe(key2)
      expect(key2).not.toBe(key3)
    })

    it('should handle special JavaScript values', () => {
      const configWithSpecialValues = {
        url: 'https://api.example.com/users',
        method: 'POST' as const,
        data: {
          date: new Date('2024-01-01'),
          regex: /test/gi,
          boolean: true,
          number: 42,
          string: 'test',
          bigint: BigInt(123)
        }
      }

      // 应该能处理特殊值而不崩溃
      const key = keyGenerator.generateCacheKey(configWithSpecialValues)
      expect(key).toBeTypeOf('string')
      expect(key.length).toBeGreaterThan(0)

      // 生成相同配置应该产生相同键
      const key2 = keyGenerator.generateCacheKey(configWithSpecialValues)
      expect(key).toBe(key2)
    })
  })
})
