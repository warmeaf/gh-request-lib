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
  RequestInterceptor,
  Requestor,
} from 'request-core'

// 重导出错误类型
export { RequestError, RequestErrorType } from 'request-core'