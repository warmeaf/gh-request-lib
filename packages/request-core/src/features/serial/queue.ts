import { RequestConfig, Requestor, RequestError, RequestErrorType } from '../../interface'
import { SerialTask, SerialConfig, SerialQueueStats } from './types'
import { safeCloneData } from '../idempotent/utils'

/**
 * @description 串行队列类 - 管理单个串行队列的任务执行
 */
export class SerialQueue {
  private tasks: SerialTask[] = [] // 任务队列
  private isProcessing = false // 是否正在处理任务
  private stats: SerialQueueStats = {
    totalTasks: 0,
    pendingTasks: 0,
    completedTasks: 0,
    failedTasks: 0,
    processingTime: 0,
    isProcessing: false
  }
  private totalProcessingTime = 0 // 总处理时间，用于计算平均值
  private readonly serialKey: string // 队列标识
  private readonly config: SerialConfig // 队列配置
  private readonly requestor: Requestor // 请求执行器

  constructor(
    serialKey: string,
    requestor: Requestor,
    config: SerialConfig = {}
  ) {
    this.serialKey = serialKey
    this.requestor = requestor
    this.config = {
      maxQueueSize: config.maxQueueSize,
      timeout: config.timeout,
      onQueueFull: config.onQueueFull,
      onTaskTimeout: config.onTaskTimeout,
      debug: config.debug || false,
      ...config
    }

    if (this.config.debug) {
      console.log(`[SerialQueue] Created queue: ${serialKey}`)
    }
  }

  /**
   * 将任务加入队列
   */
  enqueue(config: RequestConfig): Promise<any> {
    return new Promise((resolve, reject) => {
      // 检查队列大小限制 (包括等待中的任务 + 正在处理的任务)
      const totalTasks = this.tasks.length + (this.isProcessing ? 1 : 0)

      if (typeof this.config.maxQueueSize === 'number' && totalTasks >= this.config.maxQueueSize) {
        const error = new RequestError('Serial queue is full', {
          type: RequestErrorType.VALIDATION_ERROR,
          code: 'SERIAL_QUEUE_FULL',
          context: {
            url: config.url,
            method: config.method,
            tag: config.tag,
            metadata: { serialKey: this.serialKey, queueSize: this.tasks.length }
          }
        })

        // 触发队列满回调
        if (this.config.onQueueFull) {
          this.config.onQueueFull(this.serialKey)
        }

        reject(error)
        return
      }

      // 创建任务
      const task: SerialTask = {
        id: this.generateTaskId(),
        config: safeCloneData(config, 'deep'), // 深拷贝配置避免被修改
        resolve,
        reject,
        createdAt: Date.now()
      }

      // 添加到队列
      this.tasks.push(task)
      this.stats.totalTasks++
      this.stats.pendingTasks++

      if (this.config.debug) {
        console.log(`[SerialQueue] Task enqueued: ${task.id} in queue: ${this.serialKey}`)
      }

      // 尝试处理队列
      this.processNext()
    })
  }

  /**
   * 处理队列中的下一个任务
   */
  private async processNext(): Promise<void> {
    // 如果正在处理或队列为空，直接返回
    if (this.isProcessing || this.tasks.length === 0) {
      return
    }

    // 获取下一个任务
    const task = this.tasks.shift()
    if (!task) {
      return
    }

    // 设置处理状态
    this.isProcessing = true
    this.stats.isProcessing = true

    const startTime = Date.now()

    if (this.config.debug) {
      console.log(`[SerialQueue] Processing task: ${task.id}`)
    }

    let requestStarted = false
    try {
      // 检查任务是否超时（基于创建时间）
      if (this.config.timeout && (startTime - task.createdAt) > this.config.timeout) {
        throw new RequestError('Task timeout in serial queue', {
          type: RequestErrorType.TIMEOUT_ERROR,
          code: 'SERIAL_TASK_TIMEOUT',
          context: {
            url: task.config.url,
            method: task.config.method,
            tag: task.config.tag,
            metadata: {
              serialKey: this.serialKey,
              taskId: task.id,
              waitTime: startTime - task.createdAt
            }
          }
        })
      }

      // 执行请求 - 这里可能会因为暂停而等待
      const result = await this.requestor.request(task.config)

      // 请求成功执行，标记为已开始
      requestStarted = true
      const endTime = Date.now()
      const executionTime = endTime - startTime

      // 更新统计信息
      this.stats.completedTasks++
      this.totalProcessingTime += executionTime
      this.stats.processingTime = Math.round(this.totalProcessingTime / this.stats.completedTasks)
      this.stats.lastProcessedAt = endTime

      if (this.config.debug) {
        console.log(`[SerialQueue] Task completed: ${task.id} in ${executionTime}ms`)
      }

      // 解析Promise
      task.resolve(result)

    } catch (error) {
      const endTime = Date.now()
      const executionTime = endTime - startTime

      // 标记请求已开始（即使失败了）
      requestStarted = true

      // 更新统计信息
      this.stats.failedTasks++
      this.totalProcessingTime += executionTime
      const totalTasks = this.stats.completedTasks + this.stats.failedTasks
      if (totalTasks > 0) {
        this.stats.processingTime = Math.round(this.totalProcessingTime / totalTasks)
      }
      this.stats.lastProcessedAt = endTime

      if (this.config.debug) {
        console.log(`[SerialQueue] Task failed: ${task.id} in ${executionTime}ms`, error)
      }

      // 处理任务超时回调
      if (error instanceof RequestError && error.type === RequestErrorType.TIMEOUT_ERROR) {
        if (this.config.onTaskTimeout) {
          this.config.onTaskTimeout(task)
        }
      }

      // 拒绝Promise
      task.reject(error)
    } finally {
      // 无论成功还是失败，只要请求开始了就减少待处理任务数
      if (requestStarted) {
        this.stats.pendingTasks--
      }
      // 重置处理状态
      this.isProcessing = false
      this.stats.isProcessing = false

      // 继续处理下一个任务
      setTimeout(() => this.processNext(), 0)
    }
  }

  /**
   * 清空队列
   */
  clear(): void {
    // 拒绝所有等待中的任务
    const cancelError = new RequestError('Serial queue cleared', {
      type: RequestErrorType.VALIDATION_ERROR,
      code: 'SERIAL_QUEUE_CLEARED',
      context: {
        metadata: { serialKey: this.serialKey }
      }
    })

    this.tasks.forEach(task => {
      task.reject(cancelError)
      if (this.config.debug) {
        console.log(`[SerialQueue] Task cancelled: ${task.id}`)
      }
    })

    // 重置状态
    this.tasks = []
    this.stats.pendingTasks = 0

    if (this.config.debug) {
      console.log(`[SerialQueue] Queue cleared: ${this.serialKey}`)
    }
  }

  /**
   * 获取队列统计信息
   */
  getStats(): SerialQueueStats {
    return { ...this.stats }
  }

  /**
   * 检查队列是否为空且未在处理
   */
  isEmpty(): boolean {
    return this.tasks.length === 0 && !this.isProcessing
  }

  /**
   * 获取队列中等待的任务数
   */
  getQueueLength(): number {
    return this.tasks.length
  }

  /**
   * 获取队列标识
   */
  getSerialKey(): string {
    return this.serialKey
  }

  /**
   * 生成任务唯一标识
   */
  private generateTaskId(): string {
    return `${this.serialKey}-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
  }

  /**
   * 销毁队列，清理资源
   */
  destroy(): void {
    this.clear()
    if (this.config.debug) {
      console.log(`[SerialQueue] Queue destroyed: ${this.serialKey}`)
    }
  }
}
