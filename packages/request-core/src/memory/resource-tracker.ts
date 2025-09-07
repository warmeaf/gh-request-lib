import { MemoryManager } from './memory-manager'

/**
 * @description 资源追踪器 - 为特定组件提供资源管理
 * 
 * 这是一个轻量级的包装器，简化了内存管理器的使用，
 * 为不同组件提供专门的资源管理接口。
 */

export interface ResourceTrackerConfig {
  category: string
  maxItems?: number           // 最大项目数量
  maxMemoryMB?: number       // 最大内存使用 (MB)  
  ttl?: number               // 生存时间 (ms)
  enableAutoCleanup?: boolean // 是否启用自动清理
  onResourceCreated?: (id: string, data: any) => void
  onResourceDestroyed?: (id: string, data: any) => void
  onLimitExceeded?: (current: number, limit: number) => void
}

export interface TrackedResource<T = any> {
  id: string
  data: T
  createdAt: number
  size: number
  accessCount: number
  lastAccessed: number
}

/**
 * @description 资源追踪器
 */
export class ResourceTracker<T = any> {
  private memoryManager: MemoryManager
  private config: Required<ResourceTrackerConfig>
  private trackedResources = new Map<string, TrackedResource<T>>()

  constructor(
    memoryManager: MemoryManager, 
    config: ResourceTrackerConfig
  ) {
    this.memoryManager = memoryManager
    this.config = {
      maxItems: 1000,
      maxMemoryMB: 10,
      ttl: 30 * 60 * 1000, // 30分钟
      enableAutoCleanup: true,
      onResourceCreated: () => {},
      onResourceDestroyed: () => {},
      onLimitExceeded: () => {},
      ...config
    }
  }

  /**
   * 创建资源
   */
  create(data: T, metadata?: Record<string, any>): string {
    // 检查数量限制
    if (this.trackedResources.size >= this.config.maxItems) {
      this.config.onLimitExceeded(this.trackedResources.size, this.config.maxItems)
      
      if (this.config.enableAutoCleanup) {
        this.cleanup()
      } else {
        throw new Error(`Resource limit exceeded: ${this.config.maxItems} items for category ${this.config.category}`)
      }
    }

    // 在内存管理器中分配资源
    const id = this.memoryManager.allocate(this.config.category, data, metadata)
    const size = this.estimateSize(data)
    const now = Date.now()

    const trackedResource: TrackedResource<T> = {
      id,
      data,
      createdAt: now,
      size,
      accessCount: 0,
      lastAccessed: now
    }

    this.trackedResources.set(id, trackedResource)
    this.config.onResourceCreated(id, data)

    return id
  }

  /**
   * 获取资源
   */
  get(id: string): T | null {
    const tracked = this.trackedResources.get(id)
    if (!tracked) return null

    // 检查是否过期
    if (this.isExpired(tracked)) {
      this.destroy(id)
      return null
    }

    tracked.accessCount++
    tracked.lastAccessed = Date.now()
    this.memoryManager.touchResource(id)

    return tracked.data
  }

  /**
   * 检查资源是否存在
   */
  has(id: string): boolean {
    const tracked = this.trackedResources.get(id)
    if (!tracked) return false

    if (this.isExpired(tracked)) {
      this.destroy(id)
      return false
    }

    return true
  }

  /**
   * 销毁特定资源
   */
  destroy(id: string): boolean {
    const tracked = this.trackedResources.get(id)
    if (!tracked) return false

    this.trackedResources.delete(id)
    this.memoryManager.deallocate(id)
    this.config.onResourceDestroyed(id, tracked.data)

    return true
  }

  /**
   * 获取所有资源ID
   */
  getIds(): string[] {
    return Array.from(this.trackedResources.keys())
  }

  /**
   * 获取所有资源
   */
  getAll(): TrackedResource<T>[] {
    return Array.from(this.trackedResources.values())
  }

  /**
   * 清理过期资源
   */
  cleanup(): number {
    const now = Date.now()
    let cleaned = 0

    for (const [id, resource] of this.trackedResources) {
      if (this.isExpired(resource)) {
        this.destroy(id)
        cleaned++
      }
    }

    // 如果还是超过限制，清理最少使用的资源
    if (this.trackedResources.size > this.config.maxItems) {
      const overflow = this.trackedResources.size - this.config.maxItems
      const sortedResources = this.getAll().sort((a, b) => {
        // 优先清理访问次数少且最久未访问的资源
        const scoreA = a.accessCount * 1000 + (now - a.lastAccessed)
        const scoreB = b.accessCount * 1000 + (now - b.lastAccessed)
        return scoreA - scoreB
      })

      for (let i = 0; i < overflow && i < sortedResources.length; i++) {
        this.destroy(sortedResources[i].id)
        cleaned++
      }
    }

    return cleaned
  }

  /**
   * 强制清理所有资源
   */
  clear(): number {
    const count = this.trackedResources.size
    
    for (const id of this.trackedResources.keys()) {
      this.destroy(id)
    }

    return count
  }

  /**
   * 检查资源是否过期
   */
  private isExpired(resource: TrackedResource<T>): boolean {
    return Date.now() - resource.createdAt > this.config.ttl
  }

  /**
   * 估算资源大小
   */
  private estimateSize(data: T): number {
    if (data === null || data === undefined) return 0
    
    const type = typeof data
    switch (type) {
      case 'boolean':
        return 4
      case 'number':
        return 8
      case 'string':
        return (data as unknown as string).length * 2 + 40
      case 'object':
        if (Array.isArray(data)) {
          return data.length * 8 + 40
        }
        return Object.keys(data as object).length * 32 + 40
      default:
        return 32
    }
  }

  /**
   * 获取统计信息
   */
  getStats(): {
    category: string
    totalItems: number
    totalMemoryMB: number
    avgAccessCount: number
    oldestItemAge: number
    newestItemAge: number
    memoryPerItem: number
  } {
    const resources = this.getAll()
    const now = Date.now()

    if (resources.length === 0) {
      return {
        category: this.config.category,
        totalItems: 0,
        totalMemoryMB: 0,
        avgAccessCount: 0,
        oldestItemAge: 0,
        newestItemAge: 0,
        memoryPerItem: 0
      }
    }

    const totalMemory = resources.reduce((sum, r) => sum + r.size, 0)
    const totalAccess = resources.reduce((sum, r) => sum + r.accessCount, 0)
    const ages = resources.map(r => now - r.createdAt)

    return {
      category: this.config.category,
      totalItems: resources.length,
      totalMemoryMB: totalMemory / (1024 * 1024),
      avgAccessCount: totalAccess / resources.length,
      oldestItemAge: Math.max(...ages),
      newestItemAge: Math.min(...ages),
      memoryPerItem: totalMemory / resources.length
    }
  }

  /**
   * 设置TTL
   */
  setTTL(ttl: number): void {
    this.config.ttl = ttl
  }

  /**
   * 设置最大项目数
   */
  setMaxItems(maxItems: number): void {
    this.config.maxItems = maxItems
    
    if (this.trackedResources.size > maxItems && this.config.enableAutoCleanup) {
      this.cleanup()
    }
  }

  /**
   * 启用/禁用自动清理
   */
  setAutoCleanup(enabled: boolean): void {
    this.config.enableAutoCleanup = enabled
  }
}

/**
 * @description 专门用于性能数据的资源追踪器
 */
export class PerformanceResourceTracker extends ResourceTracker<any> {
  constructor(memoryManager: MemoryManager, maxRecords: number = 1000) {
    super(memoryManager, {
      category: 'performance',
      maxItems: maxRecords,
      maxMemoryMB: 5,
      ttl: 24 * 60 * 60 * 1000, // 24小时
      enableAutoCleanup: true,
      onLimitExceeded: (current, limit) => {
        console.warn(`[Performance] Record limit exceeded: ${current}/${limit}, cleaning up old records`)
      }
    })
  }
}

/**
 * @description 专门用于错误日志的资源追踪器
 */
export class ErrorLogTracker extends ResourceTracker<Error> {
  constructor(memoryManager: MemoryManager, maxErrors: number = 500) {
    super(memoryManager, {
      category: 'error_logs',
      maxItems: maxErrors,
      maxMemoryMB: 2,
      ttl: 60 * 60 * 1000, // 1小时
      enableAutoCleanup: true,
      onLimitExceeded: (current, limit) => {
        console.warn(`[ErrorLog] Error log limit exceeded: ${current}/${limit}, cleaning up old errors`)
      }
    })
  }
}

/**
 * @description 专门用于调试信息的资源追踪器
 */
export class DebugInfoTracker extends ResourceTracker<any> {
  constructor(memoryManager: MemoryManager, maxDebugItems: number = 200) {
    super(memoryManager, {
      category: 'debug_info',
      maxItems: maxDebugItems,
      maxMemoryMB: 1,
      ttl: 10 * 60 * 1000, // 10分钟
      enableAutoCleanup: true,
      onLimitExceeded: (current, limit) => {
        console.warn(`[Debug] Debug info limit exceeded: ${current}/${limit}, cleaning up old debug data`)
      }
    })
  }
}
