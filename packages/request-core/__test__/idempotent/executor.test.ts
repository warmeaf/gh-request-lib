import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { executeRequestWithCache } from '../../src/features/idempotent/executor'
import { CacheFeature } from '../../src/features/cache'
import { RequestConfig } from '../../src/interface'
import { CacheKeyConfig } from '../../src/cache/cache-key-generator'

describe('executor - executeRequestWithCache', () => {
  let cacheFeature: CacheFeature
  let config: RequestConfig
  let consoleLogSpy: ReturnType<typeof vi.spyOn>
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>

  beforeEach(() => {
    // 创建 mock CacheFeature
    cacheFeature = {
      requestWithCache: vi.fn(),
    } as any

    // 准备基础配置
    config = {
      url: 'https://api.example.com/users',
      method: 'GET',
    }

    // Mock console 方法
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {})
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {})
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('成功场景', () => {
    it('应该成功执行请求并返回结果', async () => {
      // 准备测试数据
      const expectedResponse = { id: 1, name: 'John Doe' }
      const idempotentKey = 'test-key'
      const ttl = 30000
      const keyGeneratorConfig: CacheKeyConfig = {
        includeHeaders: true,
        maxKeyLength: 512,
      }

      ;(cacheFeature.requestWithCache as any).mockResolvedValue(expectedResponse)

      // 执行测试
      const result = await executeRequestWithCache(
        cacheFeature,
        config,
        idempotentKey,
        ttl,
        keyGeneratorConfig
      )

      // 验证结果
      expect(result).toEqual(expectedResponse)
      expect(cacheFeature.requestWithCache).toHaveBeenCalledTimes(1)
    })

    it('应该使用正确的缓存配置调用 requestWithCache', async () => {
      // 准备测试数据
      const idempotentKey = 'custom-key'
      const ttl = 60000
      const keyGeneratorConfig: CacheKeyConfig = {
        includeHeaders: true,
        headersWhitelist: ['authorization', 'content-type'],
        maxKeyLength: 512,
      }

      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      // 执行测试
      await executeRequestWithCache(
        cacheFeature,
        config,
        idempotentKey,
        ttl,
        keyGeneratorConfig
      )

      // 验证调用参数
      expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(config, {
        ttl,
        key: idempotentKey,
        keyGenerator: keyGeneratorConfig,
        clone: 'deep',
      })
    })

    it('应该正确处理不同类型的响应数据', async () => {
      const testCases = [
        { data: null, description: 'null data' },
        { data: undefined, description: 'undefined data' },
        { data: '', description: 'empty string' },
        { data: 0, description: 'zero number' },
        { data: false, description: 'false boolean' },
        { data: [], description: 'empty array' },
        { data: {}, description: 'empty object' },
        { data: { nested: { deep: { value: 'test' } } }, description: 'nested object' },
        { data: [1, 2, 3, 4, 5], description: 'array of numbers' },
      ]

      for (const testCase of testCases) {
        ;(cacheFeature.requestWithCache as any).mockResolvedValue(testCase.data)

        const result = await executeRequestWithCache(
          cacheFeature,
          config,
          'key',
          30000,
          {}
        )

        expect(result).toEqual(testCase.data)
      }
    })

    it('应该正确处理复杂的请求配置', async () => {
      // 准备复杂配置
      const complexConfig: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST',
        data: { name: 'John', email: 'john@example.com' },
        headers: {
          'Authorization': 'Bearer token123',
          'Content-Type': 'application/json',
        },
        params: { page: 1, limit: 10 },
      }

      const expectedResponse = { id: 1, created: true }
      ;(cacheFeature.requestWithCache as any).mockResolvedValue(expectedResponse)

      // 执行测试
      const result = await executeRequestWithCache(
        cacheFeature,
        complexConfig,
        'complex-key',
        30000,
        {}
      )

      // 验证结果
      expect(result).toEqual(expectedResponse)
      expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
        complexConfig,
        expect.objectContaining({
          key: 'complex-key',
          ttl: 30000,
        })
      )
    })
  })

  describe('日志输出', () => {
    it('应该在请求开始时输出启动日志', async () => {
      // 准备测试数据
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      // 执行测试
      await executeRequestWithCache(cacheFeature, config, 'key', 30000, {})

      // 验证日志
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('🚀 [Idempotent] Starting new request')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(config.method!)
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(config.url!)
      )
    })

    it('应该在请求完成时输出完成日志', async () => {
      // 准备测试数据
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      // 执行测试
      await executeRequestWithCache(cacheFeature, config, 'key', 30000, {})

      // 验证日志
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('✅ [Idempotent] Request completed')
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(config.method!)
      )
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining(config.url!)
      )
    })

    it('应该按照正确的顺序输出日志（开始 -> 完成）', async () => {
      // 准备测试数据
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      // 执行测试
      await executeRequestWithCache(cacheFeature, config, 'key', 30000, {})

      // 验证日志顺序
      const calls = consoleLogSpy.mock.calls
      expect(calls.length).toBeGreaterThanOrEqual(2)
      
      const startLogIndex = calls.findIndex(call => 
        String(call[0]).includes('Starting new request')
      )
      const completeLogIndex = calls.findIndex(call => 
        String(call[0]).includes('Request completed')
      )

      expect(startLogIndex).toBeGreaterThanOrEqual(0)
      expect(completeLogIndex).toBeGreaterThan(startLogIndex)
    })

    it('应该在不同的 HTTP 方法请求时输出正确的日志', async () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] as const

      for (const method of methods) {
        consoleLogSpy.mockClear()
        const methodConfig = { ...config, method }
        ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

        await executeRequestWithCache(cacheFeature, methodConfig, 'key', 30000, {})

        expect(consoleLogSpy).toHaveBeenCalledWith(
          expect.stringContaining(method)
        )
      }
    })
  })

  describe('错误处理', () => {
    it('应该在请求失败时抛出错误', async () => {
      // 准备测试数据
      const error = new Error('Network error')
      ;(cacheFeature.requestWithCache as any).mockRejectedValue(error)

      // 执行测试并验证错误
      await expect(
        executeRequestWithCache(cacheFeature, config, 'key', 30000, {})
      ).rejects.toThrow('Network error')
    })

    it('应该在请求失败时输出错误日志', async () => {
      // 准备测试数据
      const error = new Error('Request failed')
      ;(cacheFeature.requestWithCache as any).mockRejectedValue(error)

      // 执行测试
      try {
        await executeRequestWithCache(cacheFeature, config, 'key', 30000, {})
      } catch (e) {
        // 忽略错误，我们只关心日志
      }

      // 验证错误日志
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining('❌ [Idempotent] Request failed'),
        error
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(config.method!),
        error
      )
      expect(consoleErrorSpy).toHaveBeenCalledWith(
        expect.stringContaining(config.url!),
        error
      )
    })

    it('应该在失败后重新抛出原始错误', async () => {
      // 准备测试数据
      class CustomError extends Error {
        constructor(message: string, public code: number) {
          super(message)
          this.name = 'CustomError'
        }
      }
      const error = new CustomError('Custom error', 500)
      ;(cacheFeature.requestWithCache as any).mockRejectedValue(error)

      // 执行测试并验证错误
      try {
        await executeRequestWithCache(cacheFeature, config, 'key', 30000, {})
        // 如果代码执行到这里，说明没有抛出错误，测试应该失败
        expect(true).toBe(false) // 强制测试失败
      } catch (e) {
        expect(e).toBe(error)
        expect(e).toBeInstanceOf(CustomError)
        expect((e as CustomError).code).toBe(500)
      }
    })

    it('应该正确处理字符串类型的错误', async () => {
      // 准备测试数据
      ;(cacheFeature.requestWithCache as any).mockRejectedValue('String error')

      // 执行测试并验证错误
      await expect(
        executeRequestWithCache(cacheFeature, config, 'key', 30000, {})
      ).rejects.toBe('String error')
    })

    it('应该正确处理 undefined 错误', async () => {
      // 准备测试数据
      ;(cacheFeature.requestWithCache as any).mockRejectedValue(undefined)

      // 执行测试并验证错误
      try {
        await executeRequestWithCache(cacheFeature, config, 'key', 30000, {})
        // 如果没有抛出错误，强制失败
        expect(true).toBe(false)
      } catch (e) {
        expect(e).toBe(undefined)
      }
    })

    it('应该在错误发生时仍然输出启动日志', async () => {
      // 准备测试数据
      const error = new Error('Failed request')
      ;(cacheFeature.requestWithCache as any).mockRejectedValue(error)

      // 执行测试
      try {
        await executeRequestWithCache(cacheFeature, config, 'key', 30000, {})
      } catch (e) {
        // 忽略错误
      }

      // 验证启动日志仍然被调用
      expect(consoleLogSpy).toHaveBeenCalledWith(
        expect.stringContaining('Starting new request')
      )
    })
  })

  describe('缓存配置', () => {
    it('应该始终使用 deep clone 策略', async () => {
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ data: 'test' })

      await executeRequestWithCache(cacheFeature, config, 'key', 30000, {})

      expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
        config,
        expect.objectContaining({
          clone: 'deep',
        })
      )
    })

    it('应该正确传递 TTL 值', async () => {
      const ttlValues = [0, 5000, 30000, 60000, 300000]

      for (const ttl of ttlValues) {
        ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

        await executeRequestWithCache(cacheFeature, config, 'key', ttl, {})

        expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
          config,
          expect.objectContaining({ ttl })
        )
      }
    })

    it('应该正确传递幂等键', async () => {
      const keys = ['key1', 'key2', 'complex-key-123', 'GET:https://example.com']

      for (const key of keys) {
        ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

        await executeRequestWithCache(cacheFeature, config, key, 30000, {})

        expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
          config,
          expect.objectContaining({ key })
        )
      }
    })

    it('应该正确传递 keyGenerator 配置', async () => {
      const keyGeneratorConfigs: CacheKeyConfig[] = [
        { includeHeaders: true },
        { headersWhitelist: ['authorization'] },
        { maxKeyLength: 256 },
        { includeHeaders: true, headersWhitelist: ['authorization', 'content-type'] },
        { hashAlgorithm: 'fnv1a' },
        {},
      ]

      for (const keyGeneratorConfig of keyGeneratorConfigs) {
        ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

        await executeRequestWithCache(
          cacheFeature,
          config,
          'key',
          30000,
          keyGeneratorConfig
        )

        expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
          config,
          expect.objectContaining({ keyGenerator: keyGeneratorConfig })
        )
      }
    })
  })

  describe('性能和并发', () => {
    it('应该能够处理快速连续的多个请求', async () => {
      const requestCount = 5
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      const promises: Promise<any>[] = []
      for (let i = 0; i < requestCount; i++) {
        promises.push(
          executeRequestWithCache(cacheFeature, config, `key-${i}`, 30000, {})
        )
      }

      const results = await Promise.all(promises)

      expect(results).toHaveLength(requestCount)
      expect(cacheFeature.requestWithCache).toHaveBeenCalledTimes(requestCount)
    })

    it('应该能够处理并发的相同请求', async () => {
      const concurrency = 3
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ id: 1, data: 'test' })

      const promises = Array.from({ length: concurrency }, () =>
        executeRequestWithCache(cacheFeature, config, 'same-key', 30000, {})
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(concurrency)
      results.forEach(result => {
        expect(result).toEqual({ id: 1, data: 'test' })
      })
    })

    it('应该正确处理延迟响应', async () => {
      const delay = 100
      ;(cacheFeature.requestWithCache as any).mockImplementation(() =>
        new Promise(resolve => setTimeout(() => resolve({ delayed: true }), delay))
      )

      const start = Date.now()
      const result = await executeRequestWithCache(cacheFeature, config, 'key', 30000, {})
      const duration = Date.now() - start

      expect(result).toEqual({ delayed: true })
      expect(duration).toBeGreaterThanOrEqual(delay - 10) // 允许一些误差
    })
  })

  describe('边缘情况', () => {
    it('应该处理空的 keyGeneratorConfig', async () => {
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      const result = await executeRequestWithCache(
        cacheFeature,
        config,
        'key',
        30000,
        {}
      )

      expect(result).toEqual({ success: true })
      expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ keyGenerator: {} })
      )
    })

    it('应该处理非常短的 TTL', async () => {
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      await executeRequestWithCache(cacheFeature, config, 'key', 1, {})

      expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ ttl: 1 })
      )
    })

    it('应该处理非常长的 TTL', async () => {
      const longTTL = 24 * 60 * 60 * 1000 // 24 hours
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      await executeRequestWithCache(cacheFeature, config, 'key', longTTL, {})

      expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ ttl: longTTL })
      )
    })

    it('应该处理空字符串的 idempotentKey', async () => {
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      await executeRequestWithCache(cacheFeature, config, '', 30000, {})

      expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ key: '' })
      )
    })

    it('应该处理特殊字符的 idempotentKey', async () => {
      const specialKey = 'key-with-!@#$%^&*()-chars'
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      await executeRequestWithCache(cacheFeature, config, specialKey, 30000, {})

      expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
        config,
        expect.objectContaining({ key: specialKey })
      )
    })

    it('应该处理缺少 method 的请求配置', async () => {
      const configWithoutMethod = { url: 'https://api.example.com/users', method: '' as any }
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      await executeRequestWithCache(
        cacheFeature,
        configWithoutMethod,
        'key',
        30000,
        {}
      )

      expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
        configWithoutMethod,
        expect.any(Object)
      )
    })

    it('应该处理缺少 url 的请求配置', async () => {
      const configWithoutUrl = { method: 'GET' as const, url: '' }
      ;(cacheFeature.requestWithCache as any).mockResolvedValue({ success: true })

      await executeRequestWithCache(cacheFeature, configWithoutUrl, 'key', 30000, {})

      expect(cacheFeature.requestWithCache).toHaveBeenCalledWith(
        configWithoutUrl,
        expect.any(Object)
      )
    })
  })
})
