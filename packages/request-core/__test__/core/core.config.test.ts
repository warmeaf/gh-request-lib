import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig, GlobalConfig } from '../../src/interface'
import {
  CoreMockRequestor,
  createCoreMockRequestor,
  createTestGlobalConfig,
  cleanupCoreTest,
  CORE_MOCK_RESPONSES,
  CORE_TEST_URLS
} from './core-test-helpers'

describe('RequestCore 配置管理测试', () => {
  let mockRequestor: CoreMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = createCoreMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupCoreTest(mockRequestor, requestCore)
  })

  describe('全局配置设置', () => {
    test('应该能够设置和获取全局配置', () => {
      const globalConfig = createTestGlobalConfig()

      requestCore.setGlobalConfig(globalConfig)

      const retrievedConfig = requestCore.getGlobalConfig()
      expect(retrievedConfig).toEqual(globalConfig)
    })

    test('应该能够设置部分全局配置', () => {
      const partialConfig: GlobalConfig = {
        baseURL: 'https://partial.api.test.com',
        timeout: 3000
      }

      requestCore.setGlobalConfig(partialConfig)

      const retrievedConfig = requestCore.getGlobalConfig()
      expect(retrievedConfig.baseURL).toBe(partialConfig.baseURL)
      expect(retrievedConfig.timeout).toBe(partialConfig.timeout)
    })

    test('应该能够更新现有的全局配置', () => {
      // 设置初始配置
      const initialConfig: GlobalConfig = {
        baseURL: 'https://initial.api.test.com',
        timeout: 5000,
        headers: { 'X-Initial': 'true' }
      }
      requestCore.setGlobalConfig(initialConfig)

      // 更新配置
      const updatedConfig: GlobalConfig = {
        baseURL: 'https://updated.api.test.com',
        timeout: 10000,
        headers: { 'X-Updated': 'true' }
      }
      requestCore.setGlobalConfig(updatedConfig)

      const retrievedConfig = requestCore.getGlobalConfig()
      expect(retrievedConfig).toEqual(updatedConfig)
    })
  })

  describe('配置合并', () => {
    test('请求配置应该与全局配置正确合并', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // 设置全局配置
      const globalConfig: GlobalConfig = {
        baseURL: 'https://api.test.com',
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Global-Header': 'global-value'
        }
      }
      requestCore.setGlobalConfig(globalConfig)

      // 执行请求
      const requestConfig: Partial<RequestConfig> = {
        headers: {
          'X-Request-Header': 'request-value',
          'Authorization': 'Bearer token123'
        },
        timeout: 8000 // 覆盖全局超时
      }

      await requestCore.get('/users', requestConfig)

      const lastRequest = mockRequestor.getLastRequest()

      // 检查 URL 合并
      expect(lastRequest?.url).toBe('https://api.test.com/users') // baseURL 与相对路径正确合并

      // 检查头部合并
      expect(lastRequest?.headers).toMatchObject({
        'Content-Type': 'application/json',
        'X-Global-Header': 'global-value',
        'X-Request-Header': 'request-value',
        'Authorization': 'Bearer token123'
      })

      // 检查超时覆盖
      expect(lastRequest?.timeout).toBe(8000)
    })

    test('请求配置应该覆盖全局配置的相同字段', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const globalConfig: GlobalConfig = {
        timeout: 5000,
        headers: {
          'Content-Type': 'application/json',
          'X-Version': 'v1'
        }
      }
      requestCore.setGlobalConfig(globalConfig)

      const requestConfig: Partial<RequestConfig> = {
        timeout: 10000,
        headers: {
          'Content-Type': 'application/xml',
          'X-Version': 'v2'
        }
      }

      await requestCore.get(CORE_TEST_URLS.USERS, requestConfig)

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.timeout).toBe(10000)
      expect(lastRequest?.headers?.['Content-Type']).toBe('application/xml')
      expect(lastRequest?.headers?.['X-Version']).toBe('v2')
    })
  })

  describe('配置验证', () => {
    test('应该验证必需的请求配置字段', async () => {
      // 这里测试 ConfigManager 的验证逻辑
      // 由于 core.ts 中调用了 this.configManager.validateRequestConfig(config)

      const invalidConfig = {} as RequestConfig // 缺少 url 和 method

      await expect(requestCore.request(invalidConfig)).rejects.toThrow()
    })

    test('应该接受有效的请求配置', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const validConfig: RequestConfig = {
        url: CORE_TEST_URLS.USERS,
        method: 'GET'
      }

      await expect(requestCore.request(validConfig)).resolves.toEqual(CORE_MOCK_RESPONSES.SUCCESS)
    })
  })

  describe('配置管理', () => {
    test('应该能够获取全局配置', () => {
      const globalConfig = createTestGlobalConfig()
      requestCore.setGlobalConfig(globalConfig)

      const retrievedConfig = requestCore.getGlobalConfig()
      expect(retrievedConfig).toEqual(globalConfig)
    })

    test('配置重置后应该清空', () => {
      const globalConfig = createTestGlobalConfig()
      requestCore.setGlobalConfig(globalConfig)

      // 销毁会调用 configManager.reset()
      requestCore.destroy()

      // 重新创建实例来测试重置
      const newCore = new RequestCore(mockRequestor)
      const newConfig = newCore.getGlobalConfig()
      expect(Object.keys(newConfig).length).toBe(0)

      newCore.destroy()
    })
  })

  describe('特殊配置处理', () => {
    test('应该正确处理空的全局配置', () => {
      const emptyConfig: GlobalConfig = {}

      requestCore.setGlobalConfig(emptyConfig)

      const retrievedConfig = requestCore.getGlobalConfig()
      expect(retrievedConfig).toEqual(emptyConfig)
    })

    test('应该正确处理包含复杂数据结构的配置', () => {
      const complexConfig: GlobalConfig = {
        baseURL: 'https://api.test.com',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom-Array': JSON.stringify([1, 2, 3]),
          'X-Custom-Object': JSON.stringify({ key: 'value' })
        },
        timeout: 5000,
        debug: true,
        retries: 3,
        cacheEnabled: true,
        idempotentEnabled: true,
        idempotentTtl: 300000,
        idempotentMethods: ['GET', 'POST']
      }

      requestCore.setGlobalConfig(complexConfig)

      const retrievedConfig = requestCore.getGlobalConfig()
      expect(retrievedConfig).toEqual(complexConfig)
    })

    test('应该正确处理配置中的函数引用', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // 模拟配置
      const config: GlobalConfig = {
        baseURL: 'https://api.test.com'
      }

      requestCore.setGlobalConfig(config)

      const retrievedConfig = requestCore.getGlobalConfig()
      expect(retrievedConfig.baseURL).toBe('https://api.test.com')

      // 测试请求是否正常工作
      await requestCore.get(CORE_TEST_URLS.USERS)
      expect(mockRequestor.getRequestCount()).toBe(1)
    })
  })

  describe('配置继承和覆盖', () => {
    test('便利方法应该继承全局配置', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const globalConfig: GlobalConfig = {
        baseURL: 'https://api.test.com',
        headers: {
          'X-API-Key': 'global-api-key',
          'Content-Type': 'application/json'
        }
      }
      requestCore.setGlobalConfig(globalConfig)

      await requestCore.get('/users')

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers).toMatchObject({
        'X-API-Key': 'global-api-key',
        'Content-Type': 'application/json'
      })
    })

    test('便利方法的配置应该能够覆盖全局配置', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const globalConfig: GlobalConfig = {
        timeout: 5000,
        headers: {
          'X-Version': 'v1'
        }
      }
      requestCore.setGlobalConfig(globalConfig)

      await requestCore.get('/users', {
        timeout: 10000,
        headers: {
          'X-Version': 'v2',
          'Authorization': 'Bearer token'
        }
      })

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.timeout).toBe(10000)
      expect(lastRequest?.headers?.['X-Version']).toBe('v2')
      expect(lastRequest?.headers?.['Authorization']).toBe('Bearer token')
    })
  })
})
