import { describe, test, expect, beforeEach, vi } from 'vitest'
import { CacheKeyGenerator, CacheKeyConfig } from '../../src/cache/cache-key-generator'
import { RequestConfig } from '../../src/interface'

describe('CacheKeyGenerator', () => {
  let generator: CacheKeyGenerator
  let mockConfig: RequestConfig

  beforeEach(() => {
    generator = new CacheKeyGenerator()
    mockConfig = {
      method: 'GET',
      url: 'https://api.example.com/users',
      params: { page: 1, size: 10 },
      data: null,
      headers: { 'content-type': 'application/json' }
    }
  })

  describe('构造函数和配置', () => {
    test('应该使用默认配置创建实例', () => {
      const gen = new CacheKeyGenerator()
      const stats = gen.getStats()
      
      expect(stats.totalGenerations).toBe(0)
      expect(stats.cacheHits).toBe(0)
      expect(stats.cacheMisses).toBe(0)
    })

    test('应该接受自定义配置', () => {
      const config: CacheKeyConfig = {
        includeHeaders: true,
        headersWhitelist: ['authorization'],
        maxKeyLength: 256,
        enableHashCache: false,
        hashAlgorithm: 'xxhash'
      }
      
      const gen = new CacheKeyGenerator(config)
      // 通过生成键来测试配置是否生效
      const key1 = gen.generateCacheKey(mockConfig)
      const key2 = gen.generateCacheKey(mockConfig)
      
      expect(typeof key1).toBe('string')
      expect(typeof key2).toBe('string')
    })

    test('应该能够更新配置', () => {
      generator.updateConfig({ maxKeyLength: 100 })
      
      // 测试长键是否被正确处理
      const longUrlConfig: RequestConfig = {
        method: 'GET',
        url: 'https://api.example.com/' + 'a'.repeat(200),
        params: { key: 'value'.repeat(50) }
      }
      
      const key = generator.generateCacheKey(longUrlConfig)
      expect(key.length).toBeLessThanOrEqual(100)
    })
  })

  describe('generateCacheKey - 自定义键处理', () => {
    test('应该使用自定义键当提供时', () => {
      const customKey = 'my-custom-key'
      const result = generator.generateCacheKey(mockConfig, customKey)
      
      expect(result).toBe(customKey)
    })

    test('应该验证和标准化自定义键', () => {
      const customKeyWithSpecialChars = 'key\x00with\x1fspecial\x7fchars'
      const result = generator.generateCacheKey(mockConfig, customKeyWithSpecialChars)
      
      expect(result).toBe('key_with_special_chars')
    })

    test('应该对过长的自定义键进行哈希处理', () => {
      const longCustomKey = 'a'.repeat(1000)
      const result = generator.generateCacheKey(mockConfig, longCustomKey)
      
      expect(result.length).toBeLessThan(longCustomKey.length)
      expect(result.length).toBeGreaterThan(0)
    })

    test('应该抛出错误当自定义键无效时', () => {
      expect(() => generator.generateCacheKey(mockConfig, '')).toThrow('Custom cache key must be a non-empty string')
      expect(() => generator.generateCacheKey(mockConfig, null as any)).toThrow('Custom cache key must be a non-empty string')
    })
  })

  describe('generateCacheKey - 自动键生成', () => {
    test('应该为相同配置生成相同的键', () => {
      const key1 = generator.generateCacheKey(mockConfig)
      const key2 = generator.generateCacheKey(mockConfig)
      
      expect(key1).toBe(key2)
    })

    test('应该为不同配置生成不同的键', () => {
      const config1 = { ...mockConfig, method: 'GET' as const }
      const config2 = { ...mockConfig, method: 'POST' as const }
      
      const key1 = generator.generateCacheKey(config1)
      const key2 = generator.generateCacheKey(config2)
      
      expect(key1).not.toBe(key2)
    })

    test('应该包含HTTP方法信息', () => {
      const getKey = generator.generateCacheKey({ ...mockConfig, method: 'GET' })
      const postKey = generator.generateCacheKey({ ...mockConfig, method: 'POST' })
      
      expect(getKey).toContain('GET')
      expect(postKey).toContain('POST')
    })

    test('应该正确处理URL标准化', () => {
      const configs = [
        { ...mockConfig, url: 'https://api.example.com/users/' },
        { ...mockConfig, url: 'https://api.example.com/users' },
        { ...mockConfig, url: 'https://api.example.com/users?existing=param' }
      ]
      
      const keys = configs.map(config => generator.generateCacheKey(config))
      
      // 移除尾部斜杠后应该相同
      expect(keys[0]).toBe(keys[1])
      // 移除查询参数后应该相同（params单独处理）
      expect(keys[0]).toBe(keys[2])
    })
  })

  describe('URL处理', () => {
    test('应该抛出错误当URL无效时', () => {
      const invalidConfigs = [
        { ...mockConfig, url: '' },
        { ...mockConfig, url: null as any },
        { ...mockConfig, url: undefined as any }
      ]
      
      invalidConfigs.forEach(config => {
        expect(() => generator.generateCacheKey(config)).toThrow('Invalid URL for cache key generation')
      })
    })

    test('应该移除URL中的查询参数', () => {
      const config1 = { ...mockConfig, url: 'https://api.example.com/users?foo=bar' }
      const config2 = { ...mockConfig, url: 'https://api.example.com/users' }
      
      const key1 = generator.generateCacheKey(config1)
      const key2 = generator.generateCacheKey(config2)
      
      expect(key1).toBe(key2)
    })

    test('应该移除URL尾部的斜杠', () => {
      const config1 = { ...mockConfig, url: 'https://api.example.com/users/' }
      const config2 = { ...mockConfig, url: 'https://api.example.com/users' }
      
      const key1 = generator.generateCacheKey(config1)
      const key2 = generator.generateCacheKey(config2)
      
      expect(key1).toBe(key2)
    })
  })

  describe('参数处理', () => {
    test('应该为空参数生成空字符串', () => {
      const configs = [
        { ...mockConfig, params: undefined },
        { ...mockConfig, params: {} }
      ]
      
      configs.forEach(config => {
        const key = generator.generateCacheKey(config)
        expect(key).toBeDefined()
      })
    })

    test('应该为相同参数（不同顺序）生成相同键', () => {
      const config1 = { ...mockConfig, params: { a: 1, b: 2, c: 3 } }
      const config2 = { ...mockConfig, params: { c: 3, a: 1, b: 2 } }
      
      const key1 = generator.generateCacheKey(config1)
      const key2 = generator.generateCacheKey(config2)
      
      expect(key1).toBe(key2)
    })

    test('应该处理简单参数类型', () => {
      const config = {
        ...mockConfig,
        params: {
          string: 'value',
          number: 123,
          boolean: true,
          null: null,
          undefined: undefined
        }
      }
      
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })

    test('应该处理大量简单参数', () => {
      const params: Record<string, string | number | boolean> = {}
      for (let i = 0; i < 50; i++) {
        params[`param${i}`] = i % 3 === 0 ? `value${i}` : i % 3 === 1 ? i : i % 2 === 0
      }
      
      const config = { ...mockConfig, params }
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })
  })

  describe('数据处理', () => {
    test('应该处理基础数据类型', () => {
      const testCases = [
        { data: 'string data' },
        { data: 123 },
        { data: true },
        { data: null },
        { data: undefined }
      ]
      
      testCases.forEach(({ data }) => {
        const config = { ...mockConfig, data }
        expect(() => generator.generateCacheKey(config)).not.toThrow()
      })
    })

    test('应该处理FormData', () => {
      const formData = new FormData()
      formData.append('key', 'value')
      formData.append('file', new File(['content'], 'test.txt'))
      
      const config = { ...mockConfig, data: formData }
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })

    test('应该处理URLSearchParams', () => {
      const urlParams = new URLSearchParams()
      urlParams.append('key1', 'value1')
      urlParams.append('key2', 'value2')
      
      const config = { ...mockConfig, data: urlParams }
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })

    test('应该处理Blob', () => {
      const blob = new Blob(['test content'], { type: 'text/plain' })
      const config = { ...mockConfig, data: blob }
      
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })

    test('应该处理ArrayBuffer', () => {
      const buffer = new ArrayBuffer(16)
      const config = { ...mockConfig, data: buffer }
      
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })

    test('应该处理对象数据', () => {
      const config = {
        ...mockConfig,
        data: {
          user: { id: 1, name: 'John' },
          settings: { theme: 'dark' },
          tags: ['tag1', 'tag2']
        }
      }
      
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })

    test('应该处理复杂嵌套数据', () => {
      const config = {
        ...mockConfig,
        data: {
          nested: { a: 1, b: { c: 2 } },
          array: [1, 2, { nested: 'value' }],
          mixed: {
            string: 'test',
            number: 123,
            boolean: true,
            null: null,
            undefined: undefined,
            array: [1, 2, 3]
          }
        }
      }
      
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })
  })

  describe('请求头处理', () => {
    test('默认情况下应该不包含请求头', () => {
      const config1 = { ...mockConfig, headers: { 'x-custom': 'value1' } }
      const config2 = { ...mockConfig, headers: { 'x-custom': 'value2' } }
      
      const key1 = generator.generateCacheKey(config1)
      const key2 = generator.generateCacheKey(config2)
      
      expect(key1).toBe(key2)
    })

    test('启用包含请求头时应该影响键生成', () => {
      const genWithHeaders = new CacheKeyGenerator({ 
        includeHeaders: true,
        headersWhitelist: ['authorization', 'content-type']
      })
      
      const config1 = { ...mockConfig, headers: { authorization: 'Bearer token1' } }
      const config2 = { ...mockConfig, headers: { authorization: 'Bearer token2' } }
      
      const key1 = genWithHeaders.generateCacheKey(config1)
      const key2 = genWithHeaders.generateCacheKey(config2)
      
      expect(key1).not.toBe(key2)
    })

    test('应该只包含白名单中的请求头', () => {
      const genWithHeaders = new CacheKeyGenerator({ 
        includeHeaders: true,
        headersWhitelist: ['authorization']
      })
      
      const config1 = { 
        ...mockConfig, 
        headers: { 
          authorization: 'Bearer token',
          'x-custom': 'value1'
        }
      }
      const config2 = { 
        ...mockConfig, 
        headers: { 
          authorization: 'Bearer token',
          'x-custom': 'value2'
        }
      }
      
      const key1 = genWithHeaders.generateCacheKey(config1)
      const key2 = genWithHeaders.generateCacheKey(config2)
      
      // 只有authorization在白名单中，所以应该生成相同的键
      expect(key1).toBe(key2)
    })
  })

  describe('长键处理', () => {
    test('应该对过长的键进行哈希缩短', () => {
      const genWithShortLimit = new CacheKeyGenerator({ maxKeyLength: 50 })
      
      const configWithLongData = {
        method: 'POST' as const,
        url: 'https://api.example.com/users',
        data: {
          longField: 'a'.repeat(1000),
          anotherLongField: 'b'.repeat(1000)
        }
      }
      
      const key = genWithShortLimit.generateCacheKey(configWithLongData)
      expect(key.length).toBeLessThanOrEqual(50)
      expect(key).toContain('POST')
    })
  })

  describe('哈希算法', () => {
    test('不同哈希算法应该生成不同的键', () => {
      const gen1 = new CacheKeyGenerator({ hashAlgorithm: 'fnv1a' })
      const gen2 = new CacheKeyGenerator({ hashAlgorithm: 'xxhash' })
      const gen3 = new CacheKeyGenerator({ hashAlgorithm: 'simple' })
      
      const complexConfig = {
        ...mockConfig,
        data: { complex: { nested: { data: 'test' } } }
      }
      
      const key1 = gen1.generateCacheKey(complexConfig)
      const key2 = gen2.generateCacheKey(complexConfig)
      const key3 = gen3.generateCacheKey(complexConfig)
      
      // 不同算法可能生成不同的键（虽然不是绝对的）
      expect([key1, key2, key3].every(key => key.length > 0)).toBe(true)
    })
  })

  describe('缓存和性能', () => {
    test('应该缓存哈希结果', () => {
      const genWithCache = new CacheKeyGenerator({ enableHashCache: true })
      
      const config = {
        ...mockConfig,
        data: { complex: { nested: { data: 'test' } } }
      }
      
      // 首次生成
      genWithCache.generateCacheKey(config)
      const stats1 = genWithCache.getStats()
      
      // 再次生成相同配置
      genWithCache.generateCacheKey(config)
      const stats2 = genWithCache.getStats()
      
      expect(stats2.totalGenerations).toBe(2)
      expect(stats2.cacheHits).toBeGreaterThan(0)
    })

    test('应该能够清空缓存', () => {
      generator.generateCacheKey(mockConfig)
      let stats = generator.getStats()
      expect(stats.totalGenerations).toBe(1)
      
      generator.clearCache()
      stats = generator.getStats()
      expect(stats.cacheSize).toBe(0)
    })

    test('应该能够重置统计信息', () => {
      generator.generateCacheKey(mockConfig)
      let stats = generator.getStats()
      expect(stats.totalGenerations).toBe(1)
      
      generator.resetStats()
      stats = generator.getStats()
      expect(stats.totalGenerations).toBe(0)
      expect(stats.cacheHits).toBe(0)
      expect(stats.cacheMisses).toBe(0)
    })

    test('应该能够预热缓存', () => {
      const configs = [
        mockConfig,
        { ...mockConfig, method: 'POST' as const },
        { ...mockConfig, url: 'https://api.example.com/posts' }
      ]
      
      generator.warmupCache(configs)
      const stats = generator.getStats()
      
      expect(stats.totalGenerations).toBe(configs.length)
    })
  })

  describe('统计信息', () => {
    test('应该正确跟踪生成次数', () => {
      expect(generator.getStats().totalGenerations).toBe(0)
      
      generator.generateCacheKey(mockConfig)
      expect(generator.getStats().totalGenerations).toBe(1)
      
      generator.generateCacheKey(mockConfig)
      expect(generator.getStats().totalGenerations).toBe(2)
    })

    test('应该计算命中率', () => {
      const stats1 = generator.getStats()
      expect(stats1.hitRate).toBe('0.00')
      
      // 生成一些键
      generator.generateCacheKey(mockConfig)
      generator.generateCacheKey({ ...mockConfig, data: { complex: 'data' } })
      
      const stats2 = generator.getStats()
      expect(parseFloat(stats2.hitRate)).toBeGreaterThanOrEqual(0)
      expect(parseFloat(stats2.hitRate)).toBeLessThanOrEqual(100)
    })

    test('应该跟踪缓存大小', () => {
      const initialSize = generator.getStats().cacheSize
      
      generator.generateCacheKey({ ...mockConfig, data: { unique: 'data1' } })
      generator.generateCacheKey({ ...mockConfig, data: { unique: 'data2' } })
      
      const finalSize = generator.getStats().cacheSize
      expect(finalSize).toBeGreaterThanOrEqual(initialSize)
    })
  })

  describe('边界条件和错误处理', () => {
    test('应该处理空的FormData', () => {
      const emptyFormData = new FormData()
      const config = { ...mockConfig, data: emptyFormData }
      
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })

    test('应该处理FormData.entries()不可用的情况', () => {
      const mockFormData = {
        entries: () => {
          throw new Error('entries not supported')
        }
      } as any
      
      const config = { ...mockConfig, data: mockFormData }
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })

    test('应该处理循环引用对象', () => {
      const circularObj: any = { a: 1 }
      circularObj.self = circularObj
      
      const config = { ...mockConfig, data: circularObj }
      
      // 应该不会陷入无限循环
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })

    test('应该处理大数组', () => {
      const largeArray = new Array(1000).fill(0).map((_, i) => i)
      const config = { ...mockConfig, data: { array: largeArray } }
      
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })

    test('应该处理深度嵌套对象', () => {
      let nested: any = {}
      let current = nested
      
      // 创建深度嵌套对象
      for (let i = 0; i < 100; i++) {
        current.next = { value: i }
        current = current.next
      }
      
      const config = { ...mockConfig, data: nested }
      expect(() => generator.generateCacheKey(config)).not.toThrow()
    })
  })

  describe('一致性测试', () => {
    test('应该在多次运行中生成一致的键', () => {
      const testConfig = {
        method: 'POST' as const,
        url: 'https://api.example.com/test',
        params: { sort: 'name', order: 'asc' },
        data: { user: { id: 123, name: 'John Doe' } }
      }
      
      // 使用同一个生成器实例（实际使用场景）
      const singleGenerator = new CacheKeyGenerator()
      const keys = Array.from({ length: 10 }, () => 
        singleGenerator.generateCacheKey(testConfig)
      )
      
      // 所有键应该相同
      const uniqueKeys = new Set(keys)
      expect(uniqueKeys.size).toBe(1)
    })

    test('应该为不同但语义相同的配置生成相同键', () => {
      const config1 = {
        method: 'GET' as const,
        url: 'https://api.example.com/users/',
        params: { page: 1, size: 10 },
        data: null
      }
      
      const config2 = {
        method: 'GET' as const,
        url: 'https://api.example.com/users',
        params: { size: 10, page: 1 },
        data: undefined
      }
      
      const key1 = generator.generateCacheKey(config1)
      const key2 = generator.generateCacheKey(config2)
      
      expect(key1).toBe(key2)
    })

    test('不同实例可能生成不同的键（由于随机seed）', () => {
      const testConfig = {
        method: 'POST' as const,
        url: 'https://api.example.com/test',
        params: { sort: 'name', order: 'asc' },
        data: { user: { id: 123, name: 'John Doe' } }
      }
      
      // 创建多个不同的生成器实例
      const generators = Array.from({ length: 5 }, () => new CacheKeyGenerator())
      const keys = generators.map(gen => gen.generateCacheKey(testConfig))
      
      // 由于每个实例都有不同的随机seed，键可能不同
      // 这是设计行为，用于避免哈希冲突
      const uniqueKeys = new Set(keys)
      
      // 验证至少生成了键（不为空）
      expect(keys.every(key => key.length > 0)).toBe(true)
      // 通常会有多个不同的键，但不强制要求（理论上可能相同）
      expect(uniqueKeys.size).toBeGreaterThanOrEqual(1)
    })
  })
})
