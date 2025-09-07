import { RequestConfig, RequestError } from '../interface'

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

  constructor(options?: {
    maxRecords?: number
    sampleRate?: number
  }) {
    this.maxRecords = options?.maxRecords ?? 1000
    this.sampleRate = options?.sampleRate ?? 10 // 每10次请求采样一次
    
    this.stats = this.createEmptyStats()
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
   * 添加性能记录（循环缓冲区）
   */
  private addRecord(record: PerformanceRecord): void {
    this.records.push(record)
    if (this.records.length > this.maxRecords) {
      this.records.shift() // 移除最老的记录
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
    return [...this.records]
  }

  /**
   * 获取最近N条记录
   */
  getRecentRecords(count: number = 10): PerformanceRecord[] {
    return this.records.slice(-count)
  }

  /**
   * 重置统计信息
   */
  reset(): void {
    this.stats = this.createEmptyStats()
    this.records = []
    this.sampleCounter = 0
  }

  /**
   * 获取内存使用情况
   */
  getMemoryUsage(): {
    recordsCount: number
    estimatedSize: number // bytes
  } {
    const avgRecordSize = 200 // 估算每个记录约200字节
    return {
      recordsCount: this.records.length,
      estimatedSize: this.records.length * avgRecordSize
    }
  }

  /**
   * 清理过期记录
   */
  cleanup(olderThanMs: number = 24 * 60 * 60 * 1000): number {
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
