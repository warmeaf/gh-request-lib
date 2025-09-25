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

        mockRequestor = {
            request: vi.fn()
        } as any
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

        it('should handle API constructor errors gracefully', async () => {
            const { createApiClient } = await import('../../src/client/api-client')

            class FaultyApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    if (!requestCore) {
                        throw new Error('RequestCore is required for FaultyApi')
                    }
                    this.requestCore = requestCore
                }
            }

            // 使用有效的requestCore不应该抛出错误
            expect(() => {
                createApiClient({ faulty: FaultyApi }, { requestCore: mockRequestCore })
            }).not.toThrow()

            // 使用null requestCore应该在构造时抛出错误
            expect(() => {
                createApiClient({ faulty: FaultyApi }, { requestCore: null as any })
            }).toThrow('Must provide either requestor or requestCore option')
        })

        it('should support async API methods', async () => {
            const { createApiClient } = await import('../../src/client/api-client')

            class AsyncApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                async fetchData(id: string): Promise<{ id: string; data: string }> {
                    console.log(`Async fetching data for id: ${id}`)
                    // 模拟异步操作
                    await new Promise(resolve => setTimeout(resolve, 10))
                    return { id, data: `async-data-${id}` }
                }

                async fetchWithError(): Promise<never> {
                    throw new Error('Simulated async error')
                }
            }

            const client = createApiClient({ async: AsyncApi }, { requestCore: mockRequestCore })

            // 测试成功的异步方法
            const result = await client.async.fetchData('123')
            expect(result).toEqual({ id: '123', data: 'async-data-123' })

            // 测试异步错误处理
            await expect(client.async.fetchWithError()).rejects.toThrow('Simulated async error')
        })

        it('should handle concurrent API operations', async () => {
            const { createApiClient } = await import('../../src/client/api-client')

            class ConcurrentApi implements ApiInstance {
                requestCore: RequestCore
                private counter = 0

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                async operation(delay: number): Promise<number> {
                    const currentCount = ++this.counter
                    console.log(`Starting operation ${currentCount} with delay ${delay}ms`)
                    await new Promise(resolve => setTimeout(resolve, delay))
                    return currentCount
                }
            }

            const client = createApiClient({ concurrent: ConcurrentApi }, { requestCore: mockRequestCore })

            // 并发执行多个操作
            const promises = [
                client.concurrent.operation(50),
                client.concurrent.operation(30),
                client.concurrent.operation(10),
            ]

            const results = await Promise.all(promises)

            // 验证所有操作都完成了
            expect(results).toHaveLength(3)
            expect(results).toEqual([1, 2, 3]) // 按启动顺序编号
        })

        it('should maintain API instance isolation', async () => {
            const { createApiClient } = await import('../../src/client/api-client')

            class StatefulApi implements ApiInstance {
                requestCore: RequestCore
                private state: string

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                    this.state = 'initial'
                }

                setState(newState: string): void {
                    this.state = newState
                }

                getState(): string {
                    return this.state
                }
            }

            // 创建两个独立的客户端
            const client1 = createApiClient({ stateful: StatefulApi }, { requestCore: mockRequestCore })
            const client2 = createApiClient({ stateful: StatefulApi }, { requestCore: mockRequestCore })

            // 修改第一个客户端的状态
            client1.stateful.setState('client1-state')

            // 验证状态隔离
            expect(client1.stateful.getState()).toBe('client1-state')
            expect(client2.stateful.getState()).toBe('initial')

            // 修改第二个客户端的状态
            client2.stateful.setState('client2-state')

            // 再次验证状态隔离
            expect(client1.stateful.getState()).toBe('client1-state')
            expect(client2.stateful.getState()).toBe('client2-state')
        })

        it('should handle complex client lifecycle', async () => {
            const { createApiClient } = await import('../../src/client/api-client')

            class LifecycleApi implements ApiInstance {
                requestCore: RequestCore
                private isDestroyed = false

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                checkStatus(): string {
                    return this.isDestroyed ? 'destroyed' : 'active'
                }

                markDestroyed(): void {
                    this.isDestroyed = true
                }
            }

            const client = createApiClient({ lifecycle: LifecycleApi }, { requestCore: mockRequestCore })

            // 初始状态
            expect(client.lifecycle.checkStatus()).toBe('active')

            // 添加拦截器
            const interceptor: RequestInterceptor = { onRequest: vi.fn() }
            client.addInterceptor(interceptor)
            expect(mockRequestCore.addInterceptor).toHaveBeenCalledWith(interceptor)

            // 更新配置
            const newConfig: GlobalConfig = { baseURL: 'https://updated.com' }
            client.setGlobalConfig(newConfig)
            expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(newConfig)

            // 清理缓存
            client.clearCache('test-key')
            expect(mockRequestCore.clearCache).toHaveBeenCalledWith('test-key')

            // 获取统计信息
            const stats = client.getAllStats()
            expect(stats).toEqual({ requests: 100 })

            // 标记为已销毁（模拟业务逻辑）
            client.lifecycle.markDestroyed()
            expect(client.lifecycle.checkStatus()).toBe('destroyed')

            // 销毁客户端
            client.destroy()
            expect(mockRequestCore.destroy).toHaveBeenCalled()
        })
    })
})