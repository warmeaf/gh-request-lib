import { Requestor, RequestConfig, ErrorHandler, LogFormatter } from 'request-core'
import { buildUrlWithParams } from './url-builder'
import { buildRequestBody } from './body-builder'
import { createTimeoutController } from './timeout-controller'
import { parseResponse } from './response-parser'
import { transformFetchError } from './error-transformer'

/**
 * @description 基于 Fetch API 的 Requestor 接口实现。
 */
export class FetchRequestor implements Requestor {
  /**
   * 发送 HTTP 请求
   * @param config 请求配置
   * @returns Promise<T>
   */
  async request<T>(config: RequestConfig): Promise<T> {
    const { url, method = 'GET', data, params, headers = {}, timeout = 10000, signal, responseType = 'json' } = config

    // 构建带查询参数的 URL
    const requestUrl = buildUrlWithParams(url, params)

    const startTime = Date.now()
    console.log(LogFormatter.formatRequestStart('FetchRequestor', method, url))

    // 创建超时控制器
    const timeoutController = createTimeoutController(timeout, signal)

    try {
      const requestHeaders: Record<string, string> = { ...(headers || {}) }

      // 构建 Fetch 配置
      const fetchOptions: RequestInit = {
        method: method.toUpperCase(),
        headers: requestHeaders,
        // 为与 AxiosRequestor 对齐，默认不发送凭据
        credentials: 'omit',
        redirect: 'follow',
        referrerPolicy: 'strict-origin-when-cross-origin',
        signal: timeoutController.controller.signal
      }

      // 构建请求体
      const body = buildRequestBody(data, method, requestHeaders)
      if (body !== undefined) {
        fetchOptions.body = body
      }

      // 发送请求
      const response = await fetch(requestUrl, fetchOptions)

      // 检查响应状态
      if (!response.ok) {
        throw ErrorHandler.createHttpError(
          response.status,
          `HTTP ${response.status}${response.statusText ? ': ' + response.statusText : ''}`,
          {
            url: config.url,
            method: config.method
          }
        )
      }

      // 解析响应
      const result = await parseResponse<T>(response, responseType)

      const duration = Date.now() - startTime
      console.log(LogFormatter.formatRequestSuccess('FetchRequestor', method, url, duration))
      return result

    } catch (error) {
      const duration = Date.now() - startTime
      console.error(LogFormatter.formatRequestError('FetchRequestor', method, url, error, duration))

      // 转换并抛出错误
      throw transformFetchError(
        error,
        config,
        timeout,
        timeoutController.isTimedOut()
      )
    } finally {
      timeoutController.cleanup()
    }
  }
}

// 导出默认实例
export const fetchRequestor = new FetchRequestor()
