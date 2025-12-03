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
  StorageType,
} from '../../cache'
import type { CacheInvalidationPolicy } from '../../cache'
import type { CacheConfig } from './types'

// 声明全局的 openDatabase 函数
declare const openDatabase: (
  name: string,
  version: string,
  displayName: string,
  estimatedSize: number
) => any | undefined

export class CacheFeature {
  private storageAdapter: StorageAdapter
  private maxEntries: number
  private lastCleanupTime = 0
  private readonly cleanupInterval = 5 * 60 * 1000
  private keyGenerator: CacheKeyGenerator
  private invalidationPolicy: CacheInvalidationPolicy
  private keyStrategy?: CacheKeyStrategy
  private pendingRequests: Map<string, Promise<unknown>> = new Map()

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

    this.storageAdapter = this.createStorageAdapter(storageType)
    this.invalidationPolicy = new LRUInvalidationPolicy()
  }

  /**
   * 统一处理存储操作的错误和日志记录
   */
  private handleStorageError(
    operation: string,
    key: string,
    error: unknown,
    status?: string,
    fallback?: () => void
  ): void {
    console.warn(
      LogFormatter.formatCacheLog('error', key, {
        'operation': operation,
        'error': error instanceof Error ? error.message : 'Unknown error',
        ...(status && { 'status': status }),
      })
    )
    if (fallback) {
      fallback()
    }
  }

  /**
   * 安全地获取存储键列表，统一处理错误
   */
  private async safeGetKeys(): Promise<string[] | null> {
    try {
      return await this.storageAdapter.getKeys()
    } catch (error) {
      this.handleStorageError('get keys', 'storage', error, 'operation skipped')
      return null
    }
  }

  /**
   * 安全地获取存储统计信息，统一处理错误
   */
  private async safeGetStats(): Promise<{ size: number; [key: string]: unknown } | null> {
    try {
      return await this.storageAdapter.getStats()
    } catch (error) {
      this.handleStorageError('get stats', 'stats', error, 'using default values')
      return null
    }
  }

  /**
   * 降级到内存存储适配器
   */
  private fallbackToMemoryStorage(reason: string): MemoryStorageAdapter {
    console.warn(`${reason}, falling back to memory storage`)
    return new MemoryStorageAdapter()
  }

  /**
   * 记录缓存日志的辅助方法
   */
  private logCacheEvent(
    type: 'hit' | 'miss' | 'set' | 'clear' | 'error',
    key: string,
    metadata?: Record<string, unknown>
  ): void {
    const logMethod = type === 'error' ? console.warn : console.log
    logMethod(LogFormatter.formatCacheLog(type, key, metadata || {}))
  }

  private async incrementalCleanupIfNeeded(): Promise<void> {
    // 清理逻辑适用于所有存储类型，不仅仅是内存存储
    const now = Date.now()
    const keys = await this.safeGetKeys()
    if (!keys) {
      return
    }
    
    // 对于很小的maxEntries，更积极地执行清理，不受时间间隔限制
    const isSmallMaxEntries = this.maxEntries <= 10
    const shouldBypassTimeCheck = isSmallMaxEntries && keys.length >= this.maxEntries
    
    if (!shouldBypassTimeCheck && now - this.lastCleanupTime < this.cleanupInterval && keys.length < this.maxEntries * 0.9) {
      return
    }
    this.lastCleanupTime = now
    const maxCheckCount = Math.min(100, keys.length)
    const startIndex = Math.floor(Math.random() * Math.max(1, keys.length - maxCheckCount))
    const expiredKeys: string[] = []
    for (let i = startIndex; i < Math.min(startIndex + maxCheckCount, keys.length); i++) {
      const key = keys[i]
      const item = await this.storageAdapter.getItem(key)
      if (item && now - item.timestamp >= item.ttl) {
        expiredKeys.push(key)
      }
    }
    if (expiredKeys.length > 0) {
      for (const key of expiredKeys) {
        await this.storageAdapter.removeItem(key)
      }
      this.logCacheEvent('clear', `${expiredKeys.length} expired items`, {
        'remaining items': keys.length - expiredKeys.length,
      })
    }
    const currentKeys = await this.safeGetKeys()
    if (!currentKeys) {
      return
    }
    if (currentKeys.length > this.maxEntries) {
      const items = [] as any[]
      for (const key of currentKeys) {
        const item = await this.storageAdapter.getItem(key)
        if (item) items.push(item)
      }
      items.sort((a, b) => a.accessTime - b.accessTime)
      const toEvict = Math.min(50, currentKeys.length - this.maxEntries)
      for (let i = 0; i < toEvict; i++) {
        await this.storageAdapter.removeItem(items[i].key)
      }
      if (toEvict > 0) {
        this.logCacheEvent('clear', `${toEvict} LRU items`, {
          'remaining items': currentKeys.length - toEvict,
          'max entries': this.maxEntries,
        })
      }
    }
  }

  async destroy(): Promise<void> {
    try {
      await this.storageAdapter.destroy()
    } catch (error) {
      // 存储适配器销毁失败时记录警告，但不阻止清理过程
      this.handleStorageError('storage destroy', 'destroy', error, 'cleanup continued')
    } finally {
      // 确保内部状态总是被重置
      this.lastCleanupTime = 0
    }
  }

  private generateCacheKey(
    config: RequestConfig,
    customKey?: string,
    keyGeneratorConfig?: CacheKeyConfig
  ): string {
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
   * 检查缓存项是否有效（不更新访问时间）
   */
  private isCacheItemValidInternal(item: any, now: number): boolean {
    if (!item) return false
    return !this.invalidationPolicy.shouldInvalidate(item, now)
  }

  /**
   * 检查缓存项是否有效并更新访问时间
   */
  private isCacheValidAndUpdate<T>(item: any): boolean {
    const now = Date.now()
    if (!this.isCacheItemValidInternal(item, now)) {
      return false
    }
    this.invalidationPolicy.updateItemOnAccess(item, now)
    return true
  }

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

    if (typeof maxEntries === 'number' && maxEntries > 0) {
      this.maxEntries = maxEntries
    }

    if (storageType && storageType !== this.storageAdapter.getType()) {
      this.storageAdapter = this.createStorageAdapter(storageType)
    }

    if (storageAdapter) {
      this.storageAdapter = storageAdapter
    }

    if (keyStrategy) {
      this.keyStrategy = keyStrategy
    }

    if (invalidationPolicy) {
      this.invalidationPolicy = invalidationPolicy
    }

    await this.incrementalCleanupIfNeeded()

    let cacheKey: string
    if (this.keyStrategy) {
      cacheKey = this.keyStrategy.generateKey(config)
      if (key) {
        cacheKey = key
      }
    } else {
      cacheKey = this.generateCacheKey(config, key, keyGenerator)
    }

    let cachedItem: any = null
    try {
      cachedItem = await this.storageAdapter.getItem(cacheKey)
    } catch (error) {
      // 存储适配器读取失败时，记录警告并将其视为缓存未命中
      this.handleStorageError('read', cacheKey, error, 'cache miss')
      cachedItem = null
    }
    if (cachedItem && this.isCacheValidAndUpdate(cachedItem)) {
      try {
        await this.storageAdapter.setItem(cachedItem)
        this.logCacheEvent('hit', cacheKey, {
          'ttl remaining': `${Math.round((cachedItem.ttl - (Date.now() - cachedItem.timestamp)) / 1000)}s`,
          'access count': cachedItem.accessCount,
        })
      } catch (error) {
        // 更新访问时间失败，但仍然返回缓存数据
        this.logCacheEvent('error', cacheKey, {
          'operation': 'update access time',
          'error': error instanceof Error ? error.message : 'Unknown storage error',
          'status': 'data returned from cache'
        })
      }
      return this.safeCloneData(cachedItem.data, clone) as T
    }

    if (cachedItem) {
      await this.storageAdapter.removeItem(cacheKey)
    }

    // 并发控制：检查是否已有相同请求正在进行
    const existingRequest = this.pendingRequests.get(cacheKey)
    if (existingRequest) {
      this.logCacheEvent('miss', cacheKey, {
        'status': 'waiting for existing request',
        'url': config.url,
      })
      return (await existingRequest) as T
    }

    // 创建并缓存请求Promise
    const requestPromise = this.executeRequestAndCache<T>(config, cacheKey, ttl, clone)
    this.pendingRequests.set(cacheKey, requestPromise)

    try {
      const result = await requestPromise
      return result
    } finally {
      // 无论成功还是失败，都要清理pending request
      this.pendingRequests.delete(cacheKey)
    }
  }

  /**
   * 执行网络请求并缓存结果（私有方法，用于并发控制）
   */
  private async executeRequestAndCache<T>(
    config: RequestConfig,
    cacheKey: string,
    ttl: number,
    clone: 'deep' | 'shallow' | 'none'
  ): Promise<T> {
    this.logCacheEvent('miss', cacheKey, {
      reason: 'not found',
      'will fetch': config.url,
    })
    const data = await this.requestor.request<T>(config)

    const now = Date.now()
    try {
      await this.storageAdapter.setItem({
        key: cacheKey,
        data,
        timestamp: now,
        ttl,
        accessTime: now,
        accessCount: 1,
      })

      // 在添加新缓存项后立即检查是否需要清理
      await this.incrementalCleanupIfNeeded()

      const stats = await this.safeGetStats()
      if (stats) {
        this.logCacheEvent('set', cacheKey, {
          ttl: `${Math.round(ttl / 1000)}s`,
          'cache size': stats.size,
          'max entries': this.maxEntries,
        })
      }
    } catch (error) {
      // 缓存存储失败，但不影响数据返回
      this.logCacheEvent('error', cacheKey, {
        'operation': 'set cache item',
        'error': error instanceof Error ? error.message : 'Unknown storage error',
        'status': 'data returned successfully'
      })
    }

    return this.safeCloneData(data, clone) as T
  }

  async clearCache(key?: string): Promise<void> {
    if (key) {
      // 获取键列表，失败时继续执行移除操作
      const keys = await this.safeGetKeys()
      const existed = keys ? keys.includes(key) : false

      // 移除项目，失败时记录错误但不抛出
      try {
        await this.storageAdapter.removeItem(key)
      } catch (error) {
        this.handleStorageError('remove item', key, error, 'removal failed')
        return // 移除失败时，不需要继续获取统计信息
      }

      // 获取统计信息并记录，失败时只记录错误
      if (existed) {
        const stats = await this.safeGetStats()
        if (stats) {
          this.logCacheEvent('clear', key, {
            'remaining items': stats.size,
          })
        }
      }
    } else {
      // 清除所有缓存
      const stats = await this.safeGetStats()
      const previousSize = stats ? stats.size : 0

      try {
        await this.storageAdapter.clear()
        if (previousSize > 0) {
          this.logCacheEvent('clear', 'all items', {
            'cleared count': previousSize,
          })
        }
      } catch (error) {
        this.handleStorageError('clear all items', 'clear all', error, 'clear operation failed')
      }
    }
  }

  private safeCloneData<T>(data: T, clone: NonNullable<CacheConfig['clone']>): T {
    if (clone === 'none') return data
    if (clone === 'shallow') {
      return this.shallowClone(data)
    }
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
    return { ...(data as Record<string, unknown>) } as unknown as T
  }

  private deepClone<T>(data: T): T {
    if (typeof structuredClone === 'function') {
      try {
        return structuredClone(data)
      } catch (error) {
        console.warn('[Cache] structuredClone failed, falling back to JSON clone:', error)
      }
    }
    try {
      return JSON.parse(JSON.stringify(data))
    } catch (error) {
      console.warn('[Cache] JSON clone failed, returning original data:', error)
      return data
    }
  }

  async getCacheStats(): Promise<{
    size: number
    maxEntries: number
    hitRate?: number
    keyGeneratorStats: ReturnType<CacheKeyGenerator['getStats']>
    lastCleanup: number
    cleanupInterval: number
    storageType: StorageType
  }> {
    const stats = await this.safeGetStats()
    
    return {
      size: stats?.size || 0,
      maxEntries: this.maxEntries,
      keyGeneratorStats: this.keyGenerator.getStats(),
      lastCleanup: this.lastCleanupTime,
      cleanupInterval: this.cleanupInterval,
      storageType: this.storageAdapter.getType(),
    }
  }

  getKeyGeneratorStats() {
    return this.keyGenerator.getStats()
  }

  updateKeyGeneratorConfig(config: Partial<CacheKeyConfig>): void {
    this.keyGenerator.updateConfig(config)
  }

  clearKeyGeneratorCache(): void {
    this.keyGenerator.clearCache()
  }

  resetKeyGeneratorStats(): void {
    this.keyGenerator.resetStats()
  }

  warmupKeyGeneratorCache(configs: RequestConfig[]): void {
    this.keyGenerator.warmupCache(configs)
  }

  private createStorageAdapter(storageType: StorageType): StorageAdapter {
    switch (storageType) {
      case StorageType.MEMORY:
        return new MemoryStorageAdapter()
      case StorageType.LOCAL_STORAGE:
        if (typeof localStorage !== 'undefined') {
          return new LocalStorageAdapter()
        }
        return this.fallbackToMemoryStorage('LocalStorage is not available')
      case StorageType.INDEXED_DB:
        if (typeof indexedDB !== 'undefined') {
          return new IndexedDBAdapter()
        }
        return this.fallbackToMemoryStorage('IndexedDB is not available')
      case StorageType.WEB_SQL:
        if (typeof openDatabase !== 'undefined' && openDatabase !== undefined) {
          return new WebSQLAdapter()
        }
        return this.fallbackToMemoryStorage('WebSQL is not available')
      default:
        return new MemoryStorageAdapter()
    }
  }

  setStorageAdapter(adapter: StorageAdapter): void {
    this.storageAdapter = adapter
  }

  getStorageType(): StorageType {
    return this.storageAdapter.getType()
  }

  setKeyStrategy(strategy: CacheKeyStrategy): void {
    this.keyStrategy = strategy
  }

  setInvalidationPolicy(policy: CacheInvalidationPolicy): void {
    this.invalidationPolicy = policy
  }

  async getCacheItem(key: string): Promise<any | null> {
    return await this.storageAdapter.getItem(key)
  }

  async setCacheItem(item: any): Promise<void> {
    await this.storageAdapter.setItem(item)
  }

  async removeCacheItem(key: string): Promise<void> {
    await this.storageAdapter.removeItem(key)
  }

  isCacheItemValid(item: any): boolean {
    return this.isCacheItemValidInternal(item, Date.now())
  }
}
