import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'
import {
  CACHE_REQUEST_CONFIGS
} from '../cache-test-helpers'

describe('Cache Key Generation - Hash Algorithms', () => {
  let keyGenerator: CacheKeyGenerator

  beforeEach(() => {
    keyGenerator = new CacheKeyGenerator()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

    it('should handle xxhash algorithm', () => {
      const xxhashGenerator = new CacheKeyGenerator({ hashAlgorithm: 'xxhash' })
      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      const key1 = xxhashGenerator.generateCacheKey(config)
      const key2 = xxhashGenerator.generateCacheKey(config)

      expect(key1).toBe(key2)
      expect(key1).toBeTypeOf('string')
      expect(key1.length).toBeGreaterThan(0)
    })
  })

  describe('哈希算法对比', () => {
    it('should produce different results with different algorithms', () => {
      const algorithms = ['fnv1a', 'xxhash', 'simple'] as const
      const config = CACHE_REQUEST_CONFIGS.POST_USER
      const keys: string[] = []

      algorithms.forEach(algorithm => {
        const generator = new CacheKeyGenerator({ hashAlgorithm: algorithm })
        const key = generator.generateCacheKey(config)
        keys.push(key)
      })

      // 不同算法应该产生不同的键（大概率）
      expect(new Set(keys).size).toBe(algorithms.length)
    })
  })
})