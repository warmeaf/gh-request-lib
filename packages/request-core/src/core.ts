import { Requestor, RequestConfig, RequestError } from './interface'
import { RetryFeature, RetryConfig } from './features/retry'
import { CacheFeature, CacheConfig } from './features/cache'
import { ConcurrentFeature, ConcurrentConfig, ConcurrentResult } from './features/concurrent'

/**
 * @description 核心层，封装与具体实现无关的高级功能。
 */
export class RequestCore {
  private retryFeature: RetryFeature
  private cacheFeature: CacheFeature
  private concurrentFeature: ConcurrentFeature

  /**
   * 通过依赖注入接收一个实现了 Requestor 接口的实例。
   * @param requestor 具体的请求实现者。
   */
  constructor(private requestor: Requestor) {
    this.retryFeature = new RetryFeature(requestor)
    this.cacheFeature = new CacheFeature(requestor)
    this.concurrentFeature = new ConcurrentFeature(requestor)
  }

  /**
   * 验证请求配置
   */
  private validateConfig(config: RequestConfig): void {
    if (!config) {
      throw new RequestError('Request config is required')
    }
    if (!config.url || typeof config.url !== 'string') {
      throw new RequestError('URL is required and must be a string')
    }
    if (!config.method) {
      throw new RequestError('HTTP method is required')
    }
    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout < 0)) {
      throw new RequestError('Timeout must be a positive number')
    }
  }

  /**
   * 执行请求并处理性能监控
   */
  private async executeWithMonitoring<T>(config: RequestConfig): Promise<T> {
    const startTime = performance.now()
    
    try {
      config.onStart?.(config)
      const result = await this.requestor.request<T>(config)
      const duration = performance.now() - startTime
      config.onEnd?.(config, duration)
      return result
    } catch (error) {
      const duration = performance.now() - startTime
      config.onError?.(config, error, duration)
      throw error
    }
  }

  /**
   * 基础请求方法
   */
  async request<T>(config: RequestConfig): Promise<T> {
    this.validateConfig(config)
    return this.executeWithMonitoring<T>(config)
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

  /**
   * 并发请求
   * @param configs 请求配置数组
   * @param concurrentConfig 并发配置
   */
  async requestConcurrent<T>(
    configs: RequestConfig[],
    concurrentConfig?: ConcurrentConfig
  ): Promise<ConcurrentResult<T>[]> {
    return this.concurrentFeature.requestConcurrent<T>(configs, concurrentConfig)
  }

  /**
   * 并发执行多个相同配置的请求
   * @param config 请求配置
   * @param count 请求次数
   * @param concurrentConfig 并发配置
   */
  async requestMultiple<T>(
    config: RequestConfig,
    count: number,
    concurrentConfig?: ConcurrentConfig
  ): Promise<ConcurrentResult<T>[]> {
    return this.concurrentFeature.requestMultiple<T>(config, count, concurrentConfig)
  }

  /**
   * 并发 GET 请求
   * @param urls URL数组
   * @param concurrentConfig 并发配置
   */
  async getConcurrent<T>(
    urls: string[],
    concurrentConfig?: ConcurrentConfig
  ): Promise<ConcurrentResult<T>[]> {
    const configs = urls.map(url => ({ url, method: 'GET' as const }))
    return this.requestConcurrent<T>(configs, concurrentConfig)
  }

  /**
   * 并发 POST 请求
   * @param requests POST请求配置数组
   * @param concurrentConfig 并发配置
   */
  async postConcurrent<T>(
    requests: Array<{ url: string; data?: any; config?: Partial<RequestConfig> }>,
    concurrentConfig?: ConcurrentConfig
  ): Promise<ConcurrentResult<T>[]> {
    const configs = requests.map(({ url, data, config = {} }) => ({
      url,
      method: 'POST' as const,
      data,
      ...config
    }))
    return this.requestConcurrent<T>(configs, concurrentConfig)
  }

  /**
   * 获取成功的请求结果
   * @param results 并发请求结果数组
   */
  getSuccessfulResults<T>(results: ConcurrentResult<T>[]): T[] {
    return this.concurrentFeature.getSuccessfulResults(results)
  }

  /**
   * 获取失败的请求结果
   * @param results 并发请求结果数组
   */
  getFailedResults<T>(results: ConcurrentResult<T>[]): ConcurrentResult<T>[] {
    return this.concurrentFeature.getFailedResults(results)
  }

  /**
   * 检查是否有请求失败
   * @param results 并发请求结果数组
   */
  hasConcurrentFailures<T>(results: ConcurrentResult<T>[]): boolean {
    return this.concurrentFeature.hasFailures(results)
  }

  /**
   * 销毁请求核心实例，清理资源
   */
  destroy(): void {
    this.cacheFeature.destroy()
  }
}
