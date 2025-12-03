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
    
    // 发起三个串行请求 - 使用 serialKey 配置
    const promises = [
      requestCore.get('/api/1', { serialKey }),
      requestCore.get('/api/2', { serialKey }),
      requestCore.get('/api/3', { serialKey })
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
    // 发起两个不同队列的请求 - 使用 serialKey 配置
    const promises = [
      requestCore.get('/api/queue1-1', { serialKey: 'queue1' }),
      requestCore.get('/api/queue2-1', { serialKey: 'queue2' }),
      requestCore.get('/api/queue1-2', { serialKey: 'queue1' }),
      requestCore.get('/api/queue2-2', { serialKey: 'queue2' })
    ]

    const results = await Promise.all(promises)
    
    // 验证所有请求都完成了
    expect(results).toHaveLength(4)
  })

  test('应该正确执行串行请求', async () => {
    const serialKey = 'stats-test'
    
    // 发起一些请求 - 使用 serialKey 配置
    await Promise.all([
      requestCore.get('/api/1', { serialKey }),
      requestCore.post('/api/2', { data: 'test' }, { serialKey })
    ])

    // 验证请求已执行
    const requests = mockRequestor.getRequests()
    expect(requests.length).toBeGreaterThanOrEqual(2)
  })

  test('应该支持不同的HTTP请求方法', async () => {
    const serialKey = 'methods-test'
    
    const promises = [
      requestCore.get('/api/get', { serialKey }),
      requestCore.post('/api/post', { data: 'test' }, { serialKey }),
      requestCore.put('/api/put', { data: 'update' }, { serialKey }),
      requestCore.delete('/api/delete', { serialKey }),
      requestCore.patch('/api/patch', { data: 'patch' }, { serialKey })
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
    
    // 先执行一些请求 - 使用 serialKey 配置
    await requestCore.get('/api/1', { serialKey })
    
    // 清空队列
    const cleared = requestCore.clearSerialQueue(serialKey)
    expect(cleared).toBe(true)
  })

  test('应该正确处理配置对象形式的串行请求', async () => {
    const config: RequestConfig = {
      url: '/api/test',
      method: 'POST',
      data: { test: true },
      serialKey: 'config-test'
    }

    const result = await requestCore.request(config) as SerialTestResponse
    
    expect(result.url).toBe('/api/test')
    expect(result.method).toBe('POST')
    expect(result.serialKey).toBe('config-test')
  })

  test('应该处理空serialKey的情况', async () => {
    // 没有serialKey的请求不应该进入串行队列
    const result1 = await requestCore.get('/api/normal1')
    const result2 = await requestCore.post('/api/normal2', { data: 'test' })
    
    expect(result1).toBeDefined()
    expect(result2).toBeDefined()
  })

  test('应该支持大量串行请求', async () => {
    const serialKey = 'bulk-test'
    const requestCount = 10
    
    // 创建大量串行请求 - 使用 serialKey 配置
    const promises = Array.from({ length: requestCount }, (_, i) => 
      requestCore.get(`/api/bulk-${i}`, { serialKey })
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
  })
})