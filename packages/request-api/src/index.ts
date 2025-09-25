// 导出类型和接口
export type { ApiClass, ApiInstance } from './types'

// 导出核心工厂方法
export { createRequestCore } from './core/factory'

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
} from './types'

// 导出错误类型
export { RequestError, RequestErrorType } from './types'
