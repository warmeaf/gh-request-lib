import {
  Requestor,
  RequestConfig,
  RequestData,
  RequestError,
  RequestErrorType,
  IdempotentConfig,
  IdempotentStats,
} from '../../interface'
import { CacheFeature, CacheConfig } from '../cache'
import { CacheKeyGenerator, CacheKeyConfig } from '../../cache/cache-key-generator'

/**
 * @description 幂等请求功能 - 基于缓存实现，支持请求去重
 */
/**
 * 幂等功能默认配置
 */
const DEFAULT_IDEMPOTENT_CONFIG = {
  TTL: 30000, // 默认30秒幂等保护
  MAX_ENTRIES: 5000, // 最大缓存条目数
  DEFAULT_INCLUDE_HEADERS: ['content-type', 'authorization'] as string[],
} as const

/**
 * 默认缓存键生成配置
 */
const DEFAULT_CACHE_KEY_CONFIG: CacheKeyConfig = {
  includeHeaders: true,
  headersWhitelist: ['content-type', 'authorization', 'x-api-key'],
  maxKeyLength: 512,
  enableHashCache: true,
  hashAlgorithm: 'fnv1a',
} as const

/**
 * 幂等请求处理上下文
 */
interface IdempotentRequestContext {
  idempotentKey: string
  config: RequestConfig
  startTime: number
  onDuplicate?: (
    originalRequest: RequestConfig,
    duplicateRequest: RequestConfig
  ) => void
}

/**
 * 新请求执行配置
 */
interface NewRequestExecutionConfig {
  config: RequestConfig
  idempotentKey: string
  ttl: number
  keyGeneratorConfig: CacheKeyConfig
  startTime: number
}

/**
 * 错误类型枚举
 */
enum IdempotentErrorType {
  CACHE_ERROR = 'CACHE_ERROR',
  KEY_GENERATION_ERROR = 'KEY_GENERATION_ERROR',
  REQUEST_ERROR = 'REQUEST_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
}

/**
 * 缓存操作结果
 */
interface CacheOperationResult<T> {
  success: boolean
  data?: T
  error?: Error
  fallbackUsed?: boolean
}

/**
 * 缓存项接口定义
 */
interface CacheItem {
  key: string
  data: unknown
  timestamp: number
  ttl: number
  accessTime: number
  accessCount: number
}

export class IdempotentFeature {
  private cacheFeature: CacheFeature
  private pendingRequests: Map<string, Promise<unknown>> // 正在进行的请求
  private stats: IdempotentStats
  private readonly cacheKeyConfig: CacheKeyConfig

  constructor(private requestor: Requestor, config?: Partial<CacheKeyConfig>) {
    // 合并配置，使用默认配置作为基础
    this.cacheKeyConfig = {
      ...DEFAULT_CACHE_KEY_CONFIG,
      ...config,
    }

    // 初始化组件
    this.cacheFeature = new CacheFeature(
      requestor,
      DEFAULT_IDEMPOTENT_CONFIG.MAX_ENTRIES,
      this.cacheKeyConfig
    )
    this.pendingRequests = new Map()
    this.stats = this.createInitialStats()
  }

  /**
   * 创建初始统计数据
   */
  private createInitialStats(): IdempotentStats {
    return {
      totalRequests: 0,
      duplicatesBlocked: 0,
      pendingRequestsReused: 0,
      cacheHits: 0,
      actualNetworkRequests: 0,
      duplicateRate: 0,
      avgResponseTime: 0,
      keyGenerationTime: 0,
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

    try {
      return await this.processIdempotentRequest<T>(
        config,
        idempotentConfig,
        startTime
      )
    } catch (error) {
      const responseTime = Date.now() - startTime
      this.updateStats({ responseTime })
      throw this.enhanceError(error, config, responseTime)
    }
  }

  /**
   * 处理幂等请求的主要流程
   */
  private async processIdempotentRequest<T>(
    config: RequestConfig,
    idempotentConfig: IdempotentConfig,
    startTime: number
  ): Promise<T> {
    // 配置验证和准备
    this.validateIdempotentConfig(idempotentConfig)
    const processedConfig = this.prepareIdempotentConfig(idempotentConfig)

    // 生成幂等键
    const { idempotentKey, keyGenTime } = this.generateIdempotentKeyWithStats(
      config,
      processedConfig.keyGeneratorConfig,
      processedConfig.key
    )
    this.updateStats({ keyGenTime })

    // 构建请求上下文
    const requestContext: IdempotentRequestContext = {
      idempotentKey,
      config,
      startTime,
      onDuplicate: processedConfig.onDuplicate,
    }

    // 检查缓存命中
    const cachedResult = await this.checkCacheHit<T>(requestContext)
    if (cachedResult !== null) {
      const responseTime = Date.now() - startTime
      this.updateStats({ responseTime })
      return cachedResult
    }

    // 检查正在进行的请求
    const pendingResult = await this.checkPendingRequest<T>(requestContext)
    if (pendingResult !== null) {
      return pendingResult
    }

    // 执行新请求
    const executionConfig: NewRequestExecutionConfig = {
      config,
      idempotentKey,
      ttl: processedConfig.ttl,
      keyGeneratorConfig: processedConfig.keyGeneratorConfig,
      startTime,
    }
    return await this.executeNewIdempotentRequest<T>(executionConfig)
  }

  /**
   * 准备幂等配置
   */
  private prepareIdempotentConfig(idempotentConfig: IdempotentConfig) {
    const {
      ttl = DEFAULT_IDEMPOTENT_CONFIG.TTL,
      key,
      includeHeaders = DEFAULT_IDEMPOTENT_CONFIG.DEFAULT_INCLUDE_HEADERS,
      includeAllHeaders = false,
      hashAlgorithm = 'fnv1a',
      onDuplicate,
    } = idempotentConfig

    const keyGeneratorConfig: CacheKeyConfig = {
      includeHeaders: includeAllHeaders || includeHeaders.length > 0,
      headersWhitelist: includeAllHeaders ? undefined : includeHeaders,
      hashAlgorithm,
    }

    return {
      ttl,
      key,
      keyGeneratorConfig,
      onDuplicate,
    }
  }

  /**
   * 生成幂等键并计算统计信息（带错误处理）
   */
  private generateIdempotentKeyWithStats(
    config: RequestConfig,
    keyConfig: CacheKeyConfig,
    customKey?: string
  ): { idempotentKey: string; keyGenTime: number } {
    const keyGenStartTime = Date.now()

    try {
      const idempotentKey =
        customKey || this.generateIdempotentKey(config, keyConfig)
      const keyGenTime = Date.now() - keyGenStartTime
      return { idempotentKey, keyGenTime }
    } catch (error) {
      const keyGenTime = Date.now() - keyGenStartTime

      // 键生成失败，使用降级策略
      const fallbackKey = this.generateFallbackKey(config)

      console.warn(
        `⚠️ [Idempotent] Key generation failed for ${config.method} ${config.url}, using fallback:`,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          fallbackKey,
        }
      )

      return { idempotentKey: fallbackKey, keyGenTime }
    }
  }

  /**
   * 生成降级键（简化版本）
   */
  private generateFallbackKey(config: RequestConfig): string {
    try {
      // 使用简单的字符串拼接作为降级方案
      const parts: string[] = [
        config.method || 'GET',
        config.url || '',
        config.data ? this.safeStringify(config.data) : '',
      ]

      const baseKey = parts.join('|')
      // 使用简单的哈希避免键过长
      const hash = this.simpleHash(baseKey)

      return `idempotent:fallback:${hash}`
    } catch (error) {
      // 如果连降级都失败了，使用最基础的键
      const timestamp = Date.now()
      const random = Math.random().toString(36).substring(2, 8)
      return `idempotent:emergency:${timestamp}_${random}`
    }
  }

  /**
   * 安全的JSON序列化
   */
  private safeStringify(data: unknown): string {
    try {
      return JSON.stringify(data)
    } catch (error) {
      // JSON序列化失败，返回类型信息
      return `[${typeof data}]`
    }
  }

  /**
   * 简单哈希函数（降级方案）
   */
  private simpleHash(str: string): string {
    let hash = 0
    if (str.length === 0) return hash.toString()

    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = (hash << 5) - hash + char
      hash = hash & hash // 转换为32位整数
    }

    return Math.abs(hash).toString(36)
  }

  /**
   * 生成幂等键 - 确保完全相同的请求产生相同的键
   */
  private generateIdempotentKey(
    config: RequestConfig,
    keyConfig: CacheKeyConfig
  ): string {
    // 创建临时键生成器，避免修改实例配置
    const tempKeyGenerator = new CacheKeyGenerator({
      ...this.cacheKeyConfig,
      ...keyConfig,
    })

    // 为幂等请求添加特殊前缀
    const baseKey = tempKeyGenerator.generateCacheKey(config)
    return `idempotent:${baseKey}`
  }

  /**
   * 检查是否有正在进行的请求
   */
  private async checkPendingRequest<T>(
    context: IdempotentRequestContext
  ): Promise<T | null> {
    const pendingRequest = this.pendingRequests.get(context.idempotentKey)
    if (!pendingRequest) {
      return null
    }

    this.updateStats({
      incrementDuplicates: true,
      incrementPendingReused: true,
    })

    // 触发重复请求回调
    this.handleDuplicateCallback(context.config, context.onDuplicate)

    console.log(
      `🔄 [Idempotent] Waiting for pending request: ${context.config.method} ${context.config.url}`
    )

    const result = (await pendingRequest) as T
    const responseTime = Date.now() - context.startTime
    this.updateStats({ responseTime })

    return result
  }

  /**
   * 执行新的幂等请求
   */
  private async executeNewIdempotentRequest<T>(
    execConfig: NewRequestExecutionConfig
  ): Promise<T> {
    const requestPromise = this.executeRequest<T>(
      execConfig.config,
      execConfig.idempotentKey,
      execConfig.ttl,
      execConfig.keyGeneratorConfig
    )
    this.pendingRequests.set(execConfig.idempotentKey, requestPromise)
    this.updateStats({ incrementNetworkRequests: true })

    const result = await requestPromise
    const responseTime = Date.now() - execConfig.startTime
    this.updateStats({ responseTime })

    return result
  }

  /**
   * 简化的错误增强方法
   */
  private enhanceError(
    error: unknown,
    config: RequestConfig,
    responseTime: number
  ): RequestError {
    if (error instanceof RequestError) {
      console.error(
        `❌ [Idempotent] Request failed: ${config.method} ${config.url}`,
        {
          error: error.toJSON(),
          duration: `${responseTime}ms`,
        }
      )
      return error
    }

    const enhancedError = new RequestError(
      `Idempotent request failed: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
      {
        type: RequestErrorType.UNKNOWN_ERROR,
        originalError: error,
        context: {
          url: config.url,
          method: config.method,
          tag: config.tag,
          duration: responseTime,
          timestamp: Date.now(),
          userAgent:
            typeof navigator !== 'undefined' && navigator
              ? navigator.userAgent
              : 'Node.js',
        },
        suggestion:
          'Please check the network connection and request configuration',
      }
    )

    console.error(
      `❌ [Idempotent] Request failed: ${config.method} ${config.url}`,
      {
        error: enhancedError.toJSON(),
        duration: `${responseTime}ms`,
      }
    )

    return enhancedError
  }

  /**
   * 通用的HTTP方法幂等请求
   */
  private async httpIdempotent<T>(
    method: RequestConfig['method'],
    url: string,
    data?: RequestData,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    const requestConfig: RequestConfig = {
      url,
      method,
      ...config,
    }

    // 只有非GET请求才添加data
    if (data !== undefined && method !== 'GET') {
      requestConfig.data = data
    }

    return this.requestIdempotent<T>(requestConfig, idempotentConfig)
  }

  /**
   * 便利方法 - GET请求幂等（通常用于防止重复查询）
   */
  async getIdempotent<T>(
    url: string,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.httpIdempotent<T>(
      'GET',
      url,
      undefined,
      config,
      idempotentConfig
    )
  }

  /**
   * 便利方法 - POST请求幂等（防重复提交）
   */
  async postIdempotent<T>(
    url: string,
    data?: RequestData,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.httpIdempotent<T>('POST', url, data, config, idempotentConfig)
  }

  /**
   * 便利方法 - PUT请求幂等
   */
  async putIdempotent<T>(
    url: string,
    data?: RequestData,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.httpIdempotent<T>('PUT', url, data, config, idempotentConfig)
  }

  /**
   * 便利方法 - PATCH请求幂等
   */
  async patchIdempotent<T>(
    url: string,
    data?: RequestData,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.httpIdempotent<T>('PATCH', url, data, config, idempotentConfig)
  }

  /**
   * 便利方法 - DELETE请求幂等
   */
  async deleteIdempotent<T>(
    url: string,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.httpIdempotent<T>('DELETE', url, undefined, config, idempotentConfig)
  }

  /**
   * 检查缓存是否命中（带降级策略）
   */
  private async checkCacheHit<T>(
    context: IdempotentRequestContext
  ): Promise<T | null> {
    const cacheResult = await this.safeCacheOperation(
      () => this.getCacheHitResult<T>(context),
      context
    )

    if (cacheResult.success && cacheResult.data !== null) {
      return cacheResult.data as T
    }

    // 如果缓存操作失败但没有使用降级，说明是正常的cache miss
    if (!cacheResult.success && !cacheResult.fallbackUsed) {
      // 记录缓存错误但继续流程
      this.logCacheError(cacheResult.error, context, 'Cache hit check failed')
    }

    return null
  }

  /**
   * 安全的缓存操作，带降级策略
   */
  private async safeCacheOperation<T>(
    operation: () => Promise<T | null>,
    context: IdempotentRequestContext,
    fallbackValue?: T
  ): Promise<CacheOperationResult<T | null>> {
    try {
      const data = await operation()
      return { success: true, data }
    } catch (error) {
      const err =
        error instanceof Error ? error : new Error('Unknown cache error')

      // 如果有降级值，使用降级策略
      if (fallbackValue !== undefined) {
        console.warn(
          `🔄 [Idempotent] Cache operation failed, using fallback for ${context.config.method} ${context.config.url}:`,
          err.message
        )
        return {
          success: false,
          data: fallbackValue,
          error: err,
          fallbackUsed: true,
        }
      }

      return { success: false, error: err, fallbackUsed: false }
    }
  }

  /**
   * 获取缓存命中结果
   */
  private async getCacheHitResult<T>(
    context: IdempotentRequestContext
  ): Promise<T | null> {
    const cachedItem = await this.cacheFeature.getCacheItem(
      context.idempotentKey
    )
    if (!cachedItem) {
      return null
    }

    // 检查缓存是否有效
    if (this.cacheFeature.isCacheItemValid(cachedItem)) {
      // 缓存有效，更新统计
      this.updateStats({
        incrementDuplicates: true,
        incrementCacheHits: true,
      })

      // 触发重复请求回调
      this.handleDuplicateCallback(context.config, context.onDuplicate)

      console.log(
        `💾 [Idempotent] Cache hit: ${context.config.method} ${context.config.url}`,
        {
          ttlRemaining: `${Math.round(
            (cachedItem.ttl - (Date.now() - cachedItem.timestamp)) / 1000
          )}s`,
          accessCount: cachedItem.accessCount || 0,
        }
      )

      // 安全更新访问信息
      await this.safeUpdateCacheItem(cachedItem, context)

      return this.safeCloneData(cachedItem.data, 'deep') as T
    } else {
      // 缓存过期，安全删除
      await this.safeRemoveExpiredCache(context)
      return null
    }
  }

  /**
   * 安全更新缓存项访问信息
   */
  private async safeUpdateCacheItem(
    cachedItem: CacheItem,
    context: IdempotentRequestContext
  ): Promise<void> {
    try {
      cachedItem.accessTime = Date.now()
      cachedItem.accessCount = (cachedItem.accessCount || 0) + 1
      await this.cacheFeature.setCacheItem(cachedItem)
    } catch (error) {
      // 更新访问信息失败不应该影响主流程
      console.warn(
        `⚠️ [Idempotent] Failed to update cache access info for ${context.config.method} ${context.config.url}:`,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * 安全删除过期缓存
   */
  private async safeRemoveExpiredCache(
    context: IdempotentRequestContext
  ): Promise<void> {
    try {
      console.log(
        `🗑️ [Idempotent] Removing expired cache: ${context.config.method} ${context.config.url}`
      )
      await this.cacheFeature.removeCacheItem(context.idempotentKey)
    } catch (error) {
      // 删除失败不应该影响主流程，但需要记录
      console.warn(
        `⚠️ [Idempotent] Failed to remove expired cache for ${context.config.method} ${context.config.url}:`,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  /**
   * 记录缓存错误
   */
  private logCacheError(
    error: Error | undefined,
    context: IdempotentRequestContext,
    operation: string
  ): void {
    console.warn(
      `⚠️ [Idempotent] ${operation} for ${context.config.method} ${context.config.url}:`,
      {
        error: error?.message || 'Unknown error',
        key: context.idempotentKey,
        timestamp: Date.now(),
      }
    )
  }

  /**
   * 安全克隆数据
   */
  private safeCloneData<T>(
    data: T,
    cloneType: 'deep' | 'shallow' | 'none' = 'none'
  ): T {
    if (cloneType === 'none') return data

    try {
      if (cloneType === 'deep') {
        return JSON.parse(JSON.stringify(data)) as T
      } else if (cloneType === 'shallow') {
        if (Array.isArray(data)) return [...data] as unknown as T
        if (data && typeof data === 'object')
          return { ...(data as Record<string, unknown>) } as unknown as T
      }
    } catch (error) {
      console.warn(
        '[IdempotentFeature] Clone failed, returning original data:',
        error
      )
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
      clone: 'deep', // 幂等请求返回深拷贝，避免数据被修改
    }

    try {
      console.log(
        `🚀 [Idempotent] Starting new request: ${config.method} ${config.url}`
      )

      // 使用缓存功能执行请求并缓存结果
      const result = await this.cacheFeature.requestWithCache<T>(
        config,
        cacheConfig
      )

      // 请求成功后清理pending requests
      this.pendingRequests.delete(idempotentKey)

      console.log(
        `✅ [Idempotent] Request completed: ${config.method} ${config.url}`
      )
      return result
    } catch (error) {
      // 请求失败后清理pending requests
      this.pendingRequests.delete(idempotentKey)

      console.error(
        `❌ [Idempotent] Request failed: ${config.method} ${config.url}`,
        error
      )
      throw error
    }
  }

  /**
   * 清除幂等缓存（增强错误处理）
   */
  async clearIdempotentCache(key?: string): Promise<void> {
    try {
      if (key && !key.startsWith('idempotent:')) {
        key = `idempotent:${key}`
      }

      // 尝试清理缓存
      await this.cacheFeature.clearCache(key)
      console.log(
        `✅ [Idempotent] Cache cleared successfully${
          key ? ` for key: ${key}` : ' (all)'
        }`
      )
    } catch (error) {
      // 缓存清理失败，记录错误但不抛出
      console.error(
        `❌ [Idempotent] Failed to clear cache${
          key ? ` for key: ${key}` : ' (all)'
        }:`,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        }
      )
    } finally {
      // 无论缓存清理是否成功，都要清理pending requests
      try {
        if (key) {
          this.pendingRequests.delete(key)
        } else {
          this.pendingRequests.clear()
        }
        console.log(
          `✅ [Idempotent] Pending requests cleaned${
            key ? ` for key: ${key}` : ' (all)'
          }`
        )
      } catch (error) {
        // 这种情况很少见，但也要处理
        console.error(
          `❌ [Idempotent] Failed to clear pending requests:`,
          error
        )
      }
    }
  }

  /**
   * 获取幂等统计信息
   */
  getIdempotentStats(): IdempotentStats {
    // 动态计算重复率，避免每次更新统计时都计算
    const duplicateRate =
      this.stats.totalRequests > 0
        ? (this.stats.duplicatesBlocked / this.stats.totalRequests) * 100
        : 0

    return {
      ...this.stats,
      duplicateRate,
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = this.createInitialStats()
  }

  /**
   * 销毁幂等功能
   */
  async destroy(): Promise<void> {
    try {
      // 清理所有pending requests
      this.pendingRequests.clear()

      // 销毁缓存功能
      await this.cacheFeature.destroy()

      // 重置统计
      this.resetStats()

      console.log('[IdempotentFeature] Resources cleaned up successfully')
    } catch (error) {
      console.error('[IdempotentFeature] Error during cleanup:', error)
      throw error
    }
  }

  /**
   * 验证幂等配置参数
   */
  private validateIdempotentConfig(config: IdempotentConfig): void {
    const { ttl, includeHeaders, hashAlgorithm } = config
    const validationRules = [
      {
        condition: ttl !== undefined && (ttl <= 0 || !Number.isInteger(ttl)),
        message: 'TTL must be a positive integer',
        code: 'INVALID_TTL',
      },
      {
        condition:
          includeHeaders !== undefined && !Array.isArray(includeHeaders),
        message: 'includeHeaders must be an array',
        code: 'INVALID_HEADERS',
      },
      {
        condition:
          hashAlgorithm !== undefined &&
          !['fnv1a', 'xxhash', 'simple'].includes(hashAlgorithm),
        message: 'hashAlgorithm must be one of: fnv1a, xxhash, simple',
        code: 'INVALID_HASH_ALGORITHM',
      },
    ]

    for (const rule of validationRules) {
      if (rule.condition) {
        throw new RequestError(rule.message, {
          type: RequestErrorType.VALIDATION_ERROR,
          code: rule.code,
        })
      }
    }
  }

  // 私有统计更新方法
  /**
   * 批量更新统计信息 - 优化性能
   */
  private updateStats(options: {
    responseTime?: number
    keyGenTime?: number
    incrementDuplicates?: boolean
    incrementCacheHits?: boolean
    incrementPendingReused?: boolean
    incrementNetworkRequests?: boolean
  }): void {
    const {
      responseTime,
      keyGenTime,
      incrementDuplicates,
      incrementCacheHits,
      incrementPendingReused,
      incrementNetworkRequests,
    } = options

    // 更新计数器
    if (incrementDuplicates) this.stats.duplicatesBlocked++
    if (incrementCacheHits) this.stats.cacheHits++
    if (incrementPendingReused) this.stats.pendingRequestsReused++
    if (incrementNetworkRequests) this.stats.actualNetworkRequests++

    // 更新平均值（只在有值时计算）
    if (responseTime !== undefined) {
      this.updateAvgResponseTime(responseTime)
    }

    if (keyGenTime !== undefined) {
      this.updateAvgKeyGenTime(keyGenTime)
    }
  }

  /**
   * 更新平均响应时间
   */
  private updateAvgResponseTime(responseTime: number): void {
    const totalResponseTime =
      this.stats.avgResponseTime * (this.stats.totalRequests - 1)
    this.stats.avgResponseTime =
      (totalResponseTime + responseTime) / this.stats.totalRequests
  }

  /**
   * 更新平均键生成时间
   */
  private updateAvgKeyGenTime(keyGenTime: number): void {
    const totalKeyTime =
      this.stats.keyGenerationTime * (this.stats.totalRequests - 1)
    this.stats.keyGenerationTime =
      (totalKeyTime + keyGenTime) / this.stats.totalRequests
  }

  /**
   * 处理重复请求回调
   */
  private handleDuplicateCallback(
    config: RequestConfig,
    onDuplicate?: (
      originalRequest: RequestConfig,
      duplicateRequest: RequestConfig
    ) => void
  ): void {
    if (!onDuplicate) return

    try {
      // 使用浅拷贝而不是JSON方式，性能更好
      const originalRequest = { ...config }
      onDuplicate(originalRequest, config)
    } catch (callbackError) {
      console.warn(
        `⚠️ [Idempotent] Callback execution failed for ${config.method} ${config.url}:`,
        {
          error:
            callbackError instanceof Error
              ? callbackError.message
              : 'Unknown error',
        }
      )
    }
  }
}
