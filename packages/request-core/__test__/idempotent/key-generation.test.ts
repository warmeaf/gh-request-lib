import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateIdempotentKey, generateFallbackKey } from '../../src/features/idempotent/key'
import { RequestConfig } from '../../src/interface'
import { CacheKeyConfig } from '../../src/cache/cache-key-generator'

describe('Idempotent Key Generation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('generateIdempotentKey', () => {
    const mockInstanceKeyConfig: CacheKeyConfig = {
      includeHeaders: true,
      headersWhitelist: ['authorization', 'content-type'],
      hashAlgorithm: 'fnv1a'
    }

    it('should generate key with idempotent prefix', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'GET'
      }

      const key = generateIdempotentKey(config, mockInstanceKeyConfig)
      
      expect(key).toMatch(/^idempotent:/)
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan('idempotent:'.length)
    })

    it('should generate consistent keys for same config', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'GET',
        data: { name: 'John' }
      }

      const key1 = generateIdempotentKey(config, mockInstanceKeyConfig)
      const key2 = generateIdempotentKey(config, mockInstanceKeyConfig)
      
      expect(key1).toBe(key2)
    })

    it('should support config override', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'GET',
        data: { userId: 123 },
        headers: { 'authorization': 'Bearer token' }
      }

      const overrideConfig: CacheKeyConfig = {
        includeHeaders: false,
        hashAlgorithm: 'simple'
      }

      const key1 = generateIdempotentKey(config, mockInstanceKeyConfig)
      const key2 = generateIdempotentKey(config, mockInstanceKeyConfig, overrideConfig)
      
      // 由于配置不同，生成的键应该不同
      expect(key1).not.toBe(key2)
    })
  })

  describe('generateFallbackKey', () => {
    it('should generate key with fallback prefix', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'GET'
      }

      const key = generateFallbackKey(config)
      
      expect(key).toMatch(/^idempotent:fallback:/)
    })

    it('should generate consistent fallback keys', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'GET',
        data: { name: 'John' }
      }

      const key1 = generateFallbackKey(config)
      const key2 = generateFallbackKey(config)
      
      expect(key1).toBe(key2)
    })

    it('should handle circular reference data', () => {
      const data: any = { name: 'test' }
      // 创建循环引用
      data.circular = data
      
      const config: RequestConfig = {
        url: '/api/users',
        method: 'POST',
        data
      }

      const key = generateFallbackKey(config)
      
      // 即使有循环引用，也应该能生成fallback键
      expect(key).toMatch(/^idempotent:fallback:/)
      expect(typeof key).toBe('string')
    })

    it('should handle extreme error cases', () => {
      // 创建一个会导致所有操作都失败的配置
      const problematicConfig: any = {}
      
      // 让method getter抛出错误
      Object.defineProperty(problematicConfig, 'method', {
        get() { throw new Error('Method access error') }
      })
      
      // 让url getter抛出错误  
      Object.defineProperty(problematicConfig, 'url', {
        get() { throw new Error('URL access error') }
      })

      const key = generateFallbackKey(problematicConfig)
      
      // 即使在极端错误情况下，也应该生成emergency键
      expect(key).toMatch(/^idempotent:emergency:/)
      expect(typeof key).toBe('string')
    })

    it('should generate emergency keys with timestamp', () => {
      // 创建一个完全无法处理的配置
      const impossibleConfig = null as any

      const key = generateFallbackKey(impossibleConfig)
      
      expect(key).toMatch(/^idempotent:emergency:/)
      expect(key).toMatch(/_[a-z0-9]{6}$/) // 时间戳_随机字符
    })

    it('should generate different emergency keys', async () => {
      const problematicConfig: any = {}
      Object.defineProperty(problematicConfig, 'method', {
        get() { throw new Error('Error') }
      })

      // 由于包含时间戳和随机数，不同时间生成的emergency键应该不同
      const key1 = generateFallbackKey(problematicConfig)
      
      // 等待一小段时间确保时间戳不同
      await new Promise(resolve => setTimeout(resolve, 1))
      
      const key2 = generateFallbackKey(problematicConfig)
      
      expect(key1).not.toBe(key2)
      expect(key1).toMatch(/^idempotent:emergency:/)
      expect(key2).toMatch(/^idempotent:emergency:/)
    })
  })
})
