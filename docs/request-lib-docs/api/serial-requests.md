# 串行请求

## 基本概念

串行请求功能确保带有相同 `serialKey` 的请求按照 FIFO（先进先出）顺序依次执行，同一队列中的请求不会并发执行，从而保证请求的执行顺序。

### 核心特性

- **多队列支持**：支持多个独立的串行队列，不同队列之间的请求互不阻塞，可以并行执行
- **队列管理**：提供完整的队列管理 API，包括查询、清空、移除等操作
- **队列大小限制**：支持设置队列最大容量，防止队列无限增长
- **任务超时**：支持设置任务在队列中的最大等待时间，超时任务会被自动取消
- **自动清理**：支持自动清理空队列，避免内存泄漏
- **功能开关**：支持动态启用/禁用串行功能
- **调试支持**：提供详细的调试日志，便于排查问题

### 工作原理

串行请求通过队列机制实现：

1. **队列标识**：通过 `serialKey` 标识不同的串行队列，相同 `serialKey` 的请求会被加入同一个队列
2. **FIFO 执行**：队列中的任务按照先进先出的顺序依次执行，同一时刻只有一个任务在执行
3. **独立队列**：不同 `serialKey` 的队列相互独立，可以并行执行
4. **任务管理**：每个任务包含请求配置、Promise 的 resolve/reject 函数、创建时间等信息
5. **自动处理**：当前任务完成后，自动处理队列中的下一个任务

### 队列机制

- **队列创建**：首次使用某个 `serialKey` 时会自动创建对应的队列
- **队列配置**：支持为每个队列单独配置大小限制、超时时间等参数
- **队列清理**：空队列会在指定时间间隔后自动清理，也可手动清理
- **队列销毁**：队列销毁时会取消所有等待中的任务

## 适用场景

串行请求功能适用于以下场景：

- **依赖关系请求**：后续请求依赖前一个请求的结果，必须按顺序执行
- **顺序操作**：需要确保操作按特定顺序执行，如用户注册流程（验证邮箱 → 创建账号 → 发送欢迎邮件）
- **资源竞争**：多个请求操作同一资源时，需要串行执行避免并发冲突
- **API 限制**：某些 API 要求请求必须按顺序执行，不能并发
- **状态更新**：需要按顺序更新状态，确保状态的一致性
- **文件上传**：需要按顺序上传多个文件，避免服务器压力过大
- **订单处理**：订单创建、支付、发货等操作需要按顺序执行

### 不适用场景

- **独立请求**：请求之间没有依赖关系，可以并发执行以提高性能
- **数据查询**：对于只读的数据查询请求，通常不需要串行执行
- **实时性要求高**：如果请求的实时性要求很高，串行执行可能会增加延迟

## API

### SerialFeature

串行请求功能的核心类。

#### 构造函数

```typescript
constructor(
  requestor: Requestor,
  managerConfig?: SerialManagerConfig,
  options?: {
    debug?: boolean
  }
)
```

**参数**：

- `requestor`: 实现了 `Requestor` 接口的请求器实例，用于执行实际的网络请求
- `managerConfig`: 可选的串行管理器配置
- `options`: 可选的选项对象
  - `debug`: 是否启用调试模式，默认 `false`

**managerConfig 配置**：

```typescript
interface SerialManagerConfig {
  // 默认队列配置，新建队列时会使用此配置
  defaultQueueConfig?: SerialConfig

  // 最大队列数量，默认无限制
  maxQueues?: number

  // 清理间隔(毫秒)，默认30秒
  cleanupInterval?: number

  // 是否自动清理空队列，默认true
  autoCleanup?: boolean

  // 调试模式
  debug?: boolean
}
```

**SerialConfig 配置**：

```typescript
interface SerialConfig {
  // 最大队列大小，默认无限制
  maxQueueSize?: number

  // 队列超时时间(毫秒)，默认无超时
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
import { SerialFeature } from '@request-core'

// 基本使用
const serialFeature = new SerialFeature(requestor)

// 带配置的创建
const serialFeature = new SerialFeature(
  requestor,
  {
    defaultQueueConfig: {
      maxQueueSize: 10,
      timeout: 30000,
      onQueueFull: (serialKey) => {
        console.warn(`Queue ${serialKey} is full`)
      },
    },
    autoCleanup: true,
    cleanupInterval: 30000,
  },
  {
    debug: true,
  }
)
```

### requestSerial

直接发起串行请求的通用方法。

#### 类型签名

```typescript
async requestSerial<T = any>(
  config: RequestConfig,
  queueConfig?: SerialConfig
): Promise<T>
```

#### 参数

**config: RequestConfig**

请求配置对象，必须包含 `serialKey` 字段用于标识队列。

**queueConfig: SerialConfig**（可选）

队列配置，用于覆盖默认配置。如果队列已存在，此配置不会影响已存在的队列。

#### 示例

```typescript
// 基本使用
const result = await serialFeature.requestSerial({
  url: '/api/data',
  method: 'GET',
  serialKey: 'my-queue',
})

// 带队列配置
const result = await serialFeature.requestSerial(
  {
    url: '/api/data',
    method: 'POST',
    data: { name: 'John' },
    serialKey: 'user-queue',
  },
  {
    maxQueueSize: 5,
    timeout: 10000,
  }
)
```

### getSerial

GET 请求的串行便捷方法。

#### 类型签名

```typescript
async getSerial<T = any>(
  url: string,
  serialKey: string,
  config?: Partial<RequestConfig>,
  queueConfig?: SerialConfig
): Promise<T>
```

#### 示例

```typescript
const users = await serialFeature.getSerial('/api/users', 'user-queue')
```

### postSerial

POST 请求的串行便捷方法。

#### 类型签名

```typescript
async postSerial<T = any>(
  url: string,
  serialKey: string,
  data?: any,
  config?: Partial<RequestConfig>,
  queueConfig?: SerialConfig
): Promise<T>
```

#### 示例

```typescript
const newUser = await serialFeature.postSerial('/api/users', 'user-queue', {
  name: 'John',
  email: 'john@example.com',
})
```

### putSerial

PUT 请求的串行便捷方法。

#### 类型签名

```typescript
async putSerial<T = any>(
  url: string,
  serialKey: string,
  data?: any,
  config?: Partial<RequestConfig>,
  queueConfig?: SerialConfig
): Promise<T>
```

#### 示例

```typescript
const updatedUser = await serialFeature.putSerial(
  '/api/users/1',
  'user-queue',
  { name: 'Jane' }
)
```

### deleteSerial

DELETE 请求的串行便捷方法。

#### 类型签名

```typescript
async deleteSerial<T = any>(
  url: string,
  serialKey: string,
  config?: Partial<RequestConfig>,
  queueConfig?: SerialConfig
): Promise<T>
```

#### 示例

```typescript
await serialFeature.deleteSerial('/api/users/1', 'user-queue')
```

### patchSerial

PATCH 请求的串行便捷方法。

#### 类型签名

```typescript
async patchSerial<T = any>(
  url: string,
  serialKey: string,
  data?: any,
  config?: Partial<RequestConfig>,
  queueConfig?: SerialConfig
): Promise<T>
```

#### 示例

```typescript
const patchedUser = await serialFeature.patchSerial(
  '/api/users/1',
  'user-queue',
  { name: 'Jane' }
)
```

### getQueueKeys

获取所有队列的标识。

#### 类型签名

```typescript
getQueueKeys(): string[]
```

#### 返回值

返回所有队列标识的数组。

#### 示例

```typescript
const queueKeys = serialFeature.getQueueKeys()
console.log('Active queues:', queueKeys)
```

### clearQueue

清空指定队列，取消所有等待中的任务。

#### 类型签名

```typescript
clearQueue(serialKey: string): boolean
```

#### 参数

- `serialKey`: 队列标识

#### 返回值

如果队列存在并成功清空返回 `true`，否则返回 `false`。

#### 示例

```typescript
const cleared = serialFeature.clearQueue('my-queue')
if (cleared) {
  console.log('Queue cleared successfully')
}
```

**注意**：清空队列会取消所有等待中的任务，这些任务的 Promise 会被 reject，错误码为 `SERIAL_QUEUE_CLEARED`。

### clearAllQueues

清空所有队列。

#### 类型签名

```typescript
clearAllQueues(): void
```

#### 示例

```typescript
serialFeature.clearAllQueues()
```

### removeQueue

移除指定队列，会先清空队列再移除。

#### 类型签名

```typescript
removeQueue(serialKey: string): boolean
```

#### 参数

- `serialKey`: 队列标识

#### 返回值

如果队列存在并成功移除返回 `true`，否则返回 `false`。

#### 示例

```typescript
const removed = serialFeature.removeQueue('my-queue')
if (removed) {
  console.log('Queue removed successfully')
}
```

### removeAllQueues

移除所有队列。

#### 类型签名

```typescript
removeAllQueues(): void
```

#### 示例

```typescript
serialFeature.removeAllQueues()
```

### hasQueue

检查队列是否存在。

#### 类型签名

```typescript
hasQueue(serialKey: string): boolean
```

#### 参数

- `serialKey`: 队列标识

#### 返回值

如果队列存在返回 `true`，否则返回 `false`。

#### 示例

```typescript
if (serialFeature.hasQueue('my-queue')) {
  console.log('Queue exists')
}
```

### cleanup

手动触发清理空队列。

#### 类型签名

```typescript
cleanup(): void
```

#### 示例

```typescript
serialFeature.cleanup()
```

### enable

启用串行功能。

#### 类型签名

```typescript
enable(): void
```

#### 示例

```typescript
serialFeature.enable()
```

**注意**：功能启用后，所有带有 `serialKey` 的请求都会被串行化处理。

### disable

禁用串行功能。

#### 类型签名

```typescript
disable(): void
```

#### 示例

```typescript
serialFeature.disable()
```

**注意**：功能禁用后，所有请求都会直接执行，`serialKey` 会被忽略。

### isEnabled

检查功能是否启用。

#### 类型签名

```typescript
isEnabled(): boolean
```

#### 返回值

如果功能启用返回 `true`，否则返回 `false`。

#### 示例

```typescript
if (serialFeature.isEnabled()) {
  console.log('Serial feature is enabled')
}
```

### destroy

销毁功能实例，清理所有资源。

#### 类型签名

```typescript
destroy(): void
```

#### 示例

```typescript
serialFeature.destroy()
```

**注意**：调用 `destroy()` 会清理所有队列和资源，实例销毁后不应再使用。

## 错误处理

### 队列满错误

当队列中的任务数（包括等待中的任务和正在处理的任务）达到 `maxQueueSize` 限制时，新的请求会被拒绝。

**错误信息**：

- 错误类型：`RequestErrorType.VALIDATION_ERROR`
- 错误码：`SERIAL_QUEUE_FULL`
- 错误消息：`Serial queue is full`

**处理示例**：

```typescript
try {
  await serialFeature.requestSerial({
    url: '/api/data',
    serialKey: 'limited-queue',
  })
} catch (error) {
  if (error.code === 'SERIAL_QUEUE_FULL') {
    console.error('Queue is full, request rejected')
  }
}
```

### 任务超时错误

当任务在队列中等待的时间超过 `timeout` 配置时，任务会被自动取消。

**错误信息**：

- 错误类型：`RequestErrorType.TIMEOUT_ERROR`
- 错误码：`SERIAL_TASK_TIMEOUT`
- 错误消息：`Task timeout in serial queue`

**处理示例**：

```typescript
try {
  await serialFeature.requestSerial({
    url: '/api/slow',
    serialKey: 'timeout-queue',
  })
} catch (error) {
  if (error.code === 'SERIAL_TASK_TIMEOUT') {
    console.error('Task timed out in queue')
  }
}
```

### 队列清空错误

当队列被清空时，所有等待中的任务会被取消。

**错误信息**：

- 错误类型：`RequestErrorType.VALIDATION_ERROR`
- 错误码：`SERIAL_QUEUE_CLEARED`
- 错误消息：`Serial queue cleared`

**处理示例**：

```typescript
const promise = serialFeature.requestSerial({
  url: '/api/data',
  serialKey: 'my-queue',
})

// 在另一个地方清空队列
serialFeature.clearQueue('my-queue')

try {
  await promise
} catch (error) {
  if (error.code === 'SERIAL_QUEUE_CLEARED') {
    console.error('Queue was cleared, task cancelled')
  }
}
```

### 请求失败处理

如果队列中的一个请求失败，它所对应的 Promise 将被 reject。该失败**不会中断**整个队列的执行。请求完成后，会继续处理队列中的下一个请求。

**处理示例**：

```typescript
// 请求A失败，但不会影响请求B的执行
const promiseA = serialFeature
  .requestSerial({
    url: '/api/a',
    serialKey: 'my-queue',
  })
  .catch((error) => {
    console.error('Request A failed:', error)
  })

const promiseB = serialFeature
  .requestSerial({
    url: '/api/b',
    serialKey: 'my-queue',
  })
  .then((result) => {
    console.log('Request B succeeded:', result)
    // 请求B会在请求A完成后执行，即使请求A失败
  })
```
