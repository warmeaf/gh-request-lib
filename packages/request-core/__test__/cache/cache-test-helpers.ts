import { vi, expect } from 'vitest'
import { CacheFeature } from '../../src/features/cache'
import { CacheConfig } from '../../src/features/cache/types'
import { StorageAdapter, StorageType } from '../../src/cache'
import { createMockRequestor, MockRequestor, TEST_URLS } from '../test-helpers'
import { RequestConfig } from '../../src/interface'

/**
 * Mock存储适配器 - 用于测试存储适配器功能
 */
export class MockStorageAdapter implements StorageAdapter {
  private storage = new Map<string, any>()
  private mockFunctions = {
    getItem: vi.fn(),
    setItem: vi.fn(),
    removeItem: vi.fn(),
    clear: vi.fn(),
    getKeys: vi.fn(),
    destroy: vi.fn(),
    isAvailable: vi.fn()
  }

  constructor(private shouldFail = false) { }

  async getItem(key: string): Promise<any | null> {
    this.mockFunctions.getItem(key)
    if (this.shouldFail) throw new Error('Storage getItem failed')
    return this.storage.get(key) || null
  }

  async setItem(item: any): Promise<void> {
    this.mockFunctions.setItem(item)
    if (this.shouldFail) throw new Error('Storage setItem failed')
    this.storage.set(item.key, item)
  }

  async removeItem(key: string): Promise<void> {
    this.mockFunctions.removeItem(key)
    if (this.shouldFail) throw new Error('Storage removeItem failed')
    this.storage.delete(key)
  }

  async clear(): Promise<void> {
    this.mockFunctions.clear()
    if (this.shouldFail) throw new Error('Storage clear failed')
    this.storage.clear()
  }

  async getKeys(): Promise<string[]> {
    this.mockFunctions.getKeys()
    if (this.shouldFail) throw new Error('Storage getKeys failed')
    return Array.from(this.storage.keys())
  }

  async destroy(): Promise<void> {
    this.mockFunctions.destroy()
    if (this.shouldFail) throw new Error('Storage destroy failed')
    this.storage.clear()
  }

  getType(): StorageType {
    return StorageType.MEMORY
  }

  isAvailable(): boolean {
    this.mockFunctions.isAvailable()
    return !this.shouldFail
  }

  // 测试辅助方法
  getMockFunctions() {
    return this.mockFunctions
  }

  getInternalStorage() {
    return this.storage
  }

  setShouldFail(shouldFail: boolean) {
    this.shouldFail = shouldFail
  }

  reset() {
    this.storage.clear()
    this.shouldFail = false
    Object.values(this.mockFunctions).forEach(fn => fn.mockReset())
  }
}

/**
 * 缓存测试工具类
 */
export class CacheTestHelper {
  private mockRequestor: MockRequestor
  private mockStorageAdapter: MockStorageAdapter
  private cacheFeature: CacheFeature

  constructor() {
    this.mockRequestor = createMockRequestor()
    this.mockStorageAdapter = new MockStorageAdapter()
    this.cacheFeature = new CacheFeature(
      this.mockRequestor,
      1000, // maxEntries
      undefined, // keyGeneratorConfig
      StorageType.MEMORY
    )
    // 使用mock存储适配器
    this.cacheFeature.setStorageAdapter(this.mockStorageAdapter)
  }

  /**
   * 获取mock请求器
   */
  getMockRequestor(): MockRequestor {
    return this.mockRequestor
  }

  /**
   * 获取mock存储适配器
   */
  getMockStorageAdapter(): MockStorageAdapter {
    return this.mockStorageAdapter
  }

  /**
   * 获取缓存功能实例
   */
  getCacheFeature(): CacheFeature {
    return this.cacheFeature
  }

  /**
   * 设置请求器返回值
   */
  setRequestorReturn<T>(returnValue: T | Promise<T>) {
    this.mockRequestor.getMock().mockResolvedValue(returnValue)
  }

  /**
   * 设置请求器抛出错误
   */
  setRequestorError(error: Error) {
    this.mockRequestor.getMock().mockRejectedValue(error)
  }

  /**
   * 设置存储适配器是否失败
   */
  setStorageFail(shouldFail: boolean) {
    this.mockStorageAdapter.setShouldFail(shouldFail)
  }

  /**
   * 重置所有mock
   */
  reset() {
    this.mockRequestor.reset()
    this.mockStorageAdapter.reset()
  }

  /**
   * 创建缓存项
   */
  createCacheItem(key: string, data: any, ttl = 300000, accessTime?: number) {
    const now = Date.now()
    return {
      key,
      data,
      timestamp: now,
      ttl,
      accessTime: accessTime || now,
      accessCount: 1
    }
  }

  /**
   * 手动添加缓存项到存储
   */
  async addCacheItem(key: string, data: any, ttl = 300000, accessTime?: number) {
    const item = this.createCacheItem(key, data, ttl, accessTime)
    await this.mockStorageAdapter.setItem(item)
    return item
  }

  /**
   * 验证缓存项是否存在
   */
  async verifyCacheExists(key: string): Promise<boolean> {
    const item = await this.mockStorageAdapter.getItem(key)
    return item !== null
  }

  /**
   * 获取存储中的所有键
   */
  async getAllCacheKeys(): Promise<string[]> {
    return await this.mockStorageAdapter.getKeys()
  }
}

/**
 * 常用的缓存测试数据
 */
export const CACHE_TEST_DATA = {
  SIMPLE_USER: { id: 1, name: 'John Doe', email: 'john@example.com' },
  USERS_LIST: [
    { id: 1, name: 'John', email: 'john@example.com' },
    { id: 2, name: 'Jane', email: 'jane@example.com' }
  ],
  NESTED_OBJECT: {
    user: {
      id: 1,
      profile: {
        name: 'John',
        settings: { theme: 'dark', lang: 'en' }
      }
    },
    meta: { created: new Date('2024-01-01'), version: 1.0 }
  },
  LARGE_ARRAY: Array.from({ length: 100 }, (_, i) => ({ id: i, value: `item-${i}` }))
} as const

/**
 * 常用的缓存配置
 */
export const CACHE_TEST_CONFIGS = {
  // 基础配置
  BASIC: {
    ttl: 300000, // 5分钟
    clone: 'none' as const
  } satisfies CacheConfig,

  // 短时间TTL
  SHORT_TTL: {
    ttl: 1000, // 1秒
    clone: 'shallow' as const
  } satisfies CacheConfig,

  // 深度克隆
  DEEP_CLONE: {
    ttl: 300000,
    clone: 'deep' as const
  } satisfies CacheConfig,

  // 自定义键
  CUSTOM_KEY: {
    ttl: 300000,
    key: 'custom-test-key',
    clone: 'none' as const
  } satisfies CacheConfig,

  // 内存存储
  MEMORY_STORAGE: {
    ttl: 300000,
    storageType: StorageType.MEMORY,
    clone: 'none' as const
  } satisfies CacheConfig
} as const

/**
 * 测试请求配置
 */
export const CACHE_REQUEST_CONFIGS = {
  GET_USERS: {
    url: TEST_URLS.USERS,
    method: 'GET' as const
  } satisfies RequestConfig,

  GET_USER_BY_ID: {
    url: `${TEST_URLS.USERS}/1`,
    method: 'GET' as const
  } satisfies RequestConfig,

  POST_USER: {
    url: TEST_URLS.USERS,
    method: 'POST' as const,
    data: { name: 'New User', email: 'new@example.com' }
  } satisfies RequestConfig,

  GET_WITH_HEADERS: {
    url: TEST_URLS.USERS,
    method: 'GET' as const,
    headers: {
      'Authorization': 'Bearer token123',
      'Content-Type': 'application/json'
    }
  } satisfies RequestConfig,

  GET_WITH_PARAMS: {
    url: TEST_URLS.USERS,
    method: 'GET' as const,
    params: { page: 1, limit: 10, sort: 'name' }
  } satisfies RequestConfig
} as const

/**
 * 时间相关的测试工具
 */
export class TimeTestHelper {
  private originalDateNow = Date.now
  private mockTime = Date.now()

  /**
   * 模拟时间
   */
  setMockTime(time?: number) {
    this.mockTime = time || Date.now()
    global.Date.now = vi.fn(() => this.mockTime)
  }

  /**
   * 前进时间
   */
  advanceTime(ms: number) {
    this.mockTime += ms
  }

  /**
   * 恢复真实时间
   */
  restore() {
    global.Date.now = this.originalDateNow
  }

  /**
   * 获取当前mock时间
   */
  getCurrentTime(): number {
    return this.mockTime
  }
}

/**
 * 创建缓存测试助手
 */
export function createCacheTestHelper(): CacheTestHelper {
  return new CacheTestHelper()
}

/**
 * 创建时间测试助手
 */
export function createTimeTestHelper(): TimeTestHelper {
  return new TimeTestHelper()
}


/**
 * 等待指定时间（用于测试异步操作）
 */
export function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * 验证控制台日志的断言函数
 */
export function expectConsoleLog(type: 'log' | 'warn' | 'error') {
  const spy = vi.spyOn(console, type)
  return {
    toHaveBeenCalledWith: (expectedMessage?: string | RegExp) => {
      if (expectedMessage) {
        expect(spy).toHaveBeenCalledWith(expect.stringMatching(expectedMessage))
      } else {
        expect(spy).toHaveBeenCalled()
      }
      spy.mockRestore()
    },
    not: {
      toHaveBeenCalled: () => {
        expect(spy).not.toHaveBeenCalled()
        spy.mockRestore()
      }
    }
  }
}
