# 串行请求示例

本文档演示了 request-api 库的串行请求功能，包括基础串行、多队列管理、队列限制和实际应用场景。所有示例都使用 [JSONPlaceholder](https://jsonplaceholder.typicode.com/) 作为测试 API。

## 基础串行请求

演示串行请求与并发请求的执行顺序对比，直观展示串行请求如何确保按顺序执行。

<ClientOnly>
:::preview 基础串行请求

demo-preview=./components/serial-requests/basic-serial.vue

:::
</ClientOnly>

**关键要点：**

- 使用 `getSerial`、`postSerial` 等方法执行串行请求
- 相同 `serialKey` 的请求会按顺序依次执行
- 不同 `serialKey` 的请求在不同队列中，互不影响
- 串行请求确保了执行顺序，但总耗时会比并发请求长
- 适合需要保证操作顺序的场景（如状态变更、数据更新等）

## 多队列独立执行

演示多个独立的串行队列，每个队列独立管理，不同队列之间可以并行执行。

<ClientOnly>
:::preview 多队列独立执行

demo-preview=./components/serial-requests/multiple-queues.vue

:::
</ClientOnly>

**关键要点：**

- 每个用户/资源可以有独立的串行队列
- 不同队列之间的请求可以并发执行
- 使用 `user-${userId}` 这样的模式创建独立队列
- 适合多租户、多用户场景
- 可以通过 `getSerialStats()` 获取所有队列的统计信息

**队列隔离策略：**

| 策略 | serialKey 模式 | 适用场景 |
|------|---------------|---------|
| **按用户隔离** | `user-${userId}` | 用户资料更新、用户数据同步 |
| **按资源隔离** | `resource-${resourceId}` | 文档编辑、商品更新 |
| **按业务隔离** | `order-processing` | 订单处理、支付流程 |
| **全局队列** | `global-queue` | 全局任务、系统级操作 |

## 实际应用：订单处理

演示电商订单处理场景，订单状态必须按顺序变更，避免出现状态不一致的问题。

<ClientOnly>
:::preview 订单处理场景

demo-preview=./components/serial-requests/order-processing.vue

:::
</ClientOnly>

**关键要点：**

- 订单状态变更必须按顺序执行：待支付 → 已支付 → 配货中 → 已发货 → 已完成
- 每个订单有独立的处理队列，不同订单可以并行处理
- 使用串行请求避免状态跳跃或回退
- 错误处理：单个状态变更失败不影响其他订单
- 适合工作流、状态机等场景

**适用的状态机场景：**

✅ **订单流程**：待支付 → 已支付 → 配货中 → 已发货 → 已完成  
✅ **审批流程**：待审批 → 审批中 → 已通过 → 已归档  
✅ **任务状态**：待处理 → 处理中 → 已完成 → 已归档  
✅ **文档版本**：草稿 → 审核 → 发布 → 归档  

## 队列限制与超时

演示如何限制队列大小和设置任务超时，防止队列无限增长和任务阻塞。该示例模拟消息发送系统，展示了三种测试场景：

1. **正常发送**：在队列和超时限制内正常执行
2. **快速发送**：触发队列满限制（`maxQueueSize`），演示队列容量保护
3. **慢速发送**：触发任务超时限制（`timeout`），演示超时保护机制

<ClientOnly>
:::preview 队列限制与超时

demo-preview=./components/serial-requests/queue-limit.vue

:::
</ClientOnly>

**关键要点：**

- 使用 `maxQueueSize` 限制队列大小，防止内存溢出
- 使用 `timeout` 设置任务超时时间，防止队列阻塞
- `onQueueFull` 回调处理队列满的情况，可以提示用户或记录日志
- `onTaskTimeout` 回调处理任务超时，可以记录超时任务后续重试
- 合理设置队列大小和超时时间，平衡性能和资源占用
- 可以为不同场景应用不同的配置预设

**队列配置建议：**

| 场景 | maxQueueSize | timeout | 说明 |
|------|-------------|---------|------|
| **消息发送** | 50-100 | 10s | 防止用户快速发送大量消息 |
| **文件上传** | 5-10 | 5min | 限制同时上传文件数量 |
| **数据同步** | 100-200 | 30s | 允许较大的同步队列 |
| **API 调用** | 20-50 | 15s | 一般业务操作 |
| **状态变更** | 30-50 | 10s | 状态机操作 |

## 最佳实践

### 1. 合理选择 serialKey

```typescript
class BestPracticeApi {
  constructor(public requestCore: RequestCore) {}

  // ✅ 好：每个用户独立队列
  async updateUserProfile(userId: string, data: any) {
    return this.requestCore.putSerial(
      `/users/${userId}/profile`,
      `user-${userId}`, // 粒度合适
      data
    )
  }

  // ❌ 不好：所有用户共用一个队列
  async updateUserProfileBad(userId: string, data: any) {
    return this.requestCore.putSerial(
      `/users/${userId}/profile`,
      'all-users', // 粒度太粗
      data
    )
  }

  // ❌ 不好：每个请求都是新队列
  async updateUserProfileBad2(userId: string, data: any) {
    return this.requestCore.putSerial(
      `/users/${userId}/profile`,
      `user-${userId}-${Date.now()}`, // 粒度太细，失去串行意义
      data
    )
  }
}
```

### 2. 设置队列限制

```typescript
class SafeQueueApi {
  constructor(public requestCore: RequestCore) {}

  async sendMessage(conversationId: string, message: any) {
    return this.requestCore.postSerial(
      '/messages',
      `conversation-${conversationId}`,
      message,
      undefined,
      {
        maxQueueSize: 100, // 限制队列大小
        onQueueFull: (key) => {
          console.error(`对话 ${key} 的消息队列已满`)
          // 提示用户发送太快
          alert('发送消息太快，请稍后再试')
        },
      }
    )
  }

  // 实际应用示例：带统计的消息发送
  async sendMessageWithStats(conversationId: string, message: any) {
    const queueStats = this.requestCore.getSerialStats()
    const queueKey = `conversation-${conversationId}`
    const currentQueue = queueStats.queues[queueKey]

    // 检查当前队列状态
    if (currentQueue && currentQueue.pending >= 100) {
      throw new Error('消息队列已满，请稍后再试')
    }

    return this.sendMessage(conversationId, message)
  }
}
```

### 3. 使用超时保护

```typescript
class TimeoutProtectedApi {
  constructor(public requestCore: RequestCore) {}
  private timeoutTasks: any[] = []

  async processItem(item: any) {
    return this.requestCore.requestSerial(
      {
        url: '/process',
        method: 'POST',
        data: item,
        serialKey: 'process-queue',
      },
      {
        timeout: 30000, // 30秒超时
        onTaskTimeout: (task) => {
          console.error(`任务 ${task.id} 超时`)
          // 记录超时任务，后续重试
          this.recordTimeoutTask(task)
        },
      }
    )
  }

  private recordTimeoutTask(task: any) {
    // 记录超时任务到数组
    this.timeoutTasks.push({
      task,
      timestamp: Date.now(),
    })
    console.log(`记录超时任务: ${task.id}，待后续重试`)
  }

  // 重试超时任务
  async retryTimeoutTasks() {
    console.log(`重试 ${this.timeoutTasks.length} 个超时任务`)

    for (const { task } of this.timeoutTasks) {
      try {
        await this.processItem(task.data)
        console.log(`任务 ${task.id} 重试成功`)
      } catch (error) {
        console.error(`任务 ${task.id} 重试失败:`, error)
      }
    }

    this.timeoutTasks = []
  }
}
```

### 4. 综合示例：队列限制 + 超时保护

```typescript
class RobustMessageApi {
  constructor(public requestCore: RequestCore) {}
  private queueFullCount = 0
  private timeoutCount = 0

  async sendMessage(
    conversationId: string,
    message: any,
    options: {
      maxQueueSize?: number
      timeout?: number
    } = {}
  ) {
    const {
      maxQueueSize = 50,
      timeout = 10000,
    } = options

    return this.requestCore.postSerial(
      '/messages',
      `conversation-${conversationId}`,
      message,
      undefined,
      {
        maxQueueSize,
        timeout,
        onQueueFull: (key) => {
          this.queueFullCount++
          console.error(`❌ 队列 ${key} 已满 (${this.queueFullCount} 次)`)
          // 可以弹出提示或记录日志
          this.notifyUser('发送消息太快，请稍后再试')
        },
        onTaskTimeout: (task) => {
          this.timeoutCount++
          console.warn(`⏱️ 任务超时 (${this.timeoutCount} 次):`, task)
          // 可以记录到监控系统
          this.reportToMonitoring('task_timeout', task)
        },
      }
    )
  }

  // 获取统计信息
  getStats() {
    const queueStats = this.requestCore.getSerialStats()
    return {
      queueFullCount: this.queueFullCount,
      timeoutCount: this.timeoutCount,
      queueStats,
    }
  }

  // 重置统计
  resetStats() {
    this.queueFullCount = 0
    this.timeoutCount = 0
  }

  private notifyUser(message: string) {
    // 实际项目中可能使用 toast 或其他通知方式
    console.log(`通知用户: ${message}`)
  }

  private reportToMonitoring(event: string, data: any) {
    // 上报到监控系统
    console.log(`上报监控: ${event}`, data)
  }
}

// 使用示例
const messageApi = new RobustMessageApi(requestCore)

// 正常发送（带限制保护）
await messageApi.sendMessage('chat-123', { text: 'Hello' })

// 查看统计
const stats = messageApi.getStats()
console.log('队列统计:', stats)
```

### 5. 批量提交到串行队列

```typescript
class BatchSerialApi {
  constructor(public requestCore: RequestCore) {}

  // ✅ 好：并发提交到队列
  async batchProcessGood(items: any[]) {
    // 并发提交，但实际执行是串行的
    const promises = items.map(item =>
      this.requestCore.postSerial(
        '/process',
        'process-queue',
        item
      )
    )

    return Promise.all(promises)
  }

  // ❌ 不好：等待每个完成后才提交下一个
  async batchProcessBad(items: any[]) {
    const results = []

    for (const item of items) {
      // 这样会导致串行提交，失去了队列的优势
      const result = await this.requestCore.postSerial(
        '/process',
        'process-queue',
        item
      )
      results.push(result)
    }

    return results
  }
}
```

### 6. 状态机操作

```typescript
class WorkflowApi {
  constructor(public requestCore: RequestCore) {}

  // 工作流状态变更必须按顺序执行
  async changeState(workflowId: string, newState: string) {
    return this.requestCore.postSerial(
      `/workflows/${workflowId}/state`,
      `workflow-${workflowId}`, // 每个工作流独立队列
      { state: newState },
      undefined,
      {
        timeout: 10000,
        debug: true, // 开发时启用调试
      }
    )
  }

  // 执行一系列状态变更
  async executeStateTransitions(
    workflowId: string,
    transitions: string[]
  ) {
    console.log(`Executing state transitions: ${transitions.join(' -> ')}`)

    const results = []

    for (const state of transitions) {
      try {
        const result = await this.changeState(workflowId, state)
        results.push({ success: true, state, result })
      } catch (error) {
        console.error(`State transition failed: ${state}`, error)
        results.push({ success: false, state, error })
        // 状态变更失败时停止后续操作
        break
      }
    }

    return results
  }
}
```

### 7. 错误处理与重试

```typescript
class RobustSerialApi {
  constructor(public requestCore: RequestCore) {}

  async processWithRetry(item: any, maxRetries: number = 3) {
    let lastError

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await this.requestCore.requestSerial(
          {
            url: '/process',
            method: 'POST',
            data: item,
            serialKey: 'process-queue',
          },
          {
            timeout: 30000,
          }
        )
      } catch (error) {
        lastError = error
        console.warn(`Processing failed (attempt ${attempt + 1}/${maxRetries}):`, error)

        if (attempt < maxRetries - 1) {
          // 等待一段时间后重试
          await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)))
        }
      }
    }

    throw lastError
  }
}
```

## 性能对比

| 场景 | 串行执行 | 并发执行 | 说明 |
|------|---------|---------|------|
| 5个请求（每个500ms） | ~2500ms | ~500ms | 串行慢5倍 |
| 10个请求（每个500ms） | ~5000ms | ~500ms | 串行慢10倍 |
| 有依赖关系的请求 | 保证顺序 | 可能乱序 | 串行确保顺序性 |
| 状态变更操作 | 安全可靠 | 可能冲突 | 串行避免竞态条件 |

**结论：**
- 串行请求牺牲了性能换取了顺序保证
- 仅在需要严格顺序执行时使用串行请求
- 独立的操作应使用并发请求以提高性能

## 适用场景

### 适合使用串行请求的场景

✅ **状态机操作**：订单状态变更、工作流审批  
✅ **数据版本控制**：文档编辑、数据同步  
✅ **消息发送**：聊天消息、通知推送  
✅ **文件上传**：限制带宽占用、控制并发数  
✅ **顺序操作**：步骤必须按顺序执行  
✅ **资源锁定**：需要排他访问的资源  

### 不适合使用串行请求的场景

❌ **独立查询操作**：多个无关联的 GET 请求（应使用并发）  
❌ **批量读取数据**：获取多个用户/文章等（应使用并发）  
❌ **无依赖关系的操作**：各自独立的写操作（应使用并发）  
❌ **只需要去重**：防止重复提交（应使用幂等功能）  

## 与其他功能的对比

| 功能 | 串行请求 | 并发请求 | 幂等请求 |
|------|---------|---------|---------|
| **执行方式** | 按顺序依次执行 | 同时执行 | 去重执行 |
| **执行速度** | 较慢 | 快 | 正常 |
| **适用场景** | 有顺序要求 | 批量独立操作 | 防止重复提交 |
| **队列管理** | 有队列 | 无队列 | 缓存 |
| **资源占用** | 中等 | 较高 | 较低 |
| **典型用例** | 状态变更 | 批量查询 | 表单提交 |

## 注意事项

1. **性能影响**：串行执行会增加总耗时，仅在必要时使用
2. **队列大小**：设置合理的 maxQueueSize，防止内存溢出
3. **超时设置**：为任务设置合理的超时时间，防止队列阻塞
4. **serialKey 选择**：合理设计 serialKey，平衡隔离性和并发性
5. **错误处理**：一个任务失败不会影响队列中的其他任务
6. **内存占用**：大量排队的请求会占用内存，需要监控
7. **调试模式**：开发时可启用 debug 模式查看详细日志

## 常见问题

### 1. 串行请求和普通串行执行的区别？

```typescript
// ❌ 普通串行执行（效率低）
async function normalSerial() {
  const result1 = await api.request1()
  const result2 = await api.request2()
  const result3 = await api.request3()
}

// ✅ 使用串行队列（效率高）
async function queueSerial() {
  // 并发提交到队列，由队列管理执行顺序
  const promises = [
    api.requestSerial({ url: '/api/1', serialKey: 'queue' }),
    api.requestSerial({ url: '/api/2', serialKey: 'queue' }),
    api.requestSerial({ url: '/api/3', serialKey: 'queue' }),
  ]
  return Promise.all(promises)
}
```

**区别：**
- 普通串行：必须等待前一个完成才能发起下一个
- 串行队列：可以立即发起所有请求，由队列控制执行顺序
- 队列方式更灵活，支持动态添加、监控、限流等功能

### 2. 如何监控队列状态？

```typescript
// 获取所有队列的统计信息
const stats = requestCore.getSerialStats()

console.log('总队列数:', stats.totalQueues)
console.log('总完成任务数:', stats.totalCompletedTasks)
console.log('总失败任务数:', stats.totalFailedTasks)

// 查看特定队列的信息
const queueStats = stats.queues['user-123']
console.log('队列统计:', queueStats)
```

### 3. 如何清空队列？

```typescript
// 清空特定队列
requestCore.clearSerialQueue('user-123')

// 清空所有队列
requestCore.clearAllSerialQueues()
```

### 4. 串行请求可以和重试功能结合使用吗？

可以！但需要注意队列和重试的交互：

```typescript
// 串行请求 + 重试
await requestCore.requestSerial(
  {
    url: '/api/process',
    method: 'POST',
    data: item,
    serialKey: 'process-queue',
  },
  {
    timeout: 30000,
  }
)

// 如果需要重试，在外层包装
async function processWithRetry(item: any) {
  for (let i = 0; i < 3; i++) {
    try {
      return await requestCore.requestSerial(...)
    } catch (error) {
      if (i === 2) throw error
      await delay(1000)
    }
  }
}
```

## 相关文档

- [串行请求 API](../api/serial-requests.md) - 完整的串行请求 API 文档
- [并发请求示例](./concurrent-requests.md) - 批量并发执行请求
- [幂等请求示例](./idempotent-requests.md) - 防止重复提交
- [基础请求示例](./basic-requests.md) - 基础请求方法