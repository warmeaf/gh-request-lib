import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig, RequestInterceptor } from '../../src/interface'
import {
  CoreMockRequestor,
  createCoreMockRequestor,
  createTestInterceptor,
  createTestInterceptors,
  createTestGlobalConfig,
  cleanupCoreTest,
  CORE_MOCK_RESPONSES,
  CORE_TEST_URLS
} from './core-test-helpers'

describe('RequestCore 拦截器功能测试', () => {
  let mockRequestor: CoreMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = createCoreMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupCoreTest(mockRequestor, requestCore)
  })

  describe('拦截器添加和管理', () => {
    test('应该能够添加单个拦截器', () => {
      const interceptor = createTestInterceptor('test-interceptor')
      
      requestCore.addInterceptor(interceptor)
      
      const interceptors = requestCore.getInterceptors()
      expect(interceptors).toHaveLength(1)
      expect(interceptors[0]).toBe(interceptor)
    })

    test('应该能够添加多个拦截器', () => {
      const interceptors = createTestInterceptors(3)
      
      interceptors.forEach(interceptor => {
        requestCore.addInterceptor(interceptor)
      })
      
      const allInterceptors = requestCore.getInterceptors()
      expect(allInterceptors).toHaveLength(3)
      expect(allInterceptors).toEqual(interceptors)
    })

    test('应该能够清除所有拦截器', () => {
      const interceptors = createTestInterceptors(2)
      interceptors.forEach(interceptor => {
        requestCore.addInterceptor(interceptor)
      })
      
      expect(requestCore.getInterceptors()).toHaveLength(2)
      
      requestCore.clearInterceptors()
      
      expect(requestCore.getInterceptors()).toHaveLength(0)
    })
  })

  describe('全局配置中的拦截器', () => {
    test('应该在设置全局配置时添加拦截器', () => {
      const globalConfig = createTestGlobalConfig()
      
      requestCore.setGlobalConfig(globalConfig)
      
      const interceptors = requestCore.getInterceptors()
      expect(interceptors).toHaveLength(2)
      expect(interceptors).toEqual(globalConfig.interceptors)
    })

    test('设置新的全局配置应该清除旧的拦截器', () => {
      // 先添加一些拦截器
      const initialInterceptors = createTestInterceptors(2)
      initialInterceptors.forEach(interceptor => {
        requestCore.addInterceptor(interceptor)
      })
      
      expect(requestCore.getInterceptors()).toHaveLength(2)
      
      // 设置新的全局配置
      const newGlobalConfig = {
        baseURL: 'https://new-api.test.com',
        interceptors: createTestInterceptors(3)
      }
      
      requestCore.setGlobalConfig(newGlobalConfig)
      
      const interceptors = requestCore.getInterceptors()
      expect(interceptors).toHaveLength(3)
      expect(interceptors).toEqual(newGlobalConfig.interceptors)
    })

    test('全局配置没有拦截器时应该清除现有拦截器', () => {
      // 先添加拦截器
      const interceptors = createTestInterceptors(2)
      interceptors.forEach(interceptor => {
        requestCore.addInterceptor(interceptor)
      })
      
      expect(requestCore.getInterceptors()).toHaveLength(2)
      
      // 设置没有拦截器的全局配置
      requestCore.setGlobalConfig({
        baseURL: 'https://api.test.com',
        timeout: 5000
      })
      
      expect(requestCore.getInterceptors()).toHaveLength(0)
    })
  })

  describe('拦截器执行', () => {
    test('请求拦截器应该能够修改请求配置', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)
      
      const requestInterceptor: RequestInterceptor = {
        onRequest: vi.fn((config: RequestConfig) => ({
          ...config,
          headers: {
            ...config.headers,
            'X-Intercepted': 'true',
            'X-Modified-By': 'request-interceptor'
          }
        }))
      }
      
      requestCore.addInterceptor(requestInterceptor)
      
      await requestCore.get(CORE_TEST_URLS.USERS)
      
      expect(requestInterceptor.onRequest).toHaveBeenCalled()
      
      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers).toMatchObject({
        'X-Intercepted': 'true',
        'X-Modified-By': 'request-interceptor'
      })
    })

    test('响应拦截器应该能够修改响应数据', async () => {
      const originalResponse = { id: 1, name: 'John' }
      mockRequestor.getMock().mockResolvedValue(originalResponse)
      
      const responseInterceptor: RequestInterceptor = {
        onResponse: vi.fn((data: any) => ({
          ...data,
          intercepted: true,
          modifiedBy: 'response-interceptor'
        }))
      }
      
      requestCore.addInterceptor(responseInterceptor)
      
      const result = await requestCore.get(CORE_TEST_URLS.USER_DETAIL)
      
      // 响应拦截器被调用时会传入响应数据和配置对象两个参数
      expect(responseInterceptor.onResponse).toHaveBeenCalledWith(
        originalResponse,
        expect.objectContaining({
          url: expect.any(String),
          method: 'GET'
        })
      )
      expect(result).toEqual({
        ...originalResponse,
        intercepted: true,
        modifiedBy: 'response-interceptor'
      })
    })

    test('错误拦截器应该能够处理请求错误', async () => {
      const originalError = new Error('Network error')
      mockRequestor.setReject(originalError)
      
      const errorInterceptor: RequestInterceptor = {
        onError: vi.fn((error: any) => {
          // 错误拦截器接收的是 RequestError，不是原始 Error
          if (error.message === 'Network error') {
            // 返回一个新的 RequestError 实例
            const handledError = new (error.constructor as any)('Error was intercepted', {
              type: error.type,
              status: error.status,
              isHttpError: error.isHttpError,
              originalError: error.originalError,
              context: { ...error.context, handled: true }
            })
            return Promise.resolve(handledError)
          }
          return Promise.reject(error)
        })
      }
      
      requestCore.addInterceptor(errorInterceptor)
      
      const result = await requestCore.get(CORE_TEST_URLS.ERROR)
      
      // 错误拦截器接收的是包装后的 RequestError，而不是原始 Error
      expect(errorInterceptor.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Network error',
          originalError: originalError
        }),
        expect.objectContaining({
          url: expect.any(String),
          method: 'GET'
        })
      )
      expect((result as any).message).toBe('Error was intercepted')
      expect((result as any).context.handled).toBe(true)
    })

    test('错误拦截器可以选择不处理错误', async () => {
      const originalError = new Error('Unhandled error')
      mockRequestor.setReject(originalError)
      
      const errorInterceptor: RequestInterceptor = {
        onError: vi.fn((error: any) => {
          if (error.message === 'Network error') {
            // 返回一个新的 RequestError 实例
            const handledError = new (error.constructor as any)('Handled error', {
              type: error.type,
              status: error.status,
              isHttpError: error.isHttpError,
              originalError: error.originalError,
              context: { ...error.context, handled: true }
            })
            return Promise.resolve(handledError)
          }
          return Promise.reject(error) // 不处理这个错误
        })
      }
      
      requestCore.addInterceptor(errorInterceptor)
      
      await expect(requestCore.get(CORE_TEST_URLS.ERROR)).rejects.toThrow('Unhandled error')
      // 错误拦截器接收的是包装后的 RequestError
      expect(errorInterceptor.onError).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Unhandled error',
          originalError: originalError
        }),
        expect.objectContaining({
          url: expect.any(String),
          method: 'GET'
        })
      )
    })
  })

  describe('多个拦截器的执行顺序', () => {
    test('多个请求拦截器应该按顺序执行', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)
      
      const interceptor1: RequestInterceptor = {
        onRequest: vi.fn((config: RequestConfig) => ({
          ...config,
          headers: { ...config.headers, 'X-Order': '1' }
        }))
      }
      
      const interceptor2: RequestInterceptor = {
        onRequest: vi.fn((config: RequestConfig) => ({
          ...config,
          headers: { ...config.headers, 'X-Order': '2' }
        }))
      }
      
      requestCore.addInterceptor(interceptor1)
      requestCore.addInterceptor(interceptor2)
      
      await requestCore.get(CORE_TEST_URLS.USERS)
      
      expect(interceptor1.onRequest).toHaveBeenCalled()
      expect(interceptor2.onRequest).toHaveBeenCalled()
      
      // 第二个拦截器应该覆盖第一个拦截器的头部
      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers?.['X-Order']).toBe('2')
    })

    test('多个响应拦截器应该按顺序执行', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'original' })
      
      const interceptor1: RequestInterceptor = {
        onResponse: vi.fn((data: any) => ({ ...data, step1: true }))
      }
      
      const interceptor2: RequestInterceptor = {
        onResponse: vi.fn((data: any) => ({ ...data, step2: true }))
      }
      
      requestCore.addInterceptor(interceptor1)
      requestCore.addInterceptor(interceptor2)
      
      const result = await requestCore.get(CORE_TEST_URLS.USERS)
      
      expect(interceptor1.onResponse).toHaveBeenCalled()
      expect(interceptor2.onResponse).toHaveBeenCalled()
      
      expect(result).toEqual({
        data: 'original',
        step1: true,
        step2: true
      })
    })
  })

  describe('拦截器异常处理', () => {
    test('请求拦截器抛出异常时应该中断请求', async () => {
      const interceptor: RequestInterceptor = {
        onRequest: vi.fn(() => {
          throw new Error('Interceptor error')
        })
      }
      
      requestCore.addInterceptor(interceptor)
      
      await expect(requestCore.get(CORE_TEST_URLS.USERS)).rejects.toThrow('Interceptor error')
      
      // 确保实际请求没有被执行
      expect(mockRequestor.getRequestCount()).toBe(0)
    })

    test('响应拦截器抛出异常时应该传播错误', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)
      
      const interceptor: RequestInterceptor = {
        onResponse: vi.fn(() => {
          throw new Error('Response interceptor error')
        })
      }
      
      requestCore.addInterceptor(interceptor)
      
      await expect(requestCore.get(CORE_TEST_URLS.USERS)).rejects.toThrow('Response interceptor error')
      
      // 确保实际请求被执行了
      expect(mockRequestor.getRequestCount()).toBe(1)
    })
  })

  describe('拦截器统计', () => {
    test('应该能够获取拦截器统计信息', () => {
      const interceptors = createTestInterceptors(3)
      interceptors.forEach(interceptor => {
        requestCore.addInterceptor(interceptor)
      })
      
      const stats = requestCore.getAllStats()
      expect(stats.interceptors).toBeDefined()
      
      // 检查拦截器列表
      const currentInterceptors = requestCore.getInterceptors()
      expect(currentInterceptors).toHaveLength(3)
    })
  })
})
