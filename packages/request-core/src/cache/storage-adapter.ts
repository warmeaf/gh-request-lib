/**
 * @description 存储适配器接口
 * 定义了各种存储方案需要实现的统一接口
 */

/**
 * @description 存储类型枚举
 */
export enum StorageType {
  MEMORY = 'memory',
  LOCAL_STORAGE = 'localStorage',
  INDEXED_DB = 'indexedDB'
}

/**
 * @description 存储项接口
 */
export interface StorageItem<T = unknown> {
  key: string
  data: T
  timestamp: number
  ttl: number
  accessTime: number
  accessCount: number
}

/**
 * @description 存储适配器接口
 */
export interface StorageAdapter<T = unknown> {
  /**
   * 获取存储类型
   */
  getType(): StorageType

  /**
   * 检查存储是否可用
   */
  isAvailable(): boolean

  /**
   * 获取存储项
   */
  getItem(key: string): Promise<StorageItem<T> | null>

  /**
   * 设置存储项
   */
  setItem(item: StorageItem<T>): Promise<void>

  /**
   * 删除存储项
   */
  removeItem(key: string): Promise<void>

  /**
   * 清空所有存储项
   */
  clear(): Promise<void>

  /**
   * 获取所有键
   */
  getKeys(): Promise<string[]>

  /**
   * 销毁存储适配器，清理资源
   */
  destroy(): Promise<void>
}

/**
 * @description 缓存失效策略枚举
 */
export enum CacheInvalidationStrategy {
  LRU = 'lru',           // 最近最少使用
  FIFO = 'fifo',         // 先进先出
  TIME_BASED = 'timeBased' // 基于时间
}

/**
 * @description 缓存键生成策略
 */
export interface CacheKeyStrategy {
  /**
   * 生成缓存键
   * @param config 请求配置
   * @returns 缓存键
   */
  generateKey(config: any): string

  /**
   * 验证缓存键
   * @param key 缓存键
   * @returns 是否有效
   */
  validateKey(key: string): boolean
}

/**
 * @description URL路径缓存键策略
 * 基于URL路径生成缓存键
 */
export class UrlPathKeyStrategy implements CacheKeyStrategy {
  generateKey(config: any): string {
    if (!config || !config.url) {
      throw new Error('URL is required for UrlPathKeyStrategy')
    }

    // 提取URL路径部分
    const urlString = config.url
    
    // 检查是否是绝对URL或相对路径（以/开头）
    if (urlString.includes('://') || urlString.startsWith('/')) {
      try {
        const url = new URL(urlString, typeof window !== 'undefined' ? window.location.origin : 'http://localhost')
        return `path:${url.pathname}`
      } catch (error) {
        // 如果URL解析失败，直接使用路径
        const path = urlString.split('?')[0].split('#')[0]
        return `path:${path}`
      }
    } else {
      // 对于不是绝对URL也不以/开头的字符串，直接处理为路径
      const path = urlString.split('?')[0].split('#')[0]
      return `path:${path}`
    }
  }

  validateKey(key: string): boolean {
    return key.startsWith('path:')
  }
}

/**
 * @description 完整URL缓存键策略
 * 基于完整URL生成缓存键
 */
export class FullUrlKeyStrategy implements CacheKeyStrategy {
  generateKey(config: any): string {
    if (!config || !config.url) {
      throw new Error('URL is required for FullUrlKeyStrategy')
    }

    return `url:${config.url}`
  }

  validateKey(key: string): boolean {
    return key.startsWith('url:')
  }
}

/**
 * @description 参数化缓存键策略
 * 基于URL和参数生成缓存键
 */
export class ParameterizedKeyStrategy implements CacheKeyStrategy {
  generateKey(config: any): string {
    if (!config || !config.url) {
      throw new Error('URL is required for ParameterizedKeyStrategy')
    }

    const { url, params } = config
    const baseKey = `param:${url}`

    if (!params || Object.keys(params).length === 0) {
      return baseKey
    }

    // 对参数进行排序以确保一致性
    const sortedParams = Object.keys(params)
      .sort()
      .map(key => `${key}=${params[key]}`)
      .join('&')

    return `${baseKey}?${sortedParams}`
  }

  validateKey(key: string): boolean {
    return key.startsWith('param:')
  }
}

/**
 * @description 自定义缓存键策略
 * 允许用户提供自定义的键生成函数
 */
export class CustomKeyStrategy implements CacheKeyStrategy {
  constructor(private keyGenerator: (config: any) => string) {
    if (typeof keyGenerator !== 'function') {
      throw new Error('keyGenerator must be a function')
    }
  }

  generateKey(config: any): string {
    return this.keyGenerator(config)
  }

  validateKey(key: string): boolean {
    return typeof key === 'string' && key.length > 0
  }
}

/**
 * @description 缓存失效策略接口
 */
export interface CacheInvalidationPolicy {
  /**
   * 检查缓存项是否应该失效
   * @param item 缓存项
   * @param now 当前时间戳
   * @returns 是否应该失效
   */
  shouldInvalidate(item: any, now: number): boolean

  /**
   * 在访问缓存项时更新其状态
   * @param item 缓存项
   * @param now 当前时间戳
   */
  updateItemOnAccess(item: any, now: number): void
}

/**
 * @description LRU失效策略
 * 基于最近最少使用算法
 */
export class LRUInvalidationPolicy implements CacheInvalidationPolicy {
  shouldInvalidate(item: any, now: number): boolean {
    // 空值检查：null 或 undefined 的项目应该被认为是无效的
    if (!item) {
      return true
    }

    // 检查必要属性是否存在
    if (typeof item.timestamp !== 'number' || typeof item.ttl !== 'number') {
      return true
    }

    // LRU策略本身不主动失效项，只在容量满时淘汰最久未使用的项
    // 这里检查是否超过TTL
    return now - item.timestamp >= item.ttl
  }

  updateItemOnAccess(item: any, now: number): void {
    // 空值检查：如果项目为空，直接返回
    if (!item) {
      return
    }

    // 更新最后访问时间
    item.accessTime = now
    // 增加访问计数
    item.accessCount = (item.accessCount || 0) + 1
  }
}

/**
 * @description FIFO失效策略
 * 基于先进先出算法
 */
export class FIFOInvalidationPolicy implements CacheInvalidationPolicy {
  shouldInvalidate(item: any, now: number): boolean {
    // FIFO策略本身不主动失效项，只在容量满时淘汰最早加入的项
    // 这里检查是否超过TTL
    return now - item.timestamp >= item.ttl
  }

  updateItemOnAccess(item: any, now: number): void {
    // FIFO策略在访问时不需要更新状态
    // 保持原有的加入时间
  }
}

/**
 * @description 基于时间的失效策略
 * 基于时间戳和TTL
 */
export class TimeBasedInvalidationPolicy implements CacheInvalidationPolicy {
  shouldInvalidate(item: any, now: number): boolean {
    // 检查是否超过TTL
    return now - item.timestamp >= item.ttl
  }

  updateItemOnAccess(item: any, now: number): void {
    // 基于时间的策略在访问时不需要更新状态
  }
}

/**
 * @description 自定义失效策略
 * 允许用户提供自定义的失效函数
 */
export class CustomInvalidationPolicy implements CacheInvalidationPolicy {
  constructor(
    private invalidationChecker: (item: any, now: number) => boolean,
    private accessUpdater?: (item: any, now: number) => void
  ) {
    if (typeof invalidationChecker !== 'function') {
      throw new Error('invalidationChecker must be a function')
    }
  }

  shouldInvalidate(item: any, now: number): boolean {
    return this.invalidationChecker(item, now)
  }

  updateItemOnAccess(item: any, now: number): void {
    if (this.accessUpdater) {
      this.accessUpdater(item, now)
    }
  }
}