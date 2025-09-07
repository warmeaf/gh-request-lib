import { Requestor, RequestConfig, RequestError } from '../interface'

/**
 * @description 缓存配置
 */
export interface CacheConfig {
  ttl?: number // 缓存时间(毫秒)
  key?: string // 自定义缓存键
  clone?: 'none' | 'shallow' | 'deep' // 返回数据是否拷贝，默认不拷贝以保持现状
  maxEntries?: number // 可选的最大缓存条目数（不设置则不限制）
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
 * @description 序列化选项
 */
interface SerializationOptions {
  maxDepth: number
  maxKeys: number
  visited: WeakSet<object>
}

/**
 * @description 请求缓存功能 - 使用懒清理和LRU策略
 */
export class CacheFeature {
  private cache = new Map<string, CacheItem<unknown>>()
  private maxEntries: number
  private lastCleanupTime = 0
  private readonly cleanupInterval = 5 * 60 * 1000 // 5分钟清理间隔
  
  constructor(private requestor: Requestor, maxEntries = 1000) {
    this.maxEntries = maxEntries
  }

  /**
   * 懒清理过期缓存 - 仅在必要时执行
   */
  private lazyCleanupIfNeeded(): void {
    const now = Date.now()
    
    // 如果距离上次清理不足5分钟且缓存未满，跳过清理
    if (now - this.lastCleanupTime < this.cleanupInterval && 
        this.cache.size < this.maxEntries * 0.9) {
      return
    }
    
    this.lastCleanupTime = now
    const expiredKeys: string[] = []
    
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp >= item.ttl) {
        expiredKeys.push(key)
      }
    }
    
    // 批量删除过期项
    expiredKeys.forEach(key => this.cache.delete(key))
    
    // 如果仍然超出容量，执行LRU淘汰
    if (this.cache.size > this.maxEntries) {
      this.evictLRU(this.cache.size - this.maxEntries)
    }
  }
  
  /**
   * LRU淘汰最少使用的缓存项
   */
  private evictLRU(count: number): void {
    if (count <= 0) return
    
    const entries = Array.from(this.cache.entries())
    // 按访问时间排序，最少访问的在前面
    entries.sort(([,a], [,b]) => a.accessTime - b.accessTime)
    
    for (let i = 0; i < count && i < entries.length; i++) {
      this.cache.delete(entries[i][0])
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
   * 高性能稳定序列化：防循环引用，限制深度和键数量
   */
  private fastStableStringify(value: unknown, options?: Partial<SerializationOptions>): string {
    const opts: SerializationOptions = {
      maxDepth: options?.maxDepth ?? 8,
      maxKeys: options?.maxKeys ?? 50,
      visited: options?.visited ?? new WeakSet()
    }
    
    return this.stringifyValue(value, opts, 0)
  }
  
  private stringifyValue(value: unknown, opts: SerializationOptions, depth: number): string {
    // 基础类型快速路径
    if (value === null) return 'null'
    if (typeof value !== 'object') return JSON.stringify(value)
    
    // 深度检查
    if (depth >= opts.maxDepth) return '[MaxDepth]'
    
    // 循环引用检查
    if (opts.visited.has(value as object)) return '[Circular]'
    opts.visited.add(value as object)
    
    try {
      if (Array.isArray(value)) {
        return this.stringifyArray(value, opts, depth)
      } else {
        return this.stringifyObject(value as Record<string, unknown>, opts, depth)
      }
    } finally {
      opts.visited.delete(value as object)
    }
  }
  
  private stringifyArray(arr: unknown[], opts: SerializationOptions, depth: number): string {
    // 限制数组长度，避免过大数组影响性能
    const items = arr.slice(0, opts.maxKeys).map(item => 
      this.stringifyValue(item, opts, depth + 1)
    )
    return '[' + items.join(',') + (arr.length > opts.maxKeys ? ',...' : '') + ']'
  }
  
  private stringifyObject(obj: Record<string, unknown>, opts: SerializationOptions, depth: number): string {
    const keys = Object.keys(obj).sort()
    const limitedKeys = keys.slice(0, opts.maxKeys)
    
    const entries = limitedKeys.map(key => {
      const val = obj[key]
      const keyStr = JSON.stringify(key)
      const valStr = this.stringifyValue(val, opts, depth + 1)
      return `${keyStr}:${valStr}`
    })
    
    const result = '{' + entries.join(',') + (keys.length > opts.maxKeys ? ',...' : '') + '}'
    return result
  }

  /**
   * 生成安全的缓存键
   */
  private generateCacheKey(config: RequestConfig, customKey?: string): string {
    if (customKey) {
      // 安全验证自定义键
      if (typeof customKey !== 'string' || customKey.length > 200 || 
          /[\x00-\x1f\x7f-\x9f]/.test(customKey)) {
        throw new RequestError('Invalid custom cache key: must be a safe string under 200 chars')
      }
      return customKey
    }
    
    const { url, method, data, params } = config
    
    // 安全检查URL
    if (!url || typeof url !== 'string' || url.length > 2048) {
      throw new RequestError('Invalid URL for cache key generation')
    }
    
    // 使用优化的序列化
    const dataStr = data === undefined ? '' : this.fastStableStringify(data)
    const paramsStr = params === undefined ? '' : this.fastStableStringify(params)
    
    const key = `${method}:${url}:body=${dataStr}:params=${paramsStr}`
    
    // 限制缓存键长度
    if (key.length > 1024) {
      // 使用哈希缩短过长的键
      const hash = this.simpleHash(key)
      return `${method}:${url.substring(0, 100)}:hash=${hash}`
    }
    
    return key
  }
  
  /**
   * 简单哈希函数，用于缩短过长的缓存键
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转为32位整数
    }
    return Math.abs(hash).toString(36)
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
   * 带缓存的请求 - 优化版本
   * @param config 请求配置
   * @param cacheConfig 缓存配置
   */
  async requestWithCache<T>(
    config: RequestConfig,
    cacheConfig: CacheConfig = { ttl: 5 * 60 * 1000 }
  ): Promise<T> {
    const { ttl = 5 * 60 * 1000, key, clone = 'none', maxEntries } = cacheConfig
    
    // 如果配置了maxEntries，更新实例的maxEntries
    if (typeof maxEntries === 'number' && maxEntries > 0) {
      this.maxEntries = maxEntries
    }
    
    // 执行懒清理
    this.lazyCleanupIfNeeded()
    
    const cacheKey = this.generateCacheKey(config, key)

    // 检查缓存
    const cachedItem = this.cache.get(cacheKey)
    if (cachedItem && this.isCacheValidAndUpdate(cachedItem)) {
      console.log(`[Cache] Cache hit: ${cacheKey.substring(0, 50)}...`)
      return this.safeCloneData(cachedItem.data, clone) as T
    }

    // 缓存未命中或已过期，删除过期项
    if (cachedItem) {
      this.cache.delete(cacheKey)
    }

    // 发起请求
    console.log(`[Cache] Cache miss, making request: ${config.url}`)
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

    return this.safeCloneData(data, clone) as T
  }

  /**
   * 清除缓存
   */
  clearCache(key?: string): void {
    if (key) {
      this.cache.delete(key)
    } else {
      this.cache.clear()
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
   * 获取缓存统计信息
   */
  getCacheStats(): {
    size: number
    maxEntries: number
    hitRate?: number
  } {
    return {
      size: this.cache.size,
      maxEntries: this.maxEntries
    }
  }
}
