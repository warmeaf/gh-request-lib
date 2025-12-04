import { RequestCore } from 'request-core'

/**
 * API 类的接口定义
 * @description 定义API类的构造函数签名
 */
export interface ApiClass<T extends ApiInstance = ApiInstance> {
  new (requestCore: RequestCore): T
}

/**
 * API 实例的接口定义
 * @description 定义API实例必须包含的基础属性
 */
export interface ApiInstance {
  requestCore: RequestCore
  [key: string]: any
}

// 重导出request-core中的常用类型
export type {
  RequestCore,
  PaginatedResponse,
  RestfulOptions,
  GlobalConfig,
  Requestor,
  // 功能配置类型
  CacheConfig,
  RetryConfig,
  ConcurrentConfig,
  ConcurrentResult,
  IdempotentConfig,
} from 'request-core'

// 重导出缓存相关类型
export type {
  CacheKeyGenerator,
  CacheKeyStrategy,
  CacheInvalidationPolicy,
  CacheKeyConfig,
} from 'request-core'

// 重导出策略类
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
} from 'request-core'

// 重导出错误类型
export { RequestError, RequestErrorType } from 'request-core'