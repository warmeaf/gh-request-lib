import { Requestor, RequestConfig, RequestError } from '../interface'
import { LogFormatter } from '../utils/error-handler'
import { CacheKeyGenerator, CacheKeyConfig } from '../cache/cache-key-generator'

/**
 * @description 缓存配置
 */
export interface CacheConfig {
  ttl?: number // 缓存时间(毫秒)
  key?: string // 自定义缓存键
  clone?: 'none' | 'shallow' | 'deep' // 返回数据是否拷贝，默认不拷贝以保持现状
  maxEntries?: number // 可选的最大缓存条目数（不设置则不限制）
  keyGenerator?: CacheKeyConfig // 缓存键生成器配置
}

/**
 * @description 缓存项
 */
interface CacheItem<T = unknown> {
  data: T
  timestamp: number
  ttl: number
  accessTime: number // LRU: 最后访问时间
  accessCount: number // 访问计数
}


/**
 * @description 请求缓存功能 - 使用懒清理和LRU策略 + 高性能键生成
 */
export class CacheFeature {
  private cache = new Map<string, CacheItem<unknown>>()
  private maxEntries: number
  private lastCleanupTime = 0
  private readonly cleanupInterval = 5 * 60 * 1000 // 5分钟清理间隔
  private keyGenerator: CacheKeyGenerator
  
  constructor(
    private requestor: Requestor, 
    maxEntries = 1000,
    keyGeneratorConfig?: CacheKeyConfig
  ) {
    this.maxEntries = maxEntries
    this.keyGenerator = new CacheKeyGenerator({
      includeHeaders: false,
      headersWhitelist: ['content-type', 'authorization'],
      maxKeyLength: 256,
      enableHashCache: true,
      hashAlgorithm: 'fnv1a',
      ...keyGeneratorConfig
    })
  }

  /**
   * 增量清理过期缓存 - 每次只清理部分项目，分散性能开销
   */
  private incrementalCleanupIfNeeded(): void {
    const now = Date.now()
    
    // 如果距离上次清理不足5分钟且缓存未满，跳过清理
    if (now - this.lastCleanupTime < this.cleanupInterval && 
        this.cache.size < this.maxEntries * 0.9) {
      return
    }
    
    this.lastCleanupTime = now
    
    // 增量清理：每次最多检查100个项目
    const maxCheckCount = Math.min(100, this.cache.size)
    const entries = Array.from(this.cache.entries())
    const startIndex = Math.floor(Math.random() * Math.max(1, entries.length - maxCheckCount))
    
    const expiredKeys: string[] = []
    
    for (let i = startIndex; i < Math.min(startIndex + maxCheckCount, entries.length); i++) {
      const [key, item] = entries[i]
      if (now - item.timestamp >= item.ttl) {
        expiredKeys.push(key)
      }
    }
    
    // 批量删除过期项
    if (expiredKeys.length > 0) {
      expiredKeys.forEach(key => this.cache.delete(key))
      console.log(LogFormatter.formatCacheLog('clear', `${expiredKeys.length} expired items`, {
        'remaining items': this.cache.size
      }))
    }
    
    // 如果仍然超出容量，执行增量LRU淘汰
    if (this.cache.size > this.maxEntries) {
      const toEvict = Math.min(50, this.cache.size - this.maxEntries) // 每次最多淘汰50项
      this.incrementalEvictLRU(toEvict)
    }
  }
  
  /**
   * 增量LRU淘汰 - 避免一次性处理大量数据
   */
  private incrementalEvictLRU(count: number): void {
    if (count <= 0) return
    
    // 随机采样方式获取候选项，避免全量排序
    const sampleSize = Math.min(Math.max(count * 3, 100), this.cache.size)
    const entries = Array.from(this.cache.entries())
    const sampledEntries: Array<[string, CacheItem<unknown>]> = []
    
    // 随机采样
    for (let i = 0; i < sampleSize; i++) {
      const randomIndex = Math.floor(Math.random() * entries.length)
      sampledEntries.push(entries[randomIndex])
    }
    
    // 对采样结果排序，选择最少使用的项目
    sampledEntries.sort(([,a], [,b]) => a.accessTime - b.accessTime)
    
    const actualEvictCount = Math.min(count, sampledEntries.length)
    for (let i = 0; i < actualEvictCount; i++) {
      this.cache.delete(sampledEntries[i][0])
    }
    
    if (actualEvictCount > 0) {
      console.log(LogFormatter.formatCacheLog('clear', `${actualEvictCount} LRU items`, {
        'remaining items': this.cache.size,
        'max entries': this.maxEntries
      }))
    }
  }
  

  /**
   * 销毁缓存功能，清理资源
   */
  destroy(): void {
    this.cache.clear()
    this.lastCleanupTime = 0
  }

  /**
   * 生成缓存键 - 使用高性能键生成器
   */
  private generateCacheKey(config: RequestConfig, customKey?: string, keyGeneratorConfig?: CacheKeyConfig): string {
    // 如果有键生成器配置，临时更新配置
    if (keyGeneratorConfig) {
      this.keyGenerator.updateConfig(keyGeneratorConfig)
    }
    
    try {
      return this.keyGenerator.generateCacheKey(config, customKey)
    } catch (error) {
      throw new RequestError(
        `Failed to generate cache key: ${error instanceof Error ? error.message : 'Unknown error'}`,
        { originalError: error }
      )
    }
  }

  /**
   * 检查缓存是否有效并更新访问信息
   */
  private isCacheValidAndUpdate<T>(item: CacheItem<T>): boolean {
    const now = Date.now()
    const isValid = now - item.timestamp < item.ttl
    
    if (isValid) {
      // 更新LRU信息
      item.accessTime = now
      item.accessCount += 1
    }
    
    return isValid
  }

  /**
   * 带缓存的请求 - 高性能版本
   * @param config 请求配置
   * @param cacheConfig 缓存配置
   */
  async requestWithCache<T>(
    config: RequestConfig,
    cacheConfig: CacheConfig = { ttl: 5 * 60 * 1000 }
  ): Promise<T> {
    const { ttl = 5 * 60 * 1000, key, clone = 'none', maxEntries, keyGenerator } = cacheConfig
    
    // 如果配置了maxEntries，更新实例的maxEntries
    if (typeof maxEntries === 'number' && maxEntries > 0) {
      this.maxEntries = maxEntries
    }
    
    // 执行增量清理
    this.incrementalCleanupIfNeeded()
    
    const cacheKey = this.generateCacheKey(config, key, keyGenerator)

    // 检查缓存
    const cachedItem = this.cache.get(cacheKey)
    if (cachedItem && this.isCacheValidAndUpdate(cachedItem)) {
      console.log(LogFormatter.formatCacheLog('hit', cacheKey, {
        'ttl remaining': `${Math.round((cachedItem.ttl - (Date.now() - cachedItem.timestamp)) / 1000)}s`,
        'access count': cachedItem.accessCount + 1
      }))
      return this.safeCloneData(cachedItem.data, clone) as T
    }

    // 缓存未命中或已过期，删除过期项
    if (cachedItem) {
      this.cache.delete(cacheKey)
    }

    // 发起请求
    console.log(LogFormatter.formatCacheLog('miss', cacheKey, {
      'reason': cachedItem ? 'expired' : 'not found',
      'will fetch': config.url
    }))
    const data = await this.requestor.request<T>(config)

    // 存储缓存
    const now = Date.now()
    this.cache.set(cacheKey, {
      data,
      timestamp: now,
      ttl,
      accessTime: now,
      accessCount: 1
    })

    console.log(LogFormatter.formatCacheLog('set', cacheKey, {
      'ttl': `${Math.round(ttl / 1000)}s`,
      'cache size': this.cache.size,
      'max entries': this.maxEntries
    }))

    return this.safeCloneData(data, clone) as T
  }

  /**
   * 清除缓存
   */
  clearCache(key?: string): void {
    if (key) {
      const existed = this.cache.has(key)
      this.cache.delete(key)
      
      if (existed) {
        console.log(LogFormatter.formatCacheLog('clear', key, {
          'remaining items': this.cache.size
        }))
      }
    } else {
      const previousSize = this.cache.size
      this.cache.clear()
      
      if (previousSize > 0) {
        console.log(LogFormatter.formatCacheLog('clear', 'all items', {
          'cleared count': previousSize
        }))
      }
    }
  }

  /**
   * 安全的数据克隆，移除类型不安全的操作
   */
  private safeCloneData<T>(data: T, clone: NonNullable<CacheConfig['clone']>): T {
    if (clone === 'none') return data
    
    if (clone === 'shallow') {
      return this.shallowClone(data)
    }
    
    // 深拷贝
    return this.deepClone(data)
  }
  
  private shallowClone<T>(data: T): T {
    if (data === null || typeof data !== 'object') {
      return data
    }
    
    if (Array.isArray(data)) {
      return [...data] as unknown as T
    }
    
    if (data instanceof Date) {
      return new Date(data.getTime()) as unknown as T
    }
    
    if (data instanceof RegExp) {
      return new RegExp(data.source, data.flags) as unknown as T
    }
    
    // 普通对象
    return { ...(data as Record<string, unknown>) } as unknown as T
  }
  
  private deepClone<T>(data: T): T {
    // 优先使用现代浏览器的structuredClone
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(data)
      } catch (error) {
        // 如果structuredClone失败，回退到其他方法
        console.warn('[Cache] structuredClone failed, falling back to JSON clone:', error)
      }
    }
    
    // 回退到JSON深拷贝
    try {
      return JSON.parse(JSON.stringify(data))
    } catch (error) {
      console.warn('[Cache] JSON clone failed, returning original data:', error)
      return data
    }
  }
  
  /**
   * 获取缓存统计信息 - 增强版
   */
  getCacheStats(): {
    size: number
    maxEntries: number
    hitRate?: number
    keyGeneratorStats: ReturnType<CacheKeyGenerator['getStats']>
    lastCleanup: number
    cleanupInterval: number
  } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries,
      keyGeneratorStats: this.keyGenerator.getStats(),
      lastCleanup: this.lastCleanupTime,
      cleanupInterval: this.cleanupInterval
    }
  }

  /**
   * 获取键生成器统计信息
   */
  getKeyGeneratorStats() {
    return this.keyGenerator.getStats()
  }

  /**
   * 更新键生成器配置
   */
  updateKeyGeneratorConfig(config: Partial<CacheKeyConfig>): void {
    this.keyGenerator.updateConfig(config)
  }

  /**
   * 清理键生成器缓存
   */
  clearKeyGeneratorCache(): void {
    this.keyGenerator.clearCache()
  }

  /**
   * 重置键生成器统计
   */
  resetKeyGeneratorStats(): void {
    this.keyGenerator.resetStats()
  }

  /**
   * 预热键生成器缓存
   */
  warmupKeyGeneratorCache(configs: RequestConfig[]): void {
    this.keyGenerator.warmupCache(configs)
  }
}
