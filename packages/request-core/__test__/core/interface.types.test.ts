import { describe, it, expect, vi } from 'vitest'
import {
  RequestParams,
  RequestData,
  FileUploadOptions,
  PaginationParams,
  PaginatedResponse,
} from '../../src/interface'

describe('基础类型定义测试', () => {
  describe('RequestParams', () => {
    it('应该接受所有有效的参数类型', () => {
      const testCases = [
        { key: 'page', value: 1, expectedType: 'number' },
        { key: 'active', value: true, expectedType: 'boolean' },
        { key: 'search', value: 'test', expectedType: 'string' },
        { key: 'empty', value: null, expectedType: 'object' },
        { key: 'undefined', value: undefined, expectedType: 'undefined' },
      ]

      const validParams: RequestParams = {}
      testCases.forEach(({ key, value, expectedType }) => {
        validParams[key] = value
        expect(typeof validParams[key]).toBe(expectedType)
      })
    })

    it('应该支持复杂的参数组合', () => {
      const complexParams: RequestParams = {
        page: 1,
        size: 20,
        sort: 'name',
        order: 'asc',
        active: true,
        categoryId: 123,
        tags: null,
        metadata: undefined,
      }

      expect(complexParams.page).toBe(1)
      expect(complexParams.size).toBe(20)
      expect(complexParams.sort).toBe('name')
      expect(complexParams.order).toBe('asc')
      expect(complexParams.active).toBe(true)
      expect(complexParams.categoryId).toBe(123)
      expect(complexParams.tags).toBeNull()
      expect(complexParams.metadata).toBeUndefined()
    })

    it('应该正确处理特殊值', () => {
      const specialParams: RequestParams = {
        zero: 0,
        emptyString: '',
        false: false,
        null: null,
        undefined: undefined,
      }

      expect(specialParams.zero).toBe(0)
      expect(specialParams.emptyString).toBe('')
      expect(specialParams.false).toBe(false)
      expect(specialParams.null).toBeNull()
      expect(specialParams.undefined).toBeUndefined()
    })
  })

  describe('RequestData', () => {
    it('应该支持基本数据类型', () => {
      const dataTypes = [
        { data: { name: 'test' }, type: 'object', check: (d: any) => typeof d === 'object' && !Array.isArray(d) },
        { data: 'test string', type: 'string', check: (d: any) => typeof d === 'string' },
        { data: 42, type: 'number', check: (d: any) => typeof d === 'number' },
        { data: true, type: 'boolean', check: (d: any) => typeof d === 'boolean' },
        { data: null, type: 'null', check: (d: any) => d === null },
        { data: undefined, type: 'undefined', check: (d: any) => d === undefined },
      ]

      dataTypes.forEach(({ data, type, check }) => {
        const requestData: RequestData = data
        expect(check(requestData)).toBe(true)
      })
    })

    it('应该支持Web API对象类型', () => {
      const webApiTypes = [
        { data: new FormData(), constructor: FormData },
        { data: new Blob(['test']), constructor: Blob },
        { data: new URLSearchParams(), constructor: URLSearchParams },
      ]

      webApiTypes.forEach(({ data, constructor }) => {
        const requestData: RequestData = data
        expect(requestData).toBeInstanceOf(constructor)
      })
    })

    it('应该支持复杂对象结构', () => {
      const complexObject = {
        user: {
          id: 1,
          name: 'John',
          profile: {
            age: 30,
            settings: {
              theme: 'dark',
              notifications: true,
            }
          }
        },
        items: ['item1', 'item2'],
        metadata: {
          version: '1.0',
          timestamp: Date.now(),
        }
      }

      const requestData: RequestData = complexObject
      expect(requestData).toEqual(complexObject)
      expect((requestData as any).user.name).toBe('John')
      expect((requestData as any).user.profile.settings.theme).toBe('dark')
    })

    it('应该支持特殊的JavaScript对象', () => {
      const specialObjects = [
        new Date(),
        new ArrayBuffer(8),
        new Uint8Array([1, 2, 3]),
        /test-regex/g,
      ]

      specialObjects.forEach(obj => {
        const requestData: RequestData = obj as any
        expect(requestData).toBe(obj)
      })
    })
  })

  describe('FileUploadOptions', () => {
    it('应该支持完整的文件上传选项', () => {
      const progressCallback = vi.fn()
      const fileOptions: FileUploadOptions = {
        file: new File(['test'], 'test.txt'),
        name: 'upload',
        filename: 'test.txt',
        contentType: 'text/plain',
        additionalData: { category: 'document' },
        onProgress: progressCallback,
      }

      // 验证基本属性
      expect(fileOptions.file).toBeInstanceOf(File)
      expect(fileOptions.name).toBe('upload')
      expect(fileOptions.filename).toBe('test.txt')
      expect(fileOptions.contentType).toBe('text/plain')
      expect(fileOptions.additionalData?.category).toBe('document')

      // 测试进度回调
      expect(fileOptions.onProgress).toBe(progressCallback)
      fileOptions.onProgress?.(50)
      expect(progressCallback).toHaveBeenCalledWith(50)
    })

    it('应该支持Blob类型文件', () => {
      const blobFile = new Blob(['test content'], { type: 'text/plain' })
      const options: FileUploadOptions = { file: blobFile }
      
      expect(options.file).toBeInstanceOf(Blob)
      expect(options.file).not.toBeInstanceOf(File)
    })

    it('应该支持最小配置的文件上传', () => {
      const minimalOptions: FileUploadOptions = {
        file: new File(['content'], 'file.txt')
      }

      expect(minimalOptions.file).toBeInstanceOf(File)
      expect(minimalOptions.name).toBeUndefined()
      expect(minimalOptions.filename).toBeUndefined()
      expect(minimalOptions.contentType).toBeUndefined()
      expect(minimalOptions.additionalData).toBeUndefined()
      expect(minimalOptions.onProgress).toBeUndefined()
    })

    it('应该支持复杂的附加数据', () => {
      const complexAdditionalData = {
        category: 'image',
        priority: 1,
        public: true,
        tags: ['photo', 'upload'],
        metadata: {
          source: 'user',
          timestamp: Date.now(),
        }
      }

      const options: FileUploadOptions = {
        file: new File(['image data'], 'image.jpg'),
        additionalData: complexAdditionalData as any
      }

      expect(options.additionalData).toEqual(complexAdditionalData)
    })

    it('应该正确处理进度回调', () => {
      const progressValues: number[] = []
      const progressCallback = (progress: number) => {
        progressValues.push(progress)
      }

      const options: FileUploadOptions = {
        file: new File(['data'], 'file.txt'),
        onProgress: progressCallback,
      }

      // 模拟进度更新
      const testProgresses = [0, 25, 50, 75, 100]
      testProgresses.forEach(progress => {
        options.onProgress?.(progress)
      })

      expect(progressValues).toEqual(testProgresses)
    })
  })

  describe('PaginationParams', () => {
    it('应该支持完整的分页参数', () => {
      const fullPagination: PaginationParams = {
        page: 1,
        limit: 20,
        offset: 0,
        size: 20,
      }

      const expectedValues = { page: 1, limit: 20, offset: 0, size: 20 }
      Object.entries(expectedValues).forEach(([key, value]) => {
        expect(fullPagination[key as keyof PaginationParams]).toBe(value)
      })
    })

    it('应该支持部分分页参数', () => {
      const partialPaginations = [
        { page: 2 },
        { limit: 50 },
        { offset: 100 },
        { page: 1, limit: 10 },
        { page: 3, offset: 60 },
        { limit: 25, size: 25 },
      ]

      partialPaginations.forEach((pagination) => {
        const params: PaginationParams = pagination
        Object.entries(pagination).forEach(([key, value]) => {
          expect(params[key as keyof PaginationParams]).toBe(value)
        })
      })
    })

    it('应该支持零值和边界值', () => {
      const boundaryPaginations = [
        { page: 0, limit: 0, offset: 0, size: 0 },
        { page: 1, limit: 1 },
        { page: 999999, limit: 1000 },
        { offset: 999999 },
      ]

      boundaryPaginations.forEach((pagination) => {
        const params: PaginationParams = pagination
        expect(params).toEqual(pagination)
      })
    })

    it('应该处理空的分页参数对象', () => {
      const emptyPagination: PaginationParams = {}
      
      expect(emptyPagination.page).toBeUndefined()
      expect(emptyPagination.limit).toBeUndefined()
      expect(emptyPagination.offset).toBeUndefined()
      expect(emptyPagination.size).toBeUndefined()
    })
  })

  describe('PaginatedResponse', () => {
    it('应该支持泛型数据类型', () => {
      type TestItem = { id: number; name: string }
      const testData: TestItem[] = [
        { id: 1, name: 'Item 1' },
        { id: 2, name: 'Item 2' },
      ]

      const response: PaginatedResponse<TestItem> = {
        data: testData,
        total: 100,
        page: 1,
        limit: 20,
        hasNext: true,
        hasPrev: false,
      }

      expect(response.data).toEqual(testData)
      expect(response.data).toHaveLength(2)
      expect(response.total).toBe(100)
      expect(response.page).toBe(1)
      expect(response.limit).toBe(20)
      expect(response.hasNext).toBe(true)
      expect(response.hasPrev).toBe(false)
    })

    it('应该处理空数据列表', () => {
      const emptyResponse: PaginatedResponse<any> = {
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        hasNext: false,
        hasPrev: false,
      }

      expect(emptyResponse.data).toHaveLength(0)
      expect(emptyResponse.total).toBe(0)
      expect(emptyResponse.hasNext).toBe(false)
      expect(emptyResponse.hasPrev).toBe(false)
    })

    it('应该支持复杂的数据类型', () => {
      interface ComplexItem {
        id: string
        metadata: {
          created: Date
          tags: string[]
          nested: {
            value: number
          }
        }
        optional?: string
      }

      const complexData: ComplexItem[] = [
        {
          id: 'item1',
          metadata: {
            created: new Date(),
            tags: ['tag1', 'tag2'],
            nested: { value: 42 }
          }
        },
        {
          id: 'item2',
          metadata: {
            created: new Date(),
            tags: [],
            nested: { value: 0 }
          },
          optional: 'present'
        }
      ]

      const response: PaginatedResponse<ComplexItem> = {
        data: complexData,
        total: 2,
        page: 1,
        limit: 10,
        hasNext: false,
        hasPrev: false,
      }

      expect(response.data).toHaveLength(2)
      expect(response.data[0].id).toBe('item1')
      expect(response.data[0].metadata.tags).toEqual(['tag1', 'tag2'])
      expect(response.data[1].optional).toBe('present')
    })

    it('应该正确处理分页逻辑边界', () => {
      const testCases = [
        // 第一页
        { page: 1, total: 100, limit: 20, expectedHasNext: true, expectedHasPrev: false },
        // 中间页
        { page: 3, total: 100, limit: 20, expectedHasNext: true, expectedHasPrev: true },
        // 最后一页
        { page: 5, total: 100, limit: 20, expectedHasNext: false, expectedHasPrev: true },
        // 只有一页
        { page: 1, total: 10, limit: 20, expectedHasNext: false, expectedHasPrev: false },
        // 零记录
        { page: 1, total: 0, limit: 20, expectedHasNext: false, expectedHasPrev: false },
      ]

      testCases.forEach(({ page, total, limit, expectedHasNext, expectedHasPrev }) => {
        const response: PaginatedResponse<any> = {
          data: [],
          total,
          page,
          limit,
          hasNext: expectedHasNext,
          hasPrev: expectedHasPrev,
        }

        expect(response.hasNext).toBe(expectedHasNext)
        expect(response.hasPrev).toBe(expectedHasPrev)
      })
    })

    it('应该支持不同的数据项类型', () => {
      // 字符串数组
      const stringResponse: PaginatedResponse<string> = {
        data: ['item1', 'item2', 'item3'],
        total: 3,
        page: 1,
        limit: 10,
        hasNext: false,
        hasPrev: false,
      }

      // 数字数组
      const numberResponse: PaginatedResponse<number> = {
        data: [1, 2, 3, 4, 5],
        total: 5,
        page: 1,
        limit: 10,
        hasNext: false,
        hasPrev: false,
      }

      // 混合类型（通过 union 类型）
      type MixedItem = string | number | { id: number }
      const mixedResponse: PaginatedResponse<MixedItem> = {
        data: ['text', 42, { id: 1 }],
        total: 3,
        page: 1,
        limit: 10,
        hasNext: false,
        hasPrev: false,
      }

      expect(stringResponse.data).toEqual(['item1', 'item2', 'item3'])
      expect(numberResponse.data).toEqual([1, 2, 3, 4, 5])
      expect(mixedResponse.data).toEqual(['text', 42, { id: 1 }])
    })
  })

  describe('类型边界和兼容性测试', () => {
    it('应该正确处理 RequestParams 的类型约束', () => {
      // 这些应该是有效的
      const validParams: RequestParams[] = [
        {},
        { key: 'string' },
        { num: 123 },
        { bool: true },
        { nullVal: null },
        { undefinedVal: undefined },
        { mixed: 'string', num: 123, bool: false },
      ]

      validParams.forEach(params => {
        expect(typeof params).toBe('object')
      })
    })

    it('应该正确处理 RequestData 的类型灵活性', () => {
      // 测试各种有效的 RequestData 值
      const validDataValues: RequestData[] = [
        null,
        undefined,
        'string',
        123,
        true,
        { key: 'value' },
        new FormData(),
        new Blob(['data']),
        new URLSearchParams(),
        new ArrayBuffer(8),
      ]

      validDataValues.forEach(data => {
        // 类型检查应该通过，这里我们只是验证赋值不会抛错
        const requestData: RequestData = data
        expect(requestData).toBe(data)
      })
    })

    it('应该验证 FileUploadOptions 的必需和可选字段', () => {
      // 最小有效配置
      const minimal: FileUploadOptions = {
        file: new File([''], 'test.txt')
      }
      expect(minimal.file).toBeInstanceOf(File)

      // 完整配置
      const complete: FileUploadOptions = {
        file: new Blob(['data']),
        name: 'upload',
        filename: 'data.bin',
        contentType: 'application/octet-stream',
        additionalData: { key: 'value' },
        onProgress: vi.fn(),
      }
      expect(complete.file).toBeInstanceOf(Blob)
      expect(complete.name).toBe('upload')
    })

    it('应该验证分页接口的可选性', () => {
      // 所有字段都是可选的
      const paginations: PaginationParams[] = [
        {},
        { page: 1 },
        { limit: 20 },
        { offset: 0 },
        { size: 10 },
        { page: 1, limit: 20 },
        { page: 1, limit: 20, offset: 0, size: 20 },
      ]

      paginations.forEach(pagination => {
        expect(pagination).toBeDefined()
      })
    })

    it('应该验证 PaginatedResponse 的泛型约束', () => {
      // 确保泛型类型正确传递
      const stringResponse: PaginatedResponse<string> = {
        data: ['a', 'b', 'c'],
        total: 3,
        page: 1,
        limit: 10,
        hasNext: false,
        hasPrev: false,
      }

      const numberResponse: PaginatedResponse<number> = {
        data: [1, 2, 3],
        total: 3,
        page: 1,
        limit: 10,
        hasNext: false,
        hasPrev: false,
      }

      // TypeScript 应该正确推断类型
      const firstString: string = stringResponse.data[0]
      const firstNumber: number = numberResponse.data[0]

      expect(typeof firstString).toBe('string')
      expect(typeof firstNumber).toBe('number')
    })
  })
})
