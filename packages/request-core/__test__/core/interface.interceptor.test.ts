import { describe, it, expect, vi } from 'vitest'
import {
  RequestInterceptor,
  RequestConfig,
  RequestError,
  RequestErrorType,
} from '../../src/interface'

// 测试辅助函数
const TestHelpers = {
  // 创建基本的RequestConfig
  createBasicConfig: (overrides: Partial<RequestConfig> = {}): RequestConfig => ({
    url: 'https://api.example.com/test',
    method: 'GET',
    ...overrides,
  }),
  
  // 创建基本的RequestError
  createBasicError: (message = 'Test error') => new RequestError(message),
}

describe('RequestInterceptor 拦截器接口测试', () => {
  describe('同步拦截器', () => {
    it('应该支持同步请求拦截器', () => {
      const mockConfig = TestHelpers.createBasicConfig()
      const modifiedConfig = TestHelpers.createBasicConfig({
        headers: { 'X-Intercepted': 'true' }
      })

      const interceptor: RequestInterceptor = {
        onRequest: vi.fn().mockReturnValue(modifiedConfig),
      }

      expect(interceptor.onRequest).toBeTypeOf('function')

      // 测试拦截器调用
      const result = interceptor.onRequest?.(mockConfig)
      expect(result).toBe(modifiedConfig)
      expect(interceptor.onRequest).toHaveBeenCalledWith(mockConfig)
    })

    it('应该支持同步响应拦截器', () => {
      const mockConfig = TestHelpers.createBasicConfig()
      const originalResponse = { data: 'original' }
      const modifiedResponse = { data: 'modified', intercepted: true }

      const interceptor: RequestInterceptor = {
        onResponse: vi.fn().mockReturnValue(modifiedResponse),
      }

      expect(interceptor.onResponse).toBeTypeOf('function')

      // 测试拦截器调用
      const result = interceptor.onResponse?.(originalResponse, mockConfig)
      expect(result).toBe(modifiedResponse)
      expect(interceptor.onResponse).toHaveBeenCalledWith(originalResponse, mockConfig)
    })

    it('应该支持同步错误拦截器', () => {
      const mockConfig = TestHelpers.createBasicConfig()
      const originalError = TestHelpers.createBasicError('Original error')
      const modifiedError = TestHelpers.createBasicError('Modified error')

      const interceptor: RequestInterceptor = {
        onError: vi.fn().mockReturnValue(modifiedError),
      }

      expect(interceptor.onError).toBeTypeOf('function')

      // 测试拦截器调用
      const result = interceptor.onError?.(originalError, mockConfig)
      expect(result).toBe(modifiedError)
      expect(interceptor.onError).toHaveBeenCalledWith(originalError, mockConfig)
    })

    it('应该支持完整的同步拦截器', () => {
      const mockConfig = TestHelpers.createBasicConfig()
      const mockError = TestHelpers.createBasicError()

      const interceptor: RequestInterceptor = {
        onRequest: vi.fn().mockReturnValue(mockConfig),
        onResponse: vi.fn().mockReturnValue('response'),
        onError: vi.fn().mockReturnValue(mockError),
      }

      // 验证所有方法都存在且为函数
      const methods = ['onRequest', 'onResponse', 'onError'] as const
      methods.forEach(method => {
        expect(interceptor[method]).toBeTypeOf('function')
      })

      // 测试所有方法调用
      const requestResult = interceptor.onRequest?.(mockConfig)
      const responseResult = interceptor.onResponse?.('response', mockConfig)
      const errorResult = interceptor.onError?.(mockError, mockConfig)

      expect(requestResult).toBe(mockConfig)
      expect(responseResult).toBe('response')
      expect(errorResult).toBe(mockError)
    })
  })

  describe('异步拦截器', () => {
    it('应该支持异步请求拦截器', async () => {
      const mockConfig = TestHelpers.createBasicConfig()
      const modifiedConfig = TestHelpers.createBasicConfig({
        headers: { 'X-Async-Intercepted': 'true' }
      })

      const asyncInterceptor: RequestInterceptor = {
        onRequest: vi.fn().mockResolvedValue(modifiedConfig),
      }

      const result = await asyncInterceptor.onRequest?.(mockConfig)
      expect(result).toBe(modifiedConfig)
      expect(asyncInterceptor.onRequest).toHaveBeenCalledWith(mockConfig)
    })

    it('应该支持异步响应拦截器', async () => {
      const mockConfig = TestHelpers.createBasicConfig()
      const originalResponse = { data: 'original' }
      const modifiedResponse = { data: 'async modified', timestamp: Date.now() }

      const asyncInterceptor: RequestInterceptor = {
        onResponse: vi.fn().mockResolvedValue(modifiedResponse),
      }

      const result = await asyncInterceptor.onResponse?.(originalResponse, mockConfig)
      expect(result).toBe(modifiedResponse)
      expect(asyncInterceptor.onResponse).toHaveBeenCalledWith(originalResponse, mockConfig)
    })

    it('应该支持异步错误拦截器', async () => {
      const mockConfig = TestHelpers.createBasicConfig()
      const originalError = TestHelpers.createBasicError('Original error')
      const modifiedError = TestHelpers.createBasicError('Async modified error')

      const asyncInterceptor: RequestInterceptor = {
        onError: vi.fn().mockResolvedValue(modifiedError),
      }

      const result = await asyncInterceptor.onError?.(originalError, mockConfig)
      expect(result).toBe(modifiedError)
      expect(asyncInterceptor.onError).toHaveBeenCalledWith(originalError, mockConfig)
    })

    it('应该支持完整的异步拦截器', async () => {
      const mockConfig = TestHelpers.createBasicConfig()
      const mockError = TestHelpers.createBasicError('async error')

      const asyncInterceptor: RequestInterceptor = {
        onRequest: vi.fn().mockResolvedValue(mockConfig),
        onResponse: vi.fn().mockResolvedValue('async response'),
        onError: vi.fn().mockResolvedValue(mockError),
      }

      // 测试异步调用
      const [requestResult, responseResult, errorResult] = await Promise.all([
        asyncInterceptor.onRequest?.(mockConfig),
        asyncInterceptor.onResponse?.('response', mockConfig),
        asyncInterceptor.onError?.(TestHelpers.createBasicError(), mockConfig),
      ])

      expect(requestResult).toBe(mockConfig)
      expect(responseResult).toBe('async response')
      expect(errorResult).toBe(mockError)
    })

    it('应该正确处理异步拦截器的错误', async () => {
      const mockConfig = TestHelpers.createBasicConfig()
      const rejectionError = new Error('Async interceptor failed')

      const failingInterceptor: RequestInterceptor = {
        onRequest: vi.fn().mockRejectedValue(rejectionError),
        onResponse: vi.fn().mockRejectedValue(rejectionError),
        onError: vi.fn().mockRejectedValue(rejectionError),
      }

      // 测试异步拒绝
      await expect(failingInterceptor.onRequest?.(mockConfig)).rejects.toBe(rejectionError)
      await expect(failingInterceptor.onResponse?.('response', mockConfig)).rejects.toBe(rejectionError)
      await expect(failingInterceptor.onError?.(TestHelpers.createBasicError(), mockConfig)).rejects.toBe(rejectionError)
    })
  })

  describe('可选拦截器方法', () => {
    it('应该支持只有请求拦截器的拦截器', () => {
      const interceptor: RequestInterceptor = {
        onRequest: vi.fn().mockReturnValue(TestHelpers.createBasicConfig()),
      }

      expect(interceptor.onRequest).toBeTypeOf('function')
      expect(interceptor.onResponse).toBeUndefined()
      expect(interceptor.onError).toBeUndefined()
    })

    it('应该支持只有响应拦截器的拦截器', () => {
      const interceptor: RequestInterceptor = {
        onResponse: vi.fn().mockReturnValue('response'),
      }

      expect(interceptor.onResponse).toBeTypeOf('function')
      expect(interceptor.onRequest).toBeUndefined()
      expect(interceptor.onError).toBeUndefined()
    })

    it('应该支持只有错误拦截器的拦截器', () => {
      const interceptor: RequestInterceptor = {
        onError: vi.fn().mockReturnValue(TestHelpers.createBasicError()),
      }

      expect(interceptor.onError).toBeTypeOf('function')
      expect(interceptor.onRequest).toBeUndefined()
      expect(interceptor.onResponse).toBeUndefined()
    })

    it('应该支持空的拦截器对象', () => {
      const emptyInterceptor: RequestInterceptor = {}

      expect(emptyInterceptor.onRequest).toBeUndefined()
      expect(emptyInterceptor.onResponse).toBeUndefined()
      expect(emptyInterceptor.onError).toBeUndefined()
    })

    it('应该支持部分方法组合', () => {
      const partialInterceptors = [
        { onRequest: vi.fn() },
        { onResponse: vi.fn() },
        { onError: vi.fn() },
        { onRequest: vi.fn(), onResponse: vi.fn() },
        { onRequest: vi.fn(), onError: vi.fn() },
        { onResponse: vi.fn(), onError: vi.fn() },
        {},
      ]

      partialInterceptors.forEach((interceptor) => {
        const fullInterceptor: RequestInterceptor = interceptor
        expect(fullInterceptor).toBeDefined()
      })
    })
  })

  describe('拦截器参数和返回值测试', () => {
    it('应该正确处理请求配置的修改', () => {
      const originalConfig = TestHelpers.createBasicConfig({
        url: 'https://api.example.com/test',
        headers: { 'Content-Type': 'application/json' },
      })

      const interceptor: RequestInterceptor = {
        onRequest: (config) => {
          return {
            ...config,
            url: config.url + '?intercepted=true',
            headers: {
              ...config.headers,
              'X-Request-Intercepted': 'true',
            },
          }
        },
      }

      const result = interceptor.onRequest?.(originalConfig) as RequestConfig
      expect(result?.url).toBe('https://api.example.com/test?intercepted=true')
      expect(result?.headers?.['X-Request-Intercepted']).toBe('true')
      expect(result?.headers?.['Content-Type']).toBe('application/json')
    })

    it('应该正确处理响应数据的转换', () => {
      const originalResponse = {
        data: { users: [{ id: 1, name: 'John' }] },
        status: 200,
        headers: {},
      }

      const interceptor: RequestInterceptor = {
        onResponse: (response) => {
          return {
            ...response,
            data: {
              ...(response as any).data,
              intercepted: true,
              timestamp: Date.now(),
            },
          }
        },
      }

      const mockConfig = TestHelpers.createBasicConfig()
      const result = interceptor.onResponse?.(originalResponse, mockConfig)
      
      expect(result).toHaveProperty('data.intercepted', true)
      expect(result).toHaveProperty('data.timestamp')
      expect(result).toHaveProperty('data.users')
    })

    it('应该正确处理错误信息的增强', () => {
      const originalError = new RequestError('API Error', {
        status: 500,
        type: RequestErrorType.HTTP_ERROR,
      })

      const interceptor: RequestInterceptor = {
        onError: (error, config) => {
          return new RequestError(error.message, {
            ...error,
            context: {
              ...error.context,
              ...({
                intercepted: true,
                originalUrl: config.url,
              } as any),
            },
            suggestion: '请联系系统管理员或稍后重试',
          })
        },
      }

      const mockConfig = TestHelpers.createBasicConfig()
      const result = interceptor.onError?.(originalError, mockConfig) as RequestError
      
      expect(result).toBeInstanceOf(RequestError)
      expect((result?.context as any)?.intercepted).toBe(true)
      expect((result?.context as any)?.originalUrl).toBe(mockConfig.url)
      expect(result?.suggestion).toBe('请联系系统管理员或稍后重试')
    })

    it('应该支持泛型响应类型', () => {
      interface ApiResponse<T> {
        data: T
        status: number
        message: string
      }

      interface User {
        id: number
        name: string
        email: string
      }

      const originalResponse: ApiResponse<User[]> = {
        data: [{ id: 1, name: 'John', email: 'john@example.com' }],
        status: 200,
        message: 'Success',
      }

      const interceptor: RequestInterceptor = {
        onResponse: (response: any) => {
          const apiResponse = response as ApiResponse<any>
          return {
            ...apiResponse,
            message: `${apiResponse.message} (Intercepted)`,
          } as any
        },
      }

      const mockConfig = TestHelpers.createBasicConfig()
      const result = interceptor.onResponse?.(originalResponse, mockConfig) as ApiResponse<User[]>
      
      expect(result?.message).toBe('Success (Intercepted)')
      expect(result?.data).toEqual(originalResponse.data)
    })

    it('应该正确处理不同类型的响应数据', () => {
      const responseTypes = [
        { data: 'string response', type: 'string' },
        { data: 12345, type: 'number' },
        { data: true, type: 'boolean' },
        { data: null, type: 'null' },
        { data: undefined, type: 'undefined' },
        { data: { key: 'value' }, type: 'object' },
        { data: [1, 2, 3], type: 'array' },
        { data: new Blob(['data']), type: 'Blob' },
      ]

      const interceptor: RequestInterceptor = {
        onResponse: (response) => response, // 透传
      }

      const mockConfig = TestHelpers.createBasicConfig()
      responseTypes.forEach(({ data, type }) => {
        const result = interceptor.onResponse?.(data, mockConfig)
        expect(result).toBe(data)
      })
    })
  })

  describe('拦截器链和组合测试', () => {
    it('应该支持多个拦截器的组合使用', () => {
      const mockConfig = TestHelpers.createBasicConfig()

      // 第一个拦截器：添加认证头
      const authInterceptor: RequestInterceptor = {
        onRequest: (config) => ({
          ...config,
          headers: {
            ...config.headers,
            'Authorization': 'Bearer token123',
          },
        }),
      }

      // 第二个拦截器：添加时间戳
      const timestampInterceptor: RequestInterceptor = {
        onRequest: (config) => ({
          ...config,
          headers: {
            ...config.headers,
            'X-Timestamp': Date.now().toString(),
          },
        }),
      }

      // 第三个拦截器：添加请求ID
      const requestIdInterceptor: RequestInterceptor = {
        onRequest: (config) => ({
          ...config,
          headers: {
            ...config.headers,
            'X-Request-ID': 'req-' + Math.random().toString(36),
          },
        }),
      }

      // 模拟拦截器链的调用
      let result = authInterceptor.onRequest?.(mockConfig) as RequestConfig
      result = timestampInterceptor.onRequest?.(result!) as RequestConfig
      result = requestIdInterceptor.onRequest?.(result!) as RequestConfig

      expect(result?.headers?.['Authorization']).toBe('Bearer token123')
      expect(result?.headers?.['X-Timestamp']).toBeDefined()
      expect(result?.headers?.['X-Request-ID']).toMatch(/^req-/)
    })

    it('应该支持混合同步和异步拦截器', async () => {
      const mockConfig = TestHelpers.createBasicConfig()

      const syncInterceptor: RequestInterceptor = {
        onRequest: (config) => ({
          ...config,
          headers: { ...config.headers, 'X-Sync': 'true' },
        }),
      }

      const asyncInterceptor: RequestInterceptor = {
        onRequest: async (config) => {
          // 模拟异步操作，比如从缓存获取token
          await new Promise(resolve => setTimeout(resolve, 10))
          return {
            ...config,
            headers: { ...config.headers, 'X-Async': 'true' },
          }
        },
      }

      // 先同步后异步
      let result = syncInterceptor.onRequest?.(mockConfig) as RequestConfig
      result = await asyncInterceptor.onRequest?.(result!) as RequestConfig

      expect(result?.headers?.['X-Sync']).toBe('true')
      expect(result?.headers?.['X-Async']).toBe('true')
    })

    it('应该支持条件拦截器', () => {
      const mockConfig = TestHelpers.createBasicConfig()

      const conditionalInterceptor: RequestInterceptor = {
        onRequest: (config) => {
          // 只对POST请求添加CSRF token
          if (config.method === 'POST') {
            return {
              ...config,
              headers: {
                ...config.headers,
                'X-CSRF-Token': 'csrf-token-123',
              },
            }
          }
          return config
        },
      }

      // GET请求不应该添加CSRF token
      const getResult = conditionalInterceptor.onRequest?.(mockConfig) as RequestConfig
      expect(getResult?.headers?.['X-CSRF-Token']).toBeUndefined()

      // POST请求应该添加CSRF token
      const postConfig = { ...mockConfig, method: 'POST' as const }
      const postResult = conditionalInterceptor.onRequest?.(postConfig) as RequestConfig
      expect(postResult?.headers?.['X-CSRF-Token']).toBe('csrf-token-123')
    })

    it('应该支持错误恢复拦截器', () => {
      const networkError = new RequestError('Network failed', {
        type: RequestErrorType.NETWORK_ERROR,
        originalError: new Error('Connection timeout'),
      })

      const recoveryInterceptor: RequestInterceptor = {
        onError: (error, config) => {
          // 对网络错误尝试恢复
          if (error.type === RequestErrorType.NETWORK_ERROR) {
            return new RequestError('Network error occurred, please retry', {
              ...error,
              suggestion: '请检查网络连接后重试',
              context: {
                ...error.context,
                ...({
                  recovered: true,
                  retryable: true,
                } as any),
              },
            })
          }
          return error
        },
      }

      const mockConfig = TestHelpers.createBasicConfig()
      const result = recoveryInterceptor.onError?.(networkError, mockConfig) as RequestError

      expect(result?.suggestion).toBe('请检查网络连接后重试')
      expect((result?.context as any)?.recovered).toBe(true)
      expect((result?.context as any)?.retryable).toBe(true)
    })
  })

  describe('拦截器边界情况测试', () => {
    it('应该处理拦截器返回null或undefined', () => {
      const nullInterceptor: RequestInterceptor = {
        onRequest: () => null as any,
        onResponse: () => undefined as any,
        onError: () => null as any,
      }

      const mockConfig = TestHelpers.createBasicConfig()
      const mockError = TestHelpers.createBasicError()

      expect(nullInterceptor.onRequest?.(mockConfig)).toBeNull()
      expect(nullInterceptor.onResponse?.('response', mockConfig)).toBeUndefined()
      expect(nullInterceptor.onError?.(mockError, mockConfig)).toBeNull()
    })

    it('应该处理拦截器抛出异常', () => {
      const throwingInterceptor: RequestInterceptor = {
        onRequest: () => { throw new Error('Request interceptor error') },
        onResponse: () => { throw new Error('Response interceptor error') },
        onError: () => { throw new Error('Error interceptor error') },
      }

      const mockConfig = TestHelpers.createBasicConfig()
      const mockError = TestHelpers.createBasicError()

      expect(() => throwingInterceptor.onRequest?.(mockConfig)).toThrow('Request interceptor error')
      expect(() => throwingInterceptor.onResponse?.('response', mockConfig)).toThrow('Response interceptor error')
      expect(() => throwingInterceptor.onError?.(mockError, mockConfig)).toThrow('Error interceptor error')
    })

    it('应该处理大量数据的拦截器', () => {
      const largeData = {
        items: new Array(10000).fill(0).map((_, i) => ({ id: i, name: `Item ${i}` })),
        metadata: { total: 10000, processed: Date.now() },
      }

      const dataProcessingInterceptor: RequestInterceptor = {
        onResponse: (response) => {
          // 处理大量数据
          return {
            ...response,
            processedAt: Date.now(),
            itemCount: (response as any).items?.length || 0,
          }
        },
      }

      const mockConfig = TestHelpers.createBasicConfig()
      const start = performance.now()
      const result = dataProcessingInterceptor.onResponse?.(largeData, mockConfig)
      const end = performance.now()

      expect(result).toHaveProperty('processedAt')
      expect(result).toHaveProperty('itemCount', 10000)
      expect(end - start).toBeLessThan(100) // 应该在合理时间内完成
    })

    it('应该正确处理循环引用的对象', () => {
      const circularObj: any = { name: 'test' }
      circularObj.self = circularObj

      const circularInterceptor: RequestInterceptor = {
        onRequest: (config) => ({
          ...config,
          data: circularObj,
        }),
      }

      const mockConfig = TestHelpers.createBasicConfig()
      
      expect(() => {
        circularInterceptor.onRequest?.(mockConfig)
      }).not.toThrow()
    })
  })
})
