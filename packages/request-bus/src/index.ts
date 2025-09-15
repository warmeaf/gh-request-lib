import { RequestCoreFactory, RequestImplementation } from './config'
import { RequestCore, GlobalConfig, RequestInterceptor } from 'request-core'

/**
 * @description API 类的接口定义
 */
interface ApiClass<T extends ApiInstance = ApiInstance> {
  new (requestCore: RequestCore): T
}

/**
 * @description API 实例的接口定义
 */
interface ApiInstance {
  requestCore: RequestCore
  [key: string]: any
}

// ==================== 工厂方法 ====================

// 导出类型和接口
export type { RequestImplementation } from './config'
export type { ApiClass, ApiInstance }
export { RequestCoreFactory }

/**
 * @description 工厂方法：创建独立的 RequestCore 实例
 */
export function createRequestCore(
  implementation: RequestImplementation = 'axios',
  options?: {
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
  }
): RequestCore {
  const core = RequestCoreFactory.create(implementation)
  if (options?.globalConfig) {
    core.setGlobalConfig(options.globalConfig)
  }
  if (options?.interceptors?.length) {
    options.interceptors.forEach((i) => core.addInterceptor(i))
  }
  return core
}

/**
 * @description 工厂方法：创建 API 客户端对象，便于树摇
 */
export function createApiClient<T extends Record<string, ApiClass<any>>>(
  apis: T,
  options?: {
    implementation?: RequestImplementation
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
    requestCore?: RequestCore
  }
): { [K in keyof T]: InstanceType<T[K]> } {
  const core =
    options?.requestCore ||
    createRequestCore(options?.implementation ?? 'axios', {
      globalConfig: options?.globalConfig,
      interceptors: options?.interceptors,
    })

  const entries = Object.entries(apis).map(([name, ApiCtor]) => {
    const instance = new ApiCtor(core) as InstanceType<typeof ApiCtor>
    return [name, instance]
  }) as Array<[keyof T, InstanceType<T[keyof T]>]>

  return Object.fromEntries(entries) as { [K in keyof T]: InstanceType<T[K]> }
}

/**
 * @description 附加特性：提供一个安全的挂载点，不暴露内部实现细节
 */
export function attachFeatures(
  core: RequestCore,
  configure: (core: RequestCore) => void
): RequestCore {
  configure(core)
  return core
}

// 稳定重导出常用类型，便于上层只依赖 request-bus
export type { PaginatedResponse, RestfulOptions } from 'request-core'

// 主要工厂方法在上方已经定义并导出

// 导出错误类型和核心类型
export { RequestError, RequestErrorType } from 'request-core'
