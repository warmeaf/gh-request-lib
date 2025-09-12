import { describe, it, expect, vi } from 'vitest'
import {
  RequestConfig,
  RequestParams,
  RequestData,
  GlobalConfig,
  RestfulOptions,
  RequestInterceptor,
} from '../../src/interface'

// 测试辅助函数
const TestHelpers = {
  // 创建基本的RequestConfig
  createBasicConfig: (overrides: Partial<RequestConfig> = {}): RequestConfig => ({
    url: 'https://api.example.com/test',
    method: 'GET',
    ...overrides,
  }),
  
  // 创建完整的RequestConfig
  createFullConfig: (overrides: Partial<RequestConfig> = {}): RequestConfig => ({
    url: 'https://api.example.com/test',
    method: 'POST',
    data: { name: 'test' },
    params: { page: 1 },
    headers: { 'Content-Type': 'application/json' },
    timeout: 5000,
    responseType: 'json',
    debug: true,
    tag: 'test-request',
    metadata: { source: 'unit-test' },
    ...overrides,
  }),
  
  // Mock 回调函数
  createMockCallbacks: () => ({
    onStart: vi.fn(),
    onEnd: vi.fn(),
    onError: vi.fn(),
  }),
  
  // 创建异常回调函数
  createErrorCallbacks: () => ({
    onStart: vi.fn(() => { throw new Error('Start callback error') }),
    onEnd: vi.fn(() => { throw new Error('End callback error') }),
    onError: vi.fn(() => { throw new Error('Error callback error') }),
  }),
  
  // 创建配置合并场景
  createMergeScenarios: () => [
    {
      name: '全局配置优先级最低',
      global: { timeout: 10000, headers: { 'X-Global': 'global' } },
      restful: { timeout: 5000, headers: { 'X-Restful': 'restful' } },
      request: { timeout: 3000, headers: { 'X-Request': 'request' } },
      expected: {
        timeout: 3000,
        headers: {
          'X-Global': 'global',
          'X-Restful': 'restful', 
          'X-Request': 'request'
        }
      }
    },
    {
      name: 'RESTful覆盖全局',
      global: { baseURL: 'https://global.api.com', debug: true },
      restful: { baseURL: 'https://restful.api.com' },
      request: {},
      expected: {
        baseURL: 'https://restful.api.com',
        debug: true
      }
    }
  ],
}

describe('配置接口测试', () => {
  describe('RequestConfig', () => {
    it('应该支持最小配置', () => {
      const minimalConfig: RequestConfig = {
        url: 'https://api.example.com',
        method: 'GET',
      }

      expect(minimalConfig.url).toBe('https://api.example.com')
      expect(minimalConfig.method).toBe('GET')
      expect(minimalConfig.data).toBeUndefined()
      expect(minimalConfig.params).toBeUndefined()
      expect(minimalConfig.headers).toBeUndefined()
      expect(minimalConfig.timeout).toBeUndefined()
    })

    it('应该支持完整的请求配置', () => {
      const callbacks = TestHelpers.createMockCallbacks()
      const config = TestHelpers.createFullConfig({
        onStart: callbacks.onStart,
        onEnd: callbacks.onEnd,
        onError: callbacks.onError,
      })

      // 验证基本配置
      expect(config.url).toBe('https://api.example.com/test')
      expect(config.method).toBe('POST')
      expect(config.data).toEqual({ name: 'test' })
      expect(config.params?.page).toBe(1)
      expect(config.headers?.['Content-Type']).toBe('application/json')
      expect(config.timeout).toBe(5000)
      expect(config.responseType).toBe('json')
      expect(config.debug).toBe(true)
      expect(config.tag).toBe('test-request')
      expect(config.metadata?.source).toBe('unit-test')
    })

    it('应该正确执行回调函数', () => {
      const callbacks = TestHelpers.createMockCallbacks()
      const config = TestHelpers.createBasicConfig(callbacks)

      // 测试回调函数执行
      config.onStart?.(config)
      config.onEnd?.(config, 1000)
      config.onError?.(config, new Error('test'), 1000)

      expect(callbacks.onStart).toHaveBeenCalledWith(config)
      expect(callbacks.onEnd).toHaveBeenCalledWith(config, 1000)
      expect(callbacks.onError).toHaveBeenCalledWith(config, expect.any(Error), 1000)
    })

    it('应该支持所有HTTP方法', () => {
      const methods: RequestConfig['method'][] = [
        'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'
      ]

      methods.forEach((method) => {
        const config = TestHelpers.createBasicConfig({ method })
        expect(config.method).toBe(method)
      })
    })

    it('应该支持所有响应类型', () => {
      const responseTypes: RequestConfig['responseType'][] = [
        'json', 'text', 'blob', 'arraybuffer'
      ]

      responseTypes.forEach((responseType) => {
        const config = TestHelpers.createBasicConfig({ responseType })
        expect(config.responseType).toBe(responseType)
      })
    })

    it('应该支持复杂的请求数据', () => {
      const complexData = {
        user: { id: 1, name: 'John' },
        files: ['file1.txt', 'file2.pdf'],
        metadata: { version: '1.0', timestamp: Date.now() },
        settings: {
          theme: 'dark',
          lang: 'zh-CN',
          features: {
            notifications: true,
            autoSave: false,
          }
        }
      }

      const config = TestHelpers.createBasicConfig({
        method: 'POST',
        data: complexData,
      })

      expect(config.data).toEqual(complexData)
      expect((config.data as any).user.name).toBe('John')
      expect((config.data as any).settings.features.notifications).toBe(true)
    })

    it('应该支持各种请求参数类型', () => {
      const complexParams: RequestParams = {
        page: 1,
        limit: 20,
        search: 'test query',
        active: true,
        categoryIds: 123,
        sortBy: 'name',
        sortOrder: 'asc',
        includeDeleted: false,
        tags: null,
        metadata: undefined,
      }

      const config = TestHelpers.createBasicConfig({
        params: complexParams,
      })

      expect(config.params).toEqual(complexParams)
    })

    it('应该支持自定义头部信息', () => {
      const customHeaders = {
        'Authorization': 'Bearer token123',
        'Content-Type': 'application/json',
        'X-API-Version': 'v2',
        'X-Request-ID': 'req-123',
        'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
        'User-Agent': 'MyApp/1.0',
      }

      const config = TestHelpers.createBasicConfig({
        headers: customHeaders,
      })

      expect(config.headers).toEqual(customHeaders)
      Object.entries(customHeaders).forEach(([key, value]) => {
        expect(config.headers?.[key]).toBe(value)
      })
    })

    it('应该支持 AbortSignal', () => {
      const controller = new AbortController()
      const config = TestHelpers.createBasicConfig({
        signal: controller.signal,
      })

      expect(config.signal).toBe(controller.signal)
      expect(config.signal?.aborted).toBe(false)
    })

    it('应该支持超时配置', () => {
      const timeouts = [1000, 5000, 10000, 30000, 60000]

      timeouts.forEach(timeout => {
        const config = TestHelpers.createBasicConfig({ timeout })
        expect(config.timeout).toBe(timeout)
      })
    })

    it('应该支持调试和元数据', () => {
      const metadata = {
        requestId: 'req-123',
        userId: 456,
        feature: 'user-management',
        version: '2.1.0',
        environment: 'production',
        source: {
          component: 'UserForm',
          action: 'create',
        }
      }

      const config = TestHelpers.createBasicConfig({
        debug: true,
        tag: 'user-creation',
        metadata,
      })

      expect(config.debug).toBe(true)
      expect(config.tag).toBe('user-creation')
      expect(config.metadata).toEqual(metadata)
    })

    it('应该正确处理回调函数的参数', () => {
      const callbacks = TestHelpers.createMockCallbacks()
      const config = TestHelpers.createFullConfig(callbacks)

      // 模拟请求开始
      config.onStart?.(config)
      expect(callbacks.onStart).toHaveBeenCalledWith(config)

      // 模拟请求结束
      const duration = 1500
      config.onEnd?.(config, duration)
      expect(callbacks.onEnd).toHaveBeenCalledWith(config, duration)

      // 模拟请求错误
      const error = new Error('Network error')
      config.onError?.(config, error, duration)
      expect(callbacks.onError).toHaveBeenCalledWith(config, error, duration)
    })

    it('应该能容错处理回调函数异常', () => {
      const errorCallbacks = TestHelpers.createErrorCallbacks()
      const config = TestHelpers.createBasicConfig(errorCallbacks)

      // 测试回调函数抛出异常不应影响配置对象的创建和使用
      expect(() => {
        // 配置对象本身应该正常创建
        expect(config.url).toBe('https://api.example.com/test')
        expect(config.method).toBe('GET')
      }).not.toThrow()

      // 测试回调函数确实会抛出异常
      expect(() => config.onStart?.(config)).toThrow('Start callback error')
      expect(() => config.onEnd?.(config, 1000)).toThrow('End callback error')
      expect(() => config.onError?.(config, new Error('test'), 1000)).toThrow('Error callback error')
    })

    it('应该支持异步回调函数', async () => {
      const asyncCallbacks = {
        onStart: vi.fn(async (config: RequestConfig) => {
          console.log('Async start callback executing')
          await new Promise(resolve => setTimeout(resolve, 10))
        }),
        onEnd: vi.fn(async (config: RequestConfig, duration: number) => {
          console.log('Async end callback executing with duration:', duration)
          await new Promise(resolve => setTimeout(resolve, 10))
        }),
        onError: vi.fn(async (config: RequestConfig, error: unknown, duration: number) => {
          console.log('Async error callback executing')
          await new Promise(resolve => setTimeout(resolve, 10))
        })
      }

      const config = TestHelpers.createBasicConfig(asyncCallbacks)

      // 测试异步回调函数
      await config.onStart?.(config)
      await config.onEnd?.(config, 1500)
      await config.onError?.(config, new Error('async error'), 1500)

      expect(asyncCallbacks.onStart).toHaveBeenCalledWith(config)
      expect(asyncCallbacks.onEnd).toHaveBeenCalledWith(config, 1500)
      expect(asyncCallbacks.onError).toHaveBeenCalledWith(config, expect.any(Error), 1500)
    })

    it('应该支持不同类型的请求数据', () => {
      const dataTypes: Array<{ data: RequestData, description: string }> = [
        { data: { key: 'value' }, description: '对象' },
        { data: 'string data', description: '字符串' },
        { data: 123, description: '数字' },
        { data: true, description: '布尔值' },
        { data: null, description: 'null' },
        { data: undefined, description: 'undefined' },
        { data: new FormData(), description: 'FormData' },
        { data: new Blob(['data']), description: 'Blob' },
        { data: new URLSearchParams(), description: 'URLSearchParams' },
      ]

      dataTypes.forEach(({ data, description }) => {
        const config = TestHelpers.createBasicConfig({
          method: 'POST',
          data,
        })

        expect(config.data).toBe(data)
      })
    })

    it('应该正确处理边界值配置', () => {
      const boundaryTests = [
        { timeout: 0, description: '零超时' },
        { timeout: 1, description: '最小超时' },
        { timeout: Number.MAX_SAFE_INTEGER, description: '最大安全整数超时' },
        { url: '', description: '空URL' },
        { method: 'GET' as const, data: null, description: 'GET请求带null数据' },
        { method: 'POST' as const, data: undefined, description: 'POST请求带undefined数据' },
      ]

      boundaryTests.forEach(({ description, ...config }) => {
        const requestConfig = TestHelpers.createBasicConfig(config)
        expect(requestConfig).toBeDefined()
        console.log('Boundary test passed:', description)
      })
    })

    it('应该支持复杂的嵌套元数据', () => {
      const complexMetadata = {
        request: {
          id: 'req-123',
          timestamp: Date.now(),
          context: {
            user: { id: 1, role: 'admin' },
            session: { id: 'sess-456', expires: Date.now() + 3600000 },
            feature: {
              name: 'user-management',
              version: '2.1.0',
              flags: ['beta', 'experimental'],
              settings: {
                enableCache: true,
                timeout: 5000,
                retries: 3
              }
            }
          }
        },
        analytics: {
          track: true,
          events: ['request_start', 'request_end'],
          metadata: {
            source: 'unit-test',
            environment: 'test',
            build: process.env.BUILD_NUMBER || 'unknown'
          }
        }
      }

      const config = TestHelpers.createBasicConfig({
        metadata: complexMetadata
      })

      expect(config.metadata).toEqual(complexMetadata)
      expect((config.metadata as any).request.context.user.role).toBe('admin')
      expect((config.metadata as any).analytics.events).toHaveLength(2)
    })

    it('应该支持类型安全的方法定义', () => {
      const validMethods: RequestConfig['method'][] = [
        'GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS'
      ]

      validMethods.forEach(method => {
        const config: RequestConfig = TestHelpers.createBasicConfig({ method })
        // TypeScript 编译时类型检查确保方法有效
        const methodCheck: RequestConfig['method'] = config.method
        expect(methodCheck).toBe(method)
        expect(validMethods).toContain(methodCheck)
      })
    })
  })

  describe('GlobalConfig', () => {
    it('应该支持完整的全局配置', () => {
      const interceptor: RequestInterceptor = { onRequest: vi.fn() }
      const globalConfig: GlobalConfig = {
        baseURL: 'https://api.example.com',
        timeout: 10000,
        headers: { 'X-API-Key': 'key123' },
        debug: true,
        retries: 3,
        cacheEnabled: true,
        interceptors: [interceptor],
      }

      // 验证配置值
      expect(globalConfig.baseURL).toBe('https://api.example.com')
      expect(globalConfig.timeout).toBe(10000)
      expect(globalConfig.debug).toBe(true)
      expect(globalConfig.retries).toBe(3)
      expect(globalConfig.cacheEnabled).toBe(true)
      expect(globalConfig.headers?.['X-API-Key']).toBe('key123')
      expect(globalConfig.interceptors).toHaveLength(1)
      expect(globalConfig.interceptors?.[0]).toBe(interceptor)
    })

    it('应该支持部分全局配置', () => {
      const partialConfigs: GlobalConfig[] = [
        { baseURL: 'https://api.example.com' },
        { timeout: 5000 },
        { debug: true },
        { retries: 1 },
        { cacheEnabled: false },
        { headers: { 'Authorization': 'Bearer token' } },
      ]

      partialConfigs.forEach((config) => {
        const globalConfig: GlobalConfig = config
        expect(globalConfig).toEqual(config)
      })
    })

    it('应该支持多个拦截器', () => {
      const interceptors: RequestInterceptor[] = [
        { onRequest: vi.fn() },
        { onResponse: vi.fn() },
        { onError: vi.fn() },
        { onRequest: vi.fn(), onResponse: vi.fn() },
        { onRequest: vi.fn(), onResponse: vi.fn(), onError: vi.fn() },
      ]

      const globalConfig: GlobalConfig = { interceptors }
      expect(globalConfig.interceptors).toHaveLength(5)
      expect(globalConfig.interceptors).toBe(interceptors)
    })

    it('应该支持空配置', () => {
      const emptyConfig: GlobalConfig = {}
      
      expect(emptyConfig.baseURL).toBeUndefined()
      expect(emptyConfig.timeout).toBeUndefined()
      expect(emptyConfig.headers).toBeUndefined()
      expect(emptyConfig.debug).toBeUndefined()
      expect(emptyConfig.retries).toBeUndefined()
      expect(emptyConfig.cacheEnabled).toBeUndefined()
      expect(emptyConfig.interceptors).toBeUndefined()
    })

    it('应该支持复杂的全局头部配置', () => {
      const complexHeaders = {
        'Authorization': 'Bearer global-token',
        'Content-Type': 'application/json',
        'Accept': 'application/json, text/plain, */*',
        'X-API-Version': 'v2',
        'X-Client-Info': 'MyApp/1.0.0 (platform=web)',
        'Cache-Control': 'no-cache',
        'Pragma': 'no-cache',
      }

      const globalConfig: GlobalConfig = {
        headers: complexHeaders,
      }

      expect(globalConfig.headers).toEqual(complexHeaders)
      Object.keys(complexHeaders).forEach(header => {
        expect(globalConfig.headers?.[header]).toBeDefined()
      })
    })

    it('应该支持不同的重试配置', () => {
      const retryConfigs = [0, 1, 3, 5, 10]

      retryConfigs.forEach(retries => {
        const globalConfig: GlobalConfig = { retries }
        expect(globalConfig.retries).toBe(retries)
      })
    })

    it('应该支持不同的超时配置', () => {
      const timeouts = [1000, 5000, 10000, 30000, 60000, 120000]

      timeouts.forEach(timeout => {
        const globalConfig: GlobalConfig = { timeout }
        expect(globalConfig.timeout).toBe(timeout)
      })
    })

    it('应该支持缓存配置', () => {
      const cacheConfigs = [true, false, undefined]

      cacheConfigs.forEach(cacheEnabled => {
        const globalConfig: GlobalConfig = { cacheEnabled }
        expect(globalConfig.cacheEnabled).toBe(cacheEnabled)
      })
    })

    it('应该支持调试配置', () => {
      const debugConfigs = [true, false, undefined]

      debugConfigs.forEach(debug => {
        const globalConfig: GlobalConfig = { debug }
        expect(globalConfig.debug).toBe(debug)
      })
    })
  })

  describe('RestfulOptions', () => {
    it('应该支持完整的RESTful选项', () => {
      const restfulOptions: RestfulOptions = {
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: { Accept: 'application/json' },
        params: { version: 'v1' },
        debug: false,
      }

      expect(restfulOptions.baseURL).toBe('https://api.example.com')
      expect(restfulOptions.timeout).toBe(5000)
      expect(restfulOptions.debug).toBe(false)
      expect(restfulOptions.headers?.Accept).toBe('application/json')
      expect(restfulOptions.params?.version).toBe('v1')
    })

    it('应该支持最小RESTful配置', () => {
      const minimalOptions: RestfulOptions = {}
      expect(minimalOptions).toEqual({})
      
      const baseUrlOnlyOptions: RestfulOptions = {
        baseURL: 'https://api.example.com'
      }
      expect(baseUrlOnlyOptions.baseURL).toBe('https://api.example.com')
    })

    it('应该支持只配置部分选项', () => {
      const partialConfigs: RestfulOptions[] = [
        { baseURL: 'https://api.v1.com' },
        { timeout: 8000 },
        { debug: true },
        { headers: { 'Content-Type': 'application/json' } },
        { params: { apiKey: 'key123' } },
        { baseURL: 'https://api.com', timeout: 3000 },
        { headers: { Accept: 'json' }, params: { lang: 'en' } },
      ]

      partialConfigs.forEach(config => {
        const options: RestfulOptions = config
        expect(options).toEqual(config)
      })
    })

    it('应该支持复杂的RESTful头部', () => {
      const complexHeaders = {
        'Accept': 'application/json, application/xml, text/plain',
        'Content-Type': 'application/json; charset=utf-8',
        'Authorization': 'Bearer restful-token',
        'X-Requested-With': 'XMLHttpRequest',
        'Cache-Control': 'max-age=300',
      }

      const options: RestfulOptions = {
        headers: complexHeaders,
      }

      expect(options.headers).toEqual(complexHeaders)
    })

    it('应该支持复杂的RESTful参数', () => {
      const complexParams: RequestParams = {
        api_version: 'v2',
        format: 'json',
        locale: 'zh-CN',
        include_metadata: true,
        max_results: 100,
        fields: 'id,name,email,created_at',
        sort: 'created_at',
        order: 'desc',
        filter_active: true,
        timestamp: Date.now(),
      }

      const options: RestfulOptions = {
        params: complexParams,
      }

      expect(options.params).toEqual(complexParams)
      Object.keys(complexParams).forEach(key => {
        expect(options.params?.[key]).toBe(complexParams[key])
      })
    })

    it('应该支持不同的基础URL格式', () => {
      const baseUrls = [
        'https://api.example.com',
        'https://api.example.com/',
        'https://api.example.com/v1',
        'https://api.example.com/v1/',
        'http://localhost:3000',
        'http://localhost:3000/api',
        'https://subdomain.api.example.com/v2',
      ]

      baseUrls.forEach(baseURL => {
        const options: RestfulOptions = { baseURL }
        expect(options.baseURL).toBe(baseURL)
      })
    })

    it('应该支持不同的超时值', () => {
      const timeouts = [1000, 3000, 5000, 10000, 15000, 30000]

      timeouts.forEach(timeout => {
        const options: RestfulOptions = { timeout }
        expect(options.timeout).toBe(timeout)
      })
    })

    it('应该支持调试模式配置', () => {
      const debugValues = [true, false, undefined]

      debugValues.forEach(debug => {
        const options: RestfulOptions = debug !== undefined ? { debug } : {}
        expect(options.debug).toBe(debug)
      })
    })
  })

  describe('配置组合和继承测试', () => {
    it('应该支持配置的组合使用', () => {
      // 全局配置
      const globalConfig: GlobalConfig = {
        baseURL: 'https://api.example.com',
        timeout: 10000,
        headers: { 'X-API-Key': 'global-key' },
        debug: true,
      }

      // RESTful 选项
      const restfulOptions: RestfulOptions = {
        headers: { 'Content-Type': 'application/json' },
        params: { version: 'v1' },
        timeout: 5000, // 覆盖全局配置
      }

      // 请求配置
      const requestConfig: RequestConfig = {
        url: '/users',
        method: 'GET',
        headers: { 'Authorization': 'Bearer token' },
        timeout: 3000, // 覆盖其他配置
      }

      // 验证配置独立性
      expect(globalConfig.timeout).toBe(10000)
      expect(restfulOptions.timeout).toBe(5000)
      expect(requestConfig.timeout).toBe(3000)
    })

    it('应该正确处理配置的可选性', () => {
      // 所有字段都是可选的情况
      const configs = [
        {},
        { baseURL: 'test' },
        { timeout: 1000 },
        { headers: {} },
        { debug: false },
      ]

      configs.forEach(config => {
        const globalConfig: GlobalConfig = config
        const restfulOptions: RestfulOptions = config
        
        expect(globalConfig).toBeDefined()
        expect(restfulOptions).toBeDefined()
      })
    })

    it('应该支持配置的深度合并场景', () => {
      // 模拟配置合并的场景
      const baseConfig = {
        headers: { 'Content-Type': 'application/json' },
        params: { version: 'v1' },
      }

      const extendedConfig = {
        ...baseConfig,
        headers: {
          ...baseConfig.headers,
          'Authorization': 'Bearer token',
        },
        params: {
          ...baseConfig.params,
          debug: true,
        },
        timeout: 5000,
      }

      expect(extendedConfig.headers['Content-Type']).toBe('application/json')
      expect(extendedConfig.headers['Authorization']).toBe('Bearer token')
      expect(extendedConfig.params.version).toBe('v1')
      expect(extendedConfig.params.debug).toBe(true)
      expect(extendedConfig.timeout).toBe(5000)
    })
  })

  describe('配置合并优先级测试', () => {
    it('应该正确处理配置优先级', () => {
      const mergeScenarios = TestHelpers.createMergeScenarios()
      
      mergeScenarios.forEach(scenario => {
        console.log('Testing merge scenario:', scenario.name)
        
        // 模拟配置合并逻辑（这里只是接口测试，展示期望的合并结果）
        const mockMergedConfig = {
          ...scenario.global,
          ...scenario.restful,
          ...scenario.request,
          headers: {
            ...scenario.global.headers,
            ...scenario.restful.headers,
            ...scenario.request.headers
          }
        }

        // 验证合并后的配置结构
        expect(mockMergedConfig).toBeDefined()
        if (scenario.expected.timeout) {
          expect(mockMergedConfig.timeout).toBe(scenario.expected.timeout)
        }
        if (scenario.expected.baseURL) {
          expect(mockMergedConfig.baseURL).toBe(scenario.expected.baseURL)
        }
        if (scenario.expected.headers) {
          Object.entries(scenario.expected.headers).forEach(([key, value]) => {
            expect(mockMergedConfig.headers?.[key]).toBe(value)
          })
        }
      })
    })

    it('应该支持配置的深层合并', () => {
      const baseConfig: Partial<GlobalConfig> = {
        headers: { 'Authorization': 'Bearer base-token' },
        timeout: 5000,
        debug: false
      }

      const overrideConfig: Partial<RequestConfig> = {
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer override-token' },
        timeout: 3000
      }

      // 模拟深层合并
      const merged = {
        ...baseConfig,
        ...overrideConfig,
        headers: {
          ...baseConfig.headers,
          ...overrideConfig.headers
        }
      }

      expect(merged.timeout).toBe(3000) // override wins
      expect(merged.headers?.['Authorization']).toBe('Bearer override-token') // override wins
      expect(merged.headers?.['Content-Type']).toBe('application/json') // new field
      expect(merged.debug).toBe(false) // inherited from base
    })

    it('应该正确处理undefined和null值的合并', () => {
      const configs = [
        { base: { timeout: 5000 }, override: { timeout: undefined }, expected: undefined },
        { base: { debug: true }, override: { debug: null as any }, expected: null },
        { base: { headers: { 'X-Test': 'test' } }, override: { headers: undefined }, expected: undefined },
        { base: undefined, override: { timeout: 3000 }, expected: 3000 }
      ]

      configs.forEach(({ base, override, expected }, index) => {
        const merged = { ...base, ...override }
        if (expected === undefined) {
          expect(merged.timeout || merged.debug || merged.headers).toBeUndefined()
        } else if (expected === null) {
          expect(merged.debug).toBeNull()
        } else {
          expect(merged.timeout).toBe(expected)
        }
        console.log('Merge test passed for scenario', index + 1)
      })
    })
  })

  describe('配置性能基准测试', () => {
    it('应该能高效创建大量配置对象', () => {
      const startTime = performance.now()
      const configCount = 1000
      const configs: RequestConfig[] = []

      for (let i = 0; i < configCount; i++) {
        configs.push(TestHelpers.createFullConfig({
          url: `https://api.example.com/test/${i}`,
          tag: `test-${i}`,
          metadata: { iteration: i, timestamp: Date.now() }
        }))
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(configs).toHaveLength(configCount)
      expect(duration).toBeLessThan(100) // 100ms内完成1000个配置创建
      console.log('Created', configCount, 'configs in', duration.toFixed(2), 'ms')
    })

    it('应该能高效比较配置对象', () => {
      const config1 = TestHelpers.createFullConfig()
      const config2 = TestHelpers.createFullConfig()
      const config3 = { ...config1 }

      const startTime = performance.now()
      
      // 执行大量比较操作
      for (let i = 0; i < 10000; i++) {
        JSON.stringify(config1) === JSON.stringify(config2)
        JSON.stringify(config1) === JSON.stringify(config3)
      }

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(duration).toBeLessThan(50) // 50ms内完成10000次比较
      console.log('Performed 20000 config comparisons in', duration.toFixed(2), 'ms')
    })

    it('应该能高效处理复杂的配置合并', () => {
      const baseConfig = TestHelpers.createFullConfig({
        headers: Object.fromEntries(Array.from({ length: 50 }, (_, i) => [`X-Header-${i}`, `value-${i}`]))
      })

      const startTime = performance.now()
      
      // 执行大量合并操作
      const mergedConfigs = Array.from({ length: 1000 }, (_, i) => ({
        ...baseConfig,
        headers: {
          ...baseConfig.headers,
          [`X-Dynamic-${i}`]: `dynamic-${i}`
        },
        metadata: {
          ...baseConfig.metadata,
          iteration: i
        }
      }))

      const endTime = performance.now()
      const duration = endTime - startTime

      expect(mergedConfigs).toHaveLength(1000)
      expect(mergedConfigs[0].headers).toHaveProperty('X-Header-0')
      expect(mergedConfigs[999].headers).toHaveProperty('X-Dynamic-999')
      expect(duration).toBeLessThan(100) // 100ms内完成1000次复杂合并
      console.log('Performed 1000 complex merges in', duration.toFixed(2), 'ms')
    })
  })

  describe('配置序列化测试', () => {
    it('应该能正确序列化和反序列化基本配置', () => {
      const originalConfig = TestHelpers.createBasicConfig({
        headers: { 'Content-Type': 'application/json' },
        params: { page: 1, limit: 20 },
        metadata: { source: 'test' }
      })

      // 序列化
      const serialized = JSON.stringify(originalConfig)
      expect(serialized).toBeTypeOf('string')
      expect(serialized.length).toBeGreaterThan(0)

      // 反序列化
      const deserialized = JSON.parse(serialized) as RequestConfig
      expect(deserialized.url).toBe(originalConfig.url)
      expect(deserialized.method).toBe(originalConfig.method)
      expect(deserialized.headers).toEqual(originalConfig.headers)
      expect(deserialized.params).toEqual(originalConfig.params)
      expect(deserialized.metadata).toEqual(originalConfig.metadata)
      
      console.log('Config serialization test passed, size:', serialized.length, 'bytes')
    })

    it('应该能正确处理包含函数的配置序列化', () => {
      const configWithCallbacks = TestHelpers.createBasicConfig({
        onStart: vi.fn(),
        onEnd: vi.fn(),
        onError: vi.fn()
      })

      // 序列化时函数会被忽略
      const serialized = JSON.stringify(configWithCallbacks)
      const deserialized = JSON.parse(serialized) as RequestConfig

      expect(deserialized.url).toBe(configWithCallbacks.url)
      expect(deserialized.method).toBe(configWithCallbacks.method)
      expect(deserialized.onStart).toBeUndefined() // 函数不能序列化
      expect(deserialized.onEnd).toBeUndefined()
      expect(deserialized.onError).toBeUndefined()
      
      console.log('Config serialization without functions test passed')
    })

    it('应该能正确处理复杂嵌套配置的序列化', () => {
      const complexConfig = TestHelpers.createFullConfig({
        metadata: {
          user: { id: 1, profile: { name: 'John', settings: { theme: 'dark' } } },
          request: { features: ['cache', 'retry'], timestamp: Date.now() },
          analytics: { events: [{ type: 'start', data: { source: 'test' } }] }
        }
      })

      const startTime = performance.now()
      const serialized = JSON.stringify(complexConfig)
      const deserialized = JSON.parse(serialized)
      const endTime = performance.now()

      expect(deserialized.metadata.user.profile.name).toBe('John')
      expect(deserialized.metadata.request.features).toEqual(['cache', 'retry'])
      expect(deserialized.metadata.analytics.events[0].type).toBe('start')
      
      const duration = endTime - startTime
      expect(duration).toBeLessThan(10) // 10ms内完成复杂序列化
      console.log('Complex config serialization took', duration.toFixed(2), 'ms, size:', serialized.length, 'bytes')
    })

    it('应该能正确处理特殊值的序列化', () => {
      const configWithSpecialValues = TestHelpers.createBasicConfig({
        data: {
          nullValue: null,
          undefinedValue: undefined,
          dateValue: new Date(),
          regexValue: /test/g,
          functionValue: () => 'test'
        }
      })

      const serialized = JSON.stringify(configWithSpecialValues)
      const deserialized = JSON.parse(serialized)

      expect(deserialized.data.nullValue).toBeNull()
      expect(deserialized.data.undefinedValue).toBeUndefined() // undefined被忽略
      expect(deserialized.data.dateValue).toBeTypeOf('string') // Date转为字符串
      expect(deserialized.data.regexValue).toEqual({}) // RegExp转为空对象
      expect(deserialized.data.functionValue).toBeUndefined() // 函数被忽略
      
      console.log('Special values serialization test passed')
    })
  })
})
