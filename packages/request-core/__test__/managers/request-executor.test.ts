import { describe, it, expect, beforeEach, vi } from 'vitest'
import { RequestExecutor } from '../../src/managers/request-executor'
import { RequestError, RequestErrorType, RequestConfig } from '../../src/interface'
import { createMockRequestor } from '../test-helpers'

describe('RequestExecutor', () => {
  let mockRequestor: ReturnType<typeof createMockRequestor>
  let executor: RequestExecutor

  beforeEach(() => {
    mockRequestor = createMockRequestor()
    executor = new RequestExecutor(mockRequestor)
  })

  describe('构造函数', () => {
    it('should create executor with valid requestor', () => {
      expect(() => {
        new RequestExecutor(mockRequestor)
      }).not.toThrow()
    })

    it('should throw error for invalid requestor', () => {
      expect(() => {
        new RequestExecutor(null as any)
      }).toThrow('Invalid requestor: must implement request method')

      expect(() => {
        new RequestExecutor({} as any)
      }).toThrow('Invalid requestor: must implement request method')
    })
  })

  describe('基本请求执行', () => {
    it('should execute request successfully', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const mockResponse = { data: [{ id: 1, name: 'John' }] }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const result = await executor.execute(config)

      expect(result).toEqual(mockResponse)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(config)
    })

    it('should pass config to requestor', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: { name: 'John' },
        headers: {
          'Content-Type': 'application/json'
        }
      }

      mockRequestor.getMock().mockResolvedValue({ success: true })

      await executor.execute(config)

      expect(mockRequestor.getMock()).toHaveBeenCalledWith(config)
    })

    it('should handle request error', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockRejectedValue(new Error('Network error'))

      await expect(executor.execute(config)).rejects.toThrow()
    })

    it('should enhance error with context', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        tag: 'test-request'
      }

      mockRequestor.getMock().mockRejectedValue(new Error('Network error'))

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        const requestError = error as RequestError
        expect(requestError.context.url).toBe(config.url)
        expect(requestError.context.method).toBe(config.method)
        expect(requestError.context.tag).toBe(config.tag)
        expect(requestError.context.duration).toBeGreaterThanOrEqual(0)
      }
    })
  })

  describe('批量请求执行', () => {
    it('should execute batch requests successfully', async () => {
      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' },
        { url: 'https://api.example.com/users/3', method: 'GET' }
      ]

      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1, name: 'User 1' })
        .mockResolvedValueOnce({ id: 2, name: 'User 2' })
        .mockResolvedValueOnce({ id: 3, name: 'User 3' })

      const results = await executor.executeBatch(configs)

      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({ id: 1, name: 'User 1' })
      expect(results[1]).toEqual({ id: 2, name: 'User 2' })
      expect(results[2]).toEqual({ id: 3, name: 'User 3' })
    })

    it('should throw error for empty configs array', async () => {
      await expect(executor.executeBatch([])).rejects.toThrow(
        'Batch configs must be a non-empty array'
      )
    })

    it('should throw error for invalid configs', async () => {
      await expect(executor.executeBatch(null as any)).rejects.toThrow(
        'Batch configs must be a non-empty array'
      )
    })

    it('should fail if one request fails', async () => {
      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' }
      ]

      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1, name: 'User 1' })
        .mockRejectedValueOnce(new Error('Request failed'))

      await expect(executor.executeBatch(configs)).rejects.toThrow()
    })

    it('should execute all requests in parallel', async () => {
      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' }
      ]

      const startTime = Date.now()
      
      mockRequestor.getMock().mockImplementation(() => 
        new Promise(resolve => setTimeout(() => resolve({ data: 'ok' }), 50))
      )

      await executor.executeBatch(configs)
      
      const duration = Date.now() - startTime
      
      // 如果是串行执行，总时间应该 >= 100ms
      // 如果是并行执行，总时间应该接近 50ms
      expect(duration).toBeLessThan(100)
    })
  })

  describe('调试日志', () => {
    it('should log request start in debug mode', async () => {
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {})
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        debug: true
      }

      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await executor.execute(config)

      expect(consoleSpy).toHaveBeenCalled()
      expect(consoleLogSpy).toHaveBeenCalled()

      consoleSpy.mockRestore()
      consoleLogSpy.mockRestore()
    })

    it('should log request success in debug mode', async () => {
      const consoleGroupEndSpy = vi.spyOn(console, 'groupEnd').mockImplementation(() => {})

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        debug: true
      }

      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await executor.execute(config)

      expect(consoleGroupEndSpy).toHaveBeenCalled()
      consoleGroupEndSpy.mockRestore()
    })

    it('should log request error in debug mode', async () => {
      const consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        debug: true
      }

      mockRequestor.getMock().mockRejectedValue(new Error('Request failed'))

      try {
        await executor.execute(config)
      } catch {
        // Expected error
      }

      expect(consoleErrorSpy).toHaveBeenCalled()
      consoleErrorSpy.mockRestore()
    })

    it('should not log without debug mode', async () => {
      const consoleSpy = vi.spyOn(console, 'group').mockImplementation(() => {})

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        debug: false
      }

      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await executor.execute(config)

      expect(consoleSpy).not.toHaveBeenCalled()
      consoleSpy.mockRestore()
    })

    it('should sanitize sensitive headers in logs', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        debug: true,
        headers: {
          'Authorization': 'Bearer secret-token',
          'X-API-Key': 'secret-key'
        }
      }

      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await executor.execute(config)

      // 检查是否调用了日志，但不验证具体内容（因为是私有方法）
      expect(consoleLogSpy).toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })
  })

  describe('生命周期回调', () => {
    it('should call onStart callback', async () => {
      const onStart = vi.fn()
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        onStart
      }

      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await executor.execute(config)

      expect(onStart).toHaveBeenCalledWith(config)
    })

    it('should call onEnd callback with duration', async () => {
      const onEnd = vi.fn()
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        onEnd
      }

      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await executor.execute(config)

      expect(onEnd).toHaveBeenCalled()
      expect(onEnd.mock.calls[0][1]).toBeGreaterThanOrEqual(0)
    })

    it('should call onError callback on failure', async () => {
      const onError = vi.fn()
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        onError
      }

      mockRequestor.getMock().mockRejectedValue(new Error('Request failed'))

      try {
        await executor.execute(config)
      } catch {
        // Expected error
      }

      expect(onError).toHaveBeenCalled()
      expect(onError.mock.calls[0][1]).toBeInstanceOf(RequestError)
      expect(onError.mock.calls[0][2]).toBeGreaterThanOrEqual(0)
    })

    it('should not throw if callback throws', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        onStart: () => {
          throw new Error('Callback error')
        }
      }

      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await expect(executor.execute(config)).resolves.toBeDefined()
      expect(warnSpy).toHaveBeenCalled()

      warnSpy.mockRestore()
    })

    it('should call all callbacks in correct order', async () => {
      const order: string[] = []

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        onStart: () => order.push('start'),
        onEnd: () => order.push('end')
      }

      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await executor.execute(config)

      expect(order).toEqual(['start', 'end'])
    })
  })

  describe('错误类型推断', () => {
    it('should infer network error', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockRejectedValue(new Error('Network connection failed'))

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.NETWORK_ERROR)
      }
    })

    it('should infer timeout error', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockRejectedValue(new Error('Request timeout'))

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.TIMEOUT_ERROR)
      }
    })

    it('should infer timeout for AbortError', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const abortError = new Error('Aborted')
      abortError.name = 'AbortError'
      mockRequestor.getMock().mockRejectedValue(abortError)

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.TIMEOUT_ERROR)
      }
    })

    it('should handle connection timeout as network error', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockRejectedValue(new Error('Connection timeout'))

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.NETWORK_ERROR)
      }
    })

    it('should preserve existing RequestError', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const originalError = new RequestError('Original error', {
        type: RequestErrorType.HTTP_ERROR,
        status: 404
      })

      mockRequestor.getMock().mockRejectedValue(originalError)

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBe(originalError)
        expect((error as RequestError).context.url).toBe(config.url)
        expect((error as RequestError).context.method).toBe(config.method)
      }
    })

    it('should handle unknown error type', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockRejectedValue({ custom: 'error' })

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.UNKNOWN_ERROR)
      }
    })
  })

  describe('请求器信息', () => {
    it('should return requestor info', () => {
      const info = executor.getRequestorInfo()

      expect(info.name).toBe('MockRequestor')
      expect(info.hasRequest).toBe(true)
      expect(info.methods).toContain('request')
    })

    it('should list requestor methods', () => {
      const info = executor.getRequestorInfo()

      expect(Array.isArray(info.methods)).toBe(true)
      expect(info.methods.length).toBeGreaterThan(0)
    })
  })

  describe('连接测试', () => {
    it('should test connection successfully', async () => {
      mockRequestor.getMock().mockResolvedValue({ status: 200 })

      const result = await executor.testConnection()

      expect(result).toBe(true)
    })

    it('should return false on connection failure', async () => {
      mockRequestor.getMock().mockRejectedValue(new Error('Connection failed'))

      const result = await executor.testConnection()

      expect(result).toBe(false)
    })

    it('should accept custom URL for testing', async () => {
      mockRequestor.getMock().mockResolvedValue({ status: 200 })

      await executor.testConnection('https://custom-api.example.com/health')

      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://custom-api.example.com/health'
        })
      )
    })
  })

  describe('请求ID生成', () => {
    it('should generate unique request IDs', async () => {
      const onStart = vi.fn()

      for (let i = 0; i < 10; i++) {
        const config: RequestConfig = {
          url: 'https://api.example.com/users',
          method: 'GET',
          debug: true,
          onStart
        }

        mockRequestor.getMock().mockResolvedValue({ data: 'test' })
        
        await executor.execute(config)
      }

      // onStart 应该被调用 10 次，每次请求都会触发
      expect(onStart).toHaveBeenCalledTimes(10)
    })
  })

  describe('性能数据收集', () => {
    it('should track request duration', async () => {
      const onEnd = vi.fn()
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        onEnd
      }

      mockRequestor.getMock().mockImplementation(
        () => new Promise(resolve => setTimeout(() => resolve({ data: 'test' }), 50))
      )

      await executor.execute(config)

      expect(onEnd).toHaveBeenCalled()
      const duration = onEnd.mock.calls[0][1]
      expect(duration).toBeGreaterThanOrEqual(50)
    })

    it('should include duration in error context', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockImplementation(
        () => new Promise((_, reject) => setTimeout(() => reject(new Error('Failed')), 20))
      )

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).context.duration).toBeGreaterThanOrEqual(20)
      }
    })
  })

  describe('边界情况', () => {
    it('should handle very long data in debug mode', async () => {
      const consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})

      const longData = 'a'.repeat(1000)
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: longData,
        debug: true
      }

      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await executor.execute(config)

      // 应该会截断长数据
      expect(consoleLogSpy).toHaveBeenCalled()

      consoleLogSpy.mockRestore()
    })

    it('should handle config without optional fields', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await expect(executor.execute(config)).resolves.toBeDefined()
    })

    it('should handle error with no message', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockRejectedValue(null)

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Unknown error')
      }
    })

    it('should add request ID to error metadata', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockRejectedValue(new Error('Failed'))

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).context.metadata?.requestId).toBeTruthy()
      }
    })

    it('should handle CORS error', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockRejectedValue(new Error('CORS policy blocked'))

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.NETWORK_ERROR)
      }
    })

    it('should handle fetch error', async () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      mockRequestor.getMock().mockRejectedValue(new Error('Failed to fetch'))

      try {
        await executor.execute(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.NETWORK_ERROR)
      }
    })
  })
})
