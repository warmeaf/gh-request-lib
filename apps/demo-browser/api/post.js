import { busApi } from 'request-bus'

class PostApi {
  constructor(core) {
    this.core = core
  }

  /**
   * 获取文章列表
   * @param userId 可选的用户 ID 过滤
   */
  async getPosts(userId) {
    let url = 'https://jsonplaceholder.typicode.com/posts'

    if (userId) {
      url += `?userId=${userId}`
    }

    console.log('[PostApi] 获取文章列表')

    // 使用带缓存的请求
    return this.core.getWithCache(url, { ttl: 5 * 60 * 1000 })
  }

  /**
   * 获取单篇文章
   * @param postId 文章 ID
   */
  async getPost(postId) {
    const url = `https://jsonplaceholder.typicode.com/posts/${postId}`

    console.log(`[PostApi] 获取文章: ${postId}`)

    return this.core.getWithRetry(url)
  }

  /**
   * 创建文章
   * @param postData 文章数据
   */
  async createPost(postData) {
    const url = 'https://jsonplaceholder.typicode.com/posts'

    console.log('[PostApi] 创建文章')

    return this.core.post(url, postData)
  }
}

busApi.register('post', PostApi)

export default busApi.getApi('post')
