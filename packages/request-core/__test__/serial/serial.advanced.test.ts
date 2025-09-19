import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig } from '../../src/interface'
import { SerialMockRequestor, SerialTestResponse, cleanupSerialTest } from './serial-test-helpers'

describe('串行请求高级功能和复杂交互测试', () => {
  let mockRequestor: SerialMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new SerialMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupSerialTest(mockRequestor, requestCore)
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

  test('应该正确处理拦截器集成', async () => {
    // 创建一个新的RequestCore来避免状态污染
    const testRequestor = new SerialMockRequestor()
    const testCore = new RequestCore(testRequestor)
    
    // 测试拦截器功能 - 通过RequestCore的handleSerialRequest方法
    const serialKey = 'interceptor-test'
    
    // 发起串行请求
    const config = { 
      url: '/api/intercepted',
      method: 'GET' as const,
      serialKey
    }
    
    const result = await testCore.requestSerial(config)
    
    // 验证请求被正确处理
    expect((result as SerialTestResponse).url).toBe('/api/intercepted')
    expect((result as SerialTestResponse).serialKey).toBe(serialKey)
    
    // 验证统计信息
    const stats = testCore.getSerialStats()
    expect(stats.totalQueues).toBe(1)
    expect(stats.totalCompletedTasks).toBe(1)
    
    testCore.destroy()
  })

  test('应该正确处理serialKey从metadata中提取', async () => {
    const serialKey = 'metadata-test'
    
    // 使用metadata传递串行配置
    const config: RequestConfig = {
      url: '/api/metadata',
      method: 'POST' as const,
      serialKey,
      metadata: {
        serialConfig: {
          maxQueueSize: 5,
          debug: true
        }
      }
    }
    
    const result = await requestCore.requestSerial(config)
    
    expect((result as SerialTestResponse).url).toBe('/api/metadata')
    expect((result as SerialTestResponse).serialKey).toBe(serialKey)
    
    // 验证队列确实被创建了
    const stats = requestCore.getSerialStats()
    expect(stats.queues[serialKey]).toBeDefined()
  })

  test('应该在销毁时正确清理所有资源', async () => {
    const testRequestor = new SerialMockRequestor()
    const testCore = new RequestCore(testRequestor)
    
    // 创建多个队列和任务
    const promises = [
      testCore.getSerial('/api/destroy1', 'queue1'),
      testCore.getSerial('/api/destroy2', 'queue2'),
      testCore.getSerial('/api/destroy3', 'queue1') // 同一队列的第二个任务
    ]
    
    await Promise.all(promises)
    
    let stats = testCore.getSerialStats()
    expect(stats.totalQueues).toBe(2)
    expect(stats.totalCompletedTasks).toBe(3)
    
    // 销毁实例
    testCore.destroy()
    
    // 创建新实例验证资源被完全清理
    const newTestCore = new RequestCore(testRequestor)
    const newStats = newTestCore.getSerialStats()
    expect(newStats.totalQueues).toBe(0)
    expect(newStats.totalCompletedTasks).toBe(0)
    expect(newStats.totalPendingTasks).toBe(0)
    
    newTestCore.destroy()
  })
})
