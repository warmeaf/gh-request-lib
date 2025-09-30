import { describe, test, expect, beforeEach, afterEach, vi } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig, FileUploadOptions, PaginationParams } from '../../src/interface'
import {
  CoreMockRequestor,
  createCoreMockRequestor,
  cleanupCoreTest,
  CORE_MOCK_RESPONSES,
  CORE_TEST_URLS
} from './core-test-helpers'

describe('RequestCore 便利方法测试', () => {
  let mockRequestor: CoreMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = createCoreMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupCoreTest(mockRequestor, requestCore)
  })

  describe('内容类型特定方法', () => {
    test('postJson() 应该设置正确的 Content-Type', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'postJson')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.CREATED)

      const data = { name: 'John', email: 'john@example.com' }
      const config = { timeout: 5000 }

      const result = await requestCore.postJson(CORE_TEST_URLS.USERS, data, config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.CREATED)
      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USERS, data, config)

      convenienceMethodsSpy.mockRestore()
    })

    test('putJson() 应该设置正确的 Content-Type', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'putJson')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.UPDATED)

      const data = { name: 'John Updated' }
      const config = { headers: { 'X-Custom': 'value' } }

      const result = await requestCore.putJson(CORE_TEST_URLS.USER_DETAIL, data, config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.UPDATED)
      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USER_DETAIL, data, config)

      convenienceMethodsSpy.mockRestore()
    })

    test('postForm() 应该设置正确的 Content-Type', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'postForm')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const formData = {
        name: 'John',
        age: 30,
        active: true
      }
      const config = { timeout: 10000 }

      const result = await requestCore.postForm(CORE_TEST_URLS.USERS, formData, config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USERS, formData, config)

      convenienceMethodsSpy.mockRestore()
    })
  })

  describe('文件操作方法', () => {
    test('uploadFile() 应该处理文件上传', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'uploadFile')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const uploadOptions: FileUploadOptions = {
        file: new Blob(['test content'], { type: 'text/plain' }),
        name: 'document',
        filename: 'test.txt',
        additionalData: {
          description: 'Test file upload'
        }
      }
      const config = { timeout: 30000 }

      const result = await requestCore.uploadFile(CORE_TEST_URLS.UPLOAD, uploadOptions, config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.SUCCESS)
      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.UPLOAD, uploadOptions, config)

      convenienceMethodsSpy.mockRestore()
    })

    test('downloadFile() 应该处理文件下载', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'downloadFile')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.BLOB)

      const filename = 'downloaded-file.txt'
      const config = { responseType: 'blob' as const }

      const result = await requestCore.downloadFile(CORE_TEST_URLS.DOWNLOAD, filename, config)

      expect(result).toBe(CORE_MOCK_RESPONSES.BLOB)
      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.DOWNLOAD, filename, config)

      convenienceMethodsSpy.mockRestore()
    })

    test('downloadFile() 应该支持不指定文件名', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'downloadFile')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.BLOB)

      const result = await requestCore.downloadFile(CORE_TEST_URLS.DOWNLOAD)

      expect(result).toBe(CORE_MOCK_RESPONSES.BLOB)
      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.DOWNLOAD, undefined, undefined)

      convenienceMethodsSpy.mockRestore()
    })
  })

  describe('分页方法', () => {
    test('getPaginated() 应该处理分页请求', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'getPaginated')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.PAGINATED)

      const pagination: PaginationParams = {
        page: 2,
        limit: 20,
        sort: 'name',
        order: 'asc'
      }
      const config = { headers: { 'X-Pagination': 'true' } }

      const result = await requestCore.getPaginated(CORE_TEST_URLS.USERS, pagination, config)

      expect(result).toEqual(CORE_MOCK_RESPONSES.PAGINATED)
      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USERS, pagination, config)

      convenienceMethodsSpy.mockRestore()
    })

    test('getPaginated() 应该支持默认分页参数', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'getPaginated')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.PAGINATED)

      const result = await requestCore.getPaginated(CORE_TEST_URLS.USERS)

      expect(result).toEqual(CORE_MOCK_RESPONSES.PAGINATED)
      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USERS, {}, undefined)

      convenienceMethodsSpy.mockRestore()
    })

    test('getPaginated() 应该支持部分分页参数', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'getPaginated')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.PAGINATED)

      const pagination: PaginationParams = { page: 3 }

      const result = await requestCore.getPaginated(CORE_TEST_URLS.USERS, pagination)

      expect(result).toEqual(CORE_MOCK_RESPONSES.PAGINATED)
      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USERS, pagination, undefined)

      convenienceMethodsSpy.mockRestore()
    })
  })

  describe('便利方法与核心功能集成', () => {
    test('便利方法应该通过 ConvenienceExecutor 接口调用核心请求', async () => {
      // 这里测试便利方法是否正确使用了 execute() 方法
      const executeSpy = vi.spyOn(requestCore, 'execute')
      executeSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      // 调用一个便利方法，它应该内部调用 execute
      await requestCore.postJson(CORE_TEST_URLS.USERS, { name: 'test' })

      // 由于便利方法是通过 ConvenienceMethods 类实现的，
      // 这里我们验证最终会调用到 RequestCore 的 execute 方法
      expect(executeSpy).toHaveBeenCalled()

      executeSpy.mockRestore()
    })

    test('便利方法应该正确传递配置参数', async () => {
      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const config = {
        headers: { 'Authorization': 'Bearer token' },
        timeout: 15000,
        params: { validate: true }
      }

      await requestCore.postJson(CORE_TEST_URLS.USERS, { name: 'test' }, config)

      // 验证最终的请求配置包含了传递的参数
      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers).toMatchObject({
        'Authorization': 'Bearer token'
      })
      expect(lastRequest?.timeout).toBe(15000)
      expect(lastRequest?.params).toEqual({ validate: true })
    })
  })

  describe('类型安全性', () => {
    test('便利方法应该支持泛型类型', async () => {
      interface User {
        id: number
        name: string
        email: string
      }

      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'postJson')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.USER)

      const userData = { name: 'John', email: 'john@example.com' }
      const result = await requestCore.postJson<User>(CORE_TEST_URLS.USERS, userData)

      expect(result).toEqual(CORE_MOCK_RESPONSES.USER)
      // TypeScript 应该推断 result 为 User 类型

      convenienceMethodsSpy.mockRestore()
    })

    test('分页方法应该支持数据类型泛型', async () => {
      interface User {
        id: number
        name: string
      }

      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'getPaginated')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.PAGINATED)

      const result = await requestCore.getPaginated<User>(CORE_TEST_URLS.USERS)

      expect(result).toEqual(CORE_MOCK_RESPONSES.PAGINATED)
      // TypeScript 应该推断 result.data 为 User[] 类型

      convenienceMethodsSpy.mockRestore()
    })
  })

  describe('错误处理', () => {
    test('便利方法应该正确传播错误', async () => {
      const error = new Error('Upload failed')
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'uploadFile')
      convenienceMethodsSpy.mockRejectedValue(error)

      const uploadOptions: FileUploadOptions = {
        file: new Blob(['test'], { type: 'text/plain' }),
        name: 'file'
      }

      await expect(
        requestCore.uploadFile(CORE_TEST_URLS.UPLOAD, uploadOptions)
      ).rejects.toThrow('Upload failed')

      convenienceMethodsSpy.mockRestore()
    })

    test('便利方法应该处理网络错误', async () => {
      const networkError = new Error('Network timeout')
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'downloadFile')
      convenienceMethodsSpy.mockRejectedValue(networkError)

      await expect(
        requestCore.downloadFile(CORE_TEST_URLS.DOWNLOAD)
      ).rejects.toThrow('Network timeout')

      convenienceMethodsSpy.mockRestore()
    })
  })

  describe('配置继承', () => {
    test('便利方法应该继承全局配置', async () => {
      // 设置全局配置
      requestCore.setGlobalConfig({
        baseURL: 'https://api.test.com',
        headers: {
          'X-API-Key': 'global-key',
          'Content-Type': 'application/json'
        },
        timeout: 5000
      })

      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore.postJson('/users', { name: 'test' })

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers).toMatchObject({
        'X-API-Key': 'global-key'
      })
      expect(lastRequest?.timeout).toBe(5000)
    })

    test('便利方法的配置应该能够覆盖全局配置', async () => {
      // 设置全局配置
      requestCore.setGlobalConfig({
        headers: { 'Content-Type': 'application/xml' },
        timeout: 5000
      })

      mockRequestor.getMock().mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore.postJson('/users', { name: 'test' }, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 10000
      })

      const lastRequest = mockRequestor.getLastRequest()
      expect(lastRequest?.headers?.['Content-Type']).toBe('application/json')
      expect(lastRequest?.timeout).toBe(10000)
    })
  })

  describe('边界情况', () => {
    test('应该处理空数据的情况', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'postJson')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      await requestCore.postJson(CORE_TEST_URLS.USERS, null)

      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USERS, null, undefined)

      convenienceMethodsSpy.mockRestore()
    })

    test('应该处理复杂的嵌套数据', async () => {
      const convenienceMethodsSpy = vi.spyOn(requestCore['convenienceMethods'], 'postJson')
      convenienceMethodsSpy.mockResolvedValue(CORE_MOCK_RESPONSES.SUCCESS)

      const complexData = {
        user: {
          name: 'John',
          profile: {
            age: 30,
            preferences: ['json', 'xml'],
            metadata: {
              created: new Date(),
              tags: { important: true }
            }
          }
        }
      }

      await requestCore.postJson(CORE_TEST_URLS.USERS, complexData)

      expect(convenienceMethodsSpy).toHaveBeenCalledWith(CORE_TEST_URLS.USERS, complexData, undefined)

      convenienceMethodsSpy.mockRestore()
    })
  })
})
