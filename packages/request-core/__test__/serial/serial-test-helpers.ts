import { RequestConfig, Requestor } from '../../src/interface'

// 串行测试响应类型
export interface SerialTestResponse {
  url: string
  method: string
  order: number
  timestamp: number
  serialKey?: string
  data?: any
}

// 串行请求测试专用的模拟请求实现器
export class SerialMockRequestor implements Requestor {
  private requestCount = 0
  private requests: Array<{ config: RequestConfig; timestamp: number; order: number }> = []
  private shouldFail = false
  private failAfter = 0
  private failPattern: RegExp | null = null
  private isPaused = false
  private pausedResolvers: Array<() => void> = []

  async request<T>(config: RequestConfig): Promise<T> {
    const order = ++this.requestCount
    const timestamp = Date.now()
    
    this.requests.push({ config, timestamp, order })
    
    // 检查是否应该失败
    if (this.shouldFail) {
      let shouldFailThisRequest = false
      
      // 基于顺序的失败控制
      if (this.failAfter > 0 && order > this.failAfter) {
        shouldFailThisRequest = true
      }
      
      // 基于URL模式的失败控制
      if (this.failPattern && this.failPattern.test(config.url)) {
        shouldFailThisRequest = true
      }
      
      // 如果没有特定的失败控制，且failAfter为0，则根据模式决定
      if (this.failAfter <= 0 && !this.failPattern) {
        shouldFailThisRequest = true
      }
      
      if (shouldFailThisRequest) {
        throw new Error(`Mock request failed for ${config.url}`)
      }
    }
    
    // 检查是否暂停
    if (this.isPaused) {
      await new Promise<void>((resolve) => {
        this.pausedResolvers.push(resolve)
      })
    }
    
    // 模拟网络延迟 - 串行测试需要可控的延迟
    const delay = 50 + Math.random() * 50
    await new Promise(resolve => setTimeout(resolve, delay))
    
    const response: SerialTestResponse = {
      url: config.url,
      method: config.method,
      order,
      timestamp,
      serialKey: config.serialKey,
      data: config.data
    }
    
    return response as T
  }

  getRequests() {
    return [...this.requests]
  }

  reset() {
    this.requestCount = 0
    this.requests = []
    this.shouldFail = false
    this.failAfter = 0
    this.failPattern = null
    this.isPaused = false
    this.pausedResolvers = []
  }

  // 设置失败模式
  setFailMode(shouldFail: boolean, failAfter = 0, pattern?: RegExp) {
    this.shouldFail = shouldFail
    this.failAfter = failAfter
    this.failPattern = pattern || null
  }

  // 设置特定URL失败
  setFailForUrls(urls: string[]) {
    this.shouldFail = true
    this.failPattern = new RegExp(urls.map(url => url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'))
  }

  // 暂停所有请求处理
  pause() {
    this.isPaused = true
  }

  // 恢复所有请求处理
  resume() {
    this.isPaused = false
    const resolvers = [...this.pausedResolvers]
    this.pausedResolvers = []
    resolvers.forEach(resolve => resolve())
  }
}

// 通用的测试清理函数
export async function cleanupSerialTest(mockRequestor: SerialMockRequestor, requestCore: any) {
  try {
    // 确保请求处理器没有被暂停
    mockRequestor.resume()
    
    // 等待一小段时间让正在进行的请求有机会完成
    await new Promise(resolve => setTimeout(resolve, 50))
    
    // 获取统计信息，检查是否有等待中的任务
    const stats = requestCore.getSerialStats()
    if (stats.totalPendingTasks > 0) {
      // 如果有等待中的任务，尝试让它们完成
      await new Promise(resolve => setTimeout(resolve, 200))
    }
  } catch (error) {
    // 忽略统计获取错误
    console.warn('Cleanup stats error:', error)
  }
  
  // 重置Mock请求器状态
  mockRequestor.reset()
  
  // 销毁请求核心实例（内部会清理队列）
  try {
    requestCore.destroy()
  } catch (error) {
    // 忽略销毁过程中的错误，这些通常是预期的清理错误
    console.warn('Destroy error (expected):', error)
  }
}
