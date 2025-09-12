import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { MockRequestor, TEST_URLS, MOCK_RESPONSES } from '../test-helpers'

describe('RequestCore - 便利方法', () => {
  let mockRequestor: MockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new MockRequestor()
    requestCore = new RequestCore(mockRequestor)
    vi.clearAllMocks()
  })

  afterEach(() => {
    if (requestCore) {
      requestCore.destroy()
    }
  })

  describe('基础 HTTP 方法', () => {
    it('应该执行 GET 请求', async () => {
      const mockResponse = { users: [] }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const result = await requestCore.get(TEST_URLS.USERS)

      expect(result).toEqual(mockResponse)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: TEST_URLS.USERS,
          method: 'GET'
        })
      )
    })

    it('应该执行带配置的 GET 请求', async () => {
      const mockResponse = { users: [] }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      await requestCore.get(TEST_URLS.USERS, {
        params: { page: 1 },
        headers: { 'Accept': 'application/json' }
      })

      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: TEST_URLS.USERS,
          method: 'GET',
          params: { page: 1 },
          headers: expect.objectContaining({ 'Accept': 'application/json' })
        })
      )
    })

    it('应该执行 POST 请求', async () => {
      const mockResponse = { id: 1, created: true }
      const postData = { name: 'John', email: 'john@example.com' }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const result = await requestCore.post(TEST_URLS.USERS, postData)

      expect(result).toEqual(mockResponse)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: TEST_URLS.USERS,
          method: 'POST',
          data: postData
        })
      )
    })

    it('应该执行带配置的 POST 请求', async () => {
      const mockResponse = MOCK_RESPONSES.SUCCESS
      const postData = { name: 'John' }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      await requestCore.post(TEST_URLS.USERS, postData, {
        timeout: 5000,
        headers: { 'Content-Type': 'application/json' }
      })

      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: TEST_URLS.USERS,
          method: 'POST',
          data: postData,
          timeout: 5000,
          headers: expect.objectContaining({ 'Content-Type': 'application/json' })
        })
      )
    })

    it('应该执行 PUT 请求', async () => {
      const mockResponse = { updated: true }
      const putData = { name: 'Updated John' }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const result = await requestCore.put(`${TEST_URLS.USERS}/1`, putData)

      expect(result).toEqual(mockResponse)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${TEST_URLS.USERS}/1`,
          method: 'PUT',
          data: putData
        })
      )
    })

    it('应该执行 DELETE 请求', async () => {
      mockRequestor.getMock().mockResolvedValue(MOCK_RESPONSES.DELETED)

      const result = await requestCore.delete(`${TEST_URLS.USERS}/1`)

      expect(result).toEqual(MOCK_RESPONSES.DELETED)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${TEST_URLS.USERS}/1`,
          method: 'DELETE'
        })
      )
    })

    it('应该执行 PATCH 请求', async () => {
      const mockResponse = { patched: true }
      const patchData = { status: 'active' }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const result = await requestCore.patch(`${TEST_URLS.USERS}/1`, patchData)

      expect(result).toEqual(mockResponse)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${TEST_URLS.USERS}/1`,
          method: 'PATCH',
          data: patchData
        })
      )
    })

    it('应该执行 HEAD 请求', async () => {
      mockRequestor.getMock().mockResolvedValue(undefined)

      await requestCore.head(`${TEST_URLS.USERS}/1`)

      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: `${TEST_URLS.USERS}/1`,
          method: 'HEAD'
        })
      )
    })

    it('应该执行 OPTIONS 请求', async () => {
      const mockResponse = { methods: ['GET', 'POST'] }
      mockRequestor.getMock().mockResolvedValue(mockResponse)

      const result = await requestCore.options(TEST_URLS.USERS)

      expect(result).toEqual(mockResponse)
      expect(mockRequestor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: TEST_URLS.USERS,
          method: 'OPTIONS'
        })
      )
    })
  })

  describe('扩展便利方法', () => {
    it('应该执行 JSON POST 请求', async () => {
      const mockResponse = MOCK_RESPONSES.CREATED
      const postJsonSpy = vi.spyOn(requestCore, 'postJson').mockResolvedValue(mockResponse)

      const jsonData = { name: 'test', type: 'json' }
      const result = await requestCore.postJson(TEST_URLS.TEST, jsonData)

      expect(result).toEqual(mockResponse)
      expect(postJsonSpy).toHaveBeenCalledWith(TEST_URLS.TEST, jsonData, undefined)

      postJsonSpy.mockRestore()
    })

    it('应该执行表单 POST 请求', async () => {
      const mockResponse = { submitted: true }
      const postFormSpy = vi.spyOn(requestCore, 'postForm').mockResolvedValue(mockResponse)

      const formData = { name: 'test', email: 'test@example.com' }
      const result = await requestCore.postForm(`${TEST_URLS.API_BASE}/form`, formData)

      expect(result).toEqual(mockResponse)
      expect(postFormSpy).toHaveBeenCalledWith(`${TEST_URLS.API_BASE}/form`, formData, undefined)

      postFormSpy.mockRestore()
    })

    it('应该执行分页请求', async () => {
      const mockResponse = {
        data: [{ id: 1 }, { id: 2 }],
        total: 100,
        page: 1,
        limit: 20,
        hasNext: true,
        hasPrev: false
      }
      const getPaginatedSpy = vi.spyOn(requestCore, 'getPaginated').mockResolvedValue(mockResponse)

      const pagination = { page: 1, limit: 20 }
      const result = await requestCore.getPaginated(`${TEST_URLS.API_BASE}/items`, pagination)

      expect(result).toEqual(mockResponse)
      expect(getPaginatedSpy).toHaveBeenCalledWith(`${TEST_URLS.API_BASE}/items`, pagination, undefined)

      getPaginatedSpy.mockRestore()
    })

    it('应该执行批量请求', async () => {
      const mockResults = [{ id: 1 }, { id: 2 }]
      const batchRequestsSpy = vi.spyOn(requestCore, 'batchRequests').mockResolvedValue(mockResults)

      const requests = [
        { url: `${TEST_URLS.API_BASE}/item1`, method: 'GET' as const },
        { url: `${TEST_URLS.API_BASE}/item2`, method: 'GET' as const }
      ]
      const options = { concurrency: 2, ignoreErrors: false }

      const results = await requestCore.batchRequests(requests, options)

      expect(results).toEqual(mockResults)
      expect(batchRequestsSpy).toHaveBeenCalledWith(requests, options)

      batchRequestsSpy.mockRestore()
    })
  })
})