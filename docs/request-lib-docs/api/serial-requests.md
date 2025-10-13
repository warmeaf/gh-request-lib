# 串行请求API

本文档介绍如何在 API 客户端中使用串行请求功能，确保特定请求按顺序依次执行，避免竞态条件。

## 核心概念

串行请求功能允许你控制请求的执行顺序，相同 `serialKey` 的请求会被放入队列，按照先进先出（FIFO）的顺序依次执行。这对于需要保证执行顺序的操作非常有用。

### 主要特性

- **队列管理**：为不同的 serialKey 维护独立的请求队列
- **顺序执行**：同一队列的请求按顺序依次执行
- **队列限制**：可限制队列大小，防止内存溢出
- **超时控制**：支持队列超时和任务超时
- **统计信息**：提供详细的队列和任务执行统计

## 在 API 类中使用串行请求

### 基础用法

```typescript
import { type RequestCore } from 'request-api'

class DataApi {
  constructor(public requestCore: RequestCore) {}

  // 使用串行键确保顺序执行
  async updateData(id: string, data: any) {
    return this.requestCore.postSerial(
      `/data/${id}`,
      'data-update', // serialKey，相同key的请求会串行执行
      data
    )
  }

  // 使用通用串行方法
  async processQueue(queueId: string, item: any) {
    return this.requestCore.requestSerial(
      {
        url: '/process',
        method: 'POST',
        data: item,
        serialKey: queueId, // 必须指定 serialKey
      }
    )
  }
}
```

### 不同队列独立执行

不同 serialKey 的请求在不同队列中，互不影响：

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  // 每个用户的操作独立串行
  async updateUserProfile(userId: string, profileData: any) {
    return this.requestCore.putSerial(
      `/users/${userId}/profile`,
      `user-${userId}`, // 每个用户有独立的队列
      profileData
    )
  }

  // 用户A和用户B的请求可以并行执行
  async batchUpdateUsers(updates: Array<{ userId: string; data: any }>) {
    const promises = updates.map(({ userId, data }) =>
      this.updateUserProfile(userId, data)
    )
    // 不同用户的请求并行，同一用户的请求串行
    return Promise.all(promises)
  }
}
```

### 配置队列大小

限制队列大小，防止无限堆积：

```typescript
class TaskApi {
  constructor(public requestCore: RequestCore) {}

  async submitTask(taskData: any) {
    return this.requestCore.requestSerial(
      {
        url: '/tasks',
        method: 'POST',
        data: taskData,
        serialKey: 'task-queue',
      },
      {
        maxQueueSize: 100, // 队列最多100个任务
        onQueueFull: (key) => {
          console.error(`队列 ${key} 已满`)
          // 可以显示用户提示或采取其他措施
        },
      }
    )
  }
}
```

### 设置超时

为队列中的任务设置超时时间：

```typescript
class ProcessApi {
  constructor(public requestCore: RequestCore) {}

  async processItem(item: any) {
    return this.requestCore.requestSerial(
      {
        url: '/process',
        method: 'POST',
        data: item,
        serialKey: 'process-queue',
      },
      {
        timeout: 30000, // 任务超时 30 秒
        onTaskTimeout: (task) => {
          console.error(`任务 ${task.id} 超时`)
        },
      }
    )
  }
}
```

### 监控队列状态

```typescript
class MonitoredApi {
  constructor(public requestCore: RequestCore) {}

  async addToQueue(data: any) {
    const serialKey = 'monitored-queue'

    const result = await this.requestCore.requestSerial(
      {
        url: '/api/data',
        method: 'POST',
        data,
        serialKey,
      }
    )

    // 获取队列统计
    const queueStats = this.getQueueStats(serialKey)
    console.log('队列状态:', queueStats)

    return result
  }

  private getQueueStats(serialKey: string) {
    // 通过 FeatureManager 访问串行功能的统计信息
    // 注意：需要访问底层的 FeatureManager
    return {
      serialKey,
      // 这里简化处理，实际需要通过合适的接口获取
    }
  }
}
```

### 批量串行操作

```typescript
class OrderApi {
  constructor(public requestCore: RequestCore) {}

  // 按顺序处理订单
  async processOrders(orders: any[]) {
    const results = []

    for (const order of orders) {
      const result = await this.requestCore.postSerial(
        '/orders/process',
        'order-processing', // 所有订单在同一队列中串行处理
        order
      )
      results.push(result)
    }

    return results
  }

  // 使用 Promise 让请求自动排队
  async processOrdersConcurrently(orders: any[]) {
    // 所有请求会被加入队列，但不需要等待前一个完成
    const promises = orders.map(order =>
      this.requestCore.postSerial(
        '/orders/process',
        'order-processing',
        order
      )
    )

    // 实际执行是串行的，但代码是并发提交
    return Promise.all(promises)
  }
}
```

## API 参考

### requestSerial

使用串行队列执行请求的通用方法。

#### 类型签名

```typescript
async requestSerial<T>(
  config: RequestConfig,
  queueConfig?: SerialConfig
): Promise<T>
```

#### 参数

**config: RequestConfig**

标准的请求配置对象，**必须包含 `serialKey` 字段**。

```typescript
interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  data?: any
  // ...其他字段
  serialKey: string // 串行队列标识（必填）
}
```

**queueConfig: SerialConfig**（可选）

```typescript
interface SerialConfig {
  // 最大队列大小，默认无限制
  maxQueueSize?: number

  // 任务超时时间（毫秒），默认无超时
  timeout?: number

  // 队列满时回调
  onQueueFull?: (serialKey: string) => void

  // 任务超时回调
  onTaskTimeout?: (task: SerialTask) => void

  // 调试模式
  debug?: boolean
}
```

#### 示例

```typescript
class DataApi {
  constructor(public requestCore: RequestCore) {}

  async updateData(id: string, data: any) {
    return this.requestCore.requestSerial<DataResult>(
      {
        url: `/data/${id}`,
        method: 'PUT',
        data,
        serialKey: 'data-update',
      },
      {
        maxQueueSize: 50,
        timeout: 30000,
        onQueueFull: (key) => {
          console.error(`队列 ${key} 已满`)
        },
      }
    )
  }
}
```

### HTTP 方法便捷函数

#### getSerial

```typescript
async getSerial<T>(
  url: string,
  serialKey: string,
  config?: Partial<RequestConfig>,
  queueConfig?: SerialConfig
): Promise<T>
```

#### postSerial

```typescript
async postSerial<T>(
  url: string,
  serialKey: string,
  data?: any,
  config?: Partial<RequestConfig>,
  queueConfig?: SerialConfig
): Promise<T>
```

#### putSerial

```typescript
async putSerial<T>(
  url: string,
  serialKey: string,
  data?: any,
  config?: Partial<RequestConfig>,
  queueConfig?: SerialConfig
): Promise<T>
```

#### patchSerial

```typescript
async patchSerial<T>(
  url: string,
  serialKey: string,
  data?: any,
  config?: Partial<RequestConfig>,
  queueConfig?: SerialConfig
): Promise<T>
```

#### deleteSerial

```typescript
async deleteSerial<T>(
  url: string,
  serialKey: string,
  config?: Partial<RequestConfig>,
  queueConfig?: SerialConfig
): Promise<T>
```

#### 示例

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.getSerial<User>(
      `/users/${id}`,
      `user-${id}`
    )
  }

  async createUser(userData: any) {
    return this.requestCore.postSerial<User>(
      '/users',
      'user-creation',
      userData
    )
  }

  async updateUser(id: string, userData: any) {
    return this.requestCore.putSerial<User>(
      `/users/${id}`,
      `user-${id}`,
      userData
    )
  }

  async deleteUser(id: string) {
    return this.requestCore.deleteSerial<void>(
      `/users/${id}`,
      `user-${id}`
    )
  }
}
```

## 队列管理

虽然在 API 类中通常不需要直接管理队列，但了解队列管理概念有助于更好地使用串行功能。

### 队列生命周期

1. **创建**：首次使用某个 serialKey 时自动创建队列
2. **任务入队**：请求被添加到队列末尾
3. **顺序执行**：队列中的任务按顺序执行
4. **自动清理**：队列为空时可能被自动清理

### 队列统计信息

```typescript
interface SerialQueueStats {
  totalTasks: number        // 总任务数
  pendingTasks: number      // 等待中的任务数
  completedTasks: number    // 已完成的任务数
  failedTasks: number       // 失败的任务数
  processingTime: number    // 平均处理时间
  isProcessing: boolean     // 是否正在处理
  lastProcessedAt?: number  // 最后处理时间
}
```

## 完整示例

### 顺序更新数据

```typescript
import { createApiClient, type RequestCore } from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

class DataApi {
  constructor(public requestCore: RequestCore) {}

  // 保证数据更新的顺序性
  async updateData(id: string, version: number, data: any) {
    console.log(`提交更新: id=${id}, version=${version}`)

    return this.requestCore.putSerial(
      `/data/${id}`,
      `data-${id}`, // 每个数据项有独立的更新队列
      {
        version,
        ...data,
      },
      undefined,
      {
        timeout: 30000,
        onTaskTimeout: (task) => {
          console.error(`更新超时: ${task.id}`)
        },
      }
    )
  }

  // 批量更新（自动排队）
  async batchUpdate(updates: Array<{ id: string; version: number; data: any }>) {
    // 并发提交，但相同 id 的更新会串行执行
    const promises = updates.map(({ id, version, data }) =>
      this.updateData(id, version, data)
    )

    return Promise.all(promises)
  }
}

const apiClient = createApiClient(
  { data: DataApi },
  {
    requestor: createAxiosRequestor({
      baseURL: 'https://api.example.com',
    }),
  }
)

// 使用
async function main() {
  // 相同 ID 的更新会按顺序执行
  await Promise.all([
    apiClient.data.updateData('item-1', 1, { name: 'Update 1' }),
    apiClient.data.updateData('item-1', 2, { name: 'Update 2' }),
    apiClient.data.updateData('item-1', 3, { name: 'Update 3' }),
  ])
  // 执行顺序：版本1 -> 版本2 -> 版本3
}
```

### 消息发送队列

```typescript
class MessageApi {
  constructor(public requestCore: RequestCore) {}

  // 为每个对话维护独立的发送队列
  async sendMessage(conversationId: string, message: any) {
    return this.requestCore.postSerial(
      '/messages',
      `conversation-${conversationId}`, // 每个对话独立队列
      {
        conversationId,
        ...message,
        timestamp: Date.now(),
      },
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

  // 批量发送消息（保证顺序）
  async sendMessages(conversationId: string, messages: any[]) {
    const promises = messages.map(message =>
      this.sendMessage(conversationId, message)
    )

    return Promise.all(promises)
  }
}

const apiClient = createApiClient(
  { message: MessageApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 文件上传队列

```typescript
class UploadApi {
  constructor(public requestCore: RequestCore) {}

  // 控制上传速度，避免占用过多带宽
  async uploadFile(file: File, userId: string) {
    console.log(`加入上传队列: ${file.name}`)

    return this.requestCore.requestSerial(
      {
        url: '/upload',
        method: 'POST',
        data: file,
        headers: {
          'Content-Type': file.type,
        },
        serialKey: 'file-upload', // 全局上传队列
      },
      {
        maxQueueSize: 10, // 最多排队10个文件
        timeout: 5 * 60 * 1000, // 5分钟超时
        onQueueFull: (key) => {
          console.warn('上传队列已满，请等待')
        },
        onTaskTimeout: (task) => {
          console.error('上传超时:', task)
        },
      }
    )
  }

  // 批量上传文件
  async uploadFiles(files: File[], userId: string) {
    console.log(`准备上传 ${files.length} 个文件`)

    const promises = files.map(file =>
      this.uploadFile(file, userId)
    )

    const results = await Promise.allSettled(promises)

    const successful = results.filter(r => r.status === 'fulfilled')
    const failed = results.filter(r => r.status === 'rejected')

    console.log(`上传完成: 成功 ${successful.length}, 失败 ${failed.length}`)

    return { successful, failed }
  }
}

const apiClient = createApiClient(
  { upload: UploadApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 状态机操作

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
        debug: true, // 启用调试日志
      }
    )
  }

  // 执行一系列状态变更
  async executeStateTransitions(
    workflowId: string,
    transitions: string[]
  ) {
    console.log(`执行状态变更序列: ${transitions.join(' -> ')}`)

    const results = []

    for (const state of transitions) {
      try {
        const result = await this.changeState(workflowId, state)
        results.push({ success: true, state, result })
      } catch (error) {
        console.error(`状态变更失败: ${state}`, error)
        results.push({ success: false, state, error })
        // 状态变更失败时停止后续操作
        break
      }
    }

    return results
  }
}

const apiClient = createApiClient(
  { workflow: WorkflowApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 数据同步队列

```typescript
class SyncApi {
  constructor(public requestCore: RequestCore) {}

  // 同步操作必须按顺序执行
  async syncData(entityType: string, entityId: string, data: any) {
    const serialKey = `sync-${entityType}-${entityId}`

    return this.requestCore.postSerial(
      '/sync',
      serialKey,
      {
        entityType,
        entityId,
        data,
        timestamp: Date.now(),
      },
      undefined,
      {
        maxQueueSize: 50,
        timeout: 60000,
      }
    )
  }

  // 批量同步
  async batchSync(items: Array<{ type: string; id: string; data: any }>) {
    const promises = items.map(item =>
      this.syncData(item.type, item.id, item.data)
    )

    const results = await Promise.allSettled(promises)

    return {
      total: results.length,
      succeeded: results.filter(r => r.status === 'fulfilled').length,
      failed: results.filter(r => r.status === 'rejected').length,
    }
  }
}

const apiClient = createApiClient(
  { sync: SyncApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

## 最佳实践

### 1. 合理选择 serialKey

```typescript
class BestPracticeApi {
  constructor(public requestCore: RequestCore) {}

  // 粒度太粗 - 所有用户的操作都在一个队列
  async updateUserBad(userId: string, data: any) {
    return this.requestCore.putSerial(
      `/users/${userId}`,
      'all-users', // ❌ 不好：所有用户共用一个队列
      data
    )
  }

  // 粒度合适 - 每个用户独立队列
  async updateUserGood(userId: string, data: any) {
    return this.requestCore.putSerial(
      `/users/${userId}`,
      `user-${userId}`, // ✅ 好：每个用户独立
      data
    )
  }

  // 粒度太细 - 每个请求都是新队列
  async updateUserBad2(userId: string, data: any) {
    return this.requestCore.putSerial(
      `/users/${userId}`,
      `user-${userId}-${Date.now()}`, // ❌ 不好：失去串行意义
      data
    )
  }
}
```

### 2. 设置队列大小限制

```typescript
class SafeQueueApi {
  constructor(public requestCore: RequestCore) {}

  async addTask(task: any) {
    return this.requestCore.requestSerial(
      {
        url: '/tasks',
        method: 'POST',
        data: task,
        serialKey: 'task-queue',
      },
      {
        maxQueueSize: 100, // ✅ 防止队列无限增长
        onQueueFull: (key) => {
          // 提供用户反馈
          console.error(`队列 ${key} 已满，请稍后再试`)
          throw new Error('Task queue is full')
        },
      }
    )
  }
}
```

### 3. 使用超时保护

```typescript
class TimeoutProtectedApi {
  constructor(public requestCore: RequestCore) {}

  async processItem(item: any) {
    return this.requestCore.requestSerial(
      {
        url: '/process',
        method: 'POST',
        data: item,
        serialKey: 'process-queue',
      },
      {
        timeout: 30000, // ✅ 设置合理的超时时间
        onTaskTimeout: (task) => {
          console.error(`任务 ${task.id} 超时，将被跳过`)
          // 记录超时任务，后续重试
          this.recordTimeout(task)
        },
      }
    )
  }

  private recordTimeout(task: any) {
    // 记录超时任务的逻辑
  }
}
```

### 4. 批量操作使用 Promise.all

```typescript
class BatchSerialApi {
  constructor(public requestCore: RequestCore) {}

  // ✅ 好：并发提交到队列
  async batchProcessGood(items: any[]) {
    const promises = items.map(item =>
      this.requestCore.postSerial(
        '/process',
        'process-queue',
        item
      )
    )

    // 并发提交，但实际执行是串行的
    return Promise.all(promises)
  }

  // ❌ 不好：等待每个完成后才提交下一个
  async batchProcessBad(items: any[]) {
    const results = []

    for (const item of items) {
      const result = await this.requestCore.postSerial(
        '/process',
        'process-queue',
        item
      )
      results.push(result)
    }

    // 效率低，失去了队列的优势
    return results
  }
}
```

### 5. 错误处理

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
        console.warn(`处理失败 (尝试 ${attempt + 1}/${maxRetries}):`, error)

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

## 注意事项

1. **serialKey 必填**：使用串行请求时必须指定 serialKey
2. **队列独立性**：不同 serialKey 的队列是独立的，互不影响
3. **内存占用**：大量排队的请求会占用内存，应设置队列大小限制
4. **超时设置**：为任务设置合理的超时时间，防止队列阻塞
5. **错误处理**：一个任务失败不会影响队列中的其他任务
6. **性能考虑**：串行执行会降低吞吐量，仅在必要时使用
7. **调试模式**：开发时可启用 debug 模式查看详细日志

## 使用场景

### 适合使用串行请求的场景

- ✅ 数据版本控制（需要保证更新顺序）
- ✅ 状态机操作（状态变更必须按顺序）
- ✅ 消息发送（保证消息顺序）
- ✅ 文件上传（控制带宽占用）
- ✅ 数据同步（避免冲突）

### 不适合使用串行请求的场景

- ❌ 独立的查询操作（应使用并发）
- ❌ 不同资源的操作（应使用并发）
- ❌ 幂等的写操作（可考虑幂等功能）
- ❌ 只需要请求去重（应使用幂等功能）

## 与其他功能的对比

| 功能 | 串行请求 | 并发请求 | 幂等请求 |
|------|----------|----------|----------|
| 执行方式 | 顺序执行 | 同时执行 | 去重执行 |
| 适用场景 | 有顺序要求 | 批量独立操作 | 防止重复提交 |
| 性能影响 | 较慢 | 快 | 轻微 |
| 队列管理 | 有队列 | 无队列 | 缓存 |
| 典型用例 | 状态变更 | 批量查询 | 表单提交 |

## 相关文档

- [基础请求 API](./basic-requests.md) - 了解基础请求方法
- [并发请求 API](./concurrent-requests.md) - 批量并发请求
- [幂等请求 API](./idempotent-requests.md) - 防止重复提交