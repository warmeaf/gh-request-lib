import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  LRUInvalidationPolicy,
  CacheInvalidationPolicy
} from '../../src/cache'
import {
  createTimeTestHelper,
  CACHE_TEST_DATA
} from './cache-test-helpers'

describe('Cache Invalidation Policy Tests', () => {
  let timeHelper: ReturnType<typeof createTimeTestHelper>

  beforeEach(() => {
    timeHelper = createTimeTestHelper()
  })

  afterEach(() => {
    timeHelper.restore()
  })

  describe('CacheInvalidationPolicy Interface', () => {
    class TestInvalidationPolicy implements CacheInvalidationPolicy {
      shouldInvalidate(item: any, currentTime: number): boolean {
        // 简单的TTL检查
        return currentTime - item.timestamp > item.ttl
      }

      updateItemOnAccess(item: any, currentTime: number): void {
        item.accessTime = currentTime
        item.accessCount = (item.accessCount || 0) + 1
      }
    }

    it('should implement required interface methods', () => {
      const policy = new TestInvalidationPolicy()
      
      expect(typeof policy.shouldInvalidate).toBe('function')
      expect(typeof policy.updateItemOnAccess).toBe('function')
    })

    it('should correctly validate items based on TTL', () => {
      timeHelper.setMockTime(1000000) // 基准时间
      
      const policy = new TestInvalidationPolicy()
      
      const validItem = {
        key: 'valid-item',
        data: CACHE_TEST_DATA.SIMPLE_USER,
        timestamp: timeHelper.getCurrentTime() - 1000, // 1秒前创建
        ttl: 5000, // 5秒TTL
        accessTime: timeHelper.getCurrentTime(),
        accessCount: 1
      }

      const expiredItem = {
        key: 'expired-item',
        data: CACHE_TEST_DATA.SIMPLE_USER,
        timestamp: timeHelper.getCurrentTime() - 6000, // 6秒前创建
        ttl: 5000, // 5秒TTL
        accessTime: timeHelper.getCurrentTime(),
        accessCount: 1
      }

      expect(policy.shouldInvalidate(validItem, timeHelper.getCurrentTime())).toBe(false)
      expect(policy.shouldInvalidate(expiredItem, timeHelper.getCurrentTime())).toBe(true)
    })

    it('should update item access information', () => {
      timeHelper.setMockTime(1000000)
      
      const policy = new TestInvalidationPolicy()
      
      const item = {
        key: 'test-item',
        data: CACHE_TEST_DATA.SIMPLE_USER,
        timestamp: timeHelper.getCurrentTime(),
        ttl: 5000,
        accessTime: timeHelper.getCurrentTime() - 1000, // 1秒前访问
        accessCount: 3
      }

      // 模拟新的访问时间
      timeHelper.advanceTime(2000)
      policy.updateItemOnAccess(item, timeHelper.getCurrentTime())

      expect(item.accessTime).toBe(timeHelper.getCurrentTime())
      expect(item.accessCount).toBe(4)
    })
  })

  describe('LRUInvalidationPolicy', () => {
    let lruPolicy: LRUInvalidationPolicy

    beforeEach(() => {
      lruPolicy = new LRUInvalidationPolicy()
    })

    describe('基本LRU功能', () => {
      it('should invalidate items based on TTL', () => {
        timeHelper.setMockTime(1000000)

        const item = {
          key: 'ttl-test',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 5000, // 5秒TTL
          accessTime: timeHelper.getCurrentTime(),
          accessCount: 1
        }

        // 时间未超过TTL，应该有效
        expect(lruPolicy.shouldInvalidate(item, timeHelper.getCurrentTime())).toBe(false)

        // 时间超过TTL，应该无效
        timeHelper.advanceTime(6000)
        expect(lruPolicy.shouldInvalidate(item, timeHelper.getCurrentTime())).toBe(true)
      })

      it('should handle zero TTL items', () => {
        timeHelper.setMockTime(1000000)

        const zeroTTLItem = {
          key: 'zero-ttl',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 0,
          accessTime: timeHelper.getCurrentTime(),
          accessCount: 1
        }

        // TTL为0的项目应该立即过期
        expect(lruPolicy.shouldInvalidate(zeroTTLItem, timeHelper.getCurrentTime())).toBe(true)
      })

      it('should handle negative TTL items', () => {
        timeHelper.setMockTime(1000000)

        const negativeTTLItem = {
          key: 'negative-ttl',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: -1000,
          accessTime: timeHelper.getCurrentTime(),
          accessCount: 1
        }

        // 负TTL应该立即过期
        expect(lruPolicy.shouldInvalidate(negativeTTLItem, timeHelper.getCurrentTime())).toBe(true)
      })

      it('should handle very large TTL items', () => {
        timeHelper.setMockTime(1000000)

        const largeTTLItem = {
          key: 'large-ttl',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: Number.MAX_SAFE_INTEGER,
          accessTime: timeHelper.getCurrentTime(),
          accessCount: 1
        }

        // 很大的TTL应该不会过期
        timeHelper.advanceTime(1000000) // 前进很长时间
        expect(lruPolicy.shouldInvalidate(largeTTLItem, timeHelper.getCurrentTime())).toBe(false)
      })
    })

    describe('访问时间更新', () => {
      it('should update access time and count on access', () => {
        timeHelper.setMockTime(1000000)

        const item = {
          key: 'access-test',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 300000,
          accessTime: timeHelper.getCurrentTime() - 5000, // 5秒前访问
          accessCount: 2
        }

        // 模拟新的访问
        timeHelper.advanceTime(3000)
        const newAccessTime = timeHelper.getCurrentTime()
        
        lruPolicy.updateItemOnAccess(item, newAccessTime)

        expect(item.accessTime).toBe(newAccessTime)
        expect(item.accessCount).toBe(3)
      })

      it('should handle multiple rapid accesses', () => {
        timeHelper.setMockTime(1000000)

        const item = {
          key: 'rapid-access-test',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 300000,
          accessTime: timeHelper.getCurrentTime(),
          accessCount: 1
        }

        const initialAccessTime = item.accessTime
        const initialAccessCount = item.accessCount

        // 模拟快速多次访问
        for (let i = 0; i < 5; i++) {
          timeHelper.advanceTime(100)
          lruPolicy.updateItemOnAccess(item, timeHelper.getCurrentTime())
        }

        expect(item.accessTime).toBeGreaterThan(initialAccessTime)
        expect(item.accessCount).toBe(initialAccessCount + 5)
      })

      it('should handle concurrent access updates', () => {
        timeHelper.setMockTime(1000000)

        const item = {
          key: 'concurrent-test',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 300000,
          accessTime: timeHelper.getCurrentTime(),
          accessCount: 1
        }

        // 模拟并发访问（同一时间多次更新）
        const currentTime = timeHelper.getCurrentTime()
        lruPolicy.updateItemOnAccess(item, currentTime)
        lruPolicy.updateItemOnAccess(item, currentTime)
        lruPolicy.updateItemOnAccess(item, currentTime)

        expect(item.accessTime).toBe(currentTime)
        expect(item.accessCount).toBe(4) // 1 + 3
      })
    })

    describe('边界条件处理', () => {
      it('should handle malformed cache items', () => {
        timeHelper.setMockTime(1000000)

        // 缺少必要属性的项目
        const malformedItem1 = {
          key: 'malformed-1',
          data: CACHE_TEST_DATA.SIMPLE_USER
          // 缺少timestamp, ttl, accessTime, accessCount
        } as any

        const malformedItem2 = {
          key: 'malformed-2',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: null,
          ttl: undefined,
          accessTime: 'invalid',
          accessCount: 'invalid'
        } as any

        // 应该安全处理格式错误的项目，不抛出异常
        expect(() => {
          lruPolicy.shouldInvalidate(malformedItem1, timeHelper.getCurrentTime())
        }).not.toThrow()

        expect(() => {
          lruPolicy.shouldInvalidate(malformedItem2, timeHelper.getCurrentTime())
        }).not.toThrow()

        expect(() => {
          lruPolicy.updateItemOnAccess(malformedItem1, timeHelper.getCurrentTime())
        }).not.toThrow()

        expect(() => {
          lruPolicy.updateItemOnAccess(malformedItem2, timeHelper.getCurrentTime())
        }).not.toThrow()
      })

      it('should handle null and undefined items', () => {
        timeHelper.setMockTime(1000000)

        expect(() => {
          lruPolicy.shouldInvalidate(null as any, timeHelper.getCurrentTime())
        }).not.toThrow()

        expect(() => {
          lruPolicy.shouldInvalidate(undefined as any, timeHelper.getCurrentTime())
        }).not.toThrow()

        expect(() => {
          lruPolicy.updateItemOnAccess(null as any, timeHelper.getCurrentTime())
        }).not.toThrow()

        expect(() => {
          lruPolicy.updateItemOnAccess(undefined as any, timeHelper.getCurrentTime())
        }).not.toThrow()
      })

      it('should handle invalid timestamps', () => {
        timeHelper.setMockTime(1000000)

        const itemWithInvalidTimestamp = {
          key: 'invalid-timestamp',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: NaN,
          ttl: 5000,
          accessTime: timeHelper.getCurrentTime(),
          accessCount: 1
        }

        // 应该安全处理无效的时间戳
        expect(() => {
          lruPolicy.shouldInvalidate(itemWithInvalidTimestamp, timeHelper.getCurrentTime())
        }).not.toThrow()

        const itemWithFutureTimestamp = {
          key: 'future-timestamp',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime() + 10000, // 未来时间
          ttl: 5000,
          accessTime: timeHelper.getCurrentTime(),
          accessCount: 1
        }

        // 未来时间戳的项目可能被认为是有效的
        expect(() => {
          lruPolicy.shouldInvalidate(itemWithFutureTimestamp, timeHelper.getCurrentTime())
        }).not.toThrow()
      })

      it('should handle extreme access counts', () => {
        timeHelper.setMockTime(1000000)

        const itemWithLargeCount = {
          key: 'large-count',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 300000,
          accessTime: timeHelper.getCurrentTime(),
          accessCount: Number.MAX_SAFE_INTEGER - 1
        }

        // 更新访问计数应该安全处理大数值
        lruPolicy.updateItemOnAccess(itemWithLargeCount, timeHelper.getCurrentTime())
        
        expect(itemWithLargeCount.accessCount).toBe(Number.MAX_SAFE_INTEGER)
      })
    })

    describe('时间精度和稳定性', () => {
      it('should handle microsecond precision timestamps', () => {
        // 使用高精度时间戳
        const highPrecisionTime = performance.timeOrigin + performance.now()
        
        const item = {
          key: 'high-precision',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: highPrecisionTime,
          ttl: 1.5, // 1.5毫秒TTL
          accessTime: highPrecisionTime,
          accessCount: 1
        }

        // 应该能够处理高精度时间戳
        expect(lruPolicy.shouldInvalidate(item, highPrecisionTime)).toBe(false)
        expect(lruPolicy.shouldInvalidate(item, highPrecisionTime + 2)).toBe(true)
      })

      it('should handle clock drift and time adjustments', () => {
        timeHelper.setMockTime(1000000)

        const item = {
          key: 'clock-drift',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 5000,
          accessTime: timeHelper.getCurrentTime(),
          accessCount: 1
        }

        // 模拟时钟回调（当前时间小于项目时间戳）
        const pastTime = timeHelper.getCurrentTime() - 1000
        
        // 应该安全处理时钟回调情况
        expect(() => {
          lruPolicy.shouldInvalidate(item, pastTime)
        }).not.toThrow()

        expect(() => {
          lruPolicy.updateItemOnAccess(item, pastTime)
        }).not.toThrow()
      })

      it('should maintain consistency across multiple validations', () => {
        timeHelper.setMockTime(1000000)

        const item = {
          key: 'consistency-test',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 5000,
          accessTime: timeHelper.getCurrentTime(),
          accessCount: 1
        }

        const currentTime = timeHelper.getCurrentTime()

        // 多次验证同一项目应该返回一致的结果
        const result1 = lruPolicy.shouldInvalidate(item, currentTime)
        const result2 = lruPolicy.shouldInvalidate(item, currentTime)
        const result3 = lruPolicy.shouldInvalidate(item, currentTime)

        expect(result1).toBe(result2)
        expect(result2).toBe(result3)
      })
    })

    describe('LRU特定行为', () => {
      it('should prioritize recently accessed items', () => {
        timeHelper.setMockTime(1000000)

        const oldItem = {
          key: 'old-item',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 300000,
          accessTime: timeHelper.getCurrentTime() - 10000, // 10秒前访问
          accessCount: 5
        }

        const recentItem = {
          key: 'recent-item',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 300000,
          accessTime: timeHelper.getCurrentTime() - 1000, // 1秒前访问
          accessCount: 2
        }

        // 两个项目都应该有效（未过期）
        expect(lruPolicy.shouldInvalidate(oldItem, timeHelper.getCurrentTime())).toBe(false)
        expect(lruPolicy.shouldInvalidate(recentItem, timeHelper.getCurrentTime())).toBe(false)

        // LRU策略应该基于accessTime来判断哪个更应该被保留
        // 这里我们验证accessTime被正确更新
        const newAccessTime = timeHelper.getCurrentTime()
        lruPolicy.updateItemOnAccess(oldItem, newAccessTime)
        
        expect(oldItem.accessTime).toBe(newAccessTime)
        expect(oldItem.accessCount).toBe(6)
      })

      it('should handle items with same access time', () => {
        timeHelper.setMockTime(1000000)
        const sameAccessTime = timeHelper.getCurrentTime()

        const item1 = {
          key: 'item-1',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 300000,
          accessTime: sameAccessTime,
          accessCount: 1
        }

        const item2 = {
          key: 'item-2',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: timeHelper.getCurrentTime(),
          ttl: 300000,
          accessTime: sameAccessTime,
          accessCount: 1
        }

        // 相同访问时间的项目应该都被认为是有效的
        expect(lruPolicy.shouldInvalidate(item1, timeHelper.getCurrentTime())).toBe(false)
        expect(lruPolicy.shouldInvalidate(item2, timeHelper.getCurrentTime())).toBe(false)

        // 更新其中一个的访问时间
        timeHelper.advanceTime(1000)
        lruPolicy.updateItemOnAccess(item1, timeHelper.getCurrentTime())

        expect(item1.accessTime).toBeGreaterThan(item2.accessTime)
      })
    })

    describe('性能测试', () => {
      it('should handle large number of validations efficiently', () => {
        const items = Array.from({ length: 1000 }, (_, i) => ({
          key: `perf-item-${i}`,
          data: { id: i, value: `data-${i}` },
          timestamp: Date.now(),
          ttl: 300000,
          accessTime: Date.now(),
          accessCount: 1
        }))

        const startTime = performance.now()

        // 批量验证
        for (const item of items) {
          lruPolicy.shouldInvalidate(item, Date.now())
        }

        const validationTime = performance.now() - startTime

        console.log(`LRU validation time for 1000 items: ${validationTime}ms`)

        // 验证应该很快完成
        expect(validationTime).toBeLessThan(100) // 小于100ms
      })

      it('should handle frequent access updates efficiently', () => {
        const item = {
          key: 'frequent-access',
          data: CACHE_TEST_DATA.SIMPLE_USER,
          timestamp: Date.now(),
          ttl: 300000,
          accessTime: Date.now(),
          accessCount: 1
        }

        const startTime = performance.now()

        // 频繁访问更新
        for (let i = 0; i < 1000; i++) {
          lruPolicy.updateItemOnAccess(item, Date.now() + i)
        }

        const updateTime = performance.now() - startTime

        console.log(`LRU update time for 1000 access updates: ${updateTime}ms`)

        expect(updateTime).toBeLessThan(50) // 小于50ms
        expect(item.accessCount).toBe(1001)
      })
    })
  })

  describe('自定义失效策略示例', () => {
    class CustomInvalidationPolicy implements CacheInvalidationPolicy {
      private maxAccessCount: number
      private maxAge: number

      constructor(maxAccessCount = 100, maxAge = 24 * 60 * 60 * 1000) { // 24小时
        this.maxAccessCount = maxAccessCount
        this.maxAge = maxAge
      }

      shouldInvalidate(item: any, currentTime: number): boolean {
        if (!item) return true

        // TTL检查
        if (item.ttl && currentTime - item.timestamp > item.ttl) {
          return true
        }

        // 最大年龄检查
        if (currentTime - item.timestamp > this.maxAge) {
          return true
        }

        // 最大访问次数检查
        if (item.accessCount > this.maxAccessCount) {
          return true
        }

        return false
      }

      updateItemOnAccess(item: any, currentTime: number): void {
        if (!item) return

        item.accessTime = currentTime
        item.accessCount = (item.accessCount || 0) + 1
      }
    }

    it('should work with custom invalidation logic', () => {
      timeHelper.setMockTime(1000000)
      
      const customPolicy = new CustomInvalidationPolicy(5, 10000) // 5次访问，10秒最大年龄

      const item = {
        key: 'custom-test',
        data: CACHE_TEST_DATA.SIMPLE_USER,
        timestamp: timeHelper.getCurrentTime(),
        ttl: 300000, // 很长的TTL
        accessTime: timeHelper.getCurrentTime(),
        accessCount: 1
      }

      // 初始状态应该有效
      expect(customPolicy.shouldInvalidate(item, timeHelper.getCurrentTime())).toBe(false)

      // 访问多次直到达到限制
      for (let i = 0; i < 5; i++) {
        customPolicy.updateItemOnAccess(item, timeHelper.getCurrentTime())
      }

      // 达到访问次数限制后应该失效
      expect(customPolicy.shouldInvalidate(item, timeHelper.getCurrentTime())).toBe(true)
    })

    it('should handle age-based invalidation', () => {
      timeHelper.setMockTime(1000000)
      
      const customPolicy = new CustomInvalidationPolicy(100, 5000) // 100次访问，5秒最大年龄

      const item = {
        key: 'age-test',
        data: CACHE_TEST_DATA.SIMPLE_USER,
        timestamp: timeHelper.getCurrentTime(),
        ttl: 300000,
        accessTime: timeHelper.getCurrentTime(),
        accessCount: 1
      }

      // 时间前进但未超过最大年龄
      timeHelper.advanceTime(3000)
      expect(customPolicy.shouldInvalidate(item, timeHelper.getCurrentTime())).toBe(false)

      // 时间前进超过最大年龄
      timeHelper.advanceTime(3000)
      expect(customPolicy.shouldInvalidate(item, timeHelper.getCurrentTime())).toBe(true)
    })
  })
})
