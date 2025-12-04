import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'
import {
  CACHE_REQUEST_CONFIGS
} from '../cache-test-helpers'

describe('Cache Key Generation - Configuration Updates', () => {
  let keyGenerator: CacheKeyGenerator

  beforeEach(() => {
    keyGenerator = new CacheKeyGenerator()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

      // 清除缓存
      keyGenWithCache.clearCache()

      // 再次生成相同配置
      const key1 = keyGenWithCache.generateCacheKey(config)
      const key2 = keyGenWithCache.generateCacheKey(config)
      
      // 验证键生成正常工作
      expect(key1).toBe(key2)
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

      // 验证预热后键生成正常工作
      configs.forEach(config => {
        const key = keyGenWithCache.generateCacheKey(config)
        expect(key).toBeTypeOf('string')
      })
    })
  })

  describe('配置动态更新', () => {
    it('should handle config updates correctly', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS

      // 初始配置不包含headers
      const key1 = keyGenerator.generateCacheKey(config)

      // 更新配置包含headers
      keyGenerator.updateConfig({
        includeHeaders: true,
        headersWhitelist: ['authorization']
      })

      const key2 = keyGenerator.generateCacheKey(config)

      // 配置更新后应该产生不同的键
      expect(key1).not.toBe(key2)

      // 再次更新配置
      keyGenerator.updateConfig({
        includeHeaders: false
      })

      const key3 = keyGenerator.generateCacheKey(config)

      // 恢复到不包含headers，应该和最初的键相同
      expect(key3).toBe(key1)
    })

    it('should handle partial config updates', () => {
      const originalConfig = {
        includeHeaders: false,
        maxKeyLength: 512,
        enableHashCache: true,
        hashAlgorithm: 'fnv1a' as const
      }

      const generator = new CacheKeyGenerator(originalConfig)
      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      const key1 = generator.generateCacheKey(config)

      // 只更新部分配置
      generator.updateConfig({ maxKeyLength: 100 })

      const key2 = generator.generateCacheKey(config)

      // 其他配置应该保持不变
      expect(key1).toBe(key2) // 因为原始键长度小于100，所以应该相同
    })
  })

  describe('缓存预热功能', () => {
    it('should warmup cache with multiple configs', () => {
      const keyGenWithCache = new CacheKeyGenerator({
        enableHashCache: true
      })

      const configs = [
        CACHE_REQUEST_CONFIGS.POST_USER,
        CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS,
        {
          url: 'https://api.example.com/complex',
          method: 'POST' as const,
          data: { nested: { deep: { value: 'test' } } }
        }
      ]

      // 执行预热
      keyGenWithCache.warmupCache(configs)

      // 再次生成相同配置的键
      configs.forEach(config => {
        const key = keyGenWithCache.generateCacheKey(config)
        expect(key).toBeTypeOf('string')
      })
    })

    it('should handle empty warmup configs', () => {
      const keyGenWithCache = new CacheKeyGenerator({
        enableHashCache: true
      })

      // 空配置数组不应该崩溃
      expect(() => {
        keyGenWithCache.warmupCache([])
      }).not.toThrow()
    })
  })
})