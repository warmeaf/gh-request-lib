import { Requestor } from '../../interface'
import { SerialQueue } from './queue'
import { SerialConfig, SerialManagerConfig, SerialManagerStats } from './types'

/**
 * @description 串行请求管理器 - 管理多个串行队列
 */
export class SerialRequestManager {
  private queues = new Map<string, SerialQueue>() // 队列映射表
  private readonly config: SerialManagerConfig // 管理器配置
  private readonly requestor: Requestor // 请求执行器
  private cleanupTimer?: NodeJS.Timeout // 清理定时器

  constructor(requestor: Requestor, config: SerialManagerConfig = {}) {
    this.requestor = requestor
    this.config = {
      defaultQueueConfig: config.defaultQueueConfig || {},
      maxQueues: config.maxQueues,
      cleanupInterval: config.cleanupInterval || 30000, // 默认30秒
      autoCleanup: config.autoCleanup !== false, // 默认启用自动清理
      debug: config.debug || false,
      ...config
    }

    // 启动自动清理
    if (this.config.autoCleanup && this.config.cleanupInterval && this.config.cleanupInterval > 0) {
      this.startAutoCleanup()
    }

    if (this.config.debug) {
      console.log('[SerialRequestManager] Manager initialized')
    }
  }

  /**
   * 获取或创建指定的串行队列
   */
  getQueue(serialKey: string, queueConfig?: SerialConfig): SerialQueue {
    let queue = this.queues.get(serialKey)

    if (!queue) {
      // 检查队列数量限制
      if (typeof this.config.maxQueues === 'number' && this.queues.size >= this.config.maxQueues) {
        throw new Error(`Maximum number of serial queues (${this.config.maxQueues}) reached`)
      }

      // 合并配置
      const finalConfig: SerialConfig = {
        ...this.config.defaultQueueConfig,
        ...queueConfig,
        debug: queueConfig?.debug ?? this.config.debug
      }

      // 创建新队列
      queue = new SerialQueue(serialKey, this.requestor, finalConfig)
      this.queues.set(serialKey, queue)

      if (this.config.debug) {
        console.log(`[SerialRequestManager] Created new queue: ${serialKey}`)
      }
    }

    return queue
  }

  /**
   * 将请求加入指定的串行队列
   */
  async enqueueRequest<T = any>(serialKey: string, config: any, queueConfig?: SerialConfig): Promise<T> {
    const queue = this.getQueue(serialKey, queueConfig)
    return queue.enqueue(config)
  }

  /**
   * 清空指定队列
   */
  clearQueue(serialKey: string): boolean {
    const queue = this.queues.get(serialKey)
    if (queue) {
      queue.clear()
      if (this.config.debug) {
        console.log(`[SerialRequestManager] Cleared queue: ${serialKey}`)
      }
      return true
    }
    return false
  }

  /**
   * 移除指定队列
   */
  removeQueue(serialKey: string): boolean {
    const queue = this.queues.get(serialKey)
    if (queue) {
      queue.destroy()
      this.queues.delete(serialKey)
      if (this.config.debug) {
        console.log(`[SerialRequestManager] Removed queue: ${serialKey}`)
      }
      return true
    }
    return false
  }

  /**
   * 清空所有队列
   */
  clearAllQueues(): void {
    this.queues.forEach((queue, serialKey) => {
      queue.clear()
      if (this.config.debug) {
        console.log(`[SerialRequestManager] Cleared queue: ${serialKey}`)
      }
    })
  }

  /**
   * 移除所有队列
   */
  removeAllQueues(): void {
    this.queues.forEach((queue, serialKey) => {
      queue.destroy()
      if (this.config.debug) {
        console.log(`[SerialRequestManager] Destroyed queue: ${serialKey}`)
      }
    })
    this.queues.clear()
  }

  /**
   * 获取队列列表
   */
  getQueueKeys(): string[] {
    return Array.from(this.queues.keys())
  }

  /**
   * 检查队列是否存在
   */
  hasQueue(serialKey: string): boolean {
    return this.queues.has(serialKey)
  }

  /**
   * 获取指定队列的统计信息
   */
  getQueueStats(serialKey: string) {
    const queue = this.queues.get(serialKey)
    return queue ? queue.getStats() : null
  }

  /**
   * 获取管理器统计信息
   */
  getStats(): SerialManagerStats {
    const queues: Record<string, any> = {}
    let totalTasks = 0
    let totalPendingTasks = 0
    let totalCompletedTasks = 0
    let totalFailedTasks = 0
    let totalProcessingTime = 0
    let activeQueues = 0

    this.queues.forEach((queue, serialKey) => {
      const stats = queue.getStats()
      queues[serialKey] = stats

      totalTasks += stats.totalTasks
      totalPendingTasks += stats.pendingTasks
      totalCompletedTasks += stats.completedTasks
      totalFailedTasks += stats.failedTasks
      totalProcessingTime += stats.processingTime * (stats.completedTasks + stats.failedTasks)

      // 如果队列有任务或正在处理，则认为是活跃的
      if (!queue.isEmpty() || stats.isProcessing) {
        activeQueues++
      }
    })

    const completedAndFailedTasks = totalCompletedTasks + totalFailedTasks
    const avgProcessingTime = completedAndFailedTasks > 0 ? totalProcessingTime / completedAndFailedTasks : 0

    return {
      totalQueues: this.queues.size,
      activeQueues,
      totalTasks,
      totalPendingTasks,
      totalCompletedTasks,
      totalFailedTasks,
      avgProcessingTime: Math.round(avgProcessingTime),
      queues
    }
  }

  /**
   * 启动自动清理空队列
   */
  private startAutoCleanup(): void {
    if (this.cleanupTimer) {
      return
    }

    this.cleanupTimer = setInterval(() => {
      this.performCleanup()
    }, this.config.cleanupInterval)

    if (this.config.debug) {
      console.log(`[SerialRequestManager] Auto cleanup started (interval: ${this.config.cleanupInterval}ms)`)
    }
  }

  /**
   * 停止自动清理
   */
  private stopAutoCleanup(): void {
    if (this.cleanupTimer) {
      clearInterval(this.cleanupTimer)
      this.cleanupTimer = undefined
      if (this.config.debug) {
        console.log('[SerialRequestManager] Auto cleanup stopped')
      }
    }
  }

  /**
   * 执行清理操作，移除空队列
   */
  private performCleanup(): void {
    const emptyQueues: string[] = []

    this.queues.forEach((queue, serialKey) => {
      if (queue.isEmpty()) {
        emptyQueues.push(serialKey)
      }
    })

    emptyQueues.forEach(serialKey => {
      this.removeQueue(serialKey)
    })

    if (this.config.debug && emptyQueues.length > 0) {
      console.log(`[SerialRequestManager] Cleaned up ${emptyQueues.length} empty queues`)
    }
  }

  /**
   * 手动触发清理
   */
  cleanup(): void {
    this.performCleanup()
  }

  /**
   * 销毁管理器，清理所有资源
   */
  destroy(): void {
    // 停止自动清理
    this.stopAutoCleanup()

    // 销毁所有队列
    this.removeAllQueues()

    if (this.config.debug) {
      console.log('[SerialRequestManager] Manager destroyed')
    }
  }
}
