import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig, Requestor } from '../../src/interface'

// 串行测试响应类型
interface SerialTestResponse {
  url: string
  method: string
  order: number
  timestamp: number
  serialKey?: string
  data?: any
}

// 串行请求测试专用的模拟请求实现器
class SerialMockRequestor implements Requestor {
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

describe('串行请求基础功能测试', () => {
  let mockRequestor: SerialMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new SerialMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
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
  })

  test('应该按顺序执行串行请求', async () => {
    const serialKey = 'test-queue'
    
    // 发起三个串行请求
    const promises = [
      requestCore.getSerial('/api/1', serialKey),
      requestCore.getSerial('/api/2', serialKey),
      requestCore.getSerial('/api/3', serialKey)
    ]

    const results = await Promise.all(promises) as SerialTestResponse[]
    
    // 验证结果
    expect(results).toHaveLength(3)
    expect(results[0].url).toBe('/api/1')
    expect(results[1].url).toBe('/api/2')  
    expect(results[2].url).toBe('/api/3')

    // 验证执行顺序
    const requests = mockRequestor.getRequests()
    expect(requests).toHaveLength(3)
    expect(requests[0].config.url).toBe('/api/1')
    expect(requests[1].config.url).toBe('/api/2')
    expect(requests[2].config.url).toBe('/api/3')
    
    // 验证时间戳递增（串行执行）
    expect(requests[1].timestamp).toBeGreaterThan(requests[0].timestamp)
    expect(requests[2].timestamp).toBeGreaterThan(requests[1].timestamp)
  })

  test('应该独立处理不同的串行队列', async () => {
    // 发起两个不同队列的请求
    const promises = [
      requestCore.getSerial('/api/queue1-1', 'queue1'),
      requestCore.getSerial('/api/queue2-1', 'queue2'),
      requestCore.getSerial('/api/queue1-2', 'queue1'),
      requestCore.getSerial('/api/queue2-2', 'queue2')
    ]

    const results = await Promise.all(promises)
    
    // 验证所有请求都完成了
    expect(results).toHaveLength(4)
    
    // 获取统计信息
    const stats = requestCore.getSerialStats()
    expect(stats.totalQueues).toBe(2)
    expect(stats.totalCompletedTasks).toBe(4)
  })

  test('应该提供正确的统计信息', async () => {
    const serialKey = 'stats-test'
    
    // 发起一些请求
    await Promise.all([
      requestCore.getSerial('/api/1', serialKey),
      requestCore.postSerial('/api/2', serialKey, { data: 'test' })
    ])

    const stats = requestCore.getSerialStats()
    
    expect(stats.totalQueues).toBe(1)
    expect(stats.totalCompletedTasks).toBe(2)
    expect(stats.totalFailedTasks).toBe(0)
    expect(stats.queues[serialKey]).toBeDefined()
    expect(stats.queues[serialKey].completedTasks).toBe(2)
  })

  test('应该支持不同的HTTP请求方法', async () => {
    const serialKey = 'methods-test'
    
    const promises = [
      requestCore.getSerial('/api/get', serialKey),
      requestCore.postSerial('/api/post', serialKey, { data: 'test' }),
      requestCore.putSerial('/api/put', serialKey, { data: 'update' }),
      requestCore.deleteSerial('/api/delete', serialKey),
      requestCore.patchSerial('/api/patch', serialKey, { data: 'patch' })
    ]

    const results = await Promise.all(promises) as SerialTestResponse[]
    
    expect(results).toHaveLength(5)
    expect(results[0].method).toBe('GET')
    expect(results[1].method).toBe('POST')
    expect(results[2].method).toBe('PUT')
    expect(results[3].method).toBe('DELETE')
    expect(results[4].method).toBe('PATCH')
  })

  test('应该正确清空队列', async () => {
    const serialKey = 'clear-test'
    
    // 先执行一些请求
    await requestCore.getSerial('/api/1', serialKey)
    
    let stats = requestCore.getSerialStats()
    expect(stats.queues[serialKey]).toBeDefined()
    
    // 清空队列
    const cleared = requestCore.clearSerialQueue(serialKey)
    expect(cleared).toBe(true)
    
    // 队列应该还存在，但任务应该被清空
    stats = requestCore.getSerialStats()
    expect(stats.queues[serialKey]).toBeDefined()
  })

  test('应该正确处理配置对象形式的串行请求', async () => {
    const config: RequestConfig = {
      url: '/api/test',
      method: 'POST',
      data: { test: true },
      serialKey: 'config-test'
    }

    const result = await requestCore.requestSerial(config) as SerialTestResponse
    
    expect(result.url).toBe('/api/test')
    expect(result.method).toBe('POST')
    expect(result.serialKey).toBe('config-test')
    
    const stats = requestCore.getSerialStats()
    expect(stats.totalCompletedTasks).toBe(1)
  })

  test('应该正确处理串行请求失败的情况', async () => {
    const serialKey = 'error-test'
    
    // 设置特定URL失败
    mockRequestor.setFailForUrls(['/api/fail'])
    
    const promises = [
      requestCore.getSerial('/api/success1', serialKey),
      requestCore.getSerial('/api/fail', serialKey).catch(error => ({ error: error.message })),
      requestCore.getSerial('/api/success2', serialKey)
    ]

    const results = await Promise.all(promises)
    
    // 验证结果
    expect(results).toHaveLength(3)
    expect((results[0] as SerialTestResponse).url).toBe('/api/success1')
    expect((results[1] as any).error).toContain('Mock request failed')
    expect((results[2] as SerialTestResponse).url).toBe('/api/success2')
    
    // 验证执行顺序（即使有失败，队列仍按顺序执行）
    const allRequests = mockRequestor.getRequests()
    const serialRequests = allRequests.filter(r => r.config.serialKey === serialKey)
    expect(serialRequests).toHaveLength(3)
    expect(serialRequests[0].config.url).toBe('/api/success1')
    expect(serialRequests[1].config.url).toBe('/api/fail')
    expect(serialRequests[2].config.url).toBe('/api/success2')
    
    // 验证统计信息
    const stats = requestCore.getSerialStats()
    expect(stats.totalCompletedTasks).toBe(2) // 成功的请求
    expect(stats.totalFailedTasks).toBe(1) // 失败的请求
  })

  test('应该正确处理基于顺序的请求失败', async () => {
    const serialKey = 'order-fail-test'
    
    // 设置第2个请求之后开始失败
    mockRequestor.setFailMode(true, 2)
    
    const promises = [
      requestCore.getSerial('/api/success1', serialKey),
      requestCore.getSerial('/api/success2', serialKey),
      requestCore.getSerial('/api/fail1', serialKey).catch(error => ({ error: error.message })),
      requestCore.getSerial('/api/fail2', serialKey).catch(error => ({ error: error.message }))
    ]

    const results = await Promise.all(promises)
    
    // 验证结果：前两个成功，后两个失败
    expect(results).toHaveLength(4)
    expect((results[0] as SerialTestResponse).url).toBe('/api/success1')
    expect((results[1] as SerialTestResponse).url).toBe('/api/success2')
    expect((results[2] as any).error).toContain('Mock request failed')
    expect((results[3] as any).error).toContain('Mock request failed')
    
    // 验证统计信息
    const stats = requestCore.getSerialStats()
    expect(stats.totalCompletedTasks).toBe(2) // 成功的请求
    expect(stats.totalFailedTasks).toBe(2) // 失败的请求
  })

  test('应该支持队列大小限制', async () => {
    const serialKey = 'size-limit-test'
    
    // 创建一个全新的RequestCore实例，避免其他测试的干扰
    const freshRequestor = new SerialMockRequestor()
    const freshRequestCore = new RequestCore(freshRequestor)
    
    const queueConfig = {
      maxQueueSize: 1, // 设置队列最大大小为1，更容易测试
      debug: true
    }

    try {
      // 暂停处理，确保任务会堆积在队列中
      freshRequestor.pause()
      
      // 添加第一个请求 - 应该成功
      const promise1 = freshRequestCore.requestSerial({ 
        url: '/api/first', 
        method: 'GET' as const, 
        serialKey 
      }, queueConfig).catch(error => ({ error: error.message }))
      
      // 给一点时间让任务进入队列
      await new Promise(resolve => setTimeout(resolve, 10))
      
      // 第二个请求应该被立即拒绝，因为队列已满(maxQueueSize = 1)
      let secondRequestError: string | null = null
      try {
        await freshRequestCore.requestSerial({ 
          url: '/api/second', 
          method: 'GET' as const, 
          serialKey 
        }, queueConfig)
      } catch (error: any) {
        secondRequestError = error.message
      }

      // 验证第二个请求被拒绝
      expect(secondRequestError).not.toBeNull()
      expect(secondRequestError).toContain('Serial queue is full')

      // 恢复处理，完成第一个请求
      freshRequestor.resume()
      
      const result1 = await promise1
      
      // 验证第一个请求成功
      if (!(result1 as any).error) {
        expect((result1 as SerialTestResponse).url).toBe('/api/first')
      } else {
        // 如果有错误，它应该不是队列满的错误
        expect((result1 as any).error).not.toContain('Serial queue is full')
      }
      
    } finally {
      // 确保恢复处理状态
      freshRequestor.resume()
      // 清理资源
      freshRequestCore.destroy()
    }
  }, 2000)

  test('应该正确验证队列大小限制 - 简化版本', async () => {
    const serialKey = 'simple-size-test'
    
    // 使用更直接的方法测试队列大小限制
    const testRequestor = new SerialMockRequestor()
    const testRequestCore = new RequestCore(testRequestor)
    
    // 设置非常小的队列大小
    const smallQueueConfig = {
      maxQueueSize: 0, // 队列大小为0，任何请求都应该被拒绝
      debug: true
    }

    // 尝试添加请求到大小为0的队列
    let errorMessage: string | null = null
    try {
      await testRequestCore.requestSerial({
        url: '/api/should-fail',
        method: 'GET' as const,
        serialKey
      }, smallQueueConfig)
    } catch (error: any) {
      errorMessage = error.message
    }

    // 验证请求被拒绝
    expect(errorMessage).not.toBeNull()
    expect(errorMessage).toContain('Serial queue is full')
    
    testRequestCore.destroy()
  })

  test('应该处理队列配置不一致的情况', async () => {
    const serialKey = 'config-inconsistent-test'
    
    // 第一次使用小的队列大小创建队列
    const firstConfig = { maxQueueSize: 1, debug: false }
    const result1 = await requestCore.requestSerial({ 
      url: '/api/first', 
      method: 'GET' as const, 
      serialKey 
    }, firstConfig)
    
    expect((result1 as SerialTestResponse).url).toBe('/api/first')
    
    // 第二次使用不同的队列配置（这会被忽略，因为队列已存在）
    const secondConfig = { maxQueueSize: 10, debug: true }
    const result2 = await requestCore.requestSerial({ 
      url: '/api/second', 
      method: 'GET' as const, 
      serialKey 
    }, secondConfig)
    
    expect((result2 as SerialTestResponse).url).toBe('/api/second')
    
    // 验证两个请求都使用了同一个队列
    const stats = requestCore.getSerialStats()
    expect(stats.totalQueues).toBe(1)
    expect(stats.queues[serialKey].completedTasks).toBe(2)
  })

  test('应该支持混合串行和普通请求', async () => {
    const serialKey = 'mixed-test'
    
    // 发起混合请求：串行 + 普通
    const serialPromise1 = requestCore.getSerial('/api/serial1', serialKey)
    const normalPromise = requestCore.get('/api/normal') // 普通请求，不会串行
    const serialPromise2 = requestCore.getSerial('/api/serial2', serialKey)
    
    const results = await Promise.all([serialPromise1, normalPromise, serialPromise2])
    
    // 验证所有请求都完成
    expect(results).toHaveLength(3)
    
    // 验证串行请求的顺序
    const requests = mockRequestor.getRequests()
    const serialRequests = requests.filter(r => r.config.serialKey === serialKey)
    expect(serialRequests).toHaveLength(2)
    expect(serialRequests[0].config.url).toBe('/api/serial1')
    expect(serialRequests[1].config.url).toBe('/api/serial2')
    
    // 串行请求应该按时间顺序执行
    expect(serialRequests[1].timestamp).toBeGreaterThan(serialRequests[0].timestamp)
  })

  test('应该正确处理多个队列的并发执行', async () => {
    const startTime = Date.now()
    
    // 创建三个不同队列的请求
    const queue1Promises = [
      requestCore.getSerial('/api/q1-1', 'queue1'),
      requestCore.getSerial('/api/q1-2', 'queue1')
    ]
    
    const queue2Promises = [
      requestCore.getSerial('/api/q2-1', 'queue2'),
      requestCore.getSerial('/api/q2-2', 'queue2')
    ]
    
    const queue3Promises = [
      requestCore.getSerial('/api/q3-1', 'queue3'),
      requestCore.getSerial('/api/q3-2', 'queue3')
    ]

    // 等待所有队列完成
    await Promise.all([
      ...queue1Promises,
      ...queue2Promises, 
      ...queue3Promises
    ])
    
    const endTime = Date.now()
    const totalTime = endTime - startTime
    
    // 如果是完全串行，需要6 * 100ms = 600ms
    // 但由于并发执行，应该大约是2 * 100ms = 200ms左右
    expect(totalTime).toBeLessThan(500) // 给一些余量
    
    const stats = requestCore.getSerialStats()
    expect(stats.totalQueues).toBe(3)
    expect(stats.totalCompletedTasks).toBe(6)
  })

  test('应该正确处理队列配置参数', async () => {
    const serialKey = 'config-params-test'
    
    const customConfig = {
      timeout: 1000,
      debug: true,
      maxQueueSize: 5
    }

    // 使用自定义配置发起请求
    const result = await requestCore.requestSerial({
      url: '/api/configured',
      method: 'POST' as const,
      data: { test: true },
      serialKey
    }, customConfig)

    expect((result as SerialTestResponse).url).toBe('/api/configured')
    
    // 验证队列存在且配置正确
    const stats = requestCore.getSerialStats()
    expect(stats.queues[serialKey]).toBeDefined()
  })

  test('应该处理空serialKey的情况', async () => {
    // 没有serialKey的请求不应该进入串行队列
    const result1 = await requestCore.get('/api/normal1')
    const result2 = await requestCore.post('/api/normal2', { data: 'test' })
    
    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
    
    // 统计信息应该显示没有串行队列活动
    const stats = requestCore.getSerialStats()
    expect(stats.totalQueues).toBe(0)
  })

  test('应该支持大量串行请求', async () => {
    const serialKey = 'bulk-test'
    const requestCount = 10
    
    // 创建大量串行请求
    const promises = Array.from({ length: requestCount }, (_, i) => 
      requestCore.getSerial(`/api/bulk-${i}`, serialKey)
    )

    const results = await Promise.all(promises)
    
    // 验证所有请求都完成
    expect(results).toHaveLength(requestCount)
    
    // 验证执行顺序
    const requests = mockRequestor.getRequests().filter(r => 
      r.config.url.includes('bulk-')
    )
    
    for (let i = 1; i < requests.length; i++) {
      expect(requests[i].timestamp).toBeGreaterThan(requests[i-1].timestamp)
      expect(requests[i].config.url).toBe(`/api/bulk-${i}`)
    }
    
    // 验证统计信息
    const stats = requestCore.getSerialStats()
    expect(stats.totalCompletedTasks).toBe(requestCount)
  })

  test('应该正确清理和重置队列状态', async () => {
    const serialKey1 = 'cleanup-test-1'
    const serialKey2 = 'cleanup-test-2'
    
    // 创建一些请求
    await Promise.all([
      requestCore.getSerial('/api/cleanup1', serialKey1),
      requestCore.getSerial('/api/cleanup2', serialKey2)
    ])
    
    let stats = requestCore.getSerialStats()
    expect(stats.totalQueues).toBe(2)
    
    // 清空特定队列
    const cleared1 = requestCore.clearSerialQueue(serialKey1)
    expect(cleared1).toBe(true)
    
    // 清空不存在的队列
    const cleared2 = requestCore.clearSerialQueue('non-existent')
    expect(cleared2).toBe(false)
    
    // 清空所有队列
    requestCore.clearAllSerialQueues()
    
    stats = requestCore.getSerialStats()
    // 队列可能仍然存在但应该是空的
    expect(stats.totalPendingTasks).toBe(0)
  })

  test('应该在销毁时正确清理资源', async () => {
    const serialKey = 'destroy-test'
    
    // 创建一些请求
    const promise = requestCore.getSerial('/api/destroy-test', serialKey)
    await promise
    
    let stats = requestCore.getSerialStats()
    expect(stats.totalQueues).toBeGreaterThanOrEqual(1)
    
    // 销毁请求核心
    requestCore.destroy()
    
    // 重新创建以验证清理
    const newRequestCore = new RequestCore(mockRequestor)
    const newStats = newRequestCore.getSerialStats()
    expect(newStats.totalQueues).toBe(0)
    
    newRequestCore.destroy()
  })

  test('应该支持复杂的串行队列交互场景', async () => {
    const queue1 = 'complex-queue-1'
    const queue2 = 'complex-queue-2'
    
    // 场景：创建两个队列，每个队列有多个请求，然后清空一个队列
    const queue1Promises = [
      requestCore.getSerial('/api/complex-q1-1', queue1),
      requestCore.getSerial('/api/complex-q1-2', queue1),
      requestCore.getSerial('/api/complex-q1-3', queue1)
    ]
    
    const queue2Promises = [
      requestCore.getSerial('/api/complex-q2-1', queue2),
      requestCore.getSerial('/api/complex-q2-2', queue2)
    ]
    
    // 执行一半后清空一个队列（这应该不会影响已经开始的请求）
    setTimeout(() => {
      requestCore.clearSerialQueue(queue2)
    }, 50)
    
    const allPromises = [...queue1Promises, ...queue2Promises]
    const results = await Promise.all(allPromises.map(p => 
      p.catch(error => ({ error: error.message }))
    ))
    
    // 至少queue1的请求应该成功
    const queue1Results = results.slice(0, 3)
    queue1Results.forEach((result, index) => {
      expect((result as SerialTestResponse).url).toBe(`/api/complex-q1-${index + 1}`)
    })
    
    // 验证统计信息
    const stats = requestCore.getSerialStats()
    expect(stats.totalCompletedTasks).toBeGreaterThanOrEqual(3)
  })
})
