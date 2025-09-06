import { RequestConfig, RequestImplementation } from './config'
import { RequestCore } from 'request-core'

/**
 * @description API 类的接口定义
 */
interface ApiClass {
  new (requestCore: RequestCore): ApiInstance
}

/**
 * @description API 实例的接口定义
 */
interface ApiInstance {
  requestCore: RequestCore
  [key: string]: any
}

/**
 * @description 业务层 API 集合
 */
class RequestBus {
  private apiMap: Map<string, ApiInstance> = new Map()

  register(name: string, apiClass: ApiClass): ApiInstance {
    if (!name) {
      throw new Error('name is required')
    }
    if (!apiClass) {
      throw new Error('apiClass is required')
    }
    if (this.apiMap.has(name)) {
      throw new Error(`${name} already registered`)
    }

    const apiInstance = new apiClass(RequestConfig.getInstance())
    this.apiMap.set(name, apiInstance)
    return apiInstance
  }

  deleteApi(name: string): void {
    if (!name) {
      throw new Error('name is required')
    }
    this.apiMap.delete(name)
  }

  deleteAllApi(): void {
    this.apiMap.clear()
  }

  getApi(name: string): ApiInstance | undefined {
    if (!name) {
      throw new Error('name is required')
    }
    return this.apiMap.get(name)
  }

  /**
   * 切换请求实现
   * @param implementation 实现方式
   */
  switchImplementation(implementation: RequestImplementation): void {
    RequestConfig.reset()
    RequestConfig.createRequestCore(implementation)

    this.apiMap.forEach((api) => {
      api.requestCore = RequestConfig.getInstance()
    })
  }

  /**
   * 清除缓存
   * @param key 缓存键
   */
  clearCache(key?: string): void {
    RequestConfig.getInstance().clearCache(key)
  }

  /**
   * 清除所有缓存
   */
  clearAllCache(): void {
    RequestConfig.getInstance().clearCache()
  }
}

// 创建并导出单例
export const requestBus = new RequestBus()

// 导出类型
export type { RequestImplementation } from './config'
export type { ApiClass, ApiInstance }

export { RequestBus }
