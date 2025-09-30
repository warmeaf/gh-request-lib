import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig, RequestError, RequestErrorType } from '../../src/interface'
import {
  CoreMockRequestor,
  createCoreMockRequestor,
  createTestGlobalConfig,
  cleanupCoreTest,
  CORE_MOCK_RESPONSES,
  CORE_TEST_URLS
} from './core-test-helpers'

describe('RequestCore 基础功能测试', () => {
  let mockRequestor: CoreMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = createCoreMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupCoreTest(mockRequestor, requestCore)
  })

  describe('构造函数和初始化', () => {
    test('应该正确初始化 RequestCore 实例', () => {
      expect(requestCore).toBeInstanceOf(RequestCore)
      expect(mockRequestor.getRequestCount()).toBe(0)
    })

    test('应该正确初始化带有全局配置的 RequestCore', () => {
      const globalConfig = createTestGlobalConfig()
      const coreWithConfig = new RequestCore(mockRequestor, globalConfig)

      expect(coreWithConfig.getGlobalConfig()).toEqual(globalConfig)
      expect(coreWithConfig.getInterceptors()).toHaveLength(2)

      coreWithConfig.destroy()
    })
  })

  describe('基础请求方法', () => {
    test('应该正确执行 GET 请求', async () => {
      // 设置 mock 返回值
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USER_DETAIL,
        method: 'GET'
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.USER)
      expect(mockRequestor.getRequestCount()).toBe(1)
      expect(mockRequestor.getLastRequest()).toMatchObject(config)
    })

    test('应该正确执行 POST 请求', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.CREATED)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'POST',
        data: { name: 'John Doe', email: 'john@example.com' }
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.CREATED)
      expect(mockRequestor.getLastRequest()).toMatchObject(config)
    })

    test('应该正确执行 PUT 请求', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.UPDATED)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USER_DETAIL,
        method: 'PUT',
        data: { name: 'John Updated' }
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.UPDATED)
      expect(mockRequestor.getLastRequest()).toMatchObject(config)
    })

    test('应该正确执行 DELETE 请求', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.DELETED)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USER_DETAIL,
        method: 'DELETE'
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.DELETED)
      expect(mockRequestor.getLastRequest()).toMatchObject(config)
    })

    test('应该正确执行 PATCH 请求', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.UPDATED)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USER_DETAIL,
        method: 'PATCH',
        data: { email: 'john.updated@example.com' }
      }

      const result = await requestCore.request(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.UPDATED)
      expect(mockRequestor.getLastRequest()).toMatchObject(config)
    })
  })

  describe('便利方法', () => {
    test('get() 方法应该正确工作', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const result = await requestCore.get(CORE_TEST_URLS.USER_DETAIL)

      expect(result).toEqual(CORE_MOCK_RESPONSES.USER)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.method).toBe('GET')
      expect(lastRequest?.url).toBe(CORE_TEST_URLS.USER_DETAIL)
    })

    test('post() 方法应该正确工作', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.CREATED)
      const userData = { name: 'John', email: 'john@example.com' }

      const result = await requestCore.post(CORE_TEST_URLS.USERS, userData)

      expect(result).toEqual(CORE_MOCK_RESPONSES.CREATED)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.method).toBe('POST')
      expect(lastRequest?.url).toBe(CORE_TEST_URLS.USERS)
      expect(lastRequest?.data).toEqual(userData)
    })

    test('put() 方法应该正确工作', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.UPDATED)
      const updateData = { name: 'John Updated' }

      const result = await requestCore.put(CORE_TEST_URLS.USER_DETAIL, updateData)

      expect(result).toEqual(CORE_MOCK_RESPONSES.UPDATED)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.method).toBe('PUT')
      expect(lastRequest?.url).toBe(CORE_TEST_URLS.USER_DETAIL)
      expect(lastRequest?.data).toEqual(updateData)
    })

    test('delete() 方法应该正确工作', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.DELETED)

      const result = await requestCore.delete(CORE_TEST_URLS.USER_DETAIL)

      expect(result).toEqual(CORE_MOCK_RESPONSES.DELETED)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.method).toBe('DELETE')
      expect(lastRequest?.url).toBe(CORE_TEST_URLS.USER_DETAIL)
    })

    test('patch() 方法应该正确工作', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.UPDATED)
      const patchData = { email: 'john.new@example.com' }

      const result = await requestCore.patch(CORE_TEST_URLS.USER_DETAIL, patchData)

      expect(result).toEqual(CORE_MOCK_RESPONSES.UPDATED)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.method).toBe('PATCH')
      expect(lastRequest?.url).toBe(CORE_TEST_URLS.USER_DETAIL)
      expect(lastRequest?.data).toEqual(patchData)
    })

    test('head() 方法应该正确工作', async () => {
      mockRequestor.getMock().mockResolvedValue(undefined)

      await requestCore.head(CORE_TEST_URLS.USER_DETAIL)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.method).toBe('HEAD')
      expect(lastRequest?.url).toBe(CORE_TEST_URLS.USER_DETAIL)
    })

    test('options() 方法应该正确工作', async () => {
      const optionsResponse = {
        allow: ['GET', 'POST', 'PUT', 'DELETE'],
        'content-type': 'application/json'
      }
      mockRequestor.getMock().mockResolvedValue(optionsResponse)

      const result = await requestCore.options(CORE_TEST_URLS.USER_DETAIL)

      expect(result).toEqual(optionsResponse)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.method).toBe('OPTIONS')
      expect(lastRequest?.url).toBe(CORE_TEST_URLS.USER_DETAIL)
    })
  })

  describe('配置传递', () => {
    test('应该正确传递额外的请求配置', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const config = {
        headers: { 'X-Custom-Header': 'custom-value' },
        timeout: 10000,
        params: { include: 'profile' }
      }

      await requestCore.get(CORE_TEST_URLS.USER_DETAIL, config)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers).toMatchObject(config.headers)
      expect(lastRequest?.timeout).toBe(config.timeout)
      expect(lastRequest?.params).toEqual(config.params)
    })
  })

  describe('错误处理', () => {
    test('应该正确处理请求错误', async () => {
      const error = new Error('Network error')
      mockRequestor.setReject(error)

      await expect(requestCore.request({
        url: CORE_TEST_URLS.ERROR,
        method: 'GET'
      })).rejects.toThrow('Network error')
    })

    test('应该将普通错误转换为 RequestError', async () => {
      const error = new Error('Generic error')
      mockRequestor.setReject(error)

      try {
        await requestCore.get(CORE_TEST_URLS.ERROR)
      } catch (err) {
        expect(err).toBeInstanceOf(RequestError)
        expect((err as RequestError).message).toBe('Generic error')
      }
    })

    test('应该保持 RequestError 类型不变', async () => {
      const requestError = new RequestError('Request failed', {
        type: RequestErrorType.NETWORK_ERROR,
        code: 'NETWORK_TIMEOUT'
      })
      mockRequestor.setReject(requestError)

      try {
        await requestCore.get(CORE_TEST_URLS.ERROR)
      } catch (err) {
        expect(err).toBe(requestError)
        expect((err as RequestError).type).toBe(RequestErrorType.NETWORK_ERROR)
        expect((err as RequestError).code).toBe('NETWORK_TIMEOUT')
      }
    })
  })

  describe('execute() 方法', () => {
    test('execute() 应该与 request() 方法行为一致', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const config: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'GET'
      }

      const result = await requestCore.execute(config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
      expect(mockRequestor.getLastRequest()).toMatchObject(config)
    })
  })

  describe('统计方法', () => {
    test('getGlobalConfig() 应该返回当前全局配置', () => {
      const globalConfig = createTestGlobalConfig()
      requestCore.setGlobalConfig(globalConfig)

      const retrievedConfig = requestCore.getGlobalConfig()
      expect(retrievedConfig).toEqual(globalConfig)
    })

    test('getAllStats() 应该返回所有统计信息', () => {
      const stats = requestCore.getAllStats()

      expect(stats).toHaveProperty('cache')
      expect(stats).toHaveProperty('concurrent')
      expect(stats).toHaveProperty('interceptors')
      expect(stats).toHaveProperty('config')
    })
  })

  describe('资源清理', () => {
    test('destroy() 应该正确清理所有资源', () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => { })

      requestCore.destroy()

      expect(consoleSpy).toHaveBeenCalledWith('[RequestCore] All resources have been cleaned up')

      consoleSpy.mockRestore()
    })
  })
})
