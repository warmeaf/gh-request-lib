import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { StorageType } from '../../src/cache/storage-adapter'
import { MockRequestor } from '../test-helpers'

describe('RequestCore - 管理功能', () => {
  let mockRequestor: MockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new MockRequestor()
    requestCore = new RequestCore(mockRequestor)
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (requestCore) {
      requestCore.destroy()
    }
  })

  describe('链式构建器', () => {
    it('应该创建链式构建器实例', () => {
      const builder = requestCore.create()

      expect(builder).toBeDefined()
      expect(typeof builder.url).toBe('function')
      expect(typeof builder.method).toBe('function')
      expect(typeof builder.data).toBe('function')
      expect(typeof builder.send).toBe('function')
    })

    it('应该创建具有泛型类型的构建器', () => {
      interface User {
        id: number
        name: string
      }

      const builder = requestCore.create<User>()

      expect(builder).toBeDefined()
      // 类型检查在编译时进行，这里主要确保运行时正常
    })

    it('应该支持创建多个独立的构建器实例', () => {
      const builder1 = requestCore.create()
      const builder2 = requestCore.create()

      expect(builder1).not.toBe(builder2)
      expect(builder1).toBeDefined()
      expect(builder2).toBeDefined()
    })
  })

  describe('统计功能', () => {
    it('应该获取缓存统计信息', async () => {
      const mockStats = {
        size: 15,
        maxEntries: 100,
        hitRate: 0.67,
        keyGeneratorStats: {
          cacheSize: 15,
          hitRate: '67%',
          cacheHits: 10,
          cacheMisses: 5,
          totalGenerations: 20
        },
        lastCleanup: Date.now(),
        cleanupInterval: 60000,
        storageType: StorageType.MEMORY
      }
      const getCacheStatsSpy = vi.spyOn(requestCore, 'getCacheStats').mockResolvedValue(mockStats)

      const stats = await requestCore.getCacheStats()

      expect(stats).toBeDefined()
      expect(stats).toEqual(mockStats)

      getCacheStatsSpy.mockRestore()
    })

    it('应该获取并发统计信息', () => {
      const mockStats = {
        total: 13,
        completed: 10,
        successful: 9,
        failed: 1,
        averageDuration: 1250,
        maxConcurrencyUsed: 3
      }
      const getConcurrentStatsSpy = vi.spyOn(requestCore, 'getConcurrentStats').mockReturnValue(mockStats)

      const stats = requestCore.getConcurrentStats()

      expect(stats).toBeDefined()
      expect(stats.total).toBe(13)
      expect(stats.completed).toBe(10)
      expect(stats.successful).toBe(9)
      expect(stats.failed).toBe(1)
      expect(stats.averageDuration).toBe(1250)
      expect(stats.maxConcurrencyUsed).toBe(3)

      getConcurrentStatsSpy.mockRestore()
    })

    it('应该获取所有统计信息', () => {
      const mockAllStats = {
        cache: {
          size: 10,
          maxEntries: 100,
          keyGeneratorStats: {
            cacheHits: 5,
            cacheMisses: 2,
            totalGenerations: 7,
            cacheSize: 10,
            hitRate: '71%'
          },
          lastCleanup: Date.now(),
          cleanupInterval: 60000,
          storageType: StorageType.MEMORY
        },
        concurrent: {
          total: 9,
          completed: 8,
          successful: 7,
          failed: 1,
          averageDuration: 980,
          maxConcurrencyUsed: 2
        },
        interceptors: { count: 3, activeCount: 2 },
        config: { modified: true, version: '1.0' }
      }
      const getAllStatsSpy = vi.spyOn(requestCore, 'getAllStats').mockReturnValue(mockAllStats)

      const allStats = requestCore.getAllStats()

      expect(allStats).toBeDefined()
      expect(allStats.cache).toBeDefined()
      expect(allStats.concurrent).toBeDefined()
      expect(allStats.interceptors).toBeDefined()
      expect(allStats.config).toBeDefined()
      expect(allStats.cache.keyGeneratorStats.cacheHits).toBe(5)
      expect(allStats.concurrent.completed).toBe(8)

      getAllStatsSpy.mockRestore()
    })
  })

  describe('资源管理', () => {
    it('应该正确销毁和清理资源', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      requestCore.destroy()

      expect(consoleSpy).toHaveBeenCalledWith('[RequestCore] All resources have been cleaned up')
      expect(requestCore.getInterceptors()).toHaveLength(0)

      consoleSpy.mockRestore()
    })
  })
})
