/**
 * @description 重试配置
 */
export interface RetryConfig {
  retries: number
  delay?: number
  backoffFactor?: number
  jitter?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
}
