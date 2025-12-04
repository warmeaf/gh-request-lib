import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createRequestCore } from '../../src/core/factory'
import { RequestCore, type Requestor, type GlobalConfig } from 'request-core'

// 模拟request-core模块
vi.mock('request-core', () => ({
    RequestCore: vi.fn().mockImplementation(() => ({
        setGlobalConfig: vi.fn(),
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


        it('should handle undefined options', () => {
            const result = createRequestCore(mockRequestor, undefined)

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.setGlobalConfig).not.toHaveBeenCalled()
            expect(result).toBe(mockRequestCore)
        })

        it('should handle null options gracefully', () => {
            const result = createRequestCore(mockRequestor, null as any)

            expect(RequestCore).toHaveBeenCalledWith(mockRequestor)
            expect(mockRequestCore.setGlobalConfig).not.toHaveBeenCalled()
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

    })
})