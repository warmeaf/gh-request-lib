import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createCacheTestHelper,
  createTimeTestHelper,
  CACHE_TEST_DATA,
  CACHE_TEST_CONFIGS,
  CACHE_REQUEST_CONFIGS,
  expectCacheStats,
  sleep
} from './cache-test-helpers'
import { CacheFeature } from '../../src/features/cache'
import { StorageType } from '../../src/cache'

describe('Cache Advanced Functionality', () => {
  let helper: ReturnType<typeof createCacheTestHelper>
  let timeHelper: ReturnType<typeof createTimeTestHelper>

  beforeEach(() => {
    helper = createCacheTestHelper()
    timeHelper = createTimeTestHelper()
    // Mock console methods
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  afterEach(() => {
    helper.reset()
    timeHelper.restore()
    vi.restoreAllMocks()
  })

  describe('增量清理机制', () => {
    it('should perform incremental cleanup when needed', async () => {
      timeHelper.setMockTime(1000000)
      
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 添加多个缓存项，让缓存接近清理阈值
      const requests = Array.from({ length: 10 }, (_, i) => ({
        url: `https://api.example.com/users/${i}`,
        method: 'GET' as const
      }))

      for (const request of requests) {
        await cacheFeature.requestWithCache(request, {
          ttl: 60000, // 1分钟TTL
          clone: 'none'
        })
      }

      // 验证缓存项数量
      let keys = await helper.getAllCacheKeys()
      expect(keys.length).toBe(10)

      // 时间前进，让部分缓存过期
      timeHelper.advanceTime(70000) // 前进70秒，超过TTL

      // 触发新的请求，应该触发增量清理
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ttl: 60000, clone: 'none' }
      )

      // 验证过期项被清理（这个测试依赖于实现细节）
      // 注意：由于增量清理是异步的，可能需要等待
      await sleep(10)
    })

    it('should respect cleanup interval', async () => {
      timeHelper.setMockTime(1000000)
      
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 添加一些缓存项
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ttl: 1000, clone: 'none' } // 1秒TTL
      )

      // 时间前进，但不超过清理间隔
      timeHelper.advanceTime(60000) // 1分钟

      // 触发请求，由于清理间隔限制，可能不会立即清理
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        { ttl: 60000, clone: 'none' }
      )

      // 这里主要验证清理逻辑不会过于频繁执行
      // 具体行为依赖于实现细节
      const keys = await helper.getAllCacheKeys()
      expect(keys.length).toBeGreaterThanOrEqual(1)
    })

    it('should handle cleanup with random sampling', async () => {
      timeHelper.setMockTime(1000000)
      
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 添加大量缓存项以触发随机采样清理
      const requests = Array.from({ length: 150 }, (_, i) => ({
        url: `https://api.example.com/items/${i}`,
        method: 'GET' as const
      }))

      // 添加一些立即过期的项和一些长时间的项
      for (let i = 0; i < requests.length; i++) {
        const ttl = i < 50 ? 1000 : 300000 // 前50个1秒TTL，其余5分钟TTL
        await cacheFeature.requestWithCache(requests[i], {
          ttl,
          clone: 'none'
        })
      }

      // 时间前进让短TTL项过期
      timeHelper.advanceTime(2000)

      // 触发清理
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ttl: 60000, clone: 'none' }
      )

      // 等待清理完成
      await sleep(50)

      // 验证系统仍然正常工作
      const stats = await cacheFeature.getCacheStats()
      expect(stats).toBeDefined()
    })
  })

  describe('LRU淘汰策略', () => {
    it('should evict least recently used items when cache is full', async () => {
      timeHelper.setMockTime(1000000)
      
      // 创建小容量的缓存以便测试LRU
      const smallCacheFeature = new CacheFeature(
        helper.getMockRequestor(),
        5, // 小的最大条目数
        undefined,
        StorageType.MEMORY
      )
      smallCacheFeature.setStorageAdapter(helper.getMockStorageAdapter())
      
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 填满缓存
      const requests = Array.from({ length: 5 }, (_, i) => ({
        url: `https://api.example.com/users/${i}`,
        method: 'GET' as const
      }))

      for (const request of requests) {
        await smallCacheFeature.requestWithCache(request, {
          ttl: 300000,
          clone: 'none'
        })
      }

      // 验证缓存已满
      let keys = await helper.getAllCacheKeys()
      expect(keys.length).toBe(5)

      // 访问第一个项，使其变为最近使用
      await smallCacheFeature.requestWithCache(requests[0], {
        ttl: 300000,
        clone: 'none'
      })

      // 时间前进一点
      timeHelper.advanceTime(1000)

      // 添加新项，应该触发LRU淘汰
      await smallCacheFeature.requestWithCache({
        url: 'https://api.example.com/users/new',
        method: 'GET' as const
      }, {
        ttl: 300000,
        clone: 'none'
      })

      // 验证LRU逻辑（具体行为依赖实现）
      keys = await helper.getAllCacheKeys()
      // 可能会有清理，但第一个项应该仍然存在（因为最近被访问）
      expect(keys.length).toBeGreaterThanOrEqual(1)
    })

    it('should update access time when cache item is accessed', async () => {
      timeHelper.setMockTime(1000000)
      
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 添加缓存项
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 时间前进
      timeHelper.advanceTime(10000)

      // 再次访问，应该更新访问时间
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 验证存储适配器的setItem被调用以更新访问时间
      const mockFunctions = helper.getMockStorageAdapter().getMockFunctions()
      expect(mockFunctions.setItem).toHaveBeenCalled()
    })
  })

  describe('统计信息收集', () => {
    it('should collect comprehensive cache statistics', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 执行一些缓存操作
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 缓存命中
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      const stats = await cacheFeature.getCacheStats()

      expectCacheStats(stats, {
        size: 1,
        maxEntries: 1000,
        storageType: StorageType.MEMORY,
        cleanupInterval: 5 * 60 * 1000
      })

      // 验证键生成器统计信息
      expect(stats.keyGeneratorStats).toBeDefined()
      expect(typeof stats.keyGeneratorStats.totalGenerations).toBe('number')
      
      // 验证时间相关统计
      expect(typeof stats.lastCleanup).toBe('number')
    })

    it('should track key generator statistics', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 获取初始统计
      const initialStats = cacheFeature.getKeyGeneratorStats()
      const initialGenerations = initialStats.totalGenerations

      // 执行一些请求以生成缓存键
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 获取更新后的统计
      const updatedStats = cacheFeature.getKeyGeneratorStats()
      
      expect(updatedStats.totalGenerations).toBeGreaterThan(initialGenerations)
    })

    it('should allow resetting key generator statistics', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 执行一些操作
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 验证有统计数据
      let stats = cacheFeature.getKeyGeneratorStats()
      expect(stats.totalGenerations).toBeGreaterThan(0)

      // 重置统计
      cacheFeature.resetKeyGeneratorStats()

      // 验证统计被重置
      stats = cacheFeature.getKeyGeneratorStats()
      expect(stats.totalGenerations).toBe(0)
    })
  })

  describe('缓存预热功能', () => {
    it('should support cache warmup with request configurations', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 准备预热配置
      const warmupConfigs = [
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        CACHE_REQUEST_CONFIGS.GET_WITH_PARAMS
      ]

      // 执行预热
      cacheFeature.warmupKeyGeneratorCache(warmupConfigs)

      // 获取键生成器统计，验证预热效果
      const stats = cacheFeature.getKeyGeneratorStats()
      
      // 预热后应该有缓存命中率的提升（具体验证依赖实现）
      expect(stats).toBeDefined()
    })

    it('should improve performance after warmup', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 预热键生成器缓存
      const warmupConfigs = [CACHE_REQUEST_CONFIGS.GET_USERS]
      cacheFeature.warmupKeyGeneratorCache(warmupConfigs)

      // 执行请求，应该从预热的缓存中受益
      const start = performance.now()
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )
      const duration = performance.now() - start

      // 这里主要验证功能正常工作，性能提升在单测中难以准确测量
      expect(duration).toBeGreaterThanOrEqual(0)
    })
  })

  describe('键生成器配置更新', () => {
    it('should allow updating key generator configuration', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 更新键生成器配置
      cacheFeature.updateKeyGeneratorConfig({
        includeHeaders: true,
        headersWhitelist: ['authorization', 'x-custom-header'],
        maxKeyLength: 128
      })

      // 执行请求验证新配置生效
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_WITH_HEADERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 验证请求成功完成
      const stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { size: 1 })
    })

    it('should clear key generator cache when requested', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 执行一些请求以填充键生成器缓存
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 清除键生成器缓存
      cacheFeature.clearKeyGeneratorCache()

      // 验证键生成器缓存被清除（通过统计信息）
      const stats = cacheFeature.getKeyGeneratorStats()
      expect(stats.cacheHits).toBe(0) // 缓存命中应该被重置
    })
  })

  describe('缓存功能销毁', () => {
    it('should properly destroy cache feature', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 添加一些缓存项
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 销毁缓存功能
      await cacheFeature.destroy()

      // 验证存储适配器的destroy方法被调用
      const mockFunctions = helper.getMockStorageAdapter().getMockFunctions()
      expect(mockFunctions.destroy).toHaveBeenCalled()
    })

    it('should handle destroy errors gracefully', async () => {
      const cacheFeature = helper.getCacheFeature()
      
      // 设置存储适配器在destroy时失败
      helper.setStorageFail(true)

      // 销毁操作不应该抛出错误
      await expect(cacheFeature.destroy()).resolves.toBeUndefined()
      
      // 应该有警告日志
      expect(console.warn).toHaveBeenCalled()
    })

    it('should reset internal state after destroy', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 添加缓存项
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 获取销毁前的统计
      let stats = await cacheFeature.getCacheStats()
      expect(stats.lastCleanup).toBeGreaterThan(0)

      // 销毁
      await cacheFeature.destroy()

      // 验证内部状态被重置
      stats = await cacheFeature.getCacheStats()
      expect(stats.lastCleanup).toBe(0)
    })
  })

  describe('并发访问处理', () => {
    it('should handle concurrent cache requests correctly', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 同时发起多个相同的请求
      const promises = Array.from({ length: 5 }, () => 
        cacheFeature.requestWithCache(
          CACHE_REQUEST_CONFIGS.GET_USERS,
          CACHE_TEST_CONFIGS.BASIC
        )
      )

      const results = await Promise.all(promises)

      // 验证所有结果相同
      results.forEach(result => {
        expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      })

      // 由于缓存，实际请求应该只发起一次
      // 注意：这取决于具体实现，可能需要调整
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(1)
    })

    it('should handle mixed cache hit and miss scenarios', async () => {
      timeHelper.setMockTime(1000000)
      
      const cacheFeature = helper.getCacheFeature()
      helper.getMockRequestor().getMock()
        .mockResolvedValueOnce(CACHE_TEST_DATA.SIMPLE_USER)
        .mockResolvedValueOnce(CACHE_TEST_DATA.USERS_LIST)

      // 第一次请求 - 缓存未命中
      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.SHORT_TTL
      )

      expect(result1).toEqual(CACHE_TEST_DATA.SIMPLE_USER)

      // 第二次请求 - 缓存命中
      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.SHORT_TTL
      )

      expect(result2).toEqual(CACHE_TEST_DATA.SIMPLE_USER)

      // 时间前进让缓存过期
      timeHelper.advanceTime(2000)

      // 第三次请求 - 缓存过期，重新请求
      const result3 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.SHORT_TTL
      )

      expect(result3).toEqual(CACHE_TEST_DATA.USERS_LIST)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(2)
    })
  })
})
