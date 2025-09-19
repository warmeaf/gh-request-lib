import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig } from '../../src/interface'
import { SerialMockRequestor, SerialTestResponse, cleanupSerialTest } from './serial-test-helpers'

describe('串行请求基础功能测试', () => {
  let mockRequestor: SerialMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new SerialMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupSerialTest(mockRequestor, requestCore)
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
})