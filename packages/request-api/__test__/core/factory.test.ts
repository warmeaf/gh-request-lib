import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequestCore } from '../../src/core/factory'
import { RequestCore, type Requestor, type GlobalConfig, type RequestInterceptor } from 'request-core'

// 模拟request-core模块
vi.mock('request-core', () => ({
    RequestCore: vi.fn().mockImplementation(() => ({
        setGlobalConfig: vi.fn(),
        addInterceptor: vi.fn(),
    })),
}))

describe('Factory', () => {
    let mockRequestor: Requestor
    let mockRequestCore: RequestCore

    beforeEach(() => {
        vi.clearAllMocks()

        mockRequestor = vi.fn() as any
        mockRequestCore = {
            setGlobalConfig: vi.fn(),
            addInterceptor: vi.fn(),
        } as any

        // 设置RequestCore构造函数的模拟返回值
        vi.mocked(RequestCore).mockReturnValue(mockRequestCore)
    })

    describe('createRequestCore', () => {
        it('should create RequestCore with requestor only', () => {
            const result = createRequestCore(mockRequestor)

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
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
            expect(result).toBe(mockRequestCore)
        })

        it('should create RequestCore with interceptors', () => {
            const interceptor1: RequestInterceptor = {
                onRequest: vi.fn(),
                onResponse: vi.fn(),
            }
            const interceptor2: RequestInterceptor = {
                onRequest: vi.fn(),
                onResponse: vi.fn(),
            }
            const interceptors = [interceptor1, interceptor2]

            const result = createRequestCore(mockRequestor, { interceptors })

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.addInterceptor).toHaveBeenCalledTimes(2)
            expect(mockRequestCore.addInterceptor).toHaveBeenNthCalledWith(1, interceptor1)
            expect(mockRequestCore.addInterceptor).toHaveBeenNthCalledWith(2, interceptor2)
            expect(result).toBe(mockRequestCore)
        })

        it('should create RequestCore with both global config and interceptors', () => {
            const globalConfig: GlobalConfig = {
                baseURL: 'https://api.example.com',
                timeout: 5000,
            }
            const interceptor: RequestInterceptor = {
                onRequest: vi.fn(),
                onResponse: vi.fn(),
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
    })
})