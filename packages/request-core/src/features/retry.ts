import { Requestor, RequestConfig } from '../interface'

/**
 * @description 重试配置
 */
export interface RetryConfig {
  retries: number
  delay?: number
}

/**
 * @description 请求重试功能
 */
export class RetryFeature {
  constructor(private requestor: Requestor) {}

  /**
   * 带重试的请求
   * @param config 请求配置
   * @param retryConfig 重试配置
   */
  async requestWithRetry<T>(
    config: RequestConfig,
    retryConfig: RetryConfig = { retries: 3 }
  ): Promise<T> {
    const { retries, delay = 1000 } = retryConfig

    try {
      console.log(`[Retry] 发起请求到: ${config.url}`)
      return await this.requestor.request<T>(config)
    } catch (error) {
      console.error(`[Retry] 请求失败，剩余重试次数: ${retries - 1}`, error)
      
      if (retries > 1) {
        if (delay > 0) {
          await new Promise(resolve => setTimeout(resolve, delay))
        }
        return this.requestWithRetry<T>(config, { ...retryConfig, retries: retries - 1 })
      }
      
      throw error
    }
  }
}
