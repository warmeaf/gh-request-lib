import axios, { AxiosRequestConfig, AxiosResponse } from 'axios'
import { Requestor, RequestConfig } from 'request-core'

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
      }, {} as Record<string, any>)
    }

    const axiosConfig: AxiosRequestConfig = {
      url: config.url,
      method: config.method,
      data: config.data,
      params: filteredParams,
      headers: config.headers,
      timeout: config.timeout || 10000, // 默认 10 秒超时
    }

    console.log('[AxiosRequestor] 使用 Axios 发送请求...', {
      method: config.method,
      url: config.url
    })

    try {
      const response: AxiosResponse<T> = await axios.request(axiosConfig)
      return response.data
    } catch (error) {
      console.error('[AxiosRequestor] 请求失败:', error)
      throw error
    }
  }
}

// 导出默认实例
export const axiosRequestor = new AxiosRequestor()
