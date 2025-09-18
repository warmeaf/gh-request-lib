import { Requestor, RequestConfig, RequestError } from '../../interface'
import { LogFormatter } from '../../utils/error-handler'
import { ConcurrentConfig, ConcurrentResult, ConcurrentStats } from './types'
import { Semaphore } from './semaphore'
import { ResultCollector } from './collector'

export class ConcurrentFeature {
  private stats: ConcurrentStats = {
    total: 0,
    completed: 0,
    successful: 0,
    failed: 0,
    averageDuration: 0,
    maxConcurrencyUsed: 0,
  }
  private durations: number[] = []
  private activeSemaphores: Set<Semaphore> = new Set()

  constructor(private requestor: Requestor) {}

  async requestConcurrent<T>(
    configs: RequestConfig[],
    concurrentConfig: ConcurrentConfig = {}
  ): Promise<ConcurrentResult<T>[]> {
    const { maxConcurrency, failFast = false, timeout } = concurrentConfig

    if (maxConcurrency && maxConcurrency > 0) {
      return this.requestWithConcurrencyLimit<T>(
        configs,
        maxConcurrency,
        failFast,
        timeout
      )
    }

    return this.requestAllConcurrent<T>(configs, failFast, timeout)
  }

  private async requestAllConcurrent<T>(
    configs: RequestConfig[],
    failFast: boolean,
    timeout?: number
  ): Promise<ConcurrentResult<T>[]> {
    this.resetStats(configs.length)

    const collector = new ResultCollector<T>(configs.length)
    const startTime = Date.now()

    const tasks = configs.map(async (config, index) => {
      const requestStart = Date.now()

      try {
        console.log(
          LogFormatter.formatConcurrentLog('start', index, configs.length, config.url)
        )

        const data = await this.requestor.request<T>(config)
        const duration = Date.now() - requestStart

        const result: ConcurrentResult<T> = {
          success: true,
          data,
          config,
          index,
          duration,
          retryCount: 0,
        }
        collector.setResult(index, result)

        console.log(
          LogFormatter.formatConcurrentLog('complete', index, configs.length, config.url, {
            duration: `${Math.round(duration)}ms`,
          })
        )

        this.updateSuccessStats(duration)
      } catch (error) {
        const duration = Date.now() - requestStart

        console.error(
          LogFormatter.formatConcurrentLog('failed', index, configs.length, config.url, {
            duration: `${Math.round(duration)}ms`,
            error: error instanceof Error ? error.message : String(error),
          })
        )

        if (failFast) {
          throw error
        }

        const result: ConcurrentResult<T> = {
          success: false,
          error,
          config,
          index,
          duration,
          retryCount: 0,
        }
        collector.setResult(index, result)

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
    }

    this.stats.maxConcurrencyUsed = configs.length
    this.updateFinalStats(Date.now() - startTime, configs.length)

    return collector.getResults()
  }

  private async requestWithConcurrencyLimit<T>(
    configs: RequestConfig[],
    maxConcurrency: number,
    failFast: boolean,
    timeout?: number
  ): Promise<ConcurrentResult<T>[]> {
    if (maxConcurrency <= 0) {
      throw new RequestError('Max concurrency must be positive')
    }

    this.resetStats(configs.length)

    const semaphore = new Semaphore(maxConcurrency)
    this.activeSemaphores.add(semaphore)
    const collector = new ResultCollector<T>(configs.length)
    const startTime = Date.now()

    const tasks = configs.map((config, index) =>
      this.executeRequestWithSemaphore<T>(config, index, semaphore, collector, failFast)
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
    }

    this.updateFinalStats(Date.now() - startTime, maxConcurrency)

    this.activeSemaphores.delete(semaphore)
    semaphore.destroy()

    return collector.getResults()
  }

  private async executeRequestWithSemaphore<T>(
    config: RequestConfig,
    index: number,
    semaphore: Semaphore,
    collector: ResultCollector<T>,
    failFast: boolean
  ): Promise<void> {
    const requestStartTime = Date.now()

    try {
      await semaphore.acquire()

      const currentConcurrency = this.stats.total - semaphore.available()
      this.stats.maxConcurrencyUsed = Math.max(
        this.stats.maxConcurrencyUsed,
        currentConcurrency
      )

      console.log(
        LogFormatter.formatConcurrentLog('start', index, this.stats.total, config.url, {
          'active requests': currentConcurrency,
          waiting: semaphore.waitingCount(),
        })
      )

      const data = await this.requestor.request<T>(config)
      const duration = Date.now() - requestStartTime

      const result: ConcurrentResult<T> = {
        success: true,
        data,
        config,
        index,
        duration,
        retryCount: 0,
      }
      collector.setResult(index, result)

      console.log(
        LogFormatter.formatConcurrentLog('complete', index, this.stats.total, config.url, {
          duration: `${Math.round(duration)}ms`,
          'active requests': currentConcurrency - 1,
        })
      )

      this.updateSuccessStats(duration)
    } catch (error) {
      const duration = Date.now() - requestStartTime

      console.error(
        LogFormatter.formatConcurrentLog('failed', index, this.stats.total, config.url, {
          duration: `${Math.round(duration)}ms`,
          error: error instanceof Error ? error.message : String(error),
        })
      )

      if (failFast) {
        semaphore.release()
        throw error
      }

      const result: ConcurrentResult<T> = {
        success: false,
        error,
        config,
        index,
        duration,
        retryCount: 0,
      }
      collector.setResult(index, result)

      this.updateFailureStats(duration)
    } finally {
      if (!failFast || collector.getResults()[index]?.success !== false) {
        semaphore.release()
      }
    }
  }

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
      const timer = setTimeout(
        () => onReject(new Error(`Concurrent request timeout: ${timeout}ms`)),
        timeout
      )
      promise.then(onResolve, onReject)
    })
  }

  async requestMultiple<T>(
    config: RequestConfig,
    count: number,
    concurrentConfig: ConcurrentConfig = {}
  ): Promise<ConcurrentResult<T>[]> {
    if (count <= 0) {
      return []
    }

    const configs = Array.from({ length: count }, (_, index) => ({
      ...config,
      __requestIndex: index,
    }))

    return this.requestConcurrent<T>(configs, concurrentConfig)
  }

  private resetStats(total: number): void {
    this.stats = {
      total,
      completed: 0,
      successful: 0,
      failed: 0,
      averageDuration: 0,
      maxConcurrencyUsed: 0,
    }
    this.durations = []
  }

  private updateSuccessStats(duration: number): void {
    this.stats.completed++
    this.stats.successful++
    this.durations.push(duration)
    this.updateAverageDuration()
  }

  private updateFailureStats(duration: number): void {
    this.stats.completed++
    this.stats.failed++
    this.durations.push(duration)
    this.updateAverageDuration()
  }

  private updateAverageDuration(): void {
    if (this.durations.length > 0) {
      this.stats.averageDuration = Math.round(
        this.durations.reduce((sum, d) => sum + d, 0) / this.durations.length
      )
    }
  }

  private updateFinalStats(totalTime: number, maxConcurrency: number): void {
    console.log(
      `[Concurrent] Batch completed: ${this.stats.successful}/${this.stats.total} successful, ` +
        `avg duration: ${this.stats.averageDuration}ms, ` +
        `max concurrency used: ${this.stats.maxConcurrencyUsed}/${maxConcurrency}, ` +
        `total time: ${totalTime}ms`
    )
  }

  getSuccessfulResults<T>(results: ConcurrentResult<T>[]): T[] {
    const successfulData: T[] = []
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (result.success && result.data !== undefined) {
        successfulData.push(result.data)
      }
    }
    return successfulData
  }

  getFailedResults<T>(results: ConcurrentResult<T>[]): ConcurrentResult<T>[] {
    const failedResults: ConcurrentResult<T>[] = []
    for (let i = 0; i < results.length; i++) {
      const result = results[i]
      if (!result.success) {
        failedResults.push(result)
      }
    }
    return failedResults
  }

  hasFailures<T>(results: ConcurrentResult<T>[]): boolean {
    return results.some((result) => !result.success)
  }

  getConcurrentStats(): ConcurrentStats {
    return { ...this.stats }
  }

  getResultsStats<T>(results: ConcurrentResult<T>[]): {
    total: number
    successful: number
    failed: number
    averageDuration: number
    minDuration: number
    maxDuration: number
    successRate: number
  } {
    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)
    const durations = results.map((r) => r.duration || 0).filter((d) => d > 0)

    return {
      total: results.length,
      successful: successful.length,
      failed: failed.length,
      averageDuration:
        durations.length > 0
          ? Math.round(
              durations.reduce((sum, d) => sum + d, 0) / durations.length
            )
          : 0,
      minDuration: durations.length > 0 ? Math.min(...durations) : 0,
      maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
      successRate:
        results.length > 0
          ? Math.round((successful.length / results.length) * 100)
          : 0,
    }
  }

  destroy(): void {
    this.activeSemaphores.forEach((semaphore) => {
      semaphore.destroy()
    })
    this.activeSemaphores.clear()

    this.resetStats(0)
    this.durations = []
  }
}
