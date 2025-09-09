// 导出缓存相关的所有类和接口
export type { CacheKeyConfig } from './cache-key-generator'

// 导出存储适配器相关
export type { 
  StorageAdapter, 
  StorageItem,
  CacheKeyStrategy,
  CacheInvalidationPolicy
} from './storage-adapter'
export { 
  StorageType,
  CacheInvalidationStrategy,
  UrlPathKeyStrategy,
  FullUrlKeyStrategy,
  ParameterizedKeyStrategy,
  CustomKeyStrategy,
  LRUInvalidationPolicy,
  FIFOInvalidationPolicy,
  TimeBasedInvalidationPolicy,
  CustomInvalidationPolicy
} from './strategies'

// 导出具体的实现类
export { CacheKeyGenerator } from './cache-key-generator'
export { MemoryStorageAdapter } from './adapters/memory-adapter'
export { LocalStorageAdapter } from './adapters/local-storage-adapter'
export { IndexedDBAdapter } from './adapters/indexeddb-adapter'
export { WebSQLAdapter } from './adapters/websql-adapter'
