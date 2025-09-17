import { Requestor, RequestConfig, RequestError } from '../../interface'
import { LogFormatter } from '../../utils/error-handler'
import {
  CacheKeyGenerator,
  CacheKeyConfig,
  StorageAdapter,
  MemoryStorageAdapter,
  LocalStorageAdapter,
  IndexedDBAdapter,
  WebSQLAdapter,
  CacheKeyStrategy,
  LRUInvalidationPolicy,
} from '../../cache'
import { StorageType } from '../../cache/strategies'
import type { CacheInvalidationPolicy } from '../../cache'

// 声明全局的 openDatabase 函数
declare const openDatabase: (
  name: string,
  version: string,
  displayName: string,
  estimatedSize: number
) => any | undefined

/**
 * @description 缓存配置
 */
export interface CacheConfig {
  ttl?: number // 缓存时间(毫秒)
  key?: string // 自定义缓存键
  clone?: 'none' | 'shallow' | 'deep' // 返回数据是否拷贝，默认不拷贝以保持现状
  maxEntries?: number // 可选的最大缓存条目数（不设置则不限制）
  keyGenerator?: CacheKeyConfig // 缓存键生成器配置
  storageType?: StorageType // 存储类型
  storageAdapter?: StorageAdapter // 自定义存储适配器
  keyStrategy?: CacheKeyStrategy // 缓存键生成策略
  invalidationPolicy?: CacheInvalidationPolicy // 缓存失效策略
}

// 使用缓存适配器中的 StorageItem，不再需要本地定义

/**
 * @description 请求缓存功能 - 使用懒清理和LRU策略 + 高性能键生成
 */
export class CacheFeature {
  private storageAdapter: StorageAdapter
  private maxEntries: number
  private lastCleanupTime = 0
  private readonly cleanupInterval = 5 * 60 * 1000 // 5分钟清理间隔
  private keyGenerator: CacheKeyGenerator
  private invalidationPolicy: CacheInvalidationPolicy
  private keyStrategy?: CacheKeyStrategy

  constructor(
    private requestor: Requestor,
    maxEntries = 1000,
    keyGeneratorConfig?: CacheKeyConfig,
    storageType: StorageType = StorageType.INDEXED_DB
  ) {
    this.maxEntries = maxEntries
    this.keyGenerator = new CacheKeyGenerator({
      includeHeaders: false,
      headersWhitelist: ['content-type', 'authorization'],
      maxKeyLength: 256,
      enableHashCache: true,
      hashAlgorithm: 'fnv1a',
      ...keyGeneratorConfig,
    })

    // 初始化存储适配器
    this.storageAdapter = this.createStorageAdapter(storageType)

    // 初始化失效策略
    this.invalidationPolicy = new LRUInvalidationPolicy()
  }

  /**
   * 增量清理过期缓存 - 每次只清理部分项目，分散性能开销
   */
  private async incrementalCleanupIfNeeded(): Promise<void> {
    // 对于内存存储，执行清理逻辑
    if (this.storageAdapter.getType() === StorageType.MEMORY) {
      const now = Date.now()

      // 获取所有键
      const keys = await this.storageAdapter.getKeys()

      // 如果距离上次清理不足5分钟且缓存未满，跳过清理
      if (
        now - this.lastCleanupTime < this.cleanupInterval &&
        keys.length < this.maxEntries * 0.9
      ) {
        return
      }

      this.lastCleanupTime = now

      // 增量清理：每次最多检查100个项目
      const maxCheckCount = Math.min(100, keys.length)
      const startIndex = Math.floor(
        Math.random() * Math.max(1, keys.length - maxCheckCount)
      )

      const expiredKeys: string[] = []

      // 检查过期项
      for (
        let i = startIndex;
        i < Math.min(startIndex + maxCheckCount, keys.length);
        i++
      ) {
        const key = keys[i]
        const item = await this.storageAdapter.getItem(key)
        if (item && now - item.timestamp >= item.ttl) {
          expiredKeys.push(key)
        }
      }

      // 批量删除过期项
      if (expiredKeys.length > 0) {
        for (const key of expiredKeys) {
          await this.storageAdapter.removeItem(key)
        }
        console.log(
          LogFormatter.formatCacheLog(
            'clear',
            `${expiredKeys.length} expired items`,
            {
              'remaining items': keys.length - expiredKeys.length,
            }
          )
        )
      }

      // 如果仍然超出容量，执行增量LRU淘汰
      const currentKeys = await this.storageAdapter.getKeys()
      if (currentKeys.length > this.maxEntries) {
        // 获取所有项以进行LRU排序
        const items = []
        for (const key of currentKeys) {
          const item = await this.storageAdapter.getItem(key)
          if (item) {
            items.push(item)
          }
        }

        // 按访问时间排序，最久未访问的在前面
        items.sort((a, b) => a.accessTime - b.accessTime)

        // 淘汰最久未访问的项
        const toEvict = Math.min(50, currentKeys.length - this.maxEntries)
        for (let i = 0; i < toEvict; i++) {
          await this.storageAdapter.removeItem(items[i].key)
        }

        if (toEvict > 0) {
          console.log(
            LogFormatter.formatCacheLog('clear', `${toEvict} LRU items`, {
              'remaining items': currentKeys.length - toEvict,
              'max entries': this.maxEntries,
            })
          )
        }
      }
    }
  }

  // 不再需要独立的LRU淘汰方法，已合并到incrementalCleanupIfNeeded中

  /**
   * 销毁缓存功能，清理资源
   */
  async destroy(): Promise<void> {
    await this.storageAdapter.destroy()
    this.lastCleanupTime = 0
  }

  /**
   * 生成缓存键 - 使用高性能键生成器
   */
  private generateCacheKey(
    config: RequestConfig,
    customKey?: string,
    keyGeneratorConfig?: CacheKeyConfig
  ): string {
    // 如果有键生成器配置，临时更新配置
    if (keyGeneratorConfig) {
      this.keyGenerator.updateConfig(keyGeneratorConfig)
    }

    try {
      return this.keyGenerator.generateCacheKey(config, customKey)
    } catch (error) {
      throw new RequestError(
        `Failed to generate cache key: ${
          error instanceof Error ? error.message : 'Unknown error'
        }`,
        { originalError: error }
      )
    }
  }

  /**
   * 检查缓存是否有效并更新访问信息
   */
  private isCacheValidAndUpdate<T>(item: any): boolean {
    const now = Date.now()

    // 使用失效策略检查是否应该失效
    if (this.invalidationPolicy.shouldInvalidate(item, now)) {
      return false
    }

    // 更新访问信息
    this.invalidationPolicy.updateItemOnAccess(item, now)

    return true
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
    const {
      ttl = 5 * 60 * 1000,
      key,
      clone = 'none',
      maxEntries,
      keyGenerator,
      storageType,
      storageAdapter,
      keyStrategy,
      invalidationPolicy,
    } = cacheConfig

    // 如果配置了maxEntries，更新实例的maxEntries
    if (typeof maxEntries === 'number' && maxEntries > 0) {
      this.maxEntries = maxEntries
    }

    // 如果指定了存储类型，更新存储适配器
    if (storageType && storageType !== this.storageAdapter.getType()) {
      this.storageAdapter = this.createStorageAdapter(storageType)
    }

    // 如果提供了自定义存储适配器，使用它
    if (storageAdapter) {
      this.storageAdapter = storageAdapter
    }

    // 如果提供了自定义键策略，使用它
    if (keyStrategy) {
      this.keyStrategy = keyStrategy
    }

    // 如果提供了自定义失效策略，使用它
    if (invalidationPolicy) {
      this.invalidationPolicy = invalidationPolicy
    }

    // 执行增量清理
    await this.incrementalCleanupIfNeeded()

    // 生成缓存键
    let cacheKey: string
    if (this.keyStrategy) {
      cacheKey = this.keyStrategy.generateKey(config)
      // 如果提供了自定义键，优先使用
      if (key) {
        cacheKey = key
      }
    } else {
      cacheKey = this.generateCacheKey(config, key, keyGenerator)
    }

    // 检查缓存
    const cachedItem = await this.storageAdapter.getItem(cacheKey)
    if (cachedItem && this.isCacheValidAndUpdate(cachedItem)) {
      // 更新访问信息
      await this.storageAdapter.setItem(cachedItem)

      console.log(
        LogFormatter.formatCacheLog('hit', cacheKey, {
          'ttl remaining': `${Math.round(
            (cachedItem.ttl - (Date.now() - cachedItem.timestamp)) / 1000
          )}s`,
          'access count': cachedItem.accessCount,
        })
      )
      return this.safeCloneData(cachedItem.data, clone) as T
    }

    // 缓存未命中或已过期，删除过期项
    if (cachedItem) {
      await this.storageAdapter.removeItem(cacheKey)
    }

    // 发起请求
    console.log(
      LogFormatter.formatCacheLog('miss', cacheKey, {
        reason: cachedItem ? 'expired' : 'not found',
        'will fetch': config.url,
      })
    )
    const data = await this.requestor.request<T>(config)

    // 存储缓存
    const now = Date.now()
    await this.storageAdapter.setItem({
      key: cacheKey,
      data,
      timestamp: now,
      ttl,
      accessTime: now,
      accessCount: 1,
    })

    // 获取存储统计信息
    const stats = await this.storageAdapter.getStats()
    console.log(
      LogFormatter.formatCacheLog('set', cacheKey, {
        ttl: `${Math.round(ttl / 1000)}s`,
        'cache size': stats.size,
        'max entries': this.maxEntries,
      })
    )

    return this.safeCloneData(data, clone) as T
  }

  /**
   * 清除缓存
   */
  async clearCache(key?: string): Promise<void> {
    if (key) {
      const keys = await this.storageAdapter.getKeys()
      const existed = keys.includes(key)
      await this.storageAdapter.removeItem(key)

      if (existed) {
        const stats = await this.storageAdapter.getStats()
        console.log(
          LogFormatter.formatCacheLog('clear', key, {
            'remaining items': stats.size,
          })
        )
      }
    } else {
      const stats = await this.storageAdapter.getStats()
      const previousSize = stats.size
      await this.storageAdapter.clear()

      if (previousSize > 0) {
        console.log(
          LogFormatter.formatCacheLog('clear', 'all items', {
            'cleared count': previousSize,
          })
        )
      }
    }
  }

  /**
   * 安全的数据克隆，移除类型不安全的操作
   */
  private safeCloneData<T>(
    data: T,
    clone: NonNullable<CacheConfig['clone']>
  ): T {
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
        console.warn(
          '[Cache] structuredClone failed, falling back to JSON clone:',
          error
        )
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
  async getCacheStats(): Promise<{
    size: number
    maxEntries: number
    hitRate?: number
    keyGeneratorStats: ReturnType<CacheKeyGenerator['getStats']>
    lastCleanup: number
    cleanupInterval: number
    storageType: StorageType
  }> {
    const stats = await this.storageAdapter.getStats()
    return {
      size: stats.size,
      maxEntries: this.maxEntries,
      keyGeneratorStats: this.keyGenerator.getStats(),
      lastCleanup: this.lastCleanupTime,
      cleanupInterval: this.cleanupInterval,
      storageType: this.storageAdapter.getType(),
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

  /**
   * 创建存储适配器
   */
  private createStorageAdapter(storageType: StorageType): StorageAdapter {
    switch (storageType) {
      case StorageType.MEMORY:
        return new MemoryStorageAdapter()
      case StorageType.LOCAL_STORAGE:
        if (typeof localStorage !== 'undefined') {
          return new LocalStorageAdapter()
        }
        // 如果LocalStorage不可用，回退到内存存储
        console.warn(
          'LocalStorage is not available, falling back to memory storage'
        )
        return new MemoryStorageAdapter()
      case StorageType.INDEXED_DB:
        if (typeof indexedDB !== 'undefined') {
          return new IndexedDBAdapter()
        }
        // 如果IndexedDB不可用，回退到内存存储
        console.warn(
          'IndexedDB is not available, falling back to memory storage'
        )
        return new MemoryStorageAdapter()
      case StorageType.WEB_SQL:
        // WebSQL已被废弃，但为了兼容性保留
        // 检查WebSQL是否可用
        if (typeof openDatabase !== 'undefined' && openDatabase !== undefined) {
          return new WebSQLAdapter()
        }
        // 如果WebSQL不可用，回退到内存存储
        console.warn('WebSQL is not available, falling back to memory storage')
        return new MemoryStorageAdapter()
      default:
        return new MemoryStorageAdapter()
    }
  }

  /**
   * 设置存储适配器
   */
  setStorageAdapter(adapter: StorageAdapter): void {
    this.storageAdapter = adapter
  }

  /**
   * 获取当前存储类型
   */
  getStorageType(): StorageType {
    return this.storageAdapter.getType()
  }

  /**
   * 设置缓存键策略
   */
  setKeyStrategy(strategy: CacheKeyStrategy): void {
    this.keyStrategy = strategy
  }

  /**
   * 设置失效策略
   */
  setInvalidationPolicy(policy: CacheInvalidationPolicy): void {
    this.invalidationPolicy = policy
  }

  /**
   * 获取缓存项（供其他功能模块使用）
   */
  async getCacheItem(key: string): Promise<any | null> {
    return await this.storageAdapter.getItem(key)
  }

  /**
   * 设置缓存项（供其他功能模块使用）
   */
  async setCacheItem(item: any): Promise<void> {
    await this.storageAdapter.setItem(item)
  }

  /**
   * 删除缓存项（供其他功能模块使用）
   */
  async removeCacheItem(key: string): Promise<void> {
    await this.storageAdapter.removeItem(key)
  }

  /**
   * 检查缓存项是否有效
   */
  isCacheItemValid(item: any): boolean {
    if (!item) return false
    const now = Date.now()
    return !this.invalidationPolicy.shouldInvalidate(item, now)
  }
}
