import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApiClient } from '../src/index'
import type { ApiInstance, Requestor, GlobalConfig, RequestInterceptor } from '../src/index'
import { RequestCore } from 'request-core'

// 模拟request-core
vi.mock('request-core', () => ({
  RequestCore: vi.fn().mockImplementation(() => ({
    setGlobalConfig: vi.fn(),
    addInterceptor: vi.fn(),
    clearCache: vi.fn(),
    getCacheStats: vi.fn().mockReturnValue({ hits: 0, misses: 0 }),
    clearInterceptors: vi.fn(),
    destroy: vi.fn(),
    getAllStats: vi.fn().mockReturnValue({ requests: 0 }),
  })),
}))

describe('Integration Tests', () => {
  let mockRequestor: Requestor
  let mockRequestCore: RequestCore

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockRequestor = vi.fn() as any
    mockRequestCore = {
      setGlobalConfig: vi.fn(),
      addInterceptor: vi.fn(),
      clearCache: vi.fn(),
      getCacheStats: vi.fn().mockReturnValue({ hits: 5, misses: 2 }),
      clearInterceptors: vi.fn(),
      destroy: vi.fn(),
      getAllStats: vi.fn().mockReturnValue({ requests: 50 }),
    } as any
    
    vi.mocked(RequestCore).mockReturnValue(mockRequestCore)
  })

  // 创建示例API类
  class UserApi implements ApiInstance {
    requestCore: RequestCore

    constructor(requestCore: RequestCore) {
      this.requestCore = requestCore
    }

    async getUser(id: string) {
      console.log(`Fetching user with id: ${id}`)
      return { id, name: `User ${id}` }
    }

    async createUser(userData: { name: string }) {
      console.log(`Creating user with data:`, userData)
      return { id: 'new-id', ...userData }
    }
  }

  class OrderApi implements ApiInstance {
    requestCore: RequestCore

    constructor(requestCore: RequestCore) {
      this.requestCore = requestCore
    }

    async getOrder(id: string) {
      console.log(`Fetching order with id: ${id}`)
      return { id, amount: 100 }
    }
  }

  describe('Complete workflow', () => {
    it('should create and use API client with requestor', async () => {
      const globalConfig: GlobalConfig = {
        baseURL: 'https://api.example.com',
        timeout: 5000,
      }

      const requestInterceptor: RequestInterceptor = {
        onRequest: vi.fn((config) => {
          console.log('Request interceptor called')
          return config
        }),
        onResponse: vi.fn((response) => {
          console.log('Response interceptor called')
          return response
        }),
      }

      // 创建API客户端
      const client = createApiClient(
        {
          user: UserApi,
          order: OrderApi,
        },
        {
          requestor: mockRequestor,
          globalConfig,
          interceptors: [requestInterceptor],
        }
      )

      // 验证RequestCore创建和配置
      expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
      expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(globalConfig)
      expect(mockRequestCore.addInterceptor).toHaveBeenCalledWith(requestInterceptor)

      // 验证API实例
      expect(client.user).toBeInstanceOf(UserApi)
      expect(client.order).toBeInstanceOf(OrderApi)
      expect(client.user.requestCore).toBe(mockRequestCore)
      expect(client.order.requestCore).toBe(mockRequestCore)

      // 测试API方法
      const user = await client.user.getUser('123')
      expect(user).toEqual({ id: '123', name: 'User 123' })

      const order = await client.order.getOrder('456')
      expect(order).toEqual({ id: '456', amount: 100 })

      // 测试客户端管理功能
      client.clearCache('user-cache')
      expect(mockRequestCore.clearCache).toHaveBeenCalledWith('user-cache')

      const cacheStats = client.getCacheStats()
      expect(cacheStats).toEqual({ hits: 5, misses: 2 })

      const allStats = client.getAllStats()
      expect(allStats).toEqual({ requests: 50 })
    })

    it('should work with existing RequestCore instance', async () => {
      const existingCore = mockRequestCore

      const client = createApiClient(
        {
          user: UserApi,
        },
        {
          requestCore: existingCore,
        }
      )

      // 不应该创建新的RequestCore
      expect(RequestCore).not.toHaveBeenCalled()
      expect(client.user.requestCore).toBe(existingCore)

      // 测试功能
      const user = await client.user.createUser({ name: 'John Doe' })
      expect(user).toEqual({ id: 'new-id', name: 'John Doe' })
    })

    it('should handle dynamic configuration changes', async () => {
      const client = createApiClient(
        { user: UserApi },
        { requestor: mockRequestor }
      )

      // 动态添加拦截器
      const newInterceptor: RequestInterceptor = {
        onRequest: vi.fn(),
        onResponse: vi.fn(),
      }
      client.addInterceptor(newInterceptor)
      expect(mockRequestCore.addInterceptor).toHaveBeenCalledWith(newInterceptor)

      // 动态更新全局配置
      const newConfig: GlobalConfig = {
        baseURL: 'https://new-api.com',
        timeout: 10000,
      }
      client.setGlobalConfig(newConfig)
      expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(newConfig)

      // 清理拦截器
      client.clearInterceptors()
      expect(mockRequestCore.clearInterceptors).toHaveBeenCalled()

      // 销毁客户端
      client.destroy()
      expect(mockRequestCore.destroy).toHaveBeenCalled()
    })

    it('should support multiple independent clients', async () => {
      const client1 = createApiClient(
        { user: UserApi },
        { requestor: mockRequestor }
      )

      const client2 = createApiClient(
        { order: OrderApi },
        { requestor: mockRequestor }
      )

      // 两个客户端应该有不同的RequestCore实例
      expect(client1.user.requestCore).toBe(mockRequestCore)
      expect(client2.order.requestCore).toBe(mockRequestCore)

      // 但是由于我们mock了RequestCore构造函数，实际上返回的是同一个实例
      // 在真实环境中，这些会是不同的实例
      expect(RequestCore).toHaveBeenCalledTimes(2)
    })
  })

  describe('Error handling', () => {
    it('should throw error when no requestor or requestCore provided', () => {
      expect(() => {
        createApiClient({ user: UserApi }, {})
      }).toThrow('Must provide either requestor or requestCore option')
    })

    it('should handle API constructor errors gracefully', () => {
      class FaultyApi implements ApiInstance {
        requestCore: RequestCore

        constructor(requestCore: RequestCore) {
          if (!requestCore) {
            throw new Error('RequestCore is required')
          }
          this.requestCore = requestCore
        }
      }

      // 这应该不会抛出错误，因为我们提供了有效的requestCore
      expect(() => {
        createApiClient(
          { faulty: FaultyApi },
          { requestCore: mockRequestCore }
        )
      }).not.toThrow()
    })
  })
})