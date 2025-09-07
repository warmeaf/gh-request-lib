import { RequestConfig, RequestImplementation } from './config'
import { RequestCore } from 'request-core'

/**
 * @description API 类的接口定义
 */
interface ApiClass<T extends ApiInstance = ApiInstance> {
  new (requestCore: RequestCore): T
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

  register<T extends ApiInstance>(name: string, apiClass: ApiClass<T>): T {
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

  getApi<T extends ApiInstance = ApiInstance>(name: string): T | undefined {
    if (!name) {
      throw new Error('name is required')
    }
    return this.apiMap.get(name) as T | undefined
  }

  /**
   * 切换请求实现
   * @param implementation 实现方式
   * @param options 可选项：是否清空缓存
   */
  switchImplementation(implementation: RequestImplementation, options?: { clearCache?: boolean }): void {
    const shouldClear = Boolean(options?.clearCache)
    if (shouldClear) {
      try { RequestConfig.getInstance().clearCache() } catch {}
    }

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

  /**
   * 销毁所有资源
   */
  destroy(): void {
    try {
      RequestConfig.getInstance().destroy()
    } catch {}
    this.deleteAllApi()
  }
}

// 创建并导出单例
export const requestBus = new RequestBus()

// 导出类型
export type { RequestImplementation } from './config'
export type { ApiClass, ApiInstance }

export { RequestBus }
