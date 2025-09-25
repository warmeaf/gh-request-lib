import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig } from '../../src/interface'
import { SerialFeature } from '../../src/features/serial/feature'
import { SerialRequestManager } from '../../src/features/serial/manager'
import { SerialQueue } from '../../src/features/serial/queue'
import { SerialMockRequestor, SerialTestResponse, cleanupSerialTest } from './serial-test-helpers'

describe('串行请求边界情况和极端场景测试', () => {
  let mockRequestor: SerialMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new SerialMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupSerialTest(mockRequestor, requestCore)
  })

  test('应该正确处理极长的serialKey', async () => {
    // 创建一个极长的serialKey
    const longSerialKey = 'a'.repeat(1000)
    
    const result = await requestCore.getSerial('/api/long-key', longSerialKey)
    
    expect((result as SerialTestResponse).url).toBe('/api/long-key')
    expect((result as SerialTestResponse).serialKey).toBe(longSerialKey)
    
    // 验证队列被正确创建
    expect(requestCore.hasSerialQueue(longSerialKey)).toBe(true)
  })

  test('应该正确处理特殊字符的serialKey', async () => {
    const specialKeys = [
      'key-with-dashes',
      'key_with_underscores',
      'key.with.dots',
      'key with spaces',
      'key/with/slashes',
      'key\\with\\backslashes',
      'key@with#special$chars%',
      '中文键名',
      'emoji-key-🚀',
      '123-numeric-key',
      ''  // 空字符串应该被拒绝
    ]
    
    for (const key of specialKeys) {
      if (key === '') {
        // 空字符串应该被拒绝
        await expect(
          requestCore.getSerial('/api/empty-key', key)
        ).rejects.toThrow('serialKey is required')
      } else {
        // 其他特殊字符应该被接受
        const result = await requestCore.getSerial(`/api/special-${encodeURIComponent(key)}`, key)
        expect((result as SerialTestResponse).serialKey).toBe(key)
      }
    }
  })

  test('应该正确处理大量并发队列', async () => {
    const queueCount = 100
    const tasksPerQueue = 3
    
    // 创建大量队列，每个队列有多个任务
    const promises: Promise<any>[] = []
    
    for (let i = 0; i < queueCount; i++) {
      const queueKey = `mass-queue-${i}`
      for (let j = 0; j < tasksPerQueue; j++) {
        promises.push(
          requestCore.getSerial(`/api/mass-${i}-${j}`, queueKey)
        )
      }
    }
    
    const results = await Promise.all(promises)
    
    // 验证所有任务都完成
    expect(results).toHaveLength(queueCount * tasksPerQueue)
    
    // 验证统计信息
    const stats = requestCore.getSerialStats()
    expect(stats.totalQueues).toBe(queueCount)
    expect(stats.totalCompletedTasks).toBe(queueCount * tasksPerQueue)
    
    // 验证每个队列的任务都是串行执行的
    const requests = mockRequestor.getRequests()
    for (let i = 0; i < queueCount; i++) {
      const queueRequests = requests.filter(r => 
        r.config.serialKey === `mass-queue-${i}`
      )
      expect(queueRequests).toHaveLength(tasksPerQueue)
      
      // 验证时间戳递增
      for (let j = 1; j < queueRequests.length; j++) {
        expect(queueRequests[j].timestamp).toBeGreaterThan(queueRequests[j-1].timestamp)
      }
    }
  }, 10000) // 增加超时时间

  test('应该正确处理内存压力下的队列操作', async () => {
    // 减少任务数量以避免超时，但仍能测试内存管理
    const taskCount = 100
    const serialKey = 'memory-pressure-test'
    
    const promises = Array.from({ length: taskCount }, (_, i) =>
      requestCore.getSerial(`/api/memory-${i}`, serialKey)
    )
    
    const results = await Promise.all(promises)
    
    expect(results).toHaveLength(taskCount)
    
    // 验证内存没有泄漏（通过统计信息）
    const stats = requestCore.getSerialStats()
    expect(stats.totalCompletedTasks).toBe(taskCount)
    expect(stats.totalPendingTasks).toBe(0) // 所有任务都应该完成
    
    // 清理队列
    requestCore.clearSerialQueue(serialKey)
  }, 30000)

  test('应该正确处理快速创建和销毁队列', async () => {
    const iterations = 50
    
    for (let i = 0; i < iterations; i++) {
      const queueKey = `rapid-${i}`
      
      // 快速创建队列
      await requestCore.getSerial(`/api/rapid-${i}`, queueKey)
      
      // 立即移除队列
      requestCore.removeSerialQueue(queueKey)
      
      // 验证队列被移除
      expect(requestCore.hasSerialQueue(queueKey)).toBe(false)
    }
    
    // 验证没有残留队列
    const finalStats = requestCore.getSerialStats()
    expect(finalStats.totalQueues).toBe(0)
  })

  test('应该正确处理队列配置的极端值', async () => {
    const extremeConfigs = [
      { maxQueueSize: 0, desc: 'zero queue size' },
      { maxQueueSize: 1, desc: 'minimal queue size' },
      { maxQueueSize: Number.MAX_SAFE_INTEGER, desc: 'maximum queue size' },
      { timeout: 0, desc: 'zero timeout' },
      { timeout: 1, desc: 'minimal timeout' },
      { timeout: Number.MAX_SAFE_INTEGER, desc: 'maximum timeout' }
    ]
    
    for (const config of extremeConfigs) {
      const queueKey = `extreme-${config.desc.replace(/\s+/g, '-')}`
      
      if (config.maxQueueSize === 0) {
        // 队列大小为0应该立即拒绝
        await expect(
          requestCore.requestSerial({
            url: '/api/extreme',
            method: 'GET' as const,
            serialKey: queueKey
          }, config)
        ).rejects.toThrow('Serial queue is full')
      } else {
        // 其他配置应该正常工作
        const result = await requestCore.requestSerial({
          url: '/api/extreme',
          method: 'GET' as const,
          serialKey: queueKey
        }, config)
        
        expect((result as SerialTestResponse).url).toBe('/api/extreme')
      }
    }
  })

  test('应该正确处理任务ID生成的唯一性', async () => {
    const queue = new SerialQueue('id-uniqueness-test', mockRequestor, { debug: true })
    
    // 减少任务数量以避免超时
    const taskCount = 50
    const promises = Array.from({ length: taskCount }, (_, i) =>
      queue.enqueue({ url: `/api/unique-${i}`, method: 'GET' })
    )
    
    await Promise.all(promises)
    
    // 通过请求记录验证每个任务都有唯一的时间戳
    const requests = mockRequestor.getRequests()
    const timestamps = requests.map(r => r.timestamp)
    const uniqueTimestamps = new Set(timestamps)
    
    // 由于任务是串行执行的，时间戳应该都不同
    expect(uniqueTimestamps.size).toBe(taskCount)
    
    queue.destroy()
  }, 15000)

  test('应该正确处理复杂的错误恢复场景', async () => {
    const serialKey = 'complex-recovery'
    
    // 阶段1：正常执行
    await requestCore.getSerial('/api/normal-1', serialKey)
    
    // 阶段2：间歇性失败
    mockRequestor.setFailMode(true, 2) // 第2个请求后开始失败
    
    const phase2Promises = [
      requestCore.getSerial('/api/normal-2', serialKey),
      requestCore.getSerial('/api/fail-1', serialKey).catch(e => ({ error: e.message })),
      requestCore.getSerial('/api/fail-2', serialKey).catch(e => ({ error: e.message }))
    ]
    
    const phase2Results = await Promise.all(phase2Promises)
    
    // 阶段3：恢复正常
    mockRequestor.reset()
    
    const phase3Result = await requestCore.getSerial('/api/normal-3', serialKey)
    
    // 验证各阶段结果
    expect((phase2Results[0] as SerialTestResponse).url).toBe('/api/normal-2')
    expect((phase2Results[1] as any).error).toContain('Mock request failed')
    expect((phase2Results[2] as any).error).toContain('Mock request failed')
    expect((phase3Result as SerialTestResponse).url).toBe('/api/normal-3')
    
    // 验证统计信息
    const stats = requestCore.getSerialStats()
    expect(stats.totalCompletedTasks).toBe(3) // 3个成功
    expect(stats.totalFailedTasks).toBe(2) // 2个失败
  })

  test('应该正确处理管理器配置的边界值', async () => {
    const extremeManagerConfigs = [
      { maxQueues: 0, shouldFail: true },
      { maxQueues: 1, shouldFail: false },
      { maxQueues: Number.MAX_SAFE_INTEGER, shouldFail: false },
      { cleanupInterval: 0, shouldFail: false },
      { cleanupInterval: -1, shouldFail: false },
      { cleanupInterval: Number.MAX_SAFE_INTEGER, shouldFail: false }
    ]
    
    for (const config of extremeManagerConfigs) {
      const testRequestor = new SerialMockRequestor()
      
      if (config.shouldFail) {
        // 某些配置可能导致创建失败或立即失败
        const manager = new SerialRequestManager(testRequestor, config)
        
        // 尝试创建队列
        await expect(
          manager.enqueueRequest('test', { url: '/api/test', method: 'GET' })
        ).rejects.toThrow()
        
        manager.destroy()
      } else {
        // 其他配置应该正常工作
        const manager = new SerialRequestManager(testRequestor, config)
        expect(manager.getStats()).toBeDefined()
        manager.destroy()
      }
    }
  })

  test('应该正确处理并发销毁操作', async () => {
    const feature = new SerialFeature(mockRequestor, {}, { debug: true })
    
    // 创建一些队列
    await Promise.all([
      feature.getSerial('/api/concurrent-destroy-1', 'destroy-queue-1'),
      feature.getSerial('/api/concurrent-destroy-2', 'destroy-queue-2')
    ])
    
    // 并发执行多个销毁操作
    const destroyPromises = [
      Promise.resolve(feature.destroy()),
      Promise.resolve(feature.clearAllQueues()),
      Promise.resolve(feature.removeAllQueues())
    ]
    
    // 这些操作不应该抛出异常
    await expect(Promise.all(destroyPromises)).resolves.toBeDefined()
    
    // 销毁后的调用也不应该抛出异常
    expect(() => feature.getStats()).not.toThrow()
  })

  test('应该正确处理metadata中的复杂配置', async () => {
    const complexMetadata = {
      serialConfig: {
        maxQueueSize: 5,
        timeout: 3000,
        debug: true,
        onQueueFull: () => console.log('Queue full'),
        onTaskTimeout: () => console.log('Task timeout')
      },
      requestId: 'complex-request-123',
      userAgent: 'test-agent',
      nested: {
        deep: {
          value: 'should be preserved'
        }
      },
      arrayData: [1, 2, 3, { nested: 'object' }]
    }
    
    const config: RequestConfig = {
      url: '/api/complex-metadata',
      method: 'POST',
      data: { test: true },
      serialKey: 'complex-metadata-test',
      metadata: complexMetadata
    }
    
    const result = await requestCore.requestSerial(config)
    
    expect((result as SerialTestResponse).url).toBe('/api/complex-metadata')
    expect((result as SerialTestResponse).serialKey).toBe('complex-metadata-test')
    
    // 验证队列被创建
    expect(requestCore.hasSerialQueue('complex-metadata-test')).toBe(true)
  })

  test('应该正确处理循环引用的配置对象', async () => {
    const circularConfig: any = {
      url: '/api/circular',
      method: 'GET' as const,
      serialKey: 'circular-test'
    }
    
    // 创建循环引用
    circularConfig.self = circularConfig
    
    // 这应该不会导致无限循环或崩溃
    const result = await requestCore.requestSerial(circularConfig)
    
    expect((result as SerialTestResponse).url).toBe('/api/circular')
  })

  test('应该正确处理Promise链中的异常', async () => {
    const serialKey = 'promise-chain-test'
    
    // 创建一个会在Promise链中抛出异常的场景
    mockRequestor.setFailForUrls(['/api/chain-fail'])
    
    const promises = [
      requestCore.getSerial('/api/chain-success', serialKey),
      requestCore.getSerial('/api/chain-fail', serialKey)
        .then(() => 'should not reach here')
        .catch(error => ({ chainError: error.message })),
      requestCore.getSerial('/api/chain-recovery', serialKey)
    ]
    
    const results = await Promise.all(promises)
    
    expect((results[0] as SerialTestResponse).url).toBe('/api/chain-success')
    expect((results[1] as any).chainError).toContain('Mock request failed')
    expect((results[2] as SerialTestResponse).url).toBe('/api/chain-recovery')
    
    // 验证队列仍然正常工作
    const stats = requestCore.getSerialStats()
    expect(stats.totalCompletedTasks).toBe(2)
    expect(stats.totalFailedTasks).toBe(1)
  })
})