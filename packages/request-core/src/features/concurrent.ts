import { Requestor, RequestConfig, RequestError } from '../interface'

/**
 * @description 并发请求配置
 */
export interface ConcurrentConfig {
  maxConcurrency?: number // 最大并发数，默认不限制
  failFast?: boolean // 是否快速失败，默认为false
  timeout?: number // 整体超时时间
  retryOnError?: boolean // 发生错误时是否重试，默认false
}

/**
 * @description 并发请求结果
 */
export interface ConcurrentResult<T> {
  success: boolean
  data?: T
  error?: Error | RequestError | unknown
  config: RequestConfig
  index: number
  duration?: number // 请求耗时
  retryCount?: number // 重试次数
}

/**
 * @description 并发性能统计
 */
export interface ConcurrentStats {
  total: number
  completed: number
  successful: number
  failed: number
  averageDuration: number
  maxConcurrencyUsed: number
}

/**
 * @description 高效信号量实现 - 带超时和清理机制
 */
class Semaphore {
  private permits: number
  private waitingQueue: Array<{
    resolve: () => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout | null
    timestamp: number
  }> = []
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly maxWaitTime = 30000 // 30秒最大等待时间
  
  constructor(permits: number) {
    this.permits = permits
    // 启动定期清理，防止内存泄漏
    this.startPeriodicCleanup()
  }
  
  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return Promise.resolve()
    }
    
    return new Promise<void>((resolve, reject) => {
      const timestamp = Date.now()
      
      // 设置超时
      const timeout = setTimeout(() => {
        this.removeFromQueue(item)
        reject(new Error(`Semaphore acquire timeout after ${this.maxWaitTime}ms`))
      }, this.maxWaitTime)
      
      const item = { resolve, reject, timeout, timestamp }
      this.waitingQueue.push(item)
    })
  }
  
  release(): void {
    this.permits++
    const nextItem = this.waitingQueue.shift()
    if (nextItem) {
      this.permits--
      
      // 清理超时
      if (nextItem.timeout) {
        clearTimeout(nextItem.timeout)
      }
      
      nextItem.resolve()
    }
  }
  
  private removeFromQueue(targetItem: typeof this.waitingQueue[0]): void {
    const index = this.waitingQueue.indexOf(targetItem)
    if (index > -1) {
      this.waitingQueue.splice(index, 1)
    }
  }
  
  private startPeriodicCleanup(): void {
    // 每5分钟清理一次过期的等待项
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredWaiters()
    }, 5 * 60 * 1000)
  }
  
  private cleanupExpiredWaiters(): void {
    const now = Date.now()
    const expiredItems = this.waitingQueue.filter(item => 
      now - item.timestamp > this.maxWaitTime
    )
    
    expiredItems.forEach(item => {
      this.removeFromQueue(item)
      if (item.timeout) {
        clearTimeout(item.timeout)
      }
      item.reject(new Error('Semaphore acquire expired during cleanup'))
    })
    
    if (expiredItems.length > 0) {
      console.warn(`[Semaphore] Cleaned up ${expiredItems.length} expired waiters`)
    }
  }
  
  available(): number {
    return this.permits
  }
  
  waitingCount(): number {
    return this.waitingQueue.length
  }
  
  /**
   * 销毁信号量，清理所有资源
   */
  destroy(): void {
    // 清理定时器
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    
    // 拒绝所有等待中的请求
    this.waitingQueue.forEach(item => {
      if (item.timeout) {
        clearTimeout(item.timeout)
      }
      item.reject(new Error('Semaphore destroyed'))
    })
    
    this.waitingQueue = []
    this.permits = 0
  }
}

/**
 * @description 高性能并发请求功能 - 使用信号量机制
 */
export class ConcurrentFeature {
  private stats: ConcurrentStats = {
    total: 0,
    completed: 0,
    successful: 0,
    failed: 0,
    averageDuration: 0,
    maxConcurrencyUsed: 0
  }
  private durations: number[] = []
  private activeSemaphores: Set<Semaphore> = new Set()
  
  constructor(private requestor: Requestor) {}

  /**
   * 执行并发请求
   * @param configs 请求配置数组
   * @param concurrentConfig 并发配置
   * @returns 并发请求结果数组
   */
  async requestConcurrent<T>(
    configs: RequestConfig[],
    concurrentConfig: ConcurrentConfig = {}
  ): Promise<ConcurrentResult<T>[]> {
    const { maxConcurrency, failFast = false, timeout } = concurrentConfig

    if (maxConcurrency && maxConcurrency > 0) {
      return this.requestWithConcurrencyLimit<T>(configs, maxConcurrency, failFast, timeout)
    }

    return this.requestAllConcurrent<T>(configs, failFast, timeout)
  }

  /**
   * 无限制并发执行所有请求 - 优化版本
   */
  private async requestAllConcurrent<T>(
    configs: RequestConfig[],
    failFast: boolean,
    timeout?: number
  ): Promise<ConcurrentResult<T>[]> {
    // 重置统计
    this.resetStats(configs.length)
    
    const results: Array<ConcurrentResult<T> | undefined> = new Array(configs.length)
    const startTime = Date.now()
    
    const tasks = configs.map(async (config, index) => {
      const requestStart = Date.now()
      
      try {
        console.log(`[Concurrent] Starting unlimited request ${index + 1}: ${config.url}`)
        
        const data = await this.requestor.request<T>(config)
        const duration = Date.now() - requestStart
        
        results[index] = {
          success: true,
          data,
          config,
          index,
          duration,
          retryCount: 0
        }
        
        this.updateSuccessStats(duration)
        
      } catch (error) {
        const duration = Date.now() - requestStart
        
        console.error(`[Concurrent] Request ${index + 1} failed: ${config.url}`, error)
        
        if (failFast) {
          throw error
        }
        
        results[index] = {
          success: false,
          error,
          config,
          index,
          duration,
          retryCount: 0
        }
        
        this.updateFailureStats(duration)
      }
    })

    try {
      if (timeout && timeout > 0) {
        if (failFast) {
          await this.awaitWithTimeout(Promise.all(tasks), timeout)
        } else {
          await this.awaitWithTimeout(Promise.allSettled(tasks), timeout)
        }
      } else {
        if (failFast) {
          await Promise.all(tasks)
        } else {
          await Promise.allSettled(tasks)
        }
      }
    } catch (error) {
      if (failFast) {
        throw error
      }
      // 即使超时，也返回已完成的结果
    }
    
    // 更新最终统计
    this.stats.maxConcurrencyUsed = configs.length // 无限制并发
    this.updateFinalStats(Date.now() - startTime, configs.length)

    const denseResults = results.filter((r): r is ConcurrentResult<T> => Boolean(r))
    return denseResults
  }

  /**
   * 高效的并发数量控制 - 使用信号量机制
   */
  private async requestWithConcurrencyLimit<T>(
    configs: RequestConfig[],
    maxConcurrency: number,
    failFast: boolean,
    timeout?: number
  ): Promise<ConcurrentResult<T>[]> {
    // 参数校验
    if (maxConcurrency <= 0) {
      throw new RequestError('Max concurrency must be positive')
    }

    // 重置统计信息
    this.resetStats(configs.length)
    
    const semaphore = new Semaphore(maxConcurrency)
    this.activeSemaphores.add(semaphore) // 追踪信号量
    const results: Array<ConcurrentResult<T> | undefined> = new Array(configs.length)
    const startTime = Date.now()
    
    // 创建所有任务，但不立即执行
    const tasks = configs.map((config, index) => 
      this.executeRequestWithSemaphore<T>(
        config, 
        index, 
        semaphore, 
        results, 
        failFast
      )
    )

    try {
      if (timeout && timeout > 0) {
        await this.awaitWithTimeout(Promise.allSettled(tasks), timeout)
      } else {
        await Promise.allSettled(tasks)
      }
    } catch (error) {
      if (failFast) {
        throw error
      }
      // 即使超时，也返回已完成的结果
    }

    // 更新最终统计
    this.updateFinalStats(Date.now() - startTime, maxConcurrency)
    
    // 清理信号量
    this.activeSemaphores.delete(semaphore)
    semaphore.destroy()
    
    const denseResults = results.filter((r): r is ConcurrentResult<T> => Boolean(r))
    return denseResults
  }
  
  /**
   * 使用信号量执行单个请求
   */
  private async executeRequestWithSemaphore<T>(
    config: RequestConfig,
    index: number,
    semaphore: Semaphore,
    results: Array<ConcurrentResult<T> | undefined>,
    failFast: boolean
  ): Promise<void> {
    const requestStartTime = Date.now()
    
    try {
      // 获取信号量许可
      await semaphore.acquire()
      
      // 更新并发统计
      const currentConcurrency = this.stats.total - semaphore.available()
      this.stats.maxConcurrencyUsed = Math.max(
        this.stats.maxConcurrencyUsed, 
        currentConcurrency
      )
      
      console.log(
        `[Concurrent] Starting request ${index + 1} ` +
        `(active: ${currentConcurrency}, waiting: ${semaphore.waitingCount()}): ${config.url}`
      )
      
      const data = await this.requestor.request<T>(config)
      const duration = Date.now() - requestStartTime
      
      results[index] = {
        success: true,
        data,
        config,
        index,
        duration,
        retryCount: 0
      }
      
      this.updateSuccessStats(duration)
      
    } catch (error) {
      const duration = Date.now() - requestStartTime
      
      console.error(`[Concurrent] Request ${index + 1} failed: ${config.url}`, error)
      
      if (failFast) {
        // 释放信号量后抛出错误
        semaphore.release()
        throw error
      }
      
      results[index] = {
        success: false,
        error,
        config,
        index,
        duration,
        retryCount: 0
      }
      
      this.updateFailureStats(duration)
      
    } finally {
      // 释放信号量
      if (!failFast || results[index]?.success) {
        semaphore.release()
      }
    }
  }


  /**
   * 包装一个带全局超时的等待逻辑，并在提前完成时清理定时器
   */
  private awaitWithTimeout<T>(promise: Promise<T>, timeout: number): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      let settled = false
      const onResolve = (value: T) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        resolve(value)
      }
      const onReject = (err: unknown) => {
        if (settled) return
        settled = true
        clearTimeout(timer)
        reject(err)
      }
      const timer = setTimeout(() => onReject(new Error(`Concurrent request timeout: ${timeout}ms`)), timeout)
      promise.then(onResolve, onReject)
    })
  }

  /**
   * 并发执行多个相同配置的请求
   */
  async requestMultiple<T>(
    config: RequestConfig,
    count: number,
    concurrentConfig: ConcurrentConfig = {}
  ): Promise<ConcurrentResult<T>[]> {
    if (count <= 0) {
      return []
    }
    
    // 为每个请求创建独立的配置对象，避免引用共享
    const configs = Array.from({ length: count }, (_, index) => ({
      ...config,
      // 添加索引信息以区分不同请求
      __requestIndex: index
    }))
    
    return this.requestConcurrent<T>(configs, concurrentConfig)
  }
  
  /**
   * 重置统计信息
   */
  private resetStats(total: number): void {
    this.stats = {
      total,
      completed: 0,
      successful: 0,
      failed: 0,
      averageDuration: 0,
      maxConcurrencyUsed: 0
    }
    this.durations = []
  }
  
  /**
   * 更新成功统计
   */
  private updateSuccessStats(duration: number): void {
    this.stats.completed++
    this.stats.successful++
    this.durations.push(duration)
    this.updateAverageDuration()
  }
  
  /**
   * 更新失败统计
   */
  private updateFailureStats(duration: number): void {
    this.stats.completed++
    this.stats.failed++
    this.durations.push(duration)
    this.updateAverageDuration()
  }
  
  /**
   * 更新平均耗时
   */
  private updateAverageDuration(): void {
    if (this.durations.length > 0) {
      this.stats.averageDuration = Math.round(
        this.durations.reduce((sum, d) => sum + d, 0) / this.durations.length
      )
    }
  }
  
  /**
   * 更新最终统计
   */
  private updateFinalStats(totalTime: number, maxConcurrency: number): void {
    console.log(
      `[Concurrent] Batch completed: ${this.stats.successful}/${this.stats.total} successful, ` +
      `avg duration: ${this.stats.averageDuration}ms, ` +
      `max concurrency used: ${this.stats.maxConcurrencyUsed}/${maxConcurrency}, ` +
      `total time: ${totalTime}ms`
    )
  }

  /**
   * 获取成功的请求结果
   * @param results 并发请求结果数组
   * @returns 成功的请求数据数组
   */
  getSuccessfulResults<T>(results: ConcurrentResult<T>[]): T[] {
    return results
      .filter(result => result.success)
      .map(result => result.data!)
  }

  /**
   * 获取失败的请求结果
   * @param results 并发请求结果数组
   * @returns 失败的请求结果数组
   */
  getFailedResults<T>(results: ConcurrentResult<T>[]): ConcurrentResult<T>[] {
    return results.filter(result => !result.success)
  }

  /**
   * 检查是否有请求失败
   */
  hasFailures<T>(results: ConcurrentResult<T>[]): boolean {
    return results.some(result => !result.success)
  }
  
  /**
   * 获取并发性能统计
   */
  getConcurrentStats(): ConcurrentStats {
    return { ...this.stats }
  }
  
  /**
   * 获取详细的结果统计
   */
  getResultsStats<T>(results: ConcurrentResult<T>[]): {
    total: number
    successful: number
    failed: number
    averageDuration: number
    minDuration: number
    maxDuration: number
    successRate: number
  } {
    const successful = results.filter(r => r.success)
    const failed = results.filter(r => !r.success)
    const durations = results.map(r => r.duration || 0).filter(d => d > 0)
    
    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      averageDuration: durations.length > 0 ? 
        Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      successRate: results.length > 0 ? 
        Math.round((successful.length / results.length) * 100) : 0
    }
  }
  
  /**
   * 销毁并发功能，清理所有资源
   */
  destroy(): void {
    // 销毁所有活跃的信号量
    this.activeSemaphores.forEach(semaphore => {
      semaphore.destroy()
    })
    this.activeSemaphores.clear()
    
    // 重置统计信息
    this.resetStats(0)
    this.durations = []
  }
}
