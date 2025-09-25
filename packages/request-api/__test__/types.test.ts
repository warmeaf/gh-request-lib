import { describe, it, expect } from 'vitest'
import type { ApiClass, ApiInstance } from '../src/types'
import { RequestCore } from 'request-core'

describe('Types', () => {
  describe('ApiClass interface', () => {
    it('should define constructor signature correctly', () => {
      // 创建一个模拟的RequestCore实例
      const mockRequestCore = {} as RequestCore

      // 定义一个符合ApiClass接口的类
      class TestApi implements ApiInstance {
        requestCore: RequestCore
        
        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
        }
        
        testMethod() {
          return 'test result'
        }
      }

      // 验证类型兼容性
      const ApiCtor: ApiClass<TestApi> = TestApi
      const instance = new ApiCtor(mockRequestCore)
      
      expect(instance).toBeInstanceOf(TestApi)
      expect(instance.requestCore).toBe(mockRequestCore)
      expect(instance.testMethod()).toBe('test result')
    })

    it('should enforce generic type constraints', () => {
      const mockRequestCore = {} as RequestCore

      // 测试泛型约束 - 必须继承ApiInstance
      class ValidApi implements ApiInstance {
        requestCore: RequestCore
        customMethod(): string { return 'valid' }
        
        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
        }
      }

      // 这应该编译通过
      const validCtor: ApiClass<ValidApi> = ValidApi
      const validInstance = new validCtor(mockRequestCore)
      
      expect(validInstance.requestCore).toBe(mockRequestCore)
      expect(validInstance.customMethod()).toBe('valid')
    })

    it('should work with complex API classes', () => {
      const mockRequestCore = {} as RequestCore

      // 复杂的API类，包含多种方法和属性
      class ComplexApi implements ApiInstance {
        requestCore: RequestCore
        private baseUrl: string
        
        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
          this.baseUrl = 'https://api.example.com'
        }
        
        async getData(id: string): Promise<{ id: string; data: any }> {
          console.log(`Fetching data for id: ${id}`)
          return { id, data: { name: `Item ${id}` } }
        }
        
        getBaseUrl(): string {
          return this.baseUrl
        }
        
        setBaseUrl(url: string): void {
          this.baseUrl = url
        }
      }

      const ComplexCtor: ApiClass<ComplexApi> = ComplexApi
      const instance = new ComplexCtor(mockRequestCore)
      
      expect(instance.requestCore).toBe(mockRequestCore)
      expect(instance.getBaseUrl()).toBe('https://api.example.com')
      
      instance.setBaseUrl('https://new-api.com')
      expect(instance.getBaseUrl()).toBe('https://new-api.com')
    })
  })

  describe('ApiInstance interface', () => {
    it('should require requestCore property', () => {
      const mockRequestCore = {} as RequestCore

      class TestApi implements ApiInstance {
        requestCore: RequestCore
        customProperty: string

        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
          this.customProperty = 'custom value'
        }
      }

      const instance = new TestApi(mockRequestCore)
      
      expect(instance.requestCore).toBe(mockRequestCore)
      expect(instance.customProperty).toBe('custom value')
    })

    it('should allow additional properties and methods', () => {
      const mockRequestCore = {} as RequestCore

      class ExtendedApi implements ApiInstance {
        requestCore: RequestCore
        method1: () => string
        property1: number
        private _internalState: boolean

        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
          this.method1 = () => 'method1 result'
          this.property1 = 42
          this._internalState = true
        }
        
        getInternalState(): boolean {
          return this._internalState
        }
        
        async asyncMethod(): Promise<string> {
          return 'async result'
        }
      }

      const instance = new ExtendedApi(mockRequestCore)
      
      expect(instance.requestCore).toBe(mockRequestCore)
      expect(instance.method1()).toBe('method1 result')
      expect(instance.property1).toBe(42)
      expect(instance.getInternalState()).toBe(true)
    })

    it('should support inheritance patterns', () => {
      const mockRequestCore = {} as RequestCore

      // 基础API类
      abstract class BaseApi implements ApiInstance {
        requestCore: RequestCore
        protected baseConfig: Record<string, any>

        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
          this.baseConfig = { version: 'v1' }
        }

        protected getConfig(): Record<string, any> {
          return this.baseConfig
        }

        abstract getName(): string
      }

      // 具体实现类
      class UserApi extends BaseApi {
        getName(): string {
          return 'UserApi'
        }

        getUsers(): string[] {
          console.log('Getting users with config:', this.getConfig())
          return ['user1', 'user2']
        }
      }

      const instance = new UserApi(mockRequestCore)
      
      expect(instance.requestCore).toBe(mockRequestCore)
      expect(instance.getName()).toBe('UserApi')
      expect(instance.getUsers()).toEqual(['user1', 'user2'])
      expect(instance).toBeInstanceOf(BaseApi)
      expect(instance).toBeInstanceOf(UserApi)
    })

    it('should handle edge cases and validation', () => {
      const mockRequestCore = {} as RequestCore

      class EdgeCaseApi implements ApiInstance {
        requestCore: RequestCore
        
        constructor(requestCore: RequestCore) {
          if (!requestCore) {
            throw new Error('RequestCore is required')
          }
          this.requestCore = requestCore
        }
        
        // 测试各种边界情况
        handleEmptyInput(input?: string): string {
          return input || 'default'
        }
        
        handleNullInput(input: string | null): string {
          return input ?? 'null handled'
        }
        
        handleArrayInput(items: string[]): number {
          return items.length
        }
      }

      const instance = new EdgeCaseApi(mockRequestCore)
      
      expect(instance.requestCore).toBe(mockRequestCore)
      expect(instance.handleEmptyInput()).toBe('default')
      expect(instance.handleEmptyInput('test')).toBe('test')
      expect(instance.handleNullInput(null)).toBe('null handled')
      expect(instance.handleNullInput('value')).toBe('value')
      expect(instance.handleArrayInput([])).toBe(0)
      expect(instance.handleArrayInput(['a', 'b'])).toBe(2)
      
      // 测试构造函数验证
      expect(() => new EdgeCaseApi(null as any)).toThrow('RequestCore is required')
    })
  })

  describe('Type compatibility and constraints', () => {
    it('should ensure type safety with generic constraints', () => {
      const mockRequestCore = {} as RequestCore

      // 测试类型约束确保正确的继承关系
      interface CustomApiInstance extends ApiInstance {
        customMethod(): void
      }

      class CustomApi implements CustomApiInstance {
        requestCore: RequestCore
        
        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
        }
        
        customMethod(): void {
          console.log('Custom method called')
        }
      }

      // 这应该正确工作
      const CustomCtor: ApiClass<CustomApiInstance> = CustomApi
      const instance = new CustomCtor(mockRequestCore)
      
      expect(instance.requestCore).toBe(mockRequestCore)
      expect(typeof instance.customMethod).toBe('function')
      instance.customMethod() // 不应该抛出错误
    })
  })
})