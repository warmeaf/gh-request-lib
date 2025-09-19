# 串行请求示例文档

## 概念介绍

串行请求是指多个 HTTP 请求按照特定的顺序依次执行，而不是并发执行。通过为请求指定相同的`serialKey`，这些请求将被放入同一个队列中按顺序处理。不同`serialKey`的队列之间相互独立，可以并行执行。

## 使用场景

### 1. 数据依赖场景

当一个请求的结果是另一个请求的输入时：

```typescript
// 用户注册流程：验证 → 创建 → 初始化
request({ url: '/api/validate-user', serialKey: 'user-onboarding' })
request({ url: '/api/create-user', serialKey: 'user-onboarding' })
request({ url: '/api/init-user-data', serialKey: 'user-onboarding' })
```

### 2. 资源保护场景

避免对敏感资源的并发访问：

```typescript
// 文件上传：检查 → 上传 → 处理
request({ url: '/api/check-quota', serialKey: 'file-upload' })
request({ url: '/api/upload-file', serialKey: 'file-upload' })
request({ url: '/api/process-file', serialKey: 'file-upload' })
```

### 3. 业务流程场景

确保业务操作的正确顺序：

```typescript
// 订单处理：验证 → 扣款 → 发货
request({ url: '/api/verify-order', serialKey: 'order-process' })
request({ url: '/api/charge-payment', serialKey: 'order-process' })
request({ url: '/api/ship-order', serialKey: 'order-process' })
```

## 使用示例演示

:::preview 串行请求

demo-preview=./components/serial-requests/index.vue

:::

## API 和配置参数说明

### 核心方法

#### `requestSerial<T>(config, queueConfig?): Promise<T>`

执行串行请求的通用方法。

**参数**：

- `config: RequestConfig` - 请求配置，必须包含`serialKey`
- `queueConfig?: SerialConfig` - 可选的队列配置

**示例**：

```typescript
const result = await requestCore.requestSerial({
  url: '/api/data',
  method: 'POST',
  serialKey: 'my-queue',
  data: { key: 'value' },
})
```

### 便利方法

#### `getSerial<T>(url, serialKey, config?, queueConfig?): Promise<T>`

串行 GET 请求。

#### `postSerial<T>(url, serialKey, data?, config?, queueConfig?): Promise<T>`

串行 POST 请求。

#### `putSerial<T>(url, serialKey, data?, config?, queueConfig?): Promise<T>`

串行 PUT 请求。

#### `deleteSerial<T>(url, serialKey, config?, queueConfig?): Promise<T>`

串行 DELETE 请求。

#### `patchSerial<T>(url, serialKey, data?, config?, queueConfig?): Promise<T>`

串行 PATCH 请求。

### 队列管理方法

#### `getSerialStats(): SerialManagerStats`

获取串行请求管理器的统计信息。

#### `clearSerialQueue(serialKey: string): boolean`

清空指定的串行队列。

#### `clearAllSerialQueues(): void`

清空所有串行队列。

### 配置参数详解

#### RequestConfig 扩展

```typescript
interface RequestConfig {
  // ... 其他配置
  serialKey?: string // 串行队列标识，相同key的请求将串行执行
}
```

#### SerialConfig 队列配置

```typescript
interface SerialConfig {
  maxQueueSize?: number // 最大队列大小，默认无限制
  timeout?: number // 队列超时时间(毫秒)，默认无超时
  onQueueFull?: (serialKey: string) => void // 队列满时回调
  onTaskTimeout?: (task: SerialTask) => void // 任务超时回调
  debug?: boolean // 调试模式，默认false
}
```

#### SerialManagerConfig 管理器配置

```typescript
interface SerialManagerConfig {
  defaultQueueConfig?: SerialConfig // 默认队列配置
  maxQueues?: number // 最大队列数量，默认无限制
  cleanupInterval?: number // 清理间隔(毫秒)，默认30秒
  autoCleanup?: boolean // 是否自动清理空队列，默认true
  debug?: boolean // 调试模式，默认false
}
```

#### SerialManagerStats 统计信息

```typescript
interface SerialManagerStats {
  totalQueues: number // 总队列数
  activeQueues: number // 活跃队列数
  totalTasks: number // 总任务数
  totalPendingTasks: number // 总等待中任务数
  totalCompletedTasks: number // 总完成任务数
  totalFailedTasks: number // 总失败任务数
  avgProcessingTime: number // 平均处理时间
  queues: Record<string, SerialQueueStats> // 各队列的详细统计
}
```

## 注意事项

### ⚠️ 性能考虑

1. **队列数量管理**

   ```typescript
   // ❌ 避免创建过多队列
   for (let i = 0; i < 1000; i++) {
     requestCore.getSerial('/api/data', `queue-${i}`)
   }

   // ✅ 合理复用队列
   const queueKey = Math.floor(i / 10).toString()
   requestCore.getSerial('/api/data', queueKey)
   ```

2. **队列大小限制**
   ```typescript
   // 设置合理的队列大小限制
   const queueConfig = {
     maxQueueSize: 50, // 根据业务需求设置
     onQueueFull: (key) => console.warn(`队列 ${key} 已满`),
   }
   ```

### 🔒 错误处理

1. **单个请求失败不会影响队列**

   ```typescript
   // 队列会继续处理后续请求
   requestCore.getSerial('/api/step1', 'flow').catch(console.error)
   requestCore.getSerial('/api/step2', 'flow') // 仍会执行
   ```

2. **适当的超时设置**
   ```typescript
   const queueConfig = {
     timeout: 30000, // 30秒超时
     onTaskTimeout: (task) => {
       console.error(`任务超时: ${task.config.url}`)
     },
   }
   ```

### 🧹 资源管理

1. **及时清理资源**

   ```typescript
   // 在适当时机清理队列
   requestCore.clearSerialQueue('completed-workflow')

   // 应用关闭时清理所有资源
   window.addEventListener('beforeunload', () => {
     requestCore.destroy()
   })
   ```

2. **避免内存泄漏**

   ```typescript
   // ❌ 避免长期持有大量未完成的Promise
   const promises = []
   for (let i = 0; i < 10000; i++) {
     promises.push(requestCore.getSerial('/api/data', 'big-queue'))
   }

   // ✅ 分批处理或使用队列限制
   const queueConfig = { maxQueueSize: 100 }
   ```

### 📊 调试和监控

1. **启用调试模式**

   ```typescript
   const queueConfig = {
     debug: true, // 启用详细日志
   }
   ```

2. **定期检查统计信息**
   ```typescript
   // 定期监控队列状态
   setInterval(() => {
     const stats = requestCore.getSerialStats()
     if (stats.totalPendingTasks > 100) {
       console.warn('队列积压过多:', stats)
     }
   }, 60000) // 每分钟检查一次
   ```

### 🏗️ 最佳实践

1. **合理的 serialKey 命名**

   ```typescript
   // ✅ 使用描述性的键名
   'user-registration-flow'
   'file-upload-process'
   'order-checkout-steps'

   // ❌ 避免无意义的键名
   'queue1', 'temp', 'test'
   ```

2. **适度使用串行请求**
   ```typescript
   // ✅ 仅在真正需要顺序执行时使用
   if (hasDataDependency || needsResourceProtection) {
     requestCore.getSerial(url, serialKey)
   } else {
     // 普通并发请求更高效
     requestCore.get(url)
   }
   ```

---

通过合理使用串行请求功能，你可以轻松实现复杂的业务流程控制，确保请求的执行顺序，同时保持良好的性能和可维护性。
