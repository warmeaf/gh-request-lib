import axios, { AxiosRequestConfig, AxiosResponse, AxiosError } from 'axios'
import { Requestor, RequestConfig, RequestError, RequestErrorType } from 'request-core'

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

    console.log('[AxiosRequestor] Sending request with Axios...', {
      method: config.method,
      url: config.url
    })

    try {
      const response: AxiosResponse<T> = await axios.request(axiosConfig)
      return response.data
    } catch (error) {
      console.error('[AxiosRequestor] Request failed:', error)
      
      // 统一错误处理
      if (error instanceof RequestError) {
        throw error
      }
      
      // 处理 Axios 错误
      if (axios.isAxiosError(error)) {
        const axiosError = error as AxiosError
        throw new RequestError(axiosError.message, {
          status: axiosError.response?.status,
          isHttpError: !!axiosError.response,
          originalError: axiosError,
          type: axiosError.response?.status ? RequestErrorType.HTTP_ERROR : RequestErrorType.NETWORK_ERROR,
          context: {
            url: config.url,
            method: config.method,
            timestamp: Date.now()
          }
        })
      }
      
      // 处理其他错误
      if (error instanceof Error) {
        throw new RequestError(error.message, {
          originalError: error,
          context: {
            url: config.url,
            method: config.method,
            timestamp: Date.now()
          }
        })
      }
      
      throw new RequestError('Unknown error occurred', {
        originalError: error,
        context: {
          url: config.url,
          method: config.method,
          timestamp: Date.now()
        }
      })
    }
  }
}

// 导出默认实例
export const axiosRequestor = new AxiosRequestor()
