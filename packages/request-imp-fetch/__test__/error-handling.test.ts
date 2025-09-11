import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FetchRequestor } from '../src/index'
import { RequestConfig, RequestError, RequestErrorType } from 'request-core'

// Mock console methods to avoid cluttering test output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

// Mock fetch API
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('FetchRequestor - Error Handling', () => {
  let fetchRequestor: FetchRequestor

  beforeEach(() => {
    fetchRequestor = new FetchRequestor()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('错误处理', () => {
    it('应该正确处理 HTTP 4xx 错误', async () => {
      const mockResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/nonexistent',
        method: 'GET'
      }

      await expect(fetchRequestor.request(config)).rejects.toThrow(RequestError)
      
      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).status).toBe(404)
        expect((error as RequestError).type).toBe(RequestErrorType.HTTP_ERROR)
        expect((error as RequestError).message).toContain('HTTP 404')
      }
    })

    it('应该正确处理 HTTP 5xx 错误', async () => {
      const mockResponse = {
        ok: false,
        status: 500,
        statusText: 'Internal Server Error'
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/error',
        method: 'GET'
      }

      await expect(fetchRequestor.request(config)).rejects.toThrow(RequestError)
      
      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).status).toBe(500)
        expect((error as RequestError).type).toBe(RequestErrorType.HTTP_ERROR)
      }
    })

    it('应该正确处理网络错误', async () => {
      const networkError = new Error('Network error')
      mockFetch.mockRejectedValue(networkError)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      await expect(fetchRequestor.request(config)).rejects.toThrow(RequestError)
      
      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.NETWORK_ERROR)
        expect((error as RequestError).originalError).toBe(networkError)
      }
    })

    it('应该正确处理超时错误', async () => {
      // 模拟 AbortError
      const abortError = new Error('The operation was aborted.')
      abortError.name = 'AbortError'
      mockFetch.mockRejectedValue(abortError)

      const config: RequestConfig = {
        url: 'https://api.example.com/slow',
        method: 'GET',
        timeout: 100
      }

      await expect(fetchRequestor.request(config)).rejects.toThrow(RequestError)
      
      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.TIMEOUT_ERROR)
        expect((error as RequestError).message).toContain('timeout')
      }
    })

    it('应该保持已存在的 RequestError', async () => {
      const existingError = new RequestError('Custom error', {
        type: RequestErrorType.VALIDATION_ERROR,
        status: 400
      })
      mockFetch.mockRejectedValue(existingError)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      await expect(fetchRequestor.request(config)).rejects.toThrow(existingError)
    })

    it('应该包装未知错误', async () => {
      const unknownError = { message: 'Unknown error', type: 'weird' }
      mockFetch.mockRejectedValue(unknownError)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      await expect(fetchRequestor.request(config)).rejects.toThrow(RequestError)
      
      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).originalError).toBe(unknownError)
      }
    })
  })

  describe('超时和取消信号', () => {
    beforeEach(() => {
      // 模拟 AbortController
      global.AbortController = class {
        public signal: AbortSignal = {
          aborted: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          onabort: null,
          reason: undefined,
          throwIfAborted: vi.fn()
        }
        
        public abort = vi.fn(() => {
          Object.assign(this.signal, { aborted: true })
        })
      }
    })

    it('应该设置超时', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        timeout: 5000
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.signal).toBeDefined()
      expect(fetchOptions.signal!.aborted).toBe(false)
    })

    it('应该处理外部取消信号', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const externalController = new AbortController()
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        signal: externalController.signal
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.signal).toBeDefined()
      // 检查外部信号的监听器是否被添加
      expect(externalController.signal.addEventListener).toHaveBeenCalled()
    })

    it('应该处理预先取消的外部信号', async () => {
      // 模拟预先取消的信号会导致 AbortError
      const abortError = new Error('The operation was aborted.')
      abortError.name = 'AbortError'
      mockFetch.mockRejectedValue(abortError)

      const externalController = new AbortController()
      externalController.abort()

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        signal: externalController.signal
      }

      await expect(fetchRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.TIMEOUT_ERROR)
      }

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.signal).toBeDefined()
    })
  })

  describe('日志记录', () => {
    it('应该记录请求开始日志', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      await fetchRequestor.request(config)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[FetchRequestor] Sending request')
      )
    })

    it('应该记录请求成功日志', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      await fetchRequestor.request(config)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[FetchRequestor] Request completed successfully')
      )
    })

    it('应该记录请求失败日志', async () => {
      const networkError = new Error('Network error')
      mockFetch.mockRejectedValue(networkError)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      try {
        await fetchRequestor.request(config)
      } catch {
        // 预期的错误
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[FetchRequestor] Request failed')
      )
    })
  })

  describe('默认实例', () => {
    it('应该导出默认实例', async () => {
      const { fetchRequestor: defaultInstance } = await import('../src/index')
      expect(defaultInstance).toBeInstanceOf(FetchRequestor)
    })
  })

  describe('响应解析错误', () => {
    it('应该处理 JSON 解析抛出异常的情况', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError('Unexpected token in JSON')),
        text: vi.fn().mockResolvedValue('Invalid JSON response')
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/invalid-json',
        method: 'GET',
        responseType: 'json'
      }

      const result = await fetchRequestor.request(config)

      expect(mockResponse.json).toHaveBeenCalled()
      expect(mockResponse.text).toHaveBeenCalled()
      expect(result).toBe('Invalid JSON response')
    })

    it('应该处理文本解析也失败的情况', async () => {
      const textError = new Error('Text parsing failed')
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockRejectedValue(new SyntaxError('Invalid JSON')),
        text: vi.fn().mockRejectedValue(textError)
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/bad-response',
        method: 'GET'
      }

      await expect(fetchRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).originalError).toBe(textError)
      }
    })

    it('应该处理 blob 解析失败', async () => {
      const blobError = new Error('Blob parsing failed')
      const mockResponse = {
        ok: true,
        status: 200,
        blob: vi.fn().mockRejectedValue(blobError)
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/bad-blob',
        method: 'GET',
        responseType: 'blob'
      }

      await expect(fetchRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).originalError).toBe(blobError)
      }
    })

    it('应该处理 arrayBuffer 解析失败', async () => {
      const bufferError = new Error('ArrayBuffer parsing failed')
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockRejectedValue(bufferError)
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/bad-buffer',
        method: 'GET',
        responseType: 'arraybuffer'
      }

      await expect(fetchRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).originalError).toBe(bufferError)
      }
    })
  })

  describe('URL 和配置错误', () => {
    it('应该处理无效的 URL 构造', async () => {
      // 在 Node.js 环境中，无 base URL 时相对路径会抛出错误
      delete (global as any).window

      const config: RequestConfig = {
        url: '/relative-path',
        method: 'GET',
        params: { test: 'value' }
      }

      // 创建 URL 时应该抛出 TypeError
      await expect(fetchRequestor.request(config)).rejects.toThrow()
    })

    it('应该处理循环引用的请求数据', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      // 创建循环引用对象
      const circularData: any = { name: 'test' }
      circularData.self = circularData

      const config: RequestConfig = {
        url: 'https://api.example.com/circular',
        method: 'POST',
        data: circularData
      }

      // JSON.stringify 对循环引用会抛出 TypeError
      await expect(fetchRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).originalError).toBeInstanceOf(TypeError)
        expect((error as RequestError).message).toContain('circular')
      }
    })
  })

  describe('信号处理边界情况', () => {
    beforeEach(() => {
      // 重新设置 AbortController mock
      global.AbortController = class {
        public signal: AbortSignal = {
          aborted: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          onabort: null,
          reason: undefined,
          throwIfAborted: vi.fn()
        }
        
        public abort = vi.fn(() => {
          Object.assign(this.signal, { aborted: true })
        })
      }
    })

    it('应该处理外部信号监听器添加失败', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      // 创建一个会抛出错误的 signal
      const problematicSignal = {
        aborted: false,
        addEventListener: vi.fn().mockImplementation(() => {
          throw new Error('Cannot add event listener')
        }),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
        onabort: null,
        reason: undefined,
        throwIfAborted: vi.fn()
      } as AbortSignal

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        signal: problematicSignal
      }

      // 应该仍然能够处理请求，即使添加监听器失败
      await expect(fetchRequestor.request(config)).resolves.not.toThrow()
    })

    it('应该在超时后正确清理资源', async () => {
      const abortError = new Error('The operation was aborted.')
      abortError.name = 'AbortError'
      mockFetch.mockRejectedValue(abortError)

      // Mock clearTimeout
      const originalClearTimeout = global.clearTimeout
      const mockClearTimeout = vi.fn()
      global.clearTimeout = mockClearTimeout

      const config: RequestConfig = {
        url: 'https://api.example.com/timeout',
        method: 'GET',
        timeout: 100
      }

      try {
        await fetchRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.TIMEOUT_ERROR)
      }

      // 验证 clearTimeout 被调用
      expect(mockClearTimeout).toHaveBeenCalled()
      
      // 恢复原始 clearTimeout
      global.clearTimeout = originalClearTimeout
    })
  })
})
