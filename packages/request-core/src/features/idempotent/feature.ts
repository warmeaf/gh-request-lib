import {
  Requestor,
  RequestConfig,
  RequestData,
  RequestError,
  RequestErrorType,
  IdempotentConfig,
  IdempotentStats,
} from '../../interface'
import { CacheFeature } from '../cache'
import { CacheKeyConfig } from '../../cache/cache-key-generator'
import { DEFAULT_IDEMPOTENT_CONFIG, DEFAULT_CACHE_KEY_CONFIG } from './constants'
import { IdempotentRequestContext, NewRequestExecutionConfig } from './types'
import { createInitialStats, updateAvgKeyGenTime, updateAvgResponseTime, withDuplicateRate } from './stats'
import { createDeferred, safeCloneData } from './utils'
import { generateFallbackKey, generateIdempotentKey } from './key'
import { enhanceIdempotentError } from './errors'

/**
 * @description 幂等请求功能 - 基于缓存实现，支持请求去重
 */
export class IdempotentFeature {
  private cacheFeature: CacheFeature
  private pendingRequests: Map<string, Promise<unknown>>
  private stats: IdempotentStats
  private readonly cacheKeyConfig: CacheKeyConfig

  constructor(private requestor: Requestor, config?: Partial<CacheKeyConfig>) {
    this.cacheKeyConfig = {
      ...DEFAULT_CACHE_KEY_CONFIG,
      ...config,
    }

    this.cacheFeature = new CacheFeature(
      requestor,
      DEFAULT_IDEMPOTENT_CONFIG.MAX_ENTRIES,
      this.cacheKeyConfig
    )
    this.pendingRequests = new Map()
    this.stats = createInitialStats()
  }

  /**
   * @description 幂等请求 - 防止重复提交，支持请求去重
   */
  async requestIdempotent<T>(
    config: RequestConfig,
    idempotentConfig: IdempotentConfig = {}
  ): Promise<T> {
    const startTime = Date.now()

    try {
      // 验证配置
      this.validateIdempotentConfig(idempotentConfig)

      // 配置验证通过后才增加统计计数
      this.stats.totalRequests++

      return await this.processIdempotentRequest<T>(config, idempotentConfig, startTime)
    } catch (error) {
      const responseTime = Date.now() - startTime
      this.updateStats({ responseTime })
      throw this.enhanceError(error, config, responseTime)
    }
  }

  /**
   * @description 处理幂等请求的主要流程
   */
  private async processIdempotentRequest<T>(
    config: RequestConfig,
    idempotentConfig: IdempotentConfig,
    startTime: number
  ): Promise<T> {
    const processedConfig = this.prepareIdempotentConfig(idempotentConfig)

    const { idempotentKey, keyGenTime } = this.generateIdempotentKeyWithStats(
      config,
      processedConfig.keyGeneratorConfig,
      processedConfig.key
    )
    this.updateStats({ keyGenTime })

    const requestContext: IdempotentRequestContext = {
      idempotentKey,
      config,
      startTime,
      onDuplicate: processedConfig.onDuplicate,
    }

    const cachedResult = await this.checkCacheHit<T>(requestContext)
    if (cachedResult !== null) {
      const responseTime = Date.now() - startTime
      this.updateStats({ responseTime })
      return cachedResult
    }

    const pendingResult = await this.checkPendingRequest<T>(requestContext)
    if (pendingResult !== null) {
      return pendingResult
    }

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
   * @description 准备幂等配置
   */
  private prepareIdempotentConfig(idempotentConfig: IdempotentConfig) {
    const {
      ttl = DEFAULT_IDEMPOTENT_CONFIG.TTL,
      key,
      includeHeaders, // 不设置默认值，让后面逻辑处理
      includeAllHeaders = false,
      hashAlgorithm = 'fnv1a',
      onDuplicate,
    } = idempotentConfig

    // 如果请求没有指定includeHeaders，则使用实例配置的headersWhitelist
    let effectiveHeadersWhitelist = includeAllHeaders ? undefined : includeHeaders
    if (!includeHeaders && !includeAllHeaders) {
      effectiveHeadersWhitelist = this.cacheKeyConfig.headersWhitelist
    }

    const keyGeneratorConfig: CacheKeyConfig = {
      includeHeaders: includeAllHeaders || (effectiveHeadersWhitelist?.length ?? 0) > 0,
      headersWhitelist: effectiveHeadersWhitelist,
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
   * @description 生成幂等键并计算统计信息（带错误处理）
   */
  private generateIdempotentKeyWithStats(
    config: RequestConfig,
    keyConfig: CacheKeyConfig,
    customKey?: string
  ): { idempotentKey: string; keyGenTime: number } {
    const keyGenStartTime = performance.now()

    try {
      const idempotentKey = customKey || generateIdempotentKey(config, this.cacheKeyConfig, keyConfig)
      const keyGenTime = performance.now() - keyGenStartTime
      return { idempotentKey, keyGenTime }
    } catch (_error) {
      const keyGenTime = performance.now() - keyGenStartTime
      const fallbackKey = generateFallbackKey(config)
      console.warn(
        `⚠️ [Idempotent] Key generation failed for ${config.method} ${config.url}, using fallback:`,
        {
          fallbackKey,
          customKey,
        }
      )
      return { idempotentKey: fallbackKey, keyGenTime }
    }
  }

  /**
   * @description 检查是否有正在进行的请求
   */
  private async checkPendingRequest<T>(
    context: IdempotentRequestContext
  ): Promise<T | null> {
    const pendingRequest = this.pendingRequests.get(context.idempotentKey)
    if (!pendingRequest) return null

    this.updateStats({ incrementDuplicates: true, incrementPendingReused: true })
    this.handleDuplicateCallback(context.config, context.onDuplicate)

    console.log(`🔄 [Idempotent] Waiting for pending request: ${context.config.method} ${context.config.url}`)

    const result = (await pendingRequest) as T
    const responseTime = Date.now() - context.startTime
    this.updateStats({ responseTime })
    return result
  }

  /**
   * @description 执行新的幂等请求
   */
  private async executeNewIdempotentRequest<T>(
    execConfig: NewRequestExecutionConfig
  ): Promise<T> {
    const existing = this.pendingRequests.get(execConfig.idempotentKey)
    if (existing) {
      // 发现重复的并发请求，增加统计计数
      this.updateStats({ incrementDuplicates: true, incrementPendingReused: true })

      const result = (await existing) as T
      const responseTime = Date.now() - execConfig.startTime
      this.updateStats({ responseTime })
      return result
    }

    const deferred = createDeferred<T>()
    this.pendingRequests.set(execConfig.idempotentKey, deferred.promise as Promise<unknown>)

    const requestPromise = this.executeRequest<T>(
      execConfig.config,
      execConfig.idempotentKey,
      execConfig.ttl,
      execConfig.keyGeneratorConfig
    )

    this.updateStats({ incrementNetworkRequests: true })

  try {
    const result = await requestPromise
    deferred.resolve(result)
    const responseTime = Date.now() - execConfig.startTime
    this.updateStats({ responseTime })
    return result
  } catch (error) {
    deferred.reject(error)
    throw error
  } finally {
    // 确保无论成功还是失败都清理pending request
    this.pendingRequests.delete(execConfig.idempotentKey)
  }
  }

  /**
   * @description 便利方法 - GET请求幂等
   */
  async getIdempotent<T>(
    url: string,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.httpIdempotent<T>('GET', url, undefined, config, idempotentConfig)
  }

  /**
   * @description 便利方法 - POST请求幂等
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
   * @description 便利方法 - PUT请求幂等
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
   * @description 便利方法 - PATCH请求幂等
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
   * @description 便利方法 - DELETE请求幂等
   */
  async deleteIdempotent<T>(
    url: string,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.httpIdempotent<T>('DELETE', url, undefined, config, idempotentConfig)
  }

  /**
   * @description 清除幂等缓存（增强错误处理）
   */
  async clearIdempotentCache(key?: string): Promise<void> {
    try {
      if (key && !key.startsWith('idempotent:')) {
        key = `idempotent:${key}`
      }

      await this.cacheFeature.clearCache(key)
      console.log(`✅ [Idempotent] Cache cleared successfully${key ? ` for key: ${key}` : ' (all)'}`)
    } catch (error) {
      console.error(
        `❌ [Idempotent] Failed to clear cache${key ? ` for key: ${key}` : ' (all)'}:`,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          timestamp: Date.now(),
        }
      )
    } finally {
      try {
        if (key) {
          this.pendingRequests.delete(key)
        } else {
          this.pendingRequests.clear()
        }
        console.log(`✅ [Idempotent] Pending requests cleaned${key ? ` for key: ${key}` : ' (all)'}`)
      } catch (error) {
        console.error(`❌ [Idempotent] Failed to clear pending requests:`, error)
      }
    }
  }

  /**
   * @description 获取幂等统计信息
   */
  getIdempotentStats(): IdempotentStats {
    return withDuplicateRate(this.stats)
  }

  /**
   * @description 重置统计信息
   */
  resetStats(): void {
    this.stats = createInitialStats()
  }

  /**
   * @description 销毁幂等功能
   */
  async destroy(): Promise<void> {
    try {
      this.pendingRequests.clear()
      await this.cacheFeature.destroy()
      this.resetStats()
      console.log('[IdempotentFeature] Resources cleaned up successfully')
    } catch (error) {
      console.error('[IdempotentFeature] Error during cleanup:', error)
      throw error
    }
  }

  // 私有方法

  private httpIdempotent<T>(
    method: RequestConfig['method'],
    url: string,
    data?: RequestData,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    const requestConfig: RequestConfig = { url, method, ...config }
    if (data !== undefined && method !== 'GET') {
      requestConfig.data = data
    }
    return this.requestIdempotent<T>(requestConfig, idempotentConfig)
  }

  private async checkCacheHit<T>(context: IdempotentRequestContext): Promise<T | null> {
    const cacheResult = await this.safeCacheOperation(() => this.getCacheHitResult<T>(context), context)
    if (cacheResult.success && cacheResult.data !== null) {
      return cacheResult.data as T
    }
    if (!cacheResult.success && !cacheResult.fallbackUsed) {
      this.logCacheError(cacheResult.error, context, 'Cache hit check failed')
    }
    return null
  }

  private async safeCacheOperation<T>(
    operation: () => Promise<T | null>,
    context: IdempotentRequestContext,
    fallbackValue?: T
  ) {
    try {
      const data = await operation()
      return { success: true, data }
    } catch (error) {
      const err = error instanceof Error ? error : new Error('Unknown cache error')
      if (fallbackValue !== undefined) {
        console.warn(
          `🔄 [Idempotent] Cache operation failed, using fallback for ${context.config.method} ${context.config.url}:`,
          err.message
        )
        return { success: false, data: fallbackValue, error: err, fallbackUsed: true }
      }
      return { success: false, error: err, fallbackUsed: false }
    }
  }

  private async getCacheHitResult<T>(context: IdempotentRequestContext): Promise<T | null> {
    const cachedItem = await this.cacheFeature.getCacheItem(context.idempotentKey)
    if (!cachedItem) return null

    if (this.cacheFeature.isCacheItemValid(cachedItem)) {
      this.updateStats({ incrementDuplicates: true, incrementCacheHits: true })
      this.handleDuplicateCallback(context.config, context.onDuplicate)
      console.log(`💾 [Idempotent] Cache hit: ${context.config.method} ${context.config.url}`, {
        ttlRemaining: `${Math.round((cachedItem.ttl - (Date.now() - cachedItem.timestamp)) / 1000)}s`,
        accessCount: cachedItem.accessCount || 0,
      })
      await this.safeUpdateCacheItem(cachedItem)
      return safeCloneData(cachedItem.data, 'deep') as T
    } else {
      await this.safeRemoveExpiredCache(context)
      return null
    }
  }

  private async safeUpdateCacheItem(cachedItem: any): Promise<void> {
    try {
      cachedItem.accessTime = Date.now()
      cachedItem.accessCount = (cachedItem.accessCount || 0) + 1
      await this.cacheFeature.setCacheItem(cachedItem)
    } catch (error) {
      console.warn(`⚠️ [Idempotent] Failed to update cache access info:`, error instanceof Error ? error.message : 'Unknown error')
    }
  }

  private async safeRemoveExpiredCache(context: IdempotentRequestContext): Promise<void> {
    try {
      console.log(`🗑️ [Idempotent] Removing expired cache: ${context.config.method} ${context.config.url}`)
      await this.cacheFeature.removeCacheItem(context.idempotentKey)
    } catch (error) {
      console.warn(
        `⚠️ [Idempotent] Failed to remove expired cache for ${context.config.method} ${context.config.url}:`,
        error instanceof Error ? error.message : 'Unknown error'
      )
    }
  }

  private logCacheError(error: Error | undefined, context: IdempotentRequestContext, operation: string): void {
    console.warn(`⚠️ [Idempotent] ${operation} for ${context.config.method} ${context.config.url}:`, {
      error: error?.message || 'Unknown error',
      key: context.idempotentKey,
      timestamp: Date.now(),
    })
  }

  private async executeRequest<T>(
    config: RequestConfig,
    idempotentKey: string,
    ttl: number,
    keyGeneratorConfig: CacheKeyConfig
  ): Promise<T> {
    // 直接执行网络请求（缓存检查已在幂等层完成）
    const result = await this.requestor.request<T>(config)

    // 手动设置缓存
    await this.cacheFeature.setCacheItem({
      key: idempotentKey,
      data: result,
      ttl,
      timestamp: Date.now(),
      accessTime: Date.now(),
      accessCount: 1,
    })

    return result
  }

  private enhanceError(error: unknown, config: RequestConfig, responseTime: number): RequestError {
    return enhanceIdempotentError(error, config, responseTime)
  }

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

    if (incrementDuplicates) this.stats.duplicatesBlocked++
    if (incrementCacheHits) this.stats.cacheHits++
    if (incrementPendingReused) this.stats.pendingRequestsReused++
    if (incrementNetworkRequests) this.stats.actualNetworkRequests++

    if (responseTime !== undefined) {
      updateAvgResponseTime(this.stats, responseTime)
    }
    if (keyGenTime !== undefined) {
      updateAvgKeyGenTime(this.stats, keyGenTime)
    }
  }

  private handleDuplicateCallback(
    config: RequestConfig,
    onDuplicate?: (originalRequest: RequestConfig, duplicateRequest: RequestConfig) => void
  ): void {
    if (!onDuplicate) return
    try {
      const originalRequest = { ...config }
      onDuplicate(originalRequest, config)
    } catch (callbackError) {
      console.warn(
        `⚠️ [Idempotent] Callback execution failed for ${config.method} ${config.url}:`,
        {
          error: callbackError instanceof Error ? callbackError.message : 'Unknown error',
        }
      )
    }
  }

  private validateIdempotentConfig(config: IdempotentConfig): void {
    const { ttl, includeHeaders, hashAlgorithm } = config
    const validationRules = [
      {
        condition: ttl !== undefined && (ttl <= 0 || !Number.isInteger(ttl)),
        message: 'TTL must be a positive integer',
        code: 'INVALID_TTL',
      },
      {
        condition: includeHeaders !== undefined && !Array.isArray(includeHeaders),
        message: 'includeHeaders must be an array',
        code: 'INVALID_HEADERS',
      },
      {
        condition:
          hashAlgorithm !== undefined && !['fnv1a', 'xxhash', 'simple'].includes(hashAlgorithm as string),
        message: 'hashAlgorithm must be one of: fnv1a, xxhash, simple',
        code: 'INVALID_HASH_ALGORITHM',
      },
    ] as const

    for (const rule of validationRules) {
      if (rule.condition) {
        throw new RequestError(rule.message, {
          type: RequestErrorType.VALIDATION_ERROR,
          code: rule.code,
        })
      }
    }
  }
}
