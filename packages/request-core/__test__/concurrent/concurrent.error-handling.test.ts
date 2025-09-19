import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConcurrentFeature } from '../../src/features/concurrent'
import { Semaphore } from '../../src/features/concurrent/semaphore'
import { RequestError } from '../../src/interface'
import {
  ConcurrentMockRequestor,
  ConcurrentTestDataGenerator,
  ConcurrentTestAssertions,
  ConcurrentPerformanceHelper,
  MockConcurrentNetworkError,
  MockConcurrentTimeoutError,
  MockConcurrentRateLimitError
} from './concurrent-test-helpers'

describe('ConcurrentFeature - 错误处理测试', () => {
  let mockRequestor: ConcurrentMockRequestor
  let concurrentFeature: ConcurrentFeature

  beforeEach(() => {
    mockRequestor = new ConcurrentMockRequestor()
    concurrentFeature = new ConcurrentFeature(mockRequestor)
  })

  describe('failFast 错误处理策略', () => {
    it('应该在failFast模式下立即停止所有后续请求', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(8)
      
      // 设置第2个请求快速失败
      mockRequestor.setUrlDelay(configs[0].url!, 200)
      mockRequestor.setUrlDelay(configs[1].url!, 50)  // 最先完成但失败
      mockRequestor.setUrlDelay(configs[2].url!, 300)
      mockRequestor.setUrlDelay(configs[3].url!, 400)
      mockRequestor.setUrlFailure(
        configs[1].url!,
        true,
        new MockConcurrentNetworkError('Fail fast trigger', 1)
      )

      const config = { failFast: true }

      const startTime = Date.now()
      await expect(
        concurrentFeature.requestConcurrent(configs, config)
      ).rejects.toThrow(MockConcurrentNetworkError)

      const duration = Date.now() - startTime
      
      // 应该在第一个失败后立即返回，而不是等待所有请求完成
      expect(duration).toBeLessThan(100) // 远小于其他请求的延迟时间
      
      const callStats = mockRequestor.getCallStats()
      // 可能有一些请求已经开始但未完成
      expect(callStats.totalCalls).toBeLessThanOrEqual(8)
    })

    it('应该在failFast模式下保持错误信息', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      const customError = new MockConcurrentNetworkError('Custom fail fast error', 2)
      
      mockRequestor.setUrlFailure(configs[2].url!, true, customError)
      mockRequestor.setGlobalDelay(50)

      try {
        await concurrentFeature.requestConcurrent(configs, { failFast: true })
      } catch (error) {
        expect(error).toBe(customError)
        expect(error).toBeInstanceOf(MockConcurrentNetworkError)
        expect((error as MockConcurrentNetworkError).index).toBe(2)
      }
    })

    it('应该在failFast模式下与并发限制配合处理错误', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(10)
      
      // 设置第4个请求失败（在第二批中）
      mockRequestor.setUrlFailure(
        configs[3].url!,
        true,
        new MockConcurrentNetworkError('Batched fail fast', 3)
      )
      mockRequestor.setGlobalDelay(100)

      await expect(
        concurrentFeature.requestConcurrent(configs, {
          maxConcurrency: 3,
          failFast: true
        })
      ).rejects.toThrow(MockConcurrentNetworkError)

      // 验证并发限制仍然生效
      ConcurrentTestAssertions.verifyConcurrencyLimit(mockRequestor, 3)
    })

    it('应该正确处理failFast=false的情况收集所有错误', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(6)
      
      // 设置多个请求失败
      const failedIndices = [1, 3, 5]
      failedIndices.forEach(index => {
        mockRequestor.setUrlFailure(
          configs[index].url!,
          true,
          new MockConcurrentNetworkError(`Error ${index}`, index)
        )
      })
      mockRequestor.setGlobalDelay(80)

      const result = await concurrentFeature.requestConcurrent(configs, {
        failFast: false
      })

      expect(result).toHaveLength(6)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 6)

      const failedResults = result.filter(r => !r.success)
      expect(failedResults).toHaveLength(3)
      
      failedResults.forEach(failedResult => {
        expect(failedIndices).toContain(failedResult.index)
        expect(failedResult.error).toBeInstanceOf(MockConcurrentNetworkError)
      })

      const successfulResults = result.filter(r => r.success)
      expect(successfulResults).toHaveLength(3)
    })
  })

  describe('多种错误类型处理', () => {
    it('应该正确处理网络错误', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(4)
      
      const networkErrors = [
        new MockConcurrentNetworkError('Connection refused', 0),
        new MockConcurrentNetworkError('DNS resolution failed', 2)
      ]

      mockRequestor.setUrlFailure(configs[0].url!, true, networkErrors[0])
      mockRequestor.setUrlFailure(configs[2].url!, true, networkErrors[1])
      mockRequestor.setGlobalDelay(60)

      const result = await concurrentFeature.requestConcurrent(configs, {
        failFast: false
      })

      const failedResults = result.filter(r => !r.success)
      expect(failedResults).toHaveLength(2)

      failedResults.forEach(failedResult => {
        expect(failedResult.error).toBeInstanceOf(MockConcurrentNetworkError)
        expect(failedResult.duration).toBeGreaterThan(50)
      })
    })

    it('应该正确处理超时错误', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      
      const timeoutErrors = [
        new MockConcurrentTimeoutError('Request timeout', 1),
        new MockConcurrentTimeoutError('Gateway timeout', 3)
      ]

      mockRequestor.setUrlFailure(configs[1].url!, true, timeoutErrors[0])
      mockRequestor.setUrlFailure(configs[3].url!, true, timeoutErrors[1])
      mockRequestor.setGlobalDelay(70)

      const result = await concurrentFeature.requestConcurrent(configs)

      const failedResults = result.filter(r => !r.success)
      expect(failedResults).toHaveLength(2)

      failedResults.forEach(failedResult => {
        expect(failedResult.error).toBeInstanceOf(MockConcurrentTimeoutError)
        expect(failedResult.success).toBe(false)
        expect(failedResult.data).toBeUndefined()
      })
    })

    it('应该正确处理速率限制错误', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      
      const rateLimitError = new MockConcurrentRateLimitError('Rate limit exceeded', 60)
      mockRequestor.setUrlFailure(configs[1].url!, true, rateLimitError)
      mockRequestor.setGlobalDelay(50)

      const result = await concurrentFeature.requestConcurrent(configs)

      const failedResult = result.find(r => r.index === 1)
      expect(failedResult).toBeDefined()
      expect(failedResult!.error).toBeInstanceOf(MockConcurrentRateLimitError)
      expect((failedResult!.error as MockConcurrentRateLimitError).retryAfter).toBe(60)
    })

    it('应该处理混合类型的错误', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(8)
      
      const errors = [
        new MockConcurrentNetworkError('Network failure', 1),
        new MockConcurrentTimeoutError('Timeout failure', 3),
        new MockConcurrentRateLimitError('Rate limit failure', 30),
        new RequestError('Generic request error')
      ]

      mockRequestor.setUrlFailure(configs[1].url!, true, errors[0])
      mockRequestor.setUrlFailure(configs[3].url!, true, errors[1])
      mockRequestor.setUrlFailure(configs[5].url!, true, errors[2])
      mockRequestor.setUrlFailure(configs[7].url!, true, errors[3])
      mockRequestor.setGlobalDelay(60)

      const result = await concurrentFeature.requestConcurrent(configs)

      const failedResults = result.filter(r => !r.success)
      expect(failedResults).toHaveLength(4)

      const errorTypes = failedResults.map(r => r.error!.constructor.name)
      expect(errorTypes).toContain('MockConcurrentNetworkError')
      expect(errorTypes).toContain('MockConcurrentTimeoutError')
      expect(errorTypes).toContain('MockConcurrentRateLimitError')
      expect(errorTypes).toContain('RequestError')
    })
  })

  describe('超时错误处理', () => {
    it('应该在全局超时时停止所有请求', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(6)
      mockRequestor.setGlobalDelay(200) // 每个请求200ms

      const startTime = Date.now()
      await expect(
        concurrentFeature.requestConcurrent(configs, {
          timeout: 150 // 超时150ms
        })
      ).rejects.toThrow(/timeout/)

      const duration = Date.now() - startTime
      expect(duration).toBeGreaterThan(140)
      expect(duration).toBeLessThan(170)
    })

    it('应该在超时时与并发限制配合工作', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(8)
      mockRequestor.setGlobalDelay(120)

      await expect(
        concurrentFeature.requestConcurrent(configs, {
          maxConcurrency: 2,
          timeout: 300 // 8个请求，2并发，需要约480ms，会超时
        })
      ).rejects.toThrow(/timeout/)

      ConcurrentTestAssertions.verifyConcurrencyLimit(mockRequestor, 2)
    })

    it('应该处理不同的超时错误消息', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)

      // 使用更长的延迟确保超时触发
      const timeoutValues = [50, 100, 150] // 更短的超时时间
      const requestDelay = 200 // 固定的请求延迟

      for (const timeout of timeoutValues) {
        mockRequestor.reset()
        mockRequestor.setGlobalDelay(requestDelay) // 请求需要200ms

        try {
          await concurrentFeature.requestConcurrent(configs, { timeout })
          throw new Error('Should have thrown timeout error')
        } catch (error) {
          expect(error).toBeInstanceOf(Error)
          expect(error.message).toMatch(/timeout/)
          expect(error.message).toContain(`${timeout}ms`)
        }
      }
    })

    it('应该在超时后正确清理资源', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      mockRequestor.setGlobalDelay(200)

      try {
        await concurrentFeature.requestConcurrent(configs, {
          maxConcurrency: 2,
          timeout: 150
        })
      } catch (error) {
        // 预期的超时错误
      }

      // 验证后续请求仍可正常工作
      mockRequestor.reset()
      mockRequestor.setGlobalDelay(50)

      const result = await concurrentFeature.requestConcurrent(configs.slice(0, 2))
      expect(result).toHaveLength(2)
      ConcurrentTestAssertions.verifySuccessRate(result, 2)
    })
  })

  describe('信号量错误处理', () => {
    it('应该处理信号量销毁时的清理', async () => {
      const semaphore = new Semaphore(2)

      // 获取所有许可
      await semaphore.acquire()
      await semaphore.acquire()

      // 创建等待队列
      const waitPromises = [
        semaphore.acquire(),
        semaphore.acquire(),
        semaphore.acquire()
      ]

      expect(semaphore.waitingCount()).toBe(3)

      // 销毁信号量
      semaphore.destroy()

      // 所有等待的请求都应该被拒绝
      for (const promise of waitPromises) {
        await expect(promise).rejects.toThrow('Semaphore destroyed')
      }

      expect(semaphore.waitingCount()).toBe(0)
    })

    it('应该处理信号量获取超时', async () => {
      // 使用较短的超时时间以便测试能快速完成
      const semaphore = new Semaphore(1, 1000) // 1秒超时

      // 获取唯一许可
      await semaphore.acquire()

      // 尝试获取第二个许可应该超时
      await expect(semaphore.acquire()).rejects.toThrow(/timeout/)

      semaphore.destroy()
    })

    it('应该在并发请求中正确处理信号量异常', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(6)
      mockRequestor.setGlobalDelay(100)

      // 在执行过程中销毁feature（模拟异常情况）
      const requestPromise = concurrentFeature.requestConcurrent(configs, {
        maxConcurrency: 2
      })

      // 短暂延迟后销毁feature
      setTimeout(() => {
        concurrentFeature.destroy()
      }, 50)

      // 请求应该能正常完成或优雅失败
      try {
        const result = await requestPromise
        expect(Array.isArray(result)).toBe(true)
      } catch (error) {
        // 允许在destroy期间出现错误
        expect(error).toBeDefined()
      }
    })
  })

  describe('资源清理和内存泄漏防护', () => {
    it('应该在destroy时清理所有资源', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(10)
      mockRequestor.setGlobalDelay(50)

      // 执行一些请求以建立内部状态
      await concurrentFeature.requestConcurrent(configs, { maxConcurrency: 3 })

      const statsBeforeDestroy = concurrentFeature.getConcurrentStats()
      expect(statsBeforeDestroy.total).toBe(10)

      // 销毁feature
      concurrentFeature.destroy()

      // 验证统计信息被重置
      const statsAfterDestroy = concurrentFeature.getConcurrentStats()
      expect(statsAfterDestroy.total).toBe(0)
      expect(statsAfterDestroy.completed).toBe(0)
      expect(statsAfterDestroy.successful).toBe(0)
      expect(statsAfterDestroy.failed).toBe(0)
      expect(statsAfterDestroy.averageDuration).toBe(0)
      expect(statsAfterDestroy.maxConcurrencyUsed).toBe(0)
    })

    it('应该处理大量失败请求而不泄漏内存', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(100)
      
      // 设置高失败率
      configs.forEach(config => {
        mockRequestor.setUrlFailure(
          config.url!,
          true,
          new MockConcurrentNetworkError(`Mass failure for ${config.url}`)
        )
      })
      mockRequestor.setGlobalDelay(20)

      const result = await concurrentFeature.requestConcurrent(configs, {
        maxConcurrency: 10
      })

      expect(result).toHaveLength(100)
      
      const failedResults = result.filter(r => !r.success)
      expect(failedResults).toHaveLength(100)

      // 验证每个失败结果都有适当的错误信息
      failedResults.forEach(failedResult => {
        expect(failedResult.error).toBeInstanceOf(MockConcurrentNetworkError)
        expect(failedResult.success).toBe(false)
        expect(failedResult.duration).toBeGreaterThan(0)
      })

      // 清理资源
      concurrentFeature.destroy()
    })

    it('应该在异常情况下正确清理部分完成的请求', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(8)
      
      // 设置一些请求有很长的延迟
      mockRequestor.setUrlDelay(configs[0].url!, 50)
      mockRequestor.setUrlDelay(configs[1].url!, 500) // 很长的延迟
      mockRequestor.setUrlDelay(configs[2].url!, 50)
      mockRequestor.setUrlFailure(configs[3].url!, true, new MockConcurrentNetworkError('Cleanup test'))

      const requestPromise = concurrentFeature.requestConcurrent(configs, {
        maxConcurrency: 2,
        failFast: true
      })

      // 应该在第一个错误时快速失败
      await expect(requestPromise).rejects.toThrow(MockConcurrentNetworkError)

      // 验证资源已被清理
      const stats = concurrentFeature.getConcurrentStats()
      expect(stats.completed).toBeGreaterThan(0) // 至少一些请求完成了
      
      // 销毁以确保完全清理
      concurrentFeature.destroy()
    })

    it('应该处理大量并发请求的资源管理', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(200)
      mockRequestor.setGlobalDelay(30)

      const result = await concurrentFeature.requestConcurrent(configs, {
        maxConcurrency: 50
      })

      expect(result).toHaveLength(200)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 200)
      ConcurrentTestAssertions.verifySuccessRate(result, 200)

      // 验证并发控制
      ConcurrentTestAssertions.verifyConcurrencyLimit(mockRequestor, 50)

      // 验证统计信息
      const stats = concurrentFeature.getConcurrentStats()
      expect(stats.maxConcurrencyUsed).toBe(50)

      // 清理资源
      concurrentFeature.destroy()
    })
  })

  describe('边界条件和异常场景', () => {
    it('应该处理请求过程中的意外异常', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      
      // 设置一个请求抛出非标准错误
      const weirdError = { message: 'Not a real Error object', weird: true }
      mockRequestor.setUrlFailure(configs[2].url!, true, weirdError as any)
      mockRequestor.setGlobalDelay(50)

      const result = await concurrentFeature.requestConcurrent(configs)

      expect(result).toHaveLength(5)
      
      const failedResult = result.find(r => r.index === 2)
      expect(failedResult).toBeDefined()
      expect(failedResult!.success).toBe(false)
      expect(failedResult!.error).toBe(weirdError)
    })

    it('应该处理配置验证错误', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      
      // 无效的并发配置
      await expect(
        concurrentFeature.requestConcurrent(configs, { maxConcurrency: -1 })
      ).rejects.toThrow(RequestError)

      await expect(
        concurrentFeature.requestConcurrent(configs, { maxConcurrency: 0 })
      ).rejects.toThrow(RequestError)
    })

    it('应该处理空配置和默认值', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(4)
      mockRequestor.setGlobalDelay(40)

      // 空配置对象
      const result1 = await concurrentFeature.requestConcurrent(configs, {})
      expect(result1).toHaveLength(4)
      ConcurrentTestAssertions.verifySuccessRate(result1, 4)

      // undefined配置
      const result2 = await concurrentFeature.requestConcurrent(configs, undefined as any)
      expect(result2).toHaveLength(4)
      ConcurrentTestAssertions.verifySuccessRate(result2, 4)

      // null配置
      const result3 = await concurrentFeature.requestConcurrent(configs, null as any)
      expect(result3).toHaveLength(4)
      ConcurrentTestAssertions.verifySuccessRate(result3, 4)
    })

    it('应该处理异步操作中的竞态条件', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(10)
      mockRequestor.setGlobalDelay(100)

      // 同时启动多个并发请求操作
      const promises = [
        concurrentFeature.requestConcurrent(configs.slice(0, 3), { maxConcurrency: 2 }),
        concurrentFeature.requestConcurrent(configs.slice(3, 6), { maxConcurrency: 2 }),
        concurrentFeature.requestConcurrent(configs.slice(6, 10), { maxConcurrency: 2 })
      ]

      const results = await Promise.all(promises)

      expect(results[0]).toHaveLength(3)
      expect(results[1]).toHaveLength(3)
      expect(results[2]).toHaveLength(4)

      // 验证所有结果都是成功的
      results.forEach(result => {
        ConcurrentTestAssertions.verifySuccessRate(result, result.length)
      })
    })

    it('应该在极端错误条件下保持稳定性', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(50)
      
      // 设置极高的失败率和各种错误类型
      configs.forEach((config, index) => {
        const errorType = index % 4
        let error: Error
        
        switch (errorType) {
          case 0:
            error = new MockConcurrentNetworkError(`Network error ${index}`, index)
            break
          case 1:
            error = new MockConcurrentTimeoutError(`Timeout error ${index}`, index)
            break
          case 2:
            error = new MockConcurrentRateLimitError(`Rate limit ${index}`)
            break
          default:
            error = new RequestError(`Generic error ${index}`)
        }
        
        mockRequestor.setUrlFailure(config.url!, index % 3 === 0, error) // ~33% failure rate
      })
      
      mockRequestor.setGlobalDelay(30)

      const result = await concurrentFeature.requestConcurrent(configs, {
        maxConcurrency: 8,
        failFast: false
      })

      expect(result).toHaveLength(50)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 50)

      const failureCount = result.filter(r => !r.success).length
      expect(failureCount).toBeGreaterThan(10) // 至少有一些失败
      expect(failureCount).toBeLessThan(25) // 但不是全部失败

      // 系统应该仍然能够正常运行
      const stats = concurrentFeature.getConcurrentStats()
      expect(stats.total).toBe(50)
      expect(stats.completed).toBe(50)
      expect(stats.successful + stats.failed).toBe(50)
    })
  })
})
