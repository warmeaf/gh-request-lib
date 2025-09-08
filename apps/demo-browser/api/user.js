import { requestBus } from 'request-bus'
console.log('requestBus', requestBus)

class UserApi {
  constructor(requestCore) {
    this.requestCore = requestCore
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
    const userInfo = await this.requestCore.getWithRetry(url, {
      retries: 3,
      shouldRetry: () => {
        return true
      },
    })

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
    return this.requestCore.getWithCache(url, { ttl: 2 * 60 * 1000 })
  }

  /**
   * 更新用户信息
   * @param userId 用户 ID
   * @param userData 用户数据
   */
  async updateUser(userId, userData) {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`

    console.log(`[UserApi] 更新用户信息: ${userId}`)

    return this.requestCore.put(url, userData)
  }
}

const userApi = requestBus.register('user', UserApi)

export default userApi
