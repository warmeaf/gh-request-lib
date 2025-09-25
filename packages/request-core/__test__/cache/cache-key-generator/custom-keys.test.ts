import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'
import {
  CACHE_REQUEST_CONFIGS
} from '../cache-test-helpers'

describe('Cache Key Generation - Custom Keys', () => {
  let keyGenerator: CacheKeyGenerator

  beforeEach(() => {
    keyGenerator = new CacheKeyGenerator()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

  describe('自定义键验证', () => {
    it('should reject null custom keys', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      expect(() => {
        keyGenerator.generateCacheKey(config, null as any)
      }).toThrow('Custom cache key must be a non-empty string')
    })

    it('should treat undefined custom keys as no custom key provided', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      // undefined应该被视为没有提供自定义键，而不是错误
      const keyWithUndefined = keyGenerator.generateCacheKey(config, undefined)
      const keyWithoutCustom = keyGenerator.generateCacheKey(config)

      expect(keyWithUndefined).toBe(keyWithoutCustom)
    })

    it('should reject non-string custom keys', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_USERS

      const invalidKeys = [123, true, {}, [], Symbol('test')]

      invalidKeys.forEach(invalidKey => {
        expect(() => {
          keyGenerator.generateCacheKey(config, invalidKey as any)
        }).toThrow('Custom cache key must be a non-empty string')
      })
    })

    it('should handle custom keys with unsafe characters', () => {
      const config = CACHE_REQUEST_CONFIGS.GET_USERS
      const unsafeKey = 'key\x00with\x1funsafe\x7fchars'

      const key = keyGenerator.generateCacheKey(config, unsafeKey)
      expect(key).not.toContain('\x00')
      expect(key).not.toContain('\x1f')
      expect(key).not.toContain('\x7f')
      expect(key).toContain('_') // 不安全字符应该被替换为下划线
    })

    it('should hash long custom keys', () => {
      const keyGenWithLimit = new CacheKeyGenerator({ maxKeyLength: 20 })
      const config = CACHE_REQUEST_CONFIGS.GET_USERS
      const longCustomKey = 'a'.repeat(50)

      const key = keyGenWithLimit.generateCacheKey(config, longCustomKey)
      expect(key.length).toBeLessThanOrEqual(20)
      expect(key).not.toBe(longCustomKey) // 应该被哈希处理
    })
  })
})