import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'

describe('Cache Key Generation - URL Handling', () => {
  let keyGenerator: CacheKeyGenerator

  beforeEach(() => {
    keyGenerator = new CacheKeyGenerator()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('URL处理边界情况', () => {
    it('should handle URLs with query parameters', () => {
      const config = {
        url: 'https://api.example.com/users?existing=param',
        method: 'GET' as const
      }

      const key = keyGenerator.generateCacheKey(config)
      expect(key).toBeTypeOf('string')
      expect(key.length).toBeGreaterThan(0)

      // URL中的查询参数应该被移除
      const configWithoutQuery = {
        url: 'https://api.example.com/users',
        method: 'GET' as const
      }

      const key2 = keyGenerator.generateCacheKey(configWithoutQuery)
      expect(key).toBe(key2)
    })

    it('should handle URLs with trailing slashes', () => {
      const config1 = {
        url: 'https://api.example.com/users/',
        method: 'GET' as const
      }

      const config2 = {
        url: 'https://api.example.com/users',
        method: 'GET' as const
      }

      const key1 = keyGenerator.generateCacheKey(config1)
      const key2 = keyGenerator.generateCacheKey(config2)

      // 尾部斜杠应该被标准化
      expect(key1).toBe(key2)
    })

    it('should throw error for invalid URLs', () => {
      const invalidConfigs = [
        { url: '', method: 'GET' as const },
        { url: null as any, method: 'GET' as const },
        { url: undefined as any, method: 'GET' as const },
        { url: 123 as any, method: 'GET' as const }
      ]

      invalidConfigs.forEach(config => {
        expect(() => {
          keyGenerator.generateCacheKey(config)
        }).toThrow('Invalid URL for cache key generation')
      })
    })
  })
})