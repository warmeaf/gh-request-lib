import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig, RequestError, RequestInterceptor } from '../../src/interface'
import { MockRequestor, TEST_URLS, MOCK_RESPONSES } from '../test-helpers'

describe('RequestCore - 拦截器管理', () => {
  let mockRequestor: MockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new MockRequestor()
    requestCore = new RequestCore(mockRequestor)
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (requestCore) {
      requestCore.destroy()
    }
  })

  describe('拦截器基本管理', () => {
    it('应该添加和获取拦截器', () => {
      const interceptor1: RequestInterceptor = {
        onRequest: vi.fn(config => config)
      }
      
      const interceptor2: RequestInterceptor = {
        onResponse: vi.fn(response => response)
      }

      requestCore.addInterceptor(interceptor1)
      requestCore.addInterceptor(interceptor2)

      const interceptors = requestCore.getInterceptors()
      expect(interceptors).toHaveLength(2)
      expect(interceptors[0]).toBe(interceptor1)
      expect(interceptors[1]).toBe(interceptor2)
    })

    it('应该清除所有拦截器', () => {
      const interceptor1: RequestInterceptor = { onRequest: vi.fn() }
      const interceptor2: RequestInterceptor = { onResponse: vi.fn() }

      requestCore.addInterceptor(interceptor1)
      requestCore.addInterceptor(interceptor2)
      expect(requestCore.getInterceptors()).toHaveLength(2)

      requestCore.clearInterceptors()
      expect(requestCore.getInterceptors()).toHaveLength(0)
    })

    it('应该处理重复的拦截器添加', () => {
      const interceptor: RequestInterceptor = { onRequest: vi.fn() }

      requestCore.addInterceptor(interceptor)
      requestCore.addInterceptor(interceptor) // 重复添加

      const interceptors = requestCore.getInterceptors()
      expect(interceptors).toHaveLength(2) // 应该允许重复添加
    })
  })

  describe('请求拦截器', () => {
    it('应该通过拦截器处理请求', async () => {
      mockRequestor.getMock().mockResolvedValue(MOCK_RESPONSES.SUCCESS)

      const requestInterceptor = vi.fn(config => {
        return { ...config, headers: { ...config.headers, 'X-Intercepted': 'true' } }
      })

      requestCore.addInterceptor({
        onRequest: requestInterceptor
      })

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      await requestCore.request(config)

      expect(requestInterceptor).toHaveBeenCalledWith(
        expect.objectContaining({
          url: TEST_URLS.TEST,
          method: 'GET'
        })
      )
    })

    it('应该处理拦截器中的异步错误', async () => {
      const asyncInterceptor: RequestInterceptor = {
        onRequest: async (config) => {
          throw new Error('Interceptor async error')
        }
      }

      requestCore.addInterceptor(asyncInterceptor)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      await expect(requestCore.request(config))
        .rejects.toThrow('Interceptor async error')
    })
  })

  describe('响应拦截器', () => {
    it('应该通过拦截器处理响应', async () => {
      mockRequestor.getMock().mockResolvedValue(MOCK_RESPONSES.SUCCESS)

      const responseInterceptor = vi.fn(response => {
        return { ...response, intercepted: true }
      })

      requestCore.addInterceptor({
        onResponse: responseInterceptor
      })

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      const result = await requestCore.request(config)

      expect(responseInterceptor).toHaveBeenCalledWith(
        MOCK_RESPONSES.SUCCESS, 
        expect.any(Object)
      )
      expect(result).toEqual({ ...MOCK_RESPONSES.SUCCESS, intercepted: true })
    })
  })

  describe('错误拦截器', () => {
    it('应该处理拦截器中的错误', async () => {
      const requestError = new RequestError('Request failed')
      mockRequestor.getMock().mockRejectedValue(requestError)

      const errorInterceptor = vi.fn(error => {
        return new RequestError('Intercepted error', {
          originalError: error
        })
      })

      requestCore.addInterceptor({
        onError: errorInterceptor
      })

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      try {
        await requestCore.request(config)
      } catch (error) {
        expect(errorInterceptor).toHaveBeenCalledWith(
          requestError, 
          expect.any(Object)
        )
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Intercepted error')
      }
    })
  })

  describe('组合拦截器', () => {
    it('应该按顺序执行多个拦截器', async () => {
      mockRequestor.getMock().mockResolvedValue(MOCK_RESPONSES.SUCCESS)

      const interceptor1 = vi.fn(config => {
        return { ...config, headers: { ...config.headers, 'X-Step': '1' } }
      })
      
      const interceptor2 = vi.fn(config => {
        return { ...config, headers: { ...config.headers, 'X-Step': '2' } }
      })

      requestCore.addInterceptor({ onRequest: interceptor1 })
      requestCore.addInterceptor({ onRequest: interceptor2 })

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      await requestCore.request(config)

      expect(interceptor1).toHaveBeenCalled()
      expect(interceptor2).toHaveBeenCalled()
      // 验证调用顺序
      expect(interceptor1).toHaveBeenCalledBefore(interceptor2)
    })

    it('应该支持完整的请求-响应-错误拦截器', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const requestInterceptor = vi.fn(config => ({ ...config, intercepted: true }))
      const responseInterceptor = vi.fn(response => ({ ...response, processed: true }))
      const errorInterceptor = vi.fn()

      requestCore.addInterceptor({
        onRequest: requestInterceptor,
        onResponse: responseInterceptor,
        onError: errorInterceptor
      })

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      const result = await requestCore.request(config)

      expect(requestInterceptor).toHaveBeenCalled()
      expect(responseInterceptor).toHaveBeenCalled()
      expect(errorInterceptor).not.toHaveBeenCalled()
      expect(result).toEqual({ data: 'test', processed: true })
    })
  })
})
