/**
 * @description 串行请求使用示例
 * 
 * 这个文件展示了如何使用串行请求功能
 */

import { RequestCore } from '../../core'
import { RequestConfig } from '../../interface'

/**
 * 串行请求使用示例
 */
export async function serialRequestExample() {
  // 假设我们有一个请求实现器
  const mockRequestor = {
    async request<T>(config: RequestConfig): Promise<T> {
      // 模拟请求
      console.log(`Executing request: ${config.method} ${config.url}`)
      
      // 模拟网络延迟
      await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200))
      
      return { 
        data: `Response for ${config.url}`, 
        timestamp: Date.now() 
      } as T
    }
  }

  // 创建请求核心实例
  const requestCore = new RequestCore(mockRequestor)

  console.log('=== Serial Request Example ===\n')

  // 示例1：使用显式串行方法
  console.log('1. Using explicit serial methods:')
  
  // 这些请求将按顺序执行
  const promise1 = requestCore.getSerial('/api/step1', 'workflow-1')
  const promise2 = requestCore.postSerial('/api/step2', 'workflow-1', { data: 'test' })
  const promise3 = requestCore.getSerial('/api/step3', 'workflow-1')

  // 这些请求属于不同的队列，将并行执行
  const promise4 = requestCore.getSerial('/api/background1', 'background-tasks')
  const promise5 = requestCore.getSerial('/api/background2', 'background-tasks')

  try {
    // 等待所有请求完成
    const results = await Promise.all([
      promise1, promise2, promise3, promise4, promise5
    ])

    console.log('All requests completed:')
    results.forEach((result, index) => {
      console.log(`  Result ${index + 1}:`, result)
    })

    // 获取串行统计信息
    const stats = requestCore.getSerialStats()
    console.log('\nSerial request statistics:', stats)

  } catch (error) {
    console.error('Error in serial requests:', error)
  } finally {
    // 清理资源
    requestCore.destroy()
  }

  console.log('\n=== Example completed ===')
}

/**
 * 高级串行配置示例
 */
export async function advancedSerialExample() {
  const mockRequestor = {
    async request<T>(config: RequestConfig): Promise<T> {
      console.log(`Executing request: ${config.method} ${config.url}`)
      await new Promise(resolve => setTimeout(resolve, 50))
      return { data: `Response for ${config.url}` } as T
    }
  }

  const requestCore = new RequestCore(mockRequestor)

  console.log('=== Advanced Serial Configuration Example ===\n')

  // 使用高级配置
  const queueConfig = {
    maxQueueSize: 5,    // 最大队列大小
    timeout: 5000,      // 队列超时时间
    debug: true,        // 启用调试
    onQueueFull: (serialKey: string) => {
      console.log(`Queue ${serialKey} is full!`)
    }
  }

  try {
    // 发送多个串行请求
    const requests = []
    for (let i = 1; i <= 3; i++) {
      requests.push(
        requestCore.requestSerial({
          url: `/api/task${i}`,
          method: 'GET',
          serialKey: 'limited-queue'
        }, queueConfig)
      )
    }

    const results = await Promise.all(requests)
    console.log('Results:', results)

    // 查看队列统计
    const queueStats = requestCore.getSerialStats()
    console.log('\nQueue statistics:', queueStats)

  } catch (error) {
    console.error('Error:', error)
  } finally {
    requestCore.destroy()
  }

  console.log('\n=== Advanced example completed ===')
}

// 如果直接运行此文件，则执行示例
if (require.main === module) {
  serialRequestExample()
    .then(() => advancedSerialExample())
    .catch(console.error)
}
