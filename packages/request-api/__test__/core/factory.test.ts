import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequestCore } from '../../src/core/factory'
import { RequestCore, type Requestor, type GlobalConfig, type RequestInterceptor } from 'request-core'

// 模拟request-core模块
vi.mock('request-core', () => ({
    RequestCore: vi.fn().mockImplementation(() => ({
        setGlobalConfig: vi.fn(),
        addInterceptor: vi.fn(),
        destroy: vi.fn(),
    })),
}))

describe('Factory', () => {
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
            destroy: vi.fn(),
        } as any

        // 设置RequestCore构造函数的模拟返回值
        vi.mocked(RequestCore).mockReturnValue(mockRequestCore)
    })

    describe('createRequestCore', () => {
        it('should create RequestCore with requestor only', () => {
            const result = createRequestCore(mockRequestor)

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(RequestCore).toHaveBeenCalledTimes(1)
            expect(result).toBe(mockRequestCore)
            expect(mockRequestCore.setGlobalConfig).not.toHaveBeenCalled()
            expect(mockRequestCore.addInterceptor).not.toHaveBeenCalled()
        })

        it('should create RequestCore with global config', () => {
            const globalConfig: GlobalConfig = {
                baseURL: 'https://api.example.com',
                timeout: 5000,
            }

            const result = createRequestCore(mockRequestor, { globalConfig })

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(globalConfig)
            expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledTimes(1)
            expect(result).toBe(mockRequestCore)
        })

        it('should create RequestCore with single interceptor', () => {
            const interceptor: RequestInterceptor = {
                onRequest: vi.fn(),
                onResponse: vi.fn(),
            }

            const result = createRequestCore(mockRequestor, { interceptors: [interceptor] })

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.addInterceptor).toHaveBeenCalledWith(interceptor)
            expect(mockRequestCore.addInterceptor).toHaveBeenCalledTimes(1)
            expect(result).toBe(mockRequestCore)
        })

        it('should create RequestCore with multiple interceptors', () => {
            const interceptor1: RequestInterceptor = {
                onRequest: vi.fn(),
                onResponse: vi.fn(),
            }
            const interceptor2: RequestInterceptor = {
                onRequest: vi.fn(),
                onResponse: vi.fn(),
            }
            const interceptor3: RequestInterceptor = {
                onRequest: vi.fn(),
            }
            const interceptors = [interceptor1, interceptor2, interceptor3]

            const result = createRequestCore(mockRequestor, { interceptors })

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.addInterceptor).toHaveBeenCalledTimes(3)
            expect(mockRequestCore.addInterceptor).toHaveBeenNthCalledWith(1, interceptor1)
            expect(mockRequestCore.addInterceptor).toHaveBeenNthCalledWith(2, interceptor2)
            expect(mockRequestCore.addInterceptor).toHaveBeenNthCalledWith(3, interceptor3)
            expect(result).toBe(mockRequestCore)
        })

        it('should create RequestCore with both global config and interceptors', () => {
            const globalConfig: GlobalConfig = {
                baseURL: 'https://api.example.com',
                timeout: 5000,
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': 'Bearer token'
                }
            }
            const interceptor: RequestInterceptor = {
                onRequest: vi.fn((config) => {
                    console.log('Request interceptor processing config')
                    return config
                }),
                onResponse: vi.fn((response) => {
                    console.log('Response interceptor processing response')
                    return response
                }),
            }

            const result = createRequestCore(mockRequestor, {
                globalConfig,
                interceptors: [interceptor],
            })

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(globalConfig)
            expect(mockRequestCore.addInterceptor).toHaveBeenCalledWith(interceptor)
            expect(result).toBe(mockRequestCore)
        })

        it('should handle empty interceptors array', () => {
            const result = createRequestCore(mockRequestor, { interceptors: [] })

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.addInterceptor).not.toHaveBeenCalled()
            expect(result).toBe(mockRequestCore)
        })

        it('should handle undefined options', () => {
            const result = createRequestCore(mockRequestor, undefined)

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.setGlobalConfig).not.toHaveBeenCalled()
            expect(mockRequestCore.addInterceptor).not.toHaveBeenCalled()
            expect(result).toBe(mockRequestCore)
        })

        it('should handle null options gracefully', () => {
            const result = createRequestCore(mockRequestor, null as any)

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.setGlobalConfig).not.toHaveBeenCalled()
            expect(mockRequestCore.addInterceptor).not.toHaveBeenCalled()
            expect(result).toBe(mockRequestCore)
        })

        it('should handle complex global config', () => {
            const complexConfig: GlobalConfig = {
                baseURL: 'https://api.complex.com',
                timeout: 10000,
                headers: {
                    'User-Agent': 'TestAgent/1.0',
                    'Accept': 'application/json',
                    'X-API-Version': 'v2'
                },
                retries: 3,
                debug: true,
                cacheEnabled: true
            }

            const result = createRequestCore(mockRequestor, { globalConfig: complexConfig })

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(complexConfig)
            expect(result).toBe(mockRequestCore)
        })

        it('should handle interceptors with partial implementations', () => {
            const requestOnlyInterceptor: RequestInterceptor = {
                onRequest: vi.fn()
            }
            const responseOnlyInterceptor: RequestInterceptor = {
                onResponse: vi.fn()
            }

            const result = createRequestCore(mockRequestor, {
                interceptors: [requestOnlyInterceptor, responseOnlyInterceptor]
            })

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.addInterceptor).toHaveBeenCalledTimes(2)
            expect(mockRequestCore.addInterceptor).toHaveBeenNthCalledWith(1, requestOnlyInterceptor)
            expect(mockRequestCore.addInterceptor).toHaveBeenNthCalledWith(2, responseOnlyInterceptor)
            expect(result).toBe(mockRequestCore)
        })

        it('should maintain correct execution order for multiple configurations', () => {
            const globalConfig: GlobalConfig = { baseURL: 'https://test.com' }
            const interceptors = [
                { onRequest: vi.fn() },
                { onResponse: vi.fn() },
                { onRequest: vi.fn(), onResponse: vi.fn() }
            ]

            const result = createRequestCore(mockRequestor, { globalConfig, interceptors })

            // 验证执行顺序：先设置全局配置，再添加拦截器
            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.setGlobalConfig).toHaveBeenCalledWith(globalConfig)
            expect(mockRequestCore.addInterceptor).toHaveBeenCalledTimes(3)

            // 验证调用顺序
            const calls = vi.mocked(mockRequestCore.setGlobalConfig).mock.invocationCallOrder
            const interceptorCalls = vi.mocked(mockRequestCore.addInterceptor).mock.invocationCallOrder

            expect(calls[0]).toBeLessThan(interceptorCalls[0])
            expect(result).toBe(mockRequestCore)
        })
    })
})