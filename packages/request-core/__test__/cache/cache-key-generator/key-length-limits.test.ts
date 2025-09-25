import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'
import {
  CACHE_REQUEST_CONFIGS
} from '../cache-test-helpers'

describe('Cache Key Generation - Key Length Limits', () => {
  let keyGenerator: CacheKeyGenerator

  beforeEach(() => {
    keyGenerator = new CacheKeyGenerator()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

    it('should handle extremely long URLs', () => {
      const longUrl = 'https://api.example.com/' + 'a'.repeat(1000)
      const config = {
        url: longUrl,
        method: 'GET' as const
      }

      const keyGenWithLimit = new CacheKeyGenerator({ maxKeyLength: 100 })
      const key = keyGenWithLimit.generateCacheKey(config)

      expect(key.length).toBeLessThanOrEqual(100)
      expect(key).toBeTypeOf('string')
    })

    it('should handle very small key length limits', () => {
      const keyGenWithTinyLimit = new CacheKeyGenerator({ maxKeyLength: 5 })
      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      const key = keyGenWithTinyLimit.generateCacheKey(config)
      expect(key.length).toBeLessThanOrEqual(5)
      expect(key.length).toBeGreaterThan(0)
    })
  })
})