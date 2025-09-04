import { RequestCore } from 'request-core'
import { AxiosRequestor } from 'request-imp-axios'
import { FetchRequestor } from 'request-imp-fetch'

/**
 * @description 请求实现类型
 */
export type RequestImplementation = 'axios' | 'fetch'

/**
 * @description 配置类，负责选择并注入具体的实现
 */
export class RequestConfig {
  private static instance: RequestCore
  
  /**
   * 创建请求核心实例
   * @param implementation 选择的实现方式
   */
  static createRequestCore(implementation: RequestImplementation = 'axios'): RequestCore {
    if (!this.instance) {
      let requestor
      
      switch (implementation) {
        case 'axios':
          console.log('[Config] 使用 Axios 实现')
          requestor = new AxiosRequestor()
          break
        case 'fetch':
          console.log('[Config] 使用 Fetch 实现')
          requestor = new FetchRequestor()
          break
        default:
          throw new Error(`不支持的实现方式: ${implementation}`)
      }
      
      this.instance = new RequestCore(requestor)
    }
    
    return this.instance
  }

  /**
   * 获取当前实例
   */
  static getInstance(): RequestCore {
    if (!this.instance) {
      return this.createRequestCore()
    }
    return this.instance
  }

  /**
   * 重置实例（用于切换实现）
   */
  static reset(): void {
    this.instance = null as any
  }
}
