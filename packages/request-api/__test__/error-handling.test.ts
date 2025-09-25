import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApiClient } from '../src/index'
import type { ApiInstance, Requestor, GlobalConfig, RequestInterceptor } from '../src/index'
import { RequestCore, RequestError, RequestErrorType } from 'request-core'

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
    RequestError: class MockRequestError extends Error {
        type: string
        constructor(message: string, type: string) {
            super(message)
            this.name = 'RequestError'
            this.type = type
        }
    },
    RequestErrorType: {
        NETWORK_ERROR: 'NETWORK_ERROR',
        HTTP_ERROR: 'HTTP_ERROR',
        TIMEOUT_ERROR: 'TIMEOUT_ERROR',
        VALIDATION_ERROR: 'VALIDATION_ERROR',
        CACHE_ERROR: 'CACHE_ERROR',
        CONCURRENT_ERROR: 'CONCURRENT_ERROR',
        RETRY_ERROR: 'RETRY_ERROR',
        UNKNOWN_ERROR: 'UNKNOWN_ERROR',
    }
}))

describe('Error Handling', () => {
    let mockRequestor: Requestor
    let mockRequestCore: RequestCore

    beforeEach(() => {
        vi.clearAllMocks()

        mockRequestor = {
            request: vi.fn()
        } as any
        mockRequestCore = {
            setGlobalConfig: vi.fn(),
            addInterceptor: vi.fn(),
            clearCache: vi.fn(),
            getCacheStats: vi.fn().mockReturnValue({ hits: 0, misses: 0 }),
            clearInterceptors: vi.fn(),
            destroy: vi.fn(),
            getAllStats: vi.fn().mockReturnValue({ requests: 0 }),
        } as any

        vi.mocked(RequestCore).mockReturnValue(mockRequestCore)
    })

    describe('RequestError handling', () => {
        it('should handle network errors correctly', async () => {
            class NetworkErrorApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                async makeNetworkRequest(): Promise<never> {
                    throw new RequestError('Network connection failed', { type: RequestErrorType.NETWORK_ERROR })
                }
            }

            const client = createApiClient(
                { network: NetworkErrorApi },
                { requestor: mockRequestor }
            )

            await expect(client.network.makeNetworkRequest()).rejects.toMatchObject({
                name: 'RequestError',
                message: 'Network connection failed',
                type: RequestErrorType.NETWORK_ERROR
            })
        })

        it('should handle timeout errors correctly', async () => {
            class TimeoutErrorApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                async makeTimeoutRequest(): Promise<never> {
                    throw new RequestError('Request timeout after 5000ms', { type: RequestErrorType.TIMEOUT_ERROR })
                }
            }

            const client = createApiClient(
                { timeout: TimeoutErrorApi },
                { requestor: mockRequestor }
            )

            await expect(client.timeout.makeTimeoutRequest()).rejects.toMatchObject({
                name: 'RequestError',
                message: 'Request timeout after 5000ms',
                type: RequestErrorType.TIMEOUT_ERROR
            })
        })

        it('should handle validation errors correctly', async () => {
            class ValidationErrorApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                async validateInput(data: any): Promise<never> {
                    if (!data || typeof data !== 'object') {
                        throw new RequestError('Invalid input data format', { type: RequestErrorType.VALIDATION_ERROR })
                    }
                    throw new RequestError('Validation failed', { type: RequestErrorType.VALIDATION_ERROR })
                }
            }

            const client = createApiClient(
                { validation: ValidationErrorApi },
                { requestor: mockRequestor }
            )

            await expect(client.validation.validateInput(null)).rejects.toMatchObject({
                name: 'RequestError',
                message: 'Invalid input data format',
                type: RequestErrorType.VALIDATION_ERROR
            })

            await expect(client.validation.validateInput({})).rejects.toMatchObject({
                name: 'RequestError',
                message: 'Validation failed',
                type: RequestErrorType.VALIDATION_ERROR
            })
        })

        it('should handle server errors correctly', async () => {
            class ServerErrorApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                async makeServerRequest(): Promise<never> {
                    throw new RequestError('Internal server error (500)', { type: RequestErrorType.HTTP_ERROR, status: 500 })
                }
            }

            const client = createApiClient(
                { server: ServerErrorApi },
                { requestor: mockRequestor }
            )

            await expect(client.server.makeServerRequest()).rejects.toMatchObject({
                name: 'RequestError',
                message: 'Internal server error (500)',
                type: RequestErrorType.HTTP_ERROR
            })
        })
    })

    describe('API constructor errors', () => {
        it('should handle missing RequestCore in constructor', () => {
            class StrictApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    if (!requestCore) {
                        throw new Error('RequestCore is required')
                    }
                    this.requestCore = requestCore
                }
            }

            expect(() => {
                createApiClient({ strict: StrictApi }, { requestCore: null as any })
            }).toThrow('Must provide either requestor or requestCore option')
        })

        it('should handle API constructor validation errors', () => {
            class ValidatingApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    if (!requestCore || typeof requestCore !== 'object') {
                        throw new Error('Invalid RequestCore instance')
                    }
                    this.requestCore = requestCore
                }
            }

            expect(() => {
                createApiClient({ validating: ValidatingApi }, { requestCore: 'invalid' as any })
            }).toThrow('Invalid RequestCore instance')
        })
    })

    describe('Interceptor errors', () => {
        it('should handle request interceptor errors', () => {
            const faultyRequestInterceptor: RequestInterceptor = {
                onRequest: vi.fn().mockImplementation(() => {
                    throw new Error('Request interceptor failed')
                })
            }

            class TestApi implements ApiInstance {
                requestCore: RequestCore
                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }
            }

            // 创建客户端时不应该抛出错误（拦截器错误在运行时处理）
            expect(() => {
                createApiClient(
                    { test: TestApi },
                    {
                        requestor: mockRequestor,
                        interceptors: [faultyRequestInterceptor]
                    }
                )
            }).not.toThrow()

            expect(mockRequestCore.addInterceptor).toHaveBeenCalledWith(faultyRequestInterceptor)
        })

        it('should handle response interceptor errors', () => {
            const faultyResponseInterceptor: RequestInterceptor = {
                onResponse: vi.fn().mockImplementation(() => {
                    throw new Error('Response interceptor failed')
                })
            }

            class TestApi implements ApiInstance {
                requestCore: RequestCore
                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }
            }

            expect(() => {
                createApiClient(
                    { test: TestApi },
                    {
                        requestor: mockRequestor,
                        interceptors: [faultyResponseInterceptor]
                    }
                )
            }).not.toThrow()

            expect(mockRequestCore.addInterceptor).toHaveBeenCalledWith(faultyResponseInterceptor)
        })
    })

    describe('Cache operation errors', () => {
        it('should propagate cache clear errors', () => {
            const errorRequestCore = {
                ...mockRequestCore,
                clearCache: vi.fn().mockImplementation(() => {
                    throw new Error('Failed to clear cache')
                })
            } as any

            class TestApi implements ApiInstance {
                requestCore: RequestCore
                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }
            }

            const client = createApiClient({ test: TestApi }, { requestCore: errorRequestCore })

            expect(() => client.clearCache()).toThrow('Failed to clear cache')
        })

        it('should propagate cache stats errors', () => {
            const errorRequestCore = {
                ...mockRequestCore,
                getCacheStats: vi.fn().mockImplementation(() => {
                    throw new Error('Failed to get cache stats')
                })
            } as any

            class TestApi implements ApiInstance {
                requestCore: RequestCore
                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }
            }

            const client = createApiClient({ test: TestApi }, { requestCore: errorRequestCore })

            expect(() => client.getCacheStats()).toThrow('Failed to get cache stats')
        })
    })

    describe('Configuration errors', () => {
        it('should handle invalid global config', () => {
            const errorRequestCore = {
                ...mockRequestCore,
                setGlobalConfig: vi.fn().mockImplementation(() => {
                    throw new Error('Invalid global configuration')
                })
            } as any

            class TestApi implements ApiInstance {
                requestCore: RequestCore
                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }
            }

            const client = createApiClient({ test: TestApi }, { requestCore: errorRequestCore })

            const invalidConfig: GlobalConfig = { baseURL: 'invalid-url' }
            expect(() => client.setGlobalConfig(invalidConfig)).toThrow('Invalid global configuration')
        })

        it('should handle interceptor addition errors', () => {
            const errorRequestCore = {
                ...mockRequestCore,
                addInterceptor: vi.fn().mockImplementation(() => {
                    throw new Error('Failed to add interceptor')
                })
            } as any

            class TestApi implements ApiInstance {
                requestCore: RequestCore
                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }
            }

            const client = createApiClient({ test: TestApi }, { requestCore: errorRequestCore })

            const interceptor: RequestInterceptor = { onRequest: vi.fn() }
            expect(() => client.addInterceptor(interceptor)).toThrow('Failed to add interceptor')
        })
    })

    describe('Async error handling', () => {
        it('should handle Promise rejection in API methods', async () => {
            class AsyncErrorApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                async rejectedPromise(): Promise<never> {
                    return Promise.reject(new Error('Promise was rejected'))
                }

                async throwInAsync(): Promise<never> {
                    await new Promise(resolve => setTimeout(resolve, 10))
                    throw new Error('Error thrown in async function')
                }

                async chainedErrors(): Promise<never> {
                    try {
                        await this.rejectedPromise()
                    } catch (error: any) {
                        throw new Error(`Chained error: ${error.message}`)
                    }
                    // 这行代码永远不会执行，但确保函数符合 never 返回类型
                    throw new Error('Unexpected execution path')
                }
            }

            const client = createApiClient({ asyncError: AsyncErrorApi }, { requestor: mockRequestor })

            await expect(client.asyncError.rejectedPromise()).rejects.toThrow('Promise was rejected')
            await expect(client.asyncError.throwInAsync()).rejects.toThrow('Error thrown in async function')
            await expect(client.asyncError.chainedErrors()).rejects.toThrow('Chained error: Promise was rejected')
        })

        it('should handle concurrent error scenarios', async () => {
            class ConcurrentErrorApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                async errorAfterDelay(delay: number, message: string): Promise<never> {
                    await new Promise(resolve => setTimeout(resolve, delay))
                    throw new Error(message)
                }
            }

            const client = createApiClient({ concurrent: ConcurrentErrorApi }, { requestor: mockRequestor })

            // 并发执行多个会失败的操作
            const promises = [
                client.concurrent.errorAfterDelay(10, 'Error 1'),
                client.concurrent.errorAfterDelay(20, 'Error 2'),
                client.concurrent.errorAfterDelay(5, 'Error 3'),
            ]

            const results = await Promise.allSettled(promises)

            // 验证所有操作都失败了
            expect(results).toHaveLength(3)
            results.forEach((result, index) => {
                expect(result.status).toBe('rejected')
                if (result.status === 'rejected') {
                    expect(result.reason.message).toBe(`Error ${index + 1}`)
                }
            })
        })
    })

    describe('Edge case error handling', () => {
        it('should handle null/undefined method calls gracefully', () => {
            class EdgeCaseApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                processValue(value: any): string {
                    if (value === null) {
                        throw new Error('Null value not allowed')
                    }
                    if (value === undefined) {
                        throw new Error('Undefined value not allowed')
                    }
                    return String(value)
                }
            }

            const client = createApiClient({ edge: EdgeCaseApi }, { requestor: mockRequestor })

            expect(() => client.edge.processValue(null)).toThrow('Null value not allowed')
            expect(() => client.edge.processValue(undefined)).toThrow('Undefined value not allowed')
            expect(client.edge.processValue('valid')).toBe('valid')
            expect(client.edge.processValue(123)).toBe('123')
        })

        it('should handle circular reference errors', () => {
            class CircularApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                processCircularObject(obj: any): string {
                    try {
                        return JSON.stringify(obj)
                    } catch (error) {
                        throw new Error(`Cannot process circular object: ${error.message}`)
                    }
                }
            }

            const client = createApiClient({ circular: CircularApi }, { requestor: mockRequestor })

            // 创建循环引用对象
            const circularObj: any = { name: 'test' }
            circularObj.self = circularObj

            expect(() => client.circular.processCircularObject(circularObj))
                .toThrow('Cannot process circular object')
        })
    })
})