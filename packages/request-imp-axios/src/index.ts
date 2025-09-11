import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { Requestor, RequestConfig, RequestError, ErrorHandler, LogFormatter } from 'request-core'

/**
 * @description 基于 Axios 的 Requestor 接口实现。
 */
export class AxiosRequestor implements Requestor {
  /**
   * 发送 HTTP 请求
   * @param config 请求配置
   * @returns Promise<T>
   */
  async request<T>(config: RequestConfig): Promise<T> {
    // 过滤 params 中的 null 和 undefined 值
    let filteredParams = config.params
    if (config.params) {
      filteredParams = Object.keys(config.params).reduce((acc, key) => {
        const value = config.params![key]
        if (value !== null && value !== undefined) {
          acc[key] = value
        }
        return acc
      }, {} as Record<string, string | number | boolean>)
    }

    // 通过 AbortController 统一处理超时与取消，避免与 CancelToken 混用
    const timeout = config.timeout || 10000
    let controller: AbortController | null = null
    let timeoutId: ReturnType<typeof setTimeout> | null = null
    let timedOut = false

    controller = new AbortController()
    timeoutId = setTimeout(() => { timedOut = true; controller!.abort() }, timeout)

    // 合并外部 signal
    if (config.signal) {
      if (config.signal.aborted) controller.abort()
      else {
        try {
          config.signal.addEventListener('abort', () => controller && controller.abort())
        } catch (error) {
          // 如果无法添加监听器，忽略错误继续执行请求
          console.warn('[AxiosRequestor] Failed to add abort listener:', error)
        }
      }
    }

    const axiosConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method,
      data: config.data,
      params: filteredParams,
      headers: config.headers,
      // 使用统一的 AbortSignal 控制超时与取消，不使用 axios 的 timeout 通道
      signal: controller.signal,
      responseType: config.responseType || 'json',
      // 与 fetch 默认策略对齐：仅同源发送凭据，跨域不携带
      withCredentials: false,
      // 不主动提供 transform，避免顺序与 Core 重叠；保留 axios 默认行为
    }

    const startTime = Date.now()
    console.log(LogFormatter.formatRequestStart('AxiosRequestor', config.method, config.url))

    try {
      const response: AxiosResponse<T> = await axios.request(axiosConfig)
      const duration = Date.now() - startTime
      console.log(LogFormatter.formatRequestSuccess('AxiosRequestor', config.method, config.url, duration))
      return response.data
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(LogFormatter.formatRequestError('AxiosRequestor', config.method, config.url, error, duration))
      
      // 如果已经是 RequestError，直接抛出
      if (error instanceof RequestError) {
        throw error
      }
      
      // 处理 Axios 特定错误
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError

        // 取消/超时错误处理：
        // - ECONNABORTED: axios 原生超时错误，应视为超时
        // - ERR_CANCELED/CanceledError: 可能是超时(timedOut=true)或手动取消(timedOut=false)
        if ((axiosError as any).code === 'ECONNABORTED') {
          // axios 原生超时错误，始终视为超时
          throw ErrorHandler.createTimeoutError(
            `Request timeout after ${timeout}ms`,
            {
              url: config.url,
              method: config.method,
              timeout,
              originalError: axiosError
            }
          )
        } else if ((axiosError as any).code === 'ERR_CANCELED' || axiosError.name === 'CanceledError') {
          // AbortController 取消：根据 timedOut 区分超时还是手动取消
          throw ErrorHandler.createTimeoutError(
            timedOut ? `Request timeout after ${timeout}ms` : 'Request aborted',
            {
              url: config.url,
              method: config.method,
              timeout,
              originalError: axiosError
            }
          )
        }
        
        if (axiosError.response) {
          // HTTP 错误响应
          const status = axiosError.response.status
          const statusText = (axiosError.response as any).statusText || axiosError.message
          throw ErrorHandler.createHttpError(
            status,
            `HTTP ${status}${statusText ? ': ' + statusText : ''}`,
            {
              url: config.url,
              method: config.method,
              originalError: axiosError
            }
          )
        }

        // 网络错误或其他错误 (包括请求设置错误，如循环引用)
        const errorMessage = axiosError.message || 'Network Error';
        throw ErrorHandler.createNetworkError(
          errorMessage,
          {
            url: config.url,
            method: config.method,
            originalError: axiosError
          }
        )
      }
      
      // 使用通用错误处理器
      throw ErrorHandler.wrapError(error, {
        url: config.url,
        method: config.method
      })
    } finally {
      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }
}

// 导出默认实例
export const axiosRequestor = new AxiosRequestor()
