import { RequestCore, GlobalConfig, Requestor } from 'request-core'
import { ApiClass } from '../types'
import { createRequestCore } from '../core/factory'

/**
 * 增强的 API 客户端类型 - 包含 API 实例和缓存管理功能
 * @description 提供API实例集合以及统一的缓存、配置管理功能
 */
export type ApiClient<T extends Record<string, ApiClass<any>>> = {
  [K in keyof T]: InstanceType<T[K]>
} & {
  // 缓存管理功能
  clearCache(key?: string): void
  // 全局配置管理
  setGlobalConfig(config: GlobalConfig): void
  // 实用方法
  destroy(): void
}

/**
 * API客户端创建选项
 * @description 定义创建ApiClient时的配置选项
 */
export interface ApiClientOptions {
  requestor?: Requestor
  requestCore?: RequestCore
  globalConfig?: GlobalConfig
}

/**
 * 工厂方法：创建 API 客户端对象，便于树摇
 * @description 创建包含多个API实例的客户端对象，提供统一的管理接口
 * @param apis API类的映射对象
 * @param options 创建选项
 * @returns 增强的API客户端对象
 */
export function createApiClient<T extends Record<string, ApiClass<any>>>(
  apis: T,
  options: ApiClientOptions
): ApiClient<T> {
  // 优先使用传入的 RequestCore，否则用 Requestor 创建新的
  const core = getOrCreateRequestCore(options)

  // 创建 API 实例集合
  const apiInstances = createApiInstances(apis, core)

  // 创建增强的客户端对象
  return createEnhancedClient(apiInstances, core)
}

/**
 * 获取或创建RequestCore实例
 * @description 根据选项获取现有的RequestCore或创建新的
 * @param options 创建选项
 * @returns RequestCore实例
 */
function getOrCreateRequestCore(options: ApiClientOptions): RequestCore {
  if (options.requestCore) {
    return options.requestCore
  }
  
  if (options.requestor) {
    return createRequestCore(options.requestor, {
      globalConfig: options.globalConfig,
    })
  }
  
  throw new Error('Must provide either requestor or requestCore option')
}

/**
 * 创建API实例集合
 * @description 根据API类映射创建对应的实例
 * @param apis API类映射
 * @param core RequestCore实例
 * @returns API实例映射
 */
function createApiInstances<T extends Record<string, ApiClass<any>>>(
  apis: T,
  core: RequestCore
): { [K in keyof T]: InstanceType<T[K]> } {
  const apiEntries = Object.entries(apis).map(([name, ApiCtor]) => {
    const instance = new ApiCtor(core) as InstanceType<typeof ApiCtor>
    return [name, instance]
  }) as Array<[keyof T, InstanceType<T[keyof T]>]>

  return Object.fromEntries(apiEntries) as {
    [K in keyof T]: InstanceType<T[K]>
  }
}

/**
 * 创建增强的客户端对象
 * @description 将API实例和管理方法组合成最终的客户端对象
 * @param apiInstances API实例映射
 * @param core RequestCore实例
 * @returns 增强的API客户端
 */
function createEnhancedClient<T extends Record<string, ApiClass<any>>>(
  apiInstances: { [K in keyof T]: InstanceType<T[K]> },
  core: RequestCore
): ApiClient<T> {
  return {
    ...apiInstances,

    // 缓存管理功能
    clearCache: (key?: string) => {
      core.clearCache(key)
    },

    // 全局配置管理
    setGlobalConfig: (config: GlobalConfig) => {
      core.setGlobalConfig(config)
    },

    // 实用方法
    destroy: () => {
      core.destroy()
    },
  } as ApiClient<T>
}