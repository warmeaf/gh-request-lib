import {
  Requestor,
  RequestConfig,
  RequestError,
  RequestErrorType,
  IdempotentConfig,
  IdempotentStats,
} from '../interface'
import { CacheFeature, CacheConfig } from './cache'
import { CacheKeyGenerator, CacheKeyConfig } from '../cache/cache-key-generator'

/**
 * @description 幂等请求功能 - 基于缓存实现，支持请求去重
 */
/**
 * 幂等功能默认配置
 */
const DEFAULT_IDEMPOTENT_CONFIG = {
  TTL: 30000, // 默认30秒幂等保护
  MAX_ENTRIES: 5000, // 最大缓存条目数
  CACHE_KEY_CONFIG: {
    includeHeaders: true,
    headersWhitelist: [
      'content-type',
      'authorization',
      'x-api-key',
    ] as string[],
    maxKeyLength: 512,
    enableHashCache: true,
    hashAlgorithm: 'fnv1a' as const,
  },
  DEFAULT_INCLUDE_HEADERS: ['content-type', 'authorization'] as string[],
}

export class IdempotentFeature {
  private cacheFeature: CacheFeature
  private pendingRequests: Map<string, Promise<any>> // 正在进行的请求
  private stats: IdempotentStats
  private keyGenerator: CacheKeyGenerator
  private readonly cacheKeyConfig: CacheKeyConfig

  constructor(private requestor: Requestor) {
    // 使用常量配置，确保类型兼容
    this.cacheKeyConfig = {
      includeHeaders: DEFAULT_IDEMPOTENT_CONFIG.CACHE_KEY_CONFIG.includeHeaders,
      headersWhitelist: [
        ...DEFAULT_IDEMPOTENT_CONFIG.CACHE_KEY_CONFIG.headersWhitelist,
      ],
      maxKeyLength: DEFAULT_IDEMPOTENT_CONFIG.CACHE_KEY_CONFIG.maxKeyLength,
      enableHashCache:
        DEFAULT_IDEMPOTENT_CONFIG.CACHE_KEY_CONFIG.enableHashCache,
      hashAlgorithm: DEFAULT_IDEMPOTENT_CONFIG.CACHE_KEY_CONFIG.hashAlgorithm,
    }

    // 初化组件
    this.cacheFeature = new CacheFeature(
      requestor,
      DEFAULT_IDEMPOTENT_CONFIG.MAX_ENTRIES,
      this.cacheKeyConfig
    )
    this.keyGenerator = new CacheKeyGenerator(this.cacheKeyConfig)
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

    // 配置验证
    this.validateIdempotentConfig(idempotentConfig)

    // 配置默认值
    const {
      ttl = DEFAULT_IDEMPOTENT_CONFIG.TTL,
      key,
      includeHeaders = DEFAULT_IDEMPOTENT_CONFIG.DEFAULT_INCLUDE_HEADERS,
      includeAllHeaders = false,
      hashAlgorithm = 'fnv1a',
      onDuplicate,
    } = idempotentConfig

    // 更新键生成器配置以支持幂等逻辑
    const keyGeneratorConfig: CacheKeyConfig = {
      includeHeaders: includeAllHeaders || includeHeaders.length > 0,
      headersWhitelist: includeAllHeaders ? undefined : includeHeaders,
      hashAlgorithm,
    }

    // 生成幂等键 - 确保请求方法、URL、参数、数据、指定请求头完全一致
    const keyGenStartTime = Date.now()
    const idempotentKey =
      key || this.generateIdempotentKey(config, keyGeneratorConfig)
    const keyGenTime = Date.now() - keyGenStartTime
    this.updateStats({ keyGenTime })

    try {
      // 第一步：检查缓存是否命中
      const cached = await this.checkCacheHit<T>(
        idempotentKey,
        config,
        onDuplicate
      )
      if (cached !== null) {
        const responseTime = Date.now() - startTime
        this.updateStats({ responseTime })
        return cached
      }

      // 第二步：检查是否有正在进行的相同请求
      const pendingRequest = this.pendingRequests.get(idempotentKey)
      if (pendingRequest) {
        this.updateStats({
          incrementDuplicates: true,
          incrementPendingReused: true,
        })

        // 触发重复请求回调
        this.handleDuplicateCallback(config, onDuplicate)

        console.log(
          `🔄 [Idempotent] Waiting for pending request: ${config.method} ${config.url}`
        )
        const result = await pendingRequest
        const responseTime = Date.now() - startTime
        this.updateStats({ responseTime })
        return result
      }

      // 第三步：创建新请求并执行
      const requestPromise = this.executeRequest<T>(
        config,
        idempotentKey,
        ttl,
        keyGeneratorConfig
      )
      this.pendingRequests.set(idempotentKey, requestPromise)
      this.updateStats({ incrementNetworkRequests: true })

      const result = await requestPromise
      const responseTime = Date.now() - startTime
      this.updateStats({ responseTime })
      return result
    } catch (error) {
      const responseTime = Date.now() - startTime
      this.updateStats({ responseTime })

      // 处理错误并抛出增强的错误信息
      const enhancedError = this.createEnhancedError(
        error,
        config,
        responseTime,
        idempotentKey
      )
      console.error(
        `❌ [Idempotent] Request failed: ${config.method} ${config.url}`,
        {
          error: enhancedError.toJSON(),
          key: idempotentKey,
          duration: `${responseTime}ms`,
        }
      )
      throw enhancedError
    }
  }

  /**
   * 生成幂等键 - 确保完全相同的请求产生相同的键
   */
  private generateIdempotentKey(
    config: RequestConfig,
    keyConfig: CacheKeyConfig
  ): string {
    // 为幂等请求添加特殊前缀
    const baseKey = this.keyGenerator.generateCacheKey(config)
    console.log(config, baseKey, '幂等键参数')
    return `idempotent:${baseKey}`
  }

  /**
   * 便利方法 - GET请求幂等（通常用于防止重复查询）
   */
  async getIdempotent<T>(
    url: string,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.requestIdempotent<T>(
      {
        url,
        method: 'GET',
        ...config,
      },
      idempotentConfig
    )
  }

  /**
   * 便利方法 - POST请求幂等（防重复提交）
   */
  async postIdempotent<T>(
    url: string,
    data?: any,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.requestIdempotent<T>(
      {
        url,
        method: 'POST',
        data,
        ...config,
      },
      idempotentConfig
    )
  }

  /**
   * 便利方法 - PUT请求幂等
   */
  async putIdempotent<T>(
    url: string,
    data?: any,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.requestIdempotent<T>(
      {
        url,
        method: 'PUT',
        data,
        ...config,
      },
      idempotentConfig
    )
  }

  /**
   * 便利方法 - PATCH请求幂等
   */
  async patchIdempotent<T>(
    url: string,
    data?: any,
    config?: Partial<RequestConfig>,
    idempotentConfig?: IdempotentConfig
  ): Promise<T> {
    return this.requestIdempotent<T>(
      {
        url,
        method: 'PATCH',
        data,
        ...config,
      },
      idempotentConfig
    )
  }

  /**
   * 检查缓存是否命中
   */
  private async checkCacheHit<T>(
    idempotentKey: string,
    config: RequestConfig,
    onDuplicate?: (
      originalRequest: RequestConfig,
      duplicateRequest: RequestConfig
    ) => void
  ): Promise<T | null> {
    try {
      // 直接访问存储适配器检查缓存
      const storageAdapter = (this.cacheFeature as any).storageAdapter
      if (!storageAdapter) {
        return null
      }

      const cachedItem = await storageAdapter.getItem(idempotentKey)
      if (!cachedItem) {
        return null
      }

      // 检查缓存是否有效
      if (this.isCacheValid(cachedItem)) {
        // 缓存有效，更新统计
        this.updateStats({
          incrementDuplicates: true,
          incrementCacheHits: true,
        })

        // 触发重复请求回调
        this.handleDuplicateCallback(config, onDuplicate)

        console.log(
          `💾 [Idempotent] Cache hit: ${config.method} ${config.url}`,
          {
            ttlRemaining: `${Math.round(
              (cachedItem.ttl - (Date.now() - cachedItem.timestamp)) / 1000
            )}s`,
            accessCount: cachedItem.accessCount || 0,
          }
        )

        // 更新访问信息
        cachedItem.accessTime = Date.now()
        cachedItem.accessCount = (cachedItem.accessCount || 0) + 1
        await storageAdapter.setItem(cachedItem)

        return this.safeCloneData(cachedItem.data, 'deep') as T
      } else {
        // 缓存过期，主动删除
        console.log(
          `🗑️ [Idempotent] Removing expired cache: ${config.method} ${config.url}`
        )
        await storageAdapter.removeItem(idempotentKey)
        return null
      }
    } catch (error) {
      // 缓存检查失败，记录详细错误信息但继续正常流程
      console.warn(
        `⚠️ [Idempotent] Cache check failed for ${config.method} ${config.url}:`,
        {
          error: error instanceof Error ? error.message : 'Unknown error',
          key: idempotentKey,
        }
      )
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
    return now - cachedItem.timestamp < cachedItem.ttl
  }

  /**
   * 安全克隆数据
   */
  private safeCloneData(
    data: any,
    cloneType: 'deep' | 'shallow' | 'none' = 'none'
  ): any {
    if (cloneType === 'none') return data

    try {
      if (cloneType === 'deep') {
        return JSON.parse(JSON.stringify(data))
      } else if (cloneType === 'shallow') {
        if (Array.isArray(data)) return [...data]
        if (data && typeof data === 'object') return { ...data }
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
      const totalResponseTime =
        this.stats.avgResponseTime * (this.stats.totalRequests - 1)
      this.stats.avgResponseTime =
        (totalResponseTime + responseTime) / this.stats.totalRequests
    }

    if (keyGenTime !== undefined) {
      const totalKeyTime =
        this.stats.keyGenerationTime * (this.stats.totalRequests - 1)
      this.stats.keyGenerationTime =
        (totalKeyTime + keyGenTime) / this.stats.totalRequests
    }

    // 更新重复率
    this.stats.duplicateRate =
      this.stats.totalRequests > 0
        ? (this.stats.duplicatesBlocked / this.stats.totalRequests) * 100
        : 0
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

  /**
   * 创建增强的错误对象
   */
  private createEnhancedError(
    error: unknown,
    config: RequestConfig,
    duration: number,
    idempotentKey: string
  ): RequestError {
    if (error instanceof RequestError) {
      // 增强现有的 RequestError
      return new RequestError(`Idempotent request failed: ${error.message}`, {
        type: error.type,
        status: error.status,
        isHttpError: error.isHttpError,
        originalError: error.originalError,
        context: {
          ...error.context,
          url: config.url,
          method: config.method,
          tag: config.tag,
          duration,
          metadata: {
            ...error.context?.metadata,
            idempotentKey,
          },
        },
        suggestion:
          error.suggestion ||
          'Please check the request configuration and try again',
        code: error.code,
      })
    } else {
      // 包装未知错误
      return new RequestError(
        `Idempotent request failed with unknown error: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        {
          type: RequestErrorType.UNKNOWN_ERROR,
          originalError: error,
          context: {
            url: config.url,
            method: config.method,
            tag: config.tag,
            duration,
            timestamp: Date.now(),
            userAgent:
              typeof navigator !== 'undefined' && navigator
                ? navigator.userAgent
                : 'Node.js',
            metadata: { idempotentKey },
          },
          suggestion:
            'Please check the network connection and request configuration',
        }
      )
    }
  }

  // 移除updateCacheHitRate方法，因为现在有独立的cacheHits统计
}
