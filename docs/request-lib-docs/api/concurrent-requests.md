# 并发请求

## 基本概念

并发请求功能允许你同时发起多个网络请求，通过并行执行来显著缩短总耗时，提升应用性能。

### 核心特性

- **并发控制**：支持限制最大并发数，避免同时发起过多请求导致的资源耗尽或服务端压力过大
- **双模式支持**：支持无限制并发和限制并发两种模式
- **失败处理策略**：支持快速失败（failFast）和容错继续两种模式
- **超时控制**：支持整体超时机制，避免批量请求无限期等待
- **结果收集**：每个请求的结果都包含成功状态、数据、错误信息、耗时等详细信息
- **资源管理**：自动管理信号量等资源，支持优雅销毁

### 工作原理

并发请求通过以下机制实现：

1. **无并发限制模式**：所有请求同时发起，使用 `Promise.all` 或 `Promise.allSettled` 等待完成
2. **并发限制模式**：使用信号量（Semaphore）机制控制同时执行的请求数量，超出限制的请求会在队列中等待
3. **结果收集**：使用预分配的数组按索引收集结果，保持结果顺序，提供 O(1) 的插入性能

### 信号量机制

当设置了 `maxConcurrency` 时，系统会创建一个信号量来管理并发数：

- 每个请求执行前需要获取信号量许可证
- 如果许可证不足，请求会在等待队列中排队
- 请求完成后释放许可证，唤醒等待队列中的下一个请求
- 信号量支持超时和周期性清理，防止资源泄漏

## 适用场景

并发请求功能适用于以下场景：

- **页面初始化数据加载**：页面加载时需要获取用户信息、配置、权限等多个独立的数据，可以并发请求以缩短总耗时
- **批量数据获取**：需要获取多个用户的详细信息、多个商品的数据等批量操作
- **图片/资源预加载**：预加载多张图片或资源文件，提升后续浏览体验
- **批量文件上传**：同时上传多个文件到服务器，通过并发控制避免服务器过载
- **API 健康检查**：定期检查多个 API 端点的可用性，并发检查快速完成
- **分页数据并行获取**：快速获取多页数据，并行请求大幅缩短总耗时
- **压力测试**：对 API 进行压力测试，模拟高并发场景

### 不适用场景

- **有依赖关系的请求**：如果请求之间有强依赖关系（如必须先获取 token 才能请求数据），应使用串行请求
- **需要严格顺序的请求**：如果请求的执行顺序很重要，应使用串行请求
- **单个请求**：对于单个请求，直接使用普通请求方法即可

## API

### ConcurrentFeature

并发请求功能的核心类。

#### 构造函数

```typescript
constructor(requestor: Requestor)
```

**参数**：

- `requestor`: 请求执行器实例

### requestConcurrent

并发执行多个请求的通用方法。

#### 类型签名

```typescript
async requestConcurrent<T>(
  configs: RequestConfig[],
  concurrentConfig?: ConcurrentConfig
): Promise<ConcurrentResult<T>[]>
```

#### 参数

**configs: RequestConfig[]**

请求配置数组，每个元素是一个标准的请求配置对象。

**concurrentConfig: ConcurrentConfig**（可选）

```typescript
interface ConcurrentConfig {
  // 最大并发数，不设置则无限制
  maxConcurrency?: number

  // 是否快速失败，默认 false
  // true: 任意请求失败立即终止所有请求并抛出错误
  // false: 继续执行其他请求，失败的请求在结果中标记为 success: false
  failFast?: boolean

  // 整体超时时间（毫秒），超过此时间未完成所有请求则抛出错误
  timeout?: number

  // 是否对失败请求重试（预留字段，暂未实现）
  retryOnError?: boolean
}
```

#### 返回值

返回 `ConcurrentResult<T>[]` 数组，每个元素对应一个请求的结果：

```typescript
interface ConcurrentResult<T> {
  // 请求是否成功
  success: boolean

  // 成功时的响应数据
  data?: T

  // 失败时的错误信息
  error?: Error | RequestError | unknown

  // 原始请求配置
  config: RequestConfig

  // 请求在批次中的索引
  index: number

  // 请求耗时（毫秒）
  duration?: number

  // 重试次数（预留字段）
  retryCount?: number
}
```

#### 示例

```typescript
import { ConcurrentFeature } from '@request-core'

const concurrentFeature = new ConcurrentFeature(requestor)

// 示例 1: 基本并发请求 - 无并发限制
const configs = [
  { url: '/api/users', method: 'GET' },
  { url: '/api/posts', method: 'GET' },
  { url: '/api/comments', method: 'GET' },
]

const results = await concurrentFeature.requestConcurrent(configs)

// 示例 2: 限制最大并发数为 3
const results2 = await concurrentFeature.requestConcurrent(configs, {
  maxConcurrency: 3,
})

// 示例 3: 快速失败模式 - 任意请求失败立即终止
try {
  const results3 = await concurrentFeature.requestConcurrent(configs, {
    failFast: true,
  })
} catch (error) {
  console.error('One request failed, all stopped')
}

// 示例 4: 整体超时控制
const results4 = await concurrentFeature.requestConcurrent(configs, {
  timeout: 5000, // 5 秒内必须完成所有请求
})

// 示例 5: 综合配置 - 限制并发 + 超时 + 快速失败
try {
  const results5 = await concurrentFeature.requestConcurrent(configs, {
    maxConcurrency: 2,
    failFast: true,
    timeout: 10000,
  })
} catch (error) {
  console.error('Request failed or timeout')
}
```

### requestMultiple

重复发送同一请求多次的便捷方法。

#### 类型签名

```typescript
async requestMultiple<T>(
  config: RequestConfig,
  count: number,
  concurrentConfig?: ConcurrentConfig
): Promise<ConcurrentResult<T>[]>
```

#### 参数

- **config**: 请求配置对象
- **count**: 重复发送的次数
- **concurrentConfig**: 并发配置（可选）

#### 返回值

返回 `ConcurrentResult<T>[]` 数组，每个元素对应一次请求的结果。

#### 示例

```typescript
// 重复发送同一请求 5 次
const results = await concurrentFeature.requestMultiple(
  { url: '/api/data', method: 'GET' },
  5,
  { maxConcurrency: 2 }
)
```

### getSuccessfulResults

从结果数组中提取所有成功请求的数据。

#### 类型签名

```typescript
getSuccessfulResults<T>(results: ConcurrentResult<T>[]): T[]
```

#### 参数

- **results**: 并发请求的结果数组

#### 返回值

返回成功请求的数据数组。

#### 示例

```typescript
const results = await concurrentFeature.requestConcurrent(configs)
const successfulData = concurrentFeature.getSuccessfulResults(results)
```

### getFailedResults

从结果数组中提取所有失败请求的结果。

#### 类型签名

```typescript
getFailedResults<T>(results: ConcurrentResult<T>[]): ConcurrentResult<T>[]
```

#### 参数

- **results**: 并发请求的结果数组

#### 返回值

返回失败请求的结果数组。

#### 示例

```typescript
const results = await concurrentFeature.requestConcurrent(configs)
const failedResults = concurrentFeature.getFailedResults(results)

if (failedResults.length > 0) {
  console.warn(`Failed requests: ${failedResults.length}`)
  failedResults.forEach((r) => {
    console.error(`- ${r.config.url}: ${r.error}`)
  })
}
```

### hasFailures

检查结果数组中是否有失败的请求。

#### 类型签名

```typescript
hasFailures<T>(results: ConcurrentResult<T>[]): boolean
```

#### 参数

- **results**: 并发请求的结果数组

#### 返回值

如果有失败的请求返回 `true`，否则返回 `false`。

#### 示例

```typescript
const results = await concurrentFeature.requestConcurrent(configs)

if (concurrentFeature.hasFailures(results)) {
  console.log('Some requests failed')
}
```

### destroy

清理资源，销毁所有活动的信号量。

#### 类型签名

```typescript
destroy(): void
```

#### 示例

```typescript
// 使用完毕后清理资源
concurrentFeature.destroy()
```

## 配置说明

### maxConcurrency

**作用**：限制同时执行的请求数量。

**取值**：

- `undefined` 或 `0`：不限制并发，所有请求同时发起
- `正整数`：同时最多执行指定数量的请求
- `负数或零`：抛出 `RequestError`

**使用建议**：

- **浏览器环境**：通常设置为 4-6，因为浏览器对同一域名有并发限制
- **Node.js 环境**：可以设置更大值，如 10-20，但需考虑目标服务器的承载能力
- **高延迟网络**：可以设置更大值以充分利用网络带宽
- **低延迟网络**：较小值即可达到良好效果

### failFast

**作用**：控制遇到失败时的行为。

**取值**：

- `false`（默认）：容错模式，继续执行其他请求
- `true`：快速失败，任意请求失败立即终止所有请求

**行为差异**：

| 模式     | Promise 方法         | 失败行为 | 返回结果           |
| -------- | -------------------- | -------- | ------------------ |
| 容错模式 | `Promise.allSettled` | 继续执行 | 包含成功和失败结果 |
| 快速失败 | `Promise.all`        | 立即终止 | 抛出异常           |

**使用建议**：

- **容错模式**：请求之间相互独立，部分失败不影响整体
- **快速失败**：请求之间有强依赖，一个失败则全部无意义

### timeout

**作用**：限制批量请求的整体执行时间。

**取值**：

- `undefined`：无超时限制
- `正整数`：超时时间（毫秒）
- `> 2147483647`：自动调整为 `2147483647`（约 24.8 天）

**超时行为**：

- 超时后立即抛出错误，不管 `failFast` 设置
- 超时不会主动取消正在执行的请求（取消机制由底层实现）
- 超时错误信息: `"Concurrent request timeout after Xms"`

**使用建议**：

- 根据请求数量和预期耗时合理设置
- 考虑网络延迟和服务器响应时间
- 建议至少预留 `请求数 × 平均响应时间 ÷ 并发数 + 500ms` 的余量
