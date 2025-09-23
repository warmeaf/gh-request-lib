import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { generateIdempotentKey, generateFallbackKey } from '../../src/features/idempotent/key'
import { RequestConfig } from '../../src/interface'
import { CacheKeyConfig } from '../../src/cache/cache-key-generator'

// 使用真实的 CacheKeyGenerator，因为我们主要测试的是 key generation 函数的逻辑

describe('IdempotentFeature Key Generation', () => {
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

    it('应该生成带有idempotent前缀的键', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'GET'
      }

      const key = generateIdempotentKey(config, mockInstanceKeyConfig)
      
      expect(key).toMatch(/^idempotent:/)
      expect(key).toContain('GET')
      expect(key).toContain('/api/users')
    })

    it('应该为相同配置生成相同的键', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'GET',
        data: { name: 'John' }
      }

      const key1 = generateIdempotentKey(config, mockInstanceKeyConfig)
      const key2 = generateIdempotentKey(config, mockInstanceKeyConfig)
      
      expect(key1).toBe(key2)
    })

    it('应该为不同配置生成不同的键', () => {
      const config1: RequestConfig = {
        url: '/api/users',
        method: 'GET'
      }

      const config2: RequestConfig = {
        url: '/api/users',
        method: 'POST'
      }

      const key1 = generateIdempotentKey(config1, mockInstanceKeyConfig)
      const key2 = generateIdempotentKey(config2, mockInstanceKeyConfig)
      
      expect(key1).not.toBe(key2)
    })

    it('应该支持override配置参数', () => {
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

    it('应该处理包含复杂数据的请求配置', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'POST',
        data: {
          user: { name: 'John', age: 30 },
          metadata: { timestamp: Date.now() },
          items: [1, 2, 3, 4, 5]
        },
        headers: {
          'Authorization': 'Bearer token123',
          'Content-Type': 'application/json'
        }
      }

      const key = generateIdempotentKey(config, mockInstanceKeyConfig)
      
      expect(key).toMatch(/^idempotent:/)
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    })

    it('应该处理包含特殊字符的URL', () => {
      const specialUrls = [
        '/api/测试',
        '/api/users?query=测试&other=value',
        '/api/users#fragment',
        '/api/users with spaces',
        '/api/users%20encoded'
      ]

      for (const url of specialUrls) {
        const config: RequestConfig = { url, method: 'GET' }
        const key = generateIdempotentKey(config, mockInstanceKeyConfig)
        
        expect(key).toMatch(/^idempotent:/)
        expect(typeof key).toBe('string')
        expect(key.length).toBeGreaterThan(0)
      }
    })

    it('应该处理不同的HTTP方法', () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'] as const
      const keys = new Set<string>()

      for (const method of methods) {
        const config: RequestConfig = {
          url: '/api/test',
          method
        }
        const key = generateIdempotentKey(config, mockInstanceKeyConfig)
        keys.add(key)
      }

      // 每个HTTP方法应该生成不同的键
      expect(keys.size).toBe(methods.length)
    })

    it('应该处理空数据和null数据', () => {
      const configs: RequestConfig[] = [
        { url: '/api/test', method: 'POST', data: null },
        { url: '/api/test', method: 'POST', data: undefined },
        { url: '/api/test', method: 'POST', data: {} },
        { url: '/api/test', method: 'POST', data: '' },
        { url: '/api/test', method: 'POST', data: 0 },
        { url: '/api/test', method: 'POST', data: false }
      ]

      for (const config of configs) {
        const key = generateIdempotentKey(config, mockInstanceKeyConfig)
        expect(key).toMatch(/^idempotent:/)
        expect(typeof key).toBe('string')
      }
    })

    it('应该处理头部信息', () => {
      const configWithHeaders: RequestConfig = {
        url: '/api/test',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token123',
          'Content-Type': 'application/json',
          'X-Custom-Header': 'custom-value'
        }
      }

      const configWithoutHeaders: RequestConfig = {
        url: '/api/test',
        method: 'GET'
      }

      const key1 = generateIdempotentKey(configWithHeaders, mockInstanceKeyConfig)
      const key2 = generateIdempotentKey(configWithoutHeaders, mockInstanceKeyConfig)
      
      // 由于配置不同（有无头部），生成的键可能不同
      expect(typeof key1).toBe('string')
      expect(typeof key2).toBe('string')
    })
  })

  describe('generateFallbackKey', () => {
    it('应该生成带有fallback前缀的键', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'GET'
      }

      const key = generateFallbackKey(config)
      
      expect(key).toMatch(/^idempotent:fallback:/)
    })

    it('应该为相同配置生成相同的fallback键', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'GET',
        data: { name: 'John' }
      }

      const key1 = generateFallbackKey(config)
      const key2 = generateFallbackKey(config)
      
      expect(key1).toBe(key2)
    })

    it('应该为不同配置生成不同的fallback键', () => {
      const config1: RequestConfig = {
        url: '/api/users',
        method: 'GET'
      }

      const config2: RequestConfig = {
        url: '/api/users',
        method: 'POST'
      }

      const key1 = generateFallbackKey(config1)
      const key2 = generateFallbackKey(config2)
      
      expect(key1).not.toBe(key2)
    })

    it('应该处理包含复杂数据的配置', () => {
      const config: RequestConfig = {
        url: '/api/users',
        method: 'POST',
        data: {
          nested: { deep: { value: 'test' } },
          array: [1, 2, { item: 'value' }],
          special: 'special chars: !@#$%^&*()'
        }
      }

      const key = generateFallbackKey(config)
      
      expect(key).toMatch(/^idempotent:fallback:/)
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
    })

    it('应该处理循环引用数据', () => {
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

    it('应该处理undefined和null值', () => {
      const configs = [
        { url: '/api/test', method: 'GET' as const },
        { url: '/api/test', method: 'POST' as const, data: null },
        { url: '/api/test', method: 'POST' as const, data: undefined },
        { url: undefined as any, method: 'GET' as const },
        { url: '', method: 'GET' as const },
        { method: 'GET' as const } as any // 缺少url
      ]

      for (const config of configs) {
        const key = generateFallbackKey(config)
        expect(key).toMatch(/^idempotent:/)
        expect(typeof key).toBe('string')
        expect(key.length).toBeGreaterThan(0)
      }
    })

    it('应该处理极端错误情况', () => {
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

    it('应该在emergency情况下生成包含时间戳的键', () => {
      // 创建一个完全无法处理的配置
      const impossibleConfig = null as any

      const key = generateFallbackKey(impossibleConfig)
      
      expect(key).toMatch(/^idempotent:emergency:/)
      expect(key).toMatch(/_[a-z0-9]{6}$/) // 时间戳_随机字符
    })

    it('应该为不同的emergency情况生成不同的键', async () => {
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

    it('应该处理包含Unicode字符的数据', () => {
      const config: RequestConfig = {
        url: '/api/测试',
        method: 'POST',
        data: {
          chinese: '中文测试',
          emoji: '🚀🔥💯',
          russian: 'Тест на русском',
          arabic: 'العربية',
          japanese: '日本語テスト'
        }
      }

      const key = generateFallbackKey(config)
      
      expect(key).toMatch(/^idempotent:fallback:/)
      expect(typeof key).toBe('string')
      expect(key.length).toBeGreaterThan(0)
      
      // 相同配置应该生成相同键
      const key2 = generateFallbackKey(config)
      expect(key).toBe(key2)
    })

    it('应该处理非常长的数据', () => {
      const longString = 'x'.repeat(100000) // 100KB字符串
      const config: RequestConfig = {
        url: '/api/large-data',
        method: 'POST',
        data: { content: longString }
      }

      const key = generateFallbackKey(config)
      
      expect(key).toMatch(/^idempotent:fallback:/)
      expect(typeof key).toBe('string')
      
      // fallback键的长度应该是合理的（不会因为数据太大而过长）
      expect(key.length).toBeLessThan(1000)
    })
  })

  describe('键生成一致性测试', () => {
    it('应该保证相同输入的一致性', () => {
      const config: RequestConfig = {
        url: '/api/consistent-test',
        method: 'POST',
        data: { value: 42, nested: { item: 'test' } }
      }

      const mockKeyConfig: CacheKeyConfig = {
        includeHeaders: true,
        hashAlgorithm: 'fnv1a'
      }

      // 生成多次应该得到相同结果
      const keys = Array.from({ length: 10 }, () => 
        generateIdempotentKey(config, mockKeyConfig)
      )

      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(1)
    })

    it('应该保证fallback键的一致性', () => {
      const config: RequestConfig = {
        url: '/api/fallback-test',
        method: 'POST',
        data: { test: 'value' }
      }

      // 生成多次应该得到相同结果
      const keys = Array.from({ length: 10 }, () => 
        generateFallbackKey(config)
      )

      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(1)
    })
  })
})
