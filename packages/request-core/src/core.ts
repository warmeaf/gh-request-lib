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
import { RetryFeature, RetryConfig } from './features/retry'
import { CacheFeature, CacheConfig } from './features/cache'
import { ConcurrentFeature, ConcurrentConfig, ConcurrentResult } from './features/concurrent'

/**
 * @description 高级请求核心层 - 提供丰富的便利方法和开发体验
 */
export class RequestCore {
  private retryFeature: RetryFeature
  private cacheFeature: CacheFeature
  private concurrentFeature: ConcurrentFeature
  private globalConfig: GlobalConfig = {}
  private interceptors: RequestInterceptor[] = []

  /**
   * 通过依赖注入接收一个实现了 Requestor 接口的实例。
   * @param requestor 具体的请求实现者。
   * @param globalConfig 全局配置
   */
  constructor(private requestor: Requestor, globalConfig?: GlobalConfig) {
    this.retryFeature = new RetryFeature(requestor)
    this.cacheFeature = new CacheFeature(requestor)
    this.concurrentFeature = new ConcurrentFeature(requestor)
    
    if (globalConfig) {
      this.setGlobalConfig(globalConfig)
    }
  }
  
  /**
   * 设置全局配置
   */
  setGlobalConfig(config: GlobalConfig): void {
    this.globalConfig = { ...this.globalConfig, ...config }
    if (config.interceptors) {
      this.interceptors = [...config.interceptors]
    }
  }
  
  /**
   * 添加拦截器
   */
  addInterceptor(interceptor: RequestInterceptor): void {
    this.interceptors.push(interceptor)
  }
  
  /**
   * 清除所有拦截器
   */
  clearInterceptors(): void {
    this.interceptors = []
  }

  /**
   * 增强的请求配置验证 - 提供详细的错误信息
   */
  private validateConfig(config: RequestConfig): void {
    if (!config) {
      throw new RequestError('Request config is required', {
        type: RequestErrorType.VALIDATION_ERROR,
        suggestion: '请提供有效的请求配置对象',
        code: 'CONFIG_REQUIRED'
      })
    }
    
    if (!config.url || typeof config.url !== 'string') {
      throw new RequestError('URL is required and must be a string', {
        type: RequestErrorType.VALIDATION_ERROR,
        suggestion: '请提供有效的URL字符串，例如："https://api.example.com/users"',
        code: 'INVALID_URL',
        context: { url: config.url }
      })
    }
    
    if (!config.method) {
      throw new RequestError('HTTP method is required', {
        type: RequestErrorType.VALIDATION_ERROR,
        suggestion: '请提供有效的HTTP方法，如：GET, POST, PUT, DELETE等',
        code: 'METHOD_REQUIRED',
        context: { url: config.url }
      })
    }
    
    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout < 0)) {
      throw new RequestError('Timeout must be a positive number', {
        type: RequestErrorType.VALIDATION_ERROR,
        suggestion: '请设置一个大于0的数字，单位为毫秒，例如：5000',
        code: 'INVALID_TIMEOUT',
        context: { url: config.url, metadata: { timeout: config.timeout } }
      })
    }
  }
  
  /**
   * 合并全局配置和请求配置
   */
  private mergeConfig(config: RequestConfig): RequestConfig {
    const merged: RequestConfig = {
      timeout: this.globalConfig.timeout,
      debug: this.globalConfig.debug,
      ...config
    }
    
    // 合并URL
    if (this.globalConfig.baseURL && !config.url.startsWith('http')) {
      merged.url = this.globalConfig.baseURL.replace(/\/$/, '') + '/' + config.url.replace(/^\//, '')
    }
    
    // 合并请求头
    if (this.globalConfig.headers || config.headers) {
      merged.headers = {
        ...this.globalConfig.headers,
        ...config.headers
      }
    }
    
    return merged
  }
  
  /**
   * 执行拦截器链
   */
  private async executeInterceptors<T>(config: RequestConfig, execution: () => Promise<T>): Promise<T> {
    let processedConfig = config
    
    // 执行请求拦截器
    for (const interceptor of this.interceptors) {
      if (interceptor.onRequest) {
        processedConfig = await interceptor.onRequest(processedConfig)
      }
    }
    
    try {
      let result = await execution()
      
      // 执行响应拦截器
      for (const interceptor of this.interceptors) {
        if (interceptor.onResponse) {
          result = await interceptor.onResponse(result, processedConfig)
        }
      }
      
      return result
    } catch (error) {
      let processedError = error instanceof RequestError ? error : new RequestError(
        error instanceof Error ? error.message : 'Unknown error',
        { originalError: error, context: { url: processedConfig.url, method: processedConfig.method } }
      )
      
      // 执行错误拦截器
      for (const interceptor of this.interceptors) {
        if (interceptor.onError) {
          processedError = await interceptor.onError(processedError, processedConfig)
        }
      }
      
      throw processedError
    }
  }

  /**
   * 增强的请求执行 - 包含性能监控、调试和错误处理
   */
  private async executeWithMonitoring<T>(config: RequestConfig): Promise<T> {
    const startTime = performance.now()
    const requestId = this.generateRequestId()
    
    // 调试日志
    if (config.debug || this.globalConfig.debug) {
      console.group(`🚀 Request [${requestId}] ${config.method} ${config.url}`)
      console.log('配置:', config)
      console.log('时间:', new Date().toISOString())
    }
    
    try {
      config.onStart?.(config)
      
      const result = await this.requestor.request<T>(config)
      const duration = performance.now() - startTime
      
      // 调试日志 - 成功
      if (config.debug || this.globalConfig.debug) {
        console.log('✅ 响应:', result)
        console.log(`⏱️ 耗时: ${Math.round(duration)}ms`)
        console.groupEnd()
      }
      
      config.onEnd?.(config, duration)
      return result
      
    } catch (error) {
      const duration = performance.now() - startTime
      
      // 增强错误信息
      const enhancedError = error instanceof RequestError ? error : new RequestError(
        error instanceof Error ? error.message : 'Unknown error occurred',
        {
          originalError: error,
          context: {
            url: config.url,
            method: config.method,
            duration,
            timestamp: Date.now(),
            tag: config.tag
          }
        }
      )
      
      // 调试日志 - 失败
      if (config.debug || this.globalConfig.debug) {
        console.error('❌ 错误:', enhancedError.toDisplayMessage())
        console.log(`⏱️ 耗时: ${Math.round(duration)}ms`)
        console.groupEnd()
      }
      
      config.onError?.(config, enhancedError, duration)
      throw enhancedError
    }
  }
  
  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  /**
   * 基础请求方法 - 支持拦截器和全局配置
   */
  async request<T>(config: RequestConfig): Promise<T> {
    const mergedConfig = this.mergeConfig(config)
    this.validateConfig(mergedConfig)
    
    return this.executeInterceptors(mergedConfig, () => 
      this.executeWithMonitoring<T>(mergedConfig)
    )
  }
  
  /**
   * 创建链式调用构建器
   */
  create<T = unknown>(): RequestBuilder<T> {
    return new RequestBuilderImpl<T>(this)
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
   * 带重试的 GET 请求 - 统一使用RetryConfig
   */
  async getWithRetry<T>(url: string, retryConfig: RetryConfig = { retries: 3 }): Promise<T> {
    return this.requestWithRetry<T>({ url, method: 'GET' }, retryConfig)
  }
  
  /**
   * 带重试的 POST 请求
   */
  async postWithRetry<T>(url: string, data?: any, retryConfig: RetryConfig = { retries: 3 }): Promise<T> {
    return this.requestWithRetry<T>({ url, method: 'POST', data }, retryConfig)
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

  // ==================== 便利方法 ====================
  
  /**
   * PATCH 请求
   */
  async patch<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ url, method: 'PATCH', data, ...config })
  }
  
  /**
   * HEAD 请求
   */
  async head(url: string, config?: Partial<RequestConfig>): Promise<void> {
    return this.request<void>({ url, method: 'HEAD', ...config })
  }
  
  /**
   * OPTIONS 请求
   */
  async options<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({ url, method: 'OPTIONS', ...config })
  }
  
  /**
   * 快速 JSON POST 请求
   */
  async postJson<T>(url: string, data: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({
      url,
      method: 'POST',
      data,
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers
      },
      ...config
    })
  }
  
  /**
   * 快速 JSON PUT 请求
   */
  async putJson<T>(url: string, data: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.request<T>({
      url,
      method: 'PUT',
      data,
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers
      },
      ...config
    })
  }
  
  /**
   * 表单数据 POST 请求
   */
  async postForm<T>(url: string, data: Record<string, string | number | boolean>, config?: Partial<RequestConfig>): Promise<T> {
    const formData = new URLSearchParams()
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, String(value))
    })
    
    return this.request<T>({
      url,
      method: 'POST',
      data: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...config?.headers
      },
      ...config
    })
  }
  
  /**
   * 文件上传
   */
  async uploadFile<T = any>(url: string, options: FileUploadOptions, config?: Partial<RequestConfig>): Promise<T> {
    const formData = new FormData()
    formData.append(options.name || 'file', options.file, options.filename)
    
    // 添加额外数据
    if (options.additionalData) {
      Object.entries(options.additionalData).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
    }
    
    return this.request<T>({
      url,
      method: 'POST',
      data: formData,
      ...config
    })
  }
  
  /**
   * 下载文件
   */
  async downloadFile(url: string, filename?: string, config?: Partial<RequestConfig>): Promise<Blob> {
    const blob = await this.request<Blob>({
      url,
      method: 'GET',
      responseType: 'blob',
      ...config
    })
    
    // 如果是浏览器环境，自动触发下载
    if (typeof window !== 'undefined' && filename) {
      const downloadUrl = URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = downloadUrl
      link.download = filename
      document.body.appendChild(link)
      link.click()
      document.body.removeChild(link)
      URL.revokeObjectURL(downloadUrl)
    }
    
    return blob
  }
  
  /**
   * 分页请求
   */
  async getPaginated<T>(
    url: string, 
    pagination: PaginationParams = {}, 
    config?: Partial<RequestConfig>
  ): Promise<PaginatedResponse<T>> {
    const params = {
      page: pagination.page || 1,
      limit: pagination.limit || pagination.size || 20,
      ...pagination,
      ...config?.params
    }
    
    return this.request<PaginatedResponse<T>>({
      url,
      method: 'GET',
      params,
      ...config
    })
  }
  
  /**
   * 帶超时的请求
   */
  async withTimeout<T>(timeoutMs: number, requestFn: () => Promise<T>): Promise<T> {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    
    try {
      return await requestFn()
    } catch (error) {
      if (controller.signal.aborted) {
        throw new RequestError(`Request timeout after ${timeoutMs}ms`, {
          type: RequestErrorType.TIMEOUT_ERROR,
          suggestion: `请尝试增加超时时间或检查网络状况`,
          code: 'REQUEST_TIMEOUT'
        })
      }
      throw error
    } finally {
      clearTimeout(timeoutId)
    }
  }
  
  /**
   * 重试并带指数退避
   */
  async retryWithBackoff<T>(
    requestFn: () => Promise<T>,
    maxRetries: number = 3,
    initialDelay: number = 1000
  ): Promise<T> {
    let lastError: Error = new Error('No attempts made')
    
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        return await requestFn()
      } catch (error) {
        lastError = error instanceof Error ? error : new Error('Unknown error')
        
        if (attempt === maxRetries) break
        
        const delay = initialDelay * Math.pow(2, attempt)
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
    
    throw new RequestError(`Request failed after ${maxRetries + 1} attempts`, {
      type: RequestErrorType.RETRY_ERROR,
      originalError: lastError,
      suggestion: '请检查网络连接或服务器状态',
      code: 'MAX_RETRIES_EXCEEDED'
    })
  }
  
  /**
   * 批量请求并返回成功的结果
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
  
  // ==================== 状态和管理方法 ====================
  
  /**
   * 获取全局配置
   */
  getGlobalConfig(): GlobalConfig {
    return { ...this.globalConfig }
  }
  
  /**
   * 获取拦截器列表
   */
  getInterceptors(): RequestInterceptor[] {
    return [...this.interceptors]
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats() {
    return this.cacheFeature.getCacheStats()
  }
  
  /**
   * 获取并发统计
   */
  getConcurrentStats() {
    return this.concurrentFeature.getConcurrentStats()
  }
  
  /**
   * 销毁请求核心实例，清理资源
   */
  destroy(): void {
    this.cacheFeature.destroy()
    this.clearInterceptors()
    this.globalConfig = {}
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
    // 这里可以添加重试逻辑
    this.config.metadata = { ...this.config.metadata, retries }
    return this
  }
  
  cache(ttl?: number): RequestBuilder<T> {
    // 这里可以添加缓存逻辑
    this.config.metadata = { ...this.config.metadata, cache: { ttl } }
    return this
  }
  
  json<U = unknown>(): RequestBuilder<U> {
    this.config.responseType = 'json'
    return this as any
  }
  
  text(): RequestBuilder<string> {
    this.config.responseType = 'text'
    return this as any
  }
  
  blob(): RequestBuilder<Blob> {
    this.config.responseType = 'blob'
    return this as any
  }
  
  arrayBuffer(): RequestBuilder<ArrayBuffer> {
    this.config.responseType = 'arraybuffer'
    return this as any
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
    
    return this.core.request<T>(this.config as RequestConfig)
  }
}
