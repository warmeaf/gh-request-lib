import { 
  Requestor, 
  RequestConfig, 
  RequestError, 
  RequestErrorType,
  GlobalConfig,
  RequestInterceptor,
  RequestBuilder,
  RequestData,
  RequestParams,
  FileUploadOptions,
  PaginationParams,
  PaginatedResponse
} from './interface'
import { RetryConfig } from './features/retry'
import { CacheConfig } from './features/cache'
import { ConcurrentConfig, ConcurrentResult } from './features/concurrent'

// 导入管理器
import { PerformanceMonitor, PerformanceStats } from './managers/performance-monitor'
import { InterceptorManager } from './managers/interceptor-manager'
import { ConfigManager } from './managers/config-manager'
import { RequestExecutor } from './managers/request-executor'
import { ConvenienceMethods, ConvenienceExecutor } from './managers/convenience-methods'
import { FeatureManager } from './managers/feature-manager'

/**
 * @description 重构后的请求核心层 - 作为协调者组合各个管理器
 */

export class RequestCore implements ConvenienceExecutor {
  // 管理器组合
  private performanceMonitor: PerformanceMonitor
  private interceptorManager: InterceptorManager
  private configManager: ConfigManager
  private requestExecutor: RequestExecutor
  private convenienceMethods: ConvenienceMethods
  private featureManager: FeatureManager

  /**
   * 通过依赖注入接收一个实现了 Requestor 接口的实例。
   * @param requestor 具体的请求实现者。
   * @param globalConfig 全局配置
   * @param options 额外选项
   */
  constructor(
    private requestor: Requestor, 
    globalConfig?: GlobalConfig,
    options?: {
      performanceConfig?: {
        maxRecords?: number
        sampleRate?: number
      }
    }
  ) {
    // 初始化性能监控器
    this.performanceMonitor = new PerformanceMonitor({
      maxRecords: options?.performanceConfig?.maxRecords ?? 1000,
      sampleRate: options?.performanceConfig?.sampleRate ?? 10
    })

    // 初始化其他管理器
    this.interceptorManager = new InterceptorManager()
    this.configManager = new ConfigManager()
    this.requestExecutor = new RequestExecutor(requestor)
    this.convenienceMethods = new ConvenienceMethods(this)
    this.featureManager = new FeatureManager(requestor)
    
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
    
    // 处理拦截器
    if (config.interceptors) {
      this.interceptorManager.clear()
      config.interceptors.forEach(interceptor => {
        this.interceptorManager.add(interceptor)
      })
    }
  }
  
  /**
   * 添加拦截器
   */
  addInterceptor(interceptor: RequestInterceptor): void {
    this.interceptorManager.add(interceptor)
  }
  
  /**
   * 清除所有拦截器
   */
  clearInterceptors(): void {
    this.interceptorManager.clear()
  }

  /**
   * 基础请求方法 - 核心执行接口
   * @param config 请求配置
   * @returns 请求结果
   */
  async request<T>(config: RequestConfig): Promise<T> {
    // 验证和合并配置
    this.configManager.validateRequestConfig(config)
    const mergedConfig = this.configManager.mergeConfigs(config)
    
    // 记录请求开始
    this.performanceMonitor.recordRequestStart(mergedConfig)
    const startTime = Date.now()
    
    try {
      // 执行拦截器链和实际请求
      const result = await this.interceptorManager.executeChain(
        mergedConfig,
        (processedConfig) => this.requestExecutor.execute<T>(processedConfig)
      )
      
      // 记录请求成功
      this.performanceMonitor.recordRequestEnd(mergedConfig, startTime, true)
      
      return result
    } catch (error) {
      // 记录请求失败
      const requestError = error instanceof RequestError ? error : new RequestError(
        error instanceof Error ? error.message : 'Unknown error'
      )
      
      this.performanceMonitor.recordRequestEnd(mergedConfig, startTime, false, requestError)
      
      throw error
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

  // ==================== 功能特性委托 ====================

  // 重试功能
  async requestWithRetry<T>(config: RequestConfig, retryConfig?: RetryConfig): Promise<T> {
    return this.featureManager.requestWithRetry<T>(config, retryConfig)
  }

  async getWithRetry<T>(url: string, retryConfig: RetryConfig = { retries: 3 }): Promise<T> {
    return this.featureManager.getWithRetry<T>(url, retryConfig)
  }
  
  async postWithRetry<T>(url: string, data?: any, retryConfig: RetryConfig = { retries: 3 }): Promise<T> {
    return this.featureManager.postWithRetry<T>(url, data, retryConfig)
  }

  // 缓存功能
  async requestWithCache<T>(config: RequestConfig, cacheConfig?: CacheConfig): Promise<T> {
    return this.featureManager.requestWithCache<T>(config, cacheConfig)
  }

  async getWithCache<T>(url: string, cacheConfig?: CacheConfig): Promise<T> {
    return this.featureManager.getWithCache<T>(url, cacheConfig)
  }

  clearCache(key?: string): void {
    this.featureManager.clearCache(key)
  }

  // 并发功能
  async requestConcurrent<T>(
    configs: RequestConfig[],
    concurrentConfig?: ConcurrentConfig
  ): Promise<ConcurrentResult<T>[]> {
    return this.featureManager.requestConcurrent<T>(configs, concurrentConfig)
  }

  async requestMultiple<T>(
    config: RequestConfig,
    count: number,
    concurrentConfig?: ConcurrentConfig
  ): Promise<ConcurrentResult<T>[]> {
    return this.featureManager.requestMultiple<T>(config, count, concurrentConfig)
  }

  async getConcurrent<T>(
    urls: string[],
    concurrentConfig?: ConcurrentConfig
  ): Promise<ConcurrentResult<T>[]> {
    return this.featureManager.getConcurrent<T>(urls, concurrentConfig)
  }

  async postConcurrent<T>(
    requests: Array<{ url: string; data?: any; config?: Partial<RequestConfig> }>,
    concurrentConfig?: ConcurrentConfig
  ): Promise<ConcurrentResult<T>[]> {
    return this.featureManager.postConcurrent<T>(requests, concurrentConfig)
  }

  getSuccessfulResults<T>(results: ConcurrentResult<T>[]): T[] {
    return this.featureManager.getSuccessfulResults(results)
  }

  getFailedResults<T>(results: ConcurrentResult<T>[]): ConcurrentResult<T>[] {
    return this.featureManager.getFailedResults(results)
  }

  hasConcurrentFailures<T>(results: ConcurrentResult<T>[]): boolean {
    return this.featureManager.hasConcurrentFailures(results)
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

  async batchRequests<T>(requests: RequestConfig[], options?: {
    concurrency?: number
    ignoreErrors?: boolean
  }): Promise<T[]> {
    return this.featureManager.batchRequests<T>(requests, options)
  }
  // ==================== 统计和管理方法 ====================
  
  
  /**
   * 获取全局配置
   */
  getGlobalConfig(): GlobalConfig {
    return this.configManager.getGlobalConfig()
  }
  
  /**
   * 获取拦截器列表
   */
  getInterceptors(): RequestInterceptor[] {
    return this.interceptorManager.getAll()
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.featureManager.getCacheStats()
  }
  
  /**
   * 获取并发统计
   */
  getConcurrentStats() {
    return this.featureManager.getConcurrentStats()
  }
  
  /**
   * 获取性能统计信息
   */
  getPerformanceStats(): PerformanceStats {
    return this.performanceMonitor.getStats()
  }
  
  /**
   * 重置性能统计
   */
  resetPerformanceStats(): void {
    this.performanceMonitor.reset()
  }
  
  // ==================== 内存管理方法 ====================







  /**
   * 销毁请求核心实例，清理资源
   */
  destroy(): void {
    this.featureManager.destroy()
    this.clearInterceptors()
    this.configManager.reset()
    this.resetPerformanceStats()
    
    
    console.log('[RequestCore] All resources have been cleaned up')
  }

  /**
   * 获取所有管理器的统计信息
   */
  getAllStats(): {
    performance: PerformanceStats
    cache: any
    concurrent: any
    interceptors: any
    config: any
  } {
    return {
      performance: this.getPerformanceStats(),
      cache: this.getCacheStats(),
      concurrent: this.getConcurrentStats(),
      interceptors: this.interceptorManager.getStats(),
      config: this.configManager.getStats()
    }
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
    
    // 检查是否有重试配置
    const retryConfig = this.config.metadata?.retryConfig as any
    if (retryConfig) {
      return this.core.requestWithRetry<T>(requestConfig, retryConfig)
    }
    
    // 检查是否有缓存配置  
    const cacheConfig = this.config.metadata?.cacheConfig as any
    if (cacheConfig) {
      return this.core.requestWithCache<T>(requestConfig, cacheConfig)
    }
    
    // 普通请求
    return this.core.request<T>(requestConfig)
  }
}
