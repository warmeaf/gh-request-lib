import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConcurrentFeature } from '../../src/features/concurrent'
import { ResultCollector } from '../../src/features/concurrent/collector'
import { Semaphore } from '../../src/features/concurrent/semaphore'
import {
  ConcurrentMockRequestor,
  ConcurrentTestDataGenerator,
  ConcurrentTestAssertions,
  ConcurrentPerformanceHelper,
  MockConcurrentNetworkError
} from './concurrent-test-helpers'

describe('ConcurrentFeature - 高级功能测试', () => {
  let mockRequestor: ConcurrentMockRequestor
  let concurrentFeature: ConcurrentFeature

  beforeEach(() => {
    mockRequestor = new ConcurrentMockRequestor()
    concurrentFeature = new ConcurrentFeature(mockRequestor)
  })

  describe('ConcurrentStats 统计信息', () => {
    it('应该正确收集并发执行统计信息', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(6)
      mockRequestor.setGlobalDelay(80)

      await concurrentFeature.requestConcurrent(configs, { maxConcurrency: 3 })

      const stats = concurrentFeature.getConcurrentStats()
      
      expect(stats.total).toBe(6)
      expect(stats.completed).toBe(6)
      expect(stats.successful).toBe(6)
      expect(stats.failed).toBe(0)
      expect(stats.averageDuration).toBeGreaterThan(70)
      expect(stats.averageDuration).toBeLessThan(100)
      expect(stats.maxConcurrencyUsed).toBe(3)
    })

    it('应该正确统计成功和失败的请求', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(8)
      
      // 设置3个请求失败
      mockRequestor.setUrlFailure(configs[2].url!, true)
      mockRequestor.setUrlFailure(configs[4].url!, true)
      mockRequestor.setUrlFailure(configs[6].url!, true)
      mockRequestor.setGlobalDelay(60)

      await concurrentFeature.requestConcurrent(configs, { maxConcurrency: 4 })

      const stats = concurrentFeature.getConcurrentStats()

      expect(stats.total).toBe(8)
      expect(stats.completed).toBe(8)
      expect(stats.successful).toBe(5)
      expect(stats.failed).toBe(3)
      expect(stats.maxConcurrencyUsed).toBe(4)
    })

    it('应该正确计算平均持续时间', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(4)
      
      // 设置不同的延迟
      mockRequestor.setUrlDelay(configs[0].url!, 50)
      mockRequestor.setUrlDelay(configs[1].url!, 100)
      mockRequestor.setUrlDelay(configs[2].url!, 150)
      mockRequestor.setUrlDelay(configs[3].url!, 200)

      await concurrentFeature.requestConcurrent(configs)

      const stats = concurrentFeature.getConcurrentStats()
      
      // 平均应该约为 (50+100+150+200)/4 = 125ms
      expect(stats.averageDuration).toBeGreaterThan(110)
      expect(stats.averageDuration).toBeLessThan(140)
    })

    it('应该正确记录最大并发使用量', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(10)
      mockRequestor.setGlobalDelay(100)

      // 测试无限制并发
      await concurrentFeature.requestConcurrent(configs)
      let stats = concurrentFeature.getConcurrentStats()
      expect(stats.maxConcurrencyUsed).toBe(10)

      // 重置并测试限制并发
      mockRequestor.reset()
      await concurrentFeature.requestConcurrent(configs, { maxConcurrency: 3 })
      stats = concurrentFeature.getConcurrentStats()
      expect(stats.maxConcurrencyUsed).toBe(3)
    })

    it('应该处理空请求的统计信息', async () => {
      await concurrentFeature.requestConcurrent([])

      const stats = concurrentFeature.getConcurrentStats()

      expect(stats.total).toBe(0)
      expect(stats.completed).toBe(0)
      expect(stats.successful).toBe(0)
      expect(stats.failed).toBe(0)
      expect(stats.averageDuration).toBe(0)
      expect(stats.maxConcurrencyUsed).toBe(0)
    })
  })

  describe('结果分析和过滤工具', () => {
    it('应该正确提取成功结果的数据', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      
      // 设置部分请求失败
      mockRequestor.setUrlFailure(configs[1].url!, true)
      mockRequestor.setUrlFailure(configs[3].url!, true)
      mockRequestor.setGlobalDelay(50)

      const results = await concurrentFeature.requestConcurrent(configs)

      const successfulData = concurrentFeature.getSuccessfulResults(results)

      expect(successfulData).toHaveLength(3)
      successfulData.forEach((data: any) => {
        expect(data).toBeDefined()
        expect(typeof data).toBe('object')
        expect(data.success).toBe(true)
      })

      // 验证成功结果来自正确的索引
      const successfulResults = results.filter(r => r.success)
      expect(successfulResults.map(r => r.index)).toEqual([0, 2, 4])
    })

    it('应该正确提取失败结果', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(6)
      
      const failIndices = [1, 3, 5]
      failIndices.forEach(index => {
        mockRequestor.setUrlFailure(
          configs[index].url!,
          true,
          new MockConcurrentNetworkError(`Error for index ${index}`, index)
        )
      })
      mockRequestor.setGlobalDelay(40)

      const results = await concurrentFeature.requestConcurrent(configs)

      const failedResults = concurrentFeature.getFailedResults(results)

      expect(failedResults).toHaveLength(3)
      failedResults.forEach(result => {
        expect(result.success).toBe(false)
        expect(result.error).toBeDefined()
        expect(result.error).toBeInstanceOf(MockConcurrentNetworkError)
        expect(failIndices).toContain(result.index)
      })
    })

    it('应该正确检测是否存在失败', async () => {
      const configs1 = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      mockRequestor.setGlobalDelay(30)

      const results1 = await concurrentFeature.requestConcurrent(configs1)
      expect(concurrentFeature.hasFailures(results1)).toBe(false)

      mockRequestor.reset()

      const configs2 = ConcurrentTestDataGenerator.generateRequestConfigs(4)
      mockRequestor.setUrlFailure(configs2[2].url!, true)
      mockRequestor.setGlobalDelay(30)

      const results2 = await concurrentFeature.requestConcurrent(configs2)
      expect(concurrentFeature.hasFailures(results2)).toBe(true)
    })

    it('应该生成详细的结果统计信息', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(8)
      
      // 设置不同的延迟和失败
      mockRequestor.setUrlDelay(configs[0].url!, 50)
      mockRequestor.setUrlDelay(configs[1].url!, 100)
      mockRequestor.setUrlDelay(configs[2].url!, 75)
      mockRequestor.setUrlFailure(configs[3].url!, true)
      mockRequestor.setUrlDelay(configs[4].url!, 125)
      mockRequestor.setUrlFailure(configs[5].url!, true)
      mockRequestor.setUrlDelay(configs[6].url!, 90)
      mockRequestor.setUrlDelay(configs[7].url!, 110)

      const results = await concurrentFeature.requestConcurrent(configs)

      const stats = concurrentFeature.getResultsStats(results)

      expect(stats.total).toBe(8)
      expect(stats.successful).toBe(6)
      expect(stats.failed).toBe(2)
      expect(stats.successRate).toBe(75) // 6/8 * 100 = 75%

      // 验证持续时间统计 (50, 100, 75, 125, 90, 110 for successful requests)
      // 考虑到JavaScript异步执行开销，给期望值留出合理余量
      expect(stats.averageDuration).toBeGreaterThan(80)
      expect(stats.averageDuration).toBeLessThan(120)
      expect(stats.minDuration).toBeGreaterThan(40)
      expect(stats.minDuration).toBeLessThan(70)  // 50ms + 20ms开销余量
      expect(stats.maxDuration).toBeGreaterThan(120)
      expect(stats.maxDuration).toBeLessThan(150)  // 125ms + 25ms开销余量
    })

    it('应该处理全成功和全失败的结果统计', async () => {
      // 测试全成功
      const configs1 = ConcurrentTestDataGenerator.generateRequestConfigs(4)
      mockRequestor.setGlobalDelay(80)

      const results1 = await concurrentFeature.requestConcurrent(configs1)
      const stats1 = concurrentFeature.getResultsStats(results1)

      expect(stats1.successful).toBe(4)
      expect(stats1.failed).toBe(0)
      expect(stats1.successRate).toBe(100)

      mockRequestor.reset()

      // 测试全失败
      const configs2 = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      configs2.forEach(config => {
        mockRequestor.setUrlFailure(config.url!, true)
      })
      mockRequestor.setGlobalDelay(60)

      const results2 = await concurrentFeature.requestConcurrent(configs2)
      const stats2 = concurrentFeature.getResultsStats(results2)

      expect(stats2.successful).toBe(0)
      expect(stats2.failed).toBe(3)
      expect(stats2.successRate).toBe(0)
    })
  })

  describe('ResultCollector 高级功能', () => {
    it('应该高效处理大量结果收集', () => {
      const collector = new ResultCollector<string>(1000)

      expect(collector.getCompletedCount()).toBe(0)
      expect(collector.isComplete()).toBe(false)

      // 批量设置结果
      for (let i = 0; i < 1000; i++) {
        const result = {
          success: i % 3 !== 0, // 2/3成功率
          data: i % 3 !== 0 ? `Data-${i}` as any : undefined,
          error: i % 3 === 0 ? new Error(`Error-${i}`) : undefined,
          config: { url: `/api/test-${i}`, method: 'GET' as const },
          index: i,
          duration: 50 + (i % 100)
        }
        collector.setResult(i, result)
      }

      expect(collector.getCompletedCount()).toBe(1000)
      expect(collector.isComplete()).toBe(true)

      const allResults = collector.getResults()
      expect(allResults).toHaveLength(1000)

      // 使用 ConcurrentFeature 的方法来过滤结果
      const successfulResults = concurrentFeature.getSuccessfulResults(allResults)
      // 总数1000 - 失败334 = 成功666
      expect(successfulResults).toHaveLength(1000 - 334)

      const failedResults = concurrentFeature.getFailedResults(allResults)
      // i % 3 === 0 的数字从0到999共有：(999-0)/3 + 1 = 334个
      expect(failedResults).toHaveLength(334)
    })

    it('应该正确处理结果覆盖', () => {
      const collector = new ResultCollector<string>(5)

      const initialResult = {
        success: true,
        data: 'Initial',
        config: { url: '/api/test-2', method: 'GET' as const },
        index: 2,
        duration: 100
      }

      const updatedResult = {
        success: false,
        error: new Error('Updated error'),
        config: { url: '/api/test-2', method: 'GET' as const },
        index: 2,
        duration: 150
      }

      // 设置初始结果
      collector.setResult(2, initialResult)
      expect(collector.getCompletedCount()).toBe(1)

      // 覆盖结果
      collector.setResult(2, updatedResult)
      expect(collector.getCompletedCount()).toBe(1) // 计数不变

      const results = collector.getResults()
      expect(results).toHaveLength(1)
      expect(results[0].success).toBe(false)
      expect(results[0].error).toBeDefined()
      expect(results[0].duration).toBe(150)
    })

    it('应该处理稀疏索引设置', () => {
      const collector = new ResultCollector<number>(10)

      // 只设置部分索引
      const indices = [1, 3, 7, 9]
      indices.forEach(index => {
        collector.setResult(index, {
          success: true,
          data: index * 10,
          config: { url: `/api/sparse-${index}`, method: 'GET' as const },
          index,
          duration: index * 20
        })
      })

      expect(collector.getCompletedCount()).toBe(4)
      expect(collector.isComplete()).toBe(false)

      const results = collector.getResults()
      expect(results).toHaveLength(4)

      // 使用 ConcurrentFeature 的方法来过滤结果
      const successfulData = concurrentFeature.getSuccessfulResults(results)
      expect(successfulData).toEqual([10, 30, 70, 90])
    })
  })

  describe('Semaphore 信号量机制', () => {
    it('应该正确控制并发访问', async () => {
      const semaphore = new Semaphore(2)

      expect(semaphore.available()).toBe(2)
      expect(semaphore.waitingCount()).toBe(0)

      // 获取第一个许可
      await semaphore.acquire()
      expect(semaphore.available()).toBe(1)
      expect(semaphore.waitingCount()).toBe(0)

      // 获取第二个许可
      await semaphore.acquire()
      expect(semaphore.available()).toBe(0)
      expect(semaphore.waitingCount()).toBe(0)

      // 第三个获取应该等待
      const acquirePromise = semaphore.acquire()
      expect(semaphore.waitingCount()).toBe(1)

      // 释放一个许可
      semaphore.release()
      await acquirePromise // 应该立即完成

      expect(semaphore.available()).toBe(0)
      expect(semaphore.waitingCount()).toBe(0)

      semaphore.destroy()
    })

    it('应该处理多个等待者的队列', async () => {
      const semaphore = new Semaphore(1)

      // 获取唯一许可
      await semaphore.acquire()

      // 创建多个等待者
      const acquirePromises = [
        semaphore.acquire(),
        semaphore.acquire(),
        semaphore.acquire()
      ]

      expect(semaphore.waitingCount()).toBe(3)

      // 逐个释放并验证
      const completed: boolean[] = []
      
      acquirePromises.forEach((promise, index) => {
        promise.then(() => {
          completed[index] = true
        })
      })

      // 释放第一个
      semaphore.release()
      await new Promise(resolve => setTimeout(resolve, 10)) // 等待Promise处理
      
      expect(completed[0]).toBe(true)
      expect(completed[1]).toBe(undefined)
      expect(completed[2]).toBe(undefined)
      expect(semaphore.waitingCount()).toBe(2)

      // 释放第二个
      semaphore.release()
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(completed[1]).toBe(true)
      expect(completed[2]).toBe(undefined)
      expect(semaphore.waitingCount()).toBe(1)

      // 释放第三个
      semaphore.release()
      await new Promise(resolve => setTimeout(resolve, 10))
      
      expect(completed[2]).toBe(true)
      expect(semaphore.waitingCount()).toBe(0)

      semaphore.destroy()
    })

    it('应该正确处理信号量销毁', async () => {
      const semaphore = new Semaphore(1)

      await semaphore.acquire()

      // 创建等待者
      const acquirePromise1 = semaphore.acquire()
      const acquirePromise2 = semaphore.acquire()

      expect(semaphore.waitingCount()).toBe(2)

      // 销毁信号量
      semaphore.destroy()

      // 等待者应该收到错误
      await expect(acquirePromise1).rejects.toThrow('Semaphore destroyed')
      await expect(acquirePromise2).rejects.toThrow('Semaphore destroyed')

      expect(semaphore.waitingCount()).toBe(0)
      expect(semaphore.available()).toBe(0)
    })

    it('应该处理获取超时', async () => {
      // 使用2秒超时时间，确保在测试超时前能收到超时异常
      const semaphore = new Semaphore(1, 2000)

      // 获取唯一许可
      await semaphore.acquire()

      // 尝试获取另一个许可（应该在2秒后超时）
      await expect(semaphore.acquire()).rejects.toThrow(/timeout/)

      semaphore.destroy()
    })
  })

  describe('性能监控和优化', () => {
    it('应该在高并发下保持良好性能', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(100)
      mockRequestor.setGlobalDelay(10) // 很短的延迟

      const { result, duration } = await ConcurrentPerformanceHelper.measureExecutionTime(
        () => concurrentFeature.requestConcurrent(configs, { maxConcurrency: 20 })
      )

      expect(result).toHaveLength(100)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 100)
      ConcurrentTestAssertions.verifySuccessRate(result, 100)

      // 验证性能 - 100个请求，20并发，10ms延迟，应该约50ms
      expect(duration).toBeGreaterThan(40)
      expect(duration).toBeLessThan(100)

      // 验证统计信息
      const stats = concurrentFeature.getConcurrentStats()
      expect(stats.maxConcurrencyUsed).toBe(20)
      expect(stats.averageDuration).toBeLessThan(30)
    })

    it('应该正确处理内存使用和资源清理', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(50)
      
      // 设置一些失败请求
      for (let i = 10; i < 20; i++) {
        mockRequestor.setUrlFailure(configs[i].url!, true)
      }
      mockRequestor.setGlobalDelay(30)

      const result = await concurrentFeature.requestConcurrent(configs, { maxConcurrency: 10 })

      expect(result).toHaveLength(50)
      
      // 验证资源清理
      concurrentFeature.destroy()
      
      const stats = concurrentFeature.getConcurrentStats()
      expect(stats.total).toBe(0)
      expect(stats.completed).toBe(0)
    })

    it('应该正确测量和报告执行时间分布', async () => {
      // 创建具有不同执行时间的请求
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(20)
      
      // 设置阶梯式延迟
      configs.forEach((config, index) => {
        mockRequestor.setUrlDelay(config.url!, 50 + (index * 10))
      })

      const result = await concurrentFeature.requestConcurrent(configs, { maxConcurrency: 5 })

      const stats = concurrentFeature.getResultsStats(result)
      
      expect(stats.minDuration).toBeGreaterThan(45)
      expect(stats.minDuration).toBeLessThan(70)  // 50ms + 20ms开销余量
      
      expect(stats.maxDuration).toBeGreaterThan(230)
      expect(stats.maxDuration).toBeLessThan(270)  // 240ms + 30ms开销余量
      
      // 平均时间应该在中间范围
      expect(stats.averageDuration).toBeGreaterThan(130)
      expect(stats.averageDuration).toBeLessThan(180)  // 调整平均时间上限
    })

    it('应该优化并发批处理性能', async () => {
      const baseConfig = { url: '/api/batch-test', method: 'GET' as const }
      mockRequestor.setGlobalDelay(40)

      // 测试不同的并发配置性能
      const testConfigs = [
        { count: 20, maxConcurrency: 1 },
        { count: 20, maxConcurrency: 5 },
        { count: 20, maxConcurrency: 10 },
        { count: 20, maxConcurrency: 20 }
      ]

      const results: Array<{ concurrency: number; duration: number }> = []

      for (const config of testConfigs) {
        mockRequestor.reset()
        mockRequestor.setGlobalDelay(40)

        const { duration } = await ConcurrentPerformanceHelper.measureExecutionTime(
          () => concurrentFeature.requestMultiple(baseConfig, config.count, {
            maxConcurrency: config.maxConcurrency
          })
        )

        results.push({
          concurrency: config.maxConcurrency,
          duration
        })
      }

      // 验证并发性能提升
      expect(results[3].duration).toBeLessThan(results[0].duration) // 20并发 vs 1并发
      expect(results[2].duration).toBeLessThan(results[1].duration) // 10并发 vs 5并发
      
      // 20并发应该接近单次请求时间
      expect(results[3].duration).toBeLessThan(80)
    })
  })

  describe('综合高级场景测试', () => {
    it('应该处理复杂的混合场景', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(15)
      
      // 设置复杂的延迟和失败模式
      configs.forEach((config, index) => {
        if (index % 5 === 0) {
          mockRequestor.setUrlFailure(config.url!, true, new MockConcurrentNetworkError(`Scheduled failure ${index}`))
        } else if (index % 3 === 0) {
          mockRequestor.setUrlDelay(config.url!, 150)
        } else {
          mockRequestor.setUrlDelay(config.url!, 50)
        }
      })

      const result = await concurrentFeature.requestConcurrent(configs, {
        maxConcurrency: 4,
        failFast: false
      })

      expect(result).toHaveLength(15)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 15)

      const stats = concurrentFeature.getResultsStats(result)
      expect(stats.total).toBe(15)
      expect(stats.failed).toBe(3) // 索引 0, 5, 10
      expect(stats.successful).toBe(12)
      expect(stats.successRate).toBe(80)

      // 验证统计信息一致性
      ConcurrentTestAssertions.verifyStatsConsistency(result, stats)

      // 验证并发限制
      ConcurrentTestAssertions.verifyConcurrencyLimit(mockRequestor, 4)
    })
  })
})
