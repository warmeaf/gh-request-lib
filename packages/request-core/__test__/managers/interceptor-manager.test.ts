import { describe, it, expect, beforeEach, vi } from 'vitest'
import { InterceptorManager } from '../../src/managers/interceptor-manager'
import { RequestError, RequestInterceptor, RequestConfig } from '../../src/interface'

describe('InterceptorManager', () => {
  let manager: InterceptorManager

  beforeEach(() => {
    manager = new InterceptorManager()
  })

  describe('拦截器管理', () => {
    it('should add valid interceptor', () => {
      const interceptor: RequestInterceptor = {
        onRequest: (config) => config
      }

      manager.add(interceptor)
      expect(manager.count()).toBe(1)
    })

    it('should throw error for invalid interceptor object', () => {
      expect(() => {
        manager.add(null as any)
      }).toThrow('Invalid interceptor: must be an object')

      expect(() => {
        manager.add('not an object' as any)
      }).toThrow('Invalid interceptor: must be an object')
    })

    it('should throw error for interceptor without handler methods', () => {
      const invalidInterceptor = {} as RequestInterceptor

      expect(() => {
        manager.add(invalidInterceptor)
      }).toThrow('Invalid interceptor: must have at least one handler method')
    })

    it('should accept interceptor with onRequest handler', () => {
      const interceptor: RequestInterceptor = {
        onRequest: (config) => config
      }

      expect(() => {
        manager.add(interceptor)
      }).not.toThrow()
    })

    it('should accept interceptor with onResponse handler', () => {
      const interceptor: RequestInterceptor = {
        onResponse: (response) => response
      }

      expect(() => {
        manager.add(interceptor)
      }).not.toThrow()
    })

    it('should accept interceptor with onError handler', () => {
      const interceptor: RequestInterceptor = {
        onError: (error) => error
      }

      expect(() => {
        manager.add(interceptor)
      }).not.toThrow()
    })

    it('should accept interceptor with multiple handlers', () => {
      const interceptor: RequestInterceptor = {
        onRequest: (config) => config,
        onResponse: (response) => response,
        onError: (error) => error
      }

      manager.add(interceptor)
      expect(manager.count()).toBe(1)
    })

    it('should add multiple interceptors', () => {
      const interceptor1: RequestInterceptor = {
        onRequest: (config) => config
      }
      const interceptor2: RequestInterceptor = {
        onResponse: (response) => response
      }

      manager.add(interceptor1)
      manager.add(interceptor2)

      expect(manager.count()).toBe(2)
    })

    it('should remove specific interceptor', () => {
      const interceptor1: RequestInterceptor = {
        onRequest: (config) => config
      }
      const interceptor2: RequestInterceptor = {
        onResponse: (response) => response
      }

      manager.add(interceptor1)
      manager.add(interceptor2)

      const removed = manager.remove(interceptor1)

      expect(removed).toBe(true)
      expect(manager.count()).toBe(1)
    })

    it('should return false when removing non-existent interceptor', () => {
      const interceptor: RequestInterceptor = {
        onRequest: (config) => config
      }

      const removed = manager.remove(interceptor)
      expect(removed).toBe(false)
    })

    it('should clear all interceptors', () => {
      manager.add({ onRequest: (config) => config })
      manager.add({ onResponse: (response) => response })
      manager.add({ onError: (error) => error })

      const count = manager.clear()

      expect(count).toBe(3)
      expect(manager.count()).toBe(0)
    })

    it('should return zero when clearing empty manager', () => {
      const count = manager.clear()
      expect(count).toBe(0)
    })

    it('should return copy of interceptors list', () => {
      const interceptor: RequestInterceptor = {
        onRequest: (config) => config
      }

      manager.add(interceptor)
      const list = manager.getAll()

      expect(list).toHaveLength(1)
      expect(list[0]).toBe(interceptor)

      // 修改返回的数组不应影响内部数组
      list.push({ onResponse: (response) => response })
      expect(manager.count()).toBe(1)
    })
  })

  describe('请求拦截器执行', () => {
    it('should execute request interceptor', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const interceptor: RequestInterceptor = {
        onRequest: (cfg) => {
          return { ...cfg, headers: { 'X-Custom': 'test' } }
        }
      }

      manager.add(interceptor)
      await manager.executeChain(config, mockExecutor)

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Custom': 'test' }
        })
      )
    })

    it('should execute multiple request interceptors in order', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const order: number[] = []

      manager.add({
        onRequest: (cfg) => {
          order.push(1)
          return cfg
        }
      })

      manager.add({
        onRequest: (cfg) => {
          order.push(2)
          return cfg
        }
      })

      await manager.executeChain(config, mockExecutor)

      expect(order).toEqual([1, 2])
    })

    it('should handle async request interceptor', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const interceptor: RequestInterceptor = {
        onRequest: async (cfg) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { ...cfg, headers: { 'X-Async': 'true' } }
        }
      }

      manager.add(interceptor)
      await manager.executeChain(config, mockExecutor)

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Async': 'true' }
        })
      )
    })

    it('should throw error if request interceptor returns invalid config', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const interceptor: RequestInterceptor = {
        onRequest: () => null as any
      }

      manager.add(interceptor)

      await expect(manager.executeChain(config, mockExecutor)).rejects.toThrow(
        'Request interceptor must return a valid config object'
      )
    })

    it('should handle error in request interceptor', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const interceptor: RequestInterceptor = {
        onRequest: () => {
          throw new Error('Interceptor error')
        }
      }

      manager.add(interceptor)

      await expect(manager.executeChain(config, mockExecutor)).rejects.toThrow('Interceptor error')
    })

    it('should preserve RequestError in request interceptor', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const customError = new RequestError('Custom error')

      const interceptor: RequestInterceptor = {
        onRequest: () => {
          throw customError
        }
      }

      manager.add(interceptor)

      await expect(manager.executeChain(config, mockExecutor)).rejects.toBe(customError)
    })
  })

  describe('响应拦截器执行', () => {
    it('should execute response interceptor', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const interceptor: RequestInterceptor = {
        onResponse: (response: any) => {
          return { ...response, modified: true }
        }
      }

      manager.add(interceptor)
      const result = await manager.executeChain(config, mockExecutor)

      expect(result).toEqual({ data: 'test', modified: true })
    })

    it('should execute multiple response interceptors in order', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ count: 0 })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      manager.add({
        onResponse: (response: any) => ({ ...response, count: response.count + 1 })
      })

      manager.add({
        onResponse: (response: any) => ({ ...response, count: response.count + 1 })
      })

      const result = await manager.executeChain<any>(config, mockExecutor)

      expect(result.count).toBe(2)
    })

    it('should handle async response interceptor', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const interceptor: RequestInterceptor = {
        onResponse: async (response) => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { ...response, async: true }
        }
      }

      manager.add(interceptor)
      const result = await manager.executeChain<any>(config, mockExecutor)

      expect(result.async).toBe(true)
    })

    it('should handle error in response interceptor', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const interceptor: RequestInterceptor = {
        onResponse: () => {
          throw new Error('Response interceptor error')
        }
      }

      manager.add(interceptor)

      await expect(manager.executeChain(config, mockExecutor)).rejects.toThrow(
        'Response interceptor error'
      )
    })

    it('should preserve RequestError in response interceptor', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const customError = new RequestError('Custom response error')

      const interceptor: RequestInterceptor = {
        onResponse: () => {
          throw customError
        }
      }

      manager.add(interceptor)

      await expect(manager.executeChain(config, mockExecutor)).rejects.toBe(customError)
    })
  })

  describe('错误拦截器执行', () => {
    it('should execute error interceptor on request error', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('Request failed'))
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const errorHandler = vi.fn((error: RequestError) => {
        throw new RequestError('Handled error')
      })

      manager.add({
        onError: errorHandler
      })

      await expect(manager.executeChain(config, mockExecutor)).rejects.toThrow('Handled error')
      expect(errorHandler).toHaveBeenCalled()
    })

    it('should recover from error if interceptor returns normally', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('Request failed'))
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const recoveredData = { recovered: true }

      manager.add({
        onError: () => {
          return recoveredData
        }
      })

      const result = await manager.executeChain(config, mockExecutor)
      expect(result).toEqual(recoveredData)
    })

    it('should stop error interceptor chain after recovery', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('Request failed'))
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const secondHandler = vi.fn()

      manager.add({
        onError: () => {
          return { recovered: true }
        }
      })

      manager.add({
        onError: secondHandler
      })

      await manager.executeChain(config, mockExecutor)

      expect(secondHandler).not.toHaveBeenCalled()
    })

    it('should continue error interceptor chain if error is thrown', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('Request failed'))
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const firstHandler = vi.fn((error: RequestError) => {
        throw new RequestError('First handler error')
      })

      const secondHandler = vi.fn((error: RequestError) => {
        throw new RequestError('Second handler error')
      })

      manager.add({ onError: firstHandler })
      manager.add({ onError: secondHandler })

      await expect(manager.executeChain(config, mockExecutor)).rejects.toThrow(
        'Second handler error'
      )

      expect(firstHandler).toHaveBeenCalled()
      expect(secondHandler).toHaveBeenCalled()
    })

    it('should handle async error interceptor', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('Request failed'))
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      manager.add({
        onError: async () => {
          await new Promise(resolve => setTimeout(resolve, 10))
          return { recovered: true }
        }
      })

      const result = await manager.executeChain<any>(config, mockExecutor)
      expect(result.recovered).toBe(true)
    })

    it('should execute error interceptor when request interceptor fails', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const errorHandler = vi.fn(() => {
        return { recovered: true }
      })

      manager.add({
        onRequest: () => {
          throw new Error('Request interceptor failed')
        },
        onError: errorHandler
      })

      const result = await manager.executeChain(config, mockExecutor)

      expect(errorHandler).toHaveBeenCalled()
      expect(result).toEqual({ recovered: true })
      expect(mockExecutor).not.toHaveBeenCalled()
    })

    it('should wrap non-RequestError errors', async () => {
      const mockExecutor = vi.fn().mockRejectedValue(new Error('Request failed'))
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      let capturedError: any

      manager.add({
        onError: (error) => {
          capturedError = error
          throw error
        }
      })

      await expect(manager.executeChain(config, mockExecutor)).rejects.toBeInstanceOf(RequestError)
      expect(capturedError).toBeInstanceOf(RequestError)
    })
  })

  describe('完整拦截器链', () => {
    it('should execute full interceptor chain', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const order: string[] = []

      manager.add({
        onRequest: (cfg) => {
          order.push('request')
          return cfg
        },
        onResponse: (response) => {
          order.push('response')
          return response
        },
        onError: (error) => {
          order.push('error')
          throw error
        }
      })

      await manager.executeChain(config, mockExecutor)

      expect(order).toEqual(['request', 'response'])
    })

    it('should skip execution if no interceptors', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await manager.executeChain(config, mockExecutor)

      expect(mockExecutor).toHaveBeenCalledWith(config)
      expect(result).toEqual({ data: 'test' })
    })

    it('should handle complex interceptor chain', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ count: 0 })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      // 请求拦截器添加 header
      manager.add({
        onRequest: (cfg) => ({ ...cfg, headers: { 'X-Step': '1' } })
      })

      // 响应拦截器增加计数
      manager.add({
        onResponse: (response: any) => ({ ...response, count: response.count + 10 })
      })

      manager.add({
        onResponse: (response: any) => ({ ...response, count: response.count + 5 })
      })

      const result = await manager.executeChain<any>(config, mockExecutor)

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Step': '1' }
        })
      )
      expect(result.count).toBe(15)
    })
  })

  describe('拦截器统计', () => {
    it('should return correct stats for empty manager', () => {
      const stats = manager.getStats()

      expect(stats.total).toBe(0)
      expect(stats.withRequestHandler).toBe(0)
      expect(stats.withResponseHandler).toBe(0)
      expect(stats.withErrorHandler).toBe(0)
    })

    it('should track interceptor counts correctly', () => {
      manager.add({
        onRequest: (config) => config,
        onResponse: (response) => response
      })

      manager.add({
        onError: (error) => error
      })

      manager.add({
        onRequest: (config) => config
      })

      const stats = manager.getStats()

      expect(stats.total).toBe(3)
      expect(stats.withRequestHandler).toBe(2)
      expect(stats.withResponseHandler).toBe(1)
      expect(stats.withErrorHandler).toBe(1)
    })
  })

  describe('单个拦截器执行（测试辅助方法）', () => {
    it('should execute single interceptor', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const interceptor: RequestInterceptor = {
        onRequest: (cfg) => ({ ...cfg, headers: { 'X-Test': 'true' } })
      }

      const result = await manager.executeSingle(interceptor, config, mockExecutor)

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Test': 'true' }
        })
      )
      expect(result).toEqual({ data: 'test' })
    })
  })

  describe('边界情况', () => {
    it('should handle empty interceptor list gracefully', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await manager.executeChain(config, mockExecutor)

      expect(result).toEqual({ data: 'test' })
      expect(mockExecutor).toHaveBeenCalledTimes(1)
    })

    it('should handle interceptor that modifies config multiple times', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      manager.add({
        onRequest: (cfg) => ({ ...cfg, timeout: 1000 })
      })

      manager.add({
        onRequest: (cfg) => ({ ...cfg, timeout: (cfg.timeout || 0) + 500 })
      })

      manager.add({
        onRequest: (cfg) => ({ ...cfg, timeout: (cfg.timeout || 0) + 500 })
      })

      await manager.executeChain(config, mockExecutor)

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 2000
        })
      )
    })

    it('should handle very long interceptor chain', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ count: 0 })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      // 添加100个拦截器
      for (let i = 0; i < 100; i++) {
        manager.add({
          onResponse: (response: any) => ({ ...response, count: response.count + 1 })
        })
      }

      const result = await manager.executeChain<any>(config, mockExecutor)
      expect(result.count).toBe(100)
    })

    it('should handle interceptor returning Promise.resolve', async () => {
      const mockExecutor = vi.fn().mockResolvedValue({ data: 'test' })
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      manager.add({
        onRequest: (cfg) => Promise.resolve({ ...cfg, headers: { 'X-Promise': 'true' } })
      })

      await manager.executeChain(config, mockExecutor)

      expect(mockExecutor).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: { 'X-Promise': 'true' }
        })
      )
    })
  })
})
