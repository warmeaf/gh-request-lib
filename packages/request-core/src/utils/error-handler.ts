import { RequestError, RequestErrorType } from '../interface'

/**
 * @description 统一的错误处理工具类
 * 
 * 提供标准化的错误创建和包装方法，确保所有错误都有一致的结构和上下文信息。
 * 这个类消除了各个请求实现中重复的错误处理代码，并提供了类型安全的错误创建方法。
 * 
 * @example
 * ```typescript
 * // 创建HTTP错误
 * const httpError = ErrorHandler.createHttpError(404, 'Not Found', {
 *   url: '/api/users/123',
 *   method: 'GET'
 * })
 * 
 * // 包装未知错误
 * const wrappedError = ErrorHandler.wrapError(someError, {
 *   url: '/api/data',
 *   method: 'POST'
 * })
 * ```
 */
export class ErrorHandler {
  /**
   * 将各种错误统一包装为 RequestError
   */
  static wrapError(
    error: unknown,
    context: {
      url: string
      method: string
      message?: string
    }
  ): RequestError {
    const { url, method, message } = context
    const timestamp = Date.now()

    // 如果已经是 RequestError，直接返回
    if (error instanceof RequestError) {
      return error
    }

    // 通用上下文信息
    const errorContext = { url, method, timestamp }

    // 处理标准 Error 对象
    if (error instanceof Error) {
      return new RequestError(message || error.message, {
        originalError: error,
        type: this.inferErrorType(error),
        context: errorContext
      })
    }

    // 处理其他类型的错误
    return new RequestError(message || 'Unknown error', {
      originalError: error,
      type: RequestErrorType.UNKNOWN_ERROR,
      context: errorContext
    })
  }

  /**
   * 创建 HTTP 错误
   */
  static createHttpError(
    status: number,
    message: string,
    context: {
      url: string
      method: string
      originalError?: unknown
    }
  ): RequestError {
    return new RequestError(message, {
      status,
      isHttpError: true,
      type: RequestErrorType.HTTP_ERROR,
      originalError: context.originalError,
      context: {
        url: context.url,
        method: context.method,
        timestamp: Date.now()
      }
    })
  }

  /**
   * 创建网络错误
   */
  static createNetworkError(
    message: string,
    context: {
      url: string
      method: string
      originalError?: unknown
    }
  ): RequestError {
    return new RequestError(message, {
      type: RequestErrorType.NETWORK_ERROR,
      originalError: context.originalError,
      context: {
        url: context.url,
        method: context.method,
        timestamp: Date.now()
      }
    })
  }

  /**
   * 创建超时错误
   */
  static createTimeoutError(
    message: string,
    context: {
      url: string
      method: string
      timeout?: number
      originalError?: unknown
    }
  ): RequestError {
    return new RequestError(message, {
      type: RequestErrorType.TIMEOUT_ERROR,
      originalError: context.originalError,
      context: {
        url: context.url,
        method: context.method,
        timestamp: Date.now(),
        metadata: { timeout: context.timeout }
      }
    })
  }

  /**
   * 推断错误类型
   */
  private static inferErrorType(error: Error): RequestErrorType {
    const message = error.message.toLowerCase()
    
    // 网络相关错误优先级高于通用超时错误（connection timeout 应该归类为网络错误）
    if (message.includes('network') || 
        message.includes('fetch') || 
        message.includes('connection') ||
        message.includes('cors')) {
      return RequestErrorType.NETWORK_ERROR
    }
    
    // 超时错误
    if (message.includes('timeout') || message.includes('timed out') || error.name === 'AbortError') {
      return RequestErrorType.TIMEOUT_ERROR
    }
    
    return RequestErrorType.UNKNOWN_ERROR
  }
}

/**
 * @description 日志格式化工具类
 * 
 * 提供统一的日志输出格式，包含emoji图标、结构化信息和一致的样式。
 * 所有请求相关的日志都通过这个类进行格式化，确保日志的可读性和一致性。
 * 
 * @example
 * ```typescript
 * // 格式化请求开始日志
 * console.log(LogFormatter.formatRequestStart('AxiosRequestor', 'GET', '/api/users'))
 * 
 * // 格式化缓存日志
 * console.log(LogFormatter.formatCacheLog('hit', 'GET:/api/users', { 'ttl': '30s' }))
 * 
 * // 格式化并发请求日志
 * console.log(LogFormatter.formatConcurrentLog('complete', 0, 5, '/api/data'))
 * ```
 */
export class LogFormatter {
  private static readonly LOG_COLORS = {
    info: '🌐',
    success: '✅',
    warning: '⚠️',
    error: '❌',
    debug: '🐛'
  } as const

  /**
   * 格式化请求开始日志
   */
  static formatRequestStart(
    source: string,
    method: string,
    url: string,
    extra?: Record<string, unknown>
  ): string {
    const parts = [`${this.LOG_COLORS.info} [${source}] Sending request with ${source}...`]
    parts.push(`Method: ${method}`)
    parts.push(`URL: ${url}`)
    
    if (extra) {
      Object.entries(extra).forEach(([key, value]) => {
        parts.push(`${key}: ${JSON.stringify(value)}`)
      })
    }
    
    return parts.join('\n  ')
  }

  /**
   * 格式化请求成功日志
   */
  static formatRequestSuccess(
    source: string,
    method: string,
    url: string,
    duration?: number
  ): string {
    let message = `${this.LOG_COLORS.success} [${source}] Request completed successfully`
    if (duration !== undefined) {
      message += ` (${Math.round(duration)}ms)`
    }
    return message
  }

  /**
   * 格式化请求失败日志
   */
  static formatRequestError(
    source: string,
    method: string,
    url: string,
    error: unknown,
    duration?: number
  ): string {
    let message = `${this.LOG_COLORS.error} [${source}] Request failed`
    if (duration !== undefined) {
      message += ` (${Math.round(duration)}ms)`
    }
    message += `\n  URL: ${url}`
    message += `\n  Method: ${method}`
    
    if (error instanceof RequestError) {
      message += `\n  Error: ${error.toDisplayMessage()}`
    } else if (error instanceof Error) {
      message += `\n  Error: ${error.message}`
    } else {
      message += `\n  Error: ${String(error)}`
    }
    
    return message
  }

  /**
   * 格式化缓存相关日志
   */
  static formatCacheLog(
    action: 'hit' | 'miss' | 'set' | 'clear' | 'error',
    key: string,
    extra?: Record<string, unknown>
  ): string {
    const emoji = action === 'hit' ? '🎯' : action === 'miss' ? '❌' : action === 'set' ? '💾' : action === 'clear' ? '🗑️' : '⚠️'
    let message = `${emoji} [Cache] Cache ${action}: ${key.substring(0, 50)}`
    
    if (key.length > 50) {
      message += '...'
    }
    
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => {
        message += `\n  ${k}: ${v}`
      })
    }
    
    return message
  }

  /**
   * 格式化并发请求日志
   */
  static formatConcurrentLog(
    action: 'start' | 'complete' | 'failed',
    index: number,
    total: number,
    url: string,
    extra?: Record<string, unknown>
  ): string {
    const emoji = action === 'start' ? '🚀' : action === 'complete' ? '✅' : '❌'
    let message = `${emoji} [Concurrent] Request ${index + 1}/${total} ${action}`
    message += `\n  URL: ${url}`
    
    if (extra) {
      Object.entries(extra).forEach(([k, v]) => {
        message += `\n  ${k}: ${v}`
      })
    }
    
    return message
  }
}
