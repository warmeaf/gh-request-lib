import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { ApiInstance } from '../../src/types'
import type { ApiClientOptions } from '../../src/client/api-client'
import { RequestCore, type Requestor, type GlobalConfig, type RequestInterceptor } from 'request-core'

// 模拟factory模块
const mockCreateRequestCore = vi.fn()
vi.mock('../../src/core/factory', () => ({
  createRequestCore: mockCreateRequestCore,
}))

describe('ApiClient', () => {
  let mockRequestor: Requestor
  let mockRequestCore: RequestCore

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockRequestor = vi.fn() as any
    mockRequestCore = {
      clearCache: vi.fn(),
      getCacheStats: vi.fn().mockReturnValue({ hits: 10, misses: 5 }),
      setGlobalConfig: vi.fn(),
      addInterceptor: vi.fn(),
      clearInterceptors: vi.fn(),
      destroy: vi.fn(),
      getAllStats: vi.fn().mockReturnValue({ requests: 100 }),
    } as any
    
    mockCreateRequestCore.mockReturnValue(mockRequestCore)
  })

  // 创建测试用的API类
  class TestUserApi implements ApiInstance {
    requestCore: RequestCore

    constructor(requestCore: RequestCore) {
      this.requestCore = requestCore
    }

    getUser(id: string) {
      return `user-${id}`
    }
  }

  class TestOrderApi implements ApiInstance {
    requestCore: RequestCore

    constructor(requestCore: RequestCore) {
      this.requestCore = requestCore
    }

    getOrder(id: string) {
      return `order-${id}`
    }
  }

  describe('createApiClient', () => {
    it('should create client with requestor', async () => {
      const { createApiClient } = await import('../../src/client/api-client')
      
      const apis = {
        user: TestUserApi,
        order: TestOrderApi,
      }
      const options: ApiClientOptions = { requestor: mockRequestor }

      const client = createApiClient(apis, options)

      expect(mockCreateRequestCore).toHaveBeenCalledWith(mockRequestor, {
        globalConfig: undefined,
        interceptors: undefined,
      })
      expect(client.user).toBeInstanceOf(TestUserApi)
      expect(client.order).toBeInstanceOf(TestOrderApi)
      expect(client.user.requestCore).toBe(mockRequestCore)
      expect(client.order.requestCore).toBe(mockRequestCore)
    })

    it('should create client with existing requestCore', async () => {
      const { createApiClient } = await import('../../src/client/api-client')
      
      const apis = { user: TestUserApi }
      const options: ApiClientOptions = { requestCore: mockRequestCore }

      const client = createApiClient(apis, options)

      expect(mockCreateRequestCore).not.toHaveBeenCalled()
      expect(client.user.requestCore).toBe(mockRequestCore)
    })

    it('should create client with requestor and additional options', async () => {
      const { createApiClient } = await import('../../src/client/api-client')
      
      const globalConfig: GlobalConfig = { baseURL: 'https://api.test.com' }
      const interceptor: RequestInterceptor = { onRequest: vi.fn(), onResponse: vi.fn() }
      
      const apis = { user: TestUserApi }
      const options: ApiClientOptions = {
        requestor: mockRequestor,
        globalConfig,
        interceptors: [interceptor],
      }

      const client = createApiClient(apis, options)

      expect(mockCreateRequestCore).toHaveBeenCalledWith(mockRequestor, {
        globalConfig,
        interceptors: [interceptor],
      })
      expect(client.user.requestCore).toBe(mockRequestCore)
    })

    it('should throw error when neither requestor nor requestCore provided', async () => {
      const { createApiClient } = await import('../../src/client/api-client')
      
      const apis = { user: TestUserApi }
      const options: ApiClientOptions = {}

      expect(() => createApiClient(apis, options)).toThrow(
        'Must provide either requestor or requestCore option'
      )
    })

    it('should provide cache management methods', async () => {
      const { createApiClient } = await import('../../src/client/api-client')
      
      const apis = { user: TestUserApi }
      const options: ApiClientOptions = { requestCore: mockRequestCore }

      const client = createApiClient(apis, options)

      // 测试clearCache
      client.clearCache('test-key')
      expect(mockRequestCore.clearCache).toHaveBeenCalledWith('test-key')

      client.clearCache()
      expect(mockRequestCore.clearCache).toHaveBeenCalledWith(undefined)

      // 测试getCacheStats
      const stats = client.getCacheStats()
      expect(mockRequestCore.getCacheStats).toHaveBeenCalled()
      expect(stats).toEqual({ hits: 10, misses: 5 })
    })

    it('should provide global config management', async () => {
      const { createApiClient } = await import('../../src/client/api-client')
      
      const apis = { user: TestUserApi }
      const options: ApiClientOptions = { requestCore: mockRequestCore }

      const client = createApiClient(apis, options)
      const newConfig: GlobalConfig = { baseURL: 'https://new-api.com' }

      client.setGlobalConfig(newConfig)
      expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(newConfig)
    })

    it('should provide interceptor management', async () => {
      const { createApiClient } = await import('../../src/client/api-client')
      
      const apis = { user: TestUserApi }
      const options: ApiClientOptions = { requestCore: mockRequestCore }

      const client = createApiClient(apis, options)
      const interceptor: RequestInterceptor = { onRequest: vi.fn(), onResponse: vi.fn() }

      client.addInterceptor(interceptor)
      expect(mockRequestCore.addInterceptor).toHaveBeenCalledWith(interceptor)

      client.clearInterceptors()
      expect(mockRequestCore.clearInterceptors).toHaveBeenCalled()
    })

    it('should provide utility methods', async () => {
      const { createApiClient } = await import('../../src/client/api-client')
      
      const apis = { user: TestUserApi }
      const options: ApiClientOptions = { requestCore: mockRequestCore }

      const client = createApiClient(apis, options)

      // 测试destroy
      client.destroy()
      expect(mockRequestCore.destroy).toHaveBeenCalled()

      // 测试getAllStats
      const stats = client.getAllStats()
      expect(mockRequestCore.getAllStats).toHaveBeenCalled()
      expect(stats).toEqual({ requests: 100 })
    })

    it('should create multiple API instances correctly', async () => {
      const { createApiClient } = await import('../../src/client/api-client')
      
      const apis = {
        user: TestUserApi,
        order: TestOrderApi,
      }
      const options: ApiClientOptions = { requestCore: mockRequestCore }

      const client = createApiClient(apis, options)

      expect(client.user).toBeInstanceOf(TestUserApi)
      expect(client.order).toBeInstanceOf(TestOrderApi)
      expect(client.user.getUser('123')).toBe('user-123')
      expect(client.order.getOrder('456')).toBe('order-456')
      expect(client.user.requestCore).toBe(mockRequestCore)
      expect(client.order.requestCore).toBe(mockRequestCore)
    })

    it('should handle empty APIs object', async () => {
      const { createApiClient } = await import('../../src/client/api-client')
      
      const apis = {}
      const options: ApiClientOptions = { requestCore: mockRequestCore }

      const client = createApiClient(apis, options)

      // 应该仍然有管理方法
      expect(typeof client.clearCache).toBe('function')
      expect(typeof client.setGlobalConfig).toBe('function')
      expect(typeof client.destroy).toBe('function')
    })
  })
})