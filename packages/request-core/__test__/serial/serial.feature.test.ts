import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig } from '../../src/interface'
import { SerialFeature } from '../../src/features/serial/feature'
import { SerialMockRequestor, SerialTestResponse, cleanupSerialTest } from './serial-test-helpers'

describe('串行请求功能类测试', () => {
  let mockRequestor: SerialMockRequestor
  let requestCore: RequestCore

  beforeEach(() => {
    mockRequestor = new SerialMockRequestor()
    requestCore = new RequestCore(mockRequestor)
  })

  afterEach(async () => {
    await cleanupSerialTest(mockRequestor, requestCore)
  })

  test('应该正确创建和初始化SerialFeature', () => {
    const feature = new SerialFeature(mockRequestor, {
      debug: true,
      maxQueues: 10
    }, {
      debug: true
    })

    expect(feature.isEnabled()).toBe(true)
    expect(feature.getStats()).toBeDefined()
    expect(feature.getQueueKeys()).toEqual([])
    
    feature.destroy()
  })

  test('应该正确处理handleSerialRequest方法', async () => {
    const feature = new SerialFeature(mockRequestor, {}, { debug: true })
    
    // 测试不带serialKey的请求 - 应该直接执行
    const normalConfig: RequestConfig = {
      url: '/api/normal',
      method: 'GET'
    }
    
    const normalResult = await feature.handleSerialRequest(normalConfig)
    expect((normalResult as SerialTestResponse).url).toBe('/api/normal')
    
    // 测试带serialKey的请求 - 应该通过串行队列处理
    const serialConfig: RequestConfig = {
      url: '/api/serial',
      method: 'POST',
      data: { test: true },
      serialKey: 'handle-test'
    }
    
    const serialResult = await feature.handleSerialRequest(serialConfig)
    expect((serialResult as SerialTestResponse).url).toBe('/api/serial')
    expect((serialResult as SerialTestResponse).serialKey).toBe('handle-test')
    
    // 验证队列统计
    const stats = feature.getStats()
    expect(stats.totalCompletedTasks).toBe(1) // 只有串行请求会被统计
    
    feature.destroy()
  })

  test('应该正确处理processSerialRequest私有方法', async () => {
    const feature = new SerialFeature(mockRequestor, {}, { debug: true })
    
    // 通过拦截器触发processSerialRequest
    const config: RequestConfig = {
      url: '/api/process-serial',
      method: 'GET',
      serialKey: 'process-test'
    }
    
    // 使用handleSerialRequest来间接测试processSerialRequest
    const result = await feature.handleSerialRequest(config)
    
    expect((result as SerialTestResponse).url).toBe('/api/process-serial')
    expect((result as SerialTestResponse).serialKey).toBe('process-test')
    
    // 验证队列被创建
    expect(feature.hasQueue('process-test')).toBe(true)
    
    feature.destroy()
  })

  test('应该正确处理所有HTTP方法的串行请求', async () => {
    const feature = new SerialFeature(mockRequestor, {}, { debug: true })
    
    const serialKey = 'http-methods-test'
    const testData = { test: 'data' }
    
    // 测试所有HTTP方法
    const results = await Promise.all([
      feature.getSerial('/api/get', serialKey),
      feature.postSerial('/api/post', serialKey, testData),
      feature.putSerial('/api/put', serialKey, testData),
      feature.deleteSerial('/api/delete', serialKey),
      feature.patchSerial('/api/patch', serialKey, testData)
    ])
    
    // 验证结果
    expect(results).toHaveLength(5)
    expect((results[0] as SerialTestResponse).method).toBe('GET')
    expect((results[1] as SerialTestResponse).method).toBe('POST')
    expect((results[2] as SerialTestResponse).method).toBe('PUT')
    expect((results[3] as SerialTestResponse).method).toBe('DELETE')
    expect((results[4] as SerialTestResponse).method).toBe('PATCH')
    
    // 验证数据传递
    expect((results[1] as SerialTestResponse).data).toEqual(testData)
    expect((results[2] as SerialTestResponse).data).toEqual(testData)
    expect((results[4] as SerialTestResponse).data).toEqual(testData)
    
    // 验证串行执行顺序
    const requests = mockRequestor.getRequests()
    const serialRequests = requests.filter(r => r.config.serialKey === serialKey)
    expect(serialRequests).toHaveLength(5)
    
    for (let i = 1; i < serialRequests.length; i++) {
      expect(serialRequests[i].timestamp).toBeGreaterThan(serialRequests[i-1].timestamp)
    }
    
    feature.destroy()
  })

  test('应该正确处理requestSerial方法的参数验证', async () => {
    const feature = new SerialFeature(mockRequestor)
    
    // 测试缺少serialKey的情况
    const configWithoutSerialKey: RequestConfig = {
      url: '/api/no-serial-key',
      method: 'GET'
    }
    
    await expect(feature.requestSerial(configWithoutSerialKey)).rejects.toThrow('serialKey is required')
    
    // 测试空字符串serialKey
    const configWithEmptySerialKey: RequestConfig = {
      url: '/api/empty-serial-key',
      method: 'GET',
      serialKey: ''
    }
    
    await expect(feature.requestSerial(configWithEmptySerialKey)).rejects.toThrow('serialKey is required')
    
    feature.destroy()
  })

  test('应该正确处理队列管理操作', async () => {
    const feature = new SerialFeature(mockRequestor, {}, { debug: true })
    
    const queue1 = 'queue-mgmt-1'
    const queue2 = 'queue-mgmt-2'
    
    // 创建一些队列
    await Promise.all([
      feature.getSerial('/api/q1-1', queue1),
      feature.getSerial('/api/q1-2', queue1),
      feature.getSerial('/api/q2-1', queue2)
    ])
    
    // 验证队列存在
    expect(feature.hasQueue(queue1)).toBe(true)
    expect(feature.hasQueue(queue2)).toBe(true)
    expect(feature.hasQueue('non-existent')).toBe(false)
    
    // 获取队列键
    const queueKeys = feature.getQueueKeys()
    expect(queueKeys).toContain(queue1)
    expect(queueKeys).toContain(queue2)
    expect(queueKeys).toHaveLength(2)
    
    // 获取队列统计
    const queue1Stats = feature.getQueueStats(queue1)
    const queue2Stats = feature.getQueueStats(queue2)
    expect(queue1Stats).toBeDefined()
    expect(queue1Stats!.completedTasks).toBe(2)
    expect(queue2Stats).toBeDefined()
    expect(queue2Stats!.completedTasks).toBe(1)
    
    // 获取不存在队列的统计
    const nonExistentStats = feature.getQueueStats('non-existent')
    expect(nonExistentStats).toBeNull()
    
    // 清空特定队列
    const cleared1 = feature.clearQueue(queue1)
    expect(cleared1).toBe(true)
    
    const clearedNonExistent = feature.clearQueue('non-existent')
    expect(clearedNonExistent).toBe(false)
    
    // 移除队列
    const removed1 = feature.removeQueue(queue1)
    expect(removed1).toBe(true)
    expect(feature.hasQueue(queue1)).toBe(false)
    
    const removedNonExistent = feature.removeQueue('non-existent')
    expect(removedNonExistent).toBe(false)
    
    // 清空所有队列
    feature.clearAllQueues()
    
    // 移除所有队列
    feature.removeAllQueues()
    expect(feature.getQueueKeys()).toHaveLength(0)
    
    feature.destroy()
  })

  test('应该正确处理功能启用和禁用', async () => {
    const feature = new SerialFeature(mockRequestor, {}, { debug: true })
    
    // 默认应该是启用状态
    expect(feature.isEnabled()).toBe(true)
    
    // 禁用功能
    feature.disable()
    expect(feature.isEnabled()).toBe(false)
    
    // 禁用状态下的请求应该直接执行（不进入串行队列）
    const result1 = await feature.handleSerialRequest({
      url: '/api/disabled',
      method: 'GET',
      serialKey: 'disabled-test'
    })
    
    expect((result1 as SerialTestResponse).url).toBe('/api/disabled')
    
    // 验证没有创建队列
    expect(feature.hasQueue('disabled-test')).toBe(false)
    
    // 重新启用
    feature.enable()
    expect(feature.isEnabled()).toBe(true)
    
    // 启用后应该正常工作
    const result2 = await feature.handleSerialRequest({
      url: '/api/enabled',
      method: 'GET',
      serialKey: 'enabled-test'
    })
    
    expect((result2 as SerialTestResponse).url).toBe('/api/enabled')
    expect(feature.hasQueue('enabled-test')).toBe(true)
    
    feature.destroy()
  })

  test('应该正确处理手动清理操作', async () => {
    const feature = new SerialFeature(mockRequestor, {
      autoCleanup: false // 禁用自动清理
    }, { debug: true })
    
    // 创建并完成一些请求
    await feature.getSerial('/api/cleanup-1', 'cleanup-queue')
    
    // 验证队列存在
    expect(feature.hasQueue('cleanup-queue')).toBe(true)
    
    // 手动触发清理
    feature.cleanup()
    
    // 由于队列是空的，应该被清理掉
    // 注意：这取决于具体的清理实现
    const stats = feature.getStats()
    expect(stats).toBeDefined()
    
    feature.destroy()
  })

  test('应该正确处理销毁操作', async () => {
    const feature = new SerialFeature(mockRequestor, {}, { debug: true })
    
    // 创建一些队列和任务
    await Promise.all([
      feature.getSerial('/api/destroy-1', 'destroy-queue-1'),
      feature.getSerial('/api/destroy-2', 'destroy-queue-2')
    ])
    
    // 验证功能正常
    expect(feature.getQueueKeys()).toHaveLength(2)
    expect(feature.isEnabled()).toBe(true)
    
    // 销毁功能
    feature.destroy()
    
    // 销毁后调用方法不应该抛出异常
    expect(() => feature.getStats()).not.toThrow()
    expect(() => feature.getQueueKeys()).not.toThrow()
    expect(() => feature.isEnabled()).not.toThrow()
  })

  test('应该正确获取拦截器和管理器实例', () => {
    const feature = new SerialFeature(mockRequestor)
    
    const interceptor = feature.getInterceptor()
    const manager = feature.getManager()
    
    expect(interceptor).toBeDefined()
    expect(manager).toBeDefined()
    
    // 验证实例类型
    expect(typeof interceptor.onRequest).toBe('function')
    expect(typeof manager.enqueueRequest).toBe('function')
    
    feature.destroy()
  })

  test('应该正确处理带有队列配置的请求', async () => {
    const feature = new SerialFeature(mockRequestor, {}, { debug: true })
    
    const queueConfig = {
      maxQueueSize: 5,
      timeout: 10000,
      debug: true
    }
    
    const config: RequestConfig = {
      url: '/api/with-queue-config',
      method: 'POST',
      data: { test: true },
      serialKey: 'config-test'
    }
    
    const result = await feature.requestSerial(config, queueConfig)
    
    expect((result as SerialTestResponse).url).toBe('/api/with-queue-config')
    expect((result as SerialTestResponse).serialKey).toBe('config-test')
    
    // 验证队列被创建
    expect(feature.hasQueue('config-test')).toBe(true)
    
    feature.destroy()
  })
})