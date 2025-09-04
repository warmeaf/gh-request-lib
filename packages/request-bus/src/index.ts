import { RequestConfig, RequestImplementation } from './config'
import { UserApi } from './apis/user'
import { PostApi } from './apis/post'

/**
 * @description 业务层 API 集合
 */
class BusApi {
  public user: UserApi
  public post: PostApi

  constructor() {
    this.user = new UserApi()
    this.post = new PostApi()
  }

  /**
   * 切换请求实现
   * @param implementation 实现方式
   */
  switchImplementation(implementation: RequestImplementation): void {
    RequestConfig.reset()
    RequestConfig.createRequestCore(implementation)
    
    // 重新创建 API 实例
    this.user = new UserApi()
    this.post = new PostApi()
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
export type { UserInfo } from './apis/user'
export type { PostInfo } from './apis/post'
export type { RequestImplementation } from './config'

// 导出类（如果需要创建多个实例）
export { BusApi, UserApi, PostApi }
