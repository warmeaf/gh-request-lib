import axios, { AxiosError } from 'axios'
import { RequestConfig, RequestError, ErrorHandler } from 'request-core'

/**
 * @description Axios 错误转换器
 * 将 Axios 特定错误转换为统一的 RequestError
 */

/**
 * 转换 Axios 错误为 RequestError
 * @param error 原始错误对象
 * @param config 请求配置
 * @param timeout 超时时间
 * @param isTimedOut 是否为超时错误
 * @returns RequestError
 */
export function transformAxiosError(
  error: unknown,
  config: RequestConfig,
  timeout: number,
  isTimedOut: boolean
): RequestError {
  // 如果已经是 RequestError，直接返回
  if (error instanceof RequestError) {
    return error
  }

  // 处理 Axios 特定错误
  if (axios.isAxiosError(error)) {
    const axiosError = error as AxiosError

    // 处理取消/超时错误
    const cancelError = handleCancelError(axiosError, config, timeout, isTimedOut)
    if (cancelError) {
      return cancelError
    }

    // 处理 HTTP 错误响应
    if (axiosError.response) {
      return handleHttpError(axiosError, config)
    }

    // 处理网络错误或其他错误
    return handleNetworkError(axiosError, config)
  }

  // 使用通用错误处理器
  return ErrorHandler.wrapError(error, {
    url: config.url,
    method: config.method
  })
}

/**
 * 处理取消/超时错误
 * @param axiosError Axios 错误对象
 * @param config 请求配置
 * @param timeout 超时时间
 * @param isTimedOut 是否为超时错误
 * @returns RequestError 或 null（如果不是取消/超时错误）
 */
function handleCancelError(
  axiosError: AxiosError,
  config: RequestConfig,
  timeout: number,
  isTimedOut: boolean
): RequestError | null {
  const errorCode = (axiosError as any).code

  // ECONNABORTED: axios 原生超时错误，始终视为超时
  if (errorCode === 'ECONNABORTED') {
    return ErrorHandler.createTimeoutError(
      `Request timeout after ${timeout}ms`,
      {
        url: config.url,
        method: config.method,
        timeout,
        originalError: axiosError
      }
    )
  }

  // ERR_CANCELED/CanceledError: AbortController 取消，根据 isTimedOut 区分超时还是手动取消
  if (errorCode === 'ERR_CANCELED' || axiosError.name === 'CanceledError') {
    return ErrorHandler.createTimeoutError(
      isTimedOut ? `Request timeout after ${timeout}ms` : 'Request aborted',
      {
        url: config.url,
        method: config.method,
        timeout,
        originalError: axiosError
      }
    )
  }

  return null
}

/**
 * 处理 HTTP 错误响应
 * @param axiosError Axios 错误对象
 * @param config 请求配置
 * @returns RequestError
 */
function handleHttpError(
  axiosError: AxiosError,
  config: RequestConfig
): RequestError {
  const status = axiosError.response!.status
  const statusText = (axiosError.response as any).statusText || axiosError.message

  return ErrorHandler.createHttpError(
    status,
    `HTTP ${status}${statusText ? ': ' + statusText : ''}`,
    {
      url: config.url,
      method: config.method,
      originalError: axiosError
    }
  )
}

/**
 * 处理网络错误或其他错误
 * @param axiosError Axios 错误对象
 * @param config 请求配置
 * @returns RequestError
 */
function handleNetworkError(
  axiosError: AxiosError,
  config: RequestConfig
): RequestError {
  const errorMessage = axiosError.message || 'Network Error'

  return ErrorHandler.createNetworkError(
    errorMessage,
    {
      url: config.url,
      method: config.method,
      originalError: axiosError
    }
  )
}

