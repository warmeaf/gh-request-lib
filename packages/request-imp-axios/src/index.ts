import axios, { AxiosResponse } from 'axios'
import { Requestor, RequestConfig, LogFormatter } from 'request-core'
import { filterParams } from './params-filter'
import { createTimeoutController } from './timeout-controller'
import { buildAxiosConfig } from './config-builder'
import { transformAxiosError } from './error-transformer'

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
    const timeout = config.timeout || 10000
    const filteredParams = filterParams(config.params)
    
    // 创建超时控制器
    const timeoutController = createTimeoutController(timeout, config.signal)
    
    // 构建 Axios 配置
    const axiosConfig = buildAxiosConfig(
      config,
      filteredParams,
      timeoutController.controller.signal
    )

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
      
      // 转换并抛出错误
      throw transformAxiosError(
        error,
        config,
        timeout,
        timeoutController.isTimedOut()
      )
    } finally {
      timeoutController.cleanup()
    }
  }
}

// 导出默认实例
export const axiosRequestor = new AxiosRequestor()
