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

    it('should allow additional properties', () => {
      const mockRequestCore = {} as RequestCore

      class ExtendedApi implements ApiInstance {
        requestCore: RequestCore
        method1: () => string
        property1: number

        constructor(requestCore: RequestCore) {
          this.requestCore = requestCore
          this.method1 = () => 'method1 result'
          this.property1 = 42
        }
      }

      const instance = new ExtendedApi(mockRequestCore)
      
      expect(instance.requestCore).toBe(mockRequestCore)
      expect(instance.method1()).toBe('method1 result')
      expect(instance.property1).toBe(42)
    })
  })
})