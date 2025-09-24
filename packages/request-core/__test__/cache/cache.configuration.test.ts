import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createCacheTestHelper,
  MockStorageAdapter,
  CACHE_TEST_DATA,
  CACHE_TEST_CONFIGS,
  CACHE_REQUEST_CONFIGS,
  expectCacheStats,
} from './cache-test-helpers'
import { CacheFeature } from '../../src/features/cache'
import {
  StorageType,
  MemoryStorageAdapter,
  LocalStorageAdapter,
  IndexedDBAdapter,
  CacheKeyStrategy,
  LRUInvalidationPolicy,
} from '../../src/cache'
import type { CacheInvalidationPolicy } from '../../src/cache'

describe('Cache Configuration Tests', () => {
  let helper: ReturnType<typeof createCacheTestHelper>

  beforeEach(() => {
    helper = createCacheTestHelper()
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    helper.reset()
    vi.restoreAllMocks()
  })

  describe('存储类型配置', () => {
    it('should use memory storage by default', async () => {
      const cacheFeature = helper.getCacheFeature()

      const storageType = cacheFeature.getStorageType()
      expect(storageType).toBe(StorageType.MEMORY)
    })

    it('should switch storage type during runtime', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用内存存储
      await cacheFeature.requestWithCache(CACHE_REQUEST_CONFIGS.GET_USERS, {
        ...CACHE_TEST_CONFIGS.BASIC,
        storageType: StorageType.MEMORY,
      })

      let stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { storageType: StorageType.MEMORY })

      // 切换到不同的存储类型（如果可用）
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        { ...CACHE_TEST_CONFIGS.BASIC, storageType: StorageType.INDEXED_DB }
      )

      stats = await cacheFeature.getCacheStats()
      // 在测试环境中，IndexedDB可能不可用，会回退到内存存储
      expect(stats.storageType).toBeDefined()
    })

    it('should handle unavailable storage gracefully', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 尝试使用可能不可用的存储类型
      await cacheFeature.requestWithCache(CACHE_REQUEST_CONFIGS.GET_USERS, {
        ...CACHE_TEST_CONFIGS.BASIC,
        storageType: StorageType.LOCAL_STORAGE, // 在Node.js环境中不可用
      })

      // 应该回退到内存存储，不应该抛出错误
      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC }
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)

      // 验证回退警告
      expect(console.warn).toHaveBeenCalled()
    })

    it('should use custom storage adapter when provided', async () => {
      const customAdapter = new MockStorageAdapter()
      const cacheFeature = helper.getCacheFeature()

      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用自定义存储适配器
      await cacheFeature.requestWithCache(CACHE_REQUEST_CONFIGS.GET_USERS, {
        ...CACHE_TEST_CONFIGS.BASIC,
        storageAdapter: customAdapter,
      })

      // 验证自定义适配器被使用
      const mockFunctions = customAdapter.getMockFunctions()
      expect(mockFunctions.setItem).toHaveBeenCalled()
    })
  })

  describe('最大条目限制配置', () => {
    it('should respect default maxEntries limit', async () => {
      const cacheFeature = helper.getCacheFeature()

      const stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { maxEntries: 1000 })
    })

    it('should update maxEntries during runtime', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用不同的maxEntries配置
      await cacheFeature.requestWithCache(CACHE_REQUEST_CONFIGS.GET_USERS, {
        ...CACHE_TEST_CONFIGS.BASIC,
        maxEntries: 500,
      })

      const stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { maxEntries: 500 })
    })

    it('should ignore invalid maxEntries values', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用无效的maxEntries值
      await cacheFeature.requestWithCache(CACHE_REQUEST_CONFIGS.GET_USERS, {
        ...CACHE_TEST_CONFIGS.BASIC,
        maxEntries: -1, // 无效值
      })

      const stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { maxEntries: 1000 }) // 应该保持默认值

      // 使用零值
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        {
          ...CACHE_TEST_CONFIGS.BASIC,
          maxEntries: 0,
        }
      )

      const stats2 = await cacheFeature.getCacheStats()
      expectCacheStats(stats2, { maxEntries: 1000 }) // 应该保持默认值
    })

    it('should handle very small maxEntries limits', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用非常小的限制
      await cacheFeature.requestWithCache(CACHE_REQUEST_CONFIGS.GET_USERS, {
        ...CACHE_TEST_CONFIGS.BASIC,
        maxEntries: 1,
      })

      let stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { maxEntries: 1 })

      // 添加另一个缓存项，可能触发清理
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        {
          ...CACHE_TEST_CONFIGS.BASIC,
          maxEntries: 1,
        }
      )

      stats = await cacheFeature.getCacheStats()
      // 由于限制为1，可能会有清理发生
      expect(stats.size).toBeLessThanOrEqual(1)
    })
  })

  describe('键生成器配置', () => {
    it('should use custom key generator configuration', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用自定义键生成器配置
      const customKeyConfig = {
        includeHeaders: true,
        headersWhitelist: ['authorization', 'x-api-key'],
        maxKeyLength: 128,
        enableHashCache: false,
      }

      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS,
        {
          ...CACHE_TEST_CONFIGS.BASIC,
          keyGenerator: customKeyConfig,
        }
      )

      // 验证请求成功完成，说明配置生效
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledWith(
        CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS
      )
    })

    it('should handle different hash algorithms', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 测试不同的哈希算法
      const algorithms = ['fnv1a', 'xxhash', 'simple'] as const

      for (const algorithm of algorithms) {
        await cacheFeature.requestWithCache(
          {
            ...CACHE_REQUEST_CONFIGS.GET_USERS,
            url: `${CACHE_REQUEST_CONFIGS.GET_USERS.url}/${algorithm}`,
          },
          {
            ...CACHE_TEST_CONFIGS.BASIC,
            keyGenerator: { hashAlgorithm: algorithm },
          }
        )
      }

      // 验证所有算法都能正常工作
      const stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { size: algorithms.length })
    })

    it('should handle header inclusion configuration', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 不包含请求头的配置
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS,
        {
          ...CACHE_TEST_CONFIGS.BASIC,
          keyGenerator: { includeHeaders: false },
        }
      )

      // 包含请求头的配置
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS,
        {
          ...CACHE_TEST_CONFIGS.BASIC,
          keyGenerator: { includeHeaders: true },
        }
      )

      // 由于键生成方式不同，应该产生两个不同的缓存项
      const stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { size: 2 })
    })
  })

  class TestKeyStrategy implements CacheKeyStrategy {
    generateKey(config: any): string {
      return `test-key-${config.url}-${config.method}`
    }

    validateKey(key: string): boolean {
      return key.length > 0
    }
  }

  describe('自定义键策略配置', () => {
    it('should use custom key strategy when provided', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      const customKeyStrategy = new TestKeyStrategy()

      await cacheFeature.requestWithCache(CACHE_REQUEST_CONFIGS.GET_USERS, {
        ...CACHE_TEST_CONFIGS.BASIC,
        keyStrategy: customKeyStrategy,
      })

      // 验证缓存项被创建
      const keys = await helper.getAllCacheKeys()
      expect(keys.length).toBe(1)
      expect(keys[0]).toMatch(/^test-key-/)
    })

    it('should prioritize custom key over key strategy', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      const customKeyStrategy = new TestKeyStrategy()

      await cacheFeature.requestWithCache(CACHE_REQUEST_CONFIGS.GET_USERS, {
        ...CACHE_TEST_CONFIGS.BASIC,
        key: 'priority-key',
        keyStrategy: customKeyStrategy,
      })

      // 自定义key应该覆盖key策略
      const keys = await helper.getAllCacheKeys()
      expect(keys).toContain('priority-key')
    })

    it('should handle key strategy runtime changes', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 设置键策略
      const keyStrategy = new TestKeyStrategy()
      cacheFeature.setKeyStrategy(keyStrategy)

      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      const keys = await helper.getAllCacheKeys()
      expect(keys[0]).toMatch(/^test-key-/)
    })
  })

  describe('失效策略配置', () => {
    class TestInvalidationPolicy implements CacheInvalidationPolicy {
      shouldInvalidate(item: any, currentTime: number): boolean {
        // 简单的基于时间戳的失效策略
        return currentTime - item.timestamp > 1000 // 1秒过期
      }

      updateItemOnAccess(item: any, currentTime: number): void {
        item.accessTime = currentTime
        item.accessCount = (item.accessCount || 0) + 1
      }
    }

    it('should use custom invalidation policy', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      const customPolicy = new TestInvalidationPolicy()

      await cacheFeature.requestWithCache(CACHE_REQUEST_CONFIGS.GET_USERS, {
        ...CACHE_TEST_CONFIGS.BASIC,
        invalidationPolicy: customPolicy,
      })

      // 验证缓存项被创建
      const stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { size: 1 })
    })

    it('should handle invalidation policy runtime changes', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 设置失效策略
      const invalidationPolicy = new TestInvalidationPolicy()
      cacheFeature.setInvalidationPolicy(invalidationPolicy)

      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
    })

    it('should validate cache items using custom policy', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 手动创建一个缓存项
      const testItem = helper.createCacheItem(
        'test-key',
        CACHE_TEST_DATA.SIMPLE_USER
      )

      // 使用缓存功能验证项目有效性
      expect(cacheFeature.isCacheItemValid(testItem)).toBe(true)

      // 模拟过期的项目
      const expiredItem = helper.createCacheItem(
        'expired-key',
        CACHE_TEST_DATA.SIMPLE_USER,
        1000,
        Date.now() - 2000 // 2秒前访问
      )
      expiredItem.timestamp = Date.now() - 2000 // 2秒前创建

      expect(cacheFeature.isCacheItemValid(expiredItem)).toBe(false)
    })
  })

  describe('配置组合测试', () => {
    it('should handle complex configuration combinations', async () => {
      const customAdapter = new MockStorageAdapter()
      const customKeyStrategy = new TestKeyStrategy()
      const customPolicy = new LRUInvalidationPolicy()

      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      const complexConfig = {
        ttl: 60000,
        maxEntries: 100,
        storageAdapter: customAdapter,
        keyStrategy: customKeyStrategy,
        invalidationPolicy: customPolicy,
        keyGenerator: {
          includeHeaders: true,
          maxKeyLength: 256,
          enableHashCache: true,
        },
        clone: 'deep' as const,
      }

      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS,
        complexConfig
      )

      // 验证所有配置生效
      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS,
        complexConfig
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(result).not.toBe(CACHE_TEST_DATA.SIMPLE_USER) // 深克隆

      // 验证自定义适配器被使用
      const mockFunctions = customAdapter.getMockFunctions()
      expect(mockFunctions.setItem).toHaveBeenCalled()
      expect(mockFunctions.getItem).toHaveBeenCalled()

      // 验证统计信息
      const stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { maxEntries: 100 })
    })

    it('should maintain configuration isolation between requests', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 第一个请求使用一套配置
      await cacheFeature.requestWithCache(CACHE_REQUEST_CONFIGS.GET_USERS, {
        ttl: 60000,
        maxEntries: 50,
        clone: 'shallow',
      })

      // 第二个请求使用不同配置
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        {
          ttl: 120000,
          maxEntries: 200,
          clone: 'deep',
        }
      )

      // 配置不应该互相干扰
      const stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, {
        size: 2,
        maxEntries: 200, // 应该是最后一次设置的值
      })
    })
  })

  describe('配置验证和错误处理', () => {
    it('should handle invalid TTL values gracefully', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用负数TTL
      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, ttl: -1000 }
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用零TTL
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        { ...CACHE_TEST_CONFIGS.BASIC, ttl: 0 }
      )

      // 应该都能正常工作，不抛出错误
      const stats = await cacheFeature.getCacheStats()
      expect(stats.size).toBeGreaterThanOrEqual(1)
    })

    it('should handle malformed configuration objects', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用undefined配置
      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        undefined as any
      )

      expect(result1).toEqual(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用空对象
      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        {}
      )

      expect(result2).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
    })
  })
})
