import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { 
  RequestConfig, 
  RequestError, 
  RequestErrorType, 
  GlobalConfig,
  RequestInterceptor
} from '../../src/interface'
import { MockRequestor, TEST_URLS, MOCK_RESPONSES, TEST_CONFIGS } from '../test-helpers'

describe('RequestCore - 基础功能', () => {
  let mockRequestor: MockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new MockRequestor()
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (requestCore) {
      requestCore.destroy()
    }
  })

  describe('构造函数和初始化', () => {
    it('应该使用基本参数正确初始化', () => {
      requestCore = new RequestCore(mockRequestor)

      expect(requestCore).toBeInstanceOf(RequestCore)
      expect(typeof requestCore.request).toBe('function')
      expect(typeof requestCore.setGlobalConfig).toBe('function')
      expect(typeof requestCore.addInterceptor).toBe('function')
    })

    it('应该接受全局配置并正确初始化', () => {
      const globalConfig: GlobalConfig = {
        baseURL: TEST_URLS.API_BASE,
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' },
        debug: true,
        retries: 3,
        cacheEnabled: true
      }

      requestCore = new RequestCore(mockRequestor, globalConfig)
      const retrievedConfig = requestCore.getGlobalConfig()

      expect(retrievedConfig.baseURL).toBe(globalConfig.baseURL)
      expect(retrievedConfig.timeout).toBe(globalConfig.timeout)
      expect(retrievedConfig.headers).toEqual(globalConfig.headers)
      expect(retrievedConfig.debug).toBe(globalConfig.debug)
      expect(retrievedConfig.retries).toBe(globalConfig.retries)
      expect(retrievedConfig.cacheEnabled).toBe(globalConfig.cacheEnabled)
    })

    it('应该接受带有拦截器的全局配置', () => {
      const interceptor1: RequestInterceptor = {
        onRequest: vi.fn(config => config)
      }
      
      const interceptor2: RequestInterceptor = {
        onResponse: vi.fn(response => response)
      }

      const globalConfig: GlobalConfig = {
        baseURL: TEST_URLS.API_BASE,
        interceptors: [interceptor1, interceptor2]
      }

      requestCore = new RequestCore(mockRequestor, globalConfig)
      const interceptors = requestCore.getInterceptors()

      expect(interceptors).toHaveLength(2)
      expect(interceptors[0]).toBe(interceptor1)
      expect(interceptors[1]).toBe(interceptor2)
    })

    it('应该在没有全局配置时使用默认值', () => {
      requestCore = new RequestCore(mockRequestor)
      const config = requestCore.getGlobalConfig()

      expect(config).toBeDefined()
      expect(requestCore.getInterceptors()).toHaveLength(0)
    })
  })

  describe('基础请求方法', () => {
    beforeEach(() => {
      requestCore = new RequestCore(mockRequestor)
    })

    it('应该成功执行基本请求', async () => {
      mockRequestor.getMock().mockResolvedValue(MOCK_RESPONSES.USER)

      const result = await requestCore.request(TEST_CONFIGS.BASIC_GET)

      expect(result).toEqual(MOCK_RESPONSES.USER)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: TEST_URLS.USERS,
          method: 'GET'
        })
      )
    })

    it('应该传播请求错误', async () => {
      const requestError = new RequestError('Network failed', {
        type: RequestErrorType.NETWORK_ERROR
      })
      mockRequestor.getMock().mockRejectedValue(requestError)

      await expect(requestCore.request(TEST_CONFIGS.BASIC_GET))
        .rejects.toThrow(requestError)
    })

    it('应该将普通错误包装为 RequestError', async () => {
      const normalError = new Error('Normal error')
      mockRequestor.getMock().mockRejectedValue(normalError)

      try {
        await requestCore.request(TEST_CONFIGS.BASIC_GET)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Normal error')
      }
    })

    it('应该处理非 Error 类型的异常', async () => {
      mockRequestor.getMock().mockRejectedValue('String error')

      try {
        await requestCore.request(TEST_CONFIGS.BASIC_GET)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).message).toBe('Unknown error')
      }
    })
  })

  describe('全局配置管理', () => {
    beforeEach(() => {
      requestCore = new RequestCore(mockRequestor)
    })

    it('应该设置和获取全局配置', () => {
      const globalConfig: GlobalConfig = {
        baseURL: TEST_URLS.API_BASE,
        timeout: 10000,
        headers: { 'Authorization': 'Bearer token' },
        debug: true,
        retries: 5,
        cacheEnabled: false
      }

      requestCore.setGlobalConfig(globalConfig)
      const retrievedConfig = requestCore.getGlobalConfig()

      expect(retrievedConfig.baseURL).toBe(globalConfig.baseURL)
      expect(retrievedConfig.timeout).toBe(globalConfig.timeout)
      expect(retrievedConfig.headers).toEqual(globalConfig.headers)
      expect(retrievedConfig.debug).toBe(globalConfig.debug)
      expect(retrievedConfig.retries).toBe(globalConfig.retries)
      expect(retrievedConfig.cacheEnabled).toBe(globalConfig.cacheEnabled)
    })

    it('应该使用全局配置处理拦截器', () => {
      const interceptor: RequestInterceptor = {
        onRequest: vi.fn(config => config)
      }

      const globalConfig: GlobalConfig = {
        baseURL: TEST_URLS.API_BASE,
        interceptors: [interceptor]
      }

      requestCore.setGlobalConfig(globalConfig)
      const interceptors = requestCore.getInterceptors()

      expect(interceptors).toHaveLength(1)
      expect(interceptors[0]).toBe(interceptor)
    })

    it('应该在重新设置配置时清除旧拦截器', () => {
      const interceptor1: RequestInterceptor = { onRequest: vi.fn() }
      const interceptor2: RequestInterceptor = { onResponse: vi.fn() }

      // 设置第一个配置
      requestCore.setGlobalConfig({
        baseURL: 'https://api1.example.com',
        interceptors: [interceptor1]
      })
      expect(requestCore.getInterceptors()).toHaveLength(1)

      // 设置第二个配置
      requestCore.setGlobalConfig({
        baseURL: 'https://api2.example.com',
        interceptors: [interceptor2]
      })
      
      const interceptors = requestCore.getInterceptors()
      expect(interceptors).toHaveLength(1)
      expect(interceptors[0]).toBe(interceptor2)
    })

    it('应该处理空的全局配置', () => {
      requestCore.setGlobalConfig({})
      const config = requestCore.getGlobalConfig()

      expect(config).toBeDefined()
    })
  })

  describe('ConvenienceExecutor 接口实现', () => {
    beforeEach(() => {
      requestCore = new RequestCore(mockRequestor)
    })

    it('应该通过 execute 方法委托到 request 方法', async () => {
      const mockResponse = { executed: true }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'POST',
        data: { test: 'data' }
      }

      const result = await requestCore.execute(config)

      expect(result).toEqual(mockResponse)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(config)
    })

    it('应该通过 execute 传播错误', async () => {
      const error = new RequestError('Execute error')
      mockRequestor.getMock().mockRejectedValue(error)

      const config: RequestConfig = {
        url: TEST_URLS.TEST,
        method: 'GET'
      }

      await expect(requestCore.execute(config)).rejects.toThrow(error)
    })
  })
})
