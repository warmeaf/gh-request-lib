import { Requestor, RequestConfig, RequestError } from '../interface'

/**
 * @description 并发请求配置
 */
export interface ConcurrentConfig {
  maxConcurrency?: number // 最大并发数，默认不限制
  failFast?: boolean // 是否快速失败，默认为false
  timeout?: number // 整体超时时间
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
}

/**
 * @description 并发请求功能
 */
export class ConcurrentFeature {
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
   * 无限制并发执行所有请求
   */
  private async requestAllConcurrent<T>(
    configs: RequestConfig[],
    failFast: boolean,
    timeout?: number
  ): Promise<ConcurrentResult<T>[]> {
    const results: Array<ConcurrentResult<T> | undefined> = new Array(configs.length)
    const tasks = configs.map(async (config, index) => {
      try {
        console.log(`[Concurrent] Starting request ${index + 1}: ${config.url}`)
        const data = await this.requestor.request<T>(config)
        results[index] = {
          success: true,
          data,
          config,
          index
        }
      } catch (error) {
        console.error(`[Concurrent] Request ${index + 1} failed: ${config.url}`, error)
        if (failFast) {
          throw error
        }
        results[index] = {
          success: false,
          error,
          config,
          index
        }
      }
    })

    try {
      if (timeout && timeout > 0) {
        await this.awaitWithTimeout(Promise.all(tasks), timeout)
      } else {
        await Promise.all(tasks)
      }
    } catch (error) {
      if (failFast) {
        throw error
      }
      // 即使超时，也返回已完成的结果
    }

    const denseResults = results.filter((r): r is ConcurrentResult<T> => Boolean(r))
    return denseResults
  }

  /**
   * 限制并发数量的并发请求，使用真正的并发池
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

    const results: Array<ConcurrentResult<T> | undefined> = new Array(configs.length)
    const executing = new Set<Promise<void>>()
    let index = 0

    const executeRequest = async (config: RequestConfig, requestIndex: number): Promise<void> => {
      try {
        console.log(`[Concurrent] Starting request ${requestIndex + 1} (concurrency limit: ${maxConcurrency}): ${config.url}`)
        const data = await this.requestor.request<T>(config)
        results[requestIndex] = {
          success: true,
          data,
          config,
          index: requestIndex
        }
      } catch (error) {
        console.error(`[Concurrent] Request ${requestIndex + 1} failed: ${config.url}`, error)
        if (failFast) {
          throw error
        }
        results[requestIndex] = {
          success: false,
          error,
          config,
          index: requestIndex
        }
      }
    }

    const processNext = async (): Promise<void> => {
      while (index < configs.length) {
        // 等待有空闲槽位
        while (executing.size >= maxConcurrency) {
          await Promise.race(executing)
        }

        const currentIndex = index++
        const config = configs[currentIndex]
        
        const promise = executeRequest(config, currentIndex).finally(() => {
          executing.delete(promise)
        })
        
        executing.add(promise)

        if (failFast) {
          // 在快速失败模式下，一旦有错误就立即抛出
          promise.catch(() => {
            // 错误会在执行请求中处理
          })
        }
      }

      // 等待所有剩余请求完成
      await Promise.all(executing)
    }

    try {
      if (timeout && timeout > 0) {
        await this.awaitWithTimeout(processNext(), timeout)
      } else {
        await processNext()
      }
    } catch (error) {
      if (failFast) {
        throw error
      }
      // 即使超时，也返回已完成的结果
    }

    const denseResults = results.filter((r): r is ConcurrentResult<T> => Boolean(r))
    return denseResults
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
   * @param config 请求配置
   * @param count 请求次数
   * @param concurrentConfig 并发配置
   * @returns 并发请求结果数组
   */
  async requestMultiple<T>(
    config: RequestConfig,
    count: number,
    concurrentConfig: ConcurrentConfig = {}
  ): Promise<ConcurrentResult<T>[]> {
    const configs = Array(count).fill(config)
    return this.requestConcurrent<T>(configs, concurrentConfig)
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
   * @param results 并发请求结果数组
   * @returns 是否有失败的请求
   */
  hasFailures<T>(results: ConcurrentResult<T>[]): boolean {
    return results.some(result => !result.success)
  }
}
