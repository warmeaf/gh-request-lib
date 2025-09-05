import { busApi } from 'request-bus'
console.log('busApi', busApi)

class UserApi {
  constructor(core) {
    this.core = core
  }

  /**
   * 获取用户信息
   * @param userId 用户 ID
   */
  async getUserInfo(userId) {
    // 模拟公司内部协议规定的 URL 格式
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`

    console.log(`[UserApi] 获取用户信息: ${userId}`)

    // 使用带重试的请求
    const userInfo = await this.core.getWithRetry(url, 2)

    // 业务层数据转换
    return {
      ...userInfo,
      fetchTime: new Date().toISOString(),
    }
  }

  /**
   * 获取用户列表（带缓存）
   */
  async getUserList() {
    const url = 'https://jsonplaceholder.typicode.com/users'

    console.log('[UserApi] 获取用户列表')

    // 使用带缓存的请求，缓存 2 分钟
    return this.core.getWithCache(url, { ttl: 2 * 60 * 1000 })
  }

  /**
   * 更新用户信息
   * @param userId 用户 ID
   * @param userData 用户数据
   */
  async updateUser(userId, userData) {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`

    console.log(`[UserApi] 更新用户信息: ${userId}`)

    return this.core.put(url, userData)
  }
}

busApi.register('user', UserApi)

export default busApi.getApi('user')
