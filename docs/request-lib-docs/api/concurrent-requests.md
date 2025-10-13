# 并发请求API

本文档介绍如何在 API 客户端中使用并发请求功能，高效地批量发起和管理多个请求。

## 核心概念

并发请求功能允许你同时发起多个请求，相比于串行执行，可以大幅提升性能。系统提供了灵活的并发控制、错误处理和结果收集机制。

### 主要特性

- **并发数量控制**：限制同时进行的请求数量，避免过载
- **Fail-Fast 模式**：一个请求失败时立即停止所有请求
- **超时控制**：为整个批量请求设置统一超时
- **结果统计**：自动收集性能指标和执行统计
- **结果过滤**：便捷地获取成功或失败的请求结果

## 在 API 类中使用并发请求

### 基础用法

```typescript
import { type RequestCore, type ConcurrentResult } from 'request-api'

class UserApi {
  constructor(public requestCore: RequestCore) {}

  // 批量获取用户信息
  async getUsersBatch(userIds: string[]) {
    const configs = userIds.map(id => ({
      url: `/users/${id}`,
      method: 'GET' as const,
    }))

    const results = await this.requestCore.requestConcurrent<User>(configs)

    // 提取成功的结果
    return this.requestCore.getSuccessfulResults(results)
  }

  // 使用便捷方法批量 GET
  async getUsersByUrls(urls: string[]) {
    const results = await this.requestCore.getConcurrent<User>(urls)
    return this.requestCore.getSuccessfulResults(results)
  }
}
```

### 限制并发数量

控制同时发起的请求数量，避免过度占用资源：

```typescript
class ProductApi {
  constructor(public requestCore: RequestCore) {}

  // 限制最多同时 5 个请求
  async getProductsBatch(productIds: string[]) {
    const configs = productIds.map(id => ({
      url: `/products/${id}`,
      method: 'GET' as const,
    }))

    return await this.requestCore.requestConcurrent<Product>(configs, {
      maxConcurrency: 5, // 最多同时 5 个请求
    })
  }

  // 批量更新产品（限制并发）
  async updateProductsBatch(updates: Array<{ id: string; data: any }>) {
    const configs = updates.map(({ id, data }) => ({
      url: `/products/${id}`,
      method: 'PUT' as const,
      data,
    }))

    return await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 3, // 写操作限制更严格
    })
  }
}
```

### Fail-Fast 模式

当任意一个请求失败时立即停止所有请求：

```typescript
class OrderApi {
  constructor(public requestCore: RequestCore) {}

  // 关键操作 - 任意失败则全部终止
  async processCriticalOrders(orderIds: string[]) {
    const configs = orderIds.map(id => ({
      url: `/orders/${id}/process`,
      method: 'POST' as const,
    }))

    try {
      const results = await this.requestCore.requestConcurrent(configs, {
        failFast: true, // 任意失败立即抛出错误
        maxConcurrency: 5,
      })
      return results
    } catch (error) {
      console.error('Batch processing failed:', error)
      throw error
    }
  }
}
```

### 设置超时时间

为整个批量请求设置统一的超时时间：

```typescript
class DataApi {
  constructor(public requestCore: RequestCore) {}

  async fetchDataBatch(urls: string[]) {
    const configs = urls.map(url => ({
      url,
      method: 'GET' as const,
    }))

    return await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 10,
      timeout: 30000, // 整个批量操作最多 30 秒
    })
  }
}
```

### 批量 POST 请求

使用便捷方法批量发起 POST 请求：

```typescript
class CommentApi {
  constructor(public requestCore: RequestCore) {}

  async createCommentsBatch(
    comments: Array<{ articleId: string; content: string }>
  ) {
    const requests = comments.map(comment => ({
      url: `/articles/${comment.articleId}/comments`,
      data: { content: comment.content },
    }))

    const results = await this.requestCore.postConcurrent(requests, {
      maxConcurrency: 5,
    })

    // 检查是否有失败
    if (this.requestCore.hasConcurrentFailures(results)) {
      const failed = this.requestCore.getFailedResults(results)
      console.warn(`${failed.length} comments failed to create`)
    }

    return this.requestCore.getSuccessfulResults(results)
  }
}
```

### 重复请求

向同一个端点发起多次请求（如压力测试）：

```typescript
class TestApi {
  constructor(public requestCore: RequestCore) {}

  async stressTest(url: string, count: number) {
    const results = await this.requestCore.requestMultiple(
      { url, method: 'GET' },
      count,
      {
        maxConcurrency: 10,
        timeout: 60000,
      }
    )

    // 获取统计信息
    const stats = this.requestCore.getResultsStats(results)
    console.log('Stress test results:', stats)

    return stats
  }
}
```

### 处理结果和错误

```typescript
class BatchApi {
  constructor(public requestCore: RequestCore) {}

  async processUsersBatch(userIds: string[]) {
    const configs = userIds.map(id => ({
      url: `/users/${id}`,
      method: 'GET' as const,
    }))

    const results = await this.requestCore.requestConcurrent<User>(configs, {
      maxConcurrency: 5,
      failFast: false, // 继续执行所有请求
    })

    // 分别处理成功和失败的结果
    const successUsers = this.requestCore.getSuccessfulResults(results)
    const failures = this.requestCore.getFailedResults(results)

    console.log(`成功: ${successUsers.length}, 失败: ${failures.length}`)

    // 记录失败的请求
    failures.forEach(failure => {
      console.error(`请求失败 [${failure.index}]:`, {
        url: failure.config.url,
        error: failure.error instanceof Error ? failure.error.message : 'Unknown',
      })
    })

    return {
      success: successUsers,
      failed: failures,
    }
  }
}
```

## API 参考

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

请求配置数组，每个元素是一个标准的 RequestConfig 对象。

**concurrentConfig: ConcurrentConfig**（可选）

```typescript
interface ConcurrentConfig {
  // 最大并发数，undefined 表示不限制
  maxConcurrency?: number

  // 是否在首个错误时快速失败，默认 false
  failFast?: boolean

  // 整个批量操作的超时时间（毫秒）
  timeout?: number
}
```

#### 返回值

返回 `ConcurrentResult<T>[]` 数组，每个元素包含：

```typescript
interface ConcurrentResult<T> {
  // 是否成功
  success: boolean

  // 响应数据（成功时）
  data?: T

  // 错误信息（失败时）
  error?: Error | RequestError | unknown

  // 原始请求配置
  config: RequestConfig

  // 请求在数组中的索引
  index: number

  // 请求耗时（毫秒）
  duration?: number

  // 重试次数
  retryCount?: number
}
```

#### 示例

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async batchGetUsers(userIds: string[]) {
    const configs = userIds.map(id => ({
      url: `/users/${id}`,
      method: 'GET' as const,
    }))

    const results = await this.requestCore.requestConcurrent<User>(configs, {
      maxConcurrency: 10,
      failFast: false,
      timeout: 30000,
    })

    return results
  }
}
```

### getConcurrent

并发 GET 请求的便捷方法。

#### 类型签名

```typescript
async getConcurrent<T>(
  urls: string[],
  concurrentConfig?: ConcurrentConfig
): Promise<ConcurrentResult<T>[]>
```

#### 参数

- **urls**: URL 字符串数组
- **concurrentConfig**: 并发配置（可选）

#### 示例

```typescript
class ProductApi {
  constructor(public requestCore: RequestCore) {}

  async getProducts(productIds: string[]) {
    const urls = productIds.map(id => `/products/${id}`)
    return await this.requestCore.getConcurrent<Product>(urls, {
      maxConcurrency: 5,
    })
  }
}
```

### postConcurrent

并发 POST 请求的便捷方法。

#### 类型签名

```typescript
async postConcurrent<T>(
  requests: Array<{ url: string; data?: any; config?: Partial<RequestConfig> }>,
  concurrentConfig?: ConcurrentConfig
): Promise<ConcurrentResult<T>[]>
```

#### 参数

- **requests**: 请求对象数组，每个包含 url、data 和可选的 config
- **concurrentConfig**: 并发配置（可选）

#### 示例

```typescript
class ArticleApi {
  constructor(public requestCore: RequestCore) {}

  async createArticles(articles: Array<{ title: string; content: string }>) {
    const requests = articles.map(article => ({
      url: '/articles',
      data: article,
    }))

    return await this.requestCore.postConcurrent(requests, {
      maxConcurrency: 3,
    })
  }
}
```

### requestMultiple

向同一个端点发起多次相同请求。

#### 类型签名

```typescript
async requestMultiple<T>(
  config: RequestConfig,
  count: number,
  concurrentConfig?: ConcurrentConfig
): Promise<ConcurrentResult<T>[]>
```

#### 参数

- **config**: 请求配置
- **count**: 请求次数
- **concurrentConfig**: 并发配置（可选）

#### 示例

```typescript
class HealthApi {
  constructor(public requestCore: RequestCore) {}

  async checkHealth(count: number = 10) {
    return await this.requestCore.requestMultiple(
      { url: '/health', method: 'GET' },
      count,
      { maxConcurrency: 5 }
    )
  }
}
```

### getSuccessfulResults

提取所有成功的结果数据。

#### 类型签名

```typescript
getSuccessfulResults<T>(results: ConcurrentResult<T>[]): T[]
```

#### 参数

- **results**: 并发请求的结果数组

#### 返回值

返回所有成功请求的数据数组。

#### 示例

```typescript
const results = await apiClient.user.getUsersBatch(userIds)
const users = apiClient.user.requestCore.getSuccessfulResults(results)
console.log(`成功获取 ${users.length} 个用户`)
```

### getFailedResults

提取所有失败的结果。

#### 类型签名

```typescript
getFailedResults<T>(results: ConcurrentResult<T>[]): ConcurrentResult<T>[]
```

#### 参数

- **results**: 并发请求的结果数组

#### 返回值

返回所有失败请求的 ConcurrentResult 对象数组。

#### 示例

```typescript
const results = await apiClient.user.getUsersBatch(userIds)
const failures = apiClient.user.requestCore.getFailedResults(results)

failures.forEach(failure => {
  console.error(`请求 ${failure.config.url} 失败:`, failure.error)
})
```

### hasConcurrentFailures

检查是否存在失败的请求。

#### 类型签名

```typescript
hasConcurrentFailures<T>(results: ConcurrentResult<T>[]): boolean
```

#### 参数

- **results**: 并发请求的结果数组

#### 返回值

如果存在失败的请求返回 true，否则返回 false。

#### 示例

```typescript
const results = await apiClient.product.updateProductsBatch(updates)

if (apiClient.product.requestCore.hasConcurrentFailures(results)) {
  console.warn('部分更新失败')
  // 处理失败情况
}
```

### getResultsStats

获取并发请求的统计信息。

#### 类型签名

```typescript
getResultsStats<T>(results: ConcurrentResult<T>[]): ResultsStats
```

#### 返回值

```typescript
interface ResultsStats {
  total: number              // 总请求数
  successful: number         // 成功请求数
  failed: number            // 失败请求数
  averageDuration: number   // 平均耗时（毫秒）
  minDuration: number       // 最小耗时
  maxDuration: number       // 最大耗时
  successRate: number       // 成功率（百分比）
}
```

#### 示例

```typescript
const results = await apiClient.data.fetchDataBatch(urls)
const stats = apiClient.data.requestCore.getResultsStats(results)

console.log(`
  总计: ${stats.total}
  成功: ${stats.successful}
  失败: ${stats.failed}
  成功率: ${stats.successRate}%
  平均耗时: ${stats.averageDuration}ms
`)
```

## 完整示例

### 批量获取资源

```typescript
import { createApiClient, type RequestCore } from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

class UserApi {
  constructor(public requestCore: RequestCore) {}

  // 批量获取用户
  async batchGetUsers(userIds: string[]) {
    const configs = userIds.map(id => ({
      url: `/users/${id}`,
      method: 'GET' as const,
    }))

    const results = await this.requestCore.requestConcurrent<User>(configs, {
      maxConcurrency: 10,
      timeout: 30000,
    })

    // 获取成功的用户
    const users = this.requestCore.getSuccessfulResults(results)

    // 处理失败的请求
    const failures = this.requestCore.getFailedResults(results)
    if (failures.length > 0) {
      console.warn(`${failures.length} 个用户获取失败`)
      failures.forEach(failure => {
        console.error(`用户 ID ${userIds[failure.index]} 获取失败:`, failure.error)
      })
    }

    return users
  }
}

const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: createAxiosRequestor({
      baseURL: 'https://api.example.com',
    }),
  }
)

// 使用
async function main() {
  const userIds = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '10']
  const users = await apiClient.user.batchGetUsers(userIds)
  console.log(`成功获取 ${users.length} 个用户`)
}
```

### 批量创建资源

```typescript
class ArticleApi {
  constructor(public requestCore: RequestCore) {}

  async batchCreateArticles(
    articles: Array<{ title: string; content: string }>
  ) {
    const requests = articles.map(article => ({
      url: '/articles',
      data: article,
    }))

    const results = await this.requestCore.postConcurrent(requests, {
      maxConcurrency: 3, // 写操作限制并发数
      failFast: false,   // 继续执行所有请求
    })

    const created = this.requestCore.getSuccessfulResults(results)
    const failed = this.requestCore.getFailedResults(results)

    return {
      success: created,
      failed: failed.map((f, idx) => ({
        article: articles[f.index],
        error: f.error,
      })),
    }
  }
}

const apiClient = createApiClient(
  { article: ArticleApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### Fail-Fast 场景

```typescript
class TransactionApi {
  constructor(public requestCore: RequestCore) {}

  // 关键事务操作 - 任意失败则全部回滚
  async processBatchTransactions(transactions: any[]) {
    const configs = transactions.map(tx => ({
      url: '/transactions',
      method: 'POST' as const,
      data: tx,
    }))

    try {
      // failFast 模式：任意失败立即抛出错误
      const results = await this.requestCore.requestConcurrent(configs, {
        maxConcurrency: 5,
        failFast: true,
        timeout: 60000,
      })

      console.log('所有事务处理成功')
      return this.requestCore.getSuccessfulResults(results)
    } catch (error) {
      console.error('批量事务失败，需要回滚:', error)
      // 执行回滚逻辑
      await this.rollbackTransactions()
      throw error
    }
  }

  private async rollbackTransactions() {
    // 实现回滚逻辑
    console.log('执行回滚操作...')
  }
}

const apiClient = createApiClient(
  { transaction: TransactionApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 分页数据批量加载

```typescript
class DataApi {
  constructor(public requestCore: RequestCore) {}

  // 批量加载多页数据
  async loadAllPages(totalPages: number) {
    const urls = Array.from(
      { length: totalPages },
      (_, i) => `/data?page=${i + 1}`
    )

    const results = await this.requestCore.getConcurrent(urls, {
      maxConcurrency: 5,
      timeout: 60000,
    })

    // 获取统计信息
    const stats = this.requestCore.getResultsStats(results)
    console.log('加载统计:', stats)

    // 合并所有页的数据
    const allData = this.requestCore.getSuccessfulResults(results)
    return allData.flat()
  }
}

const apiClient = createApiClient(
  { data: DataApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 批量更新和错误处理

```typescript
class ProductApi {
  constructor(public requestCore: RequestCore) {}

  async batchUpdateProducts(
    updates: Array<{ id: string; data: any }>
  ) {
    const configs = updates.map(({ id, data }) => ({
      url: `/products/${id}`,
      method: 'PUT' as const,
      data,
    }))

    const results = await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 3,
      failFast: false,
    })

    // 详细的结果分析
    const successful = this.requestCore.getSuccessfulResults(results)
    const failed = this.requestCore.getFailedResults(results)

    console.log(`批量更新完成:
      成功: ${successful.length}
      失败: ${failed.length}
    `)

    // 返回详细的结果报告
    return {
      success: successful,
      failures: failed.map(f => ({
        productId: updates[f.index].id,
        error: f.error instanceof Error ? f.error.message : 'Unknown error',
        index: f.index,
      })),
      stats: this.requestCore.getResultsStats(results),
    }
  }
}

const apiClient = createApiClient(
  { product: ProductApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

## 最佳实践

### 1. 合理设置并发数量

```typescript
class BestPracticeApi {
  constructor(public requestCore: RequestCore) {}

  // 读操作 - 可以更高的并发
  async batchRead(ids: string[]) {
    const configs = ids.map(id => ({
      url: `/data/${id}`,
      method: 'GET' as const,
    }))

    return await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 20, // 读操作可以更高
    })
  }

  // 写操作 - 较低的并发
  async batchWrite(data: any[]) {
    const configs = data.map(item => ({
      url: '/data',
      method: 'POST' as const,
      data: item,
    }))

    return await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 5, // 写操作限制更严格
    })
  }
}
```

### 2. 处理部分失败

```typescript
class RobustApi {
  constructor(public requestCore: RequestCore) {}

  async batchProcess(items: any[]) {
    const configs = items.map(item => ({
      url: '/process',
      method: 'POST' as const,
      data: item,
    }))

    const results = await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 5,
      failFast: false, // 允许部分失败
    })

    const successful = this.requestCore.getSuccessfulResults(results)
    const failed = this.requestCore.getFailedResults(results)

    // 记录失败的项，以便后续重试
    if (failed.length > 0) {
      const failedItems = failed.map(f => items[f.index])
      await this.saveFailedItems(failedItems)
      console.warn(`${failed.length} 项处理失败，已保存以便重试`)
    }

    return successful
  }

  private async saveFailedItems(items: any[]) {
    // 保存失败项的逻辑
  }
}
```

### 3. 使用超时保护

```typescript
class TimeoutProtectedApi {
  constructor(public requestCore: RequestCore) {}

  async batchFetch(urls: string[]) {
    try {
      return await this.requestCore.getConcurrent(urls, {
        maxConcurrency: 10,
        timeout: 30000, // 整个批量操作 30 秒超时
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        console.error('批量操作超时')
        // 降级处理
        return this.fallbackFetch(urls)
      }
      throw error
    }
  }

  private async fallbackFetch(urls: string[]) {
    // 降级逻辑：减少并发数或使用缓存
    return []
  }
}
```

### 4. 监控和统计

```typescript
class MonitoredApi {
  constructor(public requestCore: RequestCore) {}

  async monitoredBatchRequest(configs: RequestConfig[]) {
    const startTime = Date.now()

    const results = await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 10,
    })

    const stats = this.requestCore.getResultsStats(results)
    const totalTime = Date.now() - startTime

    // 记录详细的性能指标
    console.log('批量请求统计:', {
      ...stats,
      totalTime,
      requestsPerSecond: (stats.total / (totalTime / 1000)).toFixed(2),
    })

    // 发送到监控系统
    this.sendMetrics({
      operation: 'batch_request',
      ...stats,
      totalTime,
    })

    return results
  }

  private sendMetrics(metrics: any) {
    // 发送到监控系统
  }
}
```

### 5. 分批处理大量请求

```typescript
class ChunkedApi {
  constructor(public requestCore: RequestCore) {}

  // 将大量请求分批处理
  async processManyRequests(items: any[], batchSize: number = 100) {
    const results = []

    // 分批处理
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      console.log(`处理批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(items.length / batchSize)}`)

      const configs = batch.map(item => ({
        url: '/process',
        method: 'POST' as const,
        data: item,
      }))

      const batchResults = await this.requestCore.requestConcurrent(configs, {
        maxConcurrency: 10,
      })

      results.push(...batchResults)

      // 批次之间添加短暂延迟，避免服务器过载
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    return results
  }
}
```

## 注意事项

1. **并发数量**：根据服务器能力和网络条件合理设置 maxConcurrency
2. **内存占用**：大量并发请求会占用较多内存，注意监控
3. **错误处理**：决定是使用 failFast 还是允许部分失败
4. **超时设置**：为批量操作设置合理的超时时间
5. **结果顺序**：结果数组的顺序与输入配置数组一致（通过 index 字段标识）
6. **重试策略**：并发请求本身不包含重试，需要时可与 retry 功能结合使用
7. **服务器限制**：注意服务器的速率限制（rate limiting）

## 相关文档

- [基础请求 API](./basic-requests.md) - 了解基础请求方法
- [重试请求 API](./retry-logic.md) - 自动重试失败的请求
- [串行请求 API](./serial-requests.md) - 按顺序执行请求