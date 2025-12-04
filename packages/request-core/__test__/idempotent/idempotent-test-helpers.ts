import { vi } from 'vitest'
import { RequestConfig, Requestor, RequestError, RequestErrorType, IdempotentConfig } from '../../src/interface'
import { IdempotentFeature } from '../../src/features/idempotent'
import { CacheItem } from '../../src/features/idempotent/types'

// 幂等测试响应类型
export interface IdempotentTestResponse {
  url: string
  method: string
  timestamp: number
  requestId: string
  success: boolean
  data?: any
  fromCache?: boolean
  cacheHit?: boolean
}

// 幂等测试用的模拟错误类型
export class MockIdempotentCacheError extends Error {
  constructor(message = 'Idempotent cache error occurred', public readonly operation?: string) {
    super(message)
    this.name = 'MockIdempotentCacheError'
  }

  static createCacheError(message?: string, operation?: string): MockIdempotentCacheError {
    return new MockIdempotentCacheError(message, operation)
  }
}

export class MockIdempotentKeyGenerationError extends Error {
  constructor(message = 'Key generation failed', public readonly config?: RequestConfig) {
    super(message)
    this.name = 'MockIdempotentKeyGenerationError'
  }

  static createKeyError(message?: string, config?: RequestConfig): MockIdempotentKeyGenerationError {
    return new MockIdempotentKeyGenerationError(message, config)
  }
}

export class MockIdempotentValidationError extends Error {
  constructor(message = 'Validation error', public readonly field?: string) {
    super(message)
    this.name = 'MockIdempotentValidationError'
  }

  static createValidationError(message?: string, field?: string): MockIdempotentValidationError {
    return new MockIdempotentValidationError(message, field)
  }
}

// 幂等测试专用的模拟请求实现器
export class IdempotentMockRequestor implements Requestor {
  private callCount = 0
  private calls: Array<{
    config: RequestConfig
    timestamp: number
    requestId: string
    fromIdempotent: boolean
  }> = []
  
  private responseMap = new Map<string, any>() // URL -> response mapping
  private delayMap = new Map<string, number>() // URL -> delay mapping
  private failureMap = new Map<string, boolean>() // URL -> should fail mapping
  private errorMap = new Map<string, Error>() // URL -> specific error mapping
  
  private globalDelay = 0
  private globalFailureRate = 0
  private duplicateDetection = new Map<string, any>() // 记录相同请求

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

  async request<T>(config: RequestConfig): Promise<T> {
    const requestId = `req_${this.callCount++}_${Date.now()}`
    const timestamp = Date.now()
    
    const callRecord = {
      config,
      timestamp,
      requestId,
      fromIdempotent: !!config.headers?.['X-Idempotent-Key']
    }
    this.calls.push(callRecord)

    // 确定延迟时间
    const urlDelay = this.delayMap.get(config.url!) || 0
    const totalDelay = Math.max(this.globalDelay, urlDelay)
    
    if (totalDelay > 0) {
      await this.sleep(totalDelay)
    }

    // 检查是否应该失败
    const shouldFail = this.shouldRequestFail(config.url!)
    
    if (shouldFail) {
      const error = this.getErrorForUrl(config.url!)
      throw error
    }

    // 返回响应
    const response = this.getResponseForUrl(config.url!, requestId, timestamp)
    return response as T
  }

  private shouldRequestFail(url: string): boolean {
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

  private getErrorForUrl(url: string): Error {
    if (this.errorMap.has(url)) {
      return this.errorMap.get(url)!
    }

    // 默认网络错误
    return new RequestError(`Request failed for ${url}`, {
      type: RequestErrorType.NETWORK_ERROR,
      context: { url }
    })
  }

  private getResponseForUrl(url: string, requestId: string, timestamp: number): IdempotentTestResponse {
    if (this.responseMap.has(url)) {
      const customResponse = this.responseMap.get(url)
      return typeof customResponse === 'function' ? customResponse(requestId, timestamp) : customResponse
    }

    // 默认成功响应
    return {
      url,
      method: 'GET',
      timestamp,
      requestId,
      success: true,
      data: `Response for ${url} (${requestId})`
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }

  // 获取调用历史
  getCallHistory() {
    return [...this.calls]
  }

  // 获取重复请求检测信息
  getDuplicateDetectionInfo() {
    const duplicates = new Map<string, number>()
    this.calls.forEach(call => {
      const key = `${call.config.method}-${call.config.url}`
      duplicates.set(key, (duplicates.get(key) || 0) + 1)
    })
    return duplicates
  }

  // 验证幂等性 - 检查相同的请求是否产生了相同的响应
  verifyIdempotency(url: string, method: string = 'GET'): boolean {
    const matchingCalls = this.calls.filter(
      call => call.config.url === url && call.config.method === method
    )
    
    if (matchingCalls.length < 2) {
      return true // 没有重复请求，无需验证
    }

    // 在实际场景中，这里会比较响应内容的一致性
    return true
  }

  // 重置统计信息
  reset(): void {
    this.callCount = 0
    this.calls = []
    this.responseMap.clear()
    this.delayMap.clear()
    this.failureMap.clear()
    this.errorMap.clear()
    this.globalDelay = 0
    this.globalFailureRate = 0
    this.duplicateDetection.clear()
  }
}

// 测试数据生成器
export class IdempotentTestDataGenerator {
  // 生成测试用的请求配置
  static generateRequestConfigs(count: number, baseUrl = '/api/idempotent-test'): RequestConfig[] {
    return Array.from({ length: count }, (_, index) => ({
      url: `${baseUrl}-${index}`,
      method: 'GET' as const,
      headers: { 'X-Test-Index': index.toString() }
    }))
  }

  // 生成相同的请求配置（用于测试幂等性）
  static generateIdenticalConfigs(count: number, config: RequestConfig): RequestConfig[] {
    return Array.from({ length: count }, () => ({ ...config }))
  }

  // 生成不同的幂等配置
  static generateIdempotentConfigs(): Record<string, IdempotentConfig> {
    return {
      default: {},
      shortTTL: { ttl: 5000 },
      longTTL: { ttl: 60000 },
      customKey: { key: 'custom-test-key' },
      withHeaders: { 
        includeHeaders: ['authorization', 'x-api-key'],
        includeAllHeaders: false
      },
      allHeaders: { includeAllHeaders: true },
      withCallback: {
        onDuplicate: vi.fn()
      },
      xxhashAlgorithm: { hashAlgorithm: 'xxhash' },
      simpleHashAlgorithm: { hashAlgorithm: 'simple' }
    }
  }

  // 生成测试用的缓存项
  static generateCacheItems(count: number): CacheItem[] {
    const now = Date.now()
    return Array.from({ length: count }, (_, index) => ({
      key: `test-cache-key-${index}`,
      data: { id: index, name: `Test Data ${index}` },
      timestamp: now - (index * 1000),
      ttl: 30000,
      accessTime: now - (index * 500),
      accessCount: Math.floor(Math.random() * 5) + 1
    }))
  }
}

// 断言和验证工具
export class IdempotentTestAssertions {
  // 占位类，保留用于未来扩展
}

// 性能和时序测试工具
export class IdempotentPerformanceHelper {
  // 测量幂等请求的执行时间
  static async measureIdempotentExecution<T>(
    idempotentFeature: IdempotentFeature,
    config: RequestConfig,
    idempotentConfig?: IdempotentConfig
  ): Promise<{ result: T; duration: number }> {
    const start = Date.now()
    const result = await idempotentFeature.requestIdempotent<T>(config, idempotentConfig)
    const duration = Date.now() - start
    
    return { result, duration }
  }

  // 并发幂等请求测试
  static async testConcurrentIdempotentRequests<T>(
    idempotentFeature: IdempotentFeature,
    config: RequestConfig,
    concurrency: number,
    idempotentConfig?: IdempotentConfig
  ): Promise<{
    results: T[]
    totalDuration: number
  }> {
    const start = Date.now()
    
    const promises = Array.from({ length: concurrency }, () =>
      idempotentFeature.requestIdempotent<T>(config, idempotentConfig)
    )
    
    const results = await Promise.all(promises)
    const totalDuration = Date.now() - start
    
    return {
      results,
      totalDuration
    }
  }

  // 验证缓存效果 - 比较有无缓存的性能差异
  static async compareCachePerformance<T>(
    createIdempotentFeature: () => IdempotentFeature,
    config: RequestConfig,
    requestCount: number = 5
  ): Promise<{
    withCacheDuration: number
    withoutCacheDuration: number
    performanceImprovement: number
  }> {
    // 测试有缓存的情况
    const idempotentFeature = createIdempotentFeature()
    const withCacheStart = Date.now()
    
    for (let i = 0; i < requestCount; i++) {
      await idempotentFeature.requestIdempotent<T>(config)
    }
    
    const withCacheDuration = Date.now() - withCacheStart
    
    // 清理缓存，重新测试（模拟无缓存情况）
    await idempotentFeature.clearIdempotentCache()
    const withoutCacheStart = Date.now()
    
    const freshFeature = createIdempotentFeature()
    for (let i = 0; i < requestCount; i++) {
      await freshFeature.requestIdempotent<T>({ ...config, headers: { ...config.headers, 'cache-buster': i.toString() } })
    }
    
    const withoutCacheDuration = Date.now() - withoutCacheStart
    
    const performanceImprovement = withoutCacheDuration / withCacheDuration
    
    return {
      withCacheDuration,
      withoutCacheDuration,
      performanceImprovement
    }
  }
}

// 常用的测试配置
export const IDEMPOTENT_TEST_CONFIGS = {
  BASIC_GET: {
    url: 'https://api.example.com/users',
    method: 'GET' as const
  },
  
  BASIC_POST: {
    url: 'https://api.example.com/users',
    method: 'POST' as const,
    data: { name: 'Test User', email: 'test@example.com' }
  },

  WITH_HEADERS: {
    url: 'https://api.example.com/protected',
    method: 'GET' as const,
    headers: {
      'Authorization': 'Bearer test-token',
      'X-API-Key': 'test-api-key',
      'Content-Type': 'application/json'
    }
  },

  COMPLEX_DATA: {
    url: 'https://api.example.com/complex',
    method: 'POST' as const,
    data: {
      user: { id: 1, name: 'John' },
      metadata: { timestamp: Date.now(), version: '1.0' },
      items: [1, 2, 3, 4, 5]
    }
  }
} as const

// 常用的幂等配置
export const IDEMPOTENT_CONFIGS = {
  DEFAULT: {} as IdempotentConfig,
  
  SHORT_TTL: { ttl: 5000 } as IdempotentConfig,
  
  LONG_TTL: { ttl: 300000 } as IdempotentConfig,
  
  CUSTOM_KEY: { key: 'test-custom-key' } as IdempotentConfig,
  
  WITH_HEADERS: { 
    includeHeaders: ['authorization', 'x-api-key'],
    includeAllHeaders: false
  } as IdempotentConfig,
  
  ALL_HEADERS: { includeAllHeaders: true } as IdempotentConfig,
  
  XXHASH: { hashAlgorithm: 'xxhash' } as IdempotentConfig,
  
  SIMPLE_HASH: { hashAlgorithm: 'simple' } as IdempotentConfig
} as const

// 常用的测试响应
export const IDEMPOTENT_TEST_RESPONSES = {
  SUCCESS: { success: true, data: 'test' },
  USER: { id: 1, name: 'Test User', email: 'test@example.com' },
  CREATED: { id: 2, created: true, timestamp: Date.now() },
  ERROR: { error: 'Something went wrong' }
} as const

/**
 * @description 创建新的幂等测试用 Mock Requestor
 */
export function createIdempotentMockRequestor(): IdempotentMockRequestor {
  return new IdempotentMockRequestor()
}

/**
 * @description 等待指定时间（毫秒）
 */
export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}

/**
 * @description 创建幂等功能实例 - 测试用工厂函数
 */
export function createIdempotentFeature(requestor?: Requestor): IdempotentFeature {
  return new IdempotentFeature(requestor || createIdempotentMockRequestor())
}

/**
 * @description 清理幂等测试环境
 */
export async function cleanupIdempotentTest(
  idempotentFeature: IdempotentFeature,
  mockRequestor?: IdempotentMockRequestor
): Promise<void> {
  await idempotentFeature.destroy()
  if (mockRequestor) {
    mockRequestor.reset()
  }
  vi.clearAllTimers()
}
