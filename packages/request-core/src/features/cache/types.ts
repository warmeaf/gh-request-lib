import { CacheKeyConfig, CacheKeyStrategy, StorageAdapter } from '../../cache'
import type { CacheInvalidationPolicy } from '../../cache'
import { StorageType } from '../../cache/strategies'

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
}
