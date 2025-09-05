import { RequestConfig, RequestImplementation } from './config'

/**
 * @description 业务层 API 集合
 */
class BusApi {
  private apiMap: Map<string, any> = new Map()

  register(name: string, apiClass: any): void {
    this.apiMap.set(name, new apiClass(RequestConfig.getInstance()))
  }

  clearApiMap(): void {
    this.apiMap.clear()
  }

  getApi(name: string): any {
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
      api.core = RequestConfig.getInstance()
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
export const busApi = new BusApi()

// 导出类型
export type { RequestImplementation } from './config'

export { BusApi }
