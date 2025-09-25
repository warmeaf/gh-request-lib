import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'
import {
  CACHE_REQUEST_CONFIGS
} from '../cache-test-helpers'

describe('Cache Key Generation - Headers Handling', () => {
  let keyGenerator: CacheKeyGenerator

  beforeEach(() => {
    keyGenerator = new CacheKeyGenerator()
  })

  afterEach(() => {
    vi.restoreAllMocks()
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

    it('should handle headers with special characters', () => {
      const keyGenWithHeaders = new CacheKeyGenerator({
        includeHeaders: true,
        headersWhitelist: ['x-custom']
      })

      const config = {
        url: 'https://api.example.com/data',
        method: 'GET' as const,
        headers: {
          'x-custom': 'value with spaces & special chars: 中文'
        }
      }

      const key = keyGenWithHeaders.generateCacheKey(config)
      expect(key).toBeTypeOf('string')
      expect(key.length).toBeGreaterThan(0)
    })
  })
})