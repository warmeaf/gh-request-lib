import { Requestor, RequestConfig, RequestError } from 'request-core'

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

    console.log('[FetchRequestor] Sending request with Fetch API...', {
      method,
      url
    })

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
        throw new RequestError(
          `HTTP error! status: ${response.status}`,
          response.status,
          true
        )
      }

      // 按期望响应类型解析
      if (responseType === 'text') {
        const text = await response.text()
        return text as unknown as T
      }
      if (responseType === 'blob') {
        const blob = await response.blob()
        return blob as unknown as T
      }
      if (responseType === 'arraybuffer') {
        const buf = await response.arrayBuffer()
        return buf as unknown as T
      }
      // 默认 json，若失败则退回 text
      try {
        const result = await response.json()
        return result as T
      } catch {
        const text = await response.text()
        return text as unknown as T
      }
    } catch (error) {
      console.error('[FetchRequestor] Request failed:', error)
      
      // 统一错误处理
      if (error instanceof RequestError) {
        throw error
      }
      
      // 将其他错误包装为 RequestError
      if (error instanceof Error) {
        throw new RequestError(
          error.message,
          undefined,
          false,
          error
        )
      }
      
      throw new RequestError(
        'Unknown error occurred',
        undefined,
        false,
        error
      )
    }
  }
}

// 导出默认实例
export const fetchRequestor = new FetchRequestor()
