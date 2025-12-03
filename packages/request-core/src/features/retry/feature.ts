import { Requestor, RequestConfig, RequestError } from '../../interface'
import type { RetryConfig } from './types'

export class RetryFeature {
  constructor(private requestor: Requestor) {}

  private defaultShouldRetry(error: unknown, attempt: number): boolean {
    // 不在这里限制重试次数，由上层循环控制

    if (error instanceof RequestError) {
      if (error.status && error.status >= 500 && error.status < 600) {
        return true
      }
      if (!error.isHttpError) {
        return true
      }
      return false
    }

    if (error instanceof Error) {
      const message = error.message.toLowerCase()
      return (
        message.includes('network') ||
        message.includes('timeout') ||
        message.includes('connection') ||
        message.includes('fetch')
      )
    }

    return false
  }

  private logFinalError(config: RequestConfig, attempt: number, error: unknown): void {
    const finalMessage = `❌ [Retry] Request failed after ${attempt + 1} attempts`
    console.error(
      `${finalMessage}\n  URL: ${config.url}\n  Error: ${error instanceof Error ? error.message : String(error)}`
    )
  }

  async requestWithRetry<T>(
    config: RequestConfig,
    retryConfig: RetryConfig = { retries: 3 }
  ): Promise<T> {
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

    const maxAttempts = retryConfig.retries + 1
    const baseDelay = retryConfig.delay ?? 1000
    const backoff = retryConfig.backoffFactor && retryConfig.backoffFactor > 1 ? retryConfig.backoffFactor : 1
    const jitter = retryConfig.jitter && retryConfig.jitter > 0 && retryConfig.jitter <= 1 ? retryConfig.jitter : 0
    const shouldRetry = retryConfig.shouldRetry ?? this.defaultShouldRetry.bind(this)

    let attempt = 0

    while (attempt < maxAttempts) {
      try {
        const attemptMessage = `🔄 [Retry] Making request (attempt ${attempt + 1}/${maxAttempts})`
        console.log(`${attemptMessage}\n  URL: ${config.url}\n  Method: ${config.method}`)

        return await this.requestor.request<T>(config)
      } catch (error) {
        const isLastAttempt = attempt === maxAttempts - 1
        const remainingRetries = maxAttempts - attempt - 1

        // 如果是最后一次尝试，直接抛出错误，不需要调用shouldRetry
        if (isLastAttempt) {
          this.logFinalError(config, attempt, error)
          throw error
        }

        let shouldRetryResult: boolean
        try {
          shouldRetryResult = shouldRetry(error, attempt)
        } catch (shouldRetryError) {
          // 如果shouldRetry函数抛出异常，停止重试并抛出原始错误
          this.logFinalError(config, attempt, error)
          throw error
        }

        if (!shouldRetryResult) {
          this.logFinalError(config, attempt, error)
          throw error
        }

        const delayBase = backoff === 1 ? baseDelay : baseDelay * Math.pow(backoff, attempt)
        const jitterDelta = jitter > 0 ? delayBase * (Math.random() * jitter) : 0
        const waitMs = Math.max(0, Math.floor(delayBase + jitterDelta))

        const retryMessage = `⏳ [Retry] Request failed, will retry in ${waitMs}ms`
        console.warn(
          `${retryMessage}\n  URL: ${config.url}\n  Remaining retries: ${remainingRetries}\n  Error: ${
            error instanceof Error ? error.message : String(error)
          }`
        )

        if (waitMs > 0) {
          await new Promise((resolve) => setTimeout(resolve, waitMs))
        }
        attempt += 1
      }
    }

    // 理论上不应该到达这里，因为所有失败路径都会抛出错误
    // 但为了满足 TypeScript 的类型检查，添加防御性代码
    throw new RequestError('Unexpected retry loop exit')
  }
}
