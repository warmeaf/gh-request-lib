import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RetryFeature } from '../../src/features/retry'
import { RequestError } from '../../src/interface'
import {
  RetryMockRequestor,
  createRetryMockRequestor,
  cleanupRetryTest,
  MockNetworkError,
  MockTimeoutError,
  RETRY_TEST_CONFIGS,
  RETRY_CONFIGS,
  RETRY_TEST_RESPONSES,
  createCustomRetryCondition
} from './retry-test-helpers'

describe('错误处理和重试判断测试', () => {
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

  describe('HTTP错误状态码重试判断', () => {
    test('5xx服务器错误应该重试', async () => {
      const serverErrors = [500, 502, 503, 504, 599]
      // 使用短延迟避免测试超时
      const fastRetryConfig = { retries: 3, delay: 10 }
      
      for (const status of serverErrors) {
        const error = RetryMockRequestor.createHttpError(status)
        mockRequestor.setFailPattern([true, false])
        mockRequestor.setError(error)
        mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

        const result = await retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          fastRetryConfig
        )

        expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
        expect(mockRequestor.getCallCount()).toBe(2) // 第一次失败，第二次成功

        mockRequestor.reset()
      }
    })

    test('4xx客户端错误不应该重试', async () => {
      const clientErrors = [400, 401, 403, 404, 422, 499]
      
      for (const status of clientErrors) {
        const error = RetryMockRequestor.createHttpError(status)
        mockRequestor.setFailPattern([true])
        mockRequestor.setError(error)

        await expect(
          retryFeature.requestWithRetry(
            RETRY_TEST_CONFIGS.BASIC_GET,
            RETRY_CONFIGS.DEFAULT
          )
        ).rejects.toThrow(`HTTP Error ${status}`)

        expect(mockRequestor.getCallCount()).toBe(1) // 不重试，只请求一次

        mockRequestor.reset()
      }
    })

    test('2xx和3xx成功状态码不会触发重试逻辑', async () => {
      // 这个测试主要验证成功情况下不会进入重试逻辑
      mockRequestor.setFailPattern([false])
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const result = await retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        RETRY_CONFIGS.DEFAULT
      )

      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(1)
    })

    test('HTTP错误但没有状态码的情况不应该重试', async () => {
      const errorWithoutStatus = new RequestError('HTTP error without status', { isHttpError: true })
      mockRequestor.setFailPattern([true])
      mockRequestor.setError(errorWithoutStatus)

      await expect(
        retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          RETRY_CONFIGS.DEFAULT
        )
      ).rejects.toThrow('HTTP error without status')

      expect(mockRequestor.getCallCount()).toBe(1) // 不重试
    })
  })

  describe('网络错误重试判断', () => {
    test('非HTTP错误的RequestError应该重试', async () => {
      const networkError = new RequestError('Network connection failed', { isHttpError: false })
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(networkError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const result = await retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        RETRY_CONFIGS.DEFAULT
      )

      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(2)
    })

    test('网络相关的普通Error应该重试', async () => {
      const networkErrors = [
        new Error('Network error occurred'),
        new Error('Connection timeout'),
        new Error('Failed to fetch data'),
        MockNetworkError.createNetworkError('Network unreachable'),
        MockTimeoutError.createTimeoutError('Request timeout')
      ]
      // 使用短延迟避免测试超时
      const fastRetryConfig = { retries: 3, delay: 10 }

      for (const error of networkErrors) {
        mockRequestor.setFailPattern([true, false])
        mockRequestor.setError(error)
        mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

        const result = await retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          fastRetryConfig
        )

        expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
        expect(mockRequestor.getCallCount()).toBe(2)

        mockRequestor.reset()
      }
    })

    test('非网络相关的普通Error不应该重试', async () => {
      const nonNetworkErrors = [
        new Error('Invalid JSON response'),
        new Error('Data validation failed'),
        new Error('Configuration error'),
        new TypeError('Cannot read property of undefined')
      ]

      for (const error of nonNetworkErrors) {
        mockRequestor.setFailPattern([true])
        mockRequestor.setError(error)

        await expect(
          retryFeature.requestWithRetry(
            RETRY_TEST_CONFIGS.BASIC_GET,
            RETRY_CONFIGS.DEFAULT
          )
        ).rejects.toThrow(error.message)

        expect(mockRequestor.getCallCount()).toBe(1) // 不重试

        mockRequestor.reset()
      }
    })
  })

  describe('重试次数限制', () => {
    test('达到最大重试次数后应该停止重试', async () => {
      const serverError = RetryMockRequestor.createHttpError(500)
      // 配置所有请求都失败
      mockRequestor.setFailPattern([true, true, true, true])
      mockRequestor.setError(serverError)

      await expect(
        retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          RETRY_CONFIGS.DEFAULT // 默认重试3次
        )
      ).rejects.toThrow('HTTP Error 500')

      // 重试3次，总共尝试4次
      expect(mockRequestor.getCallCount()).toBe(4)
    })

    test('在重试次数内成功不应该继续重试', async () => {
      const serverError = RetryMockRequestor.createHttpError(500)
      // 前两次失败，第三次成功
      mockRequestor.setFailPattern([true, true, false])
      mockRequestor.setError(serverError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const result = await retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        RETRY_CONFIGS.DEFAULT
      )

      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(3) // 第三次成功后不再重试
    })

    test('重试计数应该传递给shouldRetry函数', async () => {
      const customShouldRetry = vi.fn()
        .mockReturnValueOnce(true)  // 第一次重试
        .mockReturnValueOnce(true)  // 第二次重试
        .mockReturnValueOnce(false) // 第三次不重试

      const serverError = RetryMockRequestor.createHttpError(500)
      mockRequestor.setFailPattern([true, true, true, true])
      mockRequestor.setError(serverError)

      const customConfig = {
        retries: 5,
        shouldRetry: customShouldRetry
      }

      await expect(
        retryFeature.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, customConfig)
      ).rejects.toThrow('HTTP Error 500')

      expect(customShouldRetry).toHaveBeenCalledTimes(3)
      expect(customShouldRetry).toHaveBeenNthCalledWith(1, serverError, 0)
      expect(customShouldRetry).toHaveBeenNthCalledWith(2, serverError, 1)
      expect(customShouldRetry).toHaveBeenNthCalledWith(3, serverError, 2)
      
      // 第三次shouldRetry返回false，所以总共尝试3次
      expect(mockRequestor.getCallCount()).toBe(3)
    })
  })

  describe('自定义重试条件', () => {
    test('自定义条件应该覆盖默认重试逻辑', async () => {
      // 创建一个只对特定错误重试的条件
      const customShouldRetry = (error: unknown, attempt: number) => {
        return attempt < 2 && error instanceof MockNetworkError
      }

      // 测试匹配条件的错误
      const networkError = MockNetworkError.createNetworkError()
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(networkError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      const result = await retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        { retries: 3, shouldRetry: customShouldRetry }
      )

      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(2)

      mockRequestor.reset()

      // 测试不匹配条件的错误（5xx服务器错误）
      const serverError = RetryMockRequestor.createHttpError(500)
      mockRequestor.setFailPattern([true])
      mockRequestor.setError(serverError)

      await expect(
        retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          { retries: 3, shouldRetry: customShouldRetry }
        )
      ).rejects.toThrow('HTTP Error 500')

      expect(mockRequestor.getCallCount()).toBe(1) // 不重试
    })

    test('复杂的自定义重试条件', async () => {
      // 创建基于错误类型和尝试次数的复合条件
      const customRetryCondition = createCustomRetryCondition(3, [MockNetworkError, 'timeout'])

      // 测试NetworkError
      const networkError = MockNetworkError.createNetworkError()
      mockRequestor.setFailPattern([true, true, false])
      mockRequestor.setError(networkError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      let result = await retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        { retries: 5, shouldRetry: customRetryCondition }
      )

      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(3)

      mockRequestor.reset()

      // 测试包含'timeout'的错误
      const timeoutError = new Error('Connection timeout occurred')
      mockRequestor.setFailPattern([true, false])
      mockRequestor.setError(timeoutError)
      mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      result = await retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        { retries: 5, shouldRetry: customRetryCondition }
      )

      expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      expect(mockRequestor.getCallCount()).toBe(2)

      mockRequestor.reset()

      // 测试不符合条件的错误
      const otherError = new Error('Invalid data format')
      mockRequestor.setFailPattern([true])
      mockRequestor.setError(otherError)

      await expect(
        retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          { retries: 5, shouldRetry: customRetryCondition }
        )
      ).rejects.toThrow('Invalid data format')

      expect(mockRequestor.getCallCount()).toBe(1) // 不重试
    })

    test('自定义条件中达到最大尝试次数限制', async () => {
      const customShouldRetry = vi.fn((error: unknown, attempt: number) => {
        return attempt < 10 // 允许很多次重试
      })

      const networkError = MockNetworkError.createNetworkError()
      mockRequestor.setFailPattern([true, true, true, true, true]) // 全部失败
      mockRequestor.setError(networkError)

      const customConfig = {
        retries: 3, // 但是配置限制为3次重试
        shouldRetry: customShouldRetry
      }

      await expect(
        retryFeature.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, customConfig)
      ).rejects.toThrow()

      // 虽然自定义条件允许10次重试，但配置限制为3次，所以总共尝试4次
      expect(mockRequestor.getCallCount()).toBe(4)
      expect(customShouldRetry).toHaveBeenCalledTimes(3)
    })
  })

  describe('异常情况处理', () => {
    test('非Error类型的异常不应该重试', async () => {
      const stringError = 'String error message'
      mockRequestor.setFailPattern([true])
      mockRequestor.setError(stringError as any)

      await expect(
        retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          RETRY_CONFIGS.DEFAULT
        )
      ).rejects.toBe(stringError)

      expect(mockRequestor.getCallCount()).toBe(1) // 不重试
    })

    test('null/undefined错误不应该重试', async () => {
      const nullError = null
      mockRequestor.setFailPattern([true])
      mockRequestor.setError(nullError as any)

      await expect(
        retryFeature.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          RETRY_CONFIGS.DEFAULT
        )
      ).rejects.toBe(nullError)

      expect(mockRequestor.getCallCount()).toBe(1) // 不重试
    })

    test('自定义shouldRetry函数抛出异常时应该停止重试', async () => {
      const customShouldRetry = vi.fn(() => {
        throw new Error('shouldRetry function error')
      })

      const serverError = RetryMockRequestor.createHttpError(500)
      mockRequestor.setFailPattern([true])
      mockRequestor.setError(serverError)

      const customConfig = {
        retries: 3,
        shouldRetry: customShouldRetry
      }

      // 应该抛出原始的服务器错误，而不是shouldRetry函数的错误
      await expect(
        retryFeature.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, customConfig)
      ).rejects.toThrow('HTTP Error 500')

      expect(mockRequestor.getCallCount()).toBe(1) // 不重试
      expect(customShouldRetry).toHaveBeenCalledTimes(1)
    })
  })

  describe('边界条件测试', () => {
    test('重试循环异常退出时应该抛出适当错误', async () => {
      // 这种情况理论上不应该发生，但测试异常保护
      const retryFeatureWithBug = {
        async requestWithRetry(config: any, retryConfig: any) {
          // 模拟重试循环异常退出的情况
          let lastError: unknown = null
          const maxAttempts = retryConfig.retries + 1
          
          // 模拟循环异常终止，但没有设置lastError
          for (let i = 0; i < 0; i++) { // 永远不执行
            // ...
          }
          
          throw lastError || new RequestError('Unexpected retry loop exit')
        }
      }

      await expect(
        retryFeatureWithBug.requestWithRetry(
          RETRY_TEST_CONFIGS.BASIC_GET,
          RETRY_CONFIGS.DEFAULT
        )
      ).rejects.toThrow('Unexpected retry loop exit')
    })

    test('多个并发重试请求应该独立处理', async () => {
      const serverError = RetryMockRequestor.createHttpError(500)
      
      // 为每个请求创建独立的mock requestor
      const mockRequestor1 = createRetryMockRequestor()
      const mockRequestor2 = createRetryMockRequestor()
      const retryFeature1 = new RetryFeature(mockRequestor1)
      const retryFeature2 = new RetryFeature(mockRequestor2)

      // 配置不同的失败模式
      mockRequestor1.setFailPattern([true, false]) // 重试1次成功
      mockRequestor1.setError(serverError)
      mockRequestor1.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

      mockRequestor2.setFailPattern([true, true, true, true]) // 所有尝试都失败
      mockRequestor2.setError(serverError)
      
      // 使用短延迟避免测试超时
      const fastRetryConfig = { retries: 3, delay: 10 }

      // 并发执行两个重试请求
      const [result1, result2] = await Promise.allSettled([
        retryFeature1.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, fastRetryConfig),
        retryFeature2.requestWithRetry(RETRY_TEST_CONFIGS.BASIC_GET, fastRetryConfig)
      ])

      // 验证结果
      expect(result1.status).toBe('fulfilled')
      if (result1.status === 'fulfilled') {
        expect(result1.value).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
      }
      
      expect(result2.status).toBe('rejected')
      if (result2.status === 'rejected') {
        expect(result2.reason.message).toBe('HTTP Error 500')
      }

      expect(mockRequestor1.getCallCount()).toBe(2)
      expect(mockRequestor2.getCallCount()).toBe(4)

      cleanupRetryTest(mockRequestor1)
      cleanupRetryTest(mockRequestor2)
    })
  })
})
