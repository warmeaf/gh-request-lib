import { Requestor, RequestConfig } from '../interface'

/**
 * @description 并发请求配置
 */
export interface ConcurrentConfig {
  maxConcurrency?: number // 最大并发数，默认不限制
  failFast?: boolean // 是否快速失败，默认false
  timeout?: number // 整体超时时间
}

/**
 * @description 并发请求结果
 */
export interface ConcurrentResult<T> {
  success: boolean
  data?: T
  error?: any
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
        console.log(`[Concurrent] 发起第${index + 1}个请求: ${config.url}`)
        const data = await this.requestor.request<T>(config)
        results[index] = {
          success: true,
          data,
          config,
          index
        }
      } catch (error) {
        console.error(`[Concurrent] 第${index + 1}个请求失败: ${config.url}`, error)
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
        await Promise.race([
          Promise.all(tasks),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error(`并发请求超时: ${timeout}ms`)), timeout)
          )
        ])
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
   * 限制并发数量的并发请求
   */
  private async requestWithConcurrencyLimit<T>(
    configs: RequestConfig[],
    maxConcurrency: number,
    failFast: boolean,
    timeout?: number
  ): Promise<ConcurrentResult<T>[]> {
    const results: Array<ConcurrentResult<T> | undefined> = new Array(configs.length)

    const executeRequest = async (config: RequestConfig, index: number): Promise<void> => {
      try {
        console.log(`[Concurrent] 发起第${index + 1}个请求 (并发限制: ${maxConcurrency}): ${config.url}`)
        const data = await this.requestor.request<T>(config)
        results[index] = {
          success: true,
          data,
          config,
          index
        }
      } catch (error) {
        console.error(`[Concurrent] 第${index + 1}个请求失败: ${config.url}`, error)
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
    }

    const processBatch = async (batch: Array<{ config: RequestConfig; index: number }>): Promise<void> => {
      await Promise.all(batch.map(({ config, index }) => executeRequest(config, index)))
    }

    const batches: Array<Array<{ config: RequestConfig; index: number }>> = []
    for (let i = 0; i < configs.length; i += maxConcurrency) {
      batches.push(
        configs.slice(i, i + maxConcurrency).map((config, batchIndex) => ({
          config,
          index: i + batchIndex
        }))
      )
    }

    try {
      if (timeout && timeout > 0) {
        await Promise.race([
          this.processBatchesSequentially(batches, processBatch),
          new Promise<void>((_, reject) =>
            setTimeout(() => reject(new Error(`并发请求超时: ${timeout}ms`)), timeout)
          )
        ])
      } else {
        await this.processBatchesSequentially(batches, processBatch)
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
   * 顺序处理批次
   */
  private async processBatchesSequentially(
    batches: Array<Array<{ config: RequestConfig; index: number }>>,
    processBatch: (batch: Array<{ config: RequestConfig; index: number }>) => Promise<void>
  ): Promise<void> {
    for (const batch of batches) {
      await processBatch(batch)
    }
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
