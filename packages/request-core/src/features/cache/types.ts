import { CacheKeyConfig, CacheKeyStrategy, StorageAdapter, StorageType } from '../../cache'
import type { CacheInvalidationPolicy } from '../../cache'

/**
 * @description 缓存预设配置类型
 */
export type CachePreset = 
  | 'default'      // 默认配置：内存存储，5分钟TTL
  | 'short'        // 短期缓存：内存存储，1分钟TTL
  | 'medium'       // 中期缓存：LocalStorage，30分钟TTL
  | 'long'         // 长期缓存：IndexedDB，24小时TTL
  | 'persistent'   // 持久化缓存：IndexedDB，7天TTL

/**
 * @description 缓存配置
 */
export interface CacheConfig {
  ttl?: number
  key?: string
  clone?: 'none' | 'shallow' | 'deep'
  maxEntries?: number
  keyGenerator?: CacheKeyConfig
  storageType?: StorageType
  storageAdapter?: StorageAdapter
  keyStrategy?: CacheKeyStrategy
  invalidationPolicy?: CacheInvalidationPolicy
  preset?: CachePreset  // 预设配置，会覆盖其他配置项
}
