import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConcurrentFeature, ConcurrentConfig } from '../../src/features/concurrent'
import { RequestError } from '../../src/interface'
import {
  ConcurrentMockRequestor,
  ConcurrentTestDataGenerator,
  ConcurrentTestAssertions,
  ConcurrentPerformanceHelper,
  MockConcurrentNetworkError,
  MockConcurrentTimeoutError
} from './concurrent-test-helpers'

describe('ConcurrentFeature - 配置相关测试', () => {
  let mockRequestor: ConcurrentMockRequestor
  let concurrentFeature: ConcurrentFeature

  beforeEach(() => {
    mockRequestor = new ConcurrentMockRequestor()
    concurrentFeature = new ConcurrentFeature(mockRequestor)
  })

  describe('maxConcurrency 并发限制配置', () => {
    it('应该限制最大并发数', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(8)
      mockRequestor.setGlobalDelay(100)

      const config: ConcurrentConfig = {
        maxConcurrency: 3
      }

      const { result, duration } = await ConcurrentPerformanceHelper.measureExecutionTime(
        () => concurrentFeature.requestConcurrent(configs, config)
      )

      expect(result).toHaveLength(8)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 8)
      ConcurrentTestAssertions.verifySuccessRate(result, 8)
      ConcurrentTestAssertions.verifyConcurrencyLimit(mockRequestor, 3)

      // 验证执行时间 - 应该是分批执行的时间
      const expectedMinTime = ConcurrentPerformanceHelper.calculateTheoreticalMinTime(8, 100, 3)
      expect(duration).toBeGreaterThan(expectedMinTime - 50)
      expect(duration).toBeLessThan(expectedMinTime + 100)
    })

    it('应该正确处理并发限制为1的情况（顺序执行）', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(4)
      mockRequestor.setGlobalDelay(80)

      const config: ConcurrentConfig = {
        maxConcurrency: 1
      }

      const { result, duration } = await ConcurrentPerformanceHelper.measureExecutionTime(
        () => concurrentFeature.requestConcurrent(configs, config)
      )

      expect(result).toHaveLength(4)
      ConcurrentTestAssertions.verifyConcurrencyLimit(mockRequestor, 1)

      // 顺序执行应该接近 4 * 80 = 320ms
      expect(duration).toBeGreaterThan(300)
      expect(duration).toBeLessThan(400)

      // 验证结果顺序保持
      result.forEach((res, index) => {
        expect(res.index).toBe(index)
        expect(res.success).toBe(true)
      })
    })

    it('应该处理并发限制大于请求数的情况', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      mockRequestor.setGlobalDelay(60)

      const config: ConcurrentConfig = {
        maxConcurrency: 10 // 大于请求数
      }

      const { result, duration } = await ConcurrentPerformanceHelper.measureExecutionTime(
        () => concurrentFeature.requestConcurrent(configs, config)
      )

      expect(result).toHaveLength(3)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 3)

      // 应该表现为无限制并发
      expect(duration).toBeLessThan(100) // 接近单个请求时间
      const stats = mockRequestor.getCallStats()
      expect(stats.maxActiveCalls).toBe(3) // 所有请求同时执行
    })

    it('应该拒绝无效的并发限制配置', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      
      const config: ConcurrentConfig = {
        maxConcurrency: 0 // 无效值
      }

      await expect(
        concurrentFeature.requestConcurrent(configs, config)
      ).rejects.toThrow(RequestError)

      await expect(
        concurrentFeature.requestConcurrent(configs, { maxConcurrency: -1 })
      ).rejects.toThrow(RequestError)
    })

    it('应该正确处理大并发限制下的性能', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(20)
      mockRequestor.setGlobalDelay(50)

      const config: ConcurrentConfig = {
        maxConcurrency: 5
      }

      const { result, duration } = await ConcurrentPerformanceHelper.measureExecutionTime(
        () => concurrentFeature.requestConcurrent(configs, config)
      )

      expect(result).toHaveLength(20)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 20)
      ConcurrentTestAssertions.verifyConcurrencyLimit(mockRequestor, 5)

      // 20个请求，并发限制5，每次50ms，应该需要约 4 * 50 = 200ms
      expect(duration).toBeGreaterThan(180)
      expect(duration).toBeLessThan(280)
    })
  })

  describe('failFast 快速失败配置', () => {
    it('应该在failFast模式下遇到第一个错误时立即抛出异常', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      
      // 设置第2个请求在短延迟后失败
      mockRequestor.setUrlDelay(configs[0].url!, 200)
      mockRequestor.setUrlDelay(configs[1].url!, 50)  // 这个会最先完成并失败
      mockRequestor.setUrlDelay(configs[2].url!, 300)
      mockRequestor.setUrlFailure(configs[1].url!, true, new MockConcurrentNetworkError('Fail fast test'))

      const config: ConcurrentConfig = {
        failFast: true
      }

      await expect(
        concurrentFeature.requestConcurrent(configs, config)
      ).rejects.toThrow(MockConcurrentNetworkError)
    })

    it('应该在failFast=false模式下收集所有结果', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(4)
      
      // 设置一半请求失败
      mockRequestor.setUrlFailure(configs[1].url!, true)
      mockRequestor.setUrlFailure(configs[3].url!, true)
      mockRequestor.setGlobalDelay(50)

      const config: ConcurrentConfig = {
        failFast: false
      }

      const result = await concurrentFeature.requestConcurrent(configs, config)

      expect(result).toHaveLength(4)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 4)

      const successfulResults = result.filter(r => r.success)
      const failedResults = result.filter(r => !r.success)

      expect(successfulResults).toHaveLength(2)
      expect(failedResults).toHaveLength(2)
      expect(failedResults.map(r => r.index)).toEqual([1, 3])
    })

    it('应该在failFast模式下与并发限制配合工作', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(6)
      
      // 设置第3个请求失败（会在第二批执行）
      mockRequestor.setUrlFailure(configs[2].url!, true, new MockConcurrentNetworkError('Batch fail fast'))
      mockRequestor.setGlobalDelay(100)

      const config: ConcurrentConfig = {
        maxConcurrency: 2,
        failFast: true
      }

      await expect(
        concurrentFeature.requestConcurrent(configs, config)
      ).rejects.toThrow(MockConcurrentNetworkError)
    })

    it('应该在默认情况下不启用failFast', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      
      mockRequestor.setUrlFailure(configs[1].url!, true)
      mockRequestor.setGlobalDelay(50)

      // 不指定failFast，应该默认为false
      const result = await concurrentFeature.requestConcurrent(configs, {})

      expect(result).toHaveLength(3)
      const failedResults = result.filter(r => !r.success)
      expect(failedResults).toHaveLength(1)
      expect(failedResults[0].index).toBe(1)
    })
  })

  describe('timeout 超时配置', () => {
    it('应该在超时时抛出异常', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      mockRequestor.setGlobalDelay(200) // 请求需要200ms

      const config: ConcurrentConfig = {
        timeout: 100 // 超时设置为100ms
      }

      await expect(
        concurrentFeature.requestConcurrent(configs, config)
      ).rejects.toThrow(/timeout/)
    })

    it('应该在超时时间内正常完成请求', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(4)
      mockRequestor.setGlobalDelay(80) // 请求需要80ms

      const config: ConcurrentConfig = {
        timeout: 150 // 超时设置为150ms，足够完成
      }

      const result = await concurrentFeature.requestConcurrent(configs, config)

      expect(result).toHaveLength(4)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 4)
      ConcurrentTestAssertions.verifySuccessRate(result, 4)
    })

    it('应该与并发限制配合处理超时', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(6)
      mockRequestor.setGlobalDelay(100)

      const config: ConcurrentConfig = {
        maxConcurrency: 2,
        timeout: 250 // 6个请求，并发2，需要约300ms，会超时
      }

      await expect(
        concurrentFeature.requestConcurrent(configs, config)
      ).rejects.toThrow(/timeout/)
    })

    it('应该与failFast配合处理超时', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(4)
      mockRequestor.setGlobalDelay(150)

      const config: ConcurrentConfig = {
        timeout: 100,
        failFast: true
      }

      await expect(
        concurrentFeature.requestConcurrent(configs, config)
      ).rejects.toThrow(/timeout/)
    })

    it('应该忽略零或负超时值', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(2)
      mockRequestor.setGlobalDelay(50)

      // 测试零超时
      let result = await concurrentFeature.requestConcurrent(configs, { timeout: 0 })
      expect(result).toHaveLength(2)
      ConcurrentTestAssertions.verifySuccessRate(result, 2)

      // 测试负超时
      result = await concurrentFeature.requestConcurrent(configs, { timeout: -100 })
      expect(result).toHaveLength(2)
      ConcurrentTestAssertions.verifySuccessRate(result, 2)
    })
  })

  describe('配置组合场景', () => {
    it('应该正确处理所有配置选项的组合', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(8)
      
      // 设置一个请求失败
      mockRequestor.setUrlFailure(configs[3].url!, true)
      mockRequestor.setGlobalDelay(80)

      const config: ConcurrentConfig = {
        maxConcurrency: 3,
        failFast: false,
        timeout: 300,
        retryOnError: false
      }

      const result = await concurrentFeature.requestConcurrent(configs, config)

      expect(result).toHaveLength(8)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 8)
      ConcurrentTestAssertions.verifyConcurrencyLimit(mockRequestor, 3)

      // 验证失败结果
      const failedResults = result.filter(r => !r.success)
      expect(failedResults).toHaveLength(1)
      expect(failedResults[0].index).toBe(3)
    })

    it('应该处理复杂的失败快速模式配置', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(6)
      
      // 设置第4个请求失败（在第二批）
      mockRequestor.setUrlFailure(configs[3].url!, true, new MockConcurrentNetworkError('Complex fail fast'))
      mockRequestor.setGlobalDelay(100)

      const config: ConcurrentConfig = {
        maxConcurrency: 3,
        failFast: true,
        timeout: 500
      }

      await expect(
        concurrentFeature.requestConcurrent(configs, config)
      ).rejects.toThrow(MockConcurrentNetworkError)
    })

    it('应该处理边界情况的配置组合', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      mockRequestor.setGlobalDelay(60)

      // 边界配置：并发限制等于请求数
      const config: ConcurrentConfig = {
        maxConcurrency: 5,
        failFast: false,
        timeout: 200
      }

      const result = await concurrentFeature.requestConcurrent(configs, config)

      expect(result).toHaveLength(5)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 5)
      ConcurrentTestAssertions.verifySuccessRate(result, 5)

      // 应该表现为无限制并发
      const stats = mockRequestor.getCallStats()
      expect(stats.maxActiveCalls).toBe(5)
    })

    it('应该使用合理的默认配置', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(4)
      mockRequestor.setGlobalDelay(50)

      // 不提供任何配置
      const result = await concurrentFeature.requestConcurrent(configs)

      expect(result).toHaveLength(4)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 4)
      ConcurrentTestAssertions.verifySuccessRate(result, 4)

      // 验证默认为无限制并发
      const stats = mockRequestor.getCallStats()
      expect(stats.maxActiveCalls).toBe(4)
    })

    it('应该处理部分配置提供的情况', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(6)
      mockRequestor.setGlobalDelay(70)

      // 只提供并发限制配置
      const result1 = await concurrentFeature.requestConcurrent(configs, {
        maxConcurrency: 2
      })

      expect(result1).toHaveLength(6)
      ConcurrentTestAssertions.verifyConcurrencyLimit(mockRequestor, 2)

      mockRequestor.reset()

      // 只提供failFast配置
      mockRequestor.setUrlFailure(configs[2].url!, true)
      mockRequestor.setGlobalDelay(50)

      const result2 = await concurrentFeature.requestConcurrent(configs, {
        failFast: false
      })

      expect(result2).toHaveLength(6)
      const failedResults = result2.filter(r => !r.success)
      expect(failedResults).toHaveLength(1)
    })
  })

  describe('特殊配置边界测试', () => {
    it('应该处理极大的并发限制值', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      mockRequestor.setGlobalDelay(40)

      const config: ConcurrentConfig = {
        maxConcurrency: Number.MAX_SAFE_INTEGER
      }

      const result = await concurrentFeature.requestConcurrent(configs, config)

      expect(result).toHaveLength(5)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 5)
      
      // 应该表现为无限制并发
      const stats = mockRequestor.getCallStats()
      expect(stats.maxActiveCalls).toBe(5)
    })

    it('应该处理极大的超时值', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      mockRequestor.setGlobalDelay(60)

      const config: ConcurrentConfig = {
        timeout: Number.MAX_SAFE_INTEGER
      }

      const result = await concurrentFeature.requestConcurrent(configs, config)

      expect(result).toHaveLength(3)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 3)
      ConcurrentTestAssertions.verifySuccessRate(result, 3)
    })

    it('应该处理配置值类型边界', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(2)
      mockRequestor.setGlobalDelay(30)

      // 测试各种真值/假值
      const truthyConfigs = [
        { failFast: true },
        { failFast: 1 as any },
        { failFast: 'true' as any }
      ]

      for (const config of truthyConfigs) {
        mockRequestor.reset()
        mockRequestor.setUrlFailure(configs[0].url!, true)
        mockRequestor.setGlobalDelay(30)

        await expect(
          concurrentFeature.requestConcurrent(configs, config)
        ).rejects.toThrow()
      }

      const falsyConfigs = [
        { failFast: false },
        { failFast: 0 as any },
        { failFast: '' as any }
      ]

      for (const config of falsyConfigs) {
        mockRequestor.reset()
        mockRequestor.setUrlFailure(configs[0].url!, true)
        mockRequestor.setGlobalDelay(30)

        const result = await concurrentFeature.requestConcurrent(configs, config)
        expect(result).toHaveLength(2)
      }
    })
  })
})
