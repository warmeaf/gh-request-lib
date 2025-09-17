import { Requestor, RequestConfig, RequestError, RequestErrorType, IdempotentConfig, IdempotentStats } from '../interface'
import { CacheFeature, CacheConfig } from './cache'
import { CacheKeyGenerator, CacheKeyConfig } from '../cache/cache-key-generator'

/**
 * @description 幂等请求功能 - 基于缓存实现，支持请求去重
 */
export class IdempotentFeature {
  private cacheFeature: CacheFeature
  private pendingRequests: Map<string, Promise<any>>  // 正在进行的请求
  private stats: IdempotentStats
  private keyGenerator: CacheKeyGenerator
  private readonly cacheKeyConfig: CacheKeyConfig

  constructor(private requestor: Requestor) {
    // 共用配置，避免重复
    this.cacheKeyConfig = {
      includeHeaders: true,
      headersWhitelist: ['content-type', 'authorization', 'x-api-key'],
      maxKeyLength: 512,
      enableHashCache: true,
      hashAlgorithm: 'fnv1a'
    }

    // 使用专门的缓存实例，配置适合幂等请求的参数
    this.cacheFeature = new CacheFeature(requestor, 5000, this.cacheKeyConfig)
    this.keyGenerator = new CacheKeyGenerator(this.cacheKeyConfig)
    this.pendingRequests = new Map()

    this.stats = {
      totalRequests: 0,
      duplicatesBlocked: 0,
      pendingRequestsReused: 0,
      cacheHits: 0,
      actualNetworkRequests: 0,
      duplicateRate: 0,
      avgResponseTime: 0,
      keyGenerationTime: 0
    }
  }

  /**
   * 幂等请求 - 防止重复提交，支持请求去重
   */
  async requestIdempotent<T>(
    config: RequestConfig,
    idempotentConfig: IdempotentConfig = {}
  ): Promise<T> {
    const startTime = Date.now()
    this.stats.totalRequests++

    // 配置验证
    this.validateIdempotentConfig(idempotentConfig)

    // 配置默认值
    const {
      ttl = 30000, // 默认30秒幂等保护
      key,
      includeHeaders = ['content-type', 'authorization'],
      includeAllHeaders = false,
      hashAlgorithm = 'fnv1a',
      onDuplicate
    } = idempotentConfig

    // 更新键生成器配置以支持幂等逻辑
    const keyGeneratorConfig: CacheKeyConfig = {
      includeHeaders: includeAllHeaders || includeHeaders.length > 0,
      headersWhitelist: includeAllHeaders ? undefined : includeHeaders,
      hashAlgorithm
    }

    // 生成幂等键 - 确保请求方法、URL、参数、数据、指定请求头完全一致
    const keyGenStartTime = Date.now()
    const idempotentKey = key || this.generateIdempotentKey(config, keyGeneratorConfig)
    const keyGenTime = Date.now() - keyGenStartTime
    this.updateKeyGenerationTime(keyGenTime)

    try {
      // 第一步：检查缓存是否命中
      const cached = await this.checkCacheHit<T>(idempotentKey, config, onDuplicate)
      if (cached !== null) {
        const responseTime = Date.now() - startTime
        this.updateAvgResponseTime(responseTime)
        return cached
      }

      // 第二步：检查是否有正在进行的相同请求
      const pendingRequest = this.pendingRequests.get(idempotentKey)
      if (pendingRequest) {
        this.stats.duplicatesBlocked++
        this.stats.pendingRequestsReused++
        this.updateDuplicateRate()

        // 触发重复请求回调
        if (onDuplicate) {
          try {
            const originalRequest = JSON.parse(JSON.stringify(config))
            onDuplicate(originalRequest, config)
          } catch (callbackError) {
            console.warn(`⚠️ [Idempotent] Callback execution failed: ${callbackError instanceof Error ? callbackError.message : 'Unknown error'}`)
          }
        }

        console.log(`🔄 [Idempotent] Waiting for pending request: ${config.method} ${config.url}`)
        const result = await pendingRequest
        const responseTime = Date.now() - startTime
        this.updateAvgResponseTime(responseTime)
        return result
      }

      // 第三步：创建新请求并执行
      const requestPromise = this.executeRequest<T>(config, idempotentKey, ttl, keyGeneratorConfig)
      this.pendingRequests.set(idempotentKey, requestPromise)
      this.stats.actualNetworkRequests++

      const result = await requestPromise
      const responseTime = Date.now() - startTime
      this.updateAvgResponseTime(responseTime)
      return result

    } catch (error) {
      const responseTime = Date.now() - startTime
      this.updateAvgResponseTime(responseTime)
      
      // 区分不同类型的错误
      if (error instanceof RequestError) {
        // 增强请求错误信息
        const enhancedError = new RequestError(
          `Idempotent request failed: ${error.message}`,
          {
            type: error.type,
            status: error.status,
            isHttpError: error.isHttpError,
            originalError: error.originalError,
            context: {
              ...error.context,
              url: config.url,
              method: config.method,
              tag: config.tag,
              duration: responseTime,
              metadata: {
                ...error.context?.metadata,
                idempotentKey
              }
            },
            suggestion: error.suggestion || 'Please check the request configuration and try again',
            code: error.code
          }
        )
        console.error(`❌ [Idempotent] Request failed: ${config.method} ${config.url}`, enhancedError.toJSON())
        throw enhancedError
      } else {
        // 包装未知错误
        const wrappedError = new RequestError(
          `Idempotent request failed with unknown error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          {
            type: RequestErrorType.UNKNOWN_ERROR,
            originalError: error,
            context: {
              url: config.url,
              method: config.method,
              tag: config.tag,
              duration: responseTime,
              timestamp: Date.now(),
              userAgent: typeof navigator !== 'undefined' && navigator ? navigator.userAgent : 'Node.js'
            },
            suggestion: 'Please check the network connection and request configuration'
          }
        )
        console.error(`❌ [Idempotent] Request failed: ${config.method} ${config.url}`, wrappedError.toJSON())
        throw wrappedError
      }
    }
  }

  /**
   * 生成幂等键 - 确保完全相同的请求产生相同的键
   */
  private generateIdempotentKey(config: RequestConfig, keyConfig: CacheKeyConfig): string {
    // 为幂等请求添加特殊前缀
    const baseKey = this.keyGenerator.generateCacheKey(config)
    return `idempotent:${baseKey}`
  }

  /**
   * 便利方法 - GET请求幂等（通常用于防止重复查询）
   */
  async getIdempotent<T>(url: string, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T> {
    return this.requestIdempotent<T>({
      url,
      method: 'GET',
      ...config
    }, idempotentConfig)
  }

  /**
   * 便利方法 - POST请求幂等（防重复提交）
   */
  async postIdempotent<T>(url: string, data?: any, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T> {
    return this.requestIdempotent<T>({
      url,
      method: 'POST',
      data,
      ...config
    }, idempotentConfig)
  }

  /**
   * 便利方法 - PUT请求幂等
   */
  async putIdempotent<T>(url: string, data?: any, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T> {
    return this.requestIdempotent<T>({
      url,
      method: 'PUT',
      data,
      ...config
    }, idempotentConfig)
  }

  /**
   * 便利方法 - PATCH请求幂等
   */
  async patchIdempotent<T>(url: string, data?: any, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T> {
    return this.requestIdempotent<T>({
      url,
      method: 'PATCH',
      data,
      ...config
    }, idempotentConfig)
  }

  /**
   * 检查缓存是否命中
   */
  private async checkCacheHit<T>(
    idempotentKey: string, 
    config: RequestConfig, 
    onDuplicate?: (originalRequest: RequestConfig, duplicateRequest: RequestConfig) => void
  ): Promise<T | null> {
    try {
      // 使用一个虚拟请求来检查缓存，设置极短的TTL让它只检查不执行请求
      const cacheConfig: CacheConfig = {
        key: idempotentKey,
        ttl: 1, // 极短TTL，实际上这里只是为了检查缓存
        clone: 'deep'
      }

      // 尝试直接从缓存功能获取，如果缓存不存在会抛出错误或返回undefined
      // 我们需要检查内部存储，但由于CacheFeature没有直接的get方法，
      // 我们使用一个技巧：创建一个不会执行的伪请求来利用requestWithCache的缓存检查逻辑
      
      // 创建一个永远不会被执行的伪造请求配置
      const fakeConfig: RequestConfig = {
        ...config,
        url: 'fake://cache-check', // 伪造URL确保不会真正发送请求
        method: 'GET'
      }

      // 使用私有属性访问存储适配器（这是一个hack，但是必要的）
      const storageAdapter = (this.cacheFeature as any).storageAdapter
      if (storageAdapter) {
        const cachedItem = await storageAdapter.getItem(idempotentKey)
        if (cachedItem && this.isCacheValid(cachedItem)) {
          this.stats.duplicatesBlocked++
          this.stats.cacheHits++
          this.updateDuplicateRate()

          // 触发重复请求回调
          if (onDuplicate) {
            try {
              const originalRequest = JSON.parse(JSON.stringify(config))
              onDuplicate(originalRequest, config)
            } catch (callbackError) {
              console.warn(`⚠️ [Idempotent] Callback execution failed: ${callbackError instanceof Error ? callbackError.message : 'Unknown error'}`)
            }
          }

          console.log(`💾 [Idempotent] Cache hit for request: ${config.method} ${config.url}`)
          
          // 更新访问信息
          cachedItem.accessTime = Date.now()
          cachedItem.accessCount = (cachedItem.accessCount || 0) + 1
          await storageAdapter.setItem(cachedItem)
          
          return this.safeCloneData(cachedItem.data, 'deep') as T
        }
      }
    } catch (error) {
      // 缓存检查失败，继续正常流程
      console.warn(`⚠️ [Idempotent] Cache check failed: ${error instanceof Error ? error.message : 'Unknown error'}`)
    }

    return null
  }

  /**
   * 检查缓存项是否有效
   */
  private isCacheValid(cachedItem: any): boolean {
    if (!cachedItem || !cachedItem.timestamp || !cachedItem.ttl) {
      return false
    }
    
    const now = Date.now()
    return (now - cachedItem.timestamp) < cachedItem.ttl
  }

  /**
   * 安全克隆数据
   */
  private safeCloneData(data: any, cloneType: 'deep' | 'shallow' | 'none' = 'none'): any {
    if (cloneType === 'none') return data
    
    try {
      if (cloneType === 'deep') {
        return JSON.parse(JSON.stringify(data))
      } else if (cloneType === 'shallow') {
        if (Array.isArray(data)) return [...data]
        if (data && typeof data === 'object') return { ...data }
      }
    } catch (error) {
      console.warn('[IdempotentFeature] Clone failed, returning original data:', error)
    }
    
    return data
  }

  /**
   * 执行实际请求
   */
  private async executeRequest<T>(
    config: RequestConfig,
    idempotentKey: string,
    ttl: number,
    keyGeneratorConfig: CacheKeyConfig
  ): Promise<T> {
    // 构造缓存配置
    const cacheConfig: CacheConfig = {
      ttl,
      key: idempotentKey,
      keyGenerator: keyGeneratorConfig,
      clone: 'deep' // 幂等请求返回深拷贝，避免数据被修改
    }

    try {
      console.log(`🚀 [Idempotent] Starting new request: ${config.method} ${config.url}`)
      
      // 使用缓存功能执行请求并缓存结果
      const result = await this.cacheFeature.requestWithCache<T>(config, cacheConfig)
      
      // 请求成功后清理pending requests
      this.pendingRequests.delete(idempotentKey)
      
      console.log(`✅ [Idempotent] Request completed: ${config.method} ${config.url}`)
      return result
      
    } catch (error) {
      // 请求失败后清理pending requests
      this.pendingRequests.delete(idempotentKey)
      
      console.error(`❌ [Idempotent] Request failed: ${config.method} ${config.url}`, error)
      throw error
    }
  }

  /**
   * 清除幂等缓存
   */
  async clearIdempotentCache(key?: string): Promise<void> {
    if (key && !key.startsWith('idempotent:')) {
      key = `idempotent:${key}`
    }
    await this.cacheFeature.clearCache(key)
    
    // 同时清理对应的pending requests
    if (key) {
      this.pendingRequests.delete(key)
    } else {
      // 如果没有指定key，清理所有pending requests
      this.pendingRequests.clear()
    }
  }

  /**
   * 获取幂等统计信息
   */
  getIdempotentStats(): IdempotentStats {
    return { ...this.stats }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = {
      totalRequests: 0,
      duplicatesBlocked: 0,
      pendingRequestsReused: 0,
      cacheHits: 0,
      actualNetworkRequests: 0,
      duplicateRate: 0,
      avgResponseTime: 0,
      keyGenerationTime: 0
    }
  }

  /**
   * 销毁幂等功能
   */
  async destroy(): Promise<void> {
    // 清理所有pending requests
    this.pendingRequests.clear()
    
    // 销毁缓存功能
    await this.cacheFeature.destroy()
    
    // 重置统计
    this.resetStats()
    
    console.log('[IdempotentFeature] Resources cleaned up')
  }

  /**
   * 验证幂等配置参数
   */
  private validateIdempotentConfig(config: IdempotentConfig): void {
    const { ttl, includeHeaders, hashAlgorithm } = config

    if (ttl !== undefined && (ttl <= 0 || !Number.isInteger(ttl))) {
      throw new RequestError('TTL must be a positive integer', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_TTL'
      })
    }

    if (includeHeaders !== undefined && !Array.isArray(includeHeaders)) {
      throw new RequestError('includeHeaders must be an array', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_HEADERS'
      })
    }

    if (hashAlgorithm !== undefined && !['fnv1a', 'xxhash', 'simple'].includes(hashAlgorithm)) {
      throw new RequestError('hashAlgorithm must be one of: fnv1a, xxhash, simple', {
        type: RequestErrorType.VALIDATION_ERROR,
        code: 'INVALID_HASH_ALGORITHM'
      })
    }
  }

  // 私有统计更新方法
  private updateDuplicateRate(): void {
    this.stats.duplicateRate = this.stats.totalRequests > 0
      ? (this.stats.duplicatesBlocked / this.stats.totalRequests) * 100
      : 0
  }

  private updateAvgResponseTime(responseTime: number): void {
    const totalResponseTime = this.stats.avgResponseTime * (this.stats.totalRequests - 1)
    this.stats.avgResponseTime = (totalResponseTime + responseTime) / this.stats.totalRequests
  }

  private updateKeyGenerationTime(keyGenTime: number): void {
    const totalKeyTime = this.stats.keyGenerationTime * (this.stats.totalRequests - 1)
    this.stats.keyGenerationTime = (totalKeyTime + keyGenTime) / this.stats.totalRequests
  }

  // 移除updateCacheHitRate方法，因为现在有独立的cacheHits统计
}