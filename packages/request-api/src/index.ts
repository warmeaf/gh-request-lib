// 导出类型和接口
export type { ApiClass, ApiInstance } from './types'

// 导出客户端相关
export type { ApiClient, ApiClientOptions } from './client/api-client'
export { createApiClient } from './client/api-client'

// 重导出常用类型，便于上层只依赖 request-api
export type {
  RequestCore,
  PaginatedResponse,
  RestfulOptions,
  GlobalConfig,
  RequestInterceptor,
  Requestor,
  // 功能配置类型
  CacheConfig,
  RetryConfig,
  ConcurrentConfig,
  ConcurrentResult,
  IdempotentConfig,
  IdempotentStats,
  // 缓存相关类型
  CacheKeyGenerator,
  CacheKeyStrategy,
  CacheInvalidationPolicy,
  CacheKeyConfig,
} from './types'

// 导出策略类
export {
  StorageType,
  CacheInvalidationStrategy,
  UrlPathKeyStrategy,
  FullUrlKeyStrategy,
  ParameterizedKeyStrategy,
  CustomKeyStrategy,
  LRUInvalidationPolicy,
  FIFOInvalidationPolicy,
  TimeBasedInvalidationPolicy,
  CustomInvalidationPolicy,
} from './types'

// 导出错误类型
export { RequestError, RequestErrorType } from './types'
