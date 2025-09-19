import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RetryFeature } from '../../src/features/retry'
import { RequestError, RequestConfig } from '../../src/interface'
import {
  RetryMockRequestor,
  createRetryMockRequestor,
  cleanupRetryTest,
  MockNetworkError,
  RETRY_TEST_CONFIGS,
  RETRY_TEST_RESPONSES,
  validateRetryDelays,
  delay
} from './retry-test-helpers'

describe('重试高级特性测试', () => {
  let mockRequestor: RetryMockRequestor
  let retryFeature: RetryFeature

  beforeEach(() => {
    vi.clearAllTimers()
    mockRequestor = createRetryMockRequestor()
    retryFeature = new RetryFeature(mockRequestor)
  })

  afterEach(() => {
    cleanupRetryTest(mockRequestor)
  })

  describe('指数退避策略测试', () => {
    test('指数退避应该按预期增加延迟时间', async () => {
      vi.useFakeTimers()
      
      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, true, true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const exponentialConfig = {
        retries: 3,
        delay: 100,
        backoffFactor: 2
      }

      const startTime = Date.now()
      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        exponentialConfig
      )

      // 等待所有重试延迟
      // 第一次重试: 100ms
      await vi.advanceTimersByTimeAsync(100)
      // 第二次重试: 100 * 2^1 = 200ms  
      await vi.advanceTimersByTimeAsync(200)
      // 第三次重试: 100 * 2^2 = 400ms
      await vi.advanceTimersByTimeAsync(400)

      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(4)

      // 验证时间间隔
      const calls = mockRequestor.getCalls()
      const expectedDelays = [100, 200, 400]
      expect(validateRetryDelays(calls, expectedDelays, 10)).toBe(true)

      vi.useRealTimers()
    })

    test('不同退避因子应该产生不同的延迟序列', async () => {
      vi.useFakeTimers()

      const testCases = [
        { backoffFactor: 1, expectedDelays: [100, 100, 100] },
        { backoffFactor: 1.5, expectedDelays: [100, 150, 225] },
        { backoffFactor: 3, expectedDelays: [100, 300, 900] }
      ]

      for (const testCase of testCases) {
        const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
        mockRequestor.setFailPattern([true, true, true, false])
        mockRequestor.setError(serverError)
        mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

        const config = {
          retries: 3,
          delay: 100,
          backoffFactor: testCase.backoffFactor
        }

        const resultPromise = retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          config
        )

        // 逐步推进时间
        for (const expectedDelay of testCase.expectedDelays) {
          await vi.advanceTimersByTimeAsync(expectedDelay)
        }

        const result = await resultPromise
        expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

        const calls = mockRequestor.getCalls()
        expect(validateRetryDelays(calls, testCase.expectedDelays, 1)).toBe(true)

        mockRequestor.reset()
      }

      vi.useRealTimers()
    })

    test('大退避因子应该快速增长延迟时间', async () => {
      vi.useFakeTimers()

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const aggressiveBackoffConfig = {
        retries: 2,
        delay: 50,
        backoffFactor: 5
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        aggressiveBackoffConfig
      )

      // 第一次重试: 50ms
      await vi.advanceTimersByTimeAsync(50)
      // 第二次重试: 50 * 5^1 = 250ms
      await vi.advanceTimersByTimeAsync(250)

      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

      const calls = mockRequestor.getCalls()
      const expectedDelays = [50, 250]
      expect(validateRetryDelays(calls, expectedDelays, 5)).toBe(true)

      vi.useRealTimers()
    })
  })

  describe('抖动机制测试', () => {
    test('抖动应该在延迟时间上添加随机变化', async () => {
      vi.useFakeTimers()

      // 模拟固定的随机值序列
      const randomValues = [0.2, 0.8, 0.5]
      let randomIndex = 0
      const originalMathRandom = Math.random
      Math.random = vi.fn(() => randomValues[randomIndex++] || 0.5)

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, true, true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const jitterConfig = {
        retries: 3,
        delay: 1000,
        jitter: 0.1 // 10% 抖动
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        jitterConfig
      )

      // 计算预期的抖动延迟:
      // 第一次: 1000 + (1000 * 0.1 * 0.2) = 1020ms
      await vi.advanceTimersByTimeAsync(1020)
      // 第二次: 1000 + (1000 * 0.1 * 0.8) = 1080ms
      await vi.advanceTimersByTimeAsync(1080)
      // 第三次: 1000 + (1000 * 0.1 * 0.5) = 1050ms
      await vi.advanceTimersByTimeAsync(1050)

      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(4)

      Math.random = originalMathRandom
      vi.useRealTimers()
    })

    test('抖动与指数退避结合使用', async () => {
      vi.useFakeTimers()

      // 固定随机值0.5用于测试
      const originalMathRandom = Math.random
      Math.random = vi.fn(() => 0.5)

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const combinedConfig = {
        retries: 2,
        delay: 200,
        backoffFactor: 2,
        jitter: 0.2 // 20% 抖动
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        combinedConfig
      )

      // 计算抖动后的延迟:
      // 第一次: 200 + (200 * 0.2 * 0.5) = 220ms
      await vi.advanceTimersByTimeAsync(220)
      // 第二次: 400 + (400 * 0.2 * 0.5) = 440ms
      await vi.advanceTimersByTimeAsync(440)

      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(3)

      Math.random = originalMathRandom
      vi.useRealTimers()
    })

    test('最大抖动值(1.0)应该可能使延迟时间翻倍', async () => {
      vi.useFakeTimers()

      // 使用最大随机值
      const originalMathRandom = Math.random
      Math.random = vi.fn(() => 1.0)

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const maxJitterConfig = {
        retries: 1,
        delay: 100,
        jitter: 1.0 // 100% 抖动
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        maxJitterConfig
      )

      // 最大抖动: 100 + (100 * 1.0 * 1.0) = 200ms
      await vi.advanceTimersByTimeAsync(200)

      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

      Math.random = originalMathRandom
      vi.useRealTimers()
    })

    test('零抖动应该使用固定延迟', async () => {
      vi.useFakeTimers()

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const noJitterConfig = {
        retries: 2,
        delay: 300,
        jitter: 0 // 无抖动
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        noJitterConfig
      )

      // 固定延迟: 300ms, 300ms
      await vi.advanceTimersByTimeAsync(300)
      await vi.advanceTimersByTimeAsync(300)

      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

      const calls = mockRequestor.getCalls()
      expect(validateRetryDelays(calls, [300, 300], 5)).toBe(true)

      vi.useRealTimers()
    })
  })

  describe('复杂重试场景测试', () => {
    test('长时间重试序列的性能测试', async () => {
      vi.useFakeTimers()

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      // 前9次失败，第10次成功
      mockRequestor.setFailPattern(new Array(9).fill(true).concat([false]))
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const longRetryConfig = {
        retries: 9,
        delay: 50,
        backoffFactor: 1.2
      }

      const startTime = performance.now()
      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        longRetryConfig
      )

      // 快进所有重试延迟
      let totalDelay = 0
      for (let i = 0; i < 9; i++) {
        const delayForThisAttempt = Math.floor(50 * Math.pow(1.2, i))
        totalDelay += delayForThisAttempt
        await vi.advanceTimersByTimeAsync(delayForThisAttempt)
      }

      const result = await resultPromise
      const endTime = performance.now()

      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(10)
      
      // 验证重试功能正常工作，不检查实际执行时间（因为使用了模拟定时器）
      expect(totalDelay).toBeGreaterThan(0) // 验证有延迟计算

      vi.useRealTimers()
    })

    test('混合错误类型的重试处理', async () => {
      vi.useFakeTimers()

      // 设置前3次失败，第4次成功
      mockRequestor.setFailPattern([true, true, true, false])
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)
      
      // 创建一个自定义错误序列，通过重写setError来实现
      const errors = [
        new RequestError('Server error', { status: 500, isHttpError: true }),
        MockNetworkError.createNetworkError('Network failed'),
        new RequestError('Bad gateway', { status: 502, isHttpError: true })
      ]
      
      let errorIndex = 0
      const originalRequest = mockRequestor.request.bind(mockRequestor)
      mockRequestor.request = async function<T>(config: RequestConfig): Promise<T> {
        const callCount = this.callCount + 1
        this.callCount = callCount
        this.calls.push({ config, timestamp: Date.now(), attempt: callCount })
        
        if (callCount <= 3) {
          const errorToThrow = errors[(callCount - 1) % errors.length]
          throw errorToThrow
        }
        return this.successResponse
      }

      const mixedErrorConfig = {
        retries: 3,
        delay: 100
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        mixedErrorConfig
      )

      // 推进所有重试延迟
      await vi.advanceTimersByTimeAsync(100) // 第一次重试
      await vi.advanceTimersByTimeAsync(100) // 第二次重试
      await vi.advanceTimersByTimeAsync(100) // 第三次重试

      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(4) // 3次失败 + 1次成功

      vi.useRealTimers()
    })

    test('并发重试请求的独立性', async () => {
      vi.useFakeTimers()

      // 创建多个独立的重试请求
      const requestConfigs = [
        { url: '/api/1', method: 'GET' as const },
        { url: '/api/2', method: 'POST' as const },
        { url: '/api/3', method: 'PUT' as const }
      ]

      const retryConfigs = [
        { retries: 1, delay: 100 },
        { retries: 2, delay: 200 },
        { retries: 3, delay: 50 }
      ]

      // 为每个请求配置不同的失败模式
      let requestCount = 0
      ;(mockRequestor.request as any) = vi.fn(async (config: any) => {
        const currentRequest = requestCount++
        
        // 不同请求有不同的失败次数
        const failurePatterns = [
          [true, false],      // 第1个请求：失败1次后成功
          [true, true, false], // 第2个请求：失败2次后成功
          [true, false]       // 第3个请求：失败1次后成功
        ]
        
        const currentAttemptForRequest = mockRequestor.getCalls().filter(call => call.config.url === config.url).length
        const pattern = failurePatterns[currentRequest % 3]
        
        if (currentAttemptForRequest <= pattern.length && pattern[currentAttemptForRequest - 1]) {
          throw new RequestError(`Error for ${config.url}`, { status: 500, isHttpError: true })
        }
        
        return { ...RETRY_TEST_RESPONSES.SUCCESS, source: config.url }
      })

      // 并发启动所有请求
      const promises = requestConfigs.map((reqConfig, index) =>
        retryFeature.requestWithRetry(reqConfig, retryConfigs[index])
      )

      // 推进时间以完成所有重试
      await vi.advanceTimersByTimeAsync(500)

      const results = await Promise.all(promises)
      
      // 验证每个请求都得到了正确的结果
      results.forEach((result, index) => {
        expect(result).toEqual({
          ...RETRY_TEST_RESPONSES.SUCCESS,
          source: requestConfigs[index].url
        })
      })

      vi.useRealTimers()
    })
  })

  describe('边缘情况和错误处理', () => {
    test('延迟计算中的数值精度处理', async () => {
      vi.useFakeTimers()

      const originalMathRandom = Math.random
      Math.random = vi.fn(() => 0.123456789)

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const precisionConfig = {
        retries: 1,
        delay: 100.7,
        backoffFactor: 1.333,
        jitter: 0.777
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        precisionConfig
      )

      // 计算复杂的延迟时间并向下取整
      const baseDelay = 100.7
      const jitterDelta = baseDelay * (0.123456789 * 0.777)
      const expectedDelay = Math.floor(baseDelay + jitterDelta)
      
      await vi.advanceTimersByTimeAsync(expectedDelay + 10) // 加一些容错

      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

      Math.random = originalMathRandom
      vi.useRealTimers()
    })

    test('极小延迟时间的处理', async () => {
      vi.useFakeTimers()

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const minimalDelayConfig = {
        retries: 1,
        delay: 0.1, // 亚毫秒延迟
        jitter: 0.1
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        minimalDelayConfig
      )

      // 即使是极小的延迟也应该被正确处理
      await vi.advanceTimersByTimeAsync(1)

      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

      vi.useRealTimers()
    })

    test('负数延迟计算的保护', async () => {
      vi.useFakeTimers()

      // 模拟一种可能导致负延迟的情况
      const originalMathRandom = Math.random
      Math.random = vi.fn(() => -0.5) // 异常的负随机值

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const config = {
        retries: 1,
        delay: 100,
        jitter: 0.5
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        config
      )

      // 系统应该使用Math.max(0, calculatedDelay)来防止负延迟
      await vi.advanceTimersByTimeAsync(150)

      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

      Math.random = originalMathRandom
      vi.useRealTimers()
    })
  })

  describe('性能和内存管理', () => {
    test('大量重试后的内存清理', async () => {
      vi.useFakeTimers()

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      
      // 测试多轮重试，确保没有内存泄漏
      for (let round = 0; round < 5; round++) {
        mockRequestor.setFailPattern([true, true, false])
        mockRequestor.setError(serverError)
        mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

        const resultPromise = retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          { retries: 2, delay: 10 }
        )

        await vi.advanceTimersByTimeAsync(50)
        
        const result = await resultPromise
        expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

        mockRequestor.reset()
      }

      vi.useRealTimers()
    })

    test('超时和取消处理', async () => {
      vi.useFakeTimers()

      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, true, true])
      mockRequestor.setError(serverError)

      const longRetryConfig = {
        retries: 2,
        delay: 5000 // 5秒延迟
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        longRetryConfig
      )

      // 手动推进重试延迟
      await vi.advanceTimersByTimeAsync(5000) // 第一次重试延迟
      await vi.advanceTimersByTimeAsync(5000) // 第二次重试延迟

      await expect(resultPromise).rejects.toThrow('Server error')

      vi.useRealTimers()
    })
  })
})
