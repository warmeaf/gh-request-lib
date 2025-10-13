import { RequestConfig, RequestError, ErrorHandler } from 'request-core'

/**
 * @description Fetch 错误转换器
 * 将 Fetch 特定错误转换为统一的 RequestError
 */

/**
 * 转换 Fetch 错误为 RequestError
 * @param error 原始错误对象
 * @param config 请求配置
 * @param timeout 超时时间
 * @param isTimedOut 是否为超时错误
 * @returns RequestError
 */
export function transformFetchError(
  error: unknown,
  config: RequestConfig,
  timeout: number,
  isTimedOut: boolean
): RequestError {
  // 如果已经是 RequestError（比如 HTTP 错误），直接返回
  if (error instanceof RequestError) {
    return error
  }

  // 处理 Fetch 特定错误
  if (error instanceof Error) {
    // 超时或取消错误
    if (error.name === 'AbortError') {
      return ErrorHandler.createTimeoutError(
        isTimedOut ? `Request timeout after ${timeout}ms` : 'Request aborted',
        {
          url: config.url,
          method: config.method,
          timeout,
          originalError: error
        }
      )
    }

    // 网络错误或其他错误
    return ErrorHandler.createNetworkError(
      error.message,
      {
        url: config.url,
        method: config.method,
        originalError: error
      }
    )
  }

  // 使用通用错误处理器
  return ErrorHandler.wrapError(error, {
    url: config.url,
    method: config.method
  })
}

