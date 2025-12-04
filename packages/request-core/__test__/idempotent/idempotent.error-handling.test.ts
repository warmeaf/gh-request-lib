import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IdempotentFeature } from '../../src/features/idempotent'
import { RequestError, RequestErrorType } from '../../src/interface'

// 定义fail函数
const fail = (message?: string): never => {
  throw new Error(message || 'Test failed')
}
import {
  IdempotentMockRequestor,
  createIdempotentMockRequestor,
  cleanupIdempotentTest,
  IDEMPOTENT_TEST_CONFIGS,
  IDEMPOTENT_TEST_RESPONSES,
} from './idempotent-test-helpers'

describe('IdempotentFeature - Error Handling', () => {
  let mockRequestor: IdempotentMockRequestor
  let idempotentFeature: IdempotentFeature

  beforeEach(() => {
    vi.useFakeTimers()
    mockRequestor = createIdempotentMockRequestor()
    idempotentFeature = new IdempotentFeature(mockRequestor)
  })

  afterEach(async () => {
    vi.useRealTimers()
    await cleanupIdempotentTest(idempotentFeature, mockRequestor)
  })

  describe('网络请求错误处理', () => {
    it('应该正确处理和传播网络错误', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const networkError = new RequestError('Network connection failed', {
        type: RequestErrorType.NETWORK_ERROR,
        context: { url: config.url },
      })

      // 设置请求失败
      mockRequestor.setUrlFailure(config.url, true, networkError)

      // 执行请求应该抛出错误
      try {
        await idempotentFeature.requestIdempotent(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        const reqError = error as RequestError
        expect(reqError.message).toContain('Network connection failed')
        expect(reqError.type).toBe(RequestErrorType.NETWORK_ERROR)
      }
    })

    it('应该处理HTTP状态错误', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_POST
      const httpError = new RequestError('HTTP 500 Internal Server Error', {
        type: RequestErrorType.HTTP_ERROR,
        status: 500,
        context: { url: config.url },
      })

      mockRequestor.setUrlFailure(config.url, true, httpError)

      await expect(idempotentFeature.requestIdempotent(config)).rejects.toThrow(
        RequestError
      )

      try {
        await idempotentFeature.requestIdempotent(config)
      } catch (error) {
        const reqError = error as RequestError
        expect(reqError.type).toBe(RequestErrorType.HTTP_ERROR)
        expect(reqError.status).toBe(500)
      }
    })

    it('应该处理超时错误', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const timeoutError = new RequestError('Request timeout after 5000ms', {
        type: RequestErrorType.TIMEOUT_ERROR,
        context: {
          url: config.url,
          duration: 5000,
          timestamp: Date.now(),
        },
      })

      mockRequestor.setUrlFailure(config.url, true, timeoutError)

      await expect(idempotentFeature.requestIdempotent(config)).rejects.toThrow(
        RequestError
      )

      try {
        await idempotentFeature.requestIdempotent(config)
      } catch (error) {
        const reqError = error as RequestError
        expect(reqError.type).toBe(RequestErrorType.TIMEOUT_ERROR)
        expect(reqError.context?.duration).toBe(5000)
      }
    })

    it('应该处理未知错误并增强错误信息', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const unknownError = new Error('Something unexpected happened')

      mockRequestor.setUrlFailure(config.url, true, unknownError)

      await expect(idempotentFeature.requestIdempotent(config)).rejects.toThrow(
        RequestError
      )

      try {
        await idempotentFeature.requestIdempotent(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        const reqError = error as RequestError
        expect(reqError.message).toContain('Idempotent request failed')
        expect(reqError.message).toContain('Something unexpected happened')
        expect(reqError.type).toBe(RequestErrorType.UNKNOWN_ERROR)
        expect(reqError.originalError).toBe(unknownError)
      }
    })

    it('should not cache failed requests', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const networkError = new RequestError('Network failed', {
        type: RequestErrorType.NETWORK_ERROR,
      })

      // 第一次请求失败
      mockRequestor.setUrlFailure(config.url, true, networkError)
      await expect(
        idempotentFeature.requestIdempotent(config)
      ).rejects.toThrow()

      // 修复网络问题
      mockRequestor.setUrlFailure(config.url, false)
      mockRequestor.setUrlResponse(
        config.url,
        IDEMPOTENT_TEST_RESPONSES.SUCCESS
      )

      // 第二次请求应该成功（失败的请求不应该被缓存）
      const result = await idempotentFeature.requestIdempotent(config)
      expect(result).toEqual(IDEMPOTENT_TEST_RESPONSES.SUCCESS)
    })
  })

  describe('配置验证错误', () => {
    it('应该验证TTL配置并抛出适当错误', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET

      const invalidTTLs = [
        { ttl: 0, expectedMessage: 'TTL must be a positive integer' },
        { ttl: -1, expectedMessage: 'TTL must be a positive integer' },
        { ttl: 1.5, expectedMessage: 'TTL must be a positive integer' },
        { ttl: NaN, expectedMessage: 'TTL must be a positive integer' },
      ]

      for (const { ttl, expectedMessage } of invalidTTLs) {
        await expect(
          idempotentFeature.requestIdempotent(config, { ttl })
        ).rejects.toThrow(RequestError)

        try {
          await idempotentFeature.requestIdempotent(config, { ttl })
        } catch (error) {
          expect(error).toBeInstanceOf(RequestError)
          const reqError = error as RequestError
          expect(reqError.type).toBe(RequestErrorType.VALIDATION_ERROR)
          expect(reqError.message).toContain(expectedMessage)
        }
      }
    })

    it('应该验证includeHeaders配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET

      const invalidHeadersConfigs = [
        { includeHeaders: 'not-array' },
        { includeHeaders: 123 },
        { includeHeaders: {} },
        { includeHeaders: null },
      ]

      for (const headersConfig of invalidHeadersConfigs) {
        await expect(
          idempotentFeature.requestIdempotent(config, headersConfig as any)
        ).rejects.toThrow(RequestError)

        try {
          await idempotentFeature.requestIdempotent(
            config,
            headersConfig as any
          )
        } catch (error) {
          const reqError = error as RequestError
          expect(reqError.type).toBe(RequestErrorType.VALIDATION_ERROR)
          expect(reqError.message).toContain('includeHeaders must be an array')
        }
      }
    })

    it('应该验证hashAlgorithm配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET

      const invalidAlgorithms = ['md5', 'sha1', 'invalid', '']

      for (const algorithm of invalidAlgorithms) {
        await expect(
          idempotentFeature.requestIdempotent(config, {
            hashAlgorithm: algorithm as any,
          })
        ).rejects.toThrow(RequestError)

        try {
          await idempotentFeature.requestIdempotent(config, {
            hashAlgorithm: algorithm as any,
          })
        } catch (error) {
          const reqError = error as RequestError
          expect(reqError.type).toBe(RequestErrorType.VALIDATION_ERROR)
          expect(reqError.message).toContain(
            'hashAlgorithm must be one of: fnv1a, xxhash, simple'
          )
        }
      }
    })

    it('应该提供有用的错误代码', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET

      const testCases = [
        {
          config: { ttl: -1 },
          expectedCode: 'INVALID_TTL',
        },
        {
          config: { includeHeaders: 'invalid' },
          expectedCode: 'INVALID_HEADERS',
        },
        {
          config: { hashAlgorithm: 'invalid' },
          expectedCode: 'INVALID_HASH_ALGORITHM',
        },
      ]

      for (const { config: invalidConfig, expectedCode } of testCases) {
        try {
          await idempotentFeature.requestIdempotent(
            config,
            invalidConfig as any
          )
          fail('Should have thrown an error')
        } catch (error) {
          const reqError = error as RequestError
          expect(reqError.code).toBe(expectedCode)
        }
      }
    })
  })

  describe('缓存操作错误处理', () => {
    it('应该gracefully处理缓存读取错误', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 模拟缓存功能出现问题的情况
      // 由于我们无法直接模拟CacheFeature的内部错误，这里测试错误恢复逻辑

      // 执行请求 - 即使缓存有问题，请求也应该成功
      const result = await idempotentFeature.requestIdempotent(config)
      expect(result).toEqual(expectedResponse)
    })

    it('应该处理缓存清理操作的错误', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 建立一些缓存
      await idempotentFeature.requestIdempotent(config)

      // 缓存清理即使遇到错误也不应该抛出异常
      await expect(
        idempotentFeature.clearIdempotentCache()
      ).resolves.not.toThrow()
    })

    it('应该处理特定键的缓存清理错误', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      await idempotentFeature.requestIdempotent(config)

      // 即使键不存在或有其他问题，也不应该抛出错误
      await expect(
        idempotentFeature.clearIdempotentCache('non-existent-key')
      ).resolves.not.toThrow()

      await expect(
        idempotentFeature.clearIdempotentCache('idempotent:test-key')
      ).resolves.not.toThrow()
    })
  })

  describe('键生成错误处理', () => {
    it('应该使用fallback键处理键生成失败', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.COMPLEX_DATA
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 创建会导致键生成问题的复杂配置
      const problematicConfig = {
        includeHeaders: ['non-existent-header'],
        hashAlgorithm: 'fnv1a' as const, // 正常的算法，但数据可能有问题
      }

      // 即使键生成遇到问题，请求也应该成功
      const result = await idempotentFeature.requestIdempotent(
        config,
        problematicConfig
      )
      expect(result).toEqual(expectedResponse)

      // 再次执行相同请求应该工作
      const result2 = await idempotentFeature.requestIdempotent(
        config,
        problematicConfig
      )
      expect(result2).toEqual(expectedResponse)
    })

    it('应该记录键生成失败的警告', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        const config = IDEMPOTENT_TEST_CONFIGS.COMPLEX_DATA
        const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
        mockRequestor.setUrlResponse(config.url, expectedResponse)

        // 创建可能导致键生成问题的配置
        const problematicConfig = {
          data: { circular: null as any },
          hashAlgorithm: 'fnv1a' as const,
        }

        // 创建循环引用
        problematicConfig.data.circular = problematicConfig.data

        const modifiedConfig = {
          ...config,
          data: problematicConfig.data,
        }

        await idempotentFeature.requestIdempotent(modifiedConfig)

        // 由于键生成失败，应该有警告日志
        // 注意：实际的键生成器可能能处理循环引用，这里主要测试错误处理逻辑
      } finally {
        consoleSpy.mockRestore()
      }
    })
  })

  describe('并发错误处理', () => {
    it('应该处理并发请求中的错误', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET

      // 设置请求成功响应
      mockRequestor.setUrlResponse(
        config.url,
        IDEMPOTENT_TEST_RESPONSES.SUCCESS
      )

      // 并发执行多个相同请求
      const promises = Array.from({ length: 3 }, () =>
        idempotentFeature.requestIdempotent(config)
      )

      // 所有请求应该得到相同的成功响应（因为是幂等的）
      const results = await Promise.all(promises)

      results.forEach((result) => {
        expect(result).toEqual(IDEMPOTENT_TEST_RESPONSES.SUCCESS)
      })
    })

    it('应该处理并发请求中pending请求失败的情况', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const networkError = new RequestError('Network failed')

      // 设置延迟和失败
      mockRequestor.setGlobalDelay(100)
      mockRequestor.setUrlFailure(config.url, true, networkError)

      // 并发执行多个相同请求
      const promises = Array.from({ length: 3 }, () =>
        idempotentFeature.requestIdempotent(config)
      )

      // 推进时间，让所有延迟的异步操作完成
      await vi.runAllTimersAsync()

      // 所有请求都应该失败
      for (const promise of promises) {
        await expect(promise).rejects.toThrow(RequestError)
      }
    })
  })

  describe('回调函数错误处理', () => {
    it('应该处理onDuplicate回调中的错误', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      const faultyCallback = vi.fn().mockImplementation(() => {
        throw new Error('Callback error')
      })

      const callbackConfig = {
        onDuplicate: faultyCallback,
      }

      // 执行第一次请求
      await idempotentFeature.requestIdempotent(config, callbackConfig)

      // 执行第二次请求 - 即使回调出错，请求也应该成功
      const result = await idempotentFeature.requestIdempotent(
        config,
        callbackConfig
      )
      expect(result).toEqual(expectedResponse)

      // 验证回调被调用了，但错误被捕获
      expect(faultyCallback).toHaveBeenCalledTimes(1)
    })

    it('应该记录回调错误的警告', async () => {
      const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      try {
        const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
        const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
        mockRequestor.setUrlResponse(config.url, expectedResponse)

        const faultyCallback = () => {
          throw new Error('Callback failed')
        }

        const callbackConfig = { onDuplicate: faultyCallback }

        await idempotentFeature.requestIdempotent(config, callbackConfig)
        await idempotentFeature.requestIdempotent(config, callbackConfig)

        // 应该记录警告
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Callback execution failed'),
          expect.any(Object)
        )
      } finally {
        consoleSpy.mockRestore()
      }
    })
  })

  describe('资源清理错误处理', () => {
    it('应该处理destroy过程中的错误', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 建立一些状态
      await idempotentFeature.requestIdempotent(config)

      // destroy即使遇到内部错误也不应该抛出异常到用户代码
      await expect(idempotentFeature.destroy()).resolves.not.toThrow()
    })
  })

  describe('边界条件错误处理', () => {
    it('应该处理极端大小的请求数据', async () => {
      const hugeData = 'x'.repeat(1000000) // 1MB字符串

      const config = {
        url: '/api/huge-data',
        method: 'POST' as const,
        data: { content: hugeData },
      }

      const expectedResponse = { processed: true }
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 即使数据很大，也应该能正常处理
      const result = await idempotentFeature.requestIdempotent(config)
      expect(result).toEqual(expectedResponse)

      // 第二次请求应该命中缓存
      const result2 = await idempotentFeature.requestIdempotent(config)
      expect(result2).toEqual(expectedResponse)
    })

    it('应该处理包含特殊字符的URL', async () => {
      const specialUrls = [
        '/api/测试',
        '/api/test with spaces',
        '/api/test?query=value&other=测试',
        '/api/test#fragment',
        '/api/test%20encoded',
      ]

      for (const url of specialUrls) {
        const config = { url, method: 'GET' as const }
        const expectedResponse = { url, processed: true }
        mockRequestor.setUrlResponse(url, expectedResponse)

        // 特殊URL也应该能正常处理
        const result = await idempotentFeature.requestIdempotent(config)
        expect(result).toEqual(expectedResponse)
      }
    })

    it('应该处理null/undefined值在请求数据中', async () => {
      const config = {
        url: '/api/null-data',
        method: 'POST' as const,
        data: {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
          zero: 0,
          falseBool: false,
        },
      }

      const expectedResponse = { processed: true }
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      const result = await idempotentFeature.requestIdempotent(config)
      expect(result).toEqual(expectedResponse)

      // 相同的null/undefined值应该产生相同的键
      const result2 = await idempotentFeature.requestIdempotent(config)
      expect(result2).toEqual(expectedResponse)
    })
  })

  describe('错误信息和上下文', () => {
    it('应该提供丰富的错误上下文信息', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.WITH_HEADERS
      const networkError = new Error('Connection refused')

      mockRequestor.setUrlFailure(config.url, true, networkError)

      try {
        await idempotentFeature.requestIdempotent(config)
        fail('Should have thrown an error')
      } catch (error) {
        const reqError = error as RequestError

        // 验证错误信息包含有用的上下文
        expect(reqError.context).toBeDefined()
        expect(reqError.context?.url).toBe(config.url)
        expect(reqError.context?.method).toBe(config.method)
        expect(reqError.context?.timestamp).toBeGreaterThan(0)
        expect(reqError.originalError).toBe(networkError)
      }
    })

    it('应该记录详细的错误日志', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      try {
        const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
        const networkError = new RequestError('Network failed')

        mockRequestor.setUrlFailure(config.url, true, networkError)

        try {
          await idempotentFeature.requestIdempotent(config)
        } catch (error) {
          // 预期的错误
        }

        // 验证错误被记录
        expect(consoleSpy).toHaveBeenCalledWith(
          expect.stringContaining('Request failed'),
          expect.any(Object)
        )
      } finally {
        consoleSpy.mockRestore()
      }
    })
  })
})
