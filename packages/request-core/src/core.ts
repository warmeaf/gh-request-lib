import { Requestor, RequestConfig } from './interface'
import { RetryFeature, RetryConfig } from './features/retry'
import { CacheFeature, CacheConfig } from './features/cache'

/**
 * @description 核心层，封装与具体实现无关的高级功能。
 */
export class RequestCore {
  private retryFeature: RetryFeature
  private cacheFeature: CacheFeature

  /**
   * 通过依赖注入接收一个实现了 Requestor 接口的实例。
   * @param requestor 具体的请求实现者。
   */
  constructor(private requestor: Requestor) {
    this.retryFeature = new RetryFeature(requestor)
    this.cacheFeature = new CacheFeature(requestor)
  }

  /**
   * 基础请求方法
   */
  async request<T>(config: RequestConfig): Promise<T> {
    return this.requestor.request<T>(config)
  }

  /**
   * GET 请求
   */
  async get<T>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ url, method: 'GET', ...config })
  }

  /**
   * POST 请求
   */
  async post<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ url, method: 'POST', data, ...config })
  }

  /**
   * PUT 请求
   */
  async put<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ url, method: 'PUT', data, ...config })
  }

  /**
   * DELETE 请求
   */
  async delete<T>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ url, method: 'DELETE', ...config })
  }

  /**
   * 带重试的请求
   */
  async requestWithRetry<T>(config: RequestConfig, retryConfig?: RetryConfig): Promise<T> {
    return this.retryFeature.requestWithRetry<T>(config, retryConfig)
  }

  /**
   * 带重试的 GET 请求
   */
  async getWithRetry<T>(url: string, retries: number = 3): Promise<T> {
    return this.requestWithRetry<T>({ url, method: 'GET' }, { retries })
  }

  /**
   * 带缓存的请求
   */
  async requestWithCache<T>(config: RequestConfig, cacheConfig?: CacheConfig): Promise<T> {
    return this.cacheFeature.requestWithCache<T>(config, cacheConfig)
  }

  /**
   * 带缓存的 GET 请求
   */
  async getWithCache<T>(url: string, cacheConfig?: CacheConfig): Promise<T> {
    return this.requestWithCache<T>({ url, method: 'GET' }, cacheConfig)
  }

  /**
   * 清除缓存
   */
  clearCache(key?: string): void {
    this.cacheFeature.clearCache(key)
  }
}
