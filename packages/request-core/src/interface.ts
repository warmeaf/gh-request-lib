/**
 * @description 请求参数类型
 */
export type RequestParams = Record<string, string | number | boolean | null | undefined>

/**
 * @description 请求数据类型
 */
export type RequestData = 
  | Record<string, unknown>
  | string
  | FormData
  | Blob
  | ArrayBuffer
  | null
  | undefined

/**
 * @description 请求配置接口
 */
export interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH'
  data?: RequestData
  params?: RequestParams
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer'
  // 性能监控钩子
  onStart?: (config: RequestConfig) => void
  onEnd?: (config: RequestConfig, duration: number) => void
  onError?: (config: RequestConfig, error: unknown, duration: number) => void
}

/**
 * @description 统一的请求错误类
 */
export class RequestError extends Error {
  constructor(
    message: string,
    public status?: number,
    public isHttpError: boolean = false,
    public originalError?: unknown
  ) {
    super(message)
    this.name = 'RequestError'
    // 保持错误堆栈
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, RequestError)
    }
  }
}

/**
 * @description 请求者接口，定义了发送请求的标准化契约。
 * request-imp-* 模块需要实现此接口。
 */
export interface Requestor {
  request<T = unknown>(config: RequestConfig): Promise<T>
}
