import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RetryFeature } from '../../src/features/retry'
import { RequestError } from '../../src/interface'
import {
  RetryMockRequestor,
  createRetryMockRequestor,
  cleanupRetryTest,
  RETRY_TEST_CONFIGS,
  RETRY_TEST_RESPONSES
} from './retry-test-helpers'

describe('重试配置参数验证测试', () => {
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

  describe('重试次数配置验证', () => {
    test('负数重试次数应该抛出错误', async () => {
      const invalidConfig = { retries: -1 }

      await expect(
        retryFeature.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, invalidConfig)
      ).rejects.toThrow('Retries must be non-negative')

      expect(mockRequestor.getCallCount()).toBe(0)
    })

    test('零重试次数应该只请求一次', async () => {
      const testError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true])
      mockRequestor.setError(testError)

      const noRetriesConfig = { retries: 0 }

      await expect(
        retryFeature.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, noRetriesConfig)
      ).rejects.toThrow('Server error')

      expect(mockRequestor.getCallCount()).toBe(1)
    })

    test('正常重试次数应该正确工作', async () => {
      vi.useFakeTimers()
      
      const testError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, true, true, true, true, true])
      mockRequestor.setError(testError)

      const config = { retries: 5 }

      const resultPromise = retryFeature.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, config)
      
      // 快进时间完成所有重试
      await vi.advanceTimersByTimeAsync(6000)

      await expect(resultPromise).rejects.toThrow('Server error')

      // 重试5次，总共尝试6次
      expect(mockRequestor.getCallCount()).toBe(6)
      
      vi.useRealTimers()
    })
  })

  describe('延迟配置验证', () => {
    test('负数延迟应该抛出错误', async () => {
      const invalidConfig = { retries: 3, delay: -100 }

      await expect(
        retryFeature.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, invalidConfig)
      ).rejects.toThrow('Delay must be non-negative')

      expect(mockRequestor.getCallCount()).toBe(0)
    })

    test('零延迟应该立即重试', async () => {
      vi.useFakeTimers()
      
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const zeroDelayConfig = { retries: 3, delay: 0 }

      const startTime = Date.now()
      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        zeroDelayConfig
      )

      // 不需要等待时间
      const result = await resultPromise
      const endTime = Date.now()

      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(endTime - startTime).toBeLessThan(100) // 应该几乎立即完成

      vi.useRealTimers()
    })

    test('正数延迟应该等待指定时间', async () => {
      vi.useFakeTimers()
      
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const delayConfig = { retries: 3, delay: 500 }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        delayConfig
      )

      // 第一次失败后，需要等待500ms
      expect(mockRequestor.getCallCount()).toBe(1)
      
      await vi.advanceTimersByTimeAsync(500)
      
      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(2)

      vi.useRealTimers()
    })

    test('未配置延迟应该使用默认值1000ms', async () => {
      vi.useFakeTimers()
      
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const noDelayConfig = { retries: 3 }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        noDelayConfig
      )

      // 第一次失败后，需要等待默认的1000ms
      expect(mockRequestor.getCallCount()).toBe(1)
      
      await vi.advanceTimersByTimeAsync(1000)
      
      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

      vi.useRealTimers()
    })
  })

  describe('退避因子配置验证', () => {
    test('零或负数退避因子应该抛出错误', async () => {
      const invalidConfigs = [
        { retries: 3, backoffFactor: 0 },
        { retries: 3, backoffFactor: -1 },
        { retries: 3, backoffFactor: -0.5 }
      ]

      for (const config of invalidConfigs) {
        await expect(
          retryFeature.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, config)
        ).rejects.toThrow('Backoff factor must be positive')

        expect(mockRequestor.getCallCount()).toBe(0)
        mockRequestor.reset()
      }
    })

    test('退避因子为1时应该使用固定延迟', async () => {
      vi.useFakeTimers()
      
      mockRequestor.setFailPattern([true, true, false])
      mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const fixedDelayConfig = { retries: 3, delay: 200, backoffFactor: 1 }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        fixedDelayConfig
      )

      // 第一次重试延迟：200ms
      await vi.advanceTimersByTimeAsync(200)
      expect(mockRequestor.getCallCount()).toBe(2)

      // 第二次重试延迟：仍然是200ms
      await vi.advanceTimersByTimeAsync(200)
      
      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

      vi.useRealTimers()
    })

    test('退避因子大于1时应该使用指数退避', async () => {
      vi.useFakeTimers()
      
      mockRequestor.setFailPattern([true, true, false])
      mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const exponentialBackoffConfig = { retries: 3, delay: 100, backoffFactor: 2 }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        exponentialBackoffConfig
      )

      // 第一次重试延迟：100ms
      await vi.advanceTimersByTimeAsync(100)
      expect(mockRequestor.getCallCount()).toBe(2)

      // 第二次重试延迟：100 * 2^1 = 200ms
      await vi.advanceTimersByTimeAsync(200)
      
      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

      vi.useRealTimers()
    })

    test('未配置退避因子时应该使用固定延迟', async () => {
      vi.useFakeTimers()
      
      mockRequestor.setFailPattern([true, true, false])
      mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const config = { retries: 3, delay: 150 }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        config
      )

      // 两次重试延迟都应该是150ms
      await vi.advanceTimersByTimeAsync(150)
      expect(mockRequestor.getCallCount()).toBe(2)

      await vi.advanceTimersByTimeAsync(150)
      
      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)

      vi.useRealTimers()
    })
  })

  describe('抖动配置验证', () => {
    test('超出范围的抖动值应该抛出错误', async () => {
      const invalidConfigs = [
        { retries: 3, jitter: -0.1 },
        { retries: 3, jitter: 1.1 },
        { retries: 3, jitter: 2 }
      ]

      for (const config of invalidConfigs) {
        await expect(
          retryFeature.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, config)
        ).rejects.toThrow('Jitter must be between 0 and 1')

        expect(mockRequestor.getCallCount()).toBe(0)
        mockRequestor.reset()
      }
    })

    test('有效的抖动值应该正常工作', async () => {
      vi.useFakeTimers()
      
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const validJitterConfigs = [
        { retries: 3, delay: 200, jitter: 0 },
        { retries: 3, delay: 200, jitter: 0.1 },
        { retries: 3, delay: 200, jitter: 0.5 },
        { retries: 3, delay: 200, jitter: 1 }
      ]

      for (const config of validJitterConfigs) {
        const resultPromise = retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          config
        )

        // 等待足够的时间完成重试
        await vi.advanceTimersByTimeAsync(500)
        
        const result = await resultPromise
        expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
        expect(mockRequestor.getCallCount()).toBe(2)

        mockRequestor.reset()
        // 重置后需要重新设置失败模式和响应
        mockRequestor.setFailPattern([true, false])
        mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
        mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)
      }

      vi.useRealTimers()
    })

    test('抖动应该在预期范围内随机化延迟时间', async () => {
      vi.useFakeTimers()
      
      const originalMathRandom = Math.random
      let randomCallCount = 0
      Math.random = vi.fn(() => {
        // 模拟固定的随机值来测试抖动计算
        randomCallCount++
        return 0.5
      })

      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const jitterConfig = { retries: 3, delay: 200, jitter: 0.2 }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        jitterConfig
      )

      // 计算预期延迟：200 + (200 * 0.2 * 0.5) = 220ms
      await vi.advanceTimersByTimeAsync(220)
      
      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(randomCallCount).toBeGreaterThan(0)

      Math.random = originalMathRandom
      vi.useRealTimers()
    })
  })

  describe('自定义重试条件配置验证', () => {
    test('自定义重试条件应该被正确调用', async () => {
      const customShouldRetry = vi.fn(() => true)
      const testError = new RequestError('Server error', { status: 500, isHttpError: true })
      
      mockRequestor.setFailPattern([true, true, false])
      mockRequestor.setError(testError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const customConfig = {
        retries: 3,
        shouldRetry: customShouldRetry
      }

      await retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        customConfig
      )

      expect(customShouldRetry).toHaveBeenCalledTimes(2)
      expect(customShouldRetry).toHaveBeenCalledWith(testError, 0)
      expect(customShouldRetry).toHaveBeenCalledWith(testError, 1)
    })

    test('自定义重试条件返回false时应该停止重试', async () => {
      const customShouldRetry = vi.fn(() => false)
      const testError = new RequestError('Server error', { status: 500, isHttpError: true })
      
      mockRequestor.setFailPattern([true, true, true])
      mockRequestor.setError(testError)

      const customConfig = {
        retries: 3,
        shouldRetry: customShouldRetry
      }

      await expect(
        retryFeature.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, customConfig)
      ).rejects.toThrow('Server error')

      // 第一次失败后，自定义函数返回false，不再重试
      expect(mockRequestor.getCallCount()).toBe(1)
      expect(customShouldRetry).toHaveBeenCalledTimes(1)
    })

    test('未配置自定义重试条件时应该使用默认条件', async () => {
      const serverError = new RequestError('Server error', { status: 500, isHttpError: true })
      
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const defaultConfig = { retries: 3 }

      const result = await retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        defaultConfig
      )

      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(2)
    })
  })

  describe('完整配置组合测试', () => {
    test('所有配置参数应该协同工作', async () => {
      vi.useFakeTimers()
      
      const customShouldRetry = vi.fn(() => true)
      const originalMathRandom = Math.random
      Math.random = vi.fn(() => 0.5)

      const testError = new RequestError('Server error', { status: 500, isHttpError: true })
      mockRequestor.setFailPattern([true, true, false])
      mockRequestor.setError(testError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const fullConfig = {
        retries: 5,
        delay: 100,
        backoffFactor: 2,
        jitter: 0.1,
        shouldRetry: customShouldRetry
      }

      const resultPromise = retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        fullConfig
      )

      // 第一次重试延迟计算：100 + (100 * 0.1 * 0.5) = 105ms
      await vi.advanceTimersByTimeAsync(105)
      expect(mockRequestor.getCallCount()).toBe(2)

      // 第二次重试延迟计算：200 + (200 * 0.1 * 0.5) = 210ms
      await vi.advanceTimersByTimeAsync(210)
      
      const result = await resultPromise
      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(customShouldRetry).toHaveBeenCalledTimes(2)

      Math.random = originalMathRandom
      vi.useRealTimers()
    })
  })
})
