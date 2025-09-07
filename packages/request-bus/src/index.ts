import { RequestConfig, RequestImplementation } from './config'
import { 
  RequestCore, 
  RequestError, 
  RequestErrorType,
  GlobalConfig,
  RequestInterceptor 
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

/**
 * @description 增强的业务层 API 集合 - 提供丰富的开发体验
 */
class RequestBus {
  private apiMap: Map<string, ApiInstance> = new Map()
  private globalInterceptors: RequestInterceptor[] = []
  private debugMode: boolean = false
  private version: string = '1.0.0'

  /**
   * 注册API实例 - 增强版本
   */
  register<T extends ApiInstance>(name: string, apiClass: ApiClass<T>, options?: {
    override?: boolean
    tags?: string[]
    description?: string
  }): T {
    if (!name || typeof name !== 'string') {
      throw new RequestError('API name must be a non-empty string', {
        type: RequestErrorType.VALIDATION_ERROR,
        suggestion: '请提供有效的API名称，例如："user", "product"等',
        code: 'INVALID_API_NAME'
      })
    }
    
    if (!apiClass || typeof apiClass !== 'function') {
      throw new RequestError('API class must be a valid constructor', {
        type: RequestErrorType.VALIDATION_ERROR,
        suggestion: '请提供有效的API类构造函数',
        code: 'INVALID_API_CLASS'
      })
    }
    
    if (this.apiMap.has(name) && !options?.override) {
      throw new RequestError(`API '${name}' is already registered`, {
        type: RequestErrorType.VALIDATION_ERROR,
        suggestion: '请使用不同的名称或设置 override: true 强制覆盖',
        code: 'API_ALREADY_EXISTS'
      })
    }

    try {
      const requestCore = RequestConfig.getInstance()
      
      // 添加全局拦截器
      this.globalInterceptors.forEach(interceptor => {
        requestCore.addInterceptor(interceptor)
      })
      
      const apiInstance = new apiClass(requestCore)
      
      // 添加元数据
      if (options?.tags || options?.description) {
        (apiInstance as any).__metadata = {
          name,
          tags: options.tags || [],
          description: options.description,
          registeredAt: new Date().toISOString()
        }
      }
      
      this.apiMap.set(name, apiInstance)
      
      if (this.debugMode) {
        console.log(`🔌 [RequestBus] Registered API: ${name}`, {
          class: apiClass.name,
          options
        })
      }
      
      return apiInstance
    } catch (error) {
      throw new RequestError(`Failed to register API '${name}'`, {
        type: RequestErrorType.VALIDATION_ERROR,
        originalError: error,
        suggestion: '请检查API类的构造函数是否正确实现',
        code: 'API_REGISTRATION_FAILED'
      })
    }
  }

  /**
   * 删除API实例
   */
  deleteApi(name: string): boolean {
    if (!name || typeof name !== 'string') {
      throw new RequestError('API name must be a non-empty string', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_API_NAME'
      })
    }
    
    const existed = this.apiMap.has(name)
    if (existed) {
      this.apiMap.delete(name)
      
      if (this.debugMode) {
        console.log(`🗋 [RequestBus] Deleted API: ${name}`)
      }
    }
    
    return existed
  }

  /**
   * 清空所有API实例
   */
  deleteAllApi(): number {
    const count = this.apiMap.size
    this.apiMap.clear()
    
    if (this.debugMode && count > 0) {
      console.log(`🗋 [RequestBus] Cleared ${count} APIs`)
    }
    
    return count
  }

  /**
   * 获取API实例 - 增强版本
   */
  getApi<T extends ApiInstance = ApiInstance>(name: string): T | undefined {
    if (!name || typeof name !== 'string') {
      throw new RequestError('API name must be a non-empty string', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_API_NAME'
      })
    }
    return this.apiMap.get(name) as T | undefined
  }
  
  /**
   * 安全获取API实例，不存在时抛出错误
   */
  requireApi<T extends ApiInstance = ApiInstance>(name: string): T {
    const api = this.getApi<T>(name)
    if (!api) {
      throw new RequestError(`API '${name}' is not registered`, {
        type: RequestErrorType.VALIDATION_ERROR,
        suggestion: `请先注册 API '${name}' 或检查名称是否正确`,
        code: 'API_NOT_FOUND',
        context: {
          metadata: {
            availableApis: this.listApiNames(),
            requestedApi: name
          }
        }
      })
    }
    return api
  }

  /**
   * 切换请求实现 - 增强版本
   */
  switchImplementation(implementation: RequestImplementation, options?: { 
    clearCache?: boolean
    preserveInterceptors?: boolean
    preserveGlobalConfig?: boolean
  }): void {
    const opts = {
      clearCache: options?.clearCache ?? false,
      preserveInterceptors: options?.preserveInterceptors ?? true,
      preserveGlobalConfig: options?.preserveGlobalConfig ?? true
    }
    
    // 保存当前状态
    const currentGlobalConfig = opts.preserveGlobalConfig ? RequestConfig.getInstance().getGlobalConfig() : {}
    const currentInterceptors = opts.preserveInterceptors ? [...this.globalInterceptors] : []
    
    if (this.debugMode) {
      console.log(`🔄 [RequestBus] Switching to ${implementation} implementation`, opts)
    }
    
    // 清除缓存
    if (opts.clearCache) {
      try { 
        RequestConfig.getInstance().clearCache() 
        if (this.debugMode) {
          console.log('🗑️ [RequestBus] Cache cleared during implementation switch')
        }
      } catch (error) {
        console.warn('[RequestBus] Failed to clear cache:', error)
      }
    }

    try {
      // 重置和创建新实例
      RequestConfig.reset()
      RequestConfig.createRequestCore(implementation)
      
      const newRequestCore = RequestConfig.getInstance()
      
      // 恢复全局配置
      if (opts.preserveGlobalConfig) {
        newRequestCore.setGlobalConfig(currentGlobalConfig)
      }
      
      // 恢复拦截器
      if (opts.preserveInterceptors) {
        currentInterceptors.forEach(interceptor => {
          newRequestCore.addInterceptor(interceptor)
        })
      }

      // 更新所有API实例
      this.apiMap.forEach((api, name) => {
        api.requestCore = newRequestCore
        
        if (this.debugMode) {
          console.log(`🔄 [RequestBus] Updated API '${name}' with new implementation`)
        }
      })
      
      if (this.debugMode) {
        console.log(`✅ [RequestBus] Successfully switched to ${implementation}`)
      }
      
    } catch (error) {
      throw new RequestError(`Failed to switch to ${implementation} implementation`, {
        type: RequestErrorType.VALIDATION_ERROR,
        originalError: error,
        suggestion: '请检查实现名称是否正确或相关依赖是否安装',
        code: 'IMPLEMENTATION_SWITCH_FAILED'
      })
    }
  }

  // ==================== 缓存管理 ====================
  
  /**
   * 清除缓存
   */
  clearCache(key?: string): void {
    try {
      RequestConfig.getInstance().clearCache(key)
      
      if (this.debugMode) {
        console.log(`🗑️ [RequestBus] Cache cleared${key ? `: ${key}` : ' (all)'}`)
      }
    } catch (error) {
      console.error('[RequestBus] Failed to clear cache:', error)
    }
  }
  
  /**
   * 获取缓存统计
   */
  getCacheStats() {
    try {
      return RequestConfig.getInstance().getCacheStats()
    } catch (error) {
      console.error('[RequestBus] Failed to get cache stats:', error)
      return { size: 0, maxEntries: 0 }
    }
  }

  // ==================== 全局配置和拦截器 ====================
  
  /**
   * 添加全局拦截器
   */
  addGlobalInterceptor(interceptor: RequestInterceptor): void {
    this.globalInterceptors.push(interceptor)
    
    // 应用到所有已注册API
    this.apiMap.forEach(api => {
      api.requestCore.addInterceptor(interceptor)
    })
    
    if (this.debugMode) {
      console.log('🔌 [RequestBus] Added global interceptor')
    }
  }
  
  /**
   * 清除所有全局拦截器
   */
  clearGlobalInterceptors(): void {
    this.globalInterceptors = []
    
    // 清除所有API的拦截器
    this.apiMap.forEach(api => {
      api.requestCore.clearInterceptors()
    })
    
    if (this.debugMode) {
      console.log('🗋 [RequestBus] Cleared all global interceptors')
    }
  }
  
  /**
   * 设置全局配置
   */
  setGlobalConfig(config: GlobalConfig): void {
    try {
      RequestConfig.getInstance().setGlobalConfig(config)
      
      if (config.debug !== undefined) {
        this.debugMode = config.debug
      }
      
      if (this.debugMode) {
        console.log('⚙️ [RequestBus] Global config updated:', config)
      }
    } catch (error) {
      throw new RequestError('Failed to set global config', {
        type: RequestErrorType.VALIDATION_ERROR,
        originalError: error,
        suggestion: '请检查配置参数是否正确',
        code: 'GLOBAL_CONFIG_FAILED'
      })
    }
  }
  
  // ==================== 开发者工具 ====================
  
  /**
   * 列出所有已注册API名称
   */
  listApiNames(): string[] {
    return Array.from(this.apiMap.keys())
  }
  
  /**
   * 获取API详细信息
   */
  getApiInfo(name?: string): any {
    if (name) {
      const api = this.getApi(name)
      if (!api) return null
      
      return {
        name,
        metadata: (api as any).__metadata,
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(api))
          .filter(prop => prop !== 'constructor' && typeof (api as any)[prop] === 'function')
      }
    }
    
    // 返回所有API信息
    const apiInfo: any = {}
    this.apiMap.forEach((api, name) => {
      apiInfo[name] = {
        metadata: (api as any).__metadata,
        methods: Object.getOwnPropertyNames(Object.getPrototypeOf(api))
          .filter(prop => prop !== 'constructor' && typeof (api as any)[prop] === 'function')
      }
    })
    
    return apiInfo
  }
  
  /**
   * 获取所有统计信息
   */
  getAllStats(): {
    version: string
    apiCount: number
    debugMode: boolean
    interceptorsCount: number
    cacheStats: any
    concurrentStats?: any
  } {
    const cacheStats = this.getCacheStats()
    let concurrentStats = undefined
    
    try {
      concurrentStats = RequestConfig.getInstance().getConcurrentStats()
    } catch {}
    
    return {
      version: this.version,
      apiCount: this.apiMap.size,
      debugMode: this.debugMode,
      interceptorsCount: this.globalInterceptors.length,
      cacheStats,
      concurrentStats
    }
  }
  
  /**
   * 切换调试模式
   */
  setDebugMode(enabled: boolean): void {
    this.debugMode = enabled
    
    // 更新全局配置
    try {
      RequestConfig.getInstance().setGlobalConfig({ debug: enabled })
    } catch {}
    
    console.log(`🐛 [RequestBus] Debug mode ${enabled ? 'enabled' : 'disabled'}`)
  }
  
  /**
   * 显示帮助信息
   */
  help(): void {
    console.group('📚 [RequestBus] Help')
    console.log('Version:', this.version)
    console.log('Available APIs:', this.listApiNames())
    console.log('Debug Mode:', this.debugMode)
    console.log('\nCommon Methods:')
    console.log('  - register(name, apiClass, options?)      // 注册API')
    console.log('  - getApi(name)                           // 获取API')
    console.log('  - requireApi(name)                       // 安全获取API')
    console.log('  - switchImplementation(impl, options?)    // 切换实现')
    console.log('  - setGlobalConfig(config)                // 设置全局配置')
    console.log('  - setDebugMode(enabled)                  // 切换调试模式')
    console.log('  - getAllStats()                          // 获取统计信息')
    console.groupEnd()
  }
  
  /**
   * 销毁所有资源 - 增强版本
   */
  destroy(): void {
    const apiCount = this.apiMap.size
    
    try {
      RequestConfig.getInstance().destroy()
    } catch (error) {
      console.error('[RequestBus] Failed to destroy request config:', error)
    }
    
    this.deleteAllApi()
    this.clearGlobalInterceptors()
    
    if (this.debugMode) {
      console.log(`🗋 [RequestBus] Destroyed: ${apiCount} APIs, all interceptors and cache`)
    }
  }
}

// 创建并导出增强的单例
export const requestBus = new RequestBus()

// 导出类型和接口
export type { RequestImplementation } from './config'
export type { ApiClass, ApiInstance }
export { RequestBus }

// 导出便利函数
export const {
  register,
  getApi,
  requireApi,
  deleteApi,
  listApiNames,
  switchImplementation,
  setGlobalConfig,
  addGlobalInterceptor,
  clearCache,
  setDebugMode,
  getAllStats,
  help
} = requestBus

// 导出错误类型
export { RequestError, RequestErrorType } from 'request-core'
