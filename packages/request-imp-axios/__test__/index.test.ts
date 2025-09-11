import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import axios from 'axios'
import { AxiosRequestor } from '../src/index'
import { RequestConfig } from 'request-core'

// Mock axios
vi.mock('axios', () => ({
  default: {
    request: vi.fn(),
    isAxiosError: vi.fn()
  }
}))

const mockedAxios = axios as any

describe('AxiosRequestor', () => {
  let axiosRequestor: AxiosRequestor

  beforeEach(() => {
    axiosRequestor = new AxiosRequestor()
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.resetAllMocks()
  })

  describe('基本 HTTP 方法', () => {
    it('应该发送 GET 请求', async () => {
      const mockData = { message: 'success' }
      mockedAxios.request.mockResolvedValue({
        data: mockData
      })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/users',
          method: 'GET',
          responseType: 'json',
          withCredentials: false,
          signal: expect.any(Object)
        })
      )
      expect(result).toEqual(mockData)
    })

    it('应该发送 POST 请求', async () => {
      const mockData = { id: 1 }
      mockedAxios.request.mockResolvedValue({
        data: mockData
      })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: { name: 'John', email: 'john@example.com' }
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/users',
          method: 'POST',
          data: { name: 'John', email: 'john@example.com' }
        })
      )
    })

    it('应该发送 PUT 请求', async () => {
      const mockData = { id: 1 }
      mockedAxios.request.mockResolvedValue({
        data: mockData
      })

      const config: RequestConfig = {
        url: 'https://api.example.com/users/1',
        method: 'PUT',
        data: { name: 'John Updated' }
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/users/1',
          method: 'PUT',
          data: { name: 'John Updated' }
        })
      )
    })

    it('应该发送 DELETE 请求', async () => {
      const mockData = ''
      mockedAxios.request.mockResolvedValue({
        data: mockData
      })

      const config: RequestConfig = {
        url: 'https://api.example.com/users/1',
        method: 'DELETE'
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/users/1',
          method: 'DELETE'
        })
      )
    })
  })

  describe('查询参数处理', () => {
    it('应该正确处理查询参数', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        params: {
          page: 1,
          limit: 10,
          status: 'active'
        }
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {
            page: 1,
            limit: 10,
            status: 'active'
          }
        })
      )
    })

    it('应该跳过 null 和 undefined 参数', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

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

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {
            page: 1,
            active: true
          }
        })
      )
    })

    it('应该处理空参数对象', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        params: {}
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {}
        })
      )
    })
  })

  describe('请求头处理', () => {
    it('应该正确传递自定义请求头', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {
          'Authorization': 'Bearer token123',
          'X-Custom-Header': 'custom-value'
        }
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Authorization': 'Bearer token123',
            'X-Custom-Header': 'custom-value'
          }
        })
      )
    })

    it('应该处理没有请求头的情况', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: undefined
        })
      )
    })
  })

  describe('请求体处理', () => {
    it('应该正确处理 JSON 数据', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const requestData = { name: 'John', email: 'john@example.com' }
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: requestData
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: requestData
        })
      )
    })

    it('应该正确处理 FormData', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const formData = new FormData()
      formData.append('name', 'John')
      formData.append('email', 'john@example.com')

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: formData
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: formData
        })
      )
    })

    it('应该正确处理字符串数据', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/raw',
        method: 'POST',
        data: 'raw string data'
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: 'raw string data'
        })
      )
    })

    it('应该处理 GET 请求的数据', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        data: { name: 'John' } // GET 请求中的 data 会被 axios 处理
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: { name: 'John' }
        })
      )
    })
  })

  describe('响应类型处理', () => {
    it('应该使用默认的 JSON 响应类型', async () => {
      mockedAxios.request.mockResolvedValue({ data: { message: 'success' } })

      const config: RequestConfig = {
        url: 'https://api.example.com/data',
        method: 'GET'
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          responseType: 'json'
        })
      )
    })

    it('应该使用指定的响应类型', async () => {
      mockedAxios.request.mockResolvedValue({ data: 'plain text' })

      const config: RequestConfig = {
        url: 'https://api.example.com/text',
        method: 'GET',
        responseType: 'text'
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          responseType: 'text'
        })
      )
    })

    it('应该正确返回响应数据', async () => {
      const mockData = { id: 123, message: 'success' }
      mockedAxios.request.mockResolvedValue({
        data: mockData,
        status: 200,
        statusText: 'OK'
      })

      const config: RequestConfig = {
        url: 'https://api.example.com/data',
        method: 'GET'
      }

      const result = await axiosRequestor.request(config)

      expect(result).toEqual(mockData)
    })
  })

  describe('超时和取消信号', () => {
    it('应该设置默认超时', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(Object)
        })
      )
    })

    it('应该使用自定义超时', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        timeout: 5000
      }

      await axiosRequestor.request(config)

      // axios 使用 AbortController 而非 timeout 选项
      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(Object)
        })
      )
    })

    it('应该处理外部取消信号', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const externalController = new AbortController()
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        signal: externalController.signal
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(Object)
        })
      )
    })

    it('应该处理预先取消的外部信号', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const externalController = new AbortController()
      externalController.abort()

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        signal: externalController.signal
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(Object)
        })
      )
    })
  })

  describe('Axios 特有配置', () => {
    it('应该设置 withCredentials 为 false', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          withCredentials: false
        })
      )
    })

    it('应该使用 AbortController 信号', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      await axiosRequestor.request(config)

      const axiosCall = mockedAxios.request.mock.calls[0][0]
      expect(axiosCall.signal).toBeDefined()
      expect(axiosCall.signal).toHaveProperty('aborted')
    })
  })

  describe('日志记录', () => {
    const mockConsoleLog = vi.spyOn(console, 'log').mockImplementation(() => {})
    const mockConsoleError = vi.spyOn(console, 'error').mockImplementation(() => {})

    beforeEach(() => {
      mockConsoleLog.mockClear()
      mockConsoleError.mockClear()
    })

    it('应该记录请求开始日志', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
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
        method: 'GET'
      }

      await axiosRequestor.request(config)

      expect(mockConsoleLog).toHaveBeenCalledWith(
        expect.stringContaining('[AxiosRequestor] Request completed successfully')
      )
    })
  })

  describe('并发场景测试', () => {
    it('应该正确处理并发请求', async () => {
      const mockData1 = { id: 1, name: 'User 1' }
      const mockData2 = { id: 2, name: 'User 2' }
      const mockData3 = { id: 3, name: 'User 3' }

      mockedAxios.request
        .mockResolvedValueOnce({ data: mockData1 })
        .mockResolvedValueOnce({ data: mockData2 })
        .mockResolvedValueOnce({ data: mockData3 })

      const config1: RequestConfig = {
        url: 'https://api.example.com/users/1',
        method: 'GET'
      }
      const config2: RequestConfig = {
        url: 'https://api.example.com/users/2',
        method: 'GET'
      }
      const config3: RequestConfig = {
        url: 'https://api.example.com/users/3',
        method: 'GET'
      }

      const [result1, result2, result3] = await Promise.all([
        axiosRequestor.request(config1),
        axiosRequestor.request(config2),
        axiosRequestor.request(config3)
      ])

      expect(result1).toEqual(mockData1)
      expect(result2).toEqual(mockData2)
      expect(result3).toEqual(mockData3)
      expect(mockedAxios.request).toHaveBeenCalledTimes(3)
    })

    it('应该正确处理并发请求中的部分失败', async () => {
      const mockData1 = { id: 1, name: 'User 1' }
      const mockData3 = { id: 3, name: 'User 3' }
      const axiosError = new Error('Network Error') as any
      axiosError.isAxiosError = true
      axiosError.config = {}

      mockedAxios.request
        .mockResolvedValueOnce({ data: mockData1 })
        .mockRejectedValueOnce(axiosError)
        .mockResolvedValueOnce({ data: mockData3 })
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config1: RequestConfig = {
        url: 'https://api.example.com/users/1',
        method: 'GET'
      }
      const config2: RequestConfig = {
        url: 'https://api.example.com/users/2',
        method: 'GET'
      }
      const config3: RequestConfig = {
        url: 'https://api.example.com/users/3',
        method: 'GET'
      }

      const results = await Promise.allSettled([
        axiosRequestor.request(config1),
        axiosRequestor.request(config2),
        axiosRequestor.request(config3)
      ])

      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
      expect(results[2].status).toBe('fulfilled')
      
      if (results[0].status === 'fulfilled') {
        expect(results[0].value).toEqual(mockData1)
      }
      if (results[2].status === 'fulfilled') {
        expect(results[2].value).toEqual(mockData3)
      }
    })

    it('应该正确处理并发请求的取消', async () => {
      const controller1 = new AbortController()
      const controller2 = new AbortController()
      
      const axiosError = new Error('canceled') as any
      axiosError.code = 'ERR_CANCELED'
      axiosError.isAxiosError = true
      axiosError.config = {}

      mockedAxios.request
        .mockResolvedValueOnce({ data: { id: 1 } })
        .mockRejectedValueOnce(axiosError)
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config1: RequestConfig = {
        url: 'https://api.example.com/users/1',
        method: 'GET',
        signal: controller1.signal
      }
      const config2: RequestConfig = {
        url: 'https://api.example.com/users/2',
        method: 'GET',
        signal: controller2.signal
      }

      // 启动并发请求
      const promise1 = axiosRequestor.request(config1)
      const promise2 = axiosRequestor.request(config2)

      // 取消第二个请求
      controller2.abort()

      const results = await Promise.allSettled([promise1, promise2])

      expect(results[0].status).toBe('fulfilled')
      expect(results[1].status).toBe('rejected')
    })
  })

  describe('边界值测试', () => {
    it('应该处理极大的超时值', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        timeout: Number.MAX_SAFE_INTEGER
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(Object)
        })
      )
    })

    it('应该处理极小的超时值', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        timeout: 1
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          signal: expect.any(Object)
        })
      )
    })

    it('应该处理特殊字符在URL中', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users/测试用户?name=张三&age=25',
        method: 'GET'
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/users/测试用户?name=张三&age=25'
        })
      )
    })

    it('应该处理特殊字符在参数中', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        params: {
          name: '张三@#$%^&*()',
          description: 'Line1\nLine2\tTab',
          emoji: '🚀🎉✨',
          html: '<script>alert("test")</script>'
        }
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: {
            name: '张三@#$%^&*()',
            description: 'Line1\nLine2\tTab',
            emoji: '🚀🎉✨',
            html: '<script>alert("test")</script>'
          }
        })
      )
    })

    it('应该处理空字符串参数', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const config: RequestConfig = {
        url: '',
        method: 'GET',
        params: {
          emptyString: '',
          whitespace: '   ',
          zero: 0,
          false: false
        }
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: '',
          params: {
            emptyString: '',
            whitespace: '   ',
            zero: 0,
            false: false
          }
        })
      )
    })

    it('应该处理非常长的URL', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const longPath = 'a'.repeat(2000)
      const config: RequestConfig = {
        url: `https://api.example.com/${longPath}`,
        method: 'GET'
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `https://api.example.com/${longPath}`
        })
      )
    })

    it('应该处理大量参数', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const manyParams: Record<string, string | number> = {}
      for (let i = 0; i < 100; i++) {
        manyParams[`param${i}`] = `value${i}`
      }

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        params: manyParams
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          params: manyParams
        })
      )
    })

    it('应该处理极大的请求体', async () => {
      mockedAxios.request.mockResolvedValue({ data: {} })

      const largeData = {
        content: 'x'.repeat(1000000), // 1MB 的数据
        array: Array(10000).fill(0).map((_, i) => ({ id: i, value: `item${i}` }))
      }

      const config: RequestConfig = {
        url: 'https://api.example.com/upload',
        method: 'POST',
        data: largeData
      }

      await axiosRequestor.request(config)

      expect(mockedAxios.request).toHaveBeenCalledWith(
        expect.objectContaining({
          data: largeData
        })
      )
    })
  })

  describe('错误恢复测试', () => {
    it('应该在网络恢复后能正常发送请求', async () => {
      const networkError = new Error('Network Error') as any
      networkError.isAxiosError = true
      networkError.config = {}

      const successData = { message: 'success' }

      // 第一次请求失败，第二次成功
      mockedAxios.request
        .mockRejectedValueOnce(networkError)
        .mockResolvedValueOnce({ data: successData })
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      // 第一次请求应该失败
      await expect(axiosRequestor.request(config)).rejects.toThrow()

      // 第二次请求应该成功
      const result = await axiosRequestor.request(config)
      expect(result).toEqual(successData)
    })

    it('应该正确处理从超时错误中恢复', async () => {
      const timeoutError = new Error('timeout') as any
      timeoutError.code = 'ECONNABORTED'
      timeoutError.isAxiosError = true
      timeoutError.config = {}

      const successData = { message: 'success' }

      mockedAxios.request
        .mockRejectedValueOnce(timeoutError)
        .mockResolvedValueOnce({ data: successData })
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/slow',
        method: 'GET',
        timeout: 1000
      }

      // 第一次超时
      await expect(axiosRequestor.request(config)).rejects.toThrow()

      // 第二次成功
      const result = await axiosRequestor.request(config)
      expect(result).toEqual(successData)
    })

    it('应该正确处理从HTTP错误中恢复', async () => {
      const httpError = new Error('Server Error') as any
      httpError.response = {
        status: 500,
        statusText: 'Internal Server Error',
        data: null,
        headers: {},
        config: {}
      }
      httpError.isAxiosError = true
      httpError.config = {}

      const successData = { message: 'success' }

      mockedAxios.request
        .mockRejectedValueOnce(httpError)
        .mockResolvedValueOnce({ data: successData })
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      // 第一次服务器错误
      await expect(axiosRequestor.request(config)).rejects.toThrow()

      // 第二次成功
      const result = await axiosRequestor.request(config)
      expect(result).toEqual(successData)
    })

    it('应该在取消错误后能正常发送新请求', async () => {
      const cancelError = new Error('canceled') as any
      cancelError.code = 'ERR_CANCELED'
      cancelError.isAxiosError = true
      cancelError.config = {}

      const successData = { message: 'success' }

      mockedAxios.request
        .mockRejectedValueOnce(cancelError)
        .mockResolvedValueOnce({ data: successData })
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      // 第一次被取消
      await expect(axiosRequestor.request(config)).rejects.toThrow()

      // 第二次成功
      const result = await axiosRequestor.request(config)
      expect(result).toEqual(successData)
    })

    it('应该正确处理连续的错误和恢复', async () => {
      const networkError = new Error('Network Error') as any
      networkError.isAxiosError = true
      networkError.config = {}

      const httpError = new Error('Server Error') as any
      httpError.response = {
        status: 503,
        statusText: 'Service Unavailable',
        data: null,
        headers: {},
        config: {}
      }
      httpError.isAxiosError = true
      httpError.config = {}

      const successData = { message: 'finally success' }

      mockedAxios.request
        .mockRejectedValueOnce(networkError)
        .mockRejectedValueOnce(httpError)
        .mockResolvedValueOnce({ data: successData })
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      // 第一次网络错误
      await expect(axiosRequestor.request(config)).rejects.toThrow('Network Error')

      // 第二次服务器错误
      await expect(axiosRequestor.request(config)).rejects.toThrow()

      // 第三次成功
      const result = await axiosRequestor.request(config)
      expect(result).toEqual(successData)
    })

    it('应该在实例重用时保持状态独立', async () => {
      const error1 = new Error('Error for config 1') as any
      error1.isAxiosError = true
      error1.config = {}

      const success1 = { id: 1, message: 'success 1' }
      const success2 = { id: 2, message: 'success 2' }

      mockedAxios.request
        .mockRejectedValueOnce(error1) // config1 第一次失败
        .mockResolvedValueOnce({ data: success2 }) // config2 成功
        .mockResolvedValueOnce({ data: success1 }) // config1 第二次成功
      mockedAxios.isAxiosError.mockReturnValue(true)

      const config1: RequestConfig = {
        url: 'https://api.example.com/users/1',
        method: 'GET'
      }

      const config2: RequestConfig = {
        url: 'https://api.example.com/users/2',
        method: 'GET'
      }

      // config1 第一次失败
      await expect(axiosRequestor.request(config1)).rejects.toThrow()

      // config2 成功（不受 config1 失败影响）
      const result2 = await axiosRequestor.request(config2)
      expect(result2).toEqual(success2)

      // config1 第二次成功（从错误中恢复）
      const result1 = await axiosRequestor.request(config1)
      expect(result1).toEqual(success1)
    })
  })

  describe('默认实例', () => {
    it('应该导出默认实例', async () => {
      const { axiosRequestor: defaultInstance } = await import('../src/index')
      expect(defaultInstance).toBeInstanceOf(AxiosRequestor)
    })
  })
})
