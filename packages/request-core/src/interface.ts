/**
 * @description 请求参数类型
 */
export type RequestParams = Record<string, string | number | boolean | null | undefined>

/**
 * @description 请求数据类型
 */
export type RequestData = 
  | Record<string, unknown>
  | string
  | FormData
  | Blob
  | ArrayBuffer
  | URLSearchParams
  | ReadableStream
  | null
  | undefined
  | number
  | boolean

/**
 * @description 文件上传类型
 */
export interface FileUploadOptions {
  file: File | Blob
  name?: string
  filename?: string
  contentType?: string
  additionalData?: Record<string, string | number | boolean>
  onProgress?: (progress: number) => void
}

/**
 * @description 分页参数类型
 */
export interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
  size?: number
}

/**
 * @description 分页响应类型
 */
export interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}

/**
 * @description 请求配置接口 - 增强版
 */
export interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  data?: RequestData
  params?: RequestParams
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer'
  // 性能监控回调函数
  onStart?: (config: RequestConfig) => void
  onEnd?: (config: RequestConfig, duration: number) => void
  onError?: (config: RequestConfig, error: unknown, duration: number) => void
  // 调试和开发体验
  debug?: boolean // 启用调试模式
  tag?: string // 请求标签，便于调试和日志
  metadata?: Record<string, unknown> // 自定义元数据
}

/**
 * @description 错误类型分类
 */
export enum RequestErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  HTTP_ERROR = 'HTTP_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  CONCURRENT_ERROR = 'CONCURRENT_ERROR',
  RETRY_ERROR = 'RETRY_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

/**
 * @description 错误上下文信息
 */
export interface RequestErrorContext {
  url?: string
  method?: string
  duration?: number
  timestamp: number
  userAgent?: string
  tag?: string
  metadata?: Record<string, unknown>
}

/**
 * @description REST风格的便利配置
 */
export interface RestfulOptions {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
  params?: RequestParams
  debug?: boolean
}

/**
 * @description 增强的请求错误类 - 提供详细的错误信息和建议
 */
export class RequestError extends Error {
  public readonly type: RequestErrorType
  public readonly context: RequestErrorContext
  public readonly suggestion?: string
  public readonly code?: string
  public readonly status?: number
  public readonly isHttpError: boolean
  public readonly originalError?: unknown
  
  constructor(
    message: string,
    options: {
      type?: RequestErrorType
      status?: number
      isHttpError?: boolean
      originalError?: unknown
      context?: Partial<RequestErrorContext>
      suggestion?: string
      code?: string
    } = {}
  ) {
    super(message)
    this.name = 'RequestError'
    
    // 错误类型推断
    this.type = options.type || this.inferErrorType(options.status, options.isHttpError, options.originalError)
    this.status = options.status
    this.isHttpError = options.isHttpError || false
    this.originalError = options.originalError
    this.code = options.code
    
    // 构建上下文信息
    this.context = {
      timestamp: Date.now(),
      userAgent: typeof navigator !== 'undefined' ? navigator.userAgent : 'Node.js',
      ...options.context
    } as RequestErrorContext
    
    // 生成建议信息
    this.suggestion = options.suggestion || this.generateSuggestion()
    
    // 保持错误堆栈信息
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RequestError)
    }
  }
  
  /**
   * 推断错误类型
   */
  private inferErrorType(status?: number, isHttpError?: boolean, originalError?: unknown): RequestErrorType {
    if (status) {
      if (status >= 400 && status < 500) return RequestErrorType.HTTP_ERROR
      if (status >= 500) return RequestErrorType.HTTP_ERROR
    }
    
    if (originalError instanceof Error) {
      const message = originalError.message.toLowerCase()
      if (message.includes('timeout')) return RequestErrorType.TIMEOUT_ERROR
      if (message.includes('network') || message.includes('fetch') || message.includes('connection')) {
        return RequestErrorType.NETWORK_ERROR
      }
    }
    
    if (isHttpError) return RequestErrorType.HTTP_ERROR
    return RequestErrorType.UNKNOWN_ERROR
  }
  
  /**
   * 生成建议信息
   */
  private generateSuggestion(): string {
    switch (this.type) {
      case RequestErrorType.NETWORK_ERROR:
        return '请检查网络连接或服务器是否可访问'
      case RequestErrorType.TIMEOUT_ERROR:
        return '请求超时，可以尝试增加timeout值或检查网络状况'
      case RequestErrorType.HTTP_ERROR:
        if (this.status === 404) return '请检查请求URL是否正确'
        if (this.status === 401) return '认证失败，请检查token或登录状态'
        if (this.status === 403) return '权限不足，请检查用户权限设置'
        if (this.status && this.status >= 500) return '服务器错误，请稍后重试或联系管理员'
        return '请检查请求参数和服务器状态'
      case RequestErrorType.VALIDATION_ERROR:
        return '请检查请求配置参数是否正确'
      default:
        return '请检查网络连接和请求配置'
    }
  }
  
  /**
   * 格式化错误信息用于显示
   */
  public toDisplayMessage(): string {
    const parts = []
    
    // 主要错误信息
    parts.push(`错误: ${this.message}`)
    
    // 状态码信息
    if (this.status) {
      parts.push(`状态码: ${this.status}`)
    }
    
    // 建议信息
    if (this.suggestion) {
      parts.push(`建议: ${this.suggestion}`)
    }
    
    // 上下文信息
    if (this.context.url) {
      parts.push(`URL: ${this.context.url}`)
    }
    
    if (this.context.tag) {
      parts.push(`标签: ${this.context.tag}`)
    }
    
    return parts.join('\n')
  }
  
  /**
   * 转换为JSON格式用于日志记录
   */
  public toJSON(): Record<string, unknown> {
    return {
      name: this.name,
      message: this.message,
      type: this.type,
      status: this.status,
      isHttpError: this.isHttpError,
      context: this.context,
      suggestion: this.suggestion,
      code: this.code,
      stack: this.stack
    }
  }
}

/**
 * @description 请求者接口，定义了发送请求的标准化契约。
 * request-imp-* 模块需要实现此接口。
 */
export interface Requestor {
  request<T = unknown>(config: RequestConfig): Promise<T>
}

/**
 * @description 拦截器接口
 */
export interface RequestInterceptor {
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>
  onResponse?: <T>(response: T, config: RequestConfig) => T | Promise<T>
  onError?: (error: RequestError, config: RequestConfig) => RequestError | Promise<RequestError>
}

/**
 * @description 全局配置接口
 */
export interface GlobalConfig {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
  debug?: boolean
  retries?: number
  cacheEnabled?: boolean
  interceptors?: RequestInterceptor[]
}

/**
 * @description 链式调用构建器接口
 */
export interface RequestBuilder<T = unknown> {
  url(url: string): RequestBuilder<T>
  method(method: RequestConfig['method']): RequestBuilder<T>
  data(data: RequestData): RequestBuilder<T>
  params(params: RequestParams): RequestBuilder<T>
  headers(headers: Record<string, string>): RequestBuilder<T>
  header(key: string, value: string): RequestBuilder<T>
  timeout(ms: number): RequestBuilder<T>
  tag(tag: string): RequestBuilder<T>
  debug(enabled?: boolean): RequestBuilder<T>
  retry(retries: number): RequestBuilder<T>
  cache(ttl?: number): RequestBuilder<T>
  json<U = unknown>(): RequestBuilder<U>
  text(): RequestBuilder<string>
  blob(): RequestBuilder<Blob>
  arrayBuffer(): RequestBuilder<ArrayBuffer>
  send(): Promise<T>
}
