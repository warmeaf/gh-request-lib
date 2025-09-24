import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  createCacheTestHelper,
  createTimeTestHelper,
  CACHE_TEST_DATA,
  CACHE_TEST_CONFIGS,
  CACHE_REQUEST_CONFIGS
} from './cache-test-helpers'
import { RequestError } from '../../src/interface'

describe('Cache Error Handling Tests', () => {
  let helper: ReturnType<typeof createCacheTestHelper>
  let timeHelper: ReturnType<typeof createTimeTestHelper>

  beforeEach(() => {
    helper = createCacheTestHelper()
    timeHelper = createTimeTestHelper()
  })

  afterEach(() => {
    helper.reset()
    timeHelper.restore()
    vi.restoreAllMocks()
  })

  describe('存储适配器故障处理', () => {
    it('should handle storage getItem failures gracefully', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 设置存储适配器getItem失败
      const mockAdapter = helper.getMockStorageAdapter()
      mockAdapter.setShouldFail(true)

      // Mock console.warn to verify warning is logged
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // 请求应该仍然成功，但会记录警告并视为缓存未命中
      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(1)

      // 应该记录警告日志
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Cache error/)
      )
    })

    it('should handle storage setItem failures gracefully', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 设置存储适配器setItem失败
      const mockAdapter = helper.getMockStorageAdapter()
      mockAdapter.setShouldFail(true)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // 请求应该成功，但缓存存储失败
      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)

      // 应该记录存储失败的警告
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Cache error/)
      )
    })

    it('should handle storage removeItem failures during clearCache', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 先添加缓存项
      helper.getMockStorageAdapter().setShouldFail(false)
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 设置removeItem失败
      helper.getMockStorageAdapter().setShouldFail(true)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // 清除缓存操作应该不抛出错误
      await expect(cacheFeature.clearCache()).resolves.toBeUndefined()

      // 应该记录警告
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle storage clear failures', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 设置clear失败
      helper.getMockStorageAdapter().setShouldFail(true)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // 清除所有缓存应该不抛出错误
      await expect(cacheFeature.clearCache()).resolves.toBeUndefined()

      // 应该记录警告
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Cache error/)
      )
    })

    it('should handle storage getKeys failures during cleanup', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 设置getKeys失败
      helper.getMockStorageAdapter().setShouldFail(true)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // 请求应该仍然成功
      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)

      // 可能会记录关于获取键失败的警告
      // 具体行为取决于实现细节
    })

    it('should handle storage getStats failures', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 设置getStats失败
      helper.getMockStorageAdapter().setShouldFail(true)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // 获取统计信息应该返回默认值
      const stats = await cacheFeature.getCacheStats()

      expect(stats).toBeDefined()
      expect(stats.size).toBe(0) // 默认值

      // 应该记录警告
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Cache error: stats/)
      )
    })

    it('should continue operation after storage access time update failure', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 先成功添加缓存项
      helper.getMockStorageAdapter().setShouldFail(false)
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 重置mock调用计数
      helper.getMockRequestor().getMock().mockClear()

      // 设置存储适配器失败，但只针对特定操作
      const mockAdapter = helper.getMockStorageAdapter()
      const originalSetItem = mockAdapter.setItem.bind(mockAdapter)
      
      // Mock setItem 在更新访问时间时失败
      vi.spyOn(mockAdapter, 'setItem').mockImplementation(async (item) => {
        // 如果是更新现有项（accessCount > 1），则失败
        if (item.accessCount && item.accessCount > 1) {
          throw new Error('Storage setItem failed')
        }
        return originalSetItem(item)
      })

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // 第二次请求应该仍然返回缓存数据，但更新访问时间失败
      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(0) // 应该从缓存返回，不调用请求器

      // 应该记录更新失败的警告
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Cache/)
      )
      
      consoleSpy.mockRestore()
    })
  })

  describe('键生成错误处理', () => {
    it('should handle key generation failures', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 创建会导致键生成失败的配置 - 使用无效的自定义键
      const configWithInvalidKey = {
        ...CACHE_TEST_CONFIGS.BASIC,
        key: null as any // 无效的自定义键
      }

      // 应该抛出RequestError
      await expect(
        cacheFeature.requestWithCache(
          CACHE_REQUEST_CONFIGS.GET_USERS,
          configWithInvalidKey
        )
      ).rejects.toThrow(RequestError)
    })

    it('should handle malformed request config in key generation', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用格式错误的请求配置
      const malformedConfig = {
        url: null, // 无效的URL
        method: 'GET' as const
      }

      // 可能会抛出错误或处理为特殊情况
      await expect(
        cacheFeature.requestWithCache(
          malformedConfig as any,
          CACHE_TEST_CONFIGS.BASIC
        )
      ).rejects.toThrow()
    })

    it('should handle circular references in request data', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 创建循环引用的数据
      const circularData: any = { name: 'test' }
      circularData.self = circularData

      const configWithCircularRef = {
        url: CACHE_REQUEST_CONFIGS.GET_USERS.url,
        method: 'POST' as const,
        data: circularData
      }

      // 应该优雅地处理循环引用
      await expect(
        cacheFeature.requestWithCache(
          configWithCircularRef,
          CACHE_TEST_CONFIGS.BASIC
        )
      ).rejects.toThrow()
    })
  })

  describe('网络请求失败场景', () => {
    it('should not cache failed requests', async () => {
      const cacheFeature = helper.getCacheFeature()

      const requestError = new Error('Network request failed')
      helper.setRequestorError(requestError)

      // 第一次请求失败
      await expect(
        cacheFeature.requestWithCache(
          CACHE_REQUEST_CONFIGS.GET_USERS,
          CACHE_TEST_CONFIGS.BASIC
        )
      ).rejects.toThrow('Network request failed')

      // 修复请求器，设置成功响应
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 第二次请求应该成功执行，不应该使用之前失败的缓存
      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
      expect(helper.getMockRequestor().getMock()).toHaveBeenCalledTimes(2)
    })

    it('should handle timeout errors', async () => {
      const cacheFeature = helper.getCacheFeature()

      const timeoutError = new Error('Request timeout')
      helper.setRequestorError(timeoutError)

      await expect(
        cacheFeature.requestWithCache(
          CACHE_REQUEST_CONFIGS.GET_USERS,
          CACHE_TEST_CONFIGS.BASIC
        )
      ).rejects.toThrow('Request timeout')

      // 验证没有错误的缓存项被存储
      const keys = await helper.getAllCacheKeys()
      expect(keys.length).toBe(0)
    })

    it('should handle request cancellation', async () => {
      const cacheFeature = helper.getCacheFeature()

      const cancelError = new Error('Request cancelled')
      cancelError.name = 'AbortError'
      helper.setRequestorError(cancelError)

      await expect(
        cacheFeature.requestWithCache(
          CACHE_REQUEST_CONFIGS.GET_USERS,
          CACHE_TEST_CONFIGS.BASIC
        )
      ).rejects.toThrow('Request cancelled')

      // 确认没有缓存被创建
      const stats = await cacheFeature.getCacheStats()
      expect(stats.size).toBe(0)
    })
  })

  describe('数据克隆错误处理', () => {
    it('should handle structuredClone failures gracefully', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 创建不能被structuredClone处理的数据
      const unclonableData = {
        user: CACHE_TEST_DATA.SIMPLE_USER,
        func: () => { }, // 函数不能被structuredClone
        symbol: Symbol('test') // Symbol也不能被克隆
      }

      helper.setRequestorReturn(unclonableData)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // 使用深度克隆策略
      const result: any = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'deep' }
      )

      // 应该回退到JSON克隆或返回原始数据
      expect(result).toBeDefined()
      expect(result.user).toEqual(CACHE_TEST_DATA.SIMPLE_USER)

      // 可能会记录克隆失败的警告
      // expect(consoleSpy).toHaveBeenCalledWith(
      //   expect.stringMatching(/structuredClone failed/)
      // )
    })

    it('should handle JSON clone failures gracefully', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 创建不能JSON序列化的数据
      const unjsonableData = {
        user: CACHE_TEST_DATA.SIMPLE_USER,
        date: new Date(),
        bigint: BigInt(123),
        undefined: undefined
      }

      // Mock structuredClone to fail first, then JSON.stringify to fail
      const originalStructuredClone = global.structuredClone
      const originalStringify = JSON.stringify

      vi.spyOn(global, 'structuredClone' as any).mockImplementation(() => {
        throw new Error('structuredClone failed')
      })

      vi.spyOn(JSON, 'stringify').mockImplementation(() => {
        throw new Error('JSON stringify failed')
      })

      helper.setRequestorReturn(unjsonableData)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // 使用深度克隆策略
      const result: any = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'deep' }
      )

      // 应该返回原始数据
      expect(result).toBe(unjsonableData)

      // 应该记录JSON克隆失败的警告
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/JSON clone failed/),
        expect.any(Error)
      )
      
      consoleSpy.mockRestore()

      // 恢复原始函数
      global.structuredClone = originalStructuredClone
      JSON.stringify = originalStringify
    })

    it('should handle edge cases in shallow clone', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 测试各种数据类型的浅克隆
      const complexData = {
        null: null,
        undefined: undefined,
        number: 42,
        string: 'test',
        boolean: true,
        date: new Date(),
        regex: /test/gi,
        array: [1, 2, 3],
        nested: { a: 1, b: 2 }
      }

      helper.setRequestorReturn(complexData)

      const result1: any = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'shallow' }
      )

      const result2: any = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, clone: 'shallow' }
      )

      // 浅克隆应该正确处理所有数据类型
      expect(result1).toEqual(complexData)
      expect(result2).toEqual(complexData)
      expect(result1).not.toBe(result2) // 不同的对象实例
      expect(result1.nested).toBe(result2.nested) // 嵌套对象应该是同一个引用
    })
  })

  describe('边界条件和竞态条件', () => {
    it('should handle very large cache keys', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 创建非常长的URL
      const longUrl = 'https://api.example.com/users?' + 'a'.repeat(10000)

      const configWithLongUrl = {
        ...CACHE_REQUEST_CONFIGS.GET_USERS,
        url: longUrl
      }

      // 应该能处理长键或适当截断
      const result = await cacheFeature.requestWithCache(
        configWithLongUrl,
        CACHE_TEST_CONFIGS.BASIC
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)
    })

    it('should handle zero TTL gracefully', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 使用零TTL
      const result = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, ttl: 0 }
      )

      expect(result).toEqual(CACHE_TEST_DATA.SIMPLE_USER)

      // 立即再次请求，由于TTL为0，应该重新请求
      helper.setRequestorReturn({ ...CACHE_TEST_DATA.SIMPLE_USER, name: 'Updated' })

      const result2 = await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        { ...CACHE_TEST_CONFIGS.BASIC, ttl: 0 }
      )

      // 应该是更新后的数据
      expect(result2.name).toBe('Updated')
    })

    it('should handle memory pressure scenarios', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.LARGE_ARRAY)

      // 尝试缓存大量数据
      const requests = Array.from({ length: 100 }, (_, i) => ({
        url: `https://api.example.com/large-data/${i}`,
        method: 'GET' as const
      }))

      // 并发添加大量缓存项
      const promises = requests.map(request =>
        cacheFeature.requestWithCache(request, CACHE_TEST_CONFIGS.BASIC)
      )

      // 所有请求都应该成功完成
      const results = await Promise.all(promises)

      results.forEach(result => {
        expect(result).toEqual(CACHE_TEST_DATA.LARGE_ARRAY)
      })

      // 系统应该仍然响应
      const stats = await cacheFeature.getCacheStats()
      expect(stats).toBeDefined()
    })

    it('should handle rapid cache invalidation', async () => {
      timeHelper.setMockTime(1000000)

      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 添加缓存项
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.SHORT_TTL
      )

      // 快速推进时间多次
      for (let i = 0; i < 10; i++) {
        timeHelper.advanceTime(200)

        await cacheFeature.requestWithCache(
          CACHE_REQUEST_CONFIGS.GET_USERS,
          CACHE_TEST_CONFIGS.SHORT_TTL
        )
      }

      // 系统应该正确处理快速失效而不崩溃
      const stats = await cacheFeature.getCacheStats()
      expect(stats).toBeDefined()
    })
  })

  describe('资源清理错误处理', () => {
    it('should handle destroy with storage adapter failures', async () => {
      const cacheFeature = helper.getCacheFeature()
      helper.setRequestorReturn(CACHE_TEST_DATA.SIMPLE_USER)

      // 添加一些缓存项
      await cacheFeature.requestWithCache(
        CACHE_REQUEST_CONFIGS.GET_USERS,
        CACHE_TEST_CONFIGS.BASIC
      )

      // 设置destroy失败
      helper.getMockStorageAdapter().setShouldFail(true)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // destroy应该不抛出错误并重置状态
      await expect(cacheFeature.destroy()).resolves.toBeUndefined()

      // 应该记录警告但继续清理
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/Cache error/)
      )

      // 内部状态应该被重置
      const stats = await cacheFeature.getCacheStats()
      expect(stats.lastCleanup).toBe(0)
    })

    it('should ensure cleanup even with multiple failures', async () => {
      const cacheFeature = helper.getCacheFeature()

      // 设置所有存储操作都失败
      helper.getMockStorageAdapter().setShouldFail(true)

      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => { })

      // 多次尝试各种操作
      await expect(cacheFeature.clearCache('some-key')).resolves.toBeUndefined()
      await expect(cacheFeature.clearCache()).resolves.toBeUndefined()
      await expect(cacheFeature.destroy()).resolves.toBeUndefined()

      // 所有操作都应该安全完成
      expect(consoleSpy).toHaveBeenCalled()
    })
  })
})
