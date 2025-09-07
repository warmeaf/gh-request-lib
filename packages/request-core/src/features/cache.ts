import { Requestor, RequestConfig, RequestError } from '../interface'

/**
 * @description 缓存配置
 */
export interface CacheConfig {
  ttl?: number // 缓存时间(ms)
  key?: string // 自定义缓存key
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
}

/**
 * @description 请求缓存功能
 */
export class CacheFeature {
  private cache = new Map<string, CacheItem<unknown>>()
  private cleanupTimer?: NodeJS.Timeout | number

  constructor(private requestor: Requestor) {
    // 每5分钟清理一次过期缓存
    this.cleanupTimer = setInterval(() => this.cleanupExpiredCache(), 5 * 60 * 1000)
  }

  /**
   * 清理过期缓存
   */
  private cleanupExpiredCache(): void {
    const now = Date.now()
    for (const [key, item] of this.cache.entries()) {
      if (now - item.timestamp >= item.ttl) {
        this.cache.delete(key)
      }
    }
  }

  /**
   * 销毁缓存功能，清理定时器
   */
  destroy(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
    }
    this.cache.clear()
  }

  /**
   * 稳定序列化：按键名排序，确保对象序列化稳定，防止栈溢出
   */
  private stableStringify(value: unknown, maxDepth: number = 10): string {
    if (maxDepth <= 0) {
      return '[Object]'
    }

    if (value === null || typeof value !== 'object') {
      return JSON.stringify(value)
    }

    if (Array.isArray(value)) {
      return '[' + value.map(v => this.stableStringify(v, maxDepth - 1)).join(',') + ']'
    }

    const keys = Object.keys(value as Record<string, unknown>).sort()
    const entries = keys.map(key => {
      const val = (value as Record<string, unknown>)[key]
      return `${JSON.stringify(key)}:${this.stableStringify(val, maxDepth - 1)}`
    })
    return '{' + entries.join(',') + '}'
  }

  /**
   * 生成缓存key
   */
  private generateCacheKey(config: RequestConfig, customKey?: string): string {
    if (customKey) return customKey
    
    const { url, method, data, params } = config
    const dataStr = data === undefined ? '' : this.stableStringify(data)
    const paramsStr = params === undefined ? '' : this.stableStringify(params)
    return `${method}:${url}:body=${dataStr}:params=${paramsStr}`
  }

  /**
   * 检查缓存是否有效
   */
  private isCacheValid<T>(item: CacheItem<T>): boolean {
    const now = Date.now()
    return now - item.timestamp < item.ttl
  }

  /**
   * 带缓存的请求
   * @param config 请求配置
   * @param cacheConfig 缓存配置
   */
  async requestWithCache<T>(
    config: RequestConfig,
    cacheConfig: CacheConfig = { ttl: 5 * 60 * 1000 }
  ): Promise<T> {
    const { ttl = 5 * 60 * 1000, key, clone = 'none', maxEntries } = cacheConfig
    const cacheKey = this.generateCacheKey(config, key)

    // 检查缓存
    const cachedItem = this.cache.get(cacheKey)
    if (cachedItem && this.isCacheValid(cachedItem)) {
      console.log(`[Cache] 命中缓存: ${cacheKey}`)
      return this.cloneData(cachedItem.data, clone) as T
    }

    // 发起请求
    console.log(`[Cache] 缓存未命中，发起请求: ${config.url}`)
    const data = await this.requestor.request<T>(config)

    // 存储缓存
    this.cache.set(cacheKey, {
      data,
      timestamp: Date.now(),
      ttl
    })

    // 超出容量时淘汰最早插入的一条（简易 FIFO，保持行为不变基础上提供可选限制）
    if (typeof maxEntries === 'number' && maxEntries > 0 && this.cache.size > maxEntries) {
      const oldestKey = this.cache.keys().next().value as string | undefined
      if (oldestKey !== undefined) {
        this.cache.delete(oldestKey)
      }
    }

    return this.cloneData(data, clone) as T
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
   * 根据配置对返回值进行可选拷贝
   */
  private cloneData<T>(data: T, clone: NonNullable<CacheConfig['clone']>): T {
    if (clone === 'none') return data
    if (clone === 'shallow') {
      if (data && typeof data === 'object') {
        if (Array.isArray(data)) return ([...data] as unknown) as T
        return ({ ...(data as any) } as unknown) as T
      }
      return data
    }
    // deep
    // 优先使用结构化克隆（若可用）
    try {
      // @ts-ignore structuredClone 可能不存在于某些环境
      if (typeof structuredClone === 'function') {
        // @ts-ignore
        return structuredClone(data)
      }
    } catch {}
    // 回退到 JSON 深拷贝（非可序列化类型将抛弃元信息）
    try {
      return JSON.parse(JSON.stringify(data))
    } catch {
      return data
    }
  }
}
