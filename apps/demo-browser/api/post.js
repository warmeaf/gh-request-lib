class PostApi {
  constructor(requestCore) {
    this.requestCore = requestCore
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
    return this.requestCore.getWithCache(url, { ttl: 5 * 60 * 1000 })
  }

  /**
   * 获取单篇文章
   * @param postId 文章 ID
   */
  async getPost(postId) {
    const url = `https://jsonplaceholder.typicode.com/posts/${postId}`

    console.log(`[PostApi] 获取文章: ${postId}`)

    return this.requestCore.getWithRetry(url)
  }

  /**
   * 创建文章
   * @param postData 文章数据
   */
  async createPost(postData) {
    const url = 'https://jsonplaceholder.typicode.com/posts'

    console.log('[PostApi] 创建文章')

    return this.requestCore.post(url, postData)
  }
}

export default PostApi
