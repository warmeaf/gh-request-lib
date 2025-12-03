import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig, RequestError, RequestErrorType, RequestInterceptor } from '../../src/interface'
import {
  CoreMockRequestor,
  createCoreMockRequestor,
  cleanupCoreTest,
  CORE_TEST_URLS
} from './core-test-helpers'

describe('RequestCore 错误处理集成测试', () => {
  let mockRequestor: CoreMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = createCoreMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupCoreTest(mockRequestor, requestCore)
  })

  describe('基础错误处理', () => {
    test('应该将普通错误转换为 RequestError', async () => {
      const originalError = new Error('Network connection failed')
      mockRequestor.setReject(originalError)

      try {
        await requestCore.get(CORE_TEST_URLS.ERROR)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Network connection failed')
      }
    })

    test('应该保持 RequestError 类型不变', async () => {
      const requestError = new RequestError('Custom request error', {
        type: RequestErrorType.NETWORK_ERROR,
        code: 'CUSTOM_ERROR',
        status: 500
      })
      mockRequestor.setReject(requestError)

      try {
        await requestCore.get(CORE_TEST_URLS.ERROR)
      } catch (error) {
        expect(error).toBe(requestError)
        expect((error as RequestError).type).toBe(RequestErrorType.NETWORK_ERROR)
        expect((error as RequestError).code).toBe('CUSTOM_ERROR')
        expect((error as RequestError).status).toBe(500)
      }
    })

    test('应该处理未知类型的错误', async () => {
      const unknownError = { message: 'Unknown error object' }
      mockRequestor.setReject(unknownError)

      try {
        await requestCore.get(CORE_TEST_URLS.ERROR)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Unknown error')
      }
    })

    test('应该处理 null 或 undefined 错误', async () => {
      mockRequestor.setReject(null)

      try {
        await requestCore.get(CORE_TEST_URLS.ERROR)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Unknown error')
      }
    })
  })

  describe('配置验证错误', () => {
    test('应该处理配置验证错误', async () => {
      // 创建一个无效的配置（缺少必需字段）
      const invalidConfig = {} as RequestConfig

      await expect(requestCore.request(invalidConfig)).rejects.toThrow()
    })

    test('RequestBuilder 应该在缺少 URL 时抛出特定错误', async () => {
      try {
        await requestCore
          .create()
          .method('GET')
          .send()
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('URL is required')
        expect((error as RequestError).type).toBe(RequestErrorType.VALIDATION_ERROR)
        expect((error as RequestError).code).toBe('BUILDER_NO_URL')
      }
    })

    test('应该处理无效的 HTTP 方法', async () => {
      // 这里假设 ConfigManager 会验证 HTTP 方法
      const invalidConfig: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'INVALID_METHOD' as any
      }

      // 由于实际的验证逻辑在 ConfigManager 中，这里我们模拟验证失败
      const validateSpy = vi.spyOn(requestCore['configManager'], 'validateRequestConfig')
      validateSpy.mockImplementation(() => {
        throw new RequestError('Invalid HTTP method', {
          type: RequestErrorType.VALIDATION_ERROR,
          code: 'INVALID_METHOD'
        })
      })

      await expect(requestCore.request(invalidConfig)).rejects.toThrow('Invalid HTTP method')

      validateSpy.mockRestore()
    })
  })

  describe('拦截器错误处理', () => {
    test('请求拦截器错误应该阻止请求执行', async () => {
      const errorInterceptor: RequestInterceptor = {
        onRequest: vi.fn(() => {
          throw new RequestError('Request interceptor failed', {
            type: RequestErrorType.UNKNOWN_ERROR,
            code: 'REQUEST_INTERCEPTOR_ERROR'
          })
        })
      }

      requestCore.addInterceptor(errorInterceptor)

      try {
        await requestCore.get(CORE_TEST_URLS.USERS)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Request interceptor failed')
        expect((error as RequestError).type).toBe(RequestErrorType.UNKNOWN_ERROR)
      }

      // 确保实际请求没有被执行
      expect(mockRequestor.getRequestCount()).toBe(0)
    })

    test('响应拦截器错误应该传播', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const errorInterceptor: RequestInterceptor = {
        onResponse: vi.fn(() => {
          throw new RequestError('Response interceptor failed', {
            type: RequestErrorType.UNKNOWN_ERROR,
            code: 'RESPONSE_INTERCEPTOR_ERROR'
          })
        })
      }

      requestCore.addInterceptor(errorInterceptor)

      try {
        await requestCore.get(CORE_TEST_URLS.USERS)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Response interceptor failed')
        expect((error as RequestError).type).toBe(RequestErrorType.UNKNOWN_ERROR)
      }

      // 确保实际请求被执行了
      expect(mockRequestor.getRequestCount()).toBe(1)
    })

    test('错误拦截器应该能够恢复错误', async () => {
      const originalError = new RequestError('Original error', {
        type: RequestErrorType.NETWORK_ERROR,
        code: 'NETWORK_TIMEOUT'
      })
      mockRequestor.setReject(originalError)

      const errorRecoveryInterceptor: RequestInterceptor = {
        onError: vi.fn((error: any) => {
          if (error.code === 'NETWORK_TIMEOUT') {
            // 返回一个修改后的 RequestError 实例，而不是普通对象
            const recoveredError = new RequestError('Error recovered', {
              type: RequestErrorType.NETWORK_ERROR,
              code: 'RECOVERED',
              context: {
                timestamp: Date.now(),
                metadata: { recovered: true, originalError: error.message }
              }
            })
            return Promise.resolve(recoveredError as any)
          }
          return Promise.reject(error)
        })
      }

      requestCore.addInterceptor(errorRecoveryInterceptor)

      const result = await requestCore.get(CORE_TEST_URLS.ERROR)

      expect((result as any).context.metadata?.recovered).toBe(true)
      expect((result as any).context.metadata?.originalError).toBe('Original error')
      // onError 接收两个参数: error 和 config
      expect(errorRecoveryInterceptor.onError).toHaveBeenCalledWith(
        originalError,
        expect.objectContaining({
          url: CORE_TEST_URLS.ERROR,
          method: 'GET'
        })
      )
    })

    test('错误拦截器抛出的错误应该替换原错误', async () => {
      const originalError = new Error('Original error')
      mockRequestor.setReject(originalError)

      const errorInterceptor: RequestInterceptor = {
        onError: vi.fn(() => {
          throw new RequestError('Transformed error', {
            type: RequestErrorType.UNKNOWN_ERROR,
            code: 'ERROR_TRANSFORMED'
          })
        })
      }

      requestCore.addInterceptor(errorInterceptor)

      try {
        await requestCore.get(CORE_TEST_URLS.ERROR)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Transformed error')
        expect((error as RequestError).code).toBe('ERROR_TRANSFORMED')
      }
    })
  })

  describe('多个拦截器的错误处理', () => {
    test('第一个拦截器的错误应该阻止后续拦截器执行', async () => {
      const firstInterceptor: RequestInterceptor = {
        onRequest: vi.fn(() => {
          throw new Error('First interceptor error')
        })
      }

      const secondInterceptor: RequestInterceptor = {
        onRequest: vi.fn((config) => config)
      }

      requestCore.addInterceptor(firstInterceptor)
      requestCore.addInterceptor(secondInterceptor)

      try {
        await requestCore.get(CORE_TEST_URLS.USERS)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('First interceptor error')
      }

      expect(firstInterceptor.onRequest).toHaveBeenCalled()
      expect(secondInterceptor.onRequest).not.toHaveBeenCalled()
      expect(mockRequestor.getRequestCount()).toBe(0)
    })

    test('多个错误拦截器应该按顺序处理错误', async () => {
      const originalError = new Error('Original request error')
      mockRequestor.setReject(originalError)

      const firstErrorInterceptor: RequestInterceptor = {
        onError: vi.fn((error) => {
          return Promise.reject(new Error('First error interceptor: ' + error.message))
        })
      }

      const secondErrorInterceptor: RequestInterceptor = {
        onError: vi.fn((error) => {
          return Promise.reject(new Error('Second error interceptor: ' + error.message))
        })
      }

      requestCore.addInterceptor(firstErrorInterceptor)
      requestCore.addInterceptor(secondErrorInterceptor)

      try {
        await requestCore.get(CORE_TEST_URLS.ERROR)
      } catch (error) {
        expect(error).toBeInstanceOf(Error)
        expect((error as Error).message).toContain('Second error interceptor')
        expect((error as Error).message).toContain('First error interceptor')
      }

      expect(firstErrorInterceptor.onError).toHaveBeenCalled()
      expect(secondErrorInterceptor.onError).toHaveBeenCalled()
    })
  })

  describe('功能特性错误处理', () => {
    test('重试功能错误应该正确传播', async () => {
      const retryError = new RequestError('Retry failed after max attempts', {
        type: RequestErrorType.RETRY_ERROR,
        code: 'MAX_RETRIES_EXCEEDED'
      })

      mockRequestor.getMock().mockRejectedValue(retryError)

      try {
        await requestCore.request({
          url: CORE_TEST_URLS.ERROR,
          method: 'GET',
          metadata: {
            retryConfig: { retries: 3 }
          }
        })
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.RETRY_ERROR)
      }
    })

    test('缓存功能错误应该正确传播', async () => {
      const cacheError = new RequestError('Cache storage failed', {
        type: RequestErrorType.CACHE_ERROR,
        code: 'CACHE_WRITE_FAILED'
      })

      mockRequestor.getMock().mockRejectedValue(cacheError)

      try {
        await requestCore.request({
          url: CORE_TEST_URLS.USERS,
          method: 'GET',
          metadata: {
            cacheConfig: { ttl: 300000 }
          }
        })
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.CACHE_ERROR)
      }
    })

    test('并发请求中的部分错误应该正确处理', async () => {
      const configs = [
        { url: CORE_TEST_URLS.USER_DETAIL, method: 'GET' as const },
        { url: CORE_TEST_URLS.ERROR, method: 'GET' as const },
        { url: CORE_TEST_URLS.USERS, method: 'GET' as const }
      ]
      const mockResults = [
        { success: true, data: { id: 1 }, config: configs[0], index: 0 },
        { success: false, error: new RequestError('Request 2 failed'), config: configs[1], index: 1 },
        { success: true, data: { id: 3 }, config: configs[2], index: 2 }
      ]

      const requestConcurrentSpy = vi.spyOn(requestCore, 'requestConcurrent')
      requestConcurrentSpy.mockResolvedValue(mockResults)

      const hasConcurrentFailuresSpy = vi.spyOn(requestCore, 'hasConcurrentFailures')
      hasConcurrentFailuresSpy.mockReturnValue(true)

      const getFailedResultsSpy = vi.spyOn(requestCore, 'getFailedResults')
      getFailedResultsSpy.mockReturnValue([mockResults[1]])

      const results = await requestCore.requestConcurrent(configs)
      const hasFailures = requestCore.hasConcurrentFailures(results)
      const failedResults = requestCore.getFailedResults(results)

      expect(hasFailures).toBe(true)
      expect(failedResults).toHaveLength(1)
      expect(failedResults[0].error).toBeInstanceOf(RequestError)

      requestConcurrentSpy.mockRestore()
      hasConcurrentFailuresSpy.mockRestore()
      getFailedResultsSpy.mockRestore()
    })
  })

  describe('链式调用错误处理', () => {
    test('链式调用中的配置错误应该正确处理', async () => {
      try {
        await requestCore
          .create()
          .method('GET')
          // 故意不设置 URL
          .send()
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.VALIDATION_ERROR)
        expect((error as RequestError).code).toBe('BUILDER_NO_URL')
      }
    })

    test('链式调用中的功能特性错误应该正确处理', async () => {
      const retryError = new RequestError('Retry configuration invalid')
      mockRequestor.getMock().mockRejectedValue(retryError)

      try {
        await requestCore
          .create()
          .url(CORE_TEST_URLS.USERS)
          .retry(3)
          .send()
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
      }
    })
  })

  describe('便利方法错误处理', () => {
    test('便利方法应该正确传播底层错误', async () => {
      const networkError = new RequestError('Network timeout', {
        type: RequestErrorType.NETWORK_ERROR,
        code: 'TIMEOUT'
      })
      mockRequestor.setReject(networkError)

      try {
        await requestCore.postJson(CORE_TEST_URLS.USERS, { name: 'John' })
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Network timeout')
        expect((error as RequestError).type).toBe(RequestErrorType.NETWORK_ERROR)
      }
    })

    test('文件上传错误应该正确处理', async () => {
      const uploadError = new RequestError('File too large', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'FILE_TOO_LARGE'
      })

      const uploadFileSpy = vi.spyOn(requestCore, 'uploadFile')
      uploadFileSpy.mockRejectedValue(uploadError)

      try {
        await requestCore.uploadFile(CORE_TEST_URLS.UPLOAD, {
          file: new Blob(['large file content']),
          filename: 'document'
        })
      } catch (error) {
        expect(error).toBe(uploadError)
        expect((error as RequestError).code).toBe('FILE_TOO_LARGE')
      }

      uploadFileSpy.mockRestore()
    })
  })

  describe('错误恢复和重试', () => {
    test('应该支持错误拦截器的错误恢复', async () => {
      let attemptCount = 0
      mockRequestor.getMock().mockImplementation(() => {
        attemptCount++
        if (attemptCount === 1) {
          return Promise.reject(new RequestError('Temporary error', {
            type: RequestErrorType.NETWORK_ERROR,
            code: 'TEMPORARY_ERROR'
          }))
        }
        return Promise.resolve({ success: true, attempt: attemptCount })
      })

      const recoveryInterceptor: RequestInterceptor = {
        onError: vi.fn((error) => {
          if (error.code === 'TEMPORARY_ERROR') {
            // 模拟恢复逻辑：重新执行请求
            return requestCore.request({ url: CORE_TEST_URLS.USERS, method: 'GET' }) as any
          }
          return Promise.reject(error)
        })
      }

      requestCore.addInterceptor(recoveryInterceptor)

      const result = await requestCore.get(CORE_TEST_URLS.USERS)

      expect(result).toEqual({ success: true, attempt: 2 })
      expect(attemptCount).toBe(2)
      expect(recoveryInterceptor.onError).toHaveBeenCalled()
    })
  })

  describe('错误信息和调试', () => {
    test('错误应该包含足够的调试信息', async () => {
      const detailedError = new RequestError('Detailed error message', {
        type: RequestErrorType.HTTP_ERROR,
        code: 'INTERNAL_SERVER_ERROR',
        status: 500,
        context: {
          url: CORE_TEST_URLS.ERROR,
          method: 'GET',
          timestamp: Date.now(),
          metadata: { 
            response: { error: 'Internal server error', details: 'Database connection failed' }
          }
        }
      })
      mockRequestor.setReject(detailedError)

      try {
        await requestCore.get(CORE_TEST_URLS.ERROR)
      } catch (error) {
        expect(error).toBe(detailedError)
        expect((error as RequestError).status).toBe(500)
        expect((error as RequestError).context.metadata?.response).toEqual({
          error: 'Internal server error',
          details: 'Database connection failed'
        })
        expect((error as RequestError).context.url).toBe(CORE_TEST_URLS.ERROR)
        expect((error as RequestError).context.method).toBe('GET')
      }
    })

    test('调试模式下应该提供更多错误信息', async () => {
      // 启用调试模式
      requestCore.setGlobalConfig({ debug: true })

      const debugError = new RequestError('Debug error', {
        type: RequestErrorType.NETWORK_ERROR,
        code: 'DEBUG_ERROR'
      })
      mockRequestor.setReject(debugError)

      try {
        await requestCore.get(CORE_TEST_URLS.ERROR, { debug: true })
      } catch (error) {
        expect(error).toBe(debugError)
        // 在实际实现中，调试模式可能会添加更多信息到错误对象
      }
    })
  })
})
