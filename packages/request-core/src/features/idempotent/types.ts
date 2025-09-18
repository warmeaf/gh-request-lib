import { RequestConfig } from '../../interface'
import { CacheKeyConfig } from '../../cache/cache-key-generator'

/**
 * @description 错误类型枚举
 */
export enum IdempotentErrorType {
  CACHE_ERROR = 'CACHE_ERROR',
  KEY_GENERATION_ERROR = 'KEY_GENERATION_ERROR',
  REQUEST_ERROR = 'REQUEST_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * @description 缓存操作结果
 */
export interface CacheOperationResult<T> {
  success: boolean
  data?: T
  error?: Error
  fallbackUsed?: boolean
}

/**
 * @description 缓存项接口定义
 */
export interface CacheItem {
  key: string
  data: unknown
  timestamp: number
  ttl: number
  accessTime: number
  accessCount: number
}

/**
 * @description 幂等请求处理上下文
 */
export interface IdempotentRequestContext {
  idempotentKey: string
  config: RequestConfig
  startTime: number
  onDuplicate?: (
    originalRequest: RequestConfig,
    duplicateRequest: RequestConfig
  ) => void
}

/**
 * @description 新请求执行配置
 */
export interface NewRequestExecutionConfig {
  config: RequestConfig
  idempotentKey: string
  ttl: number
  keyGeneratorConfig: CacheKeyConfig
  startTime: number
}
