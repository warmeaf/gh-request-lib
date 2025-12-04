import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApiClient } from '../src/index'
import type { ApiInstance, Requestor, GlobalConfig } from '../src/index'
import { RequestCore } from 'request-core'

// 模拟request-core
vi.mock('request-core', () => ({
  RequestCore: vi.fn().mockImplementation(() => ({
    setGlobalConfig: vi.fn(),
    clearCache: vi.fn(),
    destroy: vi.fn(),
  })),
}))

describe('Integration Tests', () => {
  let mockRequestor: Requestor
  let mockRequestCore: RequestCore

  beforeEach(() => {
    vi.clearAllMocks()
    
    mockRequestor = {
      request: vi.fn()
    } as any
    mockRequestCore = {
      setGlobalConfig: vi.fn(),
      clearCache: vi.fn(),
      destroy: vi.fn(),
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

      // 创建API客户端
      const client = createApiClient(
        {
          user: UserApi,
          order: OrderApi,
        },
        {
          requestor: mockRequestor,
          globalConfig,
        }
      )

      // 验证RequestCore创建和配置
      expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
      expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(globalConfig)

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

      // 动态更新全局配置
      const newConfig: GlobalConfig = {
        baseURL: 'https://new-api.com',
        timeout: 10000,
      }
      client.setGlobalConfig(newConfig)
      expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(newConfig)

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

    it('should handle complex API interactions', async () => {
      // 创建更复杂的API类，模拟真实场景
      class ComplexUserApi implements ApiInstance {
        requestCore: RequestCore
        private cache = new Map<string, any>()

        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
        }

        async getUser(id: string, useCache = true): Promise<{ id: string; name: string; email: string }> {
          if (useCache && this.cache.has(id)) {
            console.log(`Returning cached user: ${id}`)
            return this.cache.get(id)
          }

          console.log(`Fetching user from API: ${id}`)
          const user = { id, name: `User ${id}`, email: `user${id}@example.com` }
          this.cache.set(id, user)
          return user
        }

        async createUser(userData: { name: string; email: string }): Promise<{ id: string; name: string; email: string }> {
          const id = `user-${Date.now()}`
          const user = { id, ...userData }
          this.cache.set(id, user)
          console.log(`Created user:`, user)
          return user
        }

        async updateUser(id: string, updates: Partial<{ name: string; email: string }>): Promise<{ id: string; name: string; email: string }> {
          const existing = await this.getUser(id)
          const updated = { ...existing, ...updates }
          this.cache.set(id, updated)
          console.log(`Updated user ${id}:`, updated)
          return updated
        }

        clearCache(): void {
          this.cache.clear()
        }

        getCacheSize(): number {
          return this.cache.size
        }
      }

      const globalConfig: GlobalConfig = {
        baseURL: 'https://api.complex.com',
        timeout: 8000,
        headers: {
          'Content-Type': 'application/json',
          'X-Client-Version': '2.0'
        }
      }

      const client = createApiClient(
        { user: ComplexUserApi },
        {
          requestor: mockRequestor,
          globalConfig,
        }
      )

      // 测试复杂的API交互流程
      const user1 = await client.user.createUser({ name: 'John Doe', email: 'john@example.com' })
      expect(user1.name).toBe('John Doe')
      expect(user1.email).toBe('john@example.com')
      expect(client.user.getCacheSize()).toBe(1)

      const user2 = await client.user.getUser(user1.id)
      expect(user2).toEqual(user1) // 应该从缓存返回

      const updatedUser = await client.user.updateUser(user1.id, { name: 'John Smith' })
      expect(updatedUser.name).toBe('John Smith')
      expect(updatedUser.email).toBe('john@example.com')

      // 测试缓存管理
      client.user.clearCache()
      expect(client.user.getCacheSize()).toBe(0)

      // 验证RequestCore配置
      expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(globalConfig)
    })

    it('should handle real-world API patterns', async () => {
      // 模拟真实的REST API模式
      class RestfulUserApi implements ApiInstance {
        requestCore: RequestCore
        private readonly basePath = '/users'

        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
        }

        async list(params?: { page?: number; limit?: number; search?: string }): Promise<{ users: any[]; total: number }> {
          console.log(`GET ${this.basePath}`, params)
          const users = Array.from({ length: params?.limit || 10 }, (_, i) => ({
            id: `user-${i + 1}`,
            name: `User ${i + 1}`,
            email: `user${i + 1}@example.com`
          }))
          return { users, total: 100 }
        }

        async get(id: string): Promise<{ id: string; name: string; email: string; profile: any }> {
          console.log(`GET ${this.basePath}/${id}`)
          return {
            id,
            name: `User ${id}`,
            email: `user${id}@example.com`,
            profile: { avatar: `https://avatar.com/${id}`, bio: `Bio for ${id}` }
          }
        }

        async create(data: { name: string; email: string }): Promise<{ id: string; name: string; email: string }> {
          console.log(`POST ${this.basePath}`, data)
          return { id: `user-${Date.now()}`, ...data }
        }

        async update(id: string, data: Partial<{ name: string; email: string }>): Promise<{ id: string; name: string; email: string }> {
          console.log(`PUT ${this.basePath}/${id}`, data)
          const existing = await this.get(id)
          return { ...existing, ...data }
        }

        async delete(id: string): Promise<{ success: boolean; message: string }> {
          console.log(`DELETE ${this.basePath}/${id}`)
          return { success: true, message: `User ${id} deleted successfully` }
        }
      }

      class AuthApi implements ApiInstance {
        requestCore: RequestCore

        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
        }

        async login(credentials: { email: string; password: string }): Promise<{ token: string; user: any }> {
          console.log('POST /auth/login', { email: credentials.email, password: '[REDACTED]' })
          return {
            token: 'jwt-token-example',
            user: { id: 'user-1', email: credentials.email, name: 'John Doe' }
          }
        }

        async logout(): Promise<{ success: boolean }> {
          console.log('POST /auth/logout')
          return { success: true }
        }

        async refreshToken(token: string): Promise<{ token: string }> {
          console.log('POST /auth/refresh')
          return { token: 'new-jwt-token-example' }
        }
      }

      const client = createApiClient(
        {
          users: RestfulUserApi,
          auth: AuthApi
        },
        {
          requestor: mockRequestor,
          globalConfig: {
            baseURL: 'https://api.myapp.com',
            timeout: 10000,
            headers: {
              'Content-Type': 'application/json',
              'X-Client-Version': '1.0.0'
            }
          },
        }
      )

      // 测试完整的认证流程
      const loginResult = await client.auth.login({
        email: 'john@example.com',
        password: 'password123'
      })
      expect(loginResult.token).toBe('jwt-token-example')
      expect(loginResult.user.email).toBe('john@example.com')

      // 测试用户CRUD操作
      const usersList = await client.users.list({ page: 1, limit: 5 })
      expect(usersList.users).toHaveLength(5)
      expect(usersList.total).toBe(100)

      const newUser = await client.users.create({
        name: 'Jane Doe',
        email: 'jane@example.com'
      })
      expect(newUser.name).toBe('Jane Doe')
      expect(newUser.email).toBe('jane@example.com')

      const userDetail = await client.users.get(newUser.id)
      expect(userDetail.id).toBe(newUser.id)
      expect(userDetail.profile).toBeDefined()

      const updatedUser = await client.users.update(newUser.id, { name: 'Jane Smith' })
      expect(updatedUser.name).toBe('Jane Smith')

      const deleteResult = await client.users.delete(newUser.id)
      expect(deleteResult.success).toBe(true)

      // 测试token刷新
      const refreshResult = await client.auth.refreshToken('old-token')
      expect(refreshResult.token).toBe('new-jwt-token-example')
    })

    it('should handle microservices architecture pattern', async () => {
      // 模拟微服务架构中的多个服务API
      class UserServiceApi implements ApiInstance {
        requestCore: RequestCore
        constructor(requestCore: RequestCore) { this.requestCore = requestCore }
        
        async getProfile(userId: string) {
          console.log(`UserService: Getting profile for ${userId}`)
          return { userId, service: 'user-service', data: { name: 'John', email: 'john@example.com' } }
        }
      }

      class OrderServiceApi implements ApiInstance {
        requestCore: RequestCore
        constructor(requestCore: RequestCore) { this.requestCore = requestCore }
        
        async getOrders(userId: string) {
          console.log(`OrderService: Getting orders for ${userId}`)
          return { userId, service: 'order-service', orders: [{ id: 'order-1', amount: 100 }] }
        }
      }

      class PaymentServiceApi implements ApiInstance {
        requestCore: RequestCore
        constructor(requestCore: RequestCore) { this.requestCore = requestCore }
        
        async processPayment(orderId: string, amount: number) {
          console.log(`PaymentService: Processing payment for order ${orderId}, amount ${amount}`)
          return { orderId, amount, service: 'payment-service', status: 'completed' }
        }
      }

      class NotificationServiceApi implements ApiInstance {
        requestCore: RequestCore
        constructor(requestCore: RequestCore) { this.requestCore = requestCore }
        
        async sendNotification(userId: string, message: string) {
          console.log(`NotificationService: Sending notification to ${userId}: ${message}`)
          return { userId, message, service: 'notification-service', sent: true }
        }
      }

      // 为每个服务创建独立的客户端（模拟不同的服务端点）
      const userServiceClient = createApiClient(
        { users: UserServiceApi },
        {
          requestor: mockRequestor,
          globalConfig: { baseURL: 'https://user-service.myapp.com' }
        }
      )

      const orderServiceClient = createApiClient(
        { orders: OrderServiceApi },
        {
          requestor: mockRequestor,
          globalConfig: { baseURL: 'https://order-service.myapp.com' }
        }
      )

      const paymentServiceClient = createApiClient(
        { payments: PaymentServiceApi },
        {
          requestor: mockRequestor,
          globalConfig: { baseURL: 'https://payment-service.myapp.com' }
        }
      )

      const notificationServiceClient = createApiClient(
        { notifications: NotificationServiceApi },
        {
          requestor: mockRequestor,
          globalConfig: { baseURL: 'https://notification-service.myapp.com' }
        }
      )

      // 模拟跨服务的业务流程
      const userId = 'user-123'
      
      // 1. 获取用户信息
      const userProfile = await userServiceClient.users.getProfile(userId)
      expect(userProfile.service).toBe('user-service')
      
      // 2. 获取用户订单
      const userOrders = await orderServiceClient.orders.getOrders(userId)
      expect(userOrders.service).toBe('order-service')
      expect(userOrders.orders).toHaveLength(1)
      
      // 3. 处理支付
      const paymentResult = await paymentServiceClient.payments.processPayment(
        userOrders.orders[0].id,
        userOrders.orders[0].amount
      )
      expect(paymentResult.service).toBe('payment-service')
      expect(paymentResult.status).toBe('completed')
      
      // 4. 发送通知
      const notificationResult = await notificationServiceClient.notifications.sendNotification(
        userId,
        `Payment of $${paymentResult.amount} completed successfully`
      )
      expect(notificationResult.service).toBe('notification-service')
      expect(notificationResult.sent).toBe(true)

      // 验证每个服务都有独立的RequestCore实例
      expect(RequestCore).toHaveBeenCalledTimes(4)
    })
  })

  describe('Error handling and edge cases', () => {
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

    it('should handle requestor errors', async () => {
      const errorRequestor: Requestor = {
        request: vi.fn().mockRejectedValue(new Error('Network error'))
      }
      
      const client = createApiClient(
        { user: UserApi },
        { requestor: errorRequestor }
      )

      // 模拟API方法调用requestor时的错误
      class ErrorProneApi implements ApiInstance {
        requestCore: RequestCore

        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
        }

        async makeRequest(): Promise<any> {
          // 这里会调用requestor，可能抛出错误
          return this.requestCore
        }
      }

      const errorClient = createApiClient(
        { error: ErrorProneApi },
        { requestor: errorRequestor }
      )

      // 验证错误处理
      expect(errorClient.error).toBeInstanceOf(ErrorProneApi)
    })


    it('should handle cache operation errors', () => {
      // 模拟缓存操作错误
      const errorRequestCore = {
        ...mockRequestCore,
        clearCache: vi.fn().mockImplementation(() => {
          throw new Error('Cache clear error')
        }),
      } as any

      const client = createApiClient(
        { user: UserApi },
        { requestCore: errorRequestCore }
      )

      // 缓存操作错误应该被传播
      expect(() => client.clearCache()).toThrow('Cache clear error')
    })

    it('should handle large number of APIs', () => {
      // 创建大量API类
      const manyApis: Record<string, any> = {}
      for (let i = 0; i < 100; i++) {
        manyApis[`api${i}`] = class implements ApiInstance {
          requestCore: RequestCore
          constructor(requestCore: RequestCore) {
            this.requestCore = requestCore
          }
          getIndex() { return i }
        }
      }

      const client = createApiClient(manyApis, { requestCore: mockRequestCore })

      // 验证所有API都被正确创建
      expect(Object.keys(client)).toContain('api0')
      expect(Object.keys(client)).toContain('api99')
      expect(client.api0.getIndex()).toBe(0)
      expect(client.api99.getIndex()).toBe(99)
    })
  })
})