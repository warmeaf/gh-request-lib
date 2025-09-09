/**
 * @description 缓存失效策略枚举
 */
export { StorageType, CacheInvalidationStrategy } from './storage-adapter'

/**
 * @description 缓存键生成策略
 */
export type { CacheKeyStrategy } from './storage-adapter'

/**
 * @description URL路径缓存键策略
 * 基于URL路径生成缓存键
 */
export { UrlPathKeyStrategy } from './storage-adapter'

/**
 * @description 完整URL缓存键策略
 * 基于完整URL生成缓存键
 */
export { FullUrlKeyStrategy } from './storage-adapter'

/**
 * @description 参数化缓存键策略
 * 基于URL和参数生成缓存键
 */
export { ParameterizedKeyStrategy } from './storage-adapter'

/**
 * @description 自定义缓存键策略
 * 允许用户提供自定义的键生成函数
 */
export { CustomKeyStrategy } from './storage-adapter'

/**
 * @description 缓存失效策略接口
 */
export type { CacheInvalidationPolicy } from './storage-adapter'

/**
 * @description LRU失效策略
 * 基于最近最少使用算法
 */
export { LRUInvalidationPolicy } from './storage-adapter'

/**
 * @description FIFO失效策略
 * 基于先进先出算法
 */
export { FIFOInvalidationPolicy } from './storage-adapter'

/**
 * @description 基于时间的失效策略
 * 基于时间戳和TTL
 */
export { TimeBasedInvalidationPolicy } from './storage-adapter'

/**
 * @description 自定义失效策略
 * 允许用户提供自定义的失效函数
 */
export { CustomInvalidationPolicy } from './storage-adapter'