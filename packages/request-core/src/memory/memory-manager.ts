/**
 * @description 内存管理器 - 中央内存管理和监控系统
 * 
 * 负责：
 * - 内存使用监控和统计
 * - 自动垃圾回收和清理
 * - 内存阈值管理
 * - 资源泄漏检测
 */

export interface MemoryStats {
  // 总体内存统计
  totalAllocated: number        // 总分配内存 (bytes)
  totalReleased: number         // 总释放内存 (bytes)  
  currentUsage: number          // 当前使用内存 (bytes)
  peakUsage: number            // 峰值内存使用 (bytes)
  
  // 分类统计
  categories: Record<string, {
    allocated: number
    count: number
    avgSize: number
  }>
  
  // 垃圾回收统计
  gcRuns: number               // GC执行次数
  lastGcTime: number          // 最后一次GC时间
  totalGcTime: number         // 总GC时间
  
  // 泄漏检测
  suspiciousObjects: number    // 可疑对象数量
  leakWarnings: string[]      // 泄漏警告
}

export interface MemoryConfig {
  maxMemoryMB: number         // 最大内存限制 (MB)
  warningThresholdPercent: number  // 警告阈值百分比
  gcIntervalMs: number        // GC间隔时间 (ms)
  enableLeakDetection: boolean // 是否启用泄漏检测
  maxObjectAge: number        // 对象最大存活时间 (ms)
  enableDebug: boolean        // 是否启用调试模式
}

export interface ManagedResource {
  id: string
  category: string
  size: number
  createdAt: number
  lastAccessed: number
  data: any
  metadata?: Record<string, any>
}

export interface GarbageCollectionResult {
  itemsCollected: number
  memoryFreed: number
  duration: number
  categories: Record<string, number>
}

/**
 * @description 内存管理器主类
 */
export class MemoryManager {
  private config: MemoryConfig
  private resources = new Map<string, ManagedResource>()
  private stats: MemoryStats
  private gcTimer: NodeJS.Timeout | null = null
  private resourceIdCounter = 0

  constructor(config?: Partial<MemoryConfig>) {
    this.config = {
      maxMemoryMB: 100,
      warningThresholdPercent: 80,
      gcIntervalMs: 5 * 60 * 1000, // 5分钟
      enableLeakDetection: true,
      maxObjectAge: 30 * 60 * 1000, // 30分钟
      enableDebug: false,
      ...config
    }

    this.stats = this.createEmptyStats()
    this.startGarbageCollector()
  }

  /**
   * 创建空的统计对象
   */
  private createEmptyStats(): MemoryStats {
    return {
      totalAllocated: 0,
      totalReleased: 0,
      currentUsage: 0,
      peakUsage: 0,
      categories: {},
      gcRuns: 0,
      lastGcTime: 0,
      totalGcTime: 0,
      suspiciousObjects: 0,
      leakWarnings: []
    }
  }

  /**
   * 分配资源
   */
  allocate<T>(category: string, data: T, metadata?: Record<string, any>): string {
    const id = this.generateResourceId()
    const size = this.estimateObjectSize(data)
    const now = Date.now()

    const resource: ManagedResource = {
      id,
      category,
      size,
      createdAt: now,
      lastAccessed: now,
      data,
      metadata
    }

    this.resources.set(id, resource)
    this.updateAllocationStats(category, size)

    // 检查内存限制
    this.checkMemoryLimits()

    if (this.config.enableDebug) {
      console.log(`[MemoryManager] Allocated ${size} bytes for ${category}, total: ${this.stats.currentUsage}`)
    }

    return id
  }

  /**
   * 释放资源
   */
  deallocate(id: string): boolean {
    const resource = this.resources.get(id)
    if (!resource) return false

    this.resources.delete(id)
    this.updateDeallocationStats(resource.category, resource.size)

    if (this.config.enableDebug) {
      console.log(`[MemoryManager] Deallocated ${resource.size} bytes from ${resource.category}`)
    }

    return true
  }

  /**
   * 获取资源
   */
  getResource<T>(id: string): T | null {
    const resource = this.resources.get(id)
    if (!resource) return null

    resource.lastAccessed = Date.now()
    return resource.data as T
  }

  /**
   * 更新资源访问时间
   */
  touchResource(id: string): boolean {
    const resource = this.resources.get(id)
    if (!resource) return false

    resource.lastAccessed = Date.now()
    return true
  }

  /**
   * 强制垃圾回收
   */
  forceGarbageCollection(): GarbageCollectionResult {
    const startTime = Date.now()
    const initialCount = this.resources.size
    let memoryFreed = 0
    const categories: Record<string, number> = {}

    const now = Date.now()
    const maxAge = this.config.maxObjectAge
    const resourcesToDelete: string[] = []

    // 查找过期资源
    for (const [id, resource] of this.resources) {
      const age = now - resource.lastAccessed
      if (age > maxAge) {
        resourcesToDelete.push(id)
        memoryFreed += resource.size
        categories[resource.category] = (categories[resource.category] || 0) + 1
      }
    }

    // 删除过期资源
    resourcesToDelete.forEach(id => {
      this.resources.delete(id)
    })

    // 更新统计
    this.stats.totalReleased += memoryFreed
    this.stats.currentUsage -= memoryFreed
    this.stats.gcRuns++
    this.stats.lastGcTime = now
    this.stats.totalGcTime += Date.now() - startTime

    const result: GarbageCollectionResult = {
      itemsCollected: resourcesToDelete.length,
      memoryFreed,
      duration: Date.now() - startTime,
      categories
    }

    if (this.config.enableDebug || resourcesToDelete.length > 0) {
      console.log(`[MemoryManager] GC completed: ${result.itemsCollected} items, ${result.memoryFreed} bytes freed`)
    }

    return result
  }

  /**
   * 启动垃圾收集器
   */
  private startGarbageCollector(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
    }

    this.gcTimer = setInterval(() => {
      this.forceGarbageCollection()
      this.detectMemoryLeaks()
    }, this.config.gcIntervalMs)
  }

  /**
   * 检测内存泄漏
   */
  private detectMemoryLeaks(): void {
    if (!this.config.enableLeakDetection) return

    const now = Date.now()
    const suspiciousAge = this.config.maxObjectAge * 2 // 超过2倍最大年龄认为可疑
    let suspiciousCount = 0
    const leakWarnings: string[] = []

    for (const [id, resource] of this.resources) {
      const age = now - resource.createdAt
      const lastAccessAge = now - resource.lastAccessed

      if (age > suspiciousAge && lastAccessAge > suspiciousAge) {
        suspiciousCount++
        leakWarnings.push(
          `Suspicious ${resource.category} object ${id} (age: ${Math.round(age / 1000)}s, last access: ${Math.round(lastAccessAge / 1000)}s)`
        )
      }
    }

    this.stats.suspiciousObjects = suspiciousCount
    this.stats.leakWarnings = leakWarnings

    if (suspiciousCount > 0) {
      console.warn(`[MemoryManager] Detected ${suspiciousCount} suspicious objects that may indicate memory leaks`)
      if (this.config.enableDebug) {
        leakWarnings.forEach(warning => console.warn(`  - ${warning}`))
      }
    }
  }

  /**
   * 检查内存限制
   */
  private checkMemoryLimits(): void {
    const maxBytes = this.config.maxMemoryMB * 1024 * 1024
    const warningBytes = maxBytes * (this.config.warningThresholdPercent / 100)

    if (this.stats.currentUsage >= maxBytes) {
      console.error(`[MemoryManager] Memory limit exceeded: ${this.stats.currentUsage} bytes (limit: ${maxBytes})`)
      // 强制执行垃圾回收
      this.forceGarbageCollection()
    } else if (this.stats.currentUsage >= warningBytes) {
      console.warn(`[MemoryManager] Memory usage warning: ${this.stats.currentUsage} bytes (${Math.round((this.stats.currentUsage / maxBytes) * 100)}% of limit)`)
    }
  }

  /**
   * 估算对象大小
   */
  private estimateObjectSize(obj: any): number {
    if (obj === null || obj === undefined) return 0
    
    const type = typeof obj
    
    switch (type) {
      case 'boolean':
        return 4
      case 'number':
        return 8
      case 'string':
        return obj.length * 2 + 40 // Unicode字符 + 对象开销
      case 'object':
        return this.estimateObjectSizeRecursive(obj, new WeakSet())
      default:
        return 32 // 默认对象开销
    }
  }

  /**
   * 递归估算对象大小
   */
  private estimateObjectSizeRecursive(obj: any, visited: WeakSet<object>): number {
    if (visited.has(obj)) return 0
    visited.add(obj)

    let size = 32 // 基础对象开销

    if (Array.isArray(obj)) {
      size += obj.length * 8 // 数组索引开销
      for (const item of obj) {
        size += this.estimateObjectSize(item)
      }
    } else if (obj instanceof Date) {
      size += 8
    } else if (obj instanceof RegExp) {
      size += obj.source.length * 2 + 40
    } else if (obj instanceof Map) {
      size += obj.size * 32 // Map条目开销
      for (const [key, value] of obj) {
        size += this.estimateObjectSize(key) + this.estimateObjectSize(value)
      }
    } else if (obj instanceof Set) {
      size += obj.size * 16
      for (const value of obj) {
        size += this.estimateObjectSize(value)
      }
    } else {
      // 普通对象
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          size += key.length * 2 + this.estimateObjectSize(obj[key])
        }
      }
    }

    return size
  }

  /**
   * 更新分配统计
   */
  private updateAllocationStats(category: string, size: number): void {
    this.stats.totalAllocated += size
    this.stats.currentUsage += size
    this.stats.peakUsage = Math.max(this.stats.peakUsage, this.stats.currentUsage)

    if (!this.stats.categories[category]) {
      this.stats.categories[category] = { allocated: 0, count: 0, avgSize: 0 }
    }

    const categoryStats = this.stats.categories[category]
    categoryStats.allocated += size
    categoryStats.count += 1
    categoryStats.avgSize = categoryStats.allocated / categoryStats.count
  }

  /**
   * 更新释放统计
   */
  private updateDeallocationStats(category: string, size: number): void {
    this.stats.totalReleased += size
    this.stats.currentUsage -= size

    const categoryStats = this.stats.categories[category]
    if (categoryStats) {
      categoryStats.count -= 1
      if (categoryStats.count <= 0) {
        delete this.stats.categories[category]
      } else {
        categoryStats.avgSize = categoryStats.allocated / categoryStats.count
      }
    }
  }

  /**
   * 生成资源ID
   */
  private generateResourceId(): string {
    return `resource_${++this.resourceIdCounter}_${Date.now()}`
  }

  /**
   * 获取内存统计
   */
  getStats(): MemoryStats {
    return JSON.parse(JSON.stringify(this.stats))
  }

  /**
   * 获取资源列表
   */
  getResources(category?: string): ManagedResource[] {
    const resources = Array.from(this.resources.values())
    if (category) {
      return resources.filter(r => r.category === category)
    }
    return resources
  }

  /**
   * 清理特定类别的资源
   */
  clearCategory(category: string): number {
    let cleared = 0
    let memoryFreed = 0

    for (const [id, resource] of this.resources) {
      if (resource.category === category) {
        this.resources.delete(id)
        memoryFreed += resource.size
        cleared++
      }
    }

    this.stats.totalReleased += memoryFreed
    this.stats.currentUsage -= memoryFreed

    if (cleared > 0) {
      console.log(`[MemoryManager] Cleared ${cleared} items from category '${category}', freed ${memoryFreed} bytes`)
    }

    return cleared
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.stats = this.createEmptyStats()
    console.log('[MemoryManager] Statistics reset')
  }

  /**
   * 销毁内存管理器
   */
  destroy(): void {
    if (this.gcTimer) {
      clearInterval(this.gcTimer)
      this.gcTimer = null
    }

    const resourceCount = this.resources.size
    const memoryReleased = this.stats.currentUsage

    this.resources.clear()
    this.stats.currentUsage = 0
    this.stats.totalReleased += memoryReleased

    console.log(`[MemoryManager] Destroyed: ${resourceCount} resources, ${memoryReleased} bytes released`)
  }

  /**
   * 获取内存使用报告
   */
  getMemoryReport(): string {
    const stats = this.getStats()
    const maxBytes = this.config.maxMemoryMB * 1024 * 1024
    const usagePercent = (stats.currentUsage / maxBytes) * 100

    const report = [
      '=== Memory Usage Report ===',
      `Current Usage: ${this.formatBytes(stats.currentUsage)} (${usagePercent.toFixed(1)}% of ${this.config.maxMemoryMB}MB limit)`,
      `Peak Usage: ${this.formatBytes(stats.peakUsage)}`,
      `Total Allocated: ${this.formatBytes(stats.totalAllocated)}`,
      `Total Released: ${this.formatBytes(stats.totalReleased)}`,
      `Active Resources: ${this.resources.size}`,
      `GC Runs: ${stats.gcRuns} (total time: ${stats.totalGcTime}ms)`,
      '',
      '=== Categories ===',
      ...Object.entries(stats.categories).map(([category, data]) => 
        `  ${category}: ${data.count} items, ${this.formatBytes(data.allocated)} (avg: ${this.formatBytes(data.avgSize)})`
      ),
    ]

    if (stats.suspiciousObjects > 0) {
      report.push('', '=== Memory Leak Warnings ===')
      report.push(`Suspicious Objects: ${stats.suspiciousObjects}`)
      stats.leakWarnings.forEach(warning => {
        report.push(`  - ${warning}`)
      })
    }

    return report.join('\n')
  }

  /**
   * 格式化字节数
   */
  private formatBytes(bytes: number): string {
    if (bytes < 1024) return `${bytes}B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)}MB`
  }
}
