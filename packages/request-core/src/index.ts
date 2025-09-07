// 导出核心接口和类型
export type { Requestor, RequestConfig } from './interface'
export { RequestError } from './interface'
export type { RetryConfig } from './features/retry'
export type { CacheConfig } from './features/cache'
export type { ConcurrentConfig, ConcurrentResult } from './features/concurrent'

// 导出核心类
export { RequestCore } from './core'

// 导出功能类（如果需要单独使用）
export { RetryFeature } from './features/retry'
export { CacheFeature } from './features/cache'
export { ConcurrentFeature } from './features/concurrent'
