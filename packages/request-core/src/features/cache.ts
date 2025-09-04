import { Requestor, RequestConfig } from '../interface'

/**
 * @description 缓存配置
 */
export interface CacheConfig {
  ttl?: number // 缓存时间(ms)
  key?: string // 自定义缓存key
}

/**
 * @description 缓存项
 */
interface CacheItem<T> {
  data: T
  timestamp: number
  ttl: number
}

/**
 * @description 请求缓存功能
 */
export class CacheFeature {
  private cache = new Map<string, CacheItem<any>>()

  constructor(private requestor: Requestor) {}

  /**
   * 生成缓存key
   */
  private generateCacheKey(config: RequestConfig, customKey?: string): string {
    if (customKey) return customKey
    
    const { url, method, data } = config
    const dataStr = data ? JSON.stringify(data) : ''
    return `${method}:${url}:${dataStr}`
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
    const { ttl = 5 * 60 * 1000, key } = cacheConfig
    const cacheKey = this.generateCacheKey(config, key)

    // 检查缓存
    const cachedItem = this.cache.get(cacheKey)
    if (cachedItem && this.isCacheValid(cachedItem)) {
      console.log(`[Cache] 命中缓存: ${cacheKey}`)
      return cachedItem.data
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

    return data
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
}
