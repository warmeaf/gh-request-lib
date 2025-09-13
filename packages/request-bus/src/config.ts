import { RequestCore } from 'request-core'
import { AxiosRequestor } from 'request-imp-axios'
import { FetchRequestor } from 'request-imp-fetch'

/**
 * @description 请求实现类型
 */
export type RequestImplementation = 'axios' | 'fetch'

/**
 * @description 请求核心工厂类，负责创建独立的 RequestCore 实例
 */
export class RequestCoreFactory {
  /**
   * 创建独立的请求核心实例 - 每次调用都返回新实例
   * @param implementation 选择的实现方式
   */
  static create(implementation: RequestImplementation = 'axios'): RequestCore {
    let requestor
    
    switch (implementation) {
      case 'axios':
        console.log('[RequestCoreFactory] Creating Axios implementation')
        requestor = new AxiosRequestor()
        break
      case 'fetch':
        console.log('[RequestCoreFactory] Creating Fetch implementation')
        requestor = new FetchRequestor()
        break
      default:
        throw new Error(`Unsupported implementation: ${implementation}`)
    }
    
    return new RequestCore(requestor)
  }
}
