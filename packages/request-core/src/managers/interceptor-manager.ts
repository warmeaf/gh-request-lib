import { RequestConfig, RequestError, RequestInterceptor } from '../interface'

/**
 * @description 拦截器执行结果
 */
interface InterceptorExecutionResult<T> {
  result: T
  modifiedConfig: RequestConfig
}

/**
 * @description 拦截器管理器
 * 
 * 负责管理和执行请求拦截器链。
 * 支持请求前拦截、响应后拦截和错误拦截。
 */
export class InterceptorManager {
  private interceptors: RequestInterceptor[] = []

  /**
   * 添加拦截器
   */
  add(interceptor: RequestInterceptor): void {
    if (!interceptor || typeof interceptor !== 'object') {
      throw new RequestError('Invalid interceptor: must be an object')
    }

    // 验证拦截器方法
    const hasValidMethod = ['onRequest', 'onResponse', 'onError'].some(
      method => typeof (interceptor as any)[method] === 'function'
    )

    if (!hasValidMethod) {
      throw new RequestError('Invalid interceptor: must have at least one handler method')
    }

    this.interceptors.push(interceptor)
  }

  /**
   * 移除指定的拦截器
   */
  remove(interceptor: RequestInterceptor): boolean {
    const index = this.interceptors.indexOf(interceptor)
    if (index > -1) {
      this.interceptors.splice(index, 1)
      return true
    }
    return false
  }

  /**
   * 清除所有拦截器
   */
  clear(): number {
    const count = this.interceptors.length
    this.interceptors = []
    return count
  }

  /**
   * 获取拦截器列表（副本）
   */
  getAll(): RequestInterceptor[] {
    return [...this.interceptors]
  }

  /**
   * 获取拦截器数量
   */
  count(): number {
    return this.interceptors.length
  }

  /**
   * 执行完整的拦截器链
   * @param config 请求配置
   * @param executor 实际的请求执行函数
   * @returns 执行结果
   */
  async executeChain<T>(
    config: RequestConfig,
    executor: (config: RequestConfig) => Promise<T>
  ): Promise<T> {
    if (this.interceptors.length === 0) {
      return executor(config)
    }

    let processedConfig = config

    // 执行请求拦截器
    try {
      processedConfig = await this.executeRequestInterceptors(processedConfig)
    } catch (error) {
      // 如果请求拦截器出错，也要执行错误拦截器
      const processedError = await this.executeErrorInterceptors(
        error instanceof RequestError ? error : new RequestError(
          error instanceof Error ? error.message : 'Request interceptor failed'
        ),
        processedConfig
      )
      throw processedError
    }

    try {
      // 执行实际请求
      let result = await executor(processedConfig)

      // 执行响应拦截器
      result = await this.executeResponseInterceptors(result, processedConfig)

      return result
    } catch (error) {
      // 执行错误拦截器
      const processedError = await this.executeErrorInterceptors(
        error instanceof RequestError ? error : new RequestError(
          error instanceof Error ? error.message : 'Unknown error',
          { 
            originalError: error, 
            context: { 
              url: processedConfig.url, 
              method: processedConfig.method,
              timestamp: Date.now()
            } 
          }
        ),
        processedConfig
      )
      throw processedError
    }
  }

  /**
   * 执行请求拦截器
   */
  private async executeRequestInterceptors(config: RequestConfig): Promise<RequestConfig> {
    let processedConfig = config

    for (const interceptor of this.interceptors) {
      if (interceptor.onRequest) {
        try {
          const result = interceptor.onRequest(processedConfig)
          processedConfig = await Promise.resolve(result)
          
          // 验证拦截器返回的配置
          if (!processedConfig || typeof processedConfig !== 'object') {
            throw new RequestError('Request interceptor must return a valid config object')
          }
        } catch (error) {
          throw new RequestError('Request interceptor execution failed', {
            originalError: error,
            context: { 
              url: processedConfig.url, 
              method: processedConfig.method 
            }
          })
        }
      }
    }

    return processedConfig
  }

  /**
   * 执行响应拦截器
   */
  private async executeResponseInterceptors<T>(
    response: T, 
    config: RequestConfig
  ): Promise<T> {
    let processedResponse = response

    for (const interceptor of this.interceptors) {
      if (interceptor.onResponse) {
        try {
          const result = interceptor.onResponse(processedResponse, config)
          processedResponse = await Promise.resolve(result)
        } catch (error) {
          throw new RequestError('Response interceptor execution failed', {
            originalError: error,
            context: { 
              url: config.url, 
              method: config.method 
            }
          })
        }
      }
    }

    return processedResponse
  }

  /**
   * 执行错误拦截器
   */
  private async executeErrorInterceptors(
    error: RequestError, 
    config: RequestConfig
  ): Promise<RequestError> {
    let processedError = error

    for (const interceptor of this.interceptors) {
      if (interceptor.onError) {
        try {
          const result = interceptor.onError(processedError, config)
          processedError = await Promise.resolve(result)
          
          // 验证拦截器返回的错误对象
          if (!(processedError instanceof RequestError)) {
            throw new RequestError('Error interceptor must return a RequestError instance')
          }
        } catch (interceptorError) {
          // 如果错误拦截器本身出错，返回原始错误
          console.error('Error interceptor execution failed:', interceptorError)
          return error
        }
      }
    }

    return processedError
  }

  /**
   * 执行单个拦截器（用于测试）
   */
  async executeSingle<T>(
    interceptor: RequestInterceptor,
    config: RequestConfig,
    executor: (config: RequestConfig) => Promise<T>
  ): Promise<T> {
    const manager = new InterceptorManager()
    manager.add(interceptor)
    return manager.executeChain(config, executor)
  }

  /**
   * 获取拦截器统计信息
   */
  getStats(): {
    total: number
    withRequestHandler: number
    withResponseHandler: number
    withErrorHandler: number
  } {
    return {
      total: this.interceptors.length,
      withRequestHandler: this.interceptors.filter(i => i.onRequest).length,
      withResponseHandler: this.interceptors.filter(i => i.onResponse).length,
      withErrorHandler: this.interceptors.filter(i => i.onError).length
    }
  }
}
