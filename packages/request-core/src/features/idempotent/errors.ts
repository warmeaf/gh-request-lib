import { RequestConfig, RequestError } from '../../interface'
import { ErrorHandler } from '../../utils/error-handler'

/**
 * @description 简化的错误增强方法
 * 使用统一的错误处理工具，添加幂等请求特定的上下文信息
 */
export function enhanceIdempotentError(
  error: unknown,
  config: RequestConfig,
  responseTime: number
): RequestError {
  const enhancedError = ErrorHandler.enhanceError(error, {
    url: config.url,
    method: config.method,
    tag: config.tag,
    duration: responseTime,
    timestamp: Date.now(),
    message: error instanceof RequestError 
      ? undefined 
      : `Idempotent request failed: ${error instanceof Error ? error.message : 'Unknown error'}`
  })

  console.error(`❌ [Idempotent] Request failed: ${config.method} ${config.url}`, {
    error: enhancedError.toJSON(),
    duration: `${responseTime}ms`,
  })

  return enhancedError
}
