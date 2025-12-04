// 导出核心接口和类型
export type { 
  Requestor, 
  RequestConfig, 
  RequestParams, 
  RequestData,
  RequestErrorContext,
  GlobalConfig,
  RequestBuilder,
  FileUploadOptions,
  PaginationParams,
  PaginatedResponse,
  RestfulOptions,
  IdempotentConfig,
  IdempotentStats
} from './interface'
export { RequestError, RequestErrorType } from './interface'
export type { RetryConfig } from './features/retry'
export type { CacheConfig } from './features/cache'
export type { ConcurrentConfig, ConcurrentResult } from './features/concurrent'

// 导出核心类
export { RequestCore } from './core'

// 导出功能类（如果需要单独使用）
export { RetryFeature } from './features/retry'
export { CacheFeature } from './features/cache'
export { ConcurrentFeature } from './features/concurrent'
export { IdempotentFeature } from './features/idempotent'

// 导出工具类
export { ErrorHandler, LogFormatter } from './utils/error-handler'

// 导出管理器类（用于高级自定义）
export { 
  ConfigManager,
  RequestExecutor,
  ConvenienceMethods
} from './managers'
export type { ConvenienceExecutor } from './managers'


// 导出缓存相关功能
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
  CustomInvalidationPolicy
} from './cache'
export type { 
  CacheKeyGenerator,
  CacheKeyStrategy,
  CacheInvalidationPolicy,
  CacheKeyConfig
} from './cache'