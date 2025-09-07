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

    const axiosConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method,
      data: config.data,
      params: filteredParams,
      headers: config.headers,
      timeout: config.timeout || 10000, // 默认 10 秒超时
      responseType: config.responseType || 'json',
    }
    // 取消信号
    if (config.signal) {
      // Axios版本1及以上支持signal  
      Object.assign(axiosConfig, { signal: config.signal })
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
        
        if (axiosError.response) {
          // HTTP 错误响应
          throw ErrorHandler.createHttpError(
            axiosError.response.status,
            `HTTP ${axiosError.response.status}: ${axiosError.message}`,
            {
              url: config.url,
              method: config.method,
              originalError: axiosError
            }
          )
        } else {
          // 网络错误或其他错误
          throw ErrorHandler.createNetworkError(
            axiosError.message,
            {
              url: config.url,
              method: config.method,
              originalError: axiosError
            }
          )
        }
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
export const axiosRequestor = new AxiosRequestor()
