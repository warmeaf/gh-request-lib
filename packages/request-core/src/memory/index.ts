// 导出内存管理相关的所有类和接口
export { MemoryManager } from './memory-manager'
export type { 
  MemoryStats, 
  MemoryConfig, 
  ManagedResource, 
  GarbageCollectionResult 
} from './memory-manager'

export { ResourceTracker, PerformanceResourceTracker, ErrorLogTracker, DebugInfoTracker } from './resource-tracker'
export type { 
  ResourceTrackerConfig, 
  TrackedResource 
} from './resource-tracker'

export { 
  CleanupStrategy,
  LRUCleanupStrategy,
  LFUCleanupStrategy,
  TTLCleanupStrategy,
  SizeBasedCleanupStrategy,
  PriorityBasedCleanupStrategy,
  HybridCleanupStrategy,
  SmartCleanupStrategy,
  CleanupStrategyFactory
} from './cleanup-strategies'
export type { 
  CleanupTarget, 
  CleanupResult, 
  CleanupConfig 
} from './cleanup-strategies'
