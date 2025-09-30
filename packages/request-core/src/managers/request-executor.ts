import { Requestor, RequestConfig, RequestError, RequestErrorType } from '../interface'

/**
 * @description 请求执行上下文
 */
interface RequestExecutionContext {
  requestId: string
  startTime: number
  config: RequestConfig
}

/**
 * @description 请求执行器
 * 
 * 负责实际的HTTP请求执行，包括：
 * - 请求生命周期管理
 * - 调试日志记录  
 * - 错误包装和处理
 * - 性能数据收集
 */
export class RequestExecutor {
  constructor(private requestor: Requestor) {
    if (!requestor || typeof requestor.request !== 'function') {
      throw new RequestError('Invalid requestor: must implement request method')
    }
  }

  /**
   * 执行请求
   * @param config 请求配置
   * @returns 请求结果
   */
  async execute<T>(config: RequestConfig): Promise<T> {
    const context = this.createExecutionContext(config)
    
    try {
      this.logRequestStart(context)
      this.executeOnStartCallback(context)
      
      const result = await this.requestor.request<T>(config)
      const duration = this.getDuration(context)
      
      this.logRequestSuccess(context, duration)
      this.executeOnEndCallback(context, duration)
      
      return result
      
    } catch (error) {
      const duration = this.getDuration(context)
      const enhancedError = this.enhanceError(error, context, duration)
      
      this.logRequestError(context, enhancedError, duration)
      this.executeOnErrorCallback(context, enhancedError, duration)
      
      throw enhancedError
    }
  }

  /**
   * 执行批量请求
   * @param configs 请求配置数组
   * @returns 请求结果数组
   */
  async executeBatch<T>(configs: RequestConfig[]): Promise<T[]> {
    if (!Array.isArray(configs) || configs.length === 0) {
      throw new RequestError('Batch configs must be a non-empty array')
    }

    const promises = configs.map(config => this.execute<T>(config))
    return Promise.all(promises)
  }

  /**
   * 创建执行上下文
   */
  private createExecutionContext(config: RequestConfig): RequestExecutionContext {
    return {
      requestId: this.generateRequestId(),
      startTime: Date.now(),
      config
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    const timestamp = Date.now().toString(36)
    const random = Math.random().toString(36).substring(2, 8)
    return `${timestamp}-${random}`
  }

  /**
   * 获取请求持续时间
   */
  private getDuration(context: RequestExecutionContext): number {
    return Date.now() - context.startTime
  }

  /**
   * 增强错误信息
   */
  private enhanceError(
    error: unknown,
    context: RequestExecutionContext,
    duration: number
  ): RequestError {
    if (error instanceof RequestError) {
      // 如果已经是RequestError，直接修改其context而不创建新对象，保持对象引用不变
      // 使用类型断言绕过readonly限制，因为我们需要添加执行上下文信息
      const errorContext = error.context as any
      errorContext.duration = duration
      errorContext.url = errorContext.url || context.config.url
      errorContext.method = errorContext.method || context.config.method
      errorContext.tag = errorContext.tag || context.config.tag
      errorContext.metadata = {
        ...errorContext.metadata,
        requestId: context.requestId
      }
      return error
    }

    // 创建新的RequestError
    const message = error instanceof Error ? error.message : 'Unknown error'
    
    return new RequestError(message, {
      originalError: error,
      type: this.inferErrorType(error),
      context: {
        url: context.config.url,
        method: context.config.method,
        duration,
        timestamp: context.startTime,
        tag: context.config.tag,
        metadata: {
          requestId: context.requestId
        }
      }
    })
  }

  /**
   * 推断错误类型
   */
  private inferErrorType(error: unknown): RequestErrorType {
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      
      // 网络相关错误优先级高于通用超时错误（connection timeout 应该归类为网络错误）
      if (message.includes('network') || 
          message.includes('fetch') || 
          message.includes('connection') ||
          message.includes('cors')) {
        return RequestErrorType.NETWORK_ERROR
      }
      
      if (message.includes('timeout') || error.name === 'AbortError') {
        return RequestErrorType.TIMEOUT_ERROR
      }
      
      if (message.includes('abort')) {
        return RequestErrorType.TIMEOUT_ERROR
      }
    }
    
    return RequestErrorType.UNKNOWN_ERROR
  }

  /**
   * 记录请求开始日志
   */
  private logRequestStart(context: RequestExecutionContext): void {
    const { config, requestId } = context
    
    if (config.debug) {
      console.group(`🚀 Request [${requestId}] ${config.method} ${config.url}`)
      console.log('配置:', this.sanitizeConfigForLog(config))
      console.log('时间:', new Date(context.startTime).toISOString())
    }
  }

  /**
   * 记录请求成功日志
   */
  private logRequestSuccess(context: RequestExecutionContext, duration: number): void {
    const { config, requestId } = context
    
    if (config.debug) {
      console.log(`✅ 请求成功 [${requestId}]`)
      console.log(`⏱️ 耗时: ${Math.round(duration)}ms`)
      console.groupEnd()
    }
  }

  /**
   * 记录请求错误日志
   */
  private logRequestError(
    context: RequestExecutionContext, 
    error: RequestError, 
    duration: number
  ): void {
    const { config, requestId } = context
    
    if (config.debug) {
      console.error(`❌ 请求失败 [${requestId}]`)
      console.error('错误:', error.toDisplayMessage())
      console.log(`⏱️ 耗时: ${Math.round(duration)}ms`)
      console.groupEnd()
    }
  }

  /**
   * 清理配置对象用于日志记录（移除敏感信息）
   */
  private sanitizeConfigForLog(config: RequestConfig): Partial<RequestConfig> {
    const sanitized = { ...config }
    
    // 移除可能的敏感信息
    if (sanitized.headers) {
      sanitized.headers = { ...sanitized.headers }
      Object.keys(sanitized.headers).forEach(key => {
        if (key.toLowerCase().includes('authorization') ||
            key.toLowerCase().includes('token') ||
            key.toLowerCase().includes('key')) {
          sanitized.headers![key] = '[REDACTED]'
        }
      })
    }
    
    // 限制数据内容的长度
    if (sanitized.data && typeof sanitized.data === 'string' && sanitized.data.length > 500) {
      sanitized.data = sanitized.data.substring(0, 500) + '...[truncated]'
    }
    
    return sanitized
  }

  /**
   * 执行开始回调
   */
  private executeOnStartCallback(context: RequestExecutionContext): void {
    try {
      context.config.onStart?.(context.config)
    } catch (error) {
      console.warn('[RequestExecutor] onStart callback error:', error)
    }
  }

  /**
   * 执行结束回调
   */
  private executeOnEndCallback(context: RequestExecutionContext, duration: number): void {
    try {
      context.config.onEnd?.(context.config, duration)
    } catch (error) {
      console.warn('[RequestExecutor] onEnd callback error:', error)
    }
  }

  /**
   * 执行错误回调
   */
  private executeOnErrorCallback(
    context: RequestExecutionContext, 
    error: RequestError, 
    duration: number
  ): void {
    try {
      context.config.onError?.(context.config, error, duration)
    } catch (callbackError) {
      console.warn('[RequestExecutor] onError callback error:', callbackError)
    }
  }

  /**
   * 获取执行器统计信息
   */
  getStats(): {
    requestorType: string
    hasRequestor: boolean
  } {
    return {
      requestorType: this.requestor.constructor.name,
      hasRequestor: !!this.requestor
    }
  }

  /**
   * 测试连接（发送一个简单的OPTIONS请求）
   */
  async testConnection(baseUrl?: string): Promise<boolean> {
    const testUrl = baseUrl || 'https://httpbin.org/status/200'
    
    try {
      await this.execute({
        url: testUrl,
        method: 'OPTIONS',
        timeout: 5000
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取请求器信息
   */
  getRequestorInfo(): {
    name: string
    hasRequest: boolean
    methods: string[]
  } {
    const proto = Object.getPrototypeOf(this.requestor)
    const methods = Object.getOwnPropertyNames(proto)
      .filter(name => name !== 'constructor' && typeof (this.requestor as any)[name] === 'function')
    
    return {
      name: this.requestor.constructor.name,
      hasRequest: typeof this.requestor.request === 'function',
      methods
    }
  }
}
