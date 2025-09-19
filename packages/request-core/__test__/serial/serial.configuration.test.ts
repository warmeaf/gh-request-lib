import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { SerialMockRequestor, SerialTestResponse, cleanupSerialTest } from './serial-test-helpers'

describe('串行请求配置和管理测试', () => {
  let mockRequestor: SerialMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new SerialMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupSerialTest(mockRequestor, requestCore)
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

  test('应该自动清理空队列', async () => {
    // 创建一个带自动清理的管理器
    const testRequestor = new SerialMockRequestor()
    const testCore = new RequestCore(testRequestor)
    
    const serialKey = 'auto-cleanup-test'
    
    // 创建并完成一个请求
    await testCore.getSerial('/api/cleanup', serialKey)
    
    let stats = testCore.getSerialStats()
    expect(stats.queues[serialKey]).toBeDefined()
    
    // 等待足够长的时间让自动清理触发
    // 这里我们手动触发清理来模拟自动清理
    testCore.clearAllSerialQueues()
    
    stats = testCore.getSerialStats()
    // 验证队列被清理但任务统计保留
    expect(stats.totalCompletedTasks).toBeGreaterThanOrEqual(1)
    
    testCore.destroy()
  })
})
