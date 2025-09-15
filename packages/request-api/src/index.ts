import {
  RequestCore,
  GlobalConfig,
  RequestInterceptor,
  Requestor,
} from 'request-core'

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
export type { ApiClass, ApiInstance }

/**
 * @description 工厂方法：创建独立的 RequestCore 实例
 */
export function createRequestCore(
  requestor: Requestor,
  options?: {
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
  }
): RequestCore {
  const core = new RequestCore(requestor)
  if (options?.globalConfig) {
    core.setGlobalConfig(options.globalConfig)
  }
  if (options?.interceptors?.length) {
    options.interceptors.forEach((i) => core.addInterceptor(i))
  }
  return core
}

/**
 * @description 增强的 API 客户端类型 - 包含 API 实例和缓存管理功能
 */
export type ApiClient<T extends Record<string, ApiClass<any>>> = {
  [K in keyof T]: InstanceType<T[K]>
} & {
  // 缓存管理功能
  clearCache(key?: string): void
  getCacheStats(): any
  // 全局配置管理
  setGlobalConfig(config: GlobalConfig): void
  // 拦截器管理
  addInterceptor(interceptor: RequestInterceptor): void
  clearInterceptors(): void
  // 实用方法
  destroy(): void
  getAllStats(): any
}

/**
 * @description 工厂方法：创建 API 客户端对象，便于树摇
 */
export function createApiClient<T extends Record<string, ApiClass<any>>>(
  apis: T,
  options: {
    requestor?: Requestor
    requestCore?: RequestCore
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
  }
): ApiClient<T> {
  // 优先使用传入的 RequestCore，否则用 Requestor 创建新的
  const core =
    options.requestCore ||
    (options.requestor
      ? createRequestCore(options.requestor, {
          globalConfig: options.globalConfig,
          interceptors: options.interceptors,
        })
      : (() => {
          throw new Error('Must provide either requestor or requestCore option')
        })())

  // 创建 API 实例集合
  const apiEntries = Object.entries(apis).map(([name, ApiCtor]) => {
    const instance = new ApiCtor(core) as InstanceType<typeof ApiCtor>
    return [name, instance]
  }) as Array<[keyof T, InstanceType<T[keyof T]>]>

  const apiInstances = Object.fromEntries(apiEntries) as {
    [K in keyof T]: InstanceType<T[K]>
  }

  // 创建增强的客户端对象
  const client = {
    ...apiInstances,

    // 缓存管理功能
    clearCache: (key?: string) => {
      core.clearCache(key)
    },

    getCacheStats: () => {
      return core.getCacheStats()
    },

    // 全局配置管理
    setGlobalConfig: (config: GlobalConfig) => {
      core.setGlobalConfig(config)
    },

    // 拦截器管理
    addInterceptor: (interceptor: RequestInterceptor) => {
      core.addInterceptor(interceptor)
    },

    clearInterceptors: () => {
      core.clearInterceptors()
    },

    // 实用方法
    destroy: () => {
      core.destroy()
    },

    getAllStats: () => {
      return core.getAllStats()
    },
  } as ApiClient<T>

  return client
}

// 稳定重导出常用类型，便于上层只依赖 request-api
export type {
  RequestCore,
  PaginatedResponse,
  RestfulOptions,
} from 'request-core'

// 主要工厂方法在上方已经定义并导出

// 导出错误类型和核心类型
export { RequestError, RequestErrorType } from 'request-core'
