import { Requestor, RequestConfig } from 'request-core'

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
    const { url, method, data, headers = {}, timeout = 10000 } = config

    const fetchOptions: RequestInit = {
      method,
      headers: {
        'Content-Type': 'application/json',
        ...headers,
      },
    }

    // 处理请求体
    if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
      fetchOptions.body = typeof data === 'string' ? data : JSON.stringify(data)
    }

    console.log('[FetchRequestor] 使用 Fetch API 发送请求...', {
      method,
      url
    })

    try {
      // 创建带超时的 Promise
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), timeout)

      fetchOptions.signal = controller.signal

      const response = await fetch(url, fetchOptions)
      clearTimeout(timeoutId)

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`)
      }

      // 尝试解析 JSON，如果失败则返回文本
      try {
        const result = await response.json()
        return result as T
      } catch {
        const text = await response.text()
        return text as unknown as T
      }
    } catch (error) {
      console.error('[FetchRequestor] 请求失败:', error)
      throw error
    }
  }
}

// 导出默认实例
export const fetchRequestor = new FetchRequestor()
