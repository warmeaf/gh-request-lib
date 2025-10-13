import { AxiosRequestConfig } from 'axios'
import { RequestConfig } from 'request-core'

/**
 * @description Axios 配置构建器
 * 将通用 RequestConfig 转换为 Axios 特定的配置
 */

/**
 * 构建 Axios 请求配置
 * @param config 通用请求配置
 * @param filteredParams 过滤后的参数
 * @param signal AbortSignal 用于取消请求
 * @returns Axios 请求配置
 */
export function buildAxiosConfig(
  config: RequestConfig,
  filteredParams: Record<string, any> | undefined,
  signal: AbortSignal
): AxiosRequestConfig {
  return {
    url: config.url,
    method: config.method,
    data: config.data,
    params: filteredParams,
    headers: config.headers,
    // 使用统一的 AbortSignal 控制超时与取消，不使用 axios 的 timeout 通道
    signal,
    responseType: config.responseType || 'json',
    // 默认不发送凭据，与 FetchRequestor 的 'omit' 策略对齐
    withCredentials: false,
    // 不主动提供 transform，避免顺序与 Core 重叠；保留 axios 默认行为
  }
}

