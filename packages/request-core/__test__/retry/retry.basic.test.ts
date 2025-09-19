import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RetryFeature } from '../../src/features/retry'
import { RequestError } from '../../src/interface'
import {
  RetryMockRequestor,
  createRetryMockRequestor,
  cleanupRetryTest,
  RETRY_TEST_CONFIGS,
  RETRY_CONFIGS,
  RETRY_TEST_RESPONSES,
  delay
} from './retry-test-helpers'

describe('重试基础功能测试', () => {
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

  test('成功请求不需要重试', async () => {
    // 配置: 第一次请求就成功
    mockRequestor.setFailPattern([false])
    mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

    const result = await retryFeature.requestWithRetry(
      RETRY_TEST_CONFIGS.BASIC_GET,
      RETRY_CONFIGS.DEFAULT
    )

    expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
    expect(mockRequestor.getCallCount()).toBe(1)
  })

  test('失败后重试成功', async () => {
    // 配置: 前两次失败，第三次成功
    mockRequestor.setFailPattern([true, true, false])
    mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
    mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

    const result = await retryFeature.requestWithRetry(
      RETRY_TEST_CONFIGS.BASIC_GET,
      RETRY_CONFIGS.DEFAULT
    )

    expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
    expect(mockRequestor.getCallCount()).toBe(3)
  })

  test('重试次数用完后抛出最后一个错误', async () => {
    const testError = new RequestError('Server error', { status: 500, isHttpError: true })
    
    // 配置: 所有尝试都失败
    mockRequestor.setFailPattern([true, true, true, true])
    mockRequestor.setError(testError)

    await expect(
      retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        RETRY_CONFIGS.DEFAULT
      )
    ).rejects.toThrow('Server error')

    // 默认重试3次，所以总共尝试4次
    expect(mockRequestor.getCallCount()).toBe(4)
  })

  test('不重试的配置应该只请求一次', async () => {
    const testError = new RequestError('Server error', { status: 500, isHttpError: true })
    
    // 配置: 失败
    mockRequestor.setFailPattern([true])
    mockRequestor.setError(testError)

    await expect(
      retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        RETRY_CONFIGS.NO_RETRIES
      )
    ).rejects.toThrow('Server error')

    // 不重试，只尝试1次
    expect(mockRequestor.getCallCount()).toBe(1)
  })

  test('应该记录正确的重试日志', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    // 配置: 前两次失败，第三次成功
    mockRequestor.setFailPattern([true, true, false])
    mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
    mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

    await retryFeature.requestWithRetry(
      RETRY_TEST_CONFIGS.BASIC_GET,
      RETRY_CONFIGS.WITH_DELAY
    )

    // 验证日志调用
    expect(consoleSpy).toHaveBeenCalledTimes(3) // 3次尝试的开始日志
    expect(consoleWarnSpy).toHaveBeenCalledTimes(2) // 2次失败重试的警告日志
    expect(consoleErrorSpy).not.toHaveBeenCalled() // 没有最终失败错误日志

    // 验证日志内容
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('🔄 [Retry] Making request (attempt 1/4)')
    )
    expect(consoleWarnSpy).toHaveBeenCalledWith(
      expect.stringContaining('⏳ [Retry] Request failed, will retry in')
    )

    consoleSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  test('最终失败时应该记录错误日志', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

    const testError = new RequestError('Server error', { status: 500, isHttpError: true })
    
    // 配置: 所有尝试都失败
    mockRequestor.setFailPattern([true, true, true, true])
    mockRequestor.setError(testError)

    await expect(
      retryFeature.requestWithRetry(
        RETRY_TEST_CONFIGS.BASIC_GET,
        RETRY_CONFIGS.DEFAULT
      )
    ).rejects.toThrow('Server error')

    // 验证最终错误日志
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('❌ [Retry] Request failed after 4 attempts')
    )

    consoleSpy.mockRestore()
    consoleWarnSpy.mockRestore()
    consoleErrorSpy.mockRestore()
  })

  test('应该正确传递请求配置', async () => {
    const testConfig = RETRY_TEST_CONFIGS.BASIC_POST
    mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.USER)

    await retryFeature.requestWithRetry(testConfig, RETRY_CONFIGS.DEFAULT)

    const calls = mockRequestor.getCalls()
    expect(calls).toHaveLength(1)
    expect(calls[0].config).toEqual(testConfig)
  })

  test('重试过程中应该保持相同的请求配置', async () => {
    const testConfig = RETRY_TEST_CONFIGS.BASIC_POST
    
    // 配置: 前两次失败，第三次成功
    mockRequestor.setFailPattern([true, true, false])
    mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
    mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.USER)

    await retryFeature.requestWithRetry(testConfig, RETRY_CONFIGS.DEFAULT)

    const calls = mockRequestor.getCalls()
    expect(calls).toHaveLength(3)
    
    // 验证每次请求都使用相同的配置
    calls.forEach(call => {
      expect(call.config).toEqual(testConfig)
    })
  })

  test('应该处理异步重试', async () => {
    vi.useFakeTimers()

    // 配置: 第一次失败，第二次成功
    mockRequestor.setFailPattern([true, false])
    mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
    mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

    const resultPromise = retryFeature.requestWithRetry(
      RETRY_TEST_CONFIGS.BASIC_GET,
      RETRY_CONFIGS.WITH_DELAY
    )

    // 快进时间到延迟之后
    await vi.advanceTimersByTimeAsync(150)

    const result = await resultPromise
    expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
    expect(mockRequestor.getCallCount()).toBe(2)

    vi.useRealTimers()
  })

  test('空的重试配置应该使用默认值', async () => {
    mockRequestor.setFailPattern([false])
    mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

    const result = await retryFeature.requestWithRetry(
      RETRY_TEST_CONFIGS.BASIC_GET
      // 不传递重试配置，使用默认值 { retries: 3 }
    )

    expect(result).toEqual(RETRY_TEST_RESPONSES.SUCCESS)
    expect(mockRequestor.getCallCount()).toBe(1)
  })

  test('重试过程应该递增尝试计数', async () => {
    // 配置: 前三次失败，第四次成功
    mockRequestor.setFailPattern([true, true, true, false])
    mockRequestor.setError(new RequestError('Server error', { status: 500, isHttpError: true }))
    mockRequestor.setSuccessResponse(RETRY_TEST_RESPONSES.SUCCESS)

    await retryFeature.requestWithRetry(
      RETRY_TEST_CONFIGS.BASIC_GET,
      RETRY_CONFIGS.DEFAULT
    )

    const calls = mockRequestor.getCalls()
    expect(calls).toHaveLength(4)
    
    // 验证每次调用的尝试次数
    calls.forEach((call, index) => {
      expect(call.attempt).toBe(index + 1)
    })
  })
})
