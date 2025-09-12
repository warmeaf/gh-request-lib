import { vi } from 'vitest'
import { Requestor, RequestConfig } from '../src/interface'

/**
 * Mock Requestor 实现，提供给所有测试文件使用
 */
export class MockRequestor implements Requestor {
  private mockFn = vi.fn()

  async request<T = unknown>(config: RequestConfig): Promise<T> {
    return this.mockFn(config)
  }

  getMock() {
    return this.mockFn
  }

  reset() {
    this.mockFn.mockReset()
  }

  clear() {
    this.mockFn.mockClear()
  }
}

/**
 * 创建新的MockRequestor实例
 */
export function createMockRequestor(): MockRequestor {
  return new MockRequestor()
}

/**
 * 常用的测试数据和配置
 */
export const TEST_URLS = {
  API_BASE: 'https://api.example.com',
  USERS: 'https://api.example.com/users',
  TEST: 'https://api.example.com/test'
} as const

export const MOCK_RESPONSES = {
  USER: { id: 1, name: 'John' },
  SUCCESS: { success: true },
  CREATED: { created: true },
  DELETED: { deleted: true }
} as const

/**
 * 常用的测试配置
 */
export const TEST_CONFIGS = {
  BASIC_GET: {
    url: TEST_URLS.USERS,
    method: 'GET' as const
  },
  BASIC_POST: {
    url: TEST_URLS.USERS,
    method: 'POST' as const,
    data: { name: 'John', email: 'john@example.com' }
  }
} as const
