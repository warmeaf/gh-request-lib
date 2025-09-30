import { RequestConfig, RequestError, RequestErrorType, GlobalConfig } from '../interface'

/**
 * @description 配置验证结果
 */
interface ValidationResult {
  isValid: boolean
  errors: string[]
  warnings: string[]
}

/**
 * @description 配置管理器
 * 
 * 负责请求配置的验证、合并和处理。
 * 提供详细的验证错误信息和配置建议。
 */
export class ConfigManager {
  private globalConfig: GlobalConfig = {}

  /**
   * 设置全局配置
   */
  setGlobalConfig(config: GlobalConfig): void {
    const validation = this.validateGlobalConfig(config)
    
    if (!validation.isValid) {
      throw new RequestError(`Invalid global config: ${validation.errors.join(', ')}`, {
        type: RequestErrorType.VALIDATION_ERROR,
        suggestion: '请检查全局配置参数是否正确',
        code: 'INVALID_GLOBAL_CONFIG'
      })
    }

    // 显示警告
    if (validation.warnings.length > 0) {
      console.warn('[ConfigManager] Configuration warnings:', validation.warnings)
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
    const validation = this.validateConfig(config)
    
    if (!validation.isValid) {
      const mainError = validation.errors[0]
      throw new RequestError(mainError, {
        type: RequestErrorType.VALIDATION_ERROR,
        suggestion: this.getValidationSuggestion(config, validation),
        code: this.getValidationCode(validation),
        context: { 
          url: config?.url, 
          method: config?.method,
          timestamp: Date.now(),
          metadata: { 
            allErrors: validation.errors,
            warnings: validation.warnings
          }
        }
      })
    }

    // 显示警告
    if (validation.warnings.length > 0) {
      console.warn('[ConfigManager] Request config warnings:', validation.warnings)
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

    // 合并拦截器到请求配置的metadata中，供调用者使用
    if (this.globalConfig.interceptors && this.globalConfig.interceptors.length > 0) {
      merged.metadata = {
        ...merged.metadata,
        globalInterceptors: this.globalConfig.interceptors
      }
    }

    return merged
  }

  /**
   * 验证配置对象
   */
  private validateConfig(config: RequestConfig): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    // 必填字段验证
    if (!config) {
      errors.push('Request config is required')
      return { isValid: false, errors, warnings }
    }

    if (!config.url || typeof config.url !== 'string') {
      errors.push('URL is required and must be a string')
    } else {
      // URL格式验证
      if (config.url.trim() !== config.url) {
        warnings.push('URL contains leading or trailing whitespace')
      }
      
      if (config.url.length > 2048) {
        warnings.push('URL is very long (>2048 chars), may cause issues')
      }
    }

    if (!config.method) {
      errors.push('HTTP method is required')
    } else if (!this.isValidHttpMethod(config.method)) {
      errors.push(`Invalid HTTP method: ${config.method}`)
    }

    // 可选字段验证
    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout < 0) {
        errors.push('Timeout must be a positive number')
      } else if (config.timeout > 300000) { // 5分钟
        warnings.push('Timeout is very long (>5 minutes)')
      }
    }

    // 请求头验证
    if (config.headers) {
      if (typeof config.headers !== 'object' || Array.isArray(config.headers)) {
        errors.push('Headers must be a plain object')
      } else {
        Object.entries(config.headers).forEach(([key, value]) => {
          if (typeof key !== 'string' || typeof value !== 'string') {
            errors.push(`Invalid header: ${key} = ${value}`)
          }
        })
      }
    }

    // 响应类型验证
    if (config.responseType && !this.isValidResponseType(config.responseType)) {
      errors.push(`Invalid response type: ${config.responseType}`)
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
  }

  /**
   * 验证全局配置
   */
  private validateGlobalConfig(config: GlobalConfig): ValidationResult {
    const errors: string[] = []
    const warnings: string[] = []

    if (config.baseURL !== undefined) {
      if (typeof config.baseURL !== 'string') {
        errors.push('baseURL must be a string')
      } else if (!this.isValidBaseUrl(config.baseURL)) {
        errors.push('baseURL must be a valid URL')
      }
    }

    if (config.timeout !== undefined) {
      if (typeof config.timeout !== 'number' || config.timeout < 0) {
        errors.push('Global timeout must be a positive number')
      } else if (config.timeout > 300000) {
        warnings.push('Global timeout is very long (>5 minutes)')
      }
    }

    if (config.headers !== undefined) {
      if (typeof config.headers !== 'object' || Array.isArray(config.headers)) {
        errors.push('Global headers must be a plain object')
      }
    }

    if (config.interceptors !== undefined) {
      if (!Array.isArray(config.interceptors)) {
        errors.push('Interceptors must be an array')
      }
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings
    }
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
   * 检查是否为有效的基础URL
   */
  private isValidBaseUrl(baseURL: string): boolean {
    try {
      new URL(baseURL)
      return true
    } catch {
      return false
    }
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
   * 获取验证建议
   */
  private getValidationSuggestion(config: RequestConfig, validation: ValidationResult): string {
    if (validation.errors.some(e => e.includes('URL'))) {
      return '请提供有效的URL字符串，例如："https://api.example.com/users"'
    }
    
    if (validation.errors.some(e => e.includes('method'))) {
      return '请提供有效的HTTP方法，如：GET, POST, PUT, DELETE等'
    }
    
    if (validation.errors.some(e => e.includes('timeout'))) {
      return '请设置一个大于0的数字，单位为毫秒，例如：5000'
    }
    
    return '请检查请求配置参数是否正确'
  }

  /**
   * 获取验证错误代码
   */
  private getValidationCode(validation: ValidationResult): string {
    if (validation.errors.some(e => e.includes('URL'))) {
      return 'INVALID_URL'
    }
    
    if (validation.errors.some(e => e.includes('method'))) {
      return 'INVALID_METHOD'
    }
    
    if (validation.errors.some(e => e.includes('timeout'))) {
      return 'INVALID_TIMEOUT'
    }
    
    return 'VALIDATION_FAILED'
  }

  /**
   * 重置全局配置
   */
  reset(): void {
    this.globalConfig = {}
  }

  /**
   * 获取配置统计信息
   */
  getStats(): {
    hasGlobalConfig: boolean
    globalConfigKeys: string[]
    hasBaseURL: boolean
    hasGlobalTimeout: boolean
    hasGlobalHeaders: boolean
    globalHeadersCount: number
  } {
    return {
      hasGlobalConfig: Object.keys(this.globalConfig).length > 0,
      globalConfigKeys: Object.keys(this.globalConfig),
      hasBaseURL: !!this.globalConfig.baseURL,
      hasGlobalTimeout: !!this.globalConfig.timeout,
      hasGlobalHeaders: !!this.globalConfig.headers,
      globalHeadersCount: this.globalConfig.headers ? Object.keys(this.globalConfig.headers).length : 0
    }
  }
}
