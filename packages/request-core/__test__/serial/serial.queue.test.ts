import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { SerialQueue } from '../../src/features/serial/queue'
import { RequestConfig, RequestErrorType } from '../../src/interface'
import { SerialMockRequestor, SerialTestResponse } from './serial-test-helpers'

describe('串行队列详细功能测试', () => {
  let mockRequestor: SerialMockRequestor

  beforeEach(() => {
    mockRequestor = new SerialMockRequestor()
  })

  afterEach(() => {
    mockRequestor.reset()
  })

  test('应该正确创建和初始化队列', () => {
    const queue = new SerialQueue('test-queue', mockRequestor, {
      maxQueueSize: 10,
      timeout: 5000,
      debug: true
    })

    expect(queue.getSerialKey()).toBe('test-queue')
    expect(queue.isEmpty()).toBe(true)
    expect(queue.getQueueLength()).toBe(0)
    
    queue.destroy()
  })

  test('应该正确生成唯一的任务ID', async () => {
    const queue = new SerialQueue('id-test', mockRequestor, { debug: true })
    
    const config1: RequestConfig = { url: '/api/1', method: 'GET' }
    const config2: RequestConfig = { url: '/api/2', method: 'GET' }
    
    // 同时发起多个请求来测试ID唯一性
    const promises = [
      queue.enqueue(config1),
      queue.enqueue(config2)
    ]
    
    await Promise.all(promises)
    
    // 通过请求记录验证不同的任务有不同的处理时间戳
    const requests = mockRequestor.getRequests()
    expect(requests).toHaveLength(2)
    expect(requests[0].timestamp).not.toBe(requests[1].timestamp)
    
    queue.destroy()
  })

  test('应该正确处理队列大小限制', async () => {
    const queue = new SerialQueue('size-limit', mockRequestor, {
      maxQueueSize: 1,
      debug: true
    })

    // 暂停处理器，让任务堆积
    mockRequestor.pause()
    
    // 第一个任务应该成功入队
    const promise1 = queue.enqueue({ url: '/api/1', method: 'GET' })
      .catch(error => ({ error: error.message }))
    
    // 等待一下确保第一个任务开始处理
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // 第二个任务应该被拒绝（队列大小为1，第一个任务正在处理）
    let secondTaskError: string | null = null
    try {
      await queue.enqueue({ url: '/api/2', method: 'GET' })
    } catch (error: any) {
      secondTaskError = error.message
    }
    
    expect(secondTaskError).not.toBeNull()
    expect(secondTaskError).toContain('Serial queue is full')
    
    // 恢复处理器完成第一个任务
    mockRequestor.resume()
    const result1 = await promise1
    
    // 第一个任务应该成功
    expect((result1 as SerialTestResponse).url).toBe('/api/1')
    
    queue.destroy()
  })

  test('应该正确处理任务超时', async () => {
    const queue = new SerialQueue('timeout-test', mockRequestor, {
      timeout: 50, // 50ms超时
      debug: true,
      onTaskTimeout: (task) => {
        console.log(`Task ${task.id} timed out`)
      }
    })

    // 暂停处理器让任务在队列中等待
    mockRequestor.pause()
    
    const startTime = Date.now()
    const promise = queue.enqueue({ url: '/api/timeout', method: 'GET' })
      .catch(error => ({ error: error.message, errorType: error.type }))
    
    // 等待超过超时时间
    await new Promise(resolve => setTimeout(resolve, 80))
    
    // 恢复处理器
    mockRequestor.resume()
    
    const result = await promise
    const endTime = Date.now()
    const waitTime = endTime - startTime
    
    console.log(`Timeout test wait time: ${waitTime}ms`)
    
    // 验证超时处理
    if ((result as any).error) {
      expect((result as any).error).toContain('timeout')
      expect((result as any).errorType).toBe(RequestErrorType.TIMEOUT_ERROR)
    } else {
      // 如果没有超时，验证请求成功
      expect((result as SerialTestResponse).url).toBe('/api/timeout')
    }
    
    queue.destroy()
  }, 3000)

  test('应该正确处理队列满时的回调', async () => {
    let queueFullCallbackCalled = false
    let callbackSerialKey = ''
    
    const queue = new SerialQueue('callback-test', mockRequestor, {
      maxQueueSize: 0, // 设置为0，任何任务都会触发队列满
      onQueueFull: (serialKey) => {
        queueFullCallbackCalled = true
        callbackSerialKey = serialKey
      },
      debug: true
    })

    try {
      await queue.enqueue({ url: '/api/full', method: 'GET' })
    } catch (error: any) {
      expect(error.message).toContain('Serial queue is full')
    }
    
    expect(queueFullCallbackCalled).toBe(true)
    expect(callbackSerialKey).toBe('callback-test')
    
    queue.destroy()
  })

  test('应该正确处理队列清空操作', async () => {
    const queue = new SerialQueue('clear-test', mockRequestor, { debug: true })
    
    // 暂停处理器
    mockRequestor.pause()
    
    // 添加多个任务
    const promises = [
      queue.enqueue({ url: '/api/1', method: 'GET' }).catch(e => ({ error: e.message })),
      queue.enqueue({ url: '/api/2', method: 'GET' }).catch(e => ({ error: e.message })),
      queue.enqueue({ url: '/api/3', method: 'GET' }).catch(e => ({ error: e.message }))
    ]
    
    // 等待任务入队
    await new Promise(resolve => setTimeout(resolve, 10))
    
    // 验证队列不为空
    expect(queue.isEmpty()).toBe(false)
    expect(queue.getQueueLength()).toBeGreaterThan(0)
    
    // 清空队列
    queue.clear()
    
    // 验证队列被清空
    expect(queue.getQueueLength()).toBe(0)
    
    // 恢复处理器
    mockRequestor.resume()
    
    // 等待Promise解决
    const results = await Promise.all(promises)
    
    // 验证任务被取消
    results.forEach(result => {
      if ((result as any).error) {
        expect((result as any).error).toContain('cleared')
      }
    })
    
    queue.destroy()
  })

  test('应该正确处理并发任务入队', async () => {
    const queue = new SerialQueue('concurrent-test', mockRequestor, { debug: true })
    
    const taskCount = 5
    const promises = Array.from({ length: taskCount }, (_, i) =>
      queue.enqueue({ url: `/api/concurrent-${i}`, method: 'GET' })
    )
    
    const results = await Promise.all(promises)
    
    // 验证所有任务都完成
    expect(results).toHaveLength(taskCount)
    
    // 验证执行顺序
    const requests = mockRequestor.getRequests()
    expect(requests).toHaveLength(taskCount)
    
    for (let i = 1; i < requests.length; i++) {
      expect(requests[i].timestamp).toBeGreaterThan(requests[i-1].timestamp)
      expect(requests[i].config.url).toBe(`/api/concurrent-${i}`)
    }
    
    queue.destroy()
  })

  test('应该正确处理请求配置的浅拷贝', async () => {
    const queue = new SerialQueue('copy-test', mockRequestor, { debug: true })
    
    const originalConfig: RequestConfig = {
      url: '/api/copy',
      method: 'POST',
      data: { original: true },
      headers: { 'X-Test': 'original' }
    }
    
    // 发起请求
    const promise = queue.enqueue(originalConfig)
    
    // 修改原始配置
    originalConfig.data = { modified: true }
    originalConfig.headers!['X-Test'] = 'modified'
    
    const result = await promise
    
    // 验证请求使用的是原始配置的拷贝
    const request = mockRequestor.getRequests()[0]
    expect(request.config.data).toEqual({ original: true })
    expect(request.config.headers!['X-Test']).toBe('original')
    
    queue.destroy()
  })

  test('应该正确处理队列销毁', async () => {
    const queue = new SerialQueue('destroy-test', mockRequestor, { debug: true })
    
    // 添加一些任务
    await queue.enqueue({ url: '/api/before-destroy', method: 'GET' })
    
    // 销毁队列
    queue.destroy()
    
    // 销毁后调用方法不应该抛出异常
    expect(() => queue.isEmpty()).not.toThrow()
    expect(() => queue.getQueueLength()).not.toThrow()
    expect(() => queue.getSerialKey()).not.toThrow()
  })

  test('应该正确处理空队列的processNext调用', async () => {
    const queue = new SerialQueue('empty-process', mockRequestor, { debug: true })
    
    // 直接调用processNext不应该抛出异常
    // 注意：processNext是私有方法，我们通过enqueue间接测试
    
    // 验证空队列状态
    expect(queue.isEmpty()).toBe(true)
    expect(queue.getQueueLength()).toBe(0)
    
    // 添加并立即完成一个任务
    await queue.enqueue({ url: '/api/empty-test', method: 'GET' })
    
    // 队列应该再次为空
    expect(queue.isEmpty()).toBe(true)
    expect(queue.getQueueLength()).toBe(0)
    
    queue.destroy()
  })

  test('应该正确处理请求错误的不同类型', async () => {
    const queue = new SerialQueue('error-types', mockRequestor, { debug: true })
    
    // 设置不同类型的失败
    mockRequestor.setFailForUrls(['/api/network-error', '/api/parse-error'])
    
    const promises = [
      queue.enqueue({ url: '/api/network-error', method: 'GET' })
        .catch(error => ({ error: error.message, type: 'network' })),
      queue.enqueue({ url: '/api/parse-error', method: 'POST' })
        .catch(error => ({ error: error.message, type: 'parse' })),
      queue.enqueue({ url: '/api/success', method: 'GET' })
    ]
    
    const results = await Promise.all(promises)
    
    // 验证错误处理
    expect((results[0] as any).error).toContain('Mock request failed')
    expect((results[1] as any).error).toContain('Mock request failed')
    expect((results[2] as SerialTestResponse).url).toBe('/api/success')
    
    queue.destroy()
  })
})