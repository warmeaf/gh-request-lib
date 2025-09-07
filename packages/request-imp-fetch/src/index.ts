import { Requestor, RequestConfig, RequestError, ErrorHandler, LogFormatter } from 'request-core'

/**
 * @description 基于 Fetch API 的 Requestor 接口实现。
 */
export class FetchRequestor implements Requestor {
  /**
   * 发送 HTTP 请求
   * @param config 请求配置
   * @returns Promise<T>
   */
  async request<T>(config: RequestConfig): Promise<T> {
    const { url, method, data, params, headers = {}, timeout = 10000, signal, responseType = 'json' } = config

    // 处理 params 参数，转换为查询字符串
    let requestUrl = url
    if (params) {
      const base = typeof window !== 'undefined' ? window.location.origin : undefined
      const urlObj = new URL(url, base)
      Object.keys(params).forEach(key => {
        const value = params[key]
        if (value !== null && value !== undefined) {
          urlObj.searchParams.set(key, String(value))
        }
      })
      requestUrl = urlObj.toString()
    }

    const fetchOptions: RequestInit = {
      method,
      headers: {
        ...headers,
      },
    }

    // 处理请求体
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      const isFormLike = typeof FormData !== 'undefined' && data instanceof FormData
      const isBlob = typeof Blob !== 'undefined' && data instanceof Blob
      const isArrayBuffer = typeof ArrayBuffer !== 'undefined' && (data instanceof ArrayBuffer)
      if (!isFormLike && !isBlob && !isArrayBuffer) {
        if (!fetchOptions.headers) fetchOptions.headers = {}
        const headersRecord = fetchOptions.headers as Record<string, string>
        if (!headersRecord['Content-Type']) {
          headersRecord['Content-Type'] = 'application/json'
        }
        fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data)
      } else {
        fetchOptions.body = data as BodyInit
      }
    }

    const startTime = Date.now()
    console.log(LogFormatter.formatRequestStart('FetchRequestor', method, url))

    try {
      // 创建带超时的 Promise
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      // 合并外部 signal
      if (signal) {
        if (signal.aborted) controller.abort()
        else signal.addEventListener('abort', () => controller.abort())
      }
      fetchOptions.signal = controller.signal

      const response = await fetch(requestUrl, fetchOptions)
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw ErrorHandler.createHttpError(
          response.status,
          `HTTP error! status: ${response.status}`,
          {
            url: config.url,
            method: config.method
          }
        )
      }

      // 按期望响应类型解析
      let result: T
      if (responseType === 'text') {
        const text = await response.text()
        result = text as unknown as T
      } else if (responseType === 'blob') {
        const blob = await response.blob()
        result = blob as unknown as T
      } else if (responseType === 'arraybuffer') {
        const buf = await response.arrayBuffer()
        result = buf as unknown as T
      } else {
        // 默认 json，若失败则退回 text
        try {
          result = await response.json()
        } catch {
          const text = await response.text()
          result = text as unknown as T
        }
      }
      
      const duration = Date.now() - startTime
      console.log(LogFormatter.formatRequestSuccess('FetchRequestor', method, url, duration))
      return result
      
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(LogFormatter.formatRequestError('FetchRequestor', method, url, error, duration))
      
      // 如果已经是 RequestError（比如 HTTP 错误），直接抛出
      if (error instanceof RequestError) {
        throw error
      }
      
      // 处理 Fetch 特定错误
      if (error instanceof Error) {
        // 超时错误
        if (error.name === 'AbortError') {
          throw ErrorHandler.createTimeoutError(
            `Request timeout after ${timeout}ms`,
            {
              url: config.url,
              method: config.method,
              timeout,
              originalError: error
            }
          )
        }
        
        // 网络错误
        throw ErrorHandler.createNetworkError(
          error.message,
          {
            url: config.url,
            method: config.method,
            originalError: error
          }
        )
      }
      
      // 使用通用错误处理器
      throw ErrorHandler.wrapError(error, {
        url: config.url,
        method: config.method
      })
    }
  }
}

// 导出默认实例
export const fetchRequestor = new FetchRequestor()
