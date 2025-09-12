import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { FetchRequestor } from '../src/index'
import { RequestConfig, RequestError, RequestErrorType } from 'request-core'

// Mock fetch API
const mockFetch = vi.fn()
global.fetch = mockFetch

describe('FetchRequestor', () => {
  let fetchRequestor: FetchRequestor

  beforeEach(() => {
    fetchRequestor = new FetchRequestor()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基本 HTTP 方法', () => {
    it('应该发送 GET 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValue({ message: 'success' }),
        text: vi.fn(),
        blob: vi.fn(),
        arrayBuffer: vi.fn()
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await fetchRequestor.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'GET',
          credentials: 'same-origin',
          redirect: 'follow',
          referrerPolicy: 'strict-origin-when-cross-origin'
        })
      )
      expect(result).toEqual({ message: 'success' })
      expect(mockResponse.json).toHaveBeenCalled()
    })

    it('应该发送 POST 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValue({ id: 1 })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: { name: 'John', email: 'john@example.com' }
      }

      await fetchRequestor.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ name: 'John', email: 'john@example.com' })
        })
      )
    })

    it('应该发送 PUT 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValue({ id: 1 })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users/1',
        method: 'PUT',
        data: { name: 'John Updated' }
      }

      await fetchRequestor.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'PUT',
          body: JSON.stringify({ name: 'John Updated' })
        })
      )
    })

    it('应该发送 DELETE 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 204,
        statusText: 'No Content',
        json: vi.fn(),
        text: vi.fn().mockResolvedValue('')
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users/1',
        method: 'DELETE'
      }

      await fetchRequestor.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'DELETE'
        })
      )
    })

    it('应该发送 PATCH 请求', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        statusText: 'OK',
        json: vi.fn().mockResolvedValue({ id: 1, name: 'John Patched' })
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users/1',
        method: 'PATCH',
        data: { name: 'John Patched' }
      }

      await fetchRequestor.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users/1',
        expect.objectContaining({
          method: 'PATCH',
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          }),
          body: JSON.stringify({ name: 'John Patched' })
        })
      )
    })
  })

  describe('查询参数处理', () => {
    it('应该正确处理查询参数', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        params: {
          page: 1,
          limit: 10,
          status: 'active'
        }
      }

      await fetchRequestor.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users?page=1&limit=10&status=active',
        expect.any(Object)
      )
    })

    it('应该跳过 null 和 undefined 参数', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        params: {
          page: 1,
          limit: null,
          status: undefined,
          active: true
        }
      }

      await fetchRequestor.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users?page=1&active=true',
        expect.any(Object)
      )
    })

    it('应该在浏览器环境中正确处理相对 URL', async () => {
      // 模拟浏览器环境
      Object.defineProperty(global, 'window', {
        value: {
          location: {
            origin: 'https://example.com'
          }
        },
        writable: true,
        configurable: true  // 允许删除此属性
      })

      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: '/api/users',
        method: 'GET',
        params: { page: 1 }
      }

      await fetchRequestor.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://example.com/api/users?page=1',
        expect.any(Object)
      )

      // 清理
      delete (global as any).window
    })
  })

  describe('请求头处理', () => {
    it('应该正确设置默认请求头', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value'
        }
      }

      await fetchRequestor.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Authorization': 'Bearer token123',
            'X-Custom-Header': 'custom-value'
          })
        })
      )
    })

    it('应该大小写无关地处理 Content-Type 设置', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: {
          'content-type': 'application/xml' // 小写的 content-type
        },
        data: '<user><name>John</name></user>'
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      const headers = fetchOptions.headers as Record<string, string>
      
      // 不应该添加 JSON Content-Type，因为已经有了
      expect(Object.keys(headers).some(key => key.toLowerCase() === 'content-type')).toBe(true)
      expect(headers['content-type']).toBe('application/xml')
    })

    it('应该为 JSON 数据自动添加 Content-Type', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: { name: 'John' }
      }

      await fetchRequestor.request(config)

      expect(mockFetch).toHaveBeenCalledWith(
        'https://api.example.com/users',
        expect.objectContaining({
          headers: expect.objectContaining({
            'Content-Type': 'application/json'
          })
        })
      )
    })
  })

  describe('请求体处理', () => {
    it('应该正确处理 FormData', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const formData = new FormData()
      formData.append('name', 'John')
      formData.append('email', 'john@example.com')

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: formData
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.body).toBe(formData)
      // FormData 不应该设置 Content-Type
      const headers = fetchOptions.headers as Record<string, string>
      expect(headers['Content-Type']).toBeUndefined()
    })

    it('应该正确处理 Blob 数据', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const blob = new Blob(['binary data'], { type: 'application/octet-stream' })

      const config: RequestConfig = {
        url: 'https://api.example.com/upload',
        method: 'POST',
        data: blob
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.body).toBe(blob)
    })

    it('应该正确处理 ArrayBuffer 数据', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const buffer = new ArrayBuffer(16)
      const view = new Uint8Array(buffer)
      view.set([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16])

      const config: RequestConfig = {
        url: 'https://api.example.com/binary',
        method: 'POST',
        data: buffer
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.body).toBe(buffer)
      // ArrayBuffer 不应该设置 Content-Type
      const headers = fetchOptions.headers as Record<string, string>
      expect(headers['Content-Type']).toBeUndefined()
    })

    it('应该正确处理 ReadableStream 数据', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const stream = new ReadableStream({
        start(controller) {
          controller.enqueue(new TextEncoder().encode('streaming data'))
          controller.close()
        }
      })

      const config: RequestConfig = {
        url: 'https://api.example.com/stream',
        method: 'POST',
        data: stream
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.body).toBe(stream)
      // ReadableStream 不应该设置 JSON Content-Type
      const headers = fetchOptions.headers as Record<string, string>
      expect(Object.keys(headers).some(key => 
        key.toLowerCase() === 'content-type' && headers[key] === 'application/json'
      )).toBe(false)
    })

    it('应该正确处理 URLSearchParams', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const searchParams = new URLSearchParams()
      searchParams.append('name', 'John')
      searchParams.append('email', 'john@example.com')

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: searchParams
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.body).toBe(searchParams)
    })

    it('应该正确处理字符串数据', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/raw',
        method: 'POST',
        data: 'raw string data'
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.body).toBe('raw string data')
    })

    it('应该跳过 GET 请求的数据', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        data: { name: 'John' } // GET 请求不应该包含 body
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.body).toBeUndefined()
    })
  })

  describe('响应类型处理', () => {
    it('应该正确解析 JSON 响应', async () => {
      const mockData = { message: 'success', id: 123 }
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue(mockData),
        text: vi.fn(),
        blob: vi.fn(),
        arrayBuffer: vi.fn()
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/data',
        method: 'GET',
        responseType: 'json'
      }

      const result = await fetchRequestor.request(config)

      expect(mockResponse.json).toHaveBeenCalled()
      expect(result).toEqual(mockData)
    })

    it('应该正确解析文本响应', async () => {
      const mockText = 'Plain text response'
      const mockResponse = {
        ok: true,
        status: 200,
        text: vi.fn().mockResolvedValue(mockText)
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/text',
        method: 'GET',
        responseType: 'text'
      }

      const result = await fetchRequestor.request(config)

      expect(mockResponse.text).toHaveBeenCalled()
      expect(result).toBe(mockText)
    })

    it('应该正确解析 Blob 响应', async () => {
      const mockBlob = new Blob(['binary data'])
      const mockResponse = {
        ok: true,
        status: 200,
        blob: vi.fn().mockResolvedValue(mockBlob)
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/file',
        method: 'GET',
        responseType: 'blob'
      }

      const result = await fetchRequestor.request(config)

      expect(mockResponse.blob).toHaveBeenCalled()
      expect(result).toBe(mockBlob)
    })

    it('应该正确解析 ArrayBuffer 响应', async () => {
      const mockBuffer = new ArrayBuffer(8)
      const mockResponse = {
        ok: true,
        status: 200,
        arrayBuffer: vi.fn().mockResolvedValue(mockBuffer)
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/binary',
        method: 'GET',
        responseType: 'arraybuffer'
      }

      const result = await fetchRequestor.request(config)

      expect(mockResponse.arrayBuffer).toHaveBeenCalled()
      expect(result).toBe(mockBuffer)
    })

  })

  describe('边界条件测试', () => {
    it('应该使用默认超时时间 10000ms', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      // Mock setTimeout 来验证默认超时设置
      const originalSetTimeout = global.setTimeout
      const mockSetTimeout = vi.fn().mockImplementation((callback: (...args: any[]) => void, delay: number) => {
        expect(delay).toBe(10000) // 验证默认超时
        return originalSetTimeout(callback, 0) // 立即执行避免实际等待
      })
      global.setTimeout = mockSetTimeout as any

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
        // 不设置 timeout，使用默认值
      }

      await fetchRequestor.request(config)

      expect(mockSetTimeout).toHaveBeenCalledWith(expect.any(Function), 10000)
      
      // 恢复原始 setTimeout
      global.setTimeout = originalSetTimeout
    })

    it('应该正确处理空 headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: undefined,
        data: { name: 'John' }
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      const headers = fetchOptions.headers as Record<string, string>
      
      // 应该仍然设置默认的 Content-Type
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('应该正确处理空对象 headers', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        headers: {},
        data: { name: 'John' }
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      const headers = fetchOptions.headers as Record<string, string>
      
      // 应该设置默认的 Content-Type
      expect(headers['Content-Type']).toBe('application/json')
    })

    it('应该正确处理方法名大小写', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'post' as any, // 小写方法名
        data: { name: 'John' }
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.method).toBe('POST') // 应该转换为大写
    })

    it('应该正确处理没有 method 的配置', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config = {
        url: 'https://api.example.com/users'
        // 不设置 method，应该默认为 GET
      } as RequestConfig

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const fetchOptions = fetchCall[1] as RequestInit
      
      expect(fetchOptions.method).toBe('GET')
    })

    it('应该正确处理特殊字符的查询参数', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: 'https://api.example.com/search',
        method: 'GET',
        params: {
          q: 'hello world & special chars #@!',
          filter: 'name=john&age>18',
          emoji: '😀🎉'
        }
      }

      await fetchRequestor.request(config)

      const fetchCall = mockFetch.mock.calls[0]
      const requestUrl = fetchCall[0] as string
      
      // 验证特殊字符被正确编码 - 使用 URLSearchParams 的编码方式
      // 空格在 URLSearchParams 中被编码为 '+', 其他字符与 encodeURIComponent 相同
      const expectedUrl = new URL('https://api.example.com/search')
      expectedUrl.searchParams.set('q', 'hello world & special chars #@!')
      expectedUrl.searchParams.set('filter', 'name=john&age>18')
      expectedUrl.searchParams.set('emoji', '😀🎉')
      
      expect(requestUrl).toBe(expectedUrl.toString())
    })
  })

  describe('并发和性能测试', () => {
    it('应该能够处理多个并发请求', async () => {
      const mockResponses = Array.from({ length: 5 }, (_, i) => ({
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ id: i + 1, name: `User ${i + 1}` })
      }))
      
      let responseIndex = 0
      mockFetch.mockImplementation(() => {
        const response = mockResponses[responseIndex]
        responseIndex++
        return Promise.resolve(response)
      })

      const configs: RequestConfig[] = Array.from({ length: 5 }, (_, i) => ({
        url: `https://api.example.com/users/${i + 1}`,
        method: 'GET'
      }))

      // 并发发送多个请求
      const promises = configs.map(config => fetchRequestor.request(config))
      const results = await Promise.all(promises)

      // 验证所有请求都成功完成
      expect(results).toHaveLength(5)
      results.forEach((result, index) => {
        expect(result).toEqual({ id: index + 1, name: `User ${index + 1}` })
      })
      
      // 验证 fetch 被调用了 5 次
      expect(mockFetch).toHaveBeenCalledTimes(5)
    })

    it('应该能够处理部分请求失败的并发场景', async () => {
      const successResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ success: true })
      }
      
      const failureResponse = {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      }

      // 设置不同的响应：成功、失败、成功
      mockFetch
        .mockResolvedValueOnce(successResponse)
        .mockResolvedValueOnce(failureResponse)
        .mockResolvedValueOnce(successResponse)

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/999', method: 'GET' },
        { url: 'https://api.example.com/users/3', method: 'GET' }
      ]

      const promises = configs.map(config => 
        fetchRequestor.request(config).catch(error => error)
      )
      const results = await Promise.all(promises)

      // 验证结果：成功、失败、成功
      expect(results[0]).toEqual({ success: true })
      expect(results[1]).toBeInstanceOf(RequestError)
      expect(results[2]).toEqual({ success: true })
      
      expect(mockFetch).toHaveBeenCalledTimes(3)
    })

    it('应该能够正确处理并发请求的取消信号', async () => {
      const controllers = Array.from({ length: 3 }, () => new AbortController())
      
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ data: 'success' })
      }

      // 模拟第二个请求被取消
      const abortError = new Error('The operation was aborted.')
      abortError.name = 'AbortError'

      mockFetch
        .mockResolvedValueOnce(mockResponse)
        .mockRejectedValueOnce(abortError)
        .mockResolvedValueOnce(mockResponse)

      const configs: RequestConfig[] = controllers.map((controller, index) => ({
        url: `https://api.example.com/data/${index}`,
        method: 'GET',
        signal: controller.signal
      }))

      // 在请求过程中取消第二个请求
      setTimeout(() => controllers[1].abort(), 10)

      const promises = configs.map(config => 
        fetchRequestor.request(config).catch(error => error)
      )
      const results = await Promise.all(promises)

      // 验证结果：第一个和第三个成功，第二个被取消
      expect(results[0]).toEqual({ data: 'success' })
      expect(results[1]).toBeInstanceOf(RequestError)
      expect((results[1] as RequestError).type).toBe(RequestErrorType.TIMEOUT_ERROR)
      expect(results[2]).toEqual({ data: 'success' })
    })
  })

  describe('Mock 行为验证', () => {
    it('应该正确模拟 fetch 行为的时序', async () => {
      const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))
      
      const fastResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({ fast: true })
      }
      
      const slowResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockImplementation(async () => {
          await delay(50)
          return { slow: true }
        })
      }

      mockFetch
        .mockResolvedValueOnce(slowResponse)
        .mockResolvedValueOnce(fastResponse)

      const startTime = Date.now()
      
      // 并发启动两个请求，但第二个应该更快完成
      const promises = [
        fetchRequestor.request({ url: 'https://api.example.com/slow', method: 'GET' }),
        fetchRequestor.request({ url: 'https://api.example.com/fast', method: 'GET' })
      ]

      const results = await Promise.all(promises)
      const endTime = Date.now()

      expect(results[0]).toEqual({ slow: true })
      expect(results[1]).toEqual({ fast: true })
      expect(endTime - startTime).toBeGreaterThan(40) // 至少等待了慢请求的延迟
    })

    it('应该验证 Mock 的调用顺序和参数', async () => {
      const mockResponse = {
        ok: true,
        status: 200,
        json: vi.fn().mockResolvedValue({})
      }
      mockFetch.mockResolvedValue(mockResponse)

      await fetchRequestor.request({
        url: 'https://api.example.com/first',
        method: 'POST',
        data: { first: true }
      })

      await fetchRequestor.request({
        url: 'https://api.example.com/second',
        method: 'PUT',
        data: { second: true }
      })

      // 验证调用顺序和参数
      expect(mockFetch).toHaveBeenCalledTimes(2)
      
      const [firstCall, secondCall] = mockFetch.mock.calls
      
      expect(firstCall[0]).toBe('https://api.example.com/first')
      expect((firstCall[1] as RequestInit).method).toBe('POST')
      expect((firstCall[1] as RequestInit).body).toBe(JSON.stringify({ first: true }))
      
      expect(secondCall[0]).toBe('https://api.example.com/second')
      expect((secondCall[1] as RequestInit).method).toBe('PUT')
      expect((secondCall[1] as RequestInit).body).toBe(JSON.stringify({ second: true }))
    })
  })
})
