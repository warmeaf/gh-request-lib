import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { safeCacheOperation, getCacheHitResult, buildCacheConfig } from '../../src/features/idempotent/cache-ops'
import { CacheFeature } from '../../src/features/cache'
import { IdempotentRequestContext, CacheItem } from '../../src/features/idempotent/types'
import { CacheKeyConfig } from '../../src/cache/cache-key-generator'

describe('cache-ops - safeCacheOperation', () => {
  let context: IdempotentRequestContext

  beforeEach(() => {
    context = {
      idempotentKey: 'test-key',
      config: {
        url: 'https://api.example.com/test',
        method: 'GET',
      },
      startTime: Date.now(),
    }
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('成功场景', () => {
    it('应该成功执行缓存操作并返回数据', async () => {
      // 准备测试数据
      const expectedData = { id: 1, name: 'Test Data' }
      const operation = vi.fn().mockResolvedValue(expectedData)

      // 执行测试
      const result = await safeCacheOperation(operation, context)

      // 验证结果
      expect(result.success).toBe(true)
      expect(result.data).toEqual(expectedData)
      expect(result.error).toBeUndefined()
      expect(result.fallbackUsed).toBeUndefined()
      expect(operation).toHaveBeenCalledTimes(1)
    })

    it('应该正确处理返回 null 的操作', async () => {
      // 准备测试数据
      const operation = vi.fn().mockResolvedValue(null)

      // 执行测试
      const result = await safeCacheOperation(operation, context)

      // 验证结果
      expect(result.success).toBe(true)
      expect(result.data).toBeNull()
      expect(result.error).toBeUndefined()
    })

    it('应该正确处理返回 undefined 的操作', async () => {
      // 准备测试数据
      const operation = vi.fn().mockResolvedValue(undefined)

      // 执行测试
      const result = await safeCacheOperation(operation, context)

      // 验证结果
      expect(result.success).toBe(true)
      expect(result.data).toBeUndefined()
    })
  })

  describe('错误处理', () => {
    it('应该捕获操作错误并返回失败结果（无降级值）', async () => {
      // 准备测试数据
      const error = new Error('Cache operation failed')
      const operation = vi.fn().mockRejectedValue(error)
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // 执行测试
      const result = await safeCacheOperation(operation, context)

      // 验证结果
      expect(result.success).toBe(false)
      expect(result.data).toBeUndefined()
      expect(result.error).toEqual(error)
      expect(result.fallbackUsed).toBe(false)
      expect(consoleWarnSpy).not.toHaveBeenCalled()
    })

    it('应该在操作失败时使用降级值', async () => {
      // 准备测试数据
      const error = new Error('Cache operation failed')
      const operation = vi.fn().mockRejectedValue(error)
      const fallbackValue = { id: 0, name: 'Fallback Data' }
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // 执行测试
      const result = await safeCacheOperation(operation, context, fallbackValue)

      // 验证结果
      expect(result.success).toBe(false)
      expect(result.data).toEqual(fallbackValue)
      expect(result.error).toEqual(error)
      expect(result.fallbackUsed).toBe(true)

      // 验证警告日志
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('[Idempotent] Cache operation failed'),
        error.message
      )
    })

    it('应该处理非 Error 类型的异常', async () => {
      // 准备测试数据
      const operation = vi.fn().mockRejectedValue('String error')

      // 执行测试
      const result = await safeCacheOperation(operation, context)

      // 验证结果
      expect(result.success).toBe(false)
      expect(result.error).toBeInstanceOf(Error)
      expect(result.error?.message).toBe('Unknown cache error')
    })

    it('应该在降级值为 null 时正确处理', async () => {
      // 准备测试数据
      const error = new Error('Operation failed')
      const operation = vi.fn().mockRejectedValue(error)
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // 执行测试
      const result = await safeCacheOperation(operation, context, null)

      // 验证结果
      expect(result.success).toBe(false)
      expect(result.data).toBeNull()
      expect(result.fallbackUsed).toBe(true)
      expect(consoleWarnSpy).toHaveBeenCalled()
    })
  })

  describe('日志输出', () => {
    it('应该在降级时输出包含请求信息的警告日志', async () => {
      // 准备测试数据
      const error = new Error('Cache error')
      const operation = vi.fn().mockRejectedValue(error)
      const fallbackValue = 'fallback'
      const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      // 执行测试
      await safeCacheOperation(operation, context, fallbackValue)

      // 验证日志
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('GET'),
        expect.any(String)
      )
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('https://api.example.com/test'),
        expect.any(String)
      )
    })
  })
})

describe('cache-ops - getCacheHitResult', () => {
  let cacheFeature: CacheFeature
  let context: IdempotentRequestContext
  let onHit: ReturnType<typeof vi.fn>

  beforeEach(() => {
    // 创建 mock CacheFeature
    cacheFeature = {
      getCacheItem: vi.fn(),
      isCacheItemValid: vi.fn(),
      removeCacheItem: vi.fn(),
    } as any

    context = {
      idempotentKey: 'test-idempotent-key',
      config: {
        url: 'https://api.example.com/test',
        method: 'GET',
      },
      startTime: Date.now(),
    }

    onHit = vi.fn().mockResolvedValue(undefined)
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('缓存命中场景', () => {
    it('应该在缓存命中且有效时返回缓存数据', async () => {
      // 准备测试数据
      const cachedData = { id: 1, name: 'Cached Data' }
      const cachedItem: CacheItem = {
        key: 'test-key',
        data: cachedData,
        timestamp: Date.now(),
        ttl: 30000,
        accessTime: Date.now(),
        accessCount: 1,
      }

      ;(cacheFeature.getCacheItem as any).mockResolvedValue(cachedItem)
      ;(cacheFeature.isCacheItemValid as any).mockReturnValue(true)

      // 执行测试
      const result = await getCacheHitResult<typeof cachedData>(cacheFeature, context, onHit)

      // 验证结果
      expect(result).toEqual(cachedData)
      expect(cacheFeature.getCacheItem).toHaveBeenCalledWith(context.idempotentKey)
      expect(cacheFeature.isCacheItemValid).toHaveBeenCalledWith(cachedItem)
      expect(onHit).toHaveBeenCalledWith(cachedItem)
      expect(cacheFeature.removeCacheItem).not.toHaveBeenCalled()
    })

    it('应该在缓存命中时调用 onHit 回调', async () => {
      // 准备测试数据
      const cachedItem: CacheItem = {
        key: 'test-key',
        data: 'test-data',
        timestamp: Date.now(),
        ttl: 30000,
        accessTime: Date.now(),
        accessCount: 1,
      }

      ;(cacheFeature.getCacheItem as any).mockResolvedValue(cachedItem)
      ;(cacheFeature.isCacheItemValid as any).mockReturnValue(true)

      // 执行测试
      await getCacheHitResult(cacheFeature, context, onHit)

      // 验证 onHit 被调用
      expect(onHit).toHaveBeenCalledTimes(1)
      expect(onHit).toHaveBeenCalledWith(cachedItem)
    })

    it('应该正确处理复杂对象的缓存数据', async () => {
      // 准备测试数据
      const complexData = {
        user: { id: 1, name: 'John' },
        metadata: { timestamp: Date.now(), version: '1.0' },
        items: [1, 2, 3, 4, 5],
      }
      const cachedItem: CacheItem = {
        key: 'test-key',
        data: complexData,
        timestamp: Date.now(),
        ttl: 30000,
        accessTime: Date.now(),
        accessCount: 1,
      }

      ;(cacheFeature.getCacheItem as any).mockResolvedValue(cachedItem)
      ;(cacheFeature.isCacheItemValid as any).mockReturnValue(true)

      // 执行测试
      const result = await getCacheHitResult<typeof complexData>(cacheFeature, context, onHit)

      // 验证结果
      expect(result).toEqual(complexData)
    })
  })

  describe('缓存未命中场景', () => {
    it('应该在缓存不存在时返回 null', async () => {
      // 准备测试数据
      ;(cacheFeature.getCacheItem as any).mockResolvedValue(null)

      // 执行测试
      const result = await getCacheHitResult(cacheFeature, context, onHit)

      // 验证结果
      expect(result).toBeNull()
      expect(cacheFeature.getCacheItem).toHaveBeenCalledWith(context.idempotentKey)
      expect(cacheFeature.isCacheItemValid).not.toHaveBeenCalled()
      expect(onHit).not.toHaveBeenCalled()
      expect(cacheFeature.removeCacheItem).not.toHaveBeenCalled()
    })

    it('应该在缓存返回 undefined 时返回 null', async () => {
      // 准备测试数据
      ;(cacheFeature.getCacheItem as any).mockResolvedValue(undefined)

      // 执行测试
      const result = await getCacheHitResult(cacheFeature, context, onHit)

      // 验证结果
      expect(result).toBeNull()
      expect(onHit).not.toHaveBeenCalled()
    })
  })

  describe('缓存过期场景', () => {
    it('应该在缓存过期时删除缓存项并返回 null', async () => {
      // 准备测试数据
      const expiredItem: CacheItem = {
        key: 'test-key',
        data: 'expired-data',
        timestamp: Date.now() - 100000,
        ttl: 30000,
        accessTime: Date.now() - 100000,
        accessCount: 1,
      }

      ;(cacheFeature.getCacheItem as any).mockResolvedValue(expiredItem)
      ;(cacheFeature.isCacheItemValid as any).mockReturnValue(false)

      // 执行测试
      const result = await getCacheHitResult(cacheFeature, context, onHit)

      // 验证结果
      expect(result).toBeNull()
      expect(cacheFeature.isCacheItemValid).toHaveBeenCalledWith(expiredItem)
      expect(cacheFeature.removeCacheItem).toHaveBeenCalledWith(context.idempotentKey)
      expect(onHit).not.toHaveBeenCalled()
    })

    it('应该在缓存无效时先验证后删除', async () => {
      // 准备测试数据
      const invalidItem: CacheItem = {
        key: 'test-key',
        data: 'invalid-data',
        timestamp: Date.now(),
        ttl: 30000,
        accessTime: Date.now(),
        accessCount: 1,
      }

      ;(cacheFeature.getCacheItem as any).mockResolvedValue(invalidItem)
      ;(cacheFeature.isCacheItemValid as any).mockReturnValue(false)

      // 执行测试
      await getCacheHitResult(cacheFeature, context, onHit)

      // 验证调用顺序
      const getCacheSpy = cacheFeature.getCacheItem as any
      const isValidSpy = cacheFeature.isCacheItemValid as any
      const removeSpy = cacheFeature.removeCacheItem as any

      expect(getCacheSpy).toHaveBeenCalled()
      expect(isValidSpy).toHaveBeenCalled()
      expect(removeSpy).toHaveBeenCalledWith(context.idempotentKey)
    })
  })

  describe('错误处理', () => {
    it('应该在 getCacheItem 抛出异常时向上传播错误', async () => {
      // 准备测试数据
      const error = new Error('Failed to get cache item')
      ;(cacheFeature.getCacheItem as any).mockRejectedValue(error)

      // 执行测试并验证错误
      await expect(getCacheHitResult(cacheFeature, context, onHit)).rejects.toThrow(error)
      expect(onHit).not.toHaveBeenCalled()
    })

    it('应该在 onHit 回调抛出异常时向上传播错误', async () => {
      // 准备测试数据
      const cachedItem: CacheItem = {
        key: 'test-key',
        data: 'test-data',
        timestamp: Date.now(),
        ttl: 30000,
        accessTime: Date.now(),
        accessCount: 1,
      }
      const error = new Error('onHit callback failed')

      ;(cacheFeature.getCacheItem as any).mockResolvedValue(cachedItem)
      ;(cacheFeature.isCacheItemValid as any).mockReturnValue(true)
      onHit.mockRejectedValue(error)

      // 执行测试并验证错误
      await expect(getCacheHitResult(cacheFeature, context, onHit)).rejects.toThrow(error)
    })

    it('应该在 removeCacheItem 抛出异常时向上传播错误', async () => {
      // 准备测试数据
      const expiredItem: CacheItem = {
        key: 'test-key',
        data: 'expired-data',
        timestamp: Date.now(),
        ttl: 30000,
        accessTime: Date.now(),
        accessCount: 1,
      }
      const error = new Error('Failed to remove cache item')

      ;(cacheFeature.getCacheItem as any).mockResolvedValue(expiredItem)
      ;(cacheFeature.isCacheItemValid as any).mockReturnValue(false)
      ;(cacheFeature.removeCacheItem as any).mockRejectedValue(error)

      // 执行测试并验证错误
      await expect(getCacheHitResult(cacheFeature, context, onHit)).rejects.toThrow(error)
    })
  })
})

describe('cache-ops - buildCacheConfig', () => {
  describe('基础配置构建', () => {
    it('应该构建包含所有必要字段的缓存配置', () => {
      // 准备测试数据
      const ttl = 30000
      const idempotentKey = 'test-key'
      const keyGeneratorConfig: CacheKeyConfig = {
        includeHeaders: true,
        headersWhitelist: ['authorization', 'content-type'],
      }
      const clone = 'deep' as const

      // 执行测试
      const result = buildCacheConfig(ttl, idempotentKey, keyGeneratorConfig, clone)

      // 验证结果
      expect(result).toEqual({
        ttl,
        key: idempotentKey,
        keyGenerator: keyGeneratorConfig,
        clone,
      })
    })

    it('应该正确处理 undefined 的 keyGeneratorConfig', () => {
      // 准备测试数据
      const ttl = 60000
      const idempotentKey = 'test-key-2'
      const clone = 'shallow' as const

      // 执行测试
      const result = buildCacheConfig(ttl, idempotentKey, undefined, clone)

      // 验证结果
      expect(result).toEqual({
        ttl,
        key: idempotentKey,
        keyGenerator: undefined,
        clone,
      })
    })
  })

  describe('不同的 TTL 值', () => {
    it('应该正确处理较短的 TTL', () => {
      // 准备测试数据
      const ttl = 5000
      const result = buildCacheConfig(ttl, 'key', undefined, 'none')

      // 验证结果
      expect(result.ttl).toBe(5000)
    })

    it('应该正确处理较长的 TTL', () => {
      // 准备测试数据
      const ttl = 300000
      const result = buildCacheConfig(ttl, 'key', undefined, 'deep')

      // 验证结果
      expect(result.ttl).toBe(300000)
    })

    it('应该正确处理零 TTL', () => {
      // 准备测试数据
      const ttl = 0
      const result = buildCacheConfig(ttl, 'key', undefined, 'deep')

      // 验证结果
      expect(result.ttl).toBe(0)
    })

    it('应该正确处理负数 TTL', () => {
      // 准备测试数据
      const ttl = -1000
      const result = buildCacheConfig(ttl, 'key', undefined, 'deep')

      // 验证结果
      expect(result.ttl).toBe(-1000)
    })
  })

  describe('不同的 clone 策略', () => {
    it('应该支持 deep clone 策略', () => {
      const result = buildCacheConfig(30000, 'key', undefined, 'deep')
      expect(result.clone).toBe('deep')
    })

    it('应该支持 shallow clone 策略', () => {
      const result = buildCacheConfig(30000, 'key', undefined, 'shallow')
      expect(result.clone).toBe('shallow')
    })

    it('应该支持 none clone 策略', () => {
      const result = buildCacheConfig(30000, 'key', undefined, 'none')
      expect(result.clone).toBe('none')
    })
  })

  describe('不同的 key 值', () => {
    it('应该正确处理简单的 key', () => {
      const key = 'simple-key'
      const result = buildCacheConfig(30000, key, undefined, 'deep')
      expect(result.key).toBe(key)
    })

    it('应该正确处理复杂的 key', () => {
      const key = 'GET:https://api.example.com/users?page=1&limit=10'
      const result = buildCacheConfig(30000, key, undefined, 'deep')
      expect(result.key).toBe(key)
    })

    it('应该正确处理空字符串 key', () => {
      const key = ''
      const result = buildCacheConfig(30000, key, undefined, 'deep')
      expect(result.key).toBe('')
    })

    it('应该正确处理包含特殊字符的 key', () => {
      const key = 'key-with-special-chars-!@#$%^&*()'
      const result = buildCacheConfig(30000, key, undefined, 'deep')
      expect(result.key).toBe(key)
    })
  })

  describe('不同的 keyGeneratorConfig', () => {
    it('应该正确处理完整的 keyGeneratorConfig', () => {
      // 准备测试数据
      const keyGeneratorConfig: CacheKeyConfig = {
        includeHeaders: true,
        headersWhitelist: ['authorization', 'x-api-key'],
        maxKeyLength: 512,
        enableHashCache: true,
      }

      // 执行测试
      const result = buildCacheConfig(30000, 'key', keyGeneratorConfig, 'deep')

      // 验证结果
      expect(result.keyGenerator).toEqual(keyGeneratorConfig)
    })

    it('应该正确处理部分的 keyGeneratorConfig', () => {
      // 准备测试数据
      const keyGeneratorConfig: CacheKeyConfig = {
        includeHeaders: false,
        maxKeyLength: 256,
      }

      // 执行测试
      const result = buildCacheConfig(30000, 'key', keyGeneratorConfig, 'deep')

      // 验证结果
      expect(result.keyGenerator).toEqual(keyGeneratorConfig)
    })

    it('应该正确处理空的 keyGeneratorConfig', () => {
      // 准备测试数据
      const keyGeneratorConfig: CacheKeyConfig = {}

      // 执行测试
      const result = buildCacheConfig(30000, 'key', keyGeneratorConfig, 'deep')

      // 验证结果
      expect(result.keyGenerator).toEqual({})
    })
  })

  describe('返回值的不可变性', () => {
    it('返回的配置对象应该是新对象', () => {
      const config1 = buildCacheConfig(30000, 'key1', undefined, 'deep')
      const config2 = buildCacheConfig(30000, 'key1', undefined, 'deep')

      expect(config1).not.toBe(config2)
      expect(config1).toEqual(config2)
    })

    it('修改返回的配置对象不应影响后续调用', () => {
      const config1 = buildCacheConfig(30000, 'key', undefined, 'deep')
      config1.ttl = 60000

      const config2 = buildCacheConfig(30000, 'key', undefined, 'deep')

      expect(config2.ttl).toBe(30000)
    })
  })
})
