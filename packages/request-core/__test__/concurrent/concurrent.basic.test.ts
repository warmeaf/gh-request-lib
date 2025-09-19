import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConcurrentFeature } from '../../src/features/concurrent'
import { RequestConfig } from '../../src/interface'
import {
  ConcurrentMockRequestor,
  ConcurrentTestDataGenerator,
  ConcurrentTestAssertions,
  ConcurrentPerformanceHelper,
  MockConcurrentNetworkError
} from './concurrent-test-helpers'

describe('ConcurrentFeature - 基础功能', () => {
  let mockRequestor: ConcurrentMockRequestor
  let concurrentFeature: ConcurrentFeature

  beforeEach(() => {
    mockRequestor = new ConcurrentMockRequestor()
    concurrentFeature = new ConcurrentFeature(mockRequestor)
  })

  describe('基本并发请求执行', () => {
    it('应该并发执行多个请求', async () => {
      // 准备数据
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      mockRequestor.setGlobalDelay(100)

      // 执行测试
      const { result, duration } = await ConcurrentPerformanceHelper.measureExecutionTime(
        () => concurrentFeature.requestConcurrent(configs)
      )

      // 验证结果
      expect(result).toHaveLength(3)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 3)
      ConcurrentTestAssertions.verifySuccessRate(result, 3)

      // 验证性能 - 并发执行应该比顺序执行快
      expect(duration).toBeLessThan(250) // 如果顺序执行需要300ms，并发应该约100ms
      
      // 验证结果顺序
      result.forEach((res, index) => {
        expect(res.index).toBe(index)
        expect(res.success).toBe(true)
        expect(res.data).toBeDefined()
        expect(res.config.url).toBe(configs[index].url)
      })
    })

    it('应该处理空配置数组', async () => {
      const result = await concurrentFeature.requestConcurrent([])
      
      expect(result).toHaveLength(0)
      expect(Array.isArray(result)).toBe(true)
    })

    it('应该处理单个请求', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(1)
      mockRequestor.setGlobalDelay(50)

      const result = await concurrentFeature.requestConcurrent(configs)

      expect(result).toHaveLength(1)
      expect(result[0].success).toBe(true)
      expect(result[0].index).toBe(0)
      expect(result[0].config.url).toBe(configs[0].url)
      expect(result[0].duration).toBeGreaterThan(40)
    })

    it('应该保持结果索引正确性', async () => {
      // 使用不同的延迟确保请求以不同顺序完成
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      mockRequestor.setUrlDelay(configs[0].url!, 100)
      mockRequestor.setUrlDelay(configs[1].url!, 50)
      mockRequestor.setUrlDelay(configs[2].url!, 200)
      mockRequestor.setUrlDelay(configs[3].url!, 10)
      mockRequestor.setUrlDelay(configs[4].url!, 150)

      const result = await concurrentFeature.requestConcurrent(configs)

      // 验证结果按原始索引排序
      expect(result).toHaveLength(5)
      for (let i = 0; i < 5; i++) {
        expect(result[i].index).toBe(i)
        expect(result[i].config.url).toBe(configs[i].url)
      }
    })
  })

  describe('requestMultiple 功能', () => {
    it('应该执行相同配置的多个请求', async () => {
      const baseConfig: RequestConfig = {
        url: '/api/multiple-test',
        method: 'GET',
        headers: { 'X-Test': 'multiple' }
      }
      mockRequestor.setGlobalDelay(50)

      const result = await concurrentFeature.requestMultiple(baseConfig, 4)

      expect(result).toHaveLength(4)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 4)
      ConcurrentTestAssertions.verifySuccessRate(result, 4)

      // 验证每个请求都使用相同的基础配置
      result.forEach((res, index) => {
        expect(res.success).toBe(true)
        expect(res.index).toBe(index)
        expect(res.config.url).toBe(baseConfig.url)
        expect(res.config.method).toBe(baseConfig.method)
        expect(res.config.headers?.['X-Test']).toBe('multiple')
        expect((res.config as any).__requestIndex).toBe(index)
      })
    })

    it('应该处理零计数请求', async () => {
      const baseConfig: RequestConfig = { url: '/api/test', method: 'GET' }
      
      const result = await concurrentFeature.requestMultiple(baseConfig, 0)
      
      expect(result).toHaveLength(0)
      expect(Array.isArray(result)).toBe(true)
    })

    it('应该处理负计数请求', async () => {
      const baseConfig: RequestConfig = { url: '/api/test', method: 'GET' }
      
      const result = await concurrentFeature.requestMultiple(baseConfig, -5)
      
      expect(result).toHaveLength(0)
      expect(Array.isArray(result)).toBe(true)
    })

    it('应该支持带配置的多重请求', async () => {
      const baseConfig: RequestConfig = { url: '/api/multiple-with-config', method: 'POST' }
      const concurrentConfig = { maxConcurrency: 2 }
      mockRequestor.setGlobalDelay(100)

      const { result, duration } = await ConcurrentPerformanceHelper.measureExecutionTime(
        () => concurrentFeature.requestMultiple(baseConfig, 6, concurrentConfig)
      )

      expect(result).toHaveLength(6)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 6)
      ConcurrentTestAssertions.verifyConcurrencyLimit(mockRequestor, 2)

      // 由于并发限制为2，执行时间应该约为 6/2 * 100 = 300ms
      expect(duration).toBeGreaterThan(250)
      expect(duration).toBeLessThan(400)
    })
  })

  describe('结果收集和处理', () => {
    it('应该正确收集成功和失败的结果', async () => {
      const { configs, expectedSuccessIndices, expectedFailIndices } = 
        ConcurrentTestDataGenerator.generateMixedConfigs(3, 2)

      // 设置失败的请求
      expectedFailIndices.forEach(index => {
        mockRequestor.setUrlFailure(
          configs[index].url!,
          true,
          MockConcurrentNetworkError.createNetworkError(`Failure for index ${index}`, index)
        )
      })

      const result = await concurrentFeature.requestConcurrent(configs)

      expect(result).toHaveLength(5)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 5)
      
      // 验证成功结果
      const successfulResults = result.filter(r => r.success)
      expect(successfulResults).toHaveLength(3)
      successfulResults.forEach(res => {
        expect(expectedSuccessIndices).toContain(res.index)
        expect(res.data).toBeDefined()
        expect(res.error).toBeUndefined()
      })

      // 验证失败结果
      const failedResults = result.filter(r => !r.success)
      expect(failedResults).toHaveLength(2)
      failedResults.forEach(res => {
        expect(expectedFailIndices).toContain(res.index)
        expect(res.data).toBeUndefined()
        expect(res.error).toBeDefined()
        expect(res.error).toBeInstanceOf(MockConcurrentNetworkError)
      })
    })

    it('应该记录请求持续时间', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      mockRequestor.setGlobalDelay(100)

      const result = await concurrentFeature.requestConcurrent(configs)

      result.forEach(res => {
        expect(res.duration).toBeDefined()
        expect(res.duration).toBeGreaterThan(90) // 考虑执行误差
        expect(res.duration).toBeLessThan(200)
      })
    })

    it('应该正确设置重试计数', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(2)
      
      const result = await concurrentFeature.requestConcurrent(configs)

      result.forEach(res => {
        expect(res.retryCount).toBe(0) // 基础并发不涉及重试
      })
    })

    it('应该返回请求配置信息', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      configs.forEach((config, index) => {
        config.headers = { 'X-Index': index.toString() }
      })

      const result = await concurrentFeature.requestConcurrent(configs)

      result.forEach((res, index) => {
        expect(res.config).toEqual(configs[index])
        expect(res.config.headers?.['X-Index']).toBe(index.toString())
      })
    })
  })

  describe('无限制并发执行', () => {
    it('应该同时执行所有请求（无并发限制）', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(10)
      mockRequestor.setGlobalDelay(100)

      // 不设置 maxConcurrency，默认无限制并发
      const { result, duration } = await ConcurrentPerformanceHelper.measureExecutionTime(
        () => concurrentFeature.requestConcurrent(configs, {})
      )

      expect(result).toHaveLength(10)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 10)
      ConcurrentTestAssertions.verifySuccessRate(result, 10)

      // 无限制并发应该接近单个请求时间
      expect(duration).toBeGreaterThan(90)
      expect(duration).toBeLessThan(150)

      // 验证所有请求都被同时处理
      const stats = mockRequestor.getCallStats()
      expect(stats.maxActiveCalls).toBe(10)
    })

    it('应该处理大量并发请求', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(50)
      mockRequestor.setGlobalDelay(50)

      const result = await concurrentFeature.requestConcurrent(configs)

      expect(result).toHaveLength(50)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 50)
      ConcurrentTestAssertions.verifySuccessRate(result, 50)

      // 验证高并发处理
      const stats = mockRequestor.getCallStats()
      expect(stats.maxActiveCalls).toBe(50)
    })

    it('应该正确处理不同响应时间的并发请求', async () => {
      const { configs, delays } = ConcurrentTestDataGenerator.generateVariableDelayConfigs(8, 200)
      
      // 设置不同的延迟
      configs.forEach((config, index) => {
        mockRequestor.setUrlDelay(config.url!, delays[index])
      })

      const startTime = Date.now()
      const result = await concurrentFeature.requestConcurrent(configs)
      const totalDuration = Date.now() - startTime

      expect(result).toHaveLength(8)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 8)

      // 总执行时间应该接近最大延迟时间
      const maxDelay = Math.max(...delays)
      expect(totalDuration).toBeGreaterThan(maxDelay - 50)
      expect(totalDuration).toBeLessThan(maxDelay + 100)

      // 验证每个请求的执行时间
      result.forEach((res, index) => {
        const expectedDelay = delays[index]
        expect(res.duration).toBeGreaterThan(expectedDelay - 20)
        expect(res.duration).toBeLessThan(expectedDelay + 50)
      })
    })
  })

  describe('基础错误处理', () => {
    it('应该继续执行其他请求当某些请求失败时', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(5)
      
      // 设置第2和第4个请求失败
      mockRequestor.setUrlFailure(configs[1].url!, true)
      mockRequestor.setUrlFailure(configs[3].url!, true)
      mockRequestor.setGlobalDelay(50)

      const result = await concurrentFeature.requestConcurrent(configs)

      expect(result).toHaveLength(5)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 5)

      // 验证成功的请求
      const successfulResults = result.filter(r => r.success)
      expect(successfulResults).toHaveLength(3)
      expect(successfulResults.map(r => r.index)).toEqual([0, 2, 4])

      // 验证失败的请求
      const failedResults = result.filter(r => !r.success)
      expect(failedResults).toHaveLength(2)
      expect(failedResults.map(r => r.index)).toEqual([1, 3])
    })

    it('应该捕获并记录请求异常', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(3)
      const customError = new Error('Custom test error')
      
      mockRequestor.setUrlFailure(configs[1].url!, true, customError)

      const result = await concurrentFeature.requestConcurrent(configs)

      const failedResult = result.find(r => r.index === 1)
      expect(failedResult).toBeDefined()
      expect(failedResult!.success).toBe(false)
      expect(failedResult!.error).toBe(customError)
      expect(failedResult!.data).toBeUndefined()
    })

    it('应该正确处理混合成功失败场景', async () => {
      const configs = ConcurrentTestDataGenerator.generateRequestConfigs(6)
      
      // 设置50%失败率
      mockRequestor.setGlobalFailureRate(0.5)
      mockRequestor.setGlobalDelay(50)

      const result = await concurrentFeature.requestConcurrent(configs)

      expect(result).toHaveLength(6)
      ConcurrentTestAssertions.verifyResultCompleteness(result, 6)

      // 应该有成功和失败的结果
      const successCount = result.filter(r => r.success).length
      const failureCount = result.filter(r => !r.success).length

      expect(successCount + failureCount).toBe(6)
      expect(successCount).toBeGreaterThan(0) // 至少有一些成功
      expect(successCount).toBeLessThan(6)   // 也有一些失败（虽然随机性可能导致偶尔全成功）
    })
  })
})
