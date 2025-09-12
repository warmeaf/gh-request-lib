import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestBuilder, RequestConfig, RequestData, RequestParams, Requestor, RequestError, RequestErrorType } from '../../src/interface'

// Mock Requestor 实现
class MockRequestor implements Requestor {
  private mockFn = vi.fn()

  async request<T = unknown>(config: RequestConfig): Promise<T> {
    return this.mockFn(config)
  }

  getMock() {
    return this.mockFn
  }

  reset() {
    this.mockFn.mockReset()
  }
}

describe('RequestBuilder', () => {
  let mockRequestor: MockRequestor
  let requestCore: RequestCore
  let builder: RequestBuilder

  beforeEach(() => {
    mockRequestor = new MockRequestor()
    requestCore = new RequestCore(mockRequestor)
    builder = requestCore.create()
    vi.clearAllMocks()
  })

  describe('基本链式方法', () => {
    it('应该支持链式调用 url 方法', () => {
      const result = builder.url('https://api.example.com/users')

      expect(result).toBe(builder) // 返回自身以支持链式调用
      expect(result).toBeInstanceOf(Object)
    })

    it('应该支持链式调用 method 方法', () => {
      const result = builder.method('POST')

      expect(result).toBe(builder)
    })

    it('应该支持链式调用 data 方法', () => {
      const testData = { name: 'John', age: 30 }
      const result = builder.data(testData)

      expect(result).toBe(builder)
    })

    it('应该支持链式调用 params 方法', () => {
      const testParams = { page: 1, limit: 10 }
      const result = builder.params(testParams)

      expect(result).toBe(builder)
    })

    it('应该支持链式调用 headers 方法', () => {
      const testHeaders = { 'Content-Type': 'application/json' }
      const result = builder.headers(testHeaders)

      expect(result).toBe(builder)
    })

    it('应该支持完整的链式调用', () => {
      const result = builder
        .url('https://api.example.com/users')
        .method('POST')
        .data({ name: 'John' })
        .params({ page: 1 })
        .headers({ 'Content-Type': 'application/json' })

      expect(result).toBe(builder)
    })
  })

  describe('配置方法测试', () => {
    it('应该支持 header 单个设置', () => {
      const result = builder
        .header('Authorization', 'Bearer token123')
        .header('X-Custom', 'custom-value')

      expect(result).toBe(builder)
    })

    it('应该支持 timeout 设置', () => {
      const result = builder.timeout(5000)

      expect(result).toBe(builder)
    })

    it('应该支持 tag 设置', () => {
      const result = builder.tag('user-request')

      expect(result).toBe(builder)
    })

    it('应该支持 debug 设置', () => {
      const result1 = builder.debug(true)
      const result2 = builder.debug() // 默认为 true
      const result3 = builder.debug(false)

      expect(result1).toBe(builder)
      expect(result2).toBe(builder)
      expect(result3).toBe(builder)
    })
  })

  describe('响应类型方法', () => {
    it('应该支持 json 响应类型', () => {
      const result = builder.json<{ id: number }>()

      expect(result).toBeInstanceOf(Object)
      // 类型应该改变但仍是同一个构建器实例
    })

    it('应该支持 text 响应类型', () => {
      const result = builder.text()

      expect(result).toBeInstanceOf(Object)
    })

    it('应该支持 blob 响应类型', () => {
      const result = builder.blob()

      expect(result).toBeInstanceOf(Object)
    })

    it('应该支持 arrayBuffer 响应类型', () => {
      const result = builder.arrayBuffer()

      expect(result).toBeInstanceOf(Object)
    })

    it('应该支持响应类型链式调用', () => {
      const result = builder
        .url('https://api.example.com/file')
        .method('GET')
        .blob()

      expect(result).toBeInstanceOf(Object)
    })
  })

  describe('功能特性方法', () => {
    it('应该支持 retry 配置', () => {
      const result = builder.retry(3)

      expect(result).toBe(builder)
    })

    it('应该支持 cache 配置', () => {
      const result1 = builder.cache(60000) // 带TTL
      const result2 = builder.cache() // 不带TTL

      expect(result1).toBe(builder)
      expect(result2).toBe(builder)
    })

    it('应该支持功能特性链式调用', () => {
      const result = builder
        .url('https://api.example.com/data')
        .method('GET')
        .retry(3)
        .cache(30000)

      expect(result).toBe(builder)
    })
  })

  describe('参数累积测试', () => {
    it('应该正确累积 params 参数', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      await builder
        .url('https://api.example.com/test')
        .method('GET')
        .params({ page: 1 })
        .params({ limit: 10 })
        .params({ sort: 'name' })
        .send()

      const mockCall = mockRequestor.getMock().mock.calls[0][0]
      expect(mockCall.params).toEqual({
        page: 1,
        limit: 10,
        sort: 'name'
      })
    })

    it('应该正确累积 headers 参数', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      await builder
        .url('https://api.example.com/test')
        .method('POST')
        .headers({ 'Content-Type': 'application/json' })
        .headers({ 'Authorization': 'Bearer token' })
        .header('X-Custom', 'value')
        .send()

      const mockCall = mockRequestor.getMock().mock.calls[0][0]
      expect(mockCall.headers).toEqual({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
        'X-Custom': 'value'
      })
    })

    it('应该正确处理参数覆盖', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      await builder
        .url('https://api.example.com/test')
        .method('GET')
        .params({ page: 1 })
        .params({ page: 2, limit: 10 }) // page 应该被覆盖
        .send()

      const mockCall = mockRequestor.getMock().mock.calls[0][0]
      expect(mockCall.params).toEqual({
        page: 2,
        limit: 10
      })
    })
  })

  describe('send 方法执行测试', () => {
    it('应该成功发送基本请求', async () => {
      const mockResponse = { id: 1, name: 'John' }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const result = await builder
        .url('https://api.example.com/users')
        .method('GET')
        .send()

      expect(result).toEqual(mockResponse)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'GET'
      })
    })

    it('应该发送包含所有配置的完整请求', async () => {
      const mockResponse = { success: true }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const requestData = { name: 'John', email: 'john@example.com' }
      const requestParams = { include: 'profile' }
      const requestHeaders = { 'Content-Type': 'application/json' }

      await builder
        .url('https://api.example.com/users')
        .method('POST')
        .data(requestData)
        .params(requestParams)
        .headers(requestHeaders)
        .timeout(10000)
        .tag('create-user')
        .debug(true)
        .send()

      const mockCall = mockRequestor.getMock().mock.calls[0][0]
      expect(mockCall).toEqual({
        url: 'https://api.example.com/users',
        method: 'POST',
        data: requestData,
        params: requestParams,
        headers: requestHeaders,
        timeout: 10000,
        tag: 'create-user',
        debug: true
      })
    })

    it('应该默认使用 GET 方法', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      await builder
        .url('https://api.example.com/test')
        .send()

      const mockCall = mockRequestor.getMock().mock.calls[0][0]
      expect(mockCall.method).toBe('GET')
    })

    it('应该正确设置响应类型', async () => {
      mockRequestor.getMock().mockResolvedValue('text response')

      await builder
        .url('https://api.example.com/text')
        .method('GET')
        .text()
        .send()

      const mockCall = mockRequestor.getMock().mock.calls[0][0]
      expect(mockCall.responseType).toBe('text')
    })
  })

  describe('功能特性执行测试', () => {
    it('应该通过 requestWithRetry 执行重试请求', async () => {
      const mockResponse = { success: true }
      const requestWithRetrySpy = vi.spyOn(requestCore, 'requestWithRetry').mockResolvedValue(mockResponse)

      const result = await builder
        .url('https://api.example.com/test')
        .method('GET')
        .retry(3)
        .send()

      expect(result).toEqual(mockResponse)
      expect(requestWithRetrySpy).toHaveBeenCalledWith(
        {
          url: 'https://api.example.com/test',
          method: 'GET',
          metadata: { retryConfig: { retries: 3 } }
        },
        { retries: 3 }
      )

      requestWithRetrySpy.mockRestore()
    })

    it('应该通过 requestWithCache 执行缓存请求', async () => {
      const mockResponse = { data: 'cached' }
      const requestWithCacheSpy = vi.spyOn(requestCore, 'requestWithCache').mockResolvedValue(mockResponse)

      const result = await builder
        .url('https://api.example.com/test')
        .method('GET')
        .cache(60000)
        .send()

      expect(result).toEqual(mockResponse)
      expect(requestWithCacheSpy).toHaveBeenCalledWith(
        {
          url: 'https://api.example.com/test',
          method: 'GET',
          metadata: { cacheConfig: { ttl: 60000 } }
        },
        { ttl: 60000 }
      )

      requestWithCacheSpy.mockRestore()
    })

    it('应该优先使用重试功能（当同时配置重试和缓存时）', async () => {
      const mockResponse = { success: true }
      const requestWithRetrySpy = vi.spyOn(requestCore, 'requestWithRetry').mockResolvedValue(mockResponse)
      const requestWithCacheSpy = vi.spyOn(requestCore, 'requestWithCache')

      await builder
        .url('https://api.example.com/test')
        .method('GET')
        .retry(2)
        .cache(30000)
        .send()

      expect(requestWithRetrySpy).toHaveBeenCalled()
      expect(requestWithCacheSpy).not.toHaveBeenCalled()

      requestWithRetrySpy.mockRestore()
      requestWithCacheSpy.mockRestore()
    })

    it('应该支持无TTL的缓存配置', async () => {
      const mockResponse = { cached: true }
      const requestWithCacheSpy = vi.spyOn(requestCore, 'requestWithCache').mockResolvedValue(mockResponse)

      await builder
        .url('https://api.example.com/test')
        .method('GET')
        .cache() // 无TTL参数
        .send()

      expect(requestWithCacheSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          metadata: { cacheConfig: {} }
        }),
        {}
      )

      requestWithCacheSpy.mockRestore()
    })
  })

  describe('错误处理', () => {
    it('应该在没有URL时抛出验证错误', async () => {
      await expect(
        builder
          .method('GET')
          .send()
      ).rejects.toThrow(RequestError)

      await expect(
        builder
          .method('GET') 
          .send()
      ).rejects.toThrow('URL is required')

      try {
        await builder.method('GET').send()
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.VALIDATION_ERROR)
        expect((error as RequestError).code).toBe('BUILDER_NO_URL')
      }
    })

    it('应该传播底层请求错误', async () => {
      const originalError = new RequestError('Network failed', {
        type: RequestErrorType.NETWORK_ERROR
      })
      mockRequestor.getMock().mockRejectedValue(originalError)

      await expect(
        builder
          .url('https://api.example.com/test')
          .method('GET')
          .send()
      ).rejects.toThrow('Network failed')

      // 验证错误类型和属性
      try {
        await builder
          .url('https://api.example.com/test')
          .method('GET')
          .send()
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Network failed')
        expect((error as RequestError).type).toBe(RequestErrorType.NETWORK_ERROR)
      }
    })

    it('应该传播重试功能的错误', async () => {
      const retryError = new RequestError('Retry failed', {
        type: RequestErrorType.RETRY_ERROR
      })
      const requestWithRetrySpy = vi.spyOn(requestCore, 'requestWithRetry').mockRejectedValue(retryError)

      await expect(
        builder
          .url('https://api.example.com/test')
          .retry(3)
          .send()
      ).rejects.toThrow(retryError)

      requestWithRetrySpy.mockRestore()
    })

    it('应该传播缓存功能的错误', async () => {
      const cacheError = new RequestError('Cache failed', {
        type: RequestErrorType.CACHE_ERROR
      })
      const requestWithCacheSpy = vi.spyOn(requestCore, 'requestWithCache').mockRejectedValue(cacheError)

      await expect(
        builder
          .url('https://api.example.com/test')
          .cache(60000)
          .send()
      ).rejects.toThrow(cacheError)

      requestWithCacheSpy.mockRestore()
    })
  })

  describe('边界条件和特殊情况', () => {
    it('应该处理空字符串URL', async () => {
      await expect(
        builder
          .url('')
          .method('GET')
          .send()
      ).rejects.toThrow('URL is required')
    })

    it('应该处理各种数据类型', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      // 测试不同的数据类型
      const testCases: RequestData[] = [
        { object: 'data' },
        'string data',
        123,
        true,
        null,
        undefined,
        new FormData(),
        new URLSearchParams('key=value')
      ]

      for (const data of testCases) {
        await builder
          .url('https://api.example.com/test')
          .method('POST')
          .data(data)
          .send()

        const mockCall = mockRequestor.getMock().mock.calls[mockRequestor.getMock().mock.calls.length - 1][0]
        expect(mockCall.data).toBe(data)
      }
    })

    it('应该处理复杂的参数对象', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const complexParams: RequestParams = {
        string: 'test',
        number: 42,
        boolean: true,
        nullValue: null,
        undefinedValue: undefined
      }

      await builder
        .url('https://api.example.com/test')
        .params(complexParams)
        .send()

      const mockCall = mockRequestor.getMock().mock.calls[0][0]
      expect(mockCall.params).toEqual(complexParams)
    })

    it('应该处理所有HTTP方法', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const methods: RequestConfig['method'][] = [
        'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'
      ]

      for (const method of methods) {
        mockRequestor.reset()
        
        await builder
          .url('https://api.example.com/test')
          .method(method)
          .send()

        const mockCall = mockRequestor.getMock().mock.calls[0][0]
        expect(mockCall.method).toBe(method)
      }
    })

    it('应该处理所有响应类型', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const responseTypes: NonNullable<RequestConfig['responseType']>[] = [
        'json', 'text', 'blob', 'arraybuffer'
      ]

      for (const responseType of responseTypes) {
        mockRequestor.reset()
        
        const builderMethod = responseType === 'json' ? 'json' :
                             responseType === 'text' ? 'text' :
                             responseType === 'blob' ? 'blob' :
                             'arrayBuffer'

        await (builder as any)
          .url('https://api.example.com/test')
          [builderMethod]()
          .send()

        const mockCall = mockRequestor.getMock().mock.calls[0][0]
        expect(mockCall.responseType).toBe(responseType)
      }
    })

    it('应该处理大量链式调用', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const result = await builder
        .url('https://api.example.com/users')
        .method('POST')
        .data({ name: 'John', email: 'john@example.com' })
        .params({ include: 'profile,settings' })
        .params({ expand: 'permissions' })
        .headers({ 'Content-Type': 'application/json' })
        .headers({ 'Accept': 'application/json' })
        .header('Authorization', 'Bearer token123')
        .header('X-Request-ID', 'req-001')
        .timeout(30000)
        .tag('complex-request')
        .debug(true)
        .json<any>()
        .retry(3)
        .send()

      expect(result).toEqual({ success: true })
      
      const mockCall = mockRequestor.getMock().mock.calls[0][0]
      expect(mockCall.url).toBe('https://api.example.com/users')
      expect(mockCall.method).toBe('POST')
      expect(mockCall.data).toEqual({ name: 'John', email: 'john@example.com' })
      expect(mockCall.params).toEqual({ include: 'profile,settings', expand: 'permissions' })
      expect(mockCall.headers).toEqual({
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': 'Bearer token123',
        'X-Request-ID': 'req-001'
      })
      expect(mockCall.timeout).toBe(30000)
      expect(mockCall.tag).toBe('complex-request')
      expect(mockCall.debug).toBe(true)
      expect(mockCall.responseType).toBe('json')
    })
  })

  describe('构建器重用测试', () => {
    it('应该支持构建器实例重用', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      // 第一次使用
      await builder
        .url('https://api.example.com/test1')
        .method('GET')
        .send()

      // 第二次使用 - 配置应该累积
      await builder
        .url('https://api.example.com/test2')
        .method('POST')
        .data({ new: 'data' })
        .send()

      expect(mockRequestor.getMock()).toHaveBeenCalledTimes(2)

      const firstCall = mockRequestor.getMock().mock.calls[0][0]
      const secondCall = mockRequestor.getMock().mock.calls[1][0]

      expect(firstCall.url).toBe('https://api.example.com/test1')
      expect(firstCall.method).toBe('GET')

      expect(secondCall.url).toBe('https://api.example.com/test2')
      expect(secondCall.method).toBe('POST')
      expect(secondCall.data).toEqual({ new: 'data' })
    })

    it('应该独立处理不同构建器实例', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const builder1 = requestCore.create()
      const builder2 = requestCore.create()

      await builder1
        .url('https://api.example.com/builder1')
        .header('X-Builder', '1')
        .send()

      await builder2
        .url('https://api.example.com/builder2')
        .header('X-Builder', '2')
        .send()

      expect(mockRequestor.getMock()).toHaveBeenCalledTimes(2)

      const call1 = mockRequestor.getMock().mock.calls[0][0]
      const call2 = mockRequestor.getMock().mock.calls[1][0]

      expect(call1.url).toBe('https://api.example.com/builder1')
      expect(call1.headers?.['X-Builder']).toBe('1')

      expect(call2.url).toBe('https://api.example.com/builder2')
      expect(call2.headers?.['X-Builder']).toBe('2')
    })
  })
})
