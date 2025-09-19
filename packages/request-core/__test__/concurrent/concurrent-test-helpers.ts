import { vi } from 'vitest'
import { RequestConfig, Requestor, RequestError } from '../../src/interface'
import { ConcurrentConfig, ConcurrentResult } from '../../src/features/concurrent'

// 并发测试响应类型
export interface ConcurrentTestResponse {
  url: string
  method: string
  index: number
  timestamp: number
  duration: number
  success: boolean
  data?: any
}

// 并发测试用的模拟错误类型
export class MockConcurrentNetworkError extends Error {
  constructor(message = 'Concurrent network error occurred', public readonly index?: number) {
    super(message)
    this.name = 'MockConcurrentNetworkError'
  }

  static createNetworkError(message?: string, index?: number): MockConcurrentNetworkError {
    return new MockConcurrentNetworkError(message, index)
  }
}

export class MockConcurrentTimeoutError extends Error {
  constructor(message = 'Concurrent request timeout', public readonly index?: number) {
    super(message)
    this.name = 'MockConcurrentTimeoutError'
  }

  static createTimeoutError(message?: string, index?: number): MockConcurrentTimeoutError {
    return new MockConcurrentTimeoutError(message, index)
  }
}

export class MockConcurrentRateLimitError extends Error {
  constructor(message = 'Rate limit exceeded', public readonly retryAfter?: number) {
    super(message)
    this.name = 'MockConcurrentRateLimitError'
  }
}

// 并发测试专用的模拟请求实现器
export class ConcurrentMockRequestor implements Requestor {
  private callCount = 0
  private calls: Array<{
    config: RequestConfig
    timestamp: number
    index: number
    startTime: number
  }> = []
  
  private delayMap = new Map<string, number>() // URL -> delay mapping
  private failureMap = new Map<string, boolean>() // URL -> should fail mapping
  private errorMap = new Map<string, Error>() // URL -> specific error mapping
  private responseMap = new Map<string, any>() // URL -> response mapping
  
  private globalDelay = 0
  private globalFailureRate = 0
  private maxConcurrentCallsRecorded = 0
  private activeCalls = 0
  private maxActiveCalls = 0

  // 设置全局延迟
  setGlobalDelay(delay: number): void {
    this.globalDelay = delay
  }

  // 设置特定URL的延迟
  setUrlDelay(url: string, delay: number): void {
    this.delayMap.set(url, delay)
  }

  // 设置全局失败率 (0-1)
  setGlobalFailureRate(rate: number): void {
    this.globalFailureRate = Math.max(0, Math.min(1, rate))
  }

  // 设置特定URL失败
  setUrlFailure(url: string, shouldFail: boolean, error?: Error): void {
    this.failureMap.set(url, shouldFail)
    if (error) {
      this.errorMap.set(url, error)
    }
  }

  // 设置特定URL响应
  setUrlResponse(url: string, response: any): void {
    this.responseMap.set(url, response)
  }

  // 批量设置延迟模式
  setStaggeredDelays(baseDelay: number, increment: number): void {
    this.calls.forEach((_, index) => {
      this.setUrlDelay(`/api/test-${index}`, baseDelay + (index * increment))
    })
  }

  async request<T>(config: RequestConfig): Promise<T> {
    const callIndex = this.callCount++
    const startTime = Date.now()
    
    // 记录活跃调用数
    this.activeCalls++
    this.maxActiveCalls = Math.max(this.maxActiveCalls, this.activeCalls)
    
    const callRecord = {
      config,
      timestamp: startTime,
      index: callIndex,
      startTime
    }
    this.calls.push(callRecord)

    try {
      // 确定延迟时间
      const urlDelay = this.delayMap.get(config.url!) || 0
      const totalDelay = Math.max(this.globalDelay, urlDelay)
      
      if (totalDelay > 0) {
        await this.sleep(totalDelay)
      }

      // 确定是否应该失败
      const shouldFail = this.shouldRequestFail(config.url!, callIndex)
      
      if (shouldFail) {
        const error = this.getErrorForUrl(config.url!, callIndex)
        throw error
      }

      // 返回响应
      const response = this.getResponseForUrl(config.url!, callIndex, startTime)
      return response as T
      
    } finally {
      this.activeCalls--
    }
  }

  private shouldRequestFail(url: string, index: number): boolean {
    // 检查特定URL失败设置
    if (this.failureMap.has(url)) {
      return this.failureMap.get(url)!
    }

    // 检查全局失败率
    if (this.globalFailureRate > 0) {
      return Math.random() < this.globalFailureRate
    }

    return false
  }

  private getErrorForUrl(url: string, index: number): Error {
    if (this.errorMap.has(url)) {
      return this.errorMap.get(url)!
    }

    // 默认网络错误
    return MockConcurrentNetworkError.createNetworkError(`Request failed for ${url}`, index)
  }

  private getResponseForUrl(url: string, index: number, startTime: number): ConcurrentTestResponse {
    if (this.responseMap.has(url)) {
      return this.responseMap.get(url)
    }

    // 默认成功响应
    return {
      url,
      method: 'GET',
      index,
      timestamp: Date.now(),
      duration: Date.now() - startTime,
      success: true,
      data: `Response for ${url} (${index})`
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 获取调用统计信息
  getCallStats() {
    return {
      totalCalls: this.callCount,
      callsRecorded: this.calls.length,
      maxActiveCalls: this.maxActiveCalls,
      averageCallTime: this.calls.length > 0 
        ? this.calls.reduce((sum, call) => sum + (Date.now() - call.startTime), 0) / this.calls.length
        : 0
    }
  }

  // 获取调用历史
  getCallHistory() {
    return [...this.calls]
  }

  // 获取按时间排序的调用
  getCallsByTime() {
    return [...this.calls].sort((a, b) => a.timestamp - b.timestamp)
  }

  // 验证并发执行情况
  verifyConcurrentExecution(maxConcurrency?: number): boolean {
    if (!maxConcurrency) {
      return true
    }
    
    return this.maxActiveCalls <= maxConcurrency
  }

  // 重置统计信息
  reset(): void {
    this.callCount = 0
    this.calls = []
    this.activeCalls = 0
    this.maxActiveCalls = 0
    this.delayMap.clear()
    this.failureMap.clear()
    this.errorMap.clear()
    this.responseMap.clear()
    this.globalDelay = 0
    this.globalFailureRate = 0
  }
}

// 测试数据生成器
export class ConcurrentTestDataGenerator {
  static generateRequestConfigs(count: number, baseUrl = '/api/test'): RequestConfig[] {
    return Array.from({ length: count }, (_, index) => ({
      url: `${baseUrl}-${index}`,
      method: 'GET' as const,
      headers: { 'X-Request-Index': index.toString() }
    }))
  }

  static generateMixedConfigs(successCount: number, failCount: number): {
    configs: RequestConfig[]
    expectedSuccessIndices: number[]
    expectedFailIndices: number[]
  } {
    const configs: RequestConfig[] = []
    const expectedSuccessIndices: number[] = []
    const expectedFailIndices: number[] = []

    // 成功的请求
    for (let i = 0; i < successCount; i++) {
      configs.push({
        url: `/api/success-${i}`,
        method: 'GET'
      })
      expectedSuccessIndices.push(i)
    }

    // 失败的请求
    for (let i = 0; i < failCount; i++) {
      const index = successCount + i
      configs.push({
        url: `/api/fail-${i}`,
        method: 'GET'
      })
      expectedFailIndices.push(index)
    }

    return { configs, expectedSuccessIndices, expectedFailIndices }
  }

  static generateVariableDelayConfigs(count: number, maxDelay = 1000): {
    configs: RequestConfig[]
    delays: number[]
  } {
    const configs: RequestConfig[] = []
    const delays: number[] = []

    for (let i = 0; i < count; i++) {
      const delay = Math.floor(Math.random() * maxDelay)
      configs.push({
        url: `/api/delayed-${i}`,
        method: 'GET'
      })
      delays.push(delay)
    }

    return { configs, delays }
  }
}

// 断言和验证工具
export class ConcurrentTestAssertions {
  // 验证结果完整性
  static verifyResultCompleteness<T>(
    results: ConcurrentResult<T>[],
    expectedCount: number
  ): boolean {
    if (results.length !== expectedCount) {
      throw new Error(`Expected ${expectedCount} results, got ${results.length}`)
    }

    // 验证索引连续性
    const indices = results.map(r => r.index).sort((a, b) => a - b)
    for (let i = 0; i < expectedCount; i++) {
      if (indices[i] !== i) {
        throw new Error(`Missing result for index ${i}`)
      }
    }

    return true
  }

  // 验证成功率
  static verifySuccessRate<T>(
    results: ConcurrentResult<T>[],
    expectedSuccessCount: number
  ): boolean {
    const actualSuccessCount = results.filter(r => r.success).length
    if (actualSuccessCount !== expectedSuccessCount) {
      throw new Error(
        `Expected ${expectedSuccessCount} successful results, got ${actualSuccessCount}`
      )
    }
    return true
  }

  // 验证并发限制
  static verifyConcurrencyLimit(
    requestor: ConcurrentMockRequestor,
    maxConcurrency: number
  ): boolean {
    const stats = requestor.getCallStats()
    if (stats.maxActiveCalls > maxConcurrency) {
      throw new Error(
        `Max concurrent calls (${stats.maxActiveCalls}) exceeded limit (${maxConcurrency})`
      )
    }
    return true
  }

  // 验证执行时间范围
  static verifyExecutionTimeRange<T>(
    results: ConcurrentResult<T>[],
    minDuration: number,
    maxDuration: number
  ): boolean {
    const durations = results.map(r => r.duration || 0).filter(d => d > 0)
    
    const tooFast = durations.filter(d => d < minDuration)
    const tooSlow = durations.filter(d => d > maxDuration)
    
    if (tooFast.length > 0) {
      throw new Error(`${tooFast.length} requests completed too quickly (< ${minDuration}ms)`)
    }
    
    if (tooSlow.length > 0) {
      throw new Error(`${tooSlow.length} requests took too long (> ${maxDuration}ms)`)
    }

    return true
  }

  // 验证统计信息一致性
  static verifyStatsConsistency<T>(
    results: ConcurrentResult<T>[],
    stats: any
  ): boolean {
    const successCount = results.filter(r => r.success).length
    const failureCount = results.filter(r => !r.success).length

    if (stats.successful !== successCount) {
      throw new Error(`Stats successful count mismatch: ${stats.successful} vs ${successCount}`)
    }

    if (stats.failed !== failureCount) {
      throw new Error(`Stats failed count mismatch: ${stats.failed} vs ${failureCount}`)
    }

    if (stats.total !== results.length) {
      throw new Error(`Stats total count mismatch: ${stats.total} vs ${results.length}`)
    }

    return true
  }
}

// 性能测试工具
export class ConcurrentPerformanceHelper {
  static async measureExecutionTime<T>(
    fn: () => Promise<T>
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now()
    const result = await fn()
    const duration = Date.now() - start
    return { result, duration }
  }

  static calculateTheoreticalMinTime(
    requests: number,
    avgDelay: number,
    maxConcurrency?: number
  ): number {
    if (!maxConcurrency || maxConcurrency >= requests) {
      return avgDelay // 完全并发
    }
    
    // 分批执行的理论时间
    const batches = Math.ceil(requests / maxConcurrency)
    return batches * avgDelay
  }

  static verifyPerformanceImprovement(
    sequentialTime: number,
    concurrentTime: number,
    expectedImprovement: number = 2
  ): boolean {
    const improvement = sequentialTime / concurrentTime
    if (improvement < expectedImprovement) {
      throw new Error(
        `Performance improvement ${improvement.toFixed(2)}x is less than expected ${expectedImprovement}x`
      )
    }
    return true
  }
}
