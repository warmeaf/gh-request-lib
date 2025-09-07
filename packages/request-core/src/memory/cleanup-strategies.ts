/**
 * @description 内存清理策略 - 实现不同的内存清理算法
 * 
 * 提供多种清理策略：
 * - LRU (Least Recently Used) - 最近最少使用
 * - LFU (Least Frequently Used) - 最少频率使用  
 * - TTL (Time To Live) - 基于时间过期
 * - Size-based - 基于大小的清理
 * - Priority-based - 基于优先级的清理
 */

export interface CleanupTarget {
  id: string
  size: number
  createdAt: number
  lastAccessed: number
  accessCount: number
  priority?: number
  metadata?: Record<string, any>
}

export interface CleanupResult {
  itemsRemoved: string[]
  memoryFreed: number
  strategy: string
  executionTime: number
}

export interface CleanupConfig {
  maxItems?: number
  maxMemoryBytes?: number
  maxAge?: number
  minAccessCount?: number
  priorityThreshold?: number
}

/**
 * @description 清理策略基类
 */
export abstract class CleanupStrategy {
  protected name: string

  constructor(name: string) {
    this.name = name
  }

  /**
   * 执行清理
   */
  abstract execute(targets: CleanupTarget[], config: CleanupConfig): CleanupResult

  /**
   * 创建清理结果
   */
  protected createResult(itemsRemoved: string[], memoryFreed: number, startTime: number): CleanupResult {
    return {
      itemsRemoved,
      memoryFreed,
      strategy: this.name,
      executionTime: Date.now() - startTime
    }
  }
}

/**
 * @description LRU清理策略 - 清理最近最少使用的项目
 */
export class LRUCleanupStrategy extends CleanupStrategy {
  constructor() {
    super('LRU')
  }

  execute(targets: CleanupTarget[], config: CleanupConfig): CleanupResult {
    const startTime = Date.now()
    const maxItems = config.maxItems || targets.length
    
    if (targets.length <= maxItems) {
      return this.createResult([], 0, startTime)
    }

    // 按最后访问时间排序（最久未访问的在前）
    const sorted = [...targets].sort((a, b) => a.lastAccessed - b.lastAccessed)
    const toRemove = sorted.slice(0, targets.length - maxItems)
    
    const itemsRemoved = toRemove.map(item => item.id)
    const memoryFreed = toRemove.reduce((sum, item) => sum + item.size, 0)

    return this.createResult(itemsRemoved, memoryFreed, startTime)
  }
}

/**
 * @description LFU清理策略 - 清理访问频率最低的项目
 */
export class LFUCleanupStrategy extends CleanupStrategy {
  constructor() {
    super('LFU')
  }

  execute(targets: CleanupTarget[], config: CleanupConfig): CleanupResult {
    const startTime = Date.now()
    const maxItems = config.maxItems || targets.length
    
    if (targets.length <= maxItems) {
      return this.createResult([], 0, startTime)
    }

    // 按访问次数排序（访问次数少的在前）
    const sorted = [...targets].sort((a, b) => {
      if (a.accessCount === b.accessCount) {
        // 访问次数相同时，按最后访问时间排序
        return a.lastAccessed - b.lastAccessed
      }
      return a.accessCount - b.accessCount
    })
    
    const toRemove = sorted.slice(0, targets.length - maxItems)
    const itemsRemoved = toRemove.map(item => item.id)
    const memoryFreed = toRemove.reduce((sum, item) => sum + item.size, 0)

    return this.createResult(itemsRemoved, memoryFreed, startTime)
  }
}

/**
 * @description TTL清理策略 - 清理过期的项目
 */
export class TTLCleanupStrategy extends CleanupStrategy {
  constructor() {
    super('TTL')
  }

  execute(targets: CleanupTarget[], config: CleanupConfig): CleanupResult {
    const startTime = Date.now()
    const maxAge = config.maxAge || Number.MAX_SAFE_INTEGER
    const now = Date.now()
    
    const toRemove = targets.filter(item => (now - item.createdAt) > maxAge)
    const itemsRemoved = toRemove.map(item => item.id)
    const memoryFreed = toRemove.reduce((sum, item) => sum + item.size, 0)

    return this.createResult(itemsRemoved, memoryFreed, startTime)
  }
}

/**
 * @description 基于大小的清理策略 - 优先清理占用内存大的项目
 */
export class SizeBasedCleanupStrategy extends CleanupStrategy {
  constructor() {
    super('SizeBased')
  }

  execute(targets: CleanupTarget[], config: CleanupConfig): CleanupResult {
    const startTime = Date.now()
    const maxMemoryBytes = config.maxMemoryBytes || Number.MAX_SAFE_INTEGER
    
    const totalMemory = targets.reduce((sum, item) => sum + item.size, 0)
    if (totalMemory <= maxMemoryBytes) {
      return this.createResult([], 0, startTime)
    }

    // 按大小降序排列（大的在前）
    const sorted = [...targets].sort((a, b) => b.size - a.size)
    
    const toRemove: CleanupTarget[] = []
    let memoryToFree = totalMemory - maxMemoryBytes
    
    for (const item of sorted) {
      if (memoryToFree <= 0) break
      toRemove.push(item)
      memoryToFree -= item.size
    }

    const itemsRemoved = toRemove.map(item => item.id)
    const memoryFreed = toRemove.reduce((sum, item) => sum + item.size, 0)

    return this.createResult(itemsRemoved, memoryFreed, startTime)
  }
}

/**
 * @description 基于优先级的清理策略 - 清理低优先级的项目
 */
export class PriorityBasedCleanupStrategy extends CleanupStrategy {
  constructor() {
    super('PriorityBased')
  }

  execute(targets: CleanupTarget[], config: CleanupConfig): CleanupResult {
    const startTime = Date.now()
    const priorityThreshold = config.priorityThreshold ?? 0
    
    const toRemove = targets.filter(item => (item.priority ?? 0) <= priorityThreshold)
    const itemsRemoved = toRemove.map(item => item.id)
    const memoryFreed = toRemove.reduce((sum, item) => sum + item.size, 0)

    return this.createResult(itemsRemoved, memoryFreed, startTime)
  }
}

/**
 * @description 混合清理策略 - 结合多种策略
 */
export class HybridCleanupStrategy extends CleanupStrategy {
  private strategies: CleanupStrategy[]
  
  constructor(strategies?: CleanupStrategy[]) {
    super('Hybrid')
    this.strategies = strategies || [
      new TTLCleanupStrategy(),
      new LRUCleanupStrategy(),
      new LFUCleanupStrategy()
    ]
  }

  execute(targets: CleanupTarget[], config: CleanupConfig): CleanupResult {
    const startTime = Date.now()
    let remainingTargets = [...targets]
    const allItemsRemoved: string[] = []
    let totalMemoryFreed = 0

    // 依次执行各个策略
    for (const strategy of this.strategies) {
      if (remainingTargets.length === 0) break

      const result = strategy.execute(remainingTargets, config)
      
      if (result.itemsRemoved.length > 0) {
        allItemsRemoved.push(...result.itemsRemoved)
        totalMemoryFreed += result.memoryFreed
        
        // 从剩余目标中移除已清理的项目
        remainingTargets = remainingTargets.filter(
          target => !result.itemsRemoved.includes(target.id)
        )
      }
    }

    return this.createResult(allItemsRemoved, totalMemoryFreed, startTime)
  }
}

/**
 * @description 智能清理策略 - 根据使用模式动态选择策略
 */
export class SmartCleanupStrategy extends CleanupStrategy {
  private lru: LRUCleanupStrategy
  private lfu: LFUCleanupStrategy
  private ttl: TTLCleanupStrategy
  private sizeBased: SizeBasedCleanupStrategy

  constructor() {
    super('Smart')
    this.lru = new LRUCleanupStrategy()
    this.lfu = new LFUCleanupStrategy()
    this.ttl = new TTLCleanupStrategy()
    this.sizeBased = new SizeBasedCleanupStrategy()
  }

  execute(targets: CleanupTarget[], config: CleanupConfig): CleanupResult {
    const startTime = Date.now()
    
    // 分析数据特征选择最佳策略
    const analysis = this.analyzeTargets(targets)
    
    let strategy: CleanupStrategy
    
    if (analysis.hasExpiredItems) {
      // 如果有过期项目，优先使用TTL策略
      strategy = this.ttl
    } else if (analysis.memoryPressure > 0.8) {
      // 内存压力大时使用基于大小的策略
      strategy = this.sizeBased
    } else if (analysis.accessVariance > 10) {
      // 访问模式差异大时使用LFU策略
      strategy = this.lfu
    } else {
      // 默认使用LRU策略
      strategy = this.lru
    }

    const result = strategy.execute(targets, config)
    
    // 如果单一策略效果不好，使用混合策略
    if (result.itemsRemoved.length < Math.min(10, targets.length * 0.1)) {
      const hybrid = new HybridCleanupStrategy()
      return hybrid.execute(targets, config)
    }

    return this.createResult(result.itemsRemoved, result.memoryFreed, startTime)
  }

  /**
   * 分析目标数据特征
   */
  private analyzeTargets(targets: CleanupTarget[]): {
    hasExpiredItems: boolean
    memoryPressure: number
    accessVariance: number
    avgAccessCount: number
  } {
    if (targets.length === 0) {
      return {
        hasExpiredItems: false,
        memoryPressure: 0,
        accessVariance: 0,
        avgAccessCount: 0
      }
    }

    const now = Date.now()
    const maxAge = 30 * 60 * 1000 // 30分钟
    
    const expiredCount = targets.filter(t => (now - t.createdAt) > maxAge).length
    const totalMemory = targets.reduce((sum, t) => sum + t.size, 0)
    const accessCounts = targets.map(t => t.accessCount)
    const avgAccessCount = accessCounts.reduce((sum, count) => sum + count, 0) / targets.length
    
    // 计算访问次数方差
    const variance = accessCounts.reduce((sum, count) => sum + Math.pow(count - avgAccessCount, 2), 0) / targets.length

    return {
      hasExpiredItems: expiredCount > 0,
      memoryPressure: totalMemory / (100 * 1024 * 1024), // 假设100MB为高压力线
      accessVariance: Math.sqrt(variance),
      avgAccessCount
    }
  }
}

/**
 * @description 清理策略工厂
 */
export class CleanupStrategyFactory {
  private static strategies = new Map<string, CleanupStrategy>([
    ['lru', new LRUCleanupStrategy()],
    ['lfu', new LFUCleanupStrategy()],
    ['ttl', new TTLCleanupStrategy()],
    ['size', new SizeBasedCleanupStrategy()],
    ['priority', new PriorityBasedCleanupStrategy()],
    ['hybrid', new HybridCleanupStrategy()],
    ['smart', new SmartCleanupStrategy()]
  ])

  /**
   * 获取清理策略
   */
  static getStrategy(name: string): CleanupStrategy {
    const strategy = this.strategies.get(name.toLowerCase())
    if (!strategy) {
      throw new Error(`Unknown cleanup strategy: ${name}`)
    }
    return strategy
  }

  /**
   * 获取所有可用策略名称
   */
  static getAvailableStrategies(): string[] {
    return Array.from(this.strategies.keys())
  }

  /**
   * 注册自定义策略
   */
  static registerStrategy(name: string, strategy: CleanupStrategy): void {
    this.strategies.set(name.toLowerCase(), strategy)
  }
}
