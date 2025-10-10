# 并发请求示例

## 概念介绍

并发请求是指同时发起多个 HTTP 请求，充分利用网络带宽和系统资源，提高数据获取效率。相比于顺序执行请求，并发请求可以显著减少总体等待时间。

支持以下特性：

- **无限制并发**：默认模式，所有请求同时发起
- **并发数量控制**：通过 `maxConcurrency` 限制同时进行的请求数量
- **快速失败模式**：遇到错误时立即终止所有请求
- **结果顺序保证**：结果数组的顺序与请求配置数组的顺序一致
- **详细的执行统计**：提供成功率、平均耗时、并发数等统计信息

## 使用场景

### 1. 批量数据加载

适用于需要同时获取多个资源的场景：

```typescript
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

const client = createApiClient(
  { user: UserApi },
  {
    requestor: fetchRequestor,
    globalConfig: { baseURL: 'https://api.example.com' },
  }
)

// 并发加载多个用户信息
const userIds = ['user1', 'user2', 'user3', 'user4', 'user5']
const configs = userIds.map(id => ({
  url: `/users/${id}`,
  method: 'GET' as const,
}))

const results = await client.user.requestCore.requestConcurrent(configs)

// 处理结果
results.forEach((result, index) => {
  if (result.success) {
    console.log(`User ${userIds[index]}:`, result.data)
  } else {
    console.error(`Failed to load user ${userIds[index]}:`, result.error)
  }
})
```

### 2. 并发限制场景

控制同时进行的请求数量，避免服务器过载：

```typescript
// 加载50个订单，但限制并发数为5
const orderIds = Array.from({ length: 50 }, (_, i) => `order-${i + 1}`)
const configs = orderIds.map(id => ({
  url: `/orders/${id}`,
  method: 'GET' as const,
}))

const results = await requestCore.requestConcurrent(configs, {
  maxConcurrency: 5, // 最多同时5个请求
})

console.log(`Loaded ${results.length} orders`)
```

### 3. 批量提交数据

同时提交多个数据更新请求：

```typescript
// 批量更新用户状态
const updates = [
  { id: '1', status: 'active' },
  { id: '2', status: 'inactive' },
  { id: '3', status: 'pending' },
]

const configs = updates.map(update => ({
  url: `/users/${update.id}/status`,
  method: 'PUT' as const,
  data: { status: update.status },
}))

const results = await requestCore.requestConcurrent(configs, {
  maxConcurrency: 3,
  failFast: false, // 即使部分失败也继续执行
})

// 统计结果
const successCount = results.filter(r => r.success).length
console.log(`${successCount}/${results.length} updates succeeded`)
```

### 4. 相同请求的多次执行

执行相同配置的多个请求（如性能测试、压力测试）：

```typescript
// 发起10次相同的请求
const results = await requestCore.requestMultiple(
  {
    url: '/api/health',
    method: 'GET',
  },
  10, // 执行10次
  {
    maxConcurrency: 5, // 并发数为5
  }
)

// 分析响应时间
const durations = results.map(r => r.duration || 0)
const avgDuration = durations.reduce((sum, d) => sum + d, 0) / durations.length
console.log(`Average response time: ${avgDuration.toFixed(2)}ms`)
```

### 5. 快速失败场景

关键业务场景下，任何一个请求失败都立即终止：

```typescript
try {
  const results = await requestCore.requestConcurrent(
    [
      { url: '/api/validate-user', method: 'GET' },
      { url: '/api/validate-payment', method: 'GET' },
      { url: '/api/validate-inventory', method: 'GET' },
    ],
    {
      failFast: true, // 任何一个失败立即抛出错误
      timeout: 5000, // 5秒超时
    }
  )
  
  console.log('All validations passed:', results)
} catch (error) {
  console.error('Validation failed:', error)
  // 立即处理失败情况
}
```

## API 和配置参数说明

### 核心方法

#### `requestConcurrent<T>(configs, concurrentConfig?): Promise<ConcurrentResult<T>[]>`

执行并发请求的核心方法。

**参数**：

- `configs: RequestConfig[]` - 请求配置数组
- `concurrentConfig?: ConcurrentConfig` - 并发配置

**返回值**：

返回 `ConcurrentResult<T>[]` 数组，结果顺序与请求配置顺序一致。

**示例**：

```typescript
const results = await requestCore.requestConcurrent(
  [
    { url: '/api/data1', method: 'GET' },
    { url: '/api/data2', method: 'GET' },
    { url: '/api/data3', method: 'GET' },
  ],
  {
    maxConcurrency: 2,
    failFast: false,
    timeout: 10000,
  }
)
```

#### `requestMultiple<T>(config, count, concurrentConfig?): Promise<ConcurrentResult<T>[]>`

执行相同配置的多个请求。

**参数**：

- `config: RequestConfig` - 基础请求配置
- `count: number` - 执行次数
- `concurrentConfig?: ConcurrentConfig` - 并发配置

**示例**：

```typescript
// 执行20次相同请求
const results = await requestCore.requestMultiple(
  {
    url: '/api/test',
    method: 'GET',
    headers: { 'X-Test': 'load-test' },
  },
  20, // 执行20次
  {
    maxConcurrency: 5,
  }
)
```

### 配置参数详解

#### ConcurrentConfig 并发配置

```typescript
interface ConcurrentConfig {
  maxConcurrency?: number // 最大并发数
  failFast?: boolean // 快速失败模式
  timeout?: number // 总超时时间（毫秒）
}
```

#### 参数说明

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `maxConcurrency` | number | `undefined` | 最大并发数，不设置则无限制并发 |
| `failFast` | boolean | `false` | 是否在遇到第一个错误时立即终止 |
| `timeout` | number | `undefined` | 所有请求的总超时时间（毫秒） |

#### ConcurrentResult 结果对象

```typescript
interface ConcurrentResult<T> {
  success: boolean // 请求是否成功
  data?: T // 成功时的响应数据
  error?: Error | RequestError | unknown // 失败时的错误对象
  config: RequestConfig // 原始请求配置
  index: number // 在请求数组中的索引
  duration?: number // 请求耗时（毫秒）
  retryCount?: number // 重试次数
}
```

#### ConcurrentStats 统计信息

```typescript
interface ConcurrentStats {
  total: number // 总请求数
  completed: number // 已完成请求数
  successful: number // 成功请求数
  failed: number // 失败请求数
  averageDuration: number // 平均耗时（毫秒）
  maxConcurrencyUsed: number // 实际使用的最大并发数
}
```

### 结果处理方法

#### `getSuccessfulResults<T>(results): T[]`

提取所有成功请求的数据。

```typescript
const results = await requestCore.requestConcurrent(configs)
const successfulData = requestCore.getSuccessfulResults(results)
console.log('Successful data:', successfulData)
```

#### `getFailedResults<T>(results): ConcurrentResult<T>[]`

提取所有失败的请求结果。

```typescript
const results = await requestCore.requestConcurrent(configs)
const failedResults = requestCore.getFailedResults(results)
failedResults.forEach(result => {
  console.error(`Request ${result.index} failed:`, result.error)
})
```

#### `hasConcurrentFailures<T>(results): boolean`

检查是否存在失败的请求。

```typescript
const results = await requestCore.requestConcurrent(configs)
if (requestCore.hasConcurrentFailures(results)) {
  console.warn('Some requests failed')
}
```

#### `getConcurrentStats(): ConcurrentStats`

获取最近一次并发执行的统计信息。

```typescript
const results = await requestCore.requestConcurrent(configs, {
  maxConcurrency: 5,
})

const stats = requestCore.getConcurrentStats()
console.log('Concurrent stats:', {
  total: stats.total,
  successful: stats.successful,
  failed: stats.failed,
  averageDuration: `${stats.averageDuration}ms`,
  maxConcurrencyUsed: stats.maxConcurrencyUsed,
})
```

#### `getResultsStats<T>(results): ResultsStats`

分析结果数组，返回详细统计信息。

**注意**：此方法需要通过 `ConcurrentFeature` 直接调用，`RequestCore` 未直接暴露。

```typescript
const results = await requestCore.requestConcurrent(configs)

// 需要访问内部的 ConcurrentFeature 实例
// 或者手动计算统计信息
const successfulResults = results.filter(r => r.success)
const failedResults = results.filter(r => !r.success)
const durations = successfulResults.map(r => r.duration || 0).filter(d => d > 0)

const stats = {
  total: results.length,
  successful: successfulResults.length,
  failed: failedResults.length,
  successRate: Math.round((successfulResults.length / results.length) * 100),
  averageDuration: durations.length > 0 
    ? Math.round(durations.reduce((sum, d) => sum + d, 0) / durations.length) 
    : 0,
  minDuration: durations.length > 0 ? Math.min(...durations) : 0,
  maxDuration: durations.length > 0 ? Math.max(...durations) : 0,
}

console.log('Results analysis:', {
  total: stats.total,
  successful: stats.successful,
  failed: stats.failed,
  successRate: `${stats.successRate}%`,
  averageDuration: `${stats.averageDuration}ms`,
  minDuration: `${stats.minDuration}ms`,
  maxDuration: `${stats.maxDuration}ms`,
})
```

### 完整示例

```typescript
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 定义 API 类
class DataApi {
  constructor(public requestCore: any) {}

  // 批量获取数据
  async fetchMultipleData(ids: string[]) {
    const configs = ids.map(id => ({
      url: `/data/${id}`,
      method: 'GET' as const,
    }))

    const results = await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 5, // 最多5个并发
      failFast: false, // 不快速失败
      timeout: 30000, // 30秒总超时
    })

    return results
  }

  // 批量更新数据
  async updateMultipleData(updates: Array<{ id: string; data: any }>) {
    const configs = updates.map(update => ({
      url: `/data/${update.id}`,
      method: 'PUT' as const,
      data: update.data,
    }))

    const results = await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 3,
      failFast: true, // 任何一个失败都立即终止
    })

    return results
  }
}

// 创建 API 客户端
const client = createApiClient(
  { data: DataApi },
  {
    requestor: fetchRequestor,
    globalConfig: {
      baseURL: 'https://api.example.com',
      timeout: 10000,
    },
  }
)

// 使用并发请求
async function main() {
  try {
    // 批量获取数据
    const ids = ['id1', 'id2', 'id3', 'id4', 'id5', 'id6', 'id7', 'id8']
    const results = await client.data.fetchMultipleData(ids)

    // 分析结果
    const successfulData = client.data.requestCore.getSuccessfulResults(results)
    const failedResults = client.data.requestCore.getFailedResults(results)
    
    console.log(`Successfully fetched ${successfulData.length}/${results.length} items`)
    
    if (failedResults.length > 0) {
      console.error('Failed requests:', failedResults.map(r => r.index))
    }

    // 获取统计信息
    const stats = client.data.requestCore.getConcurrentStats()
    console.log('Performance stats:', {
      total: stats.total,
      successful: stats.successful,
      failed: stats.failed,
      averageDuration: `${stats.averageDuration}ms`,
      maxConcurrencyUsed: stats.maxConcurrencyUsed,
    })
  } catch (error) {
    console.error('Concurrent requests failed:', error)
  }
}
```

## 注意事项

### ⚠️ 并发数量控制

1. **合理设置并发数**

   ```typescript
   // ✅ 推荐：根据服务器能力设置合理的并发数
   const results = await requestCore.requestConcurrent(configs, {
     maxConcurrency: 5, // API服务器支持5个并发
   })

   // ❌ 不推荐：无限制并发可能导致服务器过载
   const results = await requestCore.requestConcurrent(largeConfigs)
   ```

2. **避免设置过小的并发数**

   ```typescript
   // ❌ 并发数为1等同于顺序执行，失去并发优势
   const results = await requestCore.requestConcurrent(configs, {
     maxConcurrency: 1,
   })

   // ✅ 如需顺序执行，使用顺序方法更清晰
   const results = await requestCore.getSequential(urls)
   ```

3. **无效并发数会抛出错误**
   ```typescript
   // ❌ 无效配置
   await requestCore.requestConcurrent(configs, {
     maxConcurrency: 0, // 抛出 RequestError
   })

   await requestCore.requestConcurrent(configs, {
     maxConcurrency: -1, // 抛出 RequestError
   })
   ```

### 🔒 错误处理策略

1. **默认模式（failFast: false）**

   ```typescript
   // ✅ 收集所有结果，包括成功和失败
   const results = await requestCore.requestConcurrent(configs, {
     failFast: false, // 默认值
   })

   // 检查失败
   if (requestCore.hasConcurrentFailures(results)) {
     const failedResults = requestCore.getFailedResults(results)
     console.error('Some requests failed:', failedResults)
   }
   ```

2. **快速失败模式（failFast: true）**

   ```typescript
   // ✅ 关键业务使用快速失败
   try {
     const results = await requestCore.requestConcurrent(configs, {
       failFast: true, // 遇到第一个错误立即抛出
     })
     console.log('All requests succeeded')
   } catch (error) {
     console.error('Request failed, all stopped:', error)
     // 立即处理失败情况
   }
   ```

3. **处理部分失败**
   ```typescript
   const results = await requestCore.requestConcurrent(configs)
   
   // 分别处理成功和失败
   const successfulData = requestCore.getSuccessfulResults(results)
   const failedResults = requestCore.getFailedResults(results)

   // 统计成功率
   const successRate = Math.round((successfulData.length / results.length) * 100)
   if (successRate < 80) {
     console.warn(`Low success rate: ${successRate}%`)
   }
   ```

### ⏱️ 超时控制

1. **设置总超时时间**

   ```typescript
   // ✅ 设置所有请求的总超时时间
   const results = await requestCore.requestConcurrent(configs, {
     timeout: 10000, // 10秒内必须完成所有请求
   })
   ```

2. **超时时间计算**

   ```typescript
   // 考虑并发限制时的超时时间
   const requestCount = 20
   const maxConcurrency = 5
   const singleRequestTimeout = 2000 // 单个请求2秒

   // 理论最大时间 = (总数 / 并发数) * 单个超时
   const totalTimeout = Math.ceil(requestCount / maxConcurrency) * singleRequestTimeout

   const results = await requestCore.requestConcurrent(configs, {
     maxConcurrency: 5,
     timeout: totalTimeout, // 约8秒
   })
   ```

3. **超时会立即终止所有请求**
   ```typescript
   try {
     const results = await requestCore.requestConcurrent(configs, {
       timeout: 5000, // 5秒超时
     })
   } catch (error) {
     // 超时错误会抛出，即使 failFast: false
     console.error('Concurrent requests timeout:', error)
   }
   ```

### 📊 结果顺序和索引

1. **结果顺序保证**

   ```typescript
   const configs = [
     { url: '/api/slow', method: 'GET' as const }, // 索引 0
     { url: '/api/fast', method: 'GET' as const }, // 索引 1
     { url: '/api/medium', method: 'GET' as const }, // 索引 2
   ]

   const results = await requestCore.requestConcurrent(configs)

   // ✅ 结果数组顺序与配置数组一致
   console.log(results[0].config.url) // '/api/slow'
   console.log(results[1].config.url) // '/api/fast'
   console.log(results[2].config.url) // '/api/medium'

   // 每个结果包含原始索引
   results.forEach(result => {
     console.log(`Result ${result.index}:`, result.success)
   })
   ```

2. **利用索引追踪请求**
   ```typescript
   const userIds = ['user1', 'user2', 'user3']
   const configs = userIds.map(id => ({
     url: `/users/${id}`,
     method: 'GET' as const,
   }))

   const results = await requestCore.requestConcurrent(configs)

   // 通过索引关联原始数据
   results.forEach(result => {
     const userId = userIds[result.index]
     if (result.success) {
       console.log(`User ${userId}:`, result.data)
     } else {
       console.error(`Failed to load user ${userId}`)
     }
   })
   ```

### 🚀 性能优化

1. **选择合适的并发策略**

   ```typescript
   // 场景1：快速API，高并发
   await requestCore.requestConcurrent(configs, {
     maxConcurrency: 20, // 高并发
   })

   // 场景2：慢速API，低并发
   await requestCore.requestConcurrent(configs, {
     maxConcurrency: 3, // 避免过载
   })

   // 场景3：小批量，无限制
   if (configs.length <= 10) {
     await requestCore.requestConcurrent(configs) // 无限制
   }
   ```

2. **监控性能指标**

   ```typescript
   const results = await requestCore.requestConcurrent(configs, {
     maxConcurrency: 5,
   })

   const stats = requestCore.getConcurrentStats()
   
   // 分析性能
   console.log('Performance metrics:', {
     total: stats.total,
     successful: stats.successful,
     failed: stats.failed,
     averageTime: `${stats.averageDuration}ms`,
   })

   // 调整策略
   if (stats.averageDuration > 1000) {
     console.warn('Requests are slow, consider reducing batch size')
   }
   ```

3. **批量处理大数据集**
   ```typescript
   // ✅ 将大数据集分批处理
   async function processBatch<T>(items: any[], batchSize: number, concurrency: number) {
     const allResults: ConcurrentResult<T>[] = []

     for (let i = 0; i < items.length; i += batchSize) {
       const batch = items.slice(i, i + batchSize)
       const configs = batch.map(item => ({
         url: `/api/process/${item.id}`,
         method: 'POST' as const,
         data: item,
       }))

       const results = await requestCore.requestConcurrent(configs, {
         maxConcurrency: concurrency,
       })

       allResults.push(...results)
       
       console.log(`Processed batch ${i / batchSize + 1}, ${allResults.length}/${items.length} items`)
     }

     return allResults
   }

   // 处理1000个项目，每批100个，并发5个
   const results = await processBatch(largeDataset, 100, 5)
   ```

### 🏗️ 最佳实践

1. **根据场景选择配置**

   ```typescript
   // 数据查询：中等并发，不快速失败
   const queryResults = await requestCore.requestConcurrent(queryConfigs, {
     maxConcurrency: 10,
     failFast: false,
     timeout: 30000,
   })

   // 数据提交：低并发，快速失败
   const submitResults = await requestCore.requestConcurrent(submitConfigs, {
     maxConcurrency: 3,
     failFast: true,
     timeout: 15000,
   })

   // 验证检查：高并发，快速失败
   const validationResults = await requestCore.requestConcurrent(validationConfigs, {
     maxConcurrency: 20,
     failFast: true,
     timeout: 5000,
   })
   ```

2. **结合其他功能使用**

   ```typescript
   // 并发 + 缓存
   const cachedConfigs = configs.map(config => ({
     ...config,
     cache: { ttl: 5 * 60 * 1000 }, // 缓存5分钟
   }))

   // 并发 + 重试
   const retriedConfigs = configs.map(config => ({
     ...config,
     retry: { retries: 3, delay: 1000 },
   }))

   const results = await requestCore.requestConcurrent(retriedConfigs, {
     maxConcurrency: 5,
   })
   ```

3. **优雅的错误恢复**
   ```typescript
   // 尝试并发请求，失败时降级到顺序请求
   async function fetchDataWithFallback(configs: RequestConfig[]) {
     try {
       return await requestCore.requestConcurrent(configs, {
         maxConcurrency: 10,
         timeout: 10000,
       })
     } catch (error) {
       console.warn('Concurrent request failed, falling back to sequential')
       
       // 降级到顺序请求
       const results: ConcurrentResult<any>[] = []
       for (let i = 0; i < configs.length; i++) {
         try {
           const data = await requestCore.request(configs[i])
           results.push({
             success: true,
             data,
             config: configs[i],
             index: i,
             duration: 0,
             retryCount: 0,
           })
         } catch (err) {
           results.push({
             success: false,
             error: err,
             config: configs[i],
             index: i,
             duration: 0,
             retryCount: 0,
           })
         }
       }
       return results
     }
   }
   ```

4. **监控和日志记录**
   ```typescript
   // 请求过程会自动输出日志
   const results = await requestCore.requestConcurrent(configs, {
     maxConcurrency: 5,
   })

   // 输出示例：
   // [Concurrent] Starting request 1/10: GET /api/data1
   // [Concurrent] Request 1 completed in 125ms
   // [Concurrent] Starting request 2/10: GET /api/data2
   // ...
   // [Concurrent] Batch completed: 10/10 successful, avg duration: 145ms, max concurrency: 5/5

   // 自定义统计
   const stats = requestCore.getConcurrentStats()
   logToMonitoring({
     type: 'concurrent_request',
     total: stats.total,
     successful: stats.successful,
     failed: stats.failed,
     avgDuration: stats.averageDuration,
     maxConcurrencyUsed: stats.maxConcurrencyUsed,
   })
   ```

---

通过合理使用并发请求功能，你可以显著提升应用的数据加载效率，优化用户体验。建议根据实际的 API 性能和业务需求，选择合适的并发策略和配置参数。
