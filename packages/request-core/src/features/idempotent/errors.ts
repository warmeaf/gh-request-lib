import { RequestConfig, RequestError, RequestErrorType } from '../../interface'

/**
 * @description 简化的错误增强方法
 */
export function enhanceIdempotentError(
  error: unknown,
  config: RequestConfig,
  responseTime: number
): RequestError {
  if (error instanceof RequestError) {
    console.error(`❌ [Idempotent] Request failed: ${config.method} ${config.url}`, {
      error: error.toJSON(),
      duration: `${responseTime}ms`,
    })
    return error
  }

  const enhancedError = new RequestError(
    `Idempotent request failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    {
      type: RequestErrorType.UNKNOWN_ERROR,
      originalError: error,
      context: {
        url: config.url,
        method: config.method,
        tag: config.tag,
        duration: responseTime,
        timestamp: Date.now(),
        userAgent:
          typeof navigator !== 'undefined' && navigator
            ? navigator.userAgent
            : 'Node.js',
      },
      suggestion: 'Please check the network connection and request configuration',
    }
  )

  console.error(`❌ [Idempotent] Request failed: ${config.method} ${config.url}`, {
    error: enhancedError.toJSON(),
    duration: `${responseTime}ms`,
  })

  return enhancedError
}
