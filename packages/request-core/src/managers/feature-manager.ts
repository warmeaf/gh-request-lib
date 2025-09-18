import { Requestor, RequestConfig } from '../interface'
import { RetryFeature, RetryConfig } from '../features/retry'
import { CacheFeature, CacheConfig } from '../features/cache'
import { ConcurrentFeature, ConcurrentConfig, ConcurrentResult } from '../features/concurrent'
import { IdempotentFeature } from '../features/idempotent'
import { IdempotentConfig, IdempotentStats } from '../interface'

/**
 * @description 功能特性管理器
 * 
 * 统一管理缓存、重试、并发等高级功能特性。
 * 提供一致的接口来访问这些功能。
 */
export class FeatureManager {
  private retryFeature: RetryFeature
  private cacheFeature: CacheFeature
  private concurrentFeature: ConcurrentFeature
  private idempotentFeature: IdempotentFeature

  constructor(requestor: Requestor) {
    this.retryFeature = new RetryFeature(requestor)
    this.cacheFeature = new CacheFeature(requestor)
    this.concurrentFeature = new ConcurrentFeature(requestor)
    this.idempotentFeature = new IdempotentFeature(requestor)
  }

  // ==================== 重试功能 ====================

  /**
   * 带重试的请求
   */
  async requestWithRetry<T>(
    config: RequestConfig,
    retryConfig?: RetryConfig
  ): Promise<T> {
    return this.retryFeature.requestWithRetry<T>(config, retryConfig)
  }

  /**
   * 带重试的 GET 请求
   */
  async getWithRetry<T>(
    url: string,
    retryConfig: RetryConfig = { retries: 3 }
  ): Promise<T> {
    return this.requestWithRetry<T>({ url, method: 'GET' }, retryConfig)
  }

  /**
   * 带重试的 POST 请求
   */
  async postWithRetry<T>(
    url: string,
    data?: any,
    retryConfig: RetryConfig = { retries: 3 }
  ): Promise<T> {
    return this.requestWithRetry<T>({ url, method: 'POST', data }, retryConfig)
  }

  // ==================== 缓存功能 ====================

  /**
   * 带缓存的请求
   */
  async requestWithCache<T>(
    config: RequestConfig,
    cacheConfig?: CacheConfig
  ): Promise<T> {
    return this.cacheFeature.requestWithCache<T>(config, cacheConfig)
  }

  /**
   * 带缓存的 GET 请求
   */
  async getWithCache<T>(
    url: string,
    cacheConfig?: CacheConfig
  ): Promise<T> {
    return this.requestWithCache<T>({ url, method: 'GET' }, cacheConfig)
  }

  /**
   * 清除缓存
   */
  clearCache(key?: string): void {
    this.cacheFeature.clearCache(key)
  }

  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cacheFeature.getCacheStats()
  }

  // ==================== 并发功能 ====================

  /**
   * 并发请求
   */
  async requestConcurrent<T>(
    configs: RequestConfig[],
    concurrentConfig?: ConcurrentConfig
  ): Promise<ConcurrentResult<T>[]> {
    return this.concurrentFeature.requestConcurrent<T>(configs, concurrentConfig)
  }

  /**
   * 并发执行多个相同配置的请求
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
   * 批量请求并返回成功的结果
   */
  async batchRequests<T>(
    requests: RequestConfig[],
    options?: {
      concurrency?: number
      ignoreErrors?: boolean
    }
  ): Promise<T[]> {
    const results = await this.requestConcurrent<T>(requests, {
      maxConcurrency: options?.concurrency,
      failFast: !options?.ignoreErrors
    })

    return this.getSuccessfulResults(results)
  }

  // ==================== 幂等功能 ====================

  /**
   * 幂等请求
   */
  async requestIdempotent<T>(config: RequestConfig, idempotentConfig?: IdempotentConfig): Promise<T> {
    return this.idempotentFeature.requestIdempotent<T>(config, idempotentConfig)
  }

  /**
   * GET请求幂等
   */
  async getIdempotent<T>(url: string, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T> {
    return this.idempotentFeature.getIdempotent<T>(url, config, idempotentConfig)
  }

  /**
   * POST请求幂等
   */
  async postIdempotent<T>(url: string, data?: any, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T> {
    return this.idempotentFeature.postIdempotent<T>(url, data, config, idempotentConfig)
  }

  /**
   * PUT请求幂等
   */
  async putIdempotent<T>(url: string, data?: any, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T> {
    return this.idempotentFeature.putIdempotent<T>(url, data, config, idempotentConfig)
  }

  /**
   * PATCH请求幂等
   */
  async patchIdempotent<T>(url: string, data?: any, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T> {
    return this.idempotentFeature.patchIdempotent<T>(url, data, config, idempotentConfig)
  }

  /**
   * DELETE请求幂等
   */
  async deleteIdempotent<T>(url: string, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T> {
    return this.idempotentFeature.deleteIdempotent<T>(url, config, idempotentConfig)
  }

  /**
   * 清除幂等缓存
   */
  async clearIdempotentCache(key?: string): Promise<void> {
    return this.idempotentFeature.clearIdempotentCache(key)
  }

  /**
   * 获取幂等统计信息
   */
  getIdempotentStats(): IdempotentStats {
    return this.idempotentFeature.getIdempotentStats()
  }

  // ==================== 并发结果处理 ====================

  /**
   * 获取成功的请求结果
   */
  getSuccessfulResults<T>(results: ConcurrentResult<T>[]): T[] {
    return this.concurrentFeature.getSuccessfulResults(results)
  }

  /**
   * 获取失败的请求结果
   */
  getFailedResults<T>(results: ConcurrentResult<T>[]): ConcurrentResult<T>[] {
    return this.concurrentFeature.getFailedResults(results)
  }

  /**
   * 检查是否有请求失败
   */
  hasConcurrentFailures<T>(results: ConcurrentResult<T>[]): boolean {
    return this.concurrentFeature.hasFailures(results)
  }

  /**
   * 获取并发统计
   */
  getConcurrentStats() {
    return this.concurrentFeature.getConcurrentStats()
  }

  /**
   * 获取详细的结果统计
   */
  getResultsStats<T>(results: ConcurrentResult<T>[]) {
    return this.concurrentFeature.getResultsStats(results)
  }

  // ==================== 组合功能 ====================

  /**
   * 带缓存和重试的请求
   */
  async requestWithCacheAndRetry<T>(
    config: RequestConfig,
    options?: {
      cacheConfig?: CacheConfig
      retryConfig?: RetryConfig
    }
  ): Promise<T> {
    // 首先尝试从缓存获取
    if (options?.cacheConfig) {
      try {
        return await this.requestWithCache<T>(config, options.cacheConfig)
      } catch (error) {
        // 如果缓存失败，继续执行重试逻辑
        console.warn('[FeatureManager] Cache failed, trying with retry:', error)
      }
    }

    // 使用重试逻辑
    return this.requestWithRetry<T>(config, options?.retryConfig)
  }

  /**
   * 并发请求并缓存结果
   */
  async concurrentWithCache<T>(
    configs: RequestConfig[],
    options?: {
      cacheConfig?: CacheConfig
      concurrentConfig?: ConcurrentConfig
    }
  ): Promise<ConcurrentResult<T>[]> {
    // 如果有缓存配置，为每个请求添加缓存
    if (options?.cacheConfig) {
      const cachedConfigs = configs.map(config => ({
        ...config,
        metadata: {
          ...config.metadata,
          cacheConfig: options.cacheConfig
        }
      }))
      
      // 这里需要在并发功能中支持缓存配置的处理
      // 目前简化处理，直接并发执行
      return this.requestConcurrent<T>(cachedConfigs, options?.concurrentConfig)
    }

    return this.requestConcurrent<T>(configs, options?.concurrentConfig)
  }

  // ==================== 管理方法 ====================

  /**
   * 获取所有功能的统计信息
   */
  async getAllStats() {
    return {
      cache: await this.getCacheStats(),
      concurrent: this.getConcurrentStats(),
      idempotent: this.getIdempotentStats()
    }
  }

  /**
   * 重置所有功能
   */
  resetAll(): void {
    this.cacheFeature.clearCache()
    // 重试功能无需重置
    // 并发功能会自动清理
  }

  /**
   * 销毁所有功能，释放资源
   */
  async destroy(): Promise<void> {
    await Promise.all([
      this.cacheFeature.destroy(),
      this.concurrentFeature.destroy(),
      this.idempotentFeature.destroy()  // 新增这一行
    ])
    // retryFeature 无需特殊销毁
  }

  /**
   * 获取功能状态
   */
  async getFeatureStatus(): Promise<{
    hasRetry: boolean
    hasCache: boolean
    hasConcurrent: boolean
    hasIdempotent: boolean
    cacheSize: number
    maxConcurrency?: number
  }> {
    const cacheStats = await this.getCacheStats()
    const concurrentStats = this.getConcurrentStats()

    return {
      hasRetry: !!this.retryFeature,
      hasCache: !!this.cacheFeature,
      hasConcurrent: !!this.concurrentFeature,
      hasIdempotent: !!this.idempotentFeature,
      cacheSize: cacheStats.size,
      maxConcurrency: concurrentStats.maxConcurrencyUsed
    }
  }
}
