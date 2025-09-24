import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createCacheTestHelper,
  createTimeTestHelper,
  CACHE_TEST_DATA,
  CACHE_TEST_CONFIGS,
  CACHE_REQUEST_CONFIGS,
  expectCacheStats
} from './cache-test-helpers'

describe('Cache Basic Functionality', () => {
  let helper: ReturnType<typeof createCacheTestHelper>
  let timeHelper: ReturnType<typeof createTimeTestHelper>

  beforeEach(() => {
    helper = createCacheTestHelper()
    timeHelper = createTimeTestHelper()
    // Mock console methods to avoid test noise
    vi.spyOn(console, 'log').mockImplementation(() => { })
    vi.spyOn(console, 'warn').mockImplementation(() => { })
  })

  afterEach(() => {
    helper.reset()
    timeHelper.restore()
    vi.restoreAllMocks()
  })

  describe('基本缓存操作', () => {
    it('should cache successful request response', async () => {
      // 设置请求返回值
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)
      const cacheFeature = helper.getCacheFeature()

      // 第一次请求
      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 验证结果
      expect(result1).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(1)

      // 第二次请求应该从缓存获取
      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result2).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(1) // 仍然是1次
    })

    it('should return cache miss when cache is empty', async () => {
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)
      const cacheFeature = helper.getCacheFeature()

      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(1)
    })

    it('should handle different request URLs separately', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 设置不同URL的返回值
      helper.getMockRequestor().getMock()
        .mockResolvedValueOnce(CACHE_TEST_DATA.SIMPLE_USER)
        .mockResolvedValueOnce(CACHE_TEST_DATA.USERS_LIST)

      // 请求不同的URL
      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )
      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result1).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(result2).toEqual(CACHE_TEST_DATA.USERS_LIST)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(2)

      // 再次请求相同的URL应该从缓存获取
      const result3 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )
      const result4 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result3).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(result4).toEqual(CACHE_TEST_DATA.USERS_LIST)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(2) // 仍然是2次
    })
  })

  describe('TTL过期机制', () => {
    it('should expire cache after TTL', async () => {
      timeHelper.setMockTime(1000000) // 设置初始时间

      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)
      const cacheFeature = helper.getCacheFeature()

      // 使用短TTL
      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.SHORT_TTL
      )

      expect(result1).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(1)

      // 时间前进但未超过TTL
      timeHelper.advanceTime(500) // 前进0.5秒
      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.SHORT_TTL
      )

      expect(result2).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(1) // 仍从缓存获取

      // 时间前进超过TTL
      timeHelper.advanceTime(600) // 总共前进1.1秒，超过1秒TTL

      // 设置新的返回值验证是否重新请求
      const updatedUser = { ...CACHE_TEST_DATA.SIMPLE_USER, name: 'Updated John' }
      helper.setRequestorReturn(updatedUser)

      const result3 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.SHORT_TTL
      )

      expect(result3).toEqual(updatedUser)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(2) // 重新请求
    })

    it('should handle cache items with different TTLs', async () => {
      timeHelper.setMockTime(1000000)

      const cacheFeature = helper.getCacheFeature()

      // 使用不同TTL缓存不同请求
      helper.getMockRequestor().getMock()
        .mockResolvedValueOnce(CACHE_TEST_DATA.SIMPLE_USER)
        .mockResolvedValueOnce(CACHE_TEST_DATA.USERS_LIST)

      // 短TTL请求
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.SHORT_TTL
      )

      // 长TTL请求
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 时间前进，只有短TTL的应该过期
      timeHelper.advanceTime(2000) // 2秒后

      // 设置新的返回值
      helper.setRequestorReturn({ ...CACHE_TEST_DATA.SIMPLE_USER, name: 'New User' })

      // 短TTL的应该重新请求
      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.SHORT_TTL
      )

      // 长TTL的应该仍从缓存获取
      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect((result1 as any).name).toBe('New User') // 新请求的结果
      expect(result2).toEqual(CACHE_TEST_DATA.USERS_LIST) // 缓存的结果
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(3) // 初始2次 + 1次重新请求
    })
  })

  describe('数据克隆策略', () => {
    it('should return original data with none clone strategy', async () => {
      helper.setRequestorReturn(CACHE_TEST_DATA.NESTED_OBJECT)
      const cacheFeature = helper.getCacheFeature()

      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'none' }
      )

      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'none' }
      )

      // 使用none策略时，应该返回相同的对象引用
      expect(result1).toBe(result2)
    })

    it('should return shallow cloned data with shallow clone strategy', async () => {
      helper.setRequestorReturn(CACHE_TEST_DATA.NESTED_OBJECT)
      const cacheFeature = helper.getCacheFeature()

      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'shallow' }
      )

      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'shallow' }
      )

      // 浅克隆：顶层对象不同，但嵌套对象相同
      expect(result1).not.toBe(result2)
      expect(result1).toEqual(result2)
      expect((result1 as any).user).toBe((result2 as any).user) // 嵌套对象应该是同一个引用
    })

    it('should return deep cloned data with deep clone strategy', async () => {
      helper.setRequestorReturn(CACHE_TEST_DATA.NESTED_OBJECT)
      const cacheFeature = helper.getCacheFeature()

      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'deep' }
      )

      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'deep' }
      )

      // 深克隆：所有层级都应该是不同的对象
      expect(result1).not.toBe(result2)
      expect(result1).toEqual(result2)
      expect((result1 as any).user).not.toBe((result2 as any).user) // 嵌套对象也应该是不同的引用
      expect((result1 as any).user.profile).not.toBe((result2 as any).user.profile)
    })

    it('should handle array data correctly with different clone strategies', async () => {
      helper.setRequestorReturn(CACHE_TEST_DATA.USERS_LIST)
      const cacheFeature = helper.getCacheFeature()

      // 浅克隆数组
      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'shallow' }
      )

      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'shallow' }
      )

      expect(result1).not.toBe(result2) // 不同的数组实例
      expect((result1 as any)[0]).toBe((result2 as any)[0]) // 但数组元素是相同的引用
    })
  })

  describe('自定义缓存键', () => {
    it('should use custom cache key when provided', async () => {
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)
      const cacheFeature = helper.getCacheFeature()

      // 使用自定义键的请求
      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.CUSTOM_KEY
      )

      // 相同URL但不使用自定义键的请求
      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result1).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(result2).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      // 应该发起两次请求，因为使用了不同的缓存键
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(2)
    })

    it('should reuse cache with same custom key', async () => {
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)
      const cacheFeature = helper.getCacheFeature()

      // 两个不同URL但使用相同自定义键
      const result1 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.CUSTOM_KEY
      )

      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID, // 不同的URL
        CACHE_TEST_CONFIGS.CUSTOM_KEY // 但相同的自定义键
      )

      expect(result1).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(result2).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      // 应该只发起一次请求，因为使用了相同的自定义键
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(1)
    })
  })

  describe('缓存清除功能', () => {
    beforeEach(async () => {
      // 预先添加一些缓存项
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)
      const cacheFeature = helper.getCacheFeature()

      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USER_BY_ID,
        CACHE_TEST_CONFIGS.BASIC
      )
    })

    it('should clear specific cache item by key', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 验证缓存存在
      let keys = await helper.getAllCacheKeys()
      expect(keys.length).toBeGreaterThan(0)

      // 清除特定键的缓存
      const firstKey = keys[0]
      await cacheFeature.clearCache(firstKey)

      // 验证特定键被清除
      const exists = await helper.verifyCacheExists(firstKey)
      expect(exists).toBe(false)

      // 验证其他键仍然存在
      keys = await helper.getAllCacheKeys()
      expect(keys.length).toBe(1)
    })

    it('should clear all cache items when no key provided', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 验证缓存存在
      let keys = await helper.getAllCacheKeys()
      expect(keys.length).toBeGreaterThan(0)

      // 清除所有缓存
      await cacheFeature.clearCache()

      // 验证所有缓存被清除
      keys = await helper.getAllCacheKeys()
      expect(keys.length).toBe(0)
    })

    it('should handle clearing non-existent key gracefully', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 尝试清除不存在的键，不应该抛出错误
      await expect(cacheFeature.clearCache('non-existent-key')).resolves.toBeUndefined()
    })
  })

  describe('缓存统计信息', () => {
    it('should return correct cache statistics', async () => {
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)
      const cacheFeature = helper.getCacheFeature()

      // 添加一些缓存项
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      const stats = await cacheFeature.getCacheStats()

      expectCacheStats(stats, {
        size: 1,
        maxEntries: 1000,
        cleanupInterval: 5 * 60 * 1000
      })

      expect(stats.keyGeneratorStats).toBeDefined()
      expect(stats.lastCleanup).toBeDefined()
      expect(stats.storageType).toBeDefined()
    })

    it('should update statistics after cache operations', async () => {
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)
      const cacheFeature = helper.getCacheFeature()

      // 初始统计
      let stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { size: 0 })

      // 添加缓存项
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { size: 1 })

      // 清除缓存
      await cacheFeature.clearCache()

      stats = await cacheFeature.getCacheStats()
      expectCacheStats(stats, { size: 0 })
    })
  })
})
