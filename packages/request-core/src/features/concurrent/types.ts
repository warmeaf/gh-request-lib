import { RequestConfig, RequestError } from '../../interface'

/**
 * @description 并发请求配置
 */
export interface ConcurrentConfig {
  maxConcurrency?: number
  failFast?: boolean
  timeout?: number
  retryOnError?: boolean
}

/**
 * @description 并发请求结果
 */
export interface ConcurrentResult<T> {
  success: boolean
  data?: T
  error?: Error | RequestError | unknown
  config: RequestConfig
  index: number
  duration?: number
  retryCount?: number
}

