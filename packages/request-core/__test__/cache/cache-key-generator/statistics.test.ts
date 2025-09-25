import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'
import {
  CACHE_REQUEST_CONFIGS
} from '../cache-test-helpers'

describe('Cache Key Generation - Statistics', () => {
  let keyGenerator: CacheKeyGenerator

  beforeEach(() => {
    keyGenerator = new CacheKeyGenerator()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  describe('统计信息详细测试', () => {
    it('should calculate hit rate correctly', () => {
      const keyGenWithCache = new CacheKeyGenerator({
        enableHashCache: true
      })

      const config = CACHE_REQUEST_CONFIGS.POST_USER

      // 第一次生成 - 缓存未命中
      keyGenWithCache.generateCacheKey(config)

      // 第二次生成 - 缓存命中
      keyGenWithCache.generateCacheKey(config)

      const stats = keyGenWithCache.getStats()
      expect(stats.totalGenerations).toBe(2)
      expect(stats.cacheHits).toBeGreaterThan(0)
      expect(parseFloat(stats.hitRate)).toBeGreaterThan(0)
      expect(parseFloat(stats.hitRate)).toBeLessThanOrEqual(100)
    })

    it('should track cache size accurately', () => {
      const keyGenWithCache = new CacheKeyGenerator({
        enableHashCache: true
      })

      const configs = Array.from({ length: 5 }, (_, i) => ({
        url: `https://api.example.com/item/${i}`,
        method: 'POST' as const,
        data: { id: i, complex: { nested: { value: `item-${i}` } } }
      }))

      configs.forEach(config => {
        keyGenWithCache.generateCacheKey(config)
      })

      const stats = keyGenWithCache.getStats()
      expect(stats.cacheSize).toBeGreaterThan(0)
      expect(stats.cacheSize).toBeLessThanOrEqual(configs.length)
    })

    it('should handle stats when cache is disabled', () => {
      const keyGenWithoutCache = new CacheKeyGenerator({
        enableHashCache: false
      })

      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      keyGenWithoutCache.generateCacheKey(config)
      keyGenWithoutCache.generateCacheKey(config)

      const stats = keyGenWithoutCache.getStats()
      expect(stats.cacheHits).toBe(0)
      expect(stats.cacheMisses).toBe(0)
      expect(stats.cacheSize).toBe(0)
      expect(stats.hitRate).toBe('0.00')
    })

    it('should track last cleanup time', () => {
      const keyGenWithCache = new CacheKeyGenerator({
        enableHashCache: true
      })

      // 生成足够多的键触发清理
      for (let i = 0; i < 1200; i++) {
        keyGenWithCache.generateCacheKey({
          url: `https://api.example.com/item/${i}`,
          method: 'GET' as const,
          data: { id: i }
        })
      }

      const stats = keyGenWithCache.getStats()
      expect(stats.lastCleanupTime).toBeGreaterThan(0)
    })

    it('should track timing statistics accurately', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      // 生成一些键
      keyGenerator.generateCacheKey(config)
      keyGenerator.generateCacheKey(config)

      const stats = keyGenerator.getStats()
      expect(stats.averageGenerationTime).toBeGreaterThanOrEqual(0)
      expect(stats.totalGenerations).toBe(2)
    })
  })
})