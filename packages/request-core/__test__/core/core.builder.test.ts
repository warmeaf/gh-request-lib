import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestError, RequestErrorType } from '../../src/interface'
import {
  CoreMockRequestor,
  createCoreMockRequestor,
  cleanupCoreTest,
  CORE_MOCK_RESPONSES,
  CORE_TEST_URLS
} from './core-test-helpers'

describe('RequestBuilder 链式调用测试', () => {
  let mockRequestor: CoreMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = createCoreMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupCoreTest(mockRequestor, requestCore)
  })

  describe('基础链式调用', () => {
    test('应该能够创建 RequestBuilder 实例', () => {
      const builder = requestCore.create()

      expect(builder).toBeDefined()
      expect(typeof builder.url).toBe('function')
      expect(typeof builder.method).toBe('function')
      expect(typeof builder.send).toBe('function')
    })

    test('应该能够链式设置 URL', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const result = await requestCore
        .create()
        .url(CORE_TEST_URLS.USER_DETAIL)
        .send()

      expect(result).toEqual(CORE_MOCK_RESPONSES.USER)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.url).toBe(CORE_TEST_URLS.USER_DETAIL)
      expect(lastRequest?.method).toBe('GET') // 默认方法
    })

    test('应该能够链式设置方法', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.CREATED)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .method('POST')
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.method).toBe('POST')
    })

    test('应该能够链式设置数据', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.CREATED)
      const userData = { name: 'John', email: 'john@example.com' }

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .method('POST')
        .data(userData)
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.data).toEqual(userData)
    })
  })

  describe('参数和头部设置', () => {
    test('应该能够设置查询参数', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USERS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .params({ page: 1, limit: 10 })
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.params).toEqual({ page: 1, limit: 10 })
    })

    test('应该能够合并多次设置的参数', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USERS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .params({ page: 1 })
        .params({ limit: 10 })
        .params({ sort: 'name' })
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.params).toEqual({ page: 1, limit: 10, sort: 'name' })
    })

    test('应该能够设置请求头', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .headers({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123'
        })
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123'
      })
    })

    test('应该能够单独设置请求头', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .header('Authorization', 'Bearer token123')
        .header('X-Custom-Header', 'custom-value')
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers).toMatchObject({
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'custom-value'
      })
    })

    test('应该能够合并多次设置的头部', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .headers({ 'Content-Type': 'application/json' })
        .headers({ 'Authorization': 'Bearer token' })
        .header('X-Custom', 'value')
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token',
        'X-Custom': 'value'
      })
    })
  })

  describe('配置选项', () => {
    test('应该能够设置超时时间', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .timeout(10000)
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.timeout).toBe(10000)
    })

    test('应该能够设置标签', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .tag('user-list')
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.tag).toBe('user-list')
    })

    test('应该能够启用调试模式', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .debug(true)
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.debug).toBe(true)
    })

    test('应该能够设置调试模式为默认值', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .debug() // 不传参数，默认为 true
        .send()

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.debug).toBe(true)
    })
  })

  describe('功能特性配置', () => {
    test('应该能够配置重试', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // Mock requestWithRetry 方法
      const requestWithRetrySpy = vi.spyOn(requestCore, 'requestWithRetry')
      requestWithRetrySpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .retry(3)
        .send()

      expect(requestWithRetrySpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: CORE_TEST_URLS.USERS,
          method: 'GET'
        }),
        { retries: 3 }
      )

      requestWithRetrySpy.mockRestore()
    })

    test('应该能够配置缓存', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // Mock requestWithCache 方法
      const requestWithCacheSpy = vi.spyOn(requestCore, 'requestWithCache')
      requestWithCacheSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .cache(300000) // 5分钟
        .send()

      expect(requestWithCacheSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: CORE_TEST_URLS.USERS,
          method: 'GET'
        }),
        { ttl: 300000 }
      )

      requestWithCacheSpy.mockRestore()
    })

    test('应该能够配置幂等性', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // Mock requestIdempotent 方法
      const requestIdempotentSpy = vi.spyOn(requestCore, 'requestIdempotent')
      requestIdempotentSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .idempotent(600000) // 10分钟
        .send()

      expect(requestIdempotentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: CORE_TEST_URLS.USERS,
          method: 'GET'
        }),
        { ttl: 600000 }
      )

      requestIdempotentSpy.mockRestore()
    })

    test('应该能够使用详细的幂等配置', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const requestIdempotentSpy = vi.spyOn(requestCore, 'requestIdempotent')
      requestIdempotentSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const idempotentConfig = {
        ttl: 600000,
        keyGenerator: 'custom',
        storage: 'memory'
      }

      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .idempotentWith(idempotentConfig)
        .send()

      expect(requestIdempotentSpy).toHaveBeenCalledWith(
        expect.objectContaining({
          url: CORE_TEST_URLS.USERS,
          method: 'GET'
        }),
        idempotentConfig
      )

      requestIdempotentSpy.mockRestore()
    })
  })

  describe('响应类型设置', () => {
    test('应该能够设置 JSON 响应类型', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const result = await requestCore
        .create<{ id: number; name: string }>()
        .url(CORE_TEST_URLS.USER_DETAIL)
        .json()
        .send()

      expect(result).toEqual(CORE_MOCK_RESPONSES.USER)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.responseType).toBe('json')
    })

    test('应该能够设置文本响应类型', async () => {
      const textResponse = 'Plain text response'
      mockRequestor.getMock().mockResolvedValue(textResponse)

      const result = await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .text()
        .send()

      expect(result).toBe(textResponse)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.responseType).toBe('text')
    })

    test('应该能够设置 Blob 响应类型', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.BLOB)

      const result = await requestCore
        .create()
        .url(CORE_TEST_URLS.DOWNLOAD)
        .blob()
        .send()

      expect(result).toBe(CORE_MOCK_RESPONSES.BLOB)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.responseType).toBe('blob')
    })

    test('应该能够设置 ArrayBuffer 响应类型', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.ARRAY_BUFFER)

      const result = await requestCore
        .create()
        .url(CORE_TEST_URLS.DOWNLOAD)
        .arrayBuffer()
        .send()

      expect(result).toBe(CORE_MOCK_RESPONSES.ARRAY_BUFFER)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.responseType).toBe('arraybuffer')
    })
  })

  describe('错误处理', () => {
    test('没有设置 URL 时应该抛出错误', async () => {
      await expect(
        requestCore
          .create()
          .method('GET')
          .send()
      ).rejects.toThrow('URL is required')
    })

    test('抛出的错误应该是 RequestError 类型', async () => {
      try {
        await requestCore
          .create()
          .send()
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.VALIDATION_ERROR)
        expect((error as RequestError).code).toBe('BUILDER_NO_URL')
      }
    })
  })

  describe('复杂链式调用', () => {
    test('应该能够组合多个配置选项', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.CREATED)

      const userData = { name: 'John', email: 'john@example.com' }

      const result = await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .method('POST')
        .data(userData)
        .headers({
          'Content-Type': 'application/json',
          'Authorization': 'Bearer token123'
        })
        .header('X-Custom-Header', 'custom-value')
        .params({ validate: true })
        .timeout(15000)
        .tag('create-user')
        .debug(true)
        .send()

      expect(result).toEqual(CORE_MOCK_RESPONSES.CREATED)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest).toMatchObject({
        url: CORE_TEST_URLS.USERS,
        method: 'POST',
        data: userData,
        params: { validate: true },
        timeout: 15000,
        tag: 'create-user',
        debug: true
      })

      expect(lastRequest?.headers).toMatchObject({
        'Content-Type': 'application/json',
        'Authorization': 'Bearer token123',
        'X-Custom-Header': 'custom-value'
      })
    })

    test('应该能够处理功能特性的优先级', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // Mock 所有功能特性方法
      const requestWithRetrySpy = vi.spyOn(requestCore, 'requestWithRetry')
      const requestWithCacheSpy = vi.spyOn(requestCore, 'requestWithCache')
      const requestIdempotentSpy = vi.spyOn(requestCore, 'requestIdempotent')

      requestWithRetrySpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)
      requestWithCacheSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)
      requestIdempotentSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // 设置多个功能特性，测试优先级
      await requestCore
        .create()
        .url(CORE_TEST_URLS.USERS)
        .retry(3)
        .cache(300000)
        .idempotent(600000)
        .send()

      // 根据代码逻辑，重试优先级最高
      expect(requestWithRetrySpy).toHaveBeenCalled()
      expect(requestWithCacheSpy).not.toHaveBeenCalled()
      expect(requestIdempotentSpy).not.toHaveBeenCalled()

      requestWithRetrySpy.mockRestore()
      requestWithCacheSpy.mockRestore()
      requestIdempotentSpy.mockRestore()
    })
  })

  describe('类型安全', () => {
    test('应该支持泛型类型推断', async () => {
      interface User {
        id: number
        name: string
        email: string
      }

      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const result = await requestCore
        .create<User>()
        .url(CORE_TEST_URLS.USER_DETAIL)
        .json<User>()
        .send()

      // TypeScript 应该能够推断出 result 的类型为 User
      expect(result).toEqual(CORE_MOCK_RESPONSES.USER)
      expect(typeof result.id).toBe('number')
      expect(typeof result.name).toBe('string')
    })
  })
})
