import {
  RequestCore,
  GlobalConfig,
  RequestInterceptor,
  Requestor,
} from 'request-core'

/**
 * 工厂方法：创建独立的 RequestCore 实例
 * @description 创建并配置RequestCore实例，支持全局配置和拦截器
 * @param requestor 请求执行器
 * @param options 配置选项
 * @returns 配置好的RequestCore实例
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
    options.interceptors.forEach((interceptor) => core.addInterceptor(interceptor))
  }
  
  return core
}