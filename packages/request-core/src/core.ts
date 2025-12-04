import { 
  Requestor, 
  RequestConfig, 
  RequestError, 
  RequestErrorType,
  GlobalConfig,
  RequestBuilder,
  RequestData,
  RequestParams,
  FileUploadOptions,
  PaginationParams,
  PaginatedResponse,
  IdempotentConfig
} from './interface'
import { RetryConfig, RetryFeature } from './features/retry'
import { CacheConfig, CacheFeature } from './features/cache'
import { ConcurrentConfig, ConcurrentResult, ConcurrentFeature } from './features/concurrent'
import { IdempotentFeature } from './features/idempotent'
import { SerialFeature } from './features/serial'

// 导入管理器
import { ConfigManager } from './managers/config-manager'
import { RequestExecutor } from './managers/request-executor'
import { ConvenienceMethods, ConvenienceExecutor } from './managers/convenience-methods'

/**
 * @description 请求核心层 - 简化的实现，直接管理功能特性
 */

export class RequestCore implements ConvenienceExecutor {
  // 管理器组合
  private configManager: ConfigManager
  private requestExecutor: RequestExecutor
  private convenienceMethods: ConvenienceMethods
  
  // 功能特性 - 直接管理，移除 FeatureManager 中间层
  private retryFeature: RetryFeature
  private cacheFeature: CacheFeature
  private concurrentFeature: ConcurrentFeature
  private idempotentFeature: IdempotentFeature
  private serialFeature: SerialFeature

  /**
   * 通过依赖注入接收一个实现了 Requestor 接口的实例。
   * @param requestor 具体的请求实现者。
   * @param globalConfig 全局配置
   */
  constructor(
    private requestor: Requestor, 
    globalConfig?: GlobalConfig
  ) {
    // 初始化管理器
    this.configManager = new ConfigManager()
    this.requestExecutor = new RequestExecutor(requestor)
    this.convenienceMethods = new ConvenienceMethods(this)
    
    // 初始化功能特性
    this.retryFeature = new RetryFeature(requestor)
    this.cacheFeature = new CacheFeature(requestor)
    this.concurrentFeature = new ConcurrentFeature(requestor)
    this.idempotentFeature = new IdempotentFeature(requestor)
    this.serialFeature = new SerialFeature(requestor)
    
    if (globalConfig) {
      this.setGlobalConfig(globalConfig)
    }
  }
  
  // ==================== 核心接口方法 ====================

  /**
   * 设置全局配置
   */
  setGlobalConfig(config: GlobalConfig): void {
    this.configManager.setGlobalConfig(config)
  }

  /**
   * 基础请求方法 - 核心执行接口
   * 支持通过 metadata 配置功能特性（retryConfig, cacheConfig, idempotentConfig）
   * @param config 请求配置
   * @returns 请求结果
   */
  async request<T>(config: RequestConfig): Promise<T> {
    // 验证和合并配置
    this.configManager.validateRequestConfig(config)
    const mergedConfig = this.configManager.mergeConfigs(config)
    
    // 检查 metadata 中的功能配置，按优先级处理
    const metadata = mergedConfig.metadata || {}
    
    // 优先级：幂等 > 缓存 > 重试 > 普通请求
    if (metadata.idempotentConfig) {
      return this.idempotentFeature.requestIdempotent<T>(
        mergedConfig,
        metadata.idempotentConfig as IdempotentConfig
      )
    }
    
    if (metadata.cacheConfig) {
      return this.cacheFeature.requestWithCache<T>(
        mergedConfig,
        metadata.cacheConfig as CacheConfig
      )
    }
    
    if (metadata.retryConfig) {
      return this.retryFeature.requestWithRetry<T>(
        mergedConfig,
        metadata.retryConfig as RetryConfig
      )
    }
    
    // 处理串行请求
    if (mergedConfig.serialKey) {
      return this.serialFeature.handleSerialRequest<T>(mergedConfig)
    }
    
    try {
      // 直接执行请求
      return await this.requestExecutor.execute<T>(mergedConfig)
    } catch (error) {
      // 记录请求失败
      const requestError = error instanceof RequestError ? error : new RequestError(
        error instanceof Error ? error.message : 'Unknown error'
      )
      
      throw requestError
    }
  }

  /**
   * ConvenienceExecutor 接口实现 - 供便利方法使用
   */
  async execute<T>(config: RequestConfig): Promise<T> {
    return this.request<T>(config)
  }

  // ==================== 便利方法委托 ====================
  
  /**
   * 创建链式调用构建器
   */
  create<T = unknown>(): RequestBuilder<T> {
    return new RequestBuilderImpl<T>(this)
  }

  // HTTP 方法委托
  async get<T>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.convenienceMethods.get<T>(url, config)
  }

  async post<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.convenienceMethods.post<T>(url, data, config)
  }

  async put<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.convenienceMethods.put<T>(url, data, config)
  }

  async delete<T>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.convenienceMethods.delete<T>(url, config)
  }

  async patch<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.convenienceMethods.patch<T>(url, data, config)
  }

  async head(url: string, config?: Partial<RequestConfig>): Promise<void> {
    return this.convenienceMethods.head(url, config)
  }

  async options<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.convenienceMethods.options<T>(url, config)
  }

  // ==================== 功能特性管理方法 ====================

  /**
   * 清除缓存
   */
  clearCache(key?: string): void {
    this.cacheFeature.clearCache(key)
  }

  /**
   * 清除幂等缓存
   */
  async clearIdempotentCache(key?: string): Promise<void> {
    return this.idempotentFeature.clearIdempotentCache(key)
  }

  /**
   * 并发请求 - 保留此方法因为它是批量操作，不是单个请求的便利方法
   */
  async requestConcurrent<T>(
    configs: RequestConfig[],
    concurrentConfig?: ConcurrentConfig
  ): Promise<ConcurrentResult<T>[]> {
    return this.concurrentFeature.requestConcurrent<T>(configs, concurrentConfig)
  }

  /**
   * 获取并发请求的成功结果
   */
  getSuccessfulResults<T>(results: ConcurrentResult<T>[]): T[] {
    return this.concurrentFeature.getSuccessfulResults(results)
  }

  /**
   * 获取并发请求的失败结果
   */
  getFailedResults<T>(results: ConcurrentResult<T>[]): ConcurrentResult<T>[] {
    return this.concurrentFeature.getFailedResults(results)
  }

  /**
   * 检查并发请求是否有失败
   */
  hasConcurrentFailures<T>(results: ConcurrentResult<T>[]): boolean {
    return this.concurrentFeature.hasFailures(results)
  }

  /**
   * 清空指定串行队列
   */
  clearSerialQueue(serialKey: string): boolean {
    return this.serialFeature.clearQueue(serialKey)
  }

  /**
   * 清空所有串行队列
   */
  clearAllSerialQueues(): void {
    this.serialFeature.clearAllQueues()
  }

  // ==================== 扩展便利方法委托 ====================
  
  // 内容类型特定方法
  async postJson<T>(url: string, data: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.convenienceMethods.postJson<T>(url, data, config)
  }
  
  async putJson<T>(url: string, data: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.convenienceMethods.putJson<T>(url, data, config)
  }
  
  async postForm<T>(url: string, data: Record<string, string | number | boolean>, config?: Partial<RequestConfig>): Promise<T> {
    return this.convenienceMethods.postForm<T>(url, data, config)
  }
  
  // 文件操作
  async uploadFile<T = any>(url: string, options: FileUploadOptions, config?: Partial<RequestConfig>): Promise<T> {
    return this.convenienceMethods.uploadFile<T>(url, options, config)
  }
  
  async downloadFile(url: string, filename?: string, config?: Partial<RequestConfig>): Promise<Blob> {
    return this.convenienceMethods.downloadFile(url, filename, config)
  }
  
  // 分页和批量
  async getPaginated<T>(
    url: string, 
    pagination: PaginationParams = {}, 
    config?: Partial<RequestConfig>
  ): Promise<PaginatedResponse<T>> {
    return this.convenienceMethods.getPaginated<T>(url, pagination, config)
  }

  /**
   * 批量请求 - 并发执行多个请求
   */
  async batchRequests<T>(requests: RequestConfig[], options?: {
    concurrency?: number
    ignoreErrors?: boolean
  }): Promise<T[]> {
    const results = await this.requestConcurrent<T>(requests, {
      maxConcurrency: options?.concurrency,
      failFast: !options?.ignoreErrors
    })
    return this.getSuccessfulResults(results)
  }

  // ==================== 管理方法 ====================
  
  /**
   * 获取全局配置
   */
  getGlobalConfig(): GlobalConfig {
    return this.configManager.getGlobalConfig()
  }
  
  /**
   * 销毁请求核心实例，清理资源
   */
  destroy(): void {
    Promise.all([
      this.cacheFeature.destroy(),
      this.concurrentFeature.destroy(),
      this.idempotentFeature.destroy(),
      Promise.resolve(this.serialFeature.destroy())
    ]).then(() => {
      this.configManager.reset()
      console.log('[RequestCore] All resources have been cleaned up')
    })
  }
}

/**
 * @description 链式调用构建器实现
 */
class RequestBuilderImpl<T> implements RequestBuilder<T> {
  private config: Partial<RequestConfig> = {}
  
  constructor(private core: RequestCore) {}
  
  url(url: string): RequestBuilder<T> {
    this.config.url = url
    return this
  }
  
  method(method: RequestConfig['method']): RequestBuilder<T> {
    this.config.method = method
    return this
  }
  
  data(data: RequestData): RequestBuilder<T> {
    this.config.data = data
    return this
  }
  
  params(params: RequestParams): RequestBuilder<T> {
    this.config.params = { ...this.config.params, ...params }
    return this
  }
  
  headers(headers: Record<string, string>): RequestBuilder<T> {
    this.config.headers = { ...this.config.headers, ...headers }
    return this
  }
  
  header(key: string, value: string): RequestBuilder<T> {
    this.config.headers = { ...this.config.headers, [key]: value }
    return this
  }
  
  timeout(ms: number): RequestBuilder<T> {
    this.config.timeout = ms
    return this
  }
  
  tag(tag: string): RequestBuilder<T> {
    this.config.tag = tag
    return this
  }
  
  debug(enabled: boolean = true): RequestBuilder<T> {
    this.config.debug = enabled
    return this
  }
  
  retry(retries: number): RequestBuilder<T> {
    this.config.metadata = { ...this.config.metadata, retryConfig: { retries } }
    return this
  }
  
  cache(ttl?: number): RequestBuilder<T> {
    this.config.metadata = { ...this.config.metadata, cacheConfig: { ttl } }
    return this
  }
  
  idempotent(ttl?: number): RequestBuilder<T> {
    this.config.metadata = {
      ...this.config.metadata,
      idempotentConfig: { ttl }
    }
    return this
  }

  idempotentWith(idempotentConfig: IdempotentConfig): RequestBuilder<T> {
    this.config.metadata = {
      ...this.config.metadata,
      idempotentConfig
    }
    return this
  }
  
  json<U = unknown>(): RequestBuilder<U> {
    this.config.responseType = 'json'
    return this as unknown as RequestBuilder<U>
  }
  
  text(): RequestBuilder<string> {
    this.config.responseType = 'text'
    return this as unknown as RequestBuilder<string>
  }
  
  blob(): RequestBuilder<Blob> {
    this.config.responseType = 'blob'
    return this as unknown as RequestBuilder<Blob>
  }
  
  arrayBuffer(): RequestBuilder<ArrayBuffer> {
    this.config.responseType = 'arraybuffer'
    return this as unknown as RequestBuilder<ArrayBuffer>
  }
  
  async send(): Promise<T> {
    if (!this.config.url) {
      throw new RequestError('URL is required', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'BUILDER_NO_URL'
      })
    }
    
    if (!this.config.method) {
      this.config.method = 'GET'
    }
    
    const requestConfig = this.config as RequestConfig
    
    // 直接使用 request 方法，它会自动处理 metadata 中的配置
    return this.core.request<T>(requestConfig)
  }
}
