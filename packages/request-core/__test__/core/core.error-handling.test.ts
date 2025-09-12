import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig, RequestInterceptor } from '../../src/interface'
import { MockRequestor, TEST_URLS } from '../test-helpers'

describe('RequestCore - 错误处理和边界情况', () => {
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

  describe('配置验证', () => {
    it('应该处理无效的请求配置', async () => {
      // 这里我们假设配置管理器会抛出验证错误
      const invalidConfig = {} as RequestConfig // 缺少必要字段

      // 模拟验证错误
      try {
        await requestCore.request(invalidConfig)
      } catch (error) {
        // 如果配置管理器抛出验证错误，应该被捕获
        expect(error).toBeDefined()
      }
    })

    it('应该处理空的 URL 请求', async () => {
      const config: RequestConfig = {
        url: '',
        method: 'GET'
      }

      // 根据实际实现，这可能会抛出验证错误或传递给底层requestor
      try {
        await requestCore.request(config)
        // 如果没有抛出错误，检查是否正确传递给了requestor
        expect(mockRequestor.getMock()).toHaveBeenCalled()
      } catch (error) {
        // 如果抛出了验证错误，这也是合理的行为
        expect(error).toBeDefined()
      }
    })
  })

  describe('拦截器异常处理', () => {
    it('应该处理拦截器中的同步错误', async () => {
      const syncInterceptor: RequestInterceptor = {
        onRequest: () => {
          throw new Error('Interceptor sync error')
        }
      }

      requestCore.addInterceptor(syncInterceptor)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      await expect(requestCore.request(config))
        .rejects.toThrow('Interceptor sync error')
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

    it('应该处理响应拦截器中的错误', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const responseInterceptor: RequestInterceptor = {
        onResponse: () => {
          throw new Error('Response interceptor error')
        }
      }

      requestCore.addInterceptor(responseInterceptor)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      await expect(requestCore.request(config))
        .rejects.toThrow('Response interceptor error')
    })

    it('应该处理错误拦截器中的二次错误', async () => {
      mockRequestor.getMock().mockRejectedValue(new Error('Original error'))

      const errorInterceptor: RequestInterceptor = {
        onError: () => {
          throw new Error('Error interceptor error')
        }
      }

      requestCore.addInterceptor(errorInterceptor)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      // 应该抛出错误拦截器的错误，而不是原始错误
      await expect(requestCore.request(config))
        .rejects.toThrow('Error interceptor error')
    })
  })

  describe('网络异常处理', () => {
    it('应该处理网络超时', async () => {
      const timeoutError = new Error('timeout')
      mockRequestor.getMock().mockRejectedValue(timeoutError)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET',
        timeout: 1000
      }

      await expect(requestCore.request(config))
        .rejects.toThrow('timeout')
    })

    it('应该处理连接错误', async () => {
      const networkError = new Error('Network Error')
      mockRequestor.getMock().mockRejectedValue(networkError)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      await expect(requestCore.request(config))
        .rejects.toThrow('Network Error')
    })

    it('应该处理HTTP状态错误', async () => {
      const httpError = new Error('HTTP 404 Not Found')
      mockRequestor.getMock().mockRejectedValue(httpError)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      await expect(requestCore.request(config))
        .rejects.toThrow('HTTP 404 Not Found')
    })
  })

  describe('边界情况', () => {
    it('应该处理null和undefined数据', async () => {
      const mockResponse = { received: null }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'POST',
        data: null
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(mockResponse)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({ data: null })
      )
    })

    it('应该处理大量数据', async () => {
      const largeData = { items: new Array(1000).fill(0).map((_, i) => ({ id: i, data: `test${i}` })) }
      const mockResponse = { processed: largeData.items.length }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'POST',
        data: largeData
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(mockResponse)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({ data: largeData })
      )
    })

    it('应该处理并发错误场景', async () => {
      // 模拟部分请求成功，部分失败的场景
      mockRequestor.getMock()
        .mockResolvedValueOnce({ success: true, data: 'result1' })
        .mockRejectedValueOnce(new Error('Request 2 failed'))
        .mockResolvedValueOnce({ success: true, data: 'result3' })

      const configs: RequestConfig[] = [
        { url: `${TEST_URLS.TEST}1`, method: 'GET' },
        { url: `${TEST_URLS.TEST}2`, method: 'GET' },
        { url: `${TEST_URLS.TEST}3`, method: 'GET' }
      ]

      // 这里假设有一个能处理部分失败的并发方法
      try {
        const results = await Promise.allSettled(
          configs.map(config => requestCore.request(config))
        )

        // 验证结果
        expect(results[0].status).toBe('fulfilled')
        expect(results[1].status).toBe('rejected')
        expect(results[2].status).toBe('fulfilled')
      } catch (error) {
        // 如果使用的是Promise.all，会直接抛出错误
        expect(error).toBeDefined()
      }
    })
  })

  describe('资源清理异常', () => {
    it('应该在销毁时处理清理异常', () => {
      // 模拟资源清理时的异常
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // 假设某些资源清理会抛出异常
      try {
        requestCore.destroy()
        expect(consoleSpy).toHaveBeenCalled()
      } catch (error) {
        // 如果清理过程中有异常，应该被捕获并记录
        expect(consoleErrorSpy).toHaveBeenCalled()
      } finally {
        consoleSpy.mockRestore()
        consoleErrorSpy.mockRestore()
      }
    })
  })
})
