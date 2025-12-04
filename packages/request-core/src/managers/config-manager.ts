import { RequestConfig, RequestError, RequestErrorType, GlobalConfig } from '../interface'

/**
 * @description 配置管理器
 * 
 * 负责请求配置的验证和合并。
 */
export class ConfigManager {
  private globalConfig: GlobalConfig = {}

  /**
   * 设置全局配置
   */
  setGlobalConfig(config: GlobalConfig): void {
    if (config.baseURL !== undefined && typeof config.baseURL !== 'string') {
      throw new RequestError('baseURL must be a string', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_GLOBAL_CONFIG'
      })
    }

    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout < 0)) {
      throw new RequestError('timeout must be a non-negative number', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_GLOBAL_CONFIG'
      })
    }

    if (config.headers !== undefined && (typeof config.headers !== 'object' || Array.isArray(config.headers))) {
      throw new RequestError('headers must be a plain object', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_GLOBAL_CONFIG'
      })
    }

    this.globalConfig = { ...this.globalConfig, ...config }
  }

  /**
   * 获取全局配置（副本）
   */
  getGlobalConfig(): GlobalConfig {
    return { ...this.globalConfig }
  }

  /**
   * 验证请求配置
   */
  validateRequestConfig(config: RequestConfig): void {
    if (!config) {
      throw new RequestError('Request config is required', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'VALIDATION_FAILED'
      })
    }

    if (!config.url || typeof config.url !== 'string') {
      throw new RequestError('URL is required and must be a string', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_URL',
        context: { url: config?.url, method: config?.method, timestamp: Date.now() }
      })
    }

    if (!config.method) {
      throw new RequestError('HTTP method is required', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_METHOD',
        context: { url: config.url, timestamp: Date.now() }
      })
    }

    if (!this.isValidHttpMethod(config.method)) {
      throw new RequestError(`Invalid HTTP method: ${config.method}`, {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_METHOD',
        context: { url: config.url, method: config.method, timestamp: Date.now() }
      })
    }

    // 可选字段的基本类型验证
    if (config.timeout !== undefined && (typeof config.timeout !== 'number' || config.timeout < 0)) {
      throw new RequestError('Timeout must be a non-negative number', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_TIMEOUT',
        context: { url: config.url, method: config.method, timestamp: Date.now() }
      })
    }

    if (config.headers && (typeof config.headers !== 'object' || Array.isArray(config.headers))) {
      throw new RequestError('Headers must be a plain object', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_HEADERS',
        context: { url: config.url, method: config.method, timestamp: Date.now() }
      })
    }

    if (config.responseType && !this.isValidResponseType(config.responseType)) {
      throw new RequestError(`Invalid response type: ${config.responseType}`, {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_RESPONSE_TYPE',
        context: { url: config.url, method: config.method, timestamp: Date.now() }
      })
    }
  }

  /**
   * 合并全局配置和请求配置
   */
  mergeConfigs(requestConfig: RequestConfig): RequestConfig {
    const merged: RequestConfig = {
      // 全局配置优先级较低
      timeout: this.globalConfig.timeout,
      debug: this.globalConfig.debug,
      // 请求配置优先级较高
      ...requestConfig
    }

    // 合并URL
    if (this.globalConfig.baseURL && !this.isAbsoluteUrl(requestConfig.url)) {
      merged.url = this.buildUrl(this.globalConfig.baseURL, requestConfig.url)
    }

    // 合并请求头
    if (this.globalConfig.headers || requestConfig.headers) {
      merged.headers = {
        ...this.globalConfig.headers,
        ...requestConfig.headers
      }
    }

    return merged
  }


  /**
   * 检查是否为有效的HTTP方法
   */
  private isValidHttpMethod(method: string): boolean {
    const validMethods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']
    return validMethods.includes(method.toUpperCase())
  }

  /**
   * 检查是否为有效的响应类型
   */
  private isValidResponseType(responseType: string): boolean {
    const validTypes = ['json', 'text', 'blob', 'arraybuffer']
    return validTypes.includes(responseType)
  }

  /**
   * 检查是否为绝对URL
   */
  private isAbsoluteUrl(url: string): boolean {
    return /^https?:\/\//.test(url) || /^\/\//.test(url)
  }

  /**
   * 构建完整URL
   */
  private buildUrl(baseURL: string, path: string): string {
    const normalizedBase = baseURL.replace(/\/$/, '')
    const normalizedPath = path.replace(/^\//, '')
    return `${normalizedBase}/${normalizedPath}`
  }

  /**
   * 重置全局配置
   */
  reset(): void {
    this.globalConfig = {}
  }
}
