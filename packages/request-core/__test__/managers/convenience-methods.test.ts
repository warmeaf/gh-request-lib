import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConvenienceMethods, ConvenienceExecutor } from '../../src/managers/convenience-methods'
import { RequestConfig } from '../../src/interface'

// Mock executor implementation
class MockExecutor implements ConvenienceExecutor {
  private mockFn = vi.fn()

  async execute<T>(config: RequestConfig): Promise<T> {
    return this.mockFn(config) as Promise<T>
  }

  getMock() {
    return this.mockFn
  }

  reset() {
    this.mockFn.mockReset()
  }
}

describe('ConvenienceMethods', () => {
  let mockExecutor: MockExecutor
  let methods: ConvenienceMethods

  beforeEach(() => {
    mockExecutor = new MockExecutor()
    methods = new ConvenienceMethods(mockExecutor)
  })

  describe('构造函数', () => {
    it('should create instance with valid executor', () => {
      expect(() => {
        new ConvenienceMethods(mockExecutor)
      }).not.toThrow()
    })

    it('should throw error for invalid executor', () => {
      expect(() => {
        new ConvenienceMethods(null as any)
      }).toThrow('ConvenienceMethods requires an executor with execute method')

      expect(() => {
        new ConvenienceMethods({} as any)
      }).toThrow('ConvenienceMethods requires an executor with execute method')
    })
  })

  describe('基础HTTP方法', () => {
    it('should execute GET request', async () => {
      mockExecutor.getMock().mockResolvedValue({ data: 'test' })

      const result = await methods.get('https://api.example.com/users')

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'GET'
      })
      expect(result).toEqual({ data: 'test' })
    })

    it('should execute GET request with config', async () => {
      mockExecutor.getMock().mockResolvedValue({ data: 'test' })

      await methods.get('https://api.example.com/users', {
        headers: { 'Authorization': 'Bearer token' }
      })

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: { 'Authorization': 'Bearer token' }
      })
    })

    it('should execute POST request', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const data = { name: 'John', email: 'john@example.com' }
      await methods.post('https://api.example.com/users', data)

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'POST',
        data
      })
    })

    it('should execute POST request without data', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      await methods.post('https://api.example.com/users')

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'POST',
        data: undefined
      })
    })

    it('should execute PUT request', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const data = { name: 'John Updated' }
      await methods.put('https://api.example.com/users/1', data)

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users/1',
        method: 'PUT',
        data
      })
    })

    it('should execute DELETE request', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      await methods.delete('https://api.example.com/users/1')

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users/1',
        method: 'DELETE'
      })
    })

    it('should execute PATCH request', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const data = { status: 'active' }
      await methods.patch('https://api.example.com/users/1', data)

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users/1',
        method: 'PATCH',
        data
      })
    })

    it('should execute HEAD request', async () => {
      mockExecutor.getMock().mockResolvedValue(undefined)

      await methods.head('https://api.example.com/users')

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'HEAD'
      })
    })

    it('should execute OPTIONS request', async () => {
      mockExecutor.getMock().mockResolvedValue({ methods: ['GET', 'POST'] })

      await methods.options('https://api.example.com/users')

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'OPTIONS'
      })
    })
  })

  describe('内容类型特定方法', () => {
    it('should execute JSON POST request', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const data = { name: 'John' }
      await methods.postJson('https://api.example.com/users', data)

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'POST',
        data,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    })

    it('should merge headers in JSON POST', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const data = { name: 'John' }
      await methods.postJson('https://api.example.com/users', data, {
        headers: { 'Authorization': 'Bearer token' }
      })

      expect(mockExecutor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer token'
          }
        })
      )
    })

    it('should execute JSON PUT request', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const data = { name: 'John' }
      await methods.putJson('https://api.example.com/users/1', data)

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users/1',
        method: 'PUT',
        data,
        headers: {
          'Content-Type': 'application/json'
        }
      })
    })

    it('should execute form POST request', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const data = { name: 'John', age: 25, active: true }
      await methods.postForm('https://api.example.com/users', data)

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      expect(callArgs.url).toBe('https://api.example.com/users')
      expect(callArgs.method).toBe('POST')
      expect(callArgs.data).toBeInstanceOf(URLSearchParams)
      expect(callArgs.headers?.['Content-Type']).toBe('application/x-www-form-urlencoded')
    })

    it('should convert all values to strings in form data', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const data = { name: 'John', age: 25, active: true }
      await methods.postForm('https://api.example.com/users', data)

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      const formData = callArgs.data as URLSearchParams

      expect(formData.get('name')).toBe('John')
      expect(formData.get('age')).toBe('25')
      expect(formData.get('active')).toBe('true')
    })
  })

  describe('文件操作', () => {
    it('should upload single file', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const file = new Blob(['file content'], { type: 'text/plain' })
      await methods.uploadFile('https://api.example.com/upload', { file })

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      expect(callArgs.url).toBe('https://api.example.com/upload')
      expect(callArgs.method).toBe('POST')
      expect(callArgs.data).toBeInstanceOf(FormData)
    })

    it('should upload file with custom field name', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const file = new Blob(['file content'], { type: 'text/plain' })
      await methods.uploadFile('https://api.example.com/upload', {
        file,
        name: 'document'
      })

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      expect(callArgs.data).toBeInstanceOf(FormData)
    })

    it('should upload file with filename', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const file = new Blob(['file content'], { type: 'text/plain' })
      await methods.uploadFile('https://api.example.com/upload', {
        file,
        filename: 'document.txt'
      })

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      expect(callArgs.data).toBeInstanceOf(FormData)
    })

    it('should upload file with additional data', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const file = new Blob(['file content'], { type: 'text/plain' })
      await methods.uploadFile('https://api.example.com/upload', {
        file,
        additionalData: {
          userId: '123',
          category: 'documents'
        }
      })

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      expect(callArgs.data).toBeInstanceOf(FormData)
    })

    it('should upload multiple files', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const file1 = new Blob(['file 1'], { type: 'text/plain' })
      const file2 = new Blob(['file 2'], { type: 'text/plain' })

      await methods.uploadMultipleFiles('https://api.example.com/upload', [
        { file: file1, name: 'file1' },
        { file: file2, name: 'file2' }
      ])

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      expect(callArgs.data).toBeInstanceOf(FormData)
    })

    it('should upload multiple files with additional data', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      const file1 = new Blob(['file 1'], { type: 'text/plain' })

      await methods.uploadMultipleFiles(
        'https://api.example.com/upload',
        [{ file: file1 }],
        { userId: '123' }
      )

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      expect(callArgs.data).toBeInstanceOf(FormData)
    })

    it('should download file', async () => {
      const blob = new Blob(['file content'], { type: 'text/plain' })
      mockExecutor.getMock().mockResolvedValue(blob)

      const result = await methods.downloadFile('https://api.example.com/download/file.txt')

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/download/file.txt',
        method: 'GET',
        responseType: 'blob'
      })
      expect(result).toBe(blob)
    })

    it('should download file with config', async () => {
      const blob = new Blob(['file content'], { type: 'text/plain' })
      mockExecutor.getMock().mockResolvedValue(blob)

      await methods.downloadFile('https://api.example.com/download/file.txt', 'downloaded.txt', {
        headers: { 'Authorization': 'Bearer token' }
      })

      expect(mockExecutor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          responseType: 'blob',
          headers: { 'Authorization': 'Bearer token' }
        })
      )
    })
  })

  describe('分页方法', () => {
    it('should execute paginated request with defaults', async () => {
      mockExecutor.getMock().mockResolvedValue({
        data: [{ id: 1 }, { id: 2 }],
        total: 100,
        page: 1,
        limit: 20,
        hasNext: true,
        hasPrev: false
      })

      await methods.getPaginated('https://api.example.com/users')

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'GET',
        params: {
          page: 1,
          limit: 20
        }
      })
    })

    it('should execute paginated request with custom params', async () => {
      mockExecutor.getMock().mockResolvedValue({
        data: [],
        total: 100,
        page: 2,
        limit: 50,
        hasNext: true,
        hasPrev: true
      })

      await methods.getPaginated('https://api.example.com/users', {
        page: 2,
        limit: 50
      })

      expect(mockExecutor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            page: 2,
            limit: 50
          })
        })
      )
    })

    it('should support size parameter as alias for limit', async () => {
      mockExecutor.getMock().mockResolvedValue({
        data: [],
        total: 100,
        page: 1,
        limit: 30,
        hasNext: true,
        hasPrev: false
      })

      await methods.getPaginated('https://api.example.com/users', {
        size: 30
      })

      expect(mockExecutor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            limit: 30
          })
        })
      )
    })

    it('should get all paginated data', async () => {
      mockExecutor.getMock()
        .mockResolvedValueOnce({
          data: [{ id: 1 }, { id: 2 }],
          total: 5,
          page: 1,
          limit: 2,
          hasNext: true,
          hasPrev: false
        })
        .mockResolvedValueOnce({
          data: [{ id: 3 }, { id: 4 }],
          total: 5,
          page: 2,
          limit: 2,
          hasNext: true,
          hasPrev: true
        })
        .mockResolvedValueOnce({
          data: [{ id: 5 }],
          total: 5,
          page: 3,
          limit: 2,
          hasNext: false,
          hasPrev: true
        })

      const result = await methods.getAllPaginated('https://api.example.com/users', {
        pageSize: 2
      })

      expect(result).toHaveLength(5)
      expect(result[0]).toEqual({ id: 1 })
      expect(result[4]).toEqual({ id: 5 })
    })

    it('should respect maxPages limit', async () => {
      mockExecutor.getMock()
        .mockResolvedValue({
          data: [{ id: 1 }],
          total: 1000,
          page: 1,
          limit: 1,
          hasNext: true,
          hasPrev: false
        })

      const result = await methods.getAllPaginated('https://api.example.com/users', {
        maxPages: 3,
        pageSize: 1
      })

      expect(mockExecutor.getMock()).toHaveBeenCalledTimes(3)
      expect(result).toHaveLength(3)
    })

    it('should call onProgress callback', async () => {
      const onProgress = vi.fn()

      mockExecutor.getMock()
        .mockResolvedValueOnce({
          data: [{ id: 1 }],
          total: 2,
          page: 1,
          limit: 1,
          hasNext: true,
          hasPrev: false
        })
        .mockResolvedValueOnce({
          data: [{ id: 2 }],
          total: 2,
          page: 2,
          limit: 1,
          hasNext: false,
          hasPrev: true
        })

      await methods.getAllPaginated('https://api.example.com/users', {
        pageSize: 1,
        onProgress
      })

      expect(onProgress).toHaveBeenCalledTimes(2)
      expect(onProgress).toHaveBeenLastCalledWith(2, 2, expect.any(Array))
    })
  })

  describe('工具方法', () => {
    it('should execute multiple GET requests in parallel', async () => {
      mockExecutor.getMock()
        .mockResolvedValueOnce({ id: 1, name: 'User 1' })
        .mockResolvedValueOnce({ id: 2, name: 'User 2' })
        .mockResolvedValueOnce({ id: 3, name: 'User 3' })

      const urls = [
        'https://api.example.com/users/1',
        'https://api.example.com/users/2',
        'https://api.example.com/users/3'
      ]

      const results = await methods.getMultiple(urls)

      expect(results).toHaveLength(3)
      expect(results[0]).toEqual({ id: 1, name: 'User 1' })
      expect(mockExecutor.getMock()).toHaveBeenCalledTimes(3)
    })

    it('should execute multiple GET requests sequentially', async () => {
      const order: number[] = []

      mockExecutor.getMock()
        .mockImplementation(async () => {
          order.push(1)
          await new Promise(resolve => setTimeout(resolve, 10))
          return { data: 'test' }
        })

      const urls = [
        'https://api.example.com/users/1',
        'https://api.example.com/users/2'
      ]

      await methods.getSequential(urls)

      expect(order).toEqual([1, 1])
      expect(mockExecutor.getMock()).toHaveBeenCalledTimes(2)
    })

    it('should perform health check successfully', async () => {
      mockExecutor.getMock().mockResolvedValue({ status: 'ok' })

      const result = await methods.healthCheck('https://api.example.com/health')

      expect(result).toBe(true)
      expect(mockExecutor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          url: 'https://api.example.com/health',
          timeout: 5000
        })
      )
    })

    it('should handle health check failure', async () => {
      mockExecutor.getMock().mockRejectedValue(new Error('Connection failed'))

      const result = await methods.healthCheck('https://api.example.com/health')

      expect(result).toBe(false)
    })

    it('should use custom timeout in health check', async () => {
      mockExecutor.getMock().mockResolvedValue({ status: 'ok' })

      await methods.healthCheck('https://api.example.com/health', { timeout: 10000 })

      expect(mockExecutor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          timeout: 10000
        })
      )
    })
  })

  describe('支持的方法统计', () => {
    it('should return list of supported methods', () => {
      const supported = methods.getSupportedMethods()

      expect(supported.basic).toContain('get')
      expect(supported.basic).toContain('post')
      expect(supported.basic).toContain('put')
      expect(supported.basic).toContain('delete')
      expect(supported.basic).toContain('patch')
      expect(supported.basic).toContain('head')
      expect(supported.basic).toContain('options')
    })

    it('should list convenience methods', () => {
      const supported = methods.getSupportedMethods()

      expect(supported.convenience).toContain('postJson')
      expect(supported.convenience).toContain('putJson')
      expect(supported.convenience).toContain('postForm')
    })

    it('should list file methods', () => {
      const supported = methods.getSupportedMethods()

      expect(supported.file).toContain('uploadFile')
      expect(supported.file).toContain('uploadMultipleFiles')
      expect(supported.file).toContain('downloadFile')
    })

    it('should list pagination methods', () => {
      const supported = methods.getSupportedMethods()

      expect(supported.pagination).toContain('getPaginated')
      expect(supported.pagination).toContain('getAllPaginated')
    })

    it('should list utility methods', () => {
      const supported = methods.getSupportedMethods()

      expect(supported.utility).toContain('getMultiple')
      expect(supported.utility).toContain('getSequential')
      expect(supported.utility).toContain('healthCheck')
    })
  })

  describe('边界情况', () => {
    it('should handle empty URL', async () => {
      mockExecutor.getMock().mockResolvedValue({ data: 'test' })

      await methods.get('')

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: '',
        method: 'GET'
      })
    })

    it('should handle null data in POST', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      await methods.post('https://api.example.com/users', null as any)

      expect(mockExecutor.getMock()).toHaveBeenCalledWith({
        url: 'https://api.example.com/users',
        method: 'POST',
        data: null
      })
    })

    it('should handle empty form data', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      await methods.postForm('https://api.example.com/users', {})

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      expect(callArgs.data).toBeInstanceOf(URLSearchParams)
    })

    it('should handle empty file list in multiple upload', async () => {
      mockExecutor.getMock().mockResolvedValue({ success: true })

      await methods.uploadMultipleFiles('https://api.example.com/upload', [])

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      expect(callArgs.data).toBeInstanceOf(FormData)
    })

    it('should handle empty URL list in getMultiple', async () => {
      const results = await methods.getMultiple([])

      expect(results).toEqual([])
      expect(mockExecutor.getMock()).not.toHaveBeenCalled()
    })

    it('should handle empty URL list in getSequential', async () => {
      const results = await methods.getSequential([])

      expect(results).toEqual([])
      expect(mockExecutor.getMock()).not.toHaveBeenCalled()
    })

    it('should handle pagination with hasNext=false from start', async () => {
      mockExecutor.getMock().mockResolvedValue({
        data: [{ id: 1 }],
        total: 1,
        page: 1,
        limit: 20,
        hasNext: false,
        hasPrev: false
      })

      const result = await methods.getAllPaginated('https://api.example.com/users')

      expect(result).toHaveLength(1)
      expect(mockExecutor.getMock()).toHaveBeenCalledTimes(1)
    })

    it('should merge existing params with pagination params', async () => {
      mockExecutor.getMock().mockResolvedValue({
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        hasNext: false,
        hasPrev: false
      })

      await methods.getPaginated(
        'https://api.example.com/users',
        { page: 1 },
        { params: { status: 'active' } }
      )

      expect(mockExecutor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            page: 1,
            limit: 20,
            status: 'active'
          })
        })
      )
    })

    it('should handle file upload with File object', async () => {
      // 在Node环境中模拟File对象
      const file = new Blob(['content'], { type: 'text/plain' }) as any
      mockExecutor.getMock().mockResolvedValue({ success: true })

      await methods.uploadFile('https://api.example.com/upload', { file })

      const callArgs = mockExecutor.getMock().mock.calls[0][0]
      expect(callArgs.data).toBeInstanceOf(FormData)
    })

    it('should handle very large page number', async () => {
      mockExecutor.getMock().mockResolvedValue({
        data: [],
        total: 1000,
        page: 999,
        limit: 20,
        hasNext: false,
        hasPrev: true
      })

      await methods.getPaginated('https://api.example.com/users', { page: 999 })

      expect(mockExecutor.getMock()).toHaveBeenCalledWith(
        expect.objectContaining({
          params: expect.objectContaining({
            page: 999
          })
        })
      )
    })
  })
})
