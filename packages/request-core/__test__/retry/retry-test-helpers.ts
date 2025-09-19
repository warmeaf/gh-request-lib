import { vi } from 'vitest'
import { RequestConfig, Requestor, RequestError } from '../../src/interface'
import { RetryConfig } from '../../src/features/retry'

// 重试测试响应类型
export interface RetryTestResponse {
  url: string
  method: string
  attempt: number
  timestamp: number
  success: boolean
  data?: any
}

// 重试测试用的模拟错误类型
export class MockNetworkError extends Error {
  constructor(message = 'Network error occurred') {
    super(message)
    this.name = 'MockNetworkError'
  }

  static createNetworkError(message?: string): MockNetworkError {
    return new MockNetworkError(message)
  }
}

export class MockTimeoutError extends Error {
  constructor(message = 'Request timeout') {
    super(message)
    this.name = 'MockTimeoutError'
  }

  static createTimeoutError(message?: string): MockTimeoutError {
    return new MockTimeoutError(message)
  }
}

// 重试测试专用的模拟请求实现器
export class RetryMockRequestor implements Requestor {
  private callCount = 0
  private calls: Array<{ config: RequestConfig; timestamp: number; attempt: number }> = []
  private failPattern: Array<boolean> = []
  private errorToThrow: Error | RequestError | unknown = null
  private hasErrorSet = false
  private successResponse: any = { success: true }
  private isPaused = false
  private pauseResolvers: Array<() => void> = []

  async request<T>(config: RequestConfig): Promise<T> {
    const attempt = ++this.callCount
    const timestamp = Date.now()
    
    this.calls.push({ config, timestamp, attempt })
    
    // 等待暂停解除
    if (this.isPaused) {
      await new Promise<void>(resolve => {
        this.pauseResolvers.push(resolve)
      })
    }

    // 根据失败模式决定是否失败
    const shouldFail = this.failPattern[attempt - 1] ?? false
    
    if (shouldFail && this.hasErrorSet) {
      throw this.errorToThrow
    }

    return this.successResponse as T
  }

  // 设置失败模式：true表示该次调用会失败，false表示成功
  setFailPattern(pattern: boolean[]): void {
    this.failPattern = pattern
  }

  // 设置要抛出的错误
  setError(error: Error | RequestError | unknown): void {
    this.errorToThrow = error
    this.hasErrorSet = true
  }

  // 设置成功响应
  setSuccessResponse(response: any): void {
    this.successResponse = response
  }

  // 获取所有请求调用
  getCalls(): Array<{ config: RequestConfig; timestamp: number; attempt: number }> {
    return [...this.calls]
  }

  // 获取调用次数
  getCallCount(): number {
    return this.callCount
  }

  // 重置状态
  reset(): void {
    this.callCount = 0
    this.calls = []
    this.failPattern = []
    this.errorToThrow = null
    this.hasErrorSet = false
    this.successResponse = { success: true }
    this.isPaused = false
    this.pauseResolvers = []
  }

  // 暂停后续请求
  pause(): void {
    this.isPaused = true
  }

  // 恢复暂停的请求
  resume(): void {
    this.isPaused = false
    this.pauseResolvers.forEach(resolve => resolve())
    this.pauseResolvers = []
  }

  // 模拟不同的错误场景
  static createHttpError(status: number, message?: string): RequestError {
    return new RequestError(
      message || `HTTP Error ${status}`,
      { status, isHttpError: true }
    )
  }

  static createNetworkError(message?: string): MockNetworkError {
    return new MockNetworkError(message)
  }

  static createTimeoutError(message?: string): MockTimeoutError {
    return new MockTimeoutError(message)
  }
}

// 常用的测试配置
export const RETRY_TEST_CONFIGS = {
  BASIC_GET: {
    url: 'https://api.example.com/users',
    method: 'GET' as const
  },
  
  BASIC_POST: {
    url: 'https://api.example.com/users', 
    method: 'POST' as const,
    data: { name: 'Test User' }
  }
} as const

// 常用的重试配置
export const RETRY_CONFIGS = {
  DEFAULT: { retries: 3 },
  
  NO_RETRIES: { retries: 0 },
  
  WITH_DELAY: { 
    retries: 3, 
    delay: 100 
  },
  
  WITH_BACKOFF: { 
    retries: 3, 
    delay: 100, 
    backoffFactor: 2 
  },
  
  WITH_JITTER: { 
    retries: 3, 
    delay: 100, 
    jitter: 0.1 
  },
  
  FULL_CONFIG: { 
    retries: 5, 
    delay: 200, 
    backoffFactor: 2, 
    jitter: 0.2 
  },

  CUSTOM_SHOULD_RETRY: {
    retries: 3,
    shouldRetry: (error: unknown, attempt: number) => {
      return attempt < 2 && error instanceof Error
    }
  }
} as const

// 常用的测试响应
export const RETRY_TEST_RESPONSES = {
  SUCCESS: { success: true, data: 'test' },
  USER: { id: 1, name: 'Test User' },
  ERROR: { error: 'Something went wrong' }
} as const

/**
 * 创建新的重试测试用 Mock Requestor
 */
export function createRetryMockRequestor(): RetryMockRequestor {
  return new RetryMockRequestor()
}

/**
 * 等待指定时间（毫秒）
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 验证请求调用的时间间隔是否符合预期
 */
export function validateRetryDelays(
  calls: Array<{ timestamp: number }>,
  expectedDelays: number[],
  tolerance = 50 // 50ms 的容错时间
): boolean {
  if (calls.length !== expectedDelays.length + 1) {
    return false
  }

  for (let i = 1; i < calls.length; i++) {
    const actualDelay = calls[i].timestamp - calls[i - 1].timestamp
    const expectedDelay = expectedDelays[i - 1]
    
    if (Math.abs(actualDelay - expectedDelay) > tolerance) {
      return false
    }
  }
  
  return true
}

/**
 * 清理重试测试
 */
export function cleanupRetryTest(mockRequestor: RetryMockRequestor): void {
  mockRequestor.reset()
  vi.clearAllTimers()
}

/**
 * 创建自定义的重试条件函数
 */
export function createCustomRetryCondition(
  maxAttempts: number,
  retryOn: Array<(new (...args: any[]) => Error) | string>
): (error: unknown, attempt: number) => boolean {
  return (error: unknown, attempt: number) => {
    if (attempt >= maxAttempts) return false
    
    return retryOn.some(condition => {
      if (typeof condition === 'string') {
        return error instanceof Error && error.message.includes(condition)
      }
      return error instanceof condition
    })
  }
}
