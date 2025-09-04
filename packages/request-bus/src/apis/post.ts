import { RequestConfig } from '../config'

/**
 * @description 文章信息接口
 */
export interface PostInfo {
  id: number
  userId: number
  title: string
  body: string
}

/**
 * @description 文章相关 API
 */
export class PostApi {
  private core = RequestConfig.getInstance()

  /**
   * 获取文章列表
   * @param userId 可选的用户 ID 过滤
   */
  async getPosts(userId?: number): Promise<PostInfo[]> {
    let url = 'https://jsonplaceholder.typicode.com/posts'
    
    if (userId) {
      url += `?userId=${userId}`
    }
    
    console.log('[PostApi] 获取文章列表')

    // 使用带缓存的请求
    return this.core.getWithCache<PostInfo[]>(url, { ttl: 5 * 60 * 1000 })
  }

  /**
   * 获取单篇文章
   * @param postId 文章 ID
   */
  async getPost(postId: number): Promise<PostInfo> {
    const url = `https://jsonplaceholder.typicode.com/posts/${postId}`
    
    console.log(`[PostApi] 获取文章: ${postId}`)

    return this.core.getWithRetry<PostInfo>(url)
  }

  /**
   * 创建文章
   * @param postData 文章数据
   */
  async createPost(postData: Omit<PostInfo, 'id'>): Promise<PostInfo> {
    const url = 'https://jsonplaceholder.typicode.com/posts'
    
    console.log('[PostApi] 创建文章')

    return this.core.post<PostInfo>(url, postData)
  }
}
