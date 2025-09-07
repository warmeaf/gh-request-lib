import { RequestConfig, RequestError } from '../interface'
import { ResourceTracker, PerformanceResourceTracker } from '../memory/resource-tracker'
import { MemoryManager } from '../memory/memory-manager'
import { CleanupStrategyFactory } from '../memory/cleanup-strategies'

/**
 * @description 性能统计信息
 */
export interface PerformanceStats {
  totalRequests: number
  successfulRequests: number
  failedRequests: number
  averageResponseTime: number
  totalResponseTime: number
  minResponseTime: number
  maxResponseTime: number
  requestsByMethod: Record<string, number>
  errorsByType: Record<string, number>
  lastResetTime: number
}

/**
 * @description 性能记录
 */
interface PerformanceRecord {
  method: string
  duration: number
  success: boolean
  errorType?: string
  timestamp: number
}

/**
 * @description 性能监控管理器
 * 
 * 负责请求性能数据的收集、统计和管理。
 * 使用采样和循环缓冲区来控制内存使用。
 */
export class PerformanceMonitor {
  private stats: PerformanceStats
  private records: PerformanceRecord[] = []
  private readonly maxRecords: number
  private readonly sampleRate: number
  private sampleCounter = 0

  // 内存管理组件
  private memoryManager: MemoryManager | null = null
  private resourceTracker: PerformanceResourceTracker | null = null
  private memoryEnabled: boolean = false

  constructor(options?: {
    maxRecords?: number
    sampleRate?: number
    enableMemoryManagement?: boolean
    memoryConfig?: {
      maxMemoryMB?: number
      gcIntervalMs?: number
    }
  }) {
    this.maxRecords = options?.maxRecords ?? 1000
    this.sampleRate = options?.sampleRate ?? 10 // 每10次请求采样一次
    this.memoryEnabled = options?.enableMemoryManagement ?? false
    
    this.stats = this.createEmptyStats()

    // 初始化内存管理
    if (this.memoryEnabled) {
      this.initMemoryManagement(options?.memoryConfig)
    }
  }

  /**
   * 初始化内存管理
   */
  private initMemoryManagement(config?: { maxMemoryMB?: number; gcIntervalMs?: number }): void {
    this.memoryManager = new MemoryManager({
      maxMemoryMB: config?.maxMemoryMB ?? 10,
      gcIntervalMs: config?.gcIntervalMs ?? 5 * 60 * 1000,
      enableLeakDetection: true,
      enableDebug: false
    })

    this.resourceTracker = new PerformanceResourceTracker(
      this.memoryManager,
      this.maxRecords
    )
  }

  /**
   * 创建空的统计对象
   */
  private createEmptyStats(): PerformanceStats {
    return {
      totalRequests: 0,
      successfulRequests: 0,
      failedRequests: 0,
      averageResponseTime: 0,
      totalResponseTime: 0,
      minResponseTime: Infinity,
      maxResponseTime: 0,
      requestsByMethod: {},
      errorsByType: {},
      lastResetTime: Date.now()
    }
  }

  /**
   * 记录请求开始
   */
  recordRequestStart(config: RequestConfig): string {
    const requestId = this.generateRequestId()
    this.stats.totalRequests++
    return requestId
  }

  /**
   * 记录请求完成
   */
  recordRequestEnd(
    config: RequestConfig, 
    startTime: number, 
    success: boolean, 
    error?: RequestError
  ): void {
    const duration = Date.now() - startTime
    const method = config.method.toUpperCase()

    // 更新基础统计
    if (success) {
      this.stats.successfulRequests++
    } else {
      this.stats.failedRequests++
      if (error) {
        this.stats.errorsByType[error.type] = (this.stats.errorsByType[error.type] || 0) + 1
      }
    }

    // 更新响应时间统计
    this.updateResponseTimeStats(duration)
    
    // 更新方法统计
    this.stats.requestsByMethod[method] = (this.stats.requestsByMethod[method] || 0) + 1

    // 采样记录详细数据
    if (this.shouldSample()) {
      this.addRecord({
        method,
        duration,
        success,
        errorType: error?.type,
        timestamp: Date.now()
      })
    }
  }

  /**
   * 更新响应时间统计
   */
  private updateResponseTimeStats(duration: number): void {
    this.stats.totalResponseTime += duration
    this.stats.minResponseTime = Math.min(this.stats.minResponseTime, duration)
    this.stats.maxResponseTime = Math.max(this.stats.maxResponseTime, duration)
    this.stats.averageResponseTime = this.stats.totalResponseTime / this.stats.totalRequests
  }

  /**
   * 是否应该采样记录
   */
  private shouldSample(): boolean {
    return (++this.sampleCounter) % this.sampleRate === 0
  }

  /**
   * 添加性能记录（使用内存管理或循环缓冲区）
   */
  private addRecord(record: PerformanceRecord): void {
    if (this.memoryEnabled && this.resourceTracker) {
      // 使用内存管理系统存储记录
      this.resourceTracker.create(record, {
        type: 'performance_record',
        method: record.method,
        success: record.success
      })
    } else {
      // 使用传统的循环缓冲区
      this.records.push(record)
      if (this.records.length > this.maxRecords) {
        this.records.shift() // 移除最老的记录
      }
    }
  }

  /**
   * 生成请求ID
   */
  private generateRequestId(): string {
    return Math.random().toString(36).substring(2, 15)
  }

  /**
   * 获取性能统计信息
   */
  getStats(): PerformanceStats {
    return {
      ...this.stats,
      averageResponseTime: Math.round(this.stats.averageResponseTime * 100) / 100,
      minResponseTime: this.stats.minResponseTime === Infinity ? 0 : 
        Math.round(this.stats.minResponseTime * 100) / 100,
      maxResponseTime: Math.round(this.stats.maxResponseTime * 100) / 100
    }
  }

  /**
   * 获取详细记录（用于分析）
   */
  getRecords(): PerformanceRecord[] {
    if (this.memoryEnabled && this.resourceTracker) {
      // 从内存管理系统获取记录
      const trackedResources = this.resourceTracker.getAll()
      return trackedResources
        .sort((a, b) => a.createdAt - b.createdAt)
        .map(resource => resource.data)
    } else {
      // 从传统缓冲区获取记录
      return [...this.records]
    }
  }

  /**
   * 获取最近N条记录
   */
  getRecentRecords(count: number = 10): PerformanceRecord[] {
    const allRecords = this.getRecords()
    return allRecords.slice(-count)
  }

  /**
   * 重置统计信息
   */
  reset(): void {
    this.stats = this.createEmptyStats()
    this.sampleCounter = 0

    if (this.memoryEnabled && this.resourceTracker) {
      // 清理内存管理系统中的记录
      this.resourceTracker.clear()
    } else {
      // 清理传统缓冲区
      this.records = []
    }
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): {
    recordsCount: number
    estimatedSize: number // bytes
    memoryManagerStats?: any
    resourceTrackerStats?: any
  } {
    if (this.memoryEnabled && this.resourceTracker && this.memoryManager) {
      const trackerStats = this.resourceTracker.getStats()
      const memoryStats = this.memoryManager.getStats()
      
      return {
        recordsCount: trackerStats.totalItems,
        estimatedSize: trackerStats.totalMemoryMB * 1024 * 1024,
        memoryManagerStats: memoryStats,
        resourceTrackerStats: trackerStats
      }
    } else {
      const avgRecordSize = 200 // 估算每个记录约200字节
      return {
        recordsCount: this.records.length,
        estimatedSize: this.records.length * avgRecordSize
      }
    }
  }

  /**
   * 清理过期记录
   */
  cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): number {
    if (this.memoryEnabled && this.resourceTracker) {
      // 使用内存管理系统的清理功能
      return this.resourceTracker.cleanup()
    } else {
      // 传统清理方法
      const cutoffTime = Date.now() - olderThanMs
      const initialLength = this.records.length
      
      this.records = this.records.filter(record => record.timestamp > cutoffTime)
      
      const removed = initialLength - this.records.length
      if (removed > 0) {
        console.log(`[PerformanceMonitor] Cleaned up ${removed} expired records`)
      }
      
      return removed
    }
  }

  /**
   * 强制垃圾回收
   */
  forceGarbageCollection(): any {
    if (this.memoryEnabled && this.memoryManager) {
      return this.memoryManager.forceGarbageCollection()
    } else {
      // 传统方式：清理一半最老的记录
      const halfLength = Math.floor(this.records.length / 2)
      const removed = this.records.splice(0, halfLength)
      
      return {
        itemsCollected: removed.length,
        memoryFreed: removed.length * 200, // 估算
        strategy: 'traditional',
        executionTime: 0
      }
    }
  }

  /**
   * 获取内存报告
   */
  getMemoryReport(): string {
    if (this.memoryEnabled && this.memoryManager) {
      return this.memoryManager.getMemoryReport()
    } else {
      const usage = this.getMemoryUsage()
      return [
        '=== Performance Monitor Memory Usage ===',
        `Records: ${usage.recordsCount}`,
        `Estimated Size: ${this.formatBytes(usage.estimatedSize)}`,
        `Max Records: ${this.maxRecords}`,
        `Sample Rate: 1/${this.sampleRate}`,
        '',
        'Note: Memory management is disabled. Enable it for detailed reporting.'
      ].join('\n')
    }
  }

  /**
   * 启用内存管理
   */
  enableMemoryManagement(config?: { maxMemoryMB?: number; gcIntervalMs?: number }): void {
    if (!this.memoryEnabled) {
      this.memoryEnabled = true
      this.initMemoryManagement(config)
      
      // 迁移现有记录到内存管理系统
      if (this.records.length > 0 && this.resourceTracker) {
        for (const record of this.records) {
          this.resourceTracker.create(record, {
            type: 'migrated_record',
            method: record.method,
            success: record.success
          })
        }
        this.records = [] // 清空传统缓冲区
        console.log(`[PerformanceMonitor] Migrated ${this.records.length} records to memory management system`)
      }
    }
  }

  /**
   * 禁用内存管理
   */
  disableMemoryManagement(): void {
    if (this.memoryEnabled) {
      // 迁移记录回传统缓冲区
      if (this.resourceTracker) {
        const records = this.resourceTracker.getAll().map(r => r.data)
        this.records = records.slice(-this.maxRecords) // 只保留最近的记录
      }

      // 销毁内存管理组件
      if (this.memoryManager) {
        this.memoryManager.destroy()
        this.memoryManager = null
      }
      
      this.resourceTracker = null
      this.memoryEnabled = false
      
      console.log('[PerformanceMonitor] Memory management disabled, migrated back to traditional storage')
    }
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
