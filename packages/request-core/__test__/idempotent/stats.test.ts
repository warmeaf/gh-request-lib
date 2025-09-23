import { describe, it, expect } from 'vitest'
import { 
  createInitialStats, 
  withDuplicateRate, 
  updateAvgResponseTime, 
  updateAvgKeyGenTime 
} from '../../src/features/idempotent/stats'
import { IdempotentStats } from '../../src/interface'

describe('IdempotentFeature Stats', () => {
  describe('createInitialStats', () => {
    it('应该创建具有正确初始值的统计对象', () => {
      const stats = createInitialStats()
      
      expect(stats).toEqual({
        totalRequests: 0,
        duplicatesBlocked: 0,
        pendingRequestsReused: 0,
        cacheHits: 0,
        actualNetworkRequests: 0,
        duplicateRate: 0,
        avgResponseTime: 0,
        keyGenerationTime: 0
      })
    })

    it('应该创建独立的统计对象实例', () => {
      const stats1 = createInitialStats()
      const stats2 = createInitialStats()
      
      expect(stats1).not.toBe(stats2)
      expect(stats1).toEqual(stats2)
      
      // 修改一个不应该影响另一个
      stats1.totalRequests = 5
      expect(stats2.totalRequests).toBe(0)
    })

    it('应该包含所有必需的统计字段', () => {
      const stats = createInitialStats()
      
      const expectedFields = [
        'totalRequests',
        'duplicatesBlocked',
        'pendingRequestsReused',
        'cacheHits',
        'actualNetworkRequests',
        'duplicateRate',
        'avgResponseTime',
        'keyGenerationTime'
      ]
      
      expectedFields.forEach(field => {
        expect(stats).toHaveProperty(field)
        expect(typeof stats[field as keyof IdempotentStats]).toBe('number')
      })
    })
  })

  describe('withDuplicateRate', () => {
    it('应该正确计算重复率 - 无请求情况', () => {
      const stats = createInitialStats()
      const result = withDuplicateRate(stats)
      
      expect(result.duplicateRate).toBe(0)
      expect(result).not.toBe(stats) // 应该返回新对象
    })

    it('应该正确计算重复率 - 有重复的情况', () => {
      const stats = createInitialStats()
      stats.totalRequests = 10
      stats.duplicatesBlocked = 3
      
      const result = withDuplicateRate(stats)
      
      expect(result.duplicateRate).toBe(30) // (3/10) * 100 = 30%
      expect(result.totalRequests).toBe(10)
      expect(result.duplicatesBlocked).toBe(3)
    })

    it('应该正确计算重复率 - 无重复的情况', () => {
      const stats = createInitialStats()
      stats.totalRequests = 5
      stats.duplicatesBlocked = 0
      
      const result = withDuplicateRate(stats)
      
      expect(result.duplicateRate).toBe(0) // (0/5) * 100 = 0%
    })

    it('应该正确计算重复率 - 全部重复的情况', () => {
      const stats = createInitialStats()
      stats.totalRequests = 4
      stats.duplicatesBlocked = 3 // 4个请求中3个是重复的
      
      const result = withDuplicateRate(stats)
      
      expect(result.duplicateRate).toBe(75) // (3/4) * 100 = 75%
    })

    it('应该处理小数重复率', () => {
      const stats = createInitialStats()
      stats.totalRequests = 3
      stats.duplicatesBlocked = 1
      
      const result = withDuplicateRate(stats)
      
      expect(result.duplicateRate).toBeCloseTo(33.33, 2) // (1/3) * 100 ≈ 33.33%
    })

    it('应该保持其他统计字段不变', () => {
      const stats = createInitialStats()
      stats.totalRequests = 10
      stats.duplicatesBlocked = 2
      stats.cacheHits = 5
      stats.actualNetworkRequests = 8
      stats.avgResponseTime = 150
      stats.keyGenerationTime = 5
      
      const result = withDuplicateRate(stats)
      
      expect(result.totalRequests).toBe(10)
      expect(result.duplicatesBlocked).toBe(2)
      expect(result.cacheHits).toBe(5)
      expect(result.actualNetworkRequests).toBe(8)
      expect(result.avgResponseTime).toBe(150)
      expect(result.keyGenerationTime).toBe(5)
      expect(result.duplicateRate).toBe(20)
    })

    it('应该处理边界值', () => {
      const stats = createInitialStats()
      
      // 测试很大的数值
      stats.totalRequests = 1000000
      stats.duplicatesBlocked = 333333
      
      const result = withDuplicateRate(stats)
      
      expect(result.duplicateRate).toBeCloseTo(33.3333, 4)
    })
  })

  describe('updateAvgResponseTime', () => {
    it('应该正确更新第一个响应时间', () => {
      const stats = createInitialStats()
      stats.totalRequests = 1
      
      updateAvgResponseTime(stats, 100)
      
      expect(stats.avgResponseTime).toBe(100)
    })

    it('应该正确计算多个响应时间的平均值', () => {
      const stats = createInitialStats()
      
      // 第一个请求: 100ms
      stats.totalRequests = 1
      updateAvgResponseTime(stats, 100)
      expect(stats.avgResponseTime).toBe(100)
      
      // 第二个请求: 200ms, 平均应该是150ms
      stats.totalRequests = 2
      updateAvgResponseTime(stats, 200)
      expect(stats.avgResponseTime).toBe(150)
      
      // 第三个请求: 300ms, 平均应该是200ms
      stats.totalRequests = 3
      updateAvgResponseTime(stats, 300)
      expect(stats.avgResponseTime).toBe(200)
    })

    it('应该处理零响应时间', () => {
      const stats = createInitialStats()
      stats.totalRequests = 1
      
      updateAvgResponseTime(stats, 0)
      
      expect(stats.avgResponseTime).toBe(0)
    })

    it('应该处理非常大的响应时间', () => {
      const stats = createInitialStats()
      stats.totalRequests = 1
      
      const largeTime = 999999
      updateAvgResponseTime(stats, largeTime)
      
      expect(stats.avgResponseTime).toBe(largeTime)
    })

    it('应该处理小数响应时间', () => {
      const stats = createInitialStats()
      
      stats.totalRequests = 1
      updateAvgResponseTime(stats, 100.5)
      expect(stats.avgResponseTime).toBe(100.5)
      
      stats.totalRequests = 2
      updateAvgResponseTime(stats, 200.5)
      expect(stats.avgResponseTime).toBe(150.5)
    })

    it('应该正确处理复杂的平均值计算', () => {
      const stats = createInitialStats()
      const responseTimes = [50, 100, 150, 200, 250]
      
      for (let i = 0; i < responseTimes.length; i++) {
        stats.totalRequests = i + 1
        updateAvgResponseTime(stats, responseTimes[i])
      }
      
      // 手动计算期望的平均值
      const expectedAvg = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length
      expect(stats.avgResponseTime).toBeCloseTo(expectedAvg, 10)
    })

    it('应该直接修改传入的统计对象', () => {
      const stats = createInitialStats()
      stats.totalRequests = 1  // 修复：改为第一个请求
      const originalStats = stats
      
      updateAvgResponseTime(stats, 100)
      
      expect(stats).toBe(originalStats) // 同一个对象引用
      expect(stats.avgResponseTime).toBe(100)
    })
  })

  describe('updateAvgKeyGenTime', () => {
    it('应该正确更新第一个键生成时间', () => {
      const stats = createInitialStats()
      stats.totalRequests = 1
      
      updateAvgKeyGenTime(stats, 10)
      
      expect(stats.keyGenerationTime).toBe(10)
    })

    it('应该正确计算多个键生成时间的平均值', () => {
      const stats = createInitialStats()
      
      // 第一个请求: 5ms
      stats.totalRequests = 1
      updateAvgKeyGenTime(stats, 5)
      expect(stats.keyGenerationTime).toBe(5)
      
      // 第二个请求: 15ms, 平均应该是10ms
      stats.totalRequests = 2
      updateAvgKeyGenTime(stats, 15)
      expect(stats.keyGenerationTime).toBe(10)
      
      // 第三个请求: 30ms, 平均应该是 (5+15+30)/3 = 50/3 ≈ 16.67ms
      stats.totalRequests = 3
      updateAvgKeyGenTime(stats, 30)
      expect(stats.keyGenerationTime).toBeCloseTo(16.67, 2)
    })

    it('应该处理零键生成时间', () => {
      const stats = createInitialStats()
      stats.totalRequests = 1
      
      updateAvgKeyGenTime(stats, 0)
      
      expect(stats.keyGenerationTime).toBe(0)
    })

    it('应该处理非常小的键生成时间', () => {
      const stats = createInitialStats()
      stats.totalRequests = 1
      
      updateAvgKeyGenTime(stats, 0.1)
      
      expect(stats.keyGenerationTime).toBe(0.1)
    })

    it('应该处理较大的键生成时间', () => {
      const stats = createInitialStats()
      stats.totalRequests = 1
      
      updateAvgKeyGenTime(stats, 1000)
      
      expect(stats.keyGenerationTime).toBe(1000)
    })

    it('应该正确处理多次更新的情况', () => {
      const stats = createInitialStats()
      const keyGenTimes = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]
      
      for (let i = 0; i < keyGenTimes.length; i++) {
        stats.totalRequests = i + 1
        updateAvgKeyGenTime(stats, keyGenTimes[i])
      }
      
      // 1到10的平均值是5.5
      expect(stats.keyGenerationTime).toBe(5.5)
    })

    it('应该直接修改传入的统计对象', () => {
      const stats = createInitialStats()
      stats.totalRequests = 1  // 修复：改为第一个请求
      const originalStats = stats
      
      updateAvgKeyGenTime(stats, 5)
      
      expect(stats).toBe(originalStats) // 同一个对象引用
      expect(stats.keyGenerationTime).toBe(5)
    })
  })

  describe('统计函数集成测试', () => {
    it('应该支持同时更新多种统计信息', () => {
      const stats = createInitialStats()
      
      // 模拟第一个请求
      stats.totalRequests = 1
      stats.actualNetworkRequests = 1
      updateAvgResponseTime(stats, 100)
      updateAvgKeyGenTime(stats, 5)
      
      let result = withDuplicateRate(stats)
      expect(result.duplicateRate).toBe(0)
      expect(result.avgResponseTime).toBe(100)
      expect(result.keyGenerationTime).toBe(5)
      
      // 模拟第二个请求（重复请求）
      stats.totalRequests = 2
      stats.duplicatesBlocked = 1
      updateAvgResponseTime(stats, 50) // 缓存命中，响应更快
      updateAvgKeyGenTime(stats, 3)
      
      result = withDuplicateRate(stats)
      expect(result.duplicateRate).toBe(50) // 1/2 = 50%
      expect(result.avgResponseTime).toBe(75) // (100+50)/2 = 75
      expect(result.keyGenerationTime).toBe(4) // (5+3)/2 = 4
    })

    it('应该处理复杂的实际使用场景', () => {
      const stats = createInitialStats()
      
      // 模拟10个请求的场景
      const scenarios = [
        { responseTime: 200, keyGenTime: 10, isDuplicate: false }, // 1. 新请求
        { responseTime: 50, keyGenTime: 8, isDuplicate: true },   // 2. 缓存命中
        { responseTime: 180, keyGenTime: 12, isDuplicate: false }, // 3. 新请求
        { responseTime: 45, keyGenTime: 7, isDuplicate: true },   // 4. 缓存命中
        { responseTime: 45, keyGenTime: 6, isDuplicate: true },   // 5. 缓存命中
        { responseTime: 220, keyGenTime: 15, isDuplicate: false }, // 6. 新请求
        { responseTime: 40, keyGenTime: 5, isDuplicate: true },   // 7. 缓存命中
        { responseTime: 190, keyGenTime: 11, isDuplicate: false }, // 8. 新请求
        { responseTime: 35, keyGenTime: 4, isDuplicate: true },   // 9. 缓存命中
        { responseTime: 42, keyGenTime: 6, isDuplicate: true },   // 10. 缓存命中
      ]
      
      scenarios.forEach((scenario, index) => {
        stats.totalRequests = index + 1
        
        if (scenario.isDuplicate) {
          stats.duplicatesBlocked++
          stats.cacheHits++
        } else {
          stats.actualNetworkRequests++
        }
        
        updateAvgResponseTime(stats, scenario.responseTime)
        updateAvgKeyGenTime(stats, scenario.keyGenTime)
      })
      
      const result = withDuplicateRate(stats)
      
      // 验证最终统计
      expect(result.totalRequests).toBe(10)
      expect(result.duplicatesBlocked).toBe(6)
      expect(result.cacheHits).toBe(6)
      expect(result.actualNetworkRequests).toBe(4)
      expect(result.duplicateRate).toBe(60) // 6/10 = 60%
      
      // 验证平均值计算
      const expectedAvgResponseTime = scenarios.reduce((sum, s) => sum + s.responseTime, 0) / 10
      const expectedAvgKeyGenTime = scenarios.reduce((sum, s) => sum + s.keyGenTime, 0) / 10
      
      expect(result.avgResponseTime).toBeCloseTo(expectedAvgResponseTime, 1)
      expect(result.keyGenerationTime).toBeCloseTo(expectedAvgKeyGenTime, 1)
    })

    it('应该保持统计对象的不可变性（withDuplicateRate）', () => {
      const originalStats = createInitialStats()
      originalStats.totalRequests = 5
      originalStats.duplicatesBlocked = 2
      
      const result = withDuplicateRate(originalStats)
      
      // 原对象不应该被修改
      expect(originalStats.duplicateRate).toBe(0)
      
      // 新对象应该有正确的重复率
      expect(result.duplicateRate).toBe(40)
      
      // 其他字段应该被复制
      expect(result.totalRequests).toBe(5)
      expect(result.duplicatesBlocked).toBe(2)
    })

    it('应该处理边界情况组合', () => {
      const stats = createInitialStats()
      
      // 只有一个请求的情况
      stats.totalRequests = 1
      stats.actualNetworkRequests = 1
      updateAvgResponseTime(stats, 0) // 零响应时间
      updateAvgKeyGenTime(stats, 0.001) // 很小的键生成时间
      
      const result = withDuplicateRate(stats)
      
      expect(result.duplicateRate).toBe(0)
      expect(result.avgResponseTime).toBe(0)
      expect(result.keyGenerationTime).toBe(0.001)
    })
  })
})
