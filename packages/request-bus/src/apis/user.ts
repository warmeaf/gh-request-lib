import { RequestConfig } from '../config'

/**
 * @description 用户信息接口
 */
export interface UserInfo {
  id: string
  name: string
  email: string
  avatar?: string
}

/**
 * @description 用户相关 API
 */
export class UserApi {
  private core = RequestConfig.getInstance()

  /**
   * 获取用户信息
   * @param userId 用户 ID
   */
  async getUserInfo(userId: string): Promise<UserInfo & { fetchTime: string }> {
    // 模拟公司内部协议规定的 URL 格式
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`
    
    console.log(`[UserApi] 获取用户信息: ${userId}`)

    // 使用带重试的请求
    const userInfo = await this.core.getWithRetry<UserInfo>(url, 2)

    // 业务层数据转换
    return {
      ...userInfo,
      fetchTime: new Date().toISOString(),
    }
  }

  /**
   * 获取用户列表（带缓存）
   */
  async getUserList(): Promise<UserInfo[]> {
    const url = 'https://jsonplaceholder.typicode.com/users'
    
    console.log('[UserApi] 获取用户列表')

    // 使用带缓存的请求，缓存 2 分钟
    return this.core.getWithCache<UserInfo[]>(url, { ttl: 2 * 60 * 1000 })
  }

  /**
   * 更新用户信息
   * @param userId 用户 ID
   * @param userData 用户数据
   */
  async updateUser(userId: string, userData: Partial<UserInfo>): Promise<UserInfo> {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`
    
    console.log(`[UserApi] 更新用户信息: ${userId}`)

    return this.core.put<UserInfo>(url, userData)
  }
}
