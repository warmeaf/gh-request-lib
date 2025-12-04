import { vi } from 'vitest'
import { Requestor, RequestConfig, GlobalConfig } from '../../src/interface'
import { RequestCore } from '../../src/core'

/**
 * Core 测试专用的 Mock Requestor 实现
 */
export class CoreMockRequestor implements Requestor {
  private mockFn = vi.fn()
  public requestHistory: RequestConfig[] = []
  public delayMs: number = 0
  public shouldReject: boolean = false
  public rejectError: any = new Error('Mock request failed')

  async request<T = unknown>(config: RequestConfig): Promise<T> {
    // 记录请求历史
    this.requestHistory.push({ ...config })
    
    // 模拟延迟
    if (this.delayMs > 0) {
      await new Promise(resolve => setTimeout(resolve, this.delayMs))
    }
    
    // 模拟错误
    if (this.shouldReject) {
      throw this.rejectError
    }
    
    return this.mockFn(config)
  }

  getMock() {
    return this.mockFn
  }

  reset() {
    this.mockFn.mockReset()
    this.requestHistory = []
    this.delayMs = 0
    this.shouldReject = false
    this.rejectError = new Error('Mock request failed')
  }

  clear() {
    this.mockFn.mockClear()
    this.requestHistory = []
  }

  // 测试辅助方法
  setDelay(ms: number) {
    this.delayMs = ms
  }

  setReject(error?: any) {
    this.shouldReject = true
    // 允许设置 null 或 undefined 作为错误
    if (error !== undefined) {
      this.rejectError = error
    }
  }

  setResolve() {
    this.shouldReject = false
  }

  getLastRequest(): RequestConfig | undefined {
    return this.requestHistory[this.requestHistory.length - 1]
  }

  getRequestCount(): number {
    return this.requestHistory.length
  }
}

/**
 * 创建 Core 测试用的 Mock Requestor
 */
export function createCoreMockRequestor(): CoreMockRequestor {
  return new CoreMockRequestor()
}

/**
 * 创建测试用的全局配置
 */
export function createTestGlobalConfig(): GlobalConfig {
  return {
    baseURL: 'https://api.test.com',
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json',
      'X-Test-Header': 'test-value'
    }
  }
}

/**
 * 创建完整的测试环境
 */
export function createTestEnvironment() {
  const mockRequestor = createCoreMockRequestor()
  const requestCore = new RequestCore(mockRequestor)
  
  return {
    mockRequestor,
    requestCore,
    cleanup: () => {
      mockRequestor.reset()
      requestCore.destroy()
    }
  }
}

/**
 * Core 测试常用的响应数据
 */
export const CORE_MOCK_RESPONSES = {
  USER: { id: 1, name: 'John Doe', email: 'john@example.com' },
  USERS: [
    { id: 1, name: 'John Doe' },
    { id: 2, name: 'Jane Smith' }
  ],
  SUCCESS: { success: true, message: 'Operation completed' },
  CREATED: { id: 3, created: true, timestamp: new Date().toISOString() },
  UPDATED: { id: 1, updated: true, timestamp: new Date().toISOString() },
  DELETED: { id: 1, deleted: true, timestamp: new Date().toISOString() },
  get PAGINATED() {
    return {
      data: [{ id: 1, name: 'Item 1' }, { id: 2, name: 'Item 2' }],
      total: 100,
      page: 1,
      limit: 10,
      hasNext: true,
      hasPrev: false
    }
  },
  BLOB: new Blob(['test file content'], { type: 'text/plain' }),
  ARRAY_BUFFER: new ArrayBuffer(8)
} as const

/**
 * Core 测试常用的 URL
 */
export const CORE_TEST_URLS = {
  API_BASE: 'https://api.test.com',
  USERS: 'https://api.test.com/users',
  USER_DETAIL: 'https://api.test.com/users/1',
  POSTS: 'https://api.test.com/posts',
  UPLOAD: 'https://api.test.com/upload',
  DOWNLOAD: 'https://api.test.com/download/file.txt',
  SLOW: 'https://api.test.com/slow',
  ERROR: 'https://api.test.com/error'
} as const

/**
 * 清理测试环境的通用函数
 */
export async function cleanupCoreTest(
  mockRequestor: CoreMockRequestor,
  requestCore: RequestCore
) {
  try {
    // 清理所有缓存
    requestCore.clearCache()
    requestCore.clearIdempotentCache()
    requestCore.clearAllSerialQueues()
    
    // 销毁核心实例
    requestCore.destroy()
    
    // 重置 mock
    mockRequestor.reset()
  } catch (error) {
    console.warn('Cleanup warning:', error)
  }
}

/**
 * 等待异步操作完成的辅助函数
 */
export function waitFor(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 验证请求配置的辅助函数
 */
export function expectRequestConfig(
  actual: RequestConfig,
  expected: Partial<RequestConfig>
) {
  Object.keys(expected).forEach(key => {
    // expect 函数将在测试运行时可用
    const expectFn = (global as any).expect || (() => {
      throw new Error('expect is not available')
    })
    expectFn(actual[key as keyof RequestConfig]).toEqual(expected[key as keyof RequestConfig])
  })
}
