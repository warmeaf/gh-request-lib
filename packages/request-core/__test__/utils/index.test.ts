import { describe, it, expect, vi, beforeEach } from 'vitest'
import { ErrorHandler, LogFormatter } from '../../src/utils/error-handler'
import { RequestError, RequestErrorType } from '../../src/interface'

describe('ErrorHandler', () => {
    const mockContext = {
        url: 'https://api.example.com/users',
        method: 'GET'
    }

    beforeEach(() => {
        vi.clearAllMocks()
    })

    describe('wrapError', () => {
        it('should return RequestError as-is if already RequestError', () => {
            // 如果传入的已经是 RequestError，应该直接返回
            const originalError = new RequestError('Original error', {
                type: RequestErrorType.HTTP_ERROR,
                status: 404
            })

            const result = ErrorHandler.wrapError(originalError, mockContext)

            expect(result).toBe(originalError)
        })

        it('should wrap standard Error objects correctly', () => {
            // 应该正确包装标准 Error 对象
            const originalError = new Error('Network connection failed')

            const result = ErrorHandler.wrapError(originalError, mockContext)

            expect(result).toBeInstanceOf(RequestError)
            expect(result.message).toBe('Network connection failed')
            expect(result.originalError).toBe(originalError)
            expect(result.type).toBe(RequestErrorType.NETWORK_ERROR)
            expect(result.context).toMatchObject({
                url: mockContext.url,
                method: mockContext.method
            })
            expect(result.context.timestamp).toBeTypeOf('number')
        })

        it('should use custom message when provided', () => {
            // 当提供自定义消息时应该使用自定义消息
            const originalError = new Error('Original message')
            const customMessage = 'Custom error message'

            const result = ErrorHandler.wrapError(originalError, {
                ...mockContext,
                message: customMessage
            })

            expect(result.message).toBe(customMessage)
        })

        it('should handle non-Error objects', () => {
            // 应该处理非 Error 对象
            const unknownError = { code: 'UNKNOWN', details: 'Something went wrong' }

            const result = ErrorHandler.wrapError(unknownError, mockContext)

            expect(result).toBeInstanceOf(RequestError)
            expect(result.message).toBe('Unknown error')
            expect(result.originalError).toBe(unknownError)
            expect(result.type).toBe(RequestErrorType.UNKNOWN_ERROR)
        })

        it('should handle string errors', () => {
            // 应该处理字符串错误
            const stringError = 'Something went wrong'

            const result = ErrorHandler.wrapError(stringError, mockContext)

            expect(result).toBeInstanceOf(RequestError)
            expect(result.message).toBe('Unknown error')
            expect(result.originalError).toBe(stringError)
            expect(result.type).toBe(RequestErrorType.UNKNOWN_ERROR)
        })

        it('should handle null/undefined errors', () => {
            // 应该处理 null/undefined 错误
            const result1 = ErrorHandler.wrapError(null, mockContext)
            const result2 = ErrorHandler.wrapError(undefined, mockContext)

            expect(result1.message).toBe('Unknown error')
            expect(result1.type).toBe(RequestErrorType.UNKNOWN_ERROR)
            expect(result2.message).toBe('Unknown error')
            expect(result2.type).toBe(RequestErrorType.UNKNOWN_ERROR)
        })
    })

    describe('createHttpError', () => {
        it('should create HTTP error with correct properties', () => {
            // 应该创建具有正确属性的 HTTP 错误
            const status = 404
            const message = 'Not Found'
            const originalError = new Error('Original')

            const result = ErrorHandler.createHttpError(status, message, {
                ...mockContext,
                originalError
            })

            expect(result).toBeInstanceOf(RequestError)
            expect(result.message).toBe(message)
            expect(result.status).toBe(status)
            expect(result.isHttpError).toBe(true)
            expect(result.type).toBe(RequestErrorType.HTTP_ERROR)
            expect(result.originalError).toBe(originalError)
            expect(result.context).toMatchObject({
                url: mockContext.url,
                method: mockContext.method
            })
        })

        it('should work without originalError', () => {
            // 应该在没有 originalError 的情况下工作
            const result = ErrorHandler.createHttpError(500, 'Internal Server Error', mockContext)

            expect(result.status).toBe(500)
            expect(result.originalError).toBeUndefined()
        })
    })

    describe('createNetworkError', () => {
        it('should create network error with correct properties', () => {
            // 应该创建具有正确属性的网络错误
            const message = 'Connection failed'
            const originalError = new Error('Network timeout')

            const result = ErrorHandler.createNetworkError(message, {
                ...mockContext,
                originalError
            })

            expect(result).toBeInstanceOf(RequestError)
            expect(result.message).toBe(message)
            expect(result.type).toBe(RequestErrorType.NETWORK_ERROR)
            expect(result.originalError).toBe(originalError)
            expect(result.context).toMatchObject({
                url: mockContext.url,
                method: mockContext.method
            })
        })
    })

    describe('createTimeoutError', () => {
        it('should create timeout error with correct properties', () => {
            // 应该创建具有正确属性的超时错误
            const message = 'Request timeout'
            const timeout = 5000
            const originalError = new Error('Timeout')

            const result = ErrorHandler.createTimeoutError(message, {
                ...mockContext,
                timeout,
                originalError
            })

            expect(result).toBeInstanceOf(RequestError)
            expect(result.message).toBe(message)
            expect(result.type).toBe(RequestErrorType.TIMEOUT_ERROR)
            expect(result.originalError).toBe(originalError)
            expect(result.context.metadata).toEqual({ timeout })
        })

        it('should work without timeout value', () => {
            // 应该在没有超时值的情况下工作
            const result = ErrorHandler.createTimeoutError('Timeout occurred', mockContext)

            expect(result.type).toBe(RequestErrorType.TIMEOUT_ERROR)
            expect(result.context.metadata).toEqual({ timeout: undefined })
        })
    })

    describe('inferErrorType', () => {
        // 测试私有方法通过 wrapError 间接测试
        it('should infer network error types correctly', () => {
            // 应该正确推断网络错误类型
            const networkErrors = [
                new Error('network error occurred'),
                new Error('fetch failed'),
                new Error('connection refused'),
                new Error('CORS policy blocked')
            ]

            networkErrors.forEach(error => {
                const result = ErrorHandler.wrapError(error, mockContext)
                expect(result.type).toBe(RequestErrorType.NETWORK_ERROR)
            })
        })

        it('should infer timeout error types correctly', () => {
            // 应该正确推断超时错误类型
            const timeoutError1 = new Error('request timeout')
            const timeoutError2 = new Error('Operation timeout')  // 修改为 "timeout" 而不是 "timed out"
            const abortError = new Error('Request aborted')
            abortError.name = 'AbortError'

            const result1 = ErrorHandler.wrapError(timeoutError1, mockContext)
            const result2 = ErrorHandler.wrapError(timeoutError2, mockContext)
            const result3 = ErrorHandler.wrapError(abortError, mockContext)

            expect(result1.type).toBe(RequestErrorType.TIMEOUT_ERROR)
            expect(result2.type).toBe(RequestErrorType.TIMEOUT_ERROR)
            expect(result3.type).toBe(RequestErrorType.TIMEOUT_ERROR)
        })

        it('should prioritize network errors over timeout errors', () => {
            // 网络错误应该优先于超时错误
            const connectionTimeoutError = new Error('connection timeout')

            const result = ErrorHandler.wrapError(connectionTimeoutError, mockContext)

            expect(result.type).toBe(RequestErrorType.NETWORK_ERROR)
        })

        it('should default to unknown error type', () => {
            // 应该默认为未知错误类型
            const unknownError = new Error('some random error')

            const result = ErrorHandler.wrapError(unknownError, mockContext)

            expect(result.type).toBe(RequestErrorType.UNKNOWN_ERROR)
        })
    })
})
describe('LogFormatter', () => {
    describe('formatRequestStart', () => {
        it('should format request start log correctly', () => {
            // 应该正确格式化请求开始日志
            const result = LogFormatter.formatRequestStart('AxiosRequestor', 'GET', '/api/users')

            expect(result).toContain('🌐 [AxiosRequestor] Sending request with AxiosRequestor...')
            expect(result).toContain('Method: GET')
            expect(result).toContain('URL: /api/users')
        })

        it('should include extra information when provided', () => {
            // 当提供额外信息时应该包含在内
            const extra = { timeout: 5000, retries: 3 }
            const result = LogFormatter.formatRequestStart('FetchRequestor', 'POST', '/api/data', extra)

            expect(result).toContain('timeout: 5000')
            expect(result).toContain('retries: 3')
        })
    })

    describe('formatRequestSuccess', () => {
        it('should format success log without duration', () => {
            // 应该格式化不带持续时间的成功日志
            const result = LogFormatter.formatRequestSuccess('AxiosRequestor', 'GET', '/api/users')

            expect(result).toBe('✅ [AxiosRequestor] Request completed successfully')
        })

        it('should format success log with duration', () => {
            // 应该格式化带持续时间的成功日志
            const result = LogFormatter.formatRequestSuccess('AxiosRequestor', 'GET', '/api/users', 1234.56)

            expect(result).toBe('✅ [AxiosRequestor] Request completed successfully (1235ms)')
        })
    })

    describe('formatRequestError', () => {
        it('should format error log with RequestError', () => {
            // 应该格式化带 RequestError 的错误日志
            const error = new RequestError('Not found', {
                status: 404,
                type: RequestErrorType.HTTP_ERROR
            })

            const result = LogFormatter.formatRequestError('AxiosRequestor', 'GET', '/api/users', error, 500)

            expect(result).toContain('❌ [AxiosRequestor] Request failed (500ms)')
            expect(result).toContain('URL: /api/users')
            expect(result).toContain('Method: GET')
            // RequestError 的 toDisplayMessage() 返回中文格式，所以检查 "错误: Not found"
            expect(result).toContain('错误: Not found')
        })

        it('should format error log with standard Error', () => {
            // 应该格式化带标准 Error 的错误日志
            const error = new Error('Network connection failed')

            const result = LogFormatter.formatRequestError('FetchRequestor', 'POST', '/api/data', error)

            expect(result).toContain('❌ [FetchRequestor] Request failed')
            expect(result).toContain('Error: Network connection failed')
            expect(result).not.toContain('ms)')
        })

        it('should format error log with unknown error type', () => {
            // 应该格式化带未知错误类型的错误日志
            const error = { code: 'UNKNOWN', message: 'Something went wrong' }

            const result = LogFormatter.formatRequestError('CustomRequestor', 'DELETE', '/api/item', error)

            expect(result).toContain('Error: [object Object]')
        })
    })

    describe('formatCacheLog', () => {
        it('should format cache hit log', () => {
            // 应该格式化缓存命中日志
            const result = LogFormatter.formatCacheLog('hit', 'GET:/api/users?page=1')

            expect(result).toBe('🎯 [Cache] Cache hit: GET:/api/users?page=1')
        })

        it('should format cache miss log', () => {
            // 应该格式化缓存未命中日志
            const result = LogFormatter.formatCacheLog('miss', 'POST:/api/data')

            expect(result).toBe('❌ [Cache] Cache miss: POST:/api/data')
        })

        it('should format cache set log with extra info', () => {
            // 应该格式化带额外信息的缓存设置日志
            const extra = { ttl: '30s', size: '1.2KB' }
            const result = LogFormatter.formatCacheLog('set', 'GET:/api/config', extra)

            expect(result).toContain('💾 [Cache] Cache set: GET:/api/config')
            expect(result).toContain('ttl: 30s')
            expect(result).toContain('size: 1.2KB')
        })

        it('should truncate long cache keys', () => {
            // 应该截断长缓存键
            const longKey = 'GET:/api/very/long/path/that/exceeds/fifty/characters/limit/and/should/be/truncated'
            const result = LogFormatter.formatCacheLog('clear', longKey)

            // 实际截断的是前50个字符，然后加上 "..."
            expect(result).toContain('GET:/api/very/long/path/that/exceeds/fifty/charact...')
            expect(result).toContain('🗑️ [Cache] Cache clear:')
        })

        it('should format cache error log', () => {
            // 应该格式化缓存错误日志
            const result = LogFormatter.formatCacheLog('error', 'GET:/api/users')

            expect(result).toBe('⚠️ [Cache] Cache error: GET:/api/users')
        })
    })

    describe('formatConcurrentLog', () => {
        it('should format concurrent start log', () => {
            // 应该格式化并发开始日志
            const result = LogFormatter.formatConcurrentLog('start', 0, 5, '/api/users')

            expect(result).toContain('🚀 [Concurrent] Request 1/5 start')
            expect(result).toContain('URL: /api/users')
        })

        it('should format concurrent complete log', () => {
            // 应该格式化并发完成日志
            const result = LogFormatter.formatConcurrentLog('complete', 2, 5, '/api/data')

            expect(result).toContain('✅ [Concurrent] Request 3/5 complete')
            expect(result).toContain('URL: /api/data')
        })

        it('should format concurrent failed log with extra info', () => {
            // 应该格式化带额外信息的并发失败日志
            const extra = { error: 'Timeout', duration: '5000ms' }
            const result = LogFormatter.formatConcurrentLog('failed', 4, 10, '/api/upload', extra)

            expect(result).toContain('❌ [Concurrent] Request 5/10 failed')
            expect(result).toContain('URL: /api/upload')
            expect(result).toContain('error: Timeout')
            expect(result).toContain('duration: 5000ms')
        })
    })
})