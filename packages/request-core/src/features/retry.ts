import { Requestor, RequestConfig, RequestError } from '../interface'

/**
 * @description 重试配置
 */
export interface RetryConfig {
  retries: number
  delay?: number
  backoffFactor?: number // 可选指数退避系数(大于1)，默认不启用
  jitter?: number // 可选抖动比例(0-1)，默认不启用
  shouldRetry?: (error: unknown, attempt: number) => boolean // 自定义重试条件
}

/**
 * @description 请求重试功能
 */
export class RetryFeature {
  constructor(private requestor: Requestor) {}

  /**
   * 默认重试条件：网络错误和5xx服务器错误
   */
  private defaultShouldRetry(error: unknown, attempt: number): boolean {
    // 超过最大重试次数
    if (attempt >= 5) return false
    
    // 如果是请求错误，检查状态码
    if (error instanceof RequestError) {
      // 5xx服务器错误可以重试
      if (error.status && error.status >= 500 && error.status < 600) {
        return true
      }
      // 网络错误可以重试
      if (!error.isHttpError) {
        return true
      }
      return false
    }
    
    // 其他网络相关错误
    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return message.includes('network') || 
             message.includes('timeout') || 
             message.includes('connection') ||
             message.includes('fetch')
    }
    
    return false
  }

  /**
   * 带重试的请求
   * @param config 请求配置
   * @param retryConfig 重试配置
   */
  async requestWithRetry<T>(
    config: RequestConfig,
    retryConfig: RetryConfig = { retries: 3 }
  ): Promise<T> {
    // 参数校验
    if (retryConfig.retries < 0) {
      throw new RequestError('Retries must be non-negative')
    }
    if (retryConfig.delay !== undefined && retryConfig.delay < 0) {
      throw new RequestError('Delay must be non-negative')
    }
    if (retryConfig.backoffFactor !== undefined && retryConfig.backoffFactor <= 0) {
      throw new RequestError('Backoff factor must be positive')
    }
    if (retryConfig.jitter !== undefined && (retryConfig.jitter < 0 || retryConfig.jitter > 1)) {
      throw new RequestError('Jitter must be between 0 and 1')
    }

    const maxAttempts = retryConfig.retries + 1 // 第一次尝试加上重试次数
    const baseDelay = retryConfig.delay ?? 1000
    const backoff = retryConfig.backoffFactor && retryConfig.backoffFactor > 1 ? retryConfig.backoffFactor : 1
    const jitter = retryConfig.jitter && retryConfig.jitter > 0 && retryConfig.jitter <= 1 ? retryConfig.jitter : 0
    const shouldRetry = retryConfig.shouldRetry ?? this.defaultShouldRetry.bind(this)

    let attempt = 0
    let lastError: unknown

    while (attempt < maxAttempts) {
      try {
        console.log(`[Retry] Making request to: ${config.url} (attempt ${attempt + 1}/${maxAttempts})`)
        return await this.requestor.request<T>(config)
      } catch (error) {
        lastError = error
        const isLastAttempt = attempt === maxAttempts - 1
        
        console.error(`[Retry] Request failed, remaining retries: ${maxAttempts - attempt - 1}`, error)
        
        if (isLastAttempt || !shouldRetry(error, attempt)) {
          throw error
        }

        // 计算下次等待时间：可选指数退避加上抖动
        const delayBase = backoff === 1 ? baseDelay : baseDelay * Math.pow(backoff, attempt)
        const jitterDelta = jitter > 0 ? delayBase * (Math.random() * jitter) : 0
        const waitMs = Math.max(0, Math.floor(delayBase + jitterDelta))
        
        if (waitMs > 0) {
          await new Promise(resolve => setTimeout(resolve, waitMs))
        }
        attempt += 1
      }
    }
    
    // 理论上不会达到，但为了类型安全
    throw lastError || new RequestError('Unexpected retry loop exit')
  }
}
