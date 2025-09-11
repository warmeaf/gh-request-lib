import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios, { AxiosError } from 'axios'
import { AxiosRequestor } from '../src/index'
import { RequestConfig, RequestError, RequestErrorType } from 'request-core'

// Mock console methods to avoid cluttering test output
const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

// Mock axios
vi.mock('axios', () => ({
  default: {
    request: vi.fn(),
    isAxiosError: vi.fn(),
  },
}))

const mockedAxios = axios as any

describe('AxiosRequestor - Error Handling', () => {
  let axiosRequestor: AxiosRequestor

  beforeEach(() => {
    axiosRequestor = new AxiosRequestor()
    vi.clearAllMocks()
    mockConsoleLog.mockClear()
    mockConsoleError.mockClear()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('HTTP 错误处理', () => {
    it('应该正确处理 HTTP 4xx 错误', async () => {
      const axiosError = new Error(
        'Request failed with status code 404'
      ) as AxiosError
      axiosError.response = {
        status: 404,
        statusText: 'Not Found',
        data: null,
        headers: {},
        config: {} as any,
      }
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/nonexistent',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).status).toBe(404)
        expect((error as RequestError).type).toBe(RequestErrorType.HTTP_ERROR)
        expect((error as RequestError).message).toContain('HTTP 404')
      }
    })

    it('应该正确处理 HTTP 5xx 错误', async () => {
      const axiosError = new Error(
        'Request failed with status code 500'
      ) as AxiosError
      axiosError.response = {
        status: 500,
        statusText: 'Internal Server Error',
        data: null,
        headers: {},
        config: {} as any,
      }
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/error',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).status).toBe(500)
        expect((error as RequestError).type).toBe(RequestErrorType.HTTP_ERROR)
        expect((error as RequestError).message).toContain('HTTP 500')
      }
    })

    it('应该正确处理没有 statusText 的错误响应', async () => {
      const axiosError = new Error('Request failed') as AxiosError
      axiosError.response = {
        status: 400,
        statusText: undefined as any,
        data: null,
        headers: {},
        config: {} as any,
      }
      axiosError.config = {} as any
      axiosError.isAxiosError = true
      axiosError.message = 'Bad Request'

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/bad',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toContain(
          'HTTP 400: Bad Request'
        )
      }
    })
  })

  describe('网络错误处理', () => {
    it('应该正确处理网络错误', async () => {
      const axiosError = new Error('Network Error') as AxiosError
      axiosError.config = {} as any
      axiosError.isAxiosError = true
      // 没有 response 属性表示网络错误

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(
          RequestErrorType.NETWORK_ERROR
        )
        expect((error as RequestError).message).toBe('Network Error')
        expect((error as RequestError).originalError).toBe(axiosError)
      }
    })
  })

  describe('超时和取消错误处理', () => {
    it('应该正确处理 ECONNABORTED 超时错误', async () => {
      const axiosError = new Error(
        'timeout of 1000ms exceeded'
      ) as AxiosError & { code: string }
      axiosError.code = 'ECONNABORTED'
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/slow',
        method: 'GET',
        timeout: 1000,
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(
          RequestErrorType.TIMEOUT_ERROR
        )
        expect((error as RequestError).message).toContain(
          'Request timeout after 1000ms'
        )
      }
    })

    it('应该正确处理 ERR_CANCELED 取消错误', async () => {
      const axiosError = new Error('canceled') as AxiosError & { code: string }
      axiosError.code = 'ERR_CANCELED'
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(
          RequestErrorType.TIMEOUT_ERROR
        )
        expect((error as RequestError).message).toBe('Request aborted')
      }
    })

    it('应该正确处理 CanceledError', async () => {
      const axiosError = new Error('Request canceled') as AxiosError
      axiosError.name = 'CanceledError'
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(
          RequestErrorType.TIMEOUT_ERROR
        )
        expect((error as RequestError).message).toBe('Request aborted')
      }
    })

    it('应该区分超时和手动取消', async () => {
      // 模拟超时情况
      vi.useFakeTimers()

      const axiosError = new Error('canceled') as AxiosError & { code: string }
      axiosError.code = 'ERR_CANCELED'
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      let resolveRequest: (value: any) => void
      const requestPromise = new Promise((resolve) => {
        resolveRequest = resolve
      })

      mockedAxios.request.mockReturnValue(requestPromise)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/slow',
        method: 'GET',
        timeout: 1000,
      }

      const requestPromiseResult = axiosRequestor.request(config)

      // 模拟超时
      vi.advanceTimersByTime(1500)

      // 然后让 axios 抛出取消错误
      resolveRequest!(Promise.reject(axiosError))

      await expect(requestPromiseResult).rejects.toThrow(RequestError)

      try {
        await requestPromiseResult
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(
          RequestErrorType.TIMEOUT_ERROR
        )
        expect((error as RequestError).message).toContain(
          'Request timeout after 1000ms'
        )
      }

      vi.useRealTimers()
    })
  })

  describe('错误类型保持', () => {
    it('应该保持已存在的 RequestError', async () => {
      const existingError = new RequestError('Custom error', {
        type: RequestErrorType.VALIDATION_ERROR,
        status: 400,
      })
      mockedAxios.request.mockRejectedValue(existingError)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(
        existingError
      )
    })

    it('应该包装非 Axios 错误', async () => {
      const unknownError = { message: 'Unknown error', type: 'weird' }
      mockedAxios.request.mockRejectedValue(unknownError)
      mockedAxios.isAxiosError.mockReturnValue(false)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).originalError).toBe(unknownError)
      }
    })

    it('应该正确处理非 AxiosError 的普通错误', async () => {
      const normalError = new Error('Regular error')
      mockedAxios.request.mockRejectedValue(normalError)
      mockedAxios.isAxiosError.mockReturnValue(false)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).originalError).toBe(normalError)
      }
    })
  })

  describe('超时控制器清理', () => {
    it('应该在成功时清理超时定时器', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        timeout: 5000,
      }

      await axiosRequestor.request(config)

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    it('应该在错误时清理超时定时器', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const axiosError = new Error('Network Error') as AxiosError
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        timeout: 5000,
      }

      try {
        await axiosRequestor.request(config)
      } catch {
        // 预期的错误
      }

      expect(clearTimeoutSpy).toHaveBeenCalled()
    })
  })

  describe('日志记录', () => {
    it('应该记录请求开始日志', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await axiosRequestor.request(config)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[AxiosRequestor] Sending request')
      )
    })

    it('应该记录请求成功日志', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await axiosRequestor.request(config)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining(
          '[AxiosRequestor] Request completed successfully'
        )
      )
    })

    it('应该记录请求失败日志', async () => {
      const axiosError = new Error('Network Error') as AxiosError
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      try {
        await axiosRequestor.request(config)
      } catch {
        // 预期的错误
      }

      expect(mockConsoleError).toHaveBeenCalledWith(
        expect.stringContaining('[AxiosRequestor] Request failed')
      )
    })
  })

  describe('AbortController 集成', () => {
    let MockAbortController: any
    let originalAbortController: any

    beforeEach(() => {
      // 保存原始的 AbortController
      originalAbortController = global.AbortController

      // 创建模拟的 AbortController 类
      MockAbortController = class {
        signal = {
          aborted: false,
          addEventListener: vi.fn(),
          removeEventListener: vi.fn(),
          dispatchEvent: vi.fn(),
          onabort: null,
          reason: undefined,
          throwIfAborted: vi.fn(),
        }
        abort = vi.fn(() => {
          Object.assign(this.signal, { aborted: true })
        })
      }

      // 强制使用模拟的 AbortController
      global.AbortController = MockAbortController as any
    })

    afterEach(() => {
      // 恢复原始的 AbortController
      global.AbortController = originalAbortController
    })

    it('应该正确使用 AbortController', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await axiosRequestor.request(config)

      const axiosCall = mockedAxios.request.mock.calls[0][0]
      expect(axiosCall.signal).toBeDefined()
      expect(axiosCall.signal.aborted).toBe(false)
    })

    it('应该正确合并外部信号', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const externalController = new AbortController()
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        signal: externalController.signal,
      }

      await axiosRequestor.request(config)

      expect(externalController.signal.addEventListener).toHaveBeenCalledWith(
        'abort',
        expect.any(Function)
      )
    })

    it('应该处理预先中止的外部信号', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const externalController = new AbortController()
      externalController.abort()

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        signal: externalController.signal,
      }

      await axiosRequestor.request(config)

      const axiosCall = mockedAxios.request.mock.calls[0][0]
      expect(axiosCall.signal).toBeDefined()
    })
  })

  describe('并发错误处理', () => {
    it('应该正确处理并发请求的超时错误', async () => {
      vi.useFakeTimers()

      const timeoutError = new Error('timeout') as AxiosError & { code: string }
      timeoutError.code = 'ECONNABORTED'
      timeoutError.config = {} as any
      timeoutError.isAxiosError = true

      mockedAxios.request
        .mockResolvedValueOnce({ data: { id: 1 } }) // 第一个请求成功
        .mockRejectedValueOnce(timeoutError) // 第二个请求超时
        .mockRejectedValueOnce(timeoutError) // 第三个请求超时
      mockedAxios.isAxiosError.mockReturnValue(true)

      const promises = [
        axiosRequestor.request({
          url: 'https://api.example.com/fast',
          method: 'GET',
          timeout: 5000,
        }),
        axiosRequestor.request({
          url: 'https://api.example.com/slow1',
          method: 'GET',
          timeout: 1000,
        }),
        axiosRequestor.request({
          url: 'https://api.example.com/slow2',
          method: 'GET',
          timeout: 1000,
        }),
      ]

      vi.advanceTimersByTime(2000)

      const results = await Promise.allSettled(promises)

      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
      expect(results[2].status).toBe('rejected')

      if (results[1].status === 'rejected') {
        expect(results[1].reason).toBeInstanceOf(RequestError)
        expect((results[1].reason as RequestError).type).toBe(
          RequestErrorType.TIMEOUT_ERROR
        )
      }

      vi.useRealTimers()
    })

    it('应该正确处理大量并发请求的各种错误', async () => {
      const errors = [
        // 网络错误
        (() => {
          const error = new Error('Network Error') as AxiosError
          error.config = {} as any
          error.isAxiosError = true
          return error
        })(),
        // HTTP 404错误
        (() => {
          const error = new Error('Not Found') as AxiosError
          error.response = {
            status: 404,
            statusText: 'Not Found',
            data: null,
            headers: {},
            config: {} as any,
          }
          error.config = {} as any
          error.isAxiosError = true
          return error
        })(),
        // 超时错误
        (() => {
          const error = new Error('timeout') as AxiosError & { code: string }
          error.code = 'ECONNABORTED'
          error.config = {} as any
          error.isAxiosError = true
          return error
        })(),
      ]

      // 设置50个并发请求，其中一些成功，一些失败
      for (let i = 0; i < 25; i++) {
        mockedAxios.request.mockResolvedValueOnce({ data: { id: i } })
      }
      for (let i = 0; i < 25; i++) {
        mockedAxios.request.mockRejectedValueOnce(errors[i % 3])
      }
      mockedAxios.isAxiosError.mockReturnValue(true)

      const promises: Promise<any>[] = []
      for (let i = 0; i < 50; i++) {
        promises.push(
          axiosRequestor.request({
            url: `https://api.example.com/item/${i}`,
            method: 'GET',
          })
        )
      }

      const results = await Promise.allSettled(promises)

      const fulfilled = results.filter((r) => r.status === 'fulfilled')
      const rejected = results.filter((r) => r.status === 'rejected')

      expect(fulfilled.length).toBe(25)
      expect(rejected.length).toBe(25)

      // 验证错误类型分布
      let networkErrors = 0
      let httpErrors = 0
      let timeoutErrors = 0

      rejected.forEach((result) => {
        if (result.status === 'rejected') {
          const error = result.reason as RequestError
          expect(error).toBeInstanceOf(RequestError)
          if (error.type === RequestErrorType.NETWORK_ERROR) networkErrors++
          else if (error.type === RequestErrorType.HTTP_ERROR) httpErrors++
          else if (error.type === RequestErrorType.TIMEOUT_ERROR)
            timeoutErrors++
        }
      })

      expect(networkErrors + httpErrors + timeoutErrors).toBe(25)
    })
  })

  describe('边界值错误处理', () => {
    it('应该正确处理极长错误消息', async () => {
      const longMessage = 'Error: ' + 'x'.repeat(10000)
      const axiosError = new Error(longMessage) as AxiosError
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toContain('x'.repeat(100)) // 至少包含部分长消息
        expect((error as RequestError).originalError).toBe(axiosError)
      }
    })

    it('应该正确处理非标准状态码', async () => {
      const axiosError = new Error('Weird status') as AxiosError
      axiosError.response = {
        status: 999, // 非标准状态码
        statusText: 'Unknown Status',
        data: null,
        headers: {},
        config: {} as any,
      }
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).status).toBe(999)
        expect((error as RequestError).type).toBe(RequestErrorType.HTTP_ERROR)
        expect((error as RequestError).message).toContain('HTTP 999')
      }
    })

    it('应该正确处理空的错误对象', async () => {
      const emptyError = {} as AxiosError
      mockedAxios.request.mockRejectedValue(emptyError)
      mockedAxios.isAxiosError.mockReturnValue(false)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).originalError).toBe(emptyError)
      }
    })

    it('应该正确处理循环引用的错误对象', async () => {
      const circularError: any = { message: 'Circular error' }
      circularError.self = circularError // 创建循环引用

      mockedAxios.request.mockRejectedValue(circularError)
      mockedAxios.isAxiosError.mockReturnValue(false)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).originalError).toBe(circularError)
      }
    })

    it('应该正确处理undefined和null错误', async () => {
      // 测试 undefined
      mockedAxios.request.mockRejectedValueOnce(undefined)
      mockedAxios.isAxiosError.mockReturnValue(false)

      let config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      // 测试 null
      mockedAxios.request.mockRejectedValueOnce(null)

      await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)
    })
  })

  describe('错误恢复边界情况', () => {
    it('应该正确处理错误后的资源清理', async () => {
      const clearTimeoutSpy = vi.spyOn(global, 'clearTimeout')

      const axiosError = new Error('Network Error') as AxiosError
      axiosError.config = {} as any
      axiosError.isAxiosError = true

      mockedAxios.request.mockRejectedValue(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        timeout: 5000,
      }

      try {
        await axiosRequestor.request(config)
      } catch {
        // 预期的错误
      }

      // 验证清理工作正常进行
      expect(clearTimeoutSpy).toHaveBeenCalled()
    })

    it('应该正确处理极短时间内的连续错误恢复', async () => {
      const errors = [
        new Error('Error 1'),
        new Error('Error 2'),
        new Error('Error 3'),
      ]

      errors.forEach((error) => {
        ;(error as any).isAxiosError = true
        ;(error as any).config = {}
      })

      const successData = { message: 'finally success' }

      mockedAxios.request
        .mockRejectedValueOnce(errors[0])
        .mockRejectedValueOnce(errors[1])
        .mockRejectedValueOnce(errors[2])
        .mockResolvedValueOnce({ data: successData })
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
      }

      // 快速连续的错误和恢复
      const start = Date.now()

      await expect(axiosRequestor.request(config)).rejects.toThrow('Error 1')
      await expect(axiosRequestor.request(config)).rejects.toThrow('Error 2')
      await expect(axiosRequestor.request(config)).rejects.toThrow('Error 3')

      const result = await axiosRequestor.request(config)
      const duration = Date.now() - start

      expect(result).toEqual(successData)
      expect(duration).toBeLessThan(100) // 应该很快完成
    })
  })

  describe('信号处理边界情况', () => {
    it('应该处理外部信号监听器添加失败', async () => {
      const successData = { id: 1, name: 'test' }
      mockedAxios.request.mockResolvedValueOnce({ data: successData })

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
        throwIfAborted: vi.fn(),
      } as AbortSignal

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        signal: problematicSignal,
      }

      // 应该仍然能够处理请求，即使添加监听器失败
      const result = await axiosRequestor.request(config)
      expect(result).toEqual(successData)
    })

    it('应该处理循环引用的请求数据', async () => {
      // 模拟 axios 对循环引用的处理行为
      mockedAxios.request.mockRejectedValueOnce({
        isAxiosError: true,
        message: 'Converting circular structure to JSON',
        name: 'TypeError',
        response: undefined, // 没有响应，表示是请求准备阶段的错误
      })
      mockedAxios.isAxiosError.mockReturnValue(true)

      // 创建循环引用对象
      const circularData: any = { name: 'test' }
      circularData.self = circularData

      const config: RequestConfig = {
        url: 'https://api.example.com/circular',
        method: 'POST',
        data: circularData,
      }

      // 移除这一行重复的调用
      // await expect(axiosRequestor.request(config)).rejects.toThrow(RequestError)

      try {
        await axiosRequestor.request(config)
        // 如果没有抛出错误，强制让测试失败
        expect.fail('Expected request to throw an error')
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe('NETWORK_ERROR')
        // 现在这个断言将会成功
        expect((error as RequestError).message).toContain('circular')
      }
    })
  })
})
