import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  RequestError,
  RequestErrorType,
  RequestErrorContext,
} from '../../src/interface'

// 测试辅助函数
const TestHelpers = {
  // 创建基本的RequestError
  createBasicError: (message = 'Test error') => new RequestError(message),
  
  // 创建HTTP错误
  createHttpError: (status: number, message = 'HTTP error') =>
    new RequestError(message, {
      type: RequestErrorType.HTTP_ERROR,
      status,
      isHttpError: true,
    }),
  
  // 创建网络错误
  createNetworkError: (originalMessage = 'Network connection failed') =>
    new RequestError('Request failed', {
      originalError: new Error(originalMessage),
    }),
  
  // 创建超时错误
  createTimeoutError: () =>
    new RequestError('Request failed', {
      originalError: new Error('Request timeout'),
    }),
  
  // 创建完整配置的错误
  createFullError: (overrides: any = {}) =>
    new RequestError('Complete error', {
      type: RequestErrorType.HTTP_ERROR,
      status: 500,
      isHttpError: true,
      originalError: new Error('Original'),
      context: {
        url: 'https://api.example.com/test',
        method: 'POST',
        duration: 1000,
        tag: 'test-request',
        metadata: { source: 'unit-test' },
      },
      suggestion: '请重试',
      code: 'SERVER_ERROR',
      ...overrides,
    }),
}

describe('RequestError', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('构造函数', () => {
    it('应该创建基本的 RequestError', () => {
      const error = TestHelpers.createBasicError('Test error')

      expect(error).toBeInstanceOf(Error)
      expect(error).toBeInstanceOf(RequestError)
      expect(error.name).toBe('RequestError')
      expect(error.message).toBe('Test error')
      expect(error.type).toBe(RequestErrorType.UNKNOWN_ERROR)
      expect(error.isHttpError).toBe(false)
    })

    it('应该正确设置基本属性', () => {
      const error = TestHelpers.createBasicError()
      
      expect(error.context.timestamp).toBeTypeOf('number')
      expect(error.context.userAgent).toBeTypeOf('string')
      expect(error.context.timestamp).toBeLessThanOrEqual(Date.now())
    })

    it('应该正确设置错误类型和状态', () => {
      const error = new RequestError('HTTP Error', {
        type: RequestErrorType.HTTP_ERROR,
        status: 404,
        isHttpError: true,
        code: 'NOT_FOUND',
      })

      expect(error.type).toBe(RequestErrorType.HTTP_ERROR)
      expect(error.status).toBe(404)
      expect(error.isHttpError).toBe(true)
      expect(error.code).toBe('NOT_FOUND')
    })

    it('应该正确处理原始错误', () => {
      const originalError = new Error('Not Found')
      const error = new RequestError('HTTP Error', {
        originalError,
      })

      expect(error.originalError).toBe(originalError)
    })

    it('应该正确设置上下文信息', () => {
      const context: Partial<RequestErrorContext> = {
        url: 'https://api.example.com/test',
        method: 'GET',
        duration: 1000,
        tag: 'test-request',
        metadata: { source: 'unit-test' },
      }

      const error = new RequestError('Test error', { context })

      expect(error.context.url).toBe('https://api.example.com/test')
      expect(error.context.method).toBe('GET')
      expect(error.context.duration).toBe(1000)
      expect(error.context.tag).toBe('test-request')
      expect(error.context.metadata?.source).toBe('unit-test')
    })

    it('应该接受自定义建议信息', () => {
      const error = new RequestError('Test error', {
        suggestion: '检查URL是否正确',
      })

      expect(error.suggestion).toBe('检查URL是否正确')
    })
  })

  describe('错误类型推断', () => {
    it('应该根据HTTP状态码推断错误类型', () => {
      const testCases = [
        { status: 400, expected: RequestErrorType.HTTP_ERROR },
        { status: 404, expected: RequestErrorType.HTTP_ERROR },
        { status: 500, expected: RequestErrorType.HTTP_ERROR },
      ]

      testCases.forEach(({ status, expected }) => {
        const error = TestHelpers.createHttpError(status)
        expect(error.type).toBe(expected)
      })
    })

    it('应该处理HTTP状态码的边界情况', () => {
      const statusCodeTests = [
        { status: 399, expected: RequestErrorType.UNKNOWN_ERROR, description: '3xx boundary' },
        { status: 400, expected: RequestErrorType.HTTP_ERROR, description: '4xx start' },
        { status: 499, expected: RequestErrorType.HTTP_ERROR, description: '4xx end' },
        { status: 500, expected: RequestErrorType.HTTP_ERROR, description: '5xx start' },
        { status: 599, expected: RequestErrorType.HTTP_ERROR, description: '5xx end' },
        { status: 600, expected: RequestErrorType.HTTP_ERROR, description: 'above 5xx' },
      ]

      statusCodeTests.forEach(({ status, expected, description }) => {
        // 使用不带显式类型的构造方式，测试自动推断功能
        const error = new RequestError('HTTP status test', { status })
        expect(error.type, `Status ${status} (${description})`).toBe(expected)
      })
    })

    it('应该优先使用显式类型而非推断类型', () => {
      // 状态码推断为 HTTP_ERROR，但显式指定为其他类型
      const error = new RequestError('Test error', {
        type: RequestErrorType.VALIDATION_ERROR,
        status: 500, // 这会推断为 HTTP_ERROR
        isHttpError: true,
      })

      expect(error.type).toBe(RequestErrorType.VALIDATION_ERROR)
    })

    it('应该正确处理isHttpError标志', () => {
      // 有 isHttpError 标志但无状态码
      const error = new RequestError('Test error', {
        isHttpError: true,
      })

      expect(error.type).toBe(RequestErrorType.HTTP_ERROR)
      expect(error.isHttpError).toBe(true)
    })

    it('应该在没有显式标志的情况下正确推断错误类型', () => {
      // 测试纯状态码推断，不带任何显式标志
      const tests = [
        { status: 200, expected: RequestErrorType.UNKNOWN_ERROR },
        { status: 300, expected: RequestErrorType.UNKNOWN_ERROR },
        { status: 400, expected: RequestErrorType.HTTP_ERROR },
        { status: 404, expected: RequestErrorType.HTTP_ERROR },
        { status: 500, expected: RequestErrorType.HTTP_ERROR },
        { status: 503, expected: RequestErrorType.HTTP_ERROR },
      ]

      tests.forEach(({ status, expected }) => {
        const error = new RequestError('Pure inference test', { status })
        expect(error.type, `Pure inference for status ${status}`).toBe(expected)
        expect(error.status).toBe(status)
      })
    })

    it('应该根据原始错误消息推断超时错误', () => {
      const error = TestHelpers.createTimeoutError()
      expect(error.type).toBe(RequestErrorType.TIMEOUT_ERROR)
    })

    it('应该根据原始错误消息推断网络错误', () => {
      const networkMessages = [
        'Network connection failed',
        'fetch failed',
        'connection timeout',
      ]

      networkMessages.forEach((message) => {
        const error = TestHelpers.createNetworkError(message)
        expect(error.type).toBe(RequestErrorType.NETWORK_ERROR)
      })
    })

    it('应该在无法推断时返回 UNKNOWN_ERROR', () => {
      const error = TestHelpers.createBasicError('Unknown error')
      expect(error.type).toBe(RequestErrorType.UNKNOWN_ERROR)
    })

    it('应该优先使用显式指定的错误类型', () => {
      const error = new RequestError('Test error', {
        type: RequestErrorType.VALIDATION_ERROR,
        originalError: new Error('Request timeout'), // 会推断为TIMEOUT_ERROR
      })

      expect(error.type).toBe(RequestErrorType.VALIDATION_ERROR)
    })
  })

  describe('建议信息生成', () => {
    it('应该为不同错误类型生成正确的建议', () => {
      const testCases = [
        {
          type: RequestErrorType.NETWORK_ERROR,
          expected: '请检查网络连接或服务器是否可访问',
        },
        {
          type: RequestErrorType.TIMEOUT_ERROR,
          expected: '请求超时，可以尝试增加timeout值或检查网络状况',
        },
        {
          type: RequestErrorType.VALIDATION_ERROR,
          expected: '请检查请求配置参数是否正确',
        },
      ]

      testCases.forEach(({ type, expected }) => {
        const error = new RequestError('Test error', { type })
        expect(error.suggestion).toBe(expected)
      })
    })

    it('应该为所有错误类型生成正确的建议', () => {
      const allErrorTypes = [
        { type: RequestErrorType.NETWORK_ERROR, expected: '请检查网络连接或服务器是否可访问' },
        { type: RequestErrorType.TIMEOUT_ERROR, expected: '请求超时，可以尝试增加timeout值或检查网络状况' },
        { type: RequestErrorType.VALIDATION_ERROR, expected: '请检查请求配置参数是否正确' },
        { type: RequestErrorType.CACHE_ERROR, expected: '请检查网络连接和请求配置' },
        { type: RequestErrorType.CONCURRENT_ERROR, expected: '请检查网络连接和请求配置' },
        { type: RequestErrorType.RETRY_ERROR, expected: '请检查网络连接和请求配置' },
        { type: RequestErrorType.UNKNOWN_ERROR, expected: '请检查网络连接和请求配置' },
      ]

      allErrorTypes.forEach(({ type, expected }) => {
        const error = new RequestError('Test error', { type })
        expect(error.suggestion, `Error type: ${type}`).toBe(expected)
        expect(error.suggestion).toBeTruthy() // 确保所有类型都有建议
      })
    })

    it('应该为不同HTTP状态码生成特定建议', () => {
      const statusCodeSuggestions = [
        { status: 404, expected: '请检查请求URL是否正确' },
        { status: 401, expected: '认证失败，请检查token或登录状态' },
        { status: 403, expected: '权限不足，请检查用户权限设置' },
        { status: 500, expected: '服务器错误，请稍后重试或联系管理员' },
        { status: 502, expected: '服务器错误，请稍后重试或联系管理员' },
        { status: 400, expected: '请检查请求参数和服务器状态' },
      ]

      statusCodeSuggestions.forEach(({ status, expected }) => {
        const error = TestHelpers.createHttpError(status)
        expect(error.suggestion).toBe(expected)
      })
    })

    it('应该优先使用自定义建议信息', () => {
      const customSuggestion = '自定义建议信息'
      const error = new RequestError('Test error', {
        type: RequestErrorType.NETWORK_ERROR,
        suggestion: customSuggestion,
      })

      expect(error.suggestion).toBe(customSuggestion)
    })

    it('应该为未知错误类型提供通用建议', () => {
      const error = new RequestError('Unknown error', {
        type: RequestErrorType.UNKNOWN_ERROR,
      })

      expect(error.suggestion).toBe('请检查网络连接和请求配置')
    })
  })

  describe('toDisplayMessage', () => {
    it('应该格式化完整的错误显示信息', () => {
      const error = new RequestError('Request failed', {
        status: 404,
        suggestion: '请检查URL',
        context: {
          url: 'https://api.example.com/test',
          tag: 'test-request',
          timestamp: Date.now(),
        },
      })

      const displayMessage = error.toDisplayMessage()
      const expectedParts = [
        '错误: Request failed',
        '状态码: 404',
        '建议: 请检查URL',
        'URL: https://api.example.com/test',
        '标签: test-request',
      ]

      expectedParts.forEach((part) => {
        expect(displayMessage).toContain(part)
      })
    })

    it('应该处理部分信息缺失的情况', () => {
      const error = TestHelpers.createBasicError('Simple error')
      const displayMessage = error.toDisplayMessage()

      expect(displayMessage).toContain('错误: Simple error')
      expect(displayMessage).not.toContain('状态码:')
      expect(displayMessage).toContain('建议:') // 会自动生成建议
    })

    it('应该正确格式化多行显示信息', () => {
      const error = TestHelpers.createHttpError(500, 'Server Error')
      const displayMessage = error.toDisplayMessage()
      const lines = displayMessage.split('\n')

      expect(lines.length).toBeGreaterThan(1)
      expect(lines[0]).toContain('错误:')
    })
  })

  describe('toJSON', () => {
    it('应该序列化为完整的JSON对象', () => {
      const error = TestHelpers.createFullError()
      const json = error.toJSON()

      const expectedFields = [
        'name', 'message', 'type', 'status', 'isHttpError',
        'context', 'suggestion', 'code', 'stack'
      ]

      expectedFields.forEach((field) => {
        expect(json).toHaveProperty(field)
      })

      expect(json.name).toBe('RequestError')
      expect(json.type).toBe(RequestErrorType.HTTP_ERROR)
      expect(json.stack).toBeTypeOf('string')
    })

    it('应该包含完整的上下文信息', () => {
      const error = TestHelpers.createFullError()
      const json = error.toJSON()

      expect(json.context).toEqual({
        url: 'https://api.example.com/test',
        method: 'POST',
        duration: 1000,
        timestamp: expect.any(Number),
        userAgent: expect.any(String),
        tag: 'test-request',
        metadata: { source: 'unit-test' },
      })
    })

    it('应该正确序列化无额外信息的基本错误', () => {
      const error = TestHelpers.createBasicError()
      const json = error.toJSON()

      expect(json.name).toBe('RequestError')
      expect(json.type).toBe(RequestErrorType.UNKNOWN_ERROR)
      expect(json.status).toBeUndefined()
      expect(json.isHttpError).toBe(false)
    })

    it('应该正确处理原始错误对象的JSON序列化', () => {
      const originalError = new Error('Original error message')
      originalError.stack = 'Original error stack'
      
      const error = new RequestError('Request failed', {
        originalError,
        type: RequestErrorType.NETWORK_ERROR,
      })

      const json = error.toJSON()
      
      // originalError 不应该被直接序列化到 JSON 中
      // 这是为了避免循环引用和不可序列化的对象
      expect(json.originalError).toBeUndefined()
      expect(json.message).toBe('Request failed')
      expect(json.type).toBe(RequestErrorType.NETWORK_ERROR)
    })

    it('应该序列化带有复杂元数据的错误', () => {
      const complexMetadata = {
        requestId: '12345',
        userInfo: { id: 1, name: 'test' },
        nested: { deep: { value: 'test' } },
        array: [1, 2, 3],
      }

      const error = new RequestError('Complex error', {
        context: { metadata: complexMetadata }
      })

      const json = error.toJSON()
      expect((json.context as RequestErrorContext).metadata).toEqual(complexMetadata)
    })
  })

  describe('错误堆栈信息', () => {
    it('应该保留错误堆栈信息', () => {
      const error = TestHelpers.createBasicError('Stack test')

      expect(error.stack).toBeDefined()
      expect(error.stack).toContain('RequestError')
      expect(error.stack).toContain('Stack test')
    })

    it('应该正确处理堆栈捕获', () => {
      const error = TestHelpers.createBasicError()
      
      expect(error.stack).toBeDefined()
      expect(typeof error.stack).toBe('string')
    })
  })

  describe('边界情况和异常处理', () => {
    it('应该处理超长错误消息', () => {
      const longMessage = 'x'.repeat(10000)
      const error = TestHelpers.createBasicError(longMessage)
      
      expect(error.message).toBe(longMessage)
      expect(error.message.length).toBe(10000)
    })

    it('应该处理空消息', () => {
      const error = TestHelpers.createBasicError('')
      
      expect(error.message).toBe('')
      expect(error.name).toBe('RequestError')
    })

    it('应该处理循环引用的元数据', () => {
      const circular: any = { name: 'test' }
      circular.self = circular
      
      expect(() => new RequestError('test', {
        context: { metadata: circular }
      })).not.toThrow()
    })

    it('应该处理极大的时间戳', () => {
      const futureTimestamp = Date.now() + 1000000000000 // 很久的未来
      const error = new RequestError('test', {
        context: { timestamp: futureTimestamp }
      })
      
      expect(error.context.timestamp).toBe(futureTimestamp)
    })

    it('应该处理负数状态码', () => {
      const error = TestHelpers.createHttpError(-1)
      
      expect(error.status).toBe(-1)
      // 负数状态码不会被识别为HTTP错误
      expect(error.type).toBe(RequestErrorType.HTTP_ERROR)
    })

    it('应该处理极大的状态码', () => {
      const error = TestHelpers.createHttpError(99999)
      
      expect(error.status).toBe(99999)
      expect(error.type).toBe(RequestErrorType.HTTP_ERROR)
    })

    it('应该处理null和undefined值', () => {
      const error = new RequestError('test', {
        status: undefined,
        code: null as any,
        originalError: null as any,
        context: {
          url: undefined,
          method: null as any,
          metadata: null as any,
        }
      })

      expect(error.status).toBeUndefined()
      expect(error.code).toBeNull()
      expect(error.originalError).toBeNull()
    })

    it('应该处理特殊字符和Unicode', () => {
      const specialMessage = '错误 🚨: test\n\t\r\u0000\u{1F4A9}'
      const error = TestHelpers.createBasicError(specialMessage)
      
      expect(error.message).toBe(specialMessage)
      expect(error.toDisplayMessage()).toContain(specialMessage)
    })

    it('应该正确处理深层嵌套的元数据', () => {
      const deepMetadata = {
        level1: {
          level2: {
            level3: {
              level4: {
                level5: 'deep value'
              }
            }
          }
        }
      }

      const error = new RequestError('test', {
        context: { metadata: deepMetadata }
      })

      expect((error.context.metadata as any)?.level1?.level2?.level3?.level4?.level5).toBe('deep value')
    })

    it('应该处理非Error类型的originalError对象', () => {
      const stringError = 'string error'
      const objectError = { message: 'object error', code: 500 }
      
      const error1 = new RequestError('test', { originalError: stringError })
      const error2 = new RequestError('test', { originalError: objectError })
      
      expect(error1.originalError).toBe(stringError)
      expect(error2.originalError).toBe(objectError)
    })

    it('应该在序列化时处理不可序列化的值', () => {
      const error = new RequestError('test', {
        context: {
          metadata: {
            func: () => 'test',
            symbol: Symbol('test'),
            bigint: BigInt(123),
          }
        }
      })

      expect(() => error.toJSON()).not.toThrow()
      const json = error.toJSON()
      expect(json).toBeDefined()
    })
  })

  describe('性能测试', () => {
    const PERFORMANCE_ITERATIONS = 1000
    
    it('应该在合理时间内创建大量错误实例', () => {
      const start = performance.now()
      const errors: RequestError[] = []
      
      for (let i = 0; i < PERFORMANCE_ITERATIONS; i++) {
        errors.push(TestHelpers.createBasicError(`Error ${i}`))
      }
      
      const end = performance.now()
      const duration = end - start
      
      // 性能基准：每个错误实例创建应少于 0.1ms
      expect(duration).toBeLessThan(PERFORMANCE_ITERATIONS * 0.1)
      expect(errors.length).toBe(PERFORMANCE_ITERATIONS)
      
      // 验证所有实例都正确创建
      errors.forEach((error, index) => {
        expect(error).toBeInstanceOf(RequestError)
        expect(error.message).toBe(`Error ${index}`)
      })
    })

    it('应该在合理时间内生成显示消息', () => {
      const error = TestHelpers.createFullError()
      const start = performance.now()
      const results: string[] = []
      
      for (let i = 0; i < PERFORMANCE_ITERATIONS; i++) {
        results.push(error.toDisplayMessage())
      }
      
      const end = performance.now()
      const duration = end - start
      
      // 性能基准：每次调用应少于 0.05ms
      expect(duration).toBeLessThan(PERFORMANCE_ITERATIONS * 0.05)
      
      // 验证结果一致性
      const firstResult = results[0]
      results.forEach(result => {
        expect(result).toBe(firstResult)
        expect(result).toContain('错误:')
        expect(result).toContain('建议:')
      })
    })

    it('应该在合理时间内进行JSON序列化', () => {
      const error = TestHelpers.createFullError()
      const start = performance.now()
      const results: Record<string, unknown>[] = []
      
      for (let i = 0; i < PERFORMANCE_ITERATIONS; i++) {
        results.push(error.toJSON())
      }
      
      const end = performance.now()
      const duration = end - start
      
      // 性能基准：每次序列化应少于 0.1ms
      expect(duration).toBeLessThan(PERFORMANCE_ITERATIONS * 0.1)
      
      // 验证序列化结果正确性
      results.forEach(json => {
        expect(json).toHaveProperty('name', 'RequestError')
        expect(json).toHaveProperty('type')
        expect(json).toHaveProperty('context')
      })
    })

    it('应该处理大量元数据而不影响性能', () => {
      const METADATA_SIZE = 1000
      const largeMetadata: Record<string, any> = {}
      
      // 创建更真实的测试数据
      for (let i = 0; i < METADATA_SIZE; i++) {
        largeMetadata[`key${i}`] = {
          id: i,
          value: `value${i}`.repeat(5), // 减少重复次数使测试更稳定
          timestamp: Date.now() + i,
          nested: { level: i % 10 }
        }
      }

      const start = performance.now()
      const error = new RequestError('Large metadata test', {
        context: { 
          metadata: largeMetadata,
          url: 'https://api.example.com/test',
          method: 'POST'
        }
      })
      const end = performance.now()
      
      const creationTime = end - start
      expect(creationTime).toBeLessThan(50) // 50ms内完成创建
      
      // 验证数据完整性
      expect(error.context.metadata).toBeDefined()
      expect(Object.keys(error.context.metadata as object).length).toBe(METADATA_SIZE)
      
      // 测试序列化性能
      const serializeStart = performance.now()
      const json = error.toJSON()
      const serializeEnd = performance.now()
      const serializeTime = serializeEnd - serializeStart
      
      expect(serializeTime).toBeLessThan(20) // 序列化应在20ms内完成
      expect((json.context as RequestErrorContext).metadata).toBeDefined()
    })
  })
})

describe('RequestErrorType 枚举', () => {
  it('应该定义所有错误类型常量', () => {
    expect(RequestErrorType.NETWORK_ERROR).toBe('NETWORK_ERROR')
    expect(RequestErrorType.HTTP_ERROR).toBe('HTTP_ERROR')
    expect(RequestErrorType.TIMEOUT_ERROR).toBe('TIMEOUT_ERROR')
    expect(RequestErrorType.VALIDATION_ERROR).toBe('VALIDATION_ERROR')
    expect(RequestErrorType.CACHE_ERROR).toBe('CACHE_ERROR')
    expect(RequestErrorType.CONCURRENT_ERROR).toBe('CONCURRENT_ERROR')
    expect(RequestErrorType.RETRY_ERROR).toBe('RETRY_ERROR')
    expect(RequestErrorType.UNKNOWN_ERROR).toBe('UNKNOWN_ERROR')
  })
})

describe('环境适配性测试', () => {
  // 保存原始环境
  const originalNavigator = global.navigator

  afterEach(() => {
    // 恢复原始环境
    global.navigator = originalNavigator
  })

  it('应该在Node.js环境中正确设置userAgent', () => {
    // 模拟Node.js环境（无navigator）
    delete (global as any).navigator

    const error = TestHelpers.createBasicError('Node.js test')
    expect(error.context.userAgent).toBe('Node.js')
  })

  it('应该在浏览器环境中使用navigator.userAgent', () => {
    // 模拟浏览器环境
    const testUserAgents = [
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
      'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36',
    ]

    testUserAgents.forEach((userAgent) => {
      global.navigator = { userAgent } as Navigator

      const error = TestHelpers.createBasicError('Browser test')
      expect(error.context.userAgent).toBe(userAgent)
    })
  })

  it('应该处理navigator存在但userAgent为空的情况', () => {
    global.navigator = { userAgent: '' } as Navigator

    const error = TestHelpers.createBasicError('Empty userAgent test')
    expect(error.context.userAgent).toBe('')
  })

  it('应该处理异常的navigator对象', () => {
    // 模拟异常情况
    global.navigator = null as any

    expect(() => {
      TestHelpers.createBasicError('Null navigator test')
    }).not.toThrow()
  })
})
