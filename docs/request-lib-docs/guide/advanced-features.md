# 进阶功能

本文档介绍请求库的高级功能，包括请求缓存、并发控制和重试机制。这些功能可以显著提升应用的性能和可靠性。

## 🚀 快速预览

```typescript
import { createApiClient } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'
import type { RequestCore } from 'request-api'

class UserApi {
  constructor(private requestCore: RequestCore) {}

  // 使用缓存的请求
  async getUser(id: string) {
    return this.requestCore.getWithCache<User>(`/users/${id}`, {
      ttl: 300000, // 5分钟缓存
    })
  }

  // 重试请求
  async getImportantData(id: string) {
    return this.requestCore.getWithRetry<Data>(`/data/${id}`, {
      retries: 3,
      delay: 1000,
      backoffFactor: 2,
    })
  }

  // 并发请求
  async getUsersInParallel(ids: string[]) {
    const urls = ids.map((id) => `/users/${id}`)
    return this.requestCore.getConcurrent<User>(urls, {
      maxConcurrency: 5,
    })
  }
}
```

## 💾 请求缓存

请求缓存功能可以避免重复的网络请求，显著提升应用性能和用户体验。

### 基础用法

```typescript
class UserApi {
  constructor(private requestCore: RequestCore) {}

  // 基础缓存 - 使用默认5分钟TTL
  async getUser(id: string) {
    return this.requestCore.getWithCache<User>(`/users/${id}`)
  }

  // 自定义缓存时间
  async getUserWithCustomTTL(id: string) {
    return this.requestCore.getWithCache<User>(`/users/${id}`, {
      ttl: 600000, // 10分钟缓存
    })
  }

  // 使用自定义缓存键
  async getUserProfile(id: string, version: string) {
    return this.requestCore.getWithCache<UserProfile>(`/users/${id}/profile`, {
      key: `user-profile-${id}-v${version}`,
      ttl: 300000,
    })
  }
}
```

### 高级缓存配置

```typescript
import { StorageType } from 'request-core'

class DataApi {
  constructor(private requestCore: RequestCore) {}

  // 使用 localStorage 存储缓存
  async getCachedData(endpoint: string) {
    return this.requestCore.getWithCache<any>(endpoint, {
      ttl: 1800000, // 30分钟
      storageType: StorageType.LOCAL_STORAGE,
      maxEntries: 100, // 最大缓存条目数
    })
  }

  // 使用 IndexedDB 存储（适合大数据）
  async getLargeDataSet() {
    return this.requestCore.getWithCache<LargeDataSet>('/large-dataset', {
      ttl: 3600000, // 1小时
      storageType: StorageType.INDEXED_DB,
    })
  }

  // 深拷贝缓存数据（防止数据污染）
  async getMutableData() {
    return this.requestCore.getWithCache<MutableData>('/mutable-data', {
      ttl: 300000,
      clone: 'deep', // 深拷贝返回的数据
    })
  }
}
```

### 缓存键策略

```typescript
import { FullUrlKeyStrategy, ParameterizedKeyStrategy } from 'request-core'

class SearchApi {
  constructor(private requestCore: RequestCore) {}

  // 使用完整 URL 作为缓存键
  async searchUsers(query: string, filters: any) {
    return this.requestCore.getWithCache<SearchResult>('/search/users', {
      params: { q: query, ...filters },
      ttl: 120000, // 2分钟
      keyStrategy: new FullUrlKeyStrategy(),
    })
  }

  // 使用参数化键策略
  async getFilteredData(category: string, page: number) {
    return this.requestCore.getWithCache<FilteredData>('/data', {
      params: { category, page },
      ttl: 300000,
      keyStrategy: new ParameterizedKeyStrategy(['category']), // 只基于 category 生成键
    })
  }
}
```

### 缓存管理

```typescript
// 在 API 客户端中
const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: new AxiosRequestor(),
  }
)

// 清除所有缓存
apiClient.clearCache()

// 清除特定缓存
apiClient.clearCache('user-123')

// 获取缓存统计信息
const cacheStats = apiClient.getCacheStats()
console.log('缓存命中率:', cacheStats.hitRate)
console.log('缓存条目数:', cacheStats.totalItems)
```

### 链式调用中的缓存

```typescript
class ProductApi {
  constructor(private requestCore: RequestCore) {}

  async getPopularProducts() {
    return this.requestCore
      .request()
      .url('/products/popular')
      .method('GET')
      .cache(600000) // 10分钟缓存
      .timeout(8000)
      .send<Product[]>()
  }
}
```

## 🔄 请求重试

重试机制可以提升网络请求的可靠性，自动处理暂时性的网络问题。

### 基础重试

```typescript
class ApiService {
  constructor(private requestCore: RequestCore) {}

  // 简单重试 - 默认3次
  async getDataWithRetry() {
    return this.requestCore.getWithRetry<any>('/api/data')
  }

  // 自定义重试次数
  async getCriticalData() {
    return this.requestCore.getWithRetry<CriticalData>('/api/critical', {
      retries: 5,
      delay: 1000, // 每次重试间隔1秒
    })
  }

  // POST 请求重试
  async submitFormWithRetry(formData: any) {
    return this.requestCore.postWithRetry<SubmitResult>(
      '/api/submit',
      formData,
      {
        retries: 3,
        delay: 2000,
      }
    )
  }
}
```

### 高级重试配置

```typescript
import { RequestError } from 'request-core'

class RobustApi {
  constructor(private requestCore: RequestCore) {}

  // 指数退避重试
  async getWithBackoff() {
    return this.requestCore.getWithRetry<any>('/api/unstable', {
      retries: 5,
      delay: 1000,
      backoffFactor: 2, // 每次重试延迟翻倍
      jitter: 0.1, // 10% 的随机抖动
    })
  }

  // 自定义重试条件
  async getWithCustomRetry() {
    return this.requestCore.requestWithRetry<any>(
      {
        url: '/api/custom',
        method: 'GET',
      },
      {
        retries: 4,
        delay: 500,
        shouldRetry: (error: unknown, attempt: number) => {
          // 只对网络错误和 5xx 错误重试
          if (error instanceof RequestError) {
            // 5xx 服务器错误
            if (error.status && error.status >= 500 && error.status < 600) {
              return true
            }
            // 4xx 客户端错误不重试
            if (error.status && error.status >= 400 && error.status < 500) {
              return false
            }
            // 网络错误重试
            return !error.isHttpError
          }
          // 其他错误根据消息判断
          return (
            error instanceof Error &&
            error.message.toLowerCase().includes('network')
          )
        },
      }
    )
  }
}
```

### 链式调用中的重试

```typescript
class OrderApi {
  constructor(private requestCore: RequestCore) {}

  async submitOrder(orderData: Order) {
    return this.requestCore
      .request()
      .url('/orders')
      .method('POST')
      .data(orderData)
      .timeout(10000)
      .retry(3) // 重试3次
      .headers({ 'Idempotency-Key': orderData.idempotencyKey })
      .send<OrderResult>()
  }
}
```

## 🚦 并发请求

并发控制功能允许你高效地处理多个请求，同时控制系统资源消耗。

### 基础并发请求

```typescript
class BatchApi {
  constructor(private requestCore: RequestCore) {}

  // 并发获取多个用户
  async getMultipleUsers(userIds: string[]) {
    const urls = userIds.map((id) => `/users/${id}`)

    const results = await this.requestCore.getConcurrent<User>(urls, {
      maxConcurrency: 5, // 最大同时5个请求
      failFast: false, // 不快速失败，等待所有请求完成
    })

    // 提取成功的结果
    return this.requestCore.getSuccessfulResults(results)
  }

  // 并发 POST 请求
  async batchCreateUsers(users: CreateUserRequest[]) {
    const requests = users.map((userData) => ({
      url: '/users',
      data: userData,
    }))

    const results = await this.requestCore.postConcurrent<User>(requests, {
      maxConcurrency: 3,
      timeout: 30000, // 整体超时30秒
    })

    return results
  }
}
```

### 高级并发控制

```typescript
class DataProcessor {
  constructor(private requestCore: RequestCore) {}

  // 处理大量数据，控制并发数
  async processLargeDataSet(items: DataItem[]) {
    const configs = items.map((item) => ({
      url: `/process/${item.id}`,
      method: 'POST' as const,
      data: {
        payload: item.data,
        options: item.options,
      },
    }))

    const results = await this.requestCore.requestConcurrent<ProcessResult>(
      configs,
      {
        maxConcurrency: 10,
        failFast: false,
        retryOnError: true, // 错误时重试
        timeout: 60000,
      }
    )

    // 分析结果
    const successful = results.filter((r) => r.success)
    const failed = results.filter((r) => !r.success)

    console.log(`处理完成: 成功 ${successful.length}, 失败 ${failed.length}`)

    return {
      successful: successful.map((r) => r.data!),
      failed: failed.map((r) => ({
        config: r.config,
        error: r.error,
      })),
    }
  }

  // 重复请求（压力测试）
  async loadTest(endpoint: string, count: number) {
    const results = await this.requestCore.requestMultiple<any>(
      {
        url: endpoint,
        method: 'GET',
      },
      count,
      {
        maxConcurrency: 20,
        timeout: 120000,
      }
    )

    // 性能分析
    const durations = results
      .filter((r) => r.success && r.duration)
      .map((r) => r.duration!)

    const avgDuration = durations.reduce((a, b) => a + b, 0) / durations.length
    const maxDuration = Math.max(...durations)

    return {
      total: results.length,
      successful: results.filter((r) => r.success).length,
      avgDuration,
      maxDuration,
    }
  }
}
```

### 批量请求处理

```typescript
class FileProcessor {
  constructor(private requestCore: RequestCore) {}

  // 批量文件上传
  async uploadMultipleFiles(files: File[]) {
    const requests = files.map((file) => {
      const formData = new FormData()
      formData.append('file', file)

      return {
        url: '/upload',
        method: 'POST' as const,
        data: formData,
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      }
    })

    const results = await this.requestCore.batchRequests<UploadResult>(
      requests,
      {
        concurrency: 3, // 同时上传3个文件
        ignoreErrors: true, // 忽略错误，继续处理其他文件
      }
    )

    return results
  }
}
```

## 🔧 功能组合使用

你可以将这些高级功能组合使用，创建更强大的请求处理逻辑。

### 缓存 + 重试

```typescript
class RobustDataApi {
  constructor(private requestCore: RequestCore) {}

  // 首先尝试从缓存获取，失败时重试请求
  async getReliableData(id: string) {
    try {
      // 尝试从缓存获取
      return await this.requestCore.getWithCache<DataResult>(`/data/${id}`, {
        ttl: 300000,
      })
    } catch (error) {
      console.log('缓存未命中，执行重试请求')
      // 缓存失败时使用重试机制
      return await this.requestCore.getWithRetry<DataResult>(`/data/${id}`, {
        retries: 3,
        delay: 1000,
        backoffFactor: 1.5,
      })
    }
  }
}
```

### 并发 + 缓存

```typescript
class OptimizedApi {
  constructor(private requestCore: RequestCore) {}

  // 并发请求 + 智能缓存
  async loadDashboardData(userId: string) {
    const requests = [
      // 用户信息 - 长缓存
      this.requestCore.getWithCache<User>(`/users/${userId}`, {
        ttl: 1800000, // 30分钟
      }),

      // 通知 - 短缓存
      this.requestCore.getWithCache<Notification[]>(
        `/users/${userId}/notifications`,
        {
          ttl: 60000, // 1分钟
        }
      ),

      // 统计数据 - 中等缓存
      this.requestCore.getWithCache<Stats>(`/users/${userId}/stats`, {
        ttl: 300000, // 5分钟
      }),
    ]

    // 并发执行所有请求
    const [user, notifications, stats] = await Promise.all(requests)

    return {
      user,
      notifications,
      stats,
    }
  }
}
```

### 完整的生产级示例

```typescript
class ProductionApi {
  constructor(private requestCore: RequestCore) {}

  // 生产级数据获取 - 集成所有功能
  async getProductionData(params: SearchParams) {
    // 使用链式调用集成多种功能
    return this.requestCore
      .request()
      .url('/api/production/data')
      .method('GET')
      .params(params)
      .timeout(15000)
      .retry(3) // 3次重试
      .cache(180000) // 3分钟缓存
      .headers({
        Accept: 'application/json',
        'X-Client-Version': '1.0.0',
      })
      .tag('production-data') // 标记用于调试
      .debug(process.env.NODE_ENV === 'development')
      .send<ProductionDataResult>()
  }

  // 批量处理业务数据
  async processBulkBusinessData(items: BusinessItem[]) {
    // 分批处理，每批10个项目
    const batchSize = 10
    const batches = []

    for (let i = 0; i < items.length; i += batchSize) {
      batches.push(items.slice(i, i + batchSize))
    }

    const allResults = []

    // 串行处理批次，并行处理批次内项目
    for (const batch of batches) {
      const batchRequests = batch.map((item) => ({
        url: `/business/process/${item.id}`,
        method: 'POST' as const,
        data: item.data,
      }))

      const batchResults =
        await this.requestCore.requestConcurrent<ProcessResult>(batchRequests, {
          maxConcurrency: 5,
          retryOnError: true,
          timeout: 45000,
        })

      allResults.push(...batchResults)

      // 批次间休息100ms，避免过载
      if (batches.indexOf(batch) < batches.length - 1) {
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    return {
      total: allResults.length,
      successful: allResults.filter((r) => r.success),
      failed: allResults.filter((r) => !r.success),
    }
  }
}
```

## 📊 性能监控

```typescript
class MonitoringService {
  constructor(private requestCore: RequestCore) {}

  // 获取详细的性能统计
  getPerformanceStats() {
    const allStats = this.requestCore.getAllStats()

    return {
      cache: {
        hitRate: allStats.cache.hitRate,
        totalItems: allStats.cache.totalItems,
        memoryUsage: allStats.cache.memoryUsage,
      },
      concurrent: {
        activeRequests: allStats.concurrent.activeRequests,
        totalCompleted: allStats.concurrent.totalCompleted,
        averageResponseTime: allStats.concurrent.averageResponseTime,
      },
      interceptors: allStats.interceptors,
      config: allStats.config,
    }
  }

  // 定期清理和优化
  performMaintenance() {
    // 清理过期缓存
    this.requestCore.clearCache()

    console.log('Performance stats:', this.getPerformanceStats())
  }
}
```

## 🔧 最佳实践

### 1. 缓存策略

```typescript
// ✅ 推荐：不同数据使用不同的缓存策略
class DataService {
  constructor(private requestCore: RequestCore) {}

  // 静态数据 - 长时间缓存
  async getConfig() {
    return this.requestCore.getWithCache<Config>('/config', {
      ttl: 3600000, // 1小时
      storageType: StorageType.LOCAL_STORAGE,
    })
  }

  // 动态数据 - 短时间缓存
  async getNotifications() {
    return this.requestCore.getWithCache<Notification[]>('/notifications', {
      ttl: 30000, // 30秒
    })
  }

  // 用户相关数据 - 中等缓存 + 自定义键
  async getUserPreferences(userId: string) {
    return this.requestCore.getWithCache<UserPrefs>('/user/preferences', {
      key: `user-prefs-${userId}`,
      ttl: 300000, // 5分钟
    })
  }
}
```

### 2. 重试策略

```typescript
// ✅ 推荐：根据操作类型设置重试策略
class SmartRetryService {
  constructor(private requestCore: RequestCore) {}

  // 读操作 - 积极重试
  async getData(id: string) {
    return this.requestCore.getWithRetry<Data>(`/data/${id}`, {
      retries: 5,
      delay: 1000,
      backoffFactor: 1.5,
      jitter: 0.2,
    })
  }

  // 写操作 - 保守重试
  async updateData(id: string, data: any) {
    return this.requestCore.putWithRetry<Data>(`/data/${id}`, data, {
      retries: 2, // 较少重试次数
      delay: 2000,
      shouldRetry: (error) => {
        // 只对网络错误重试，避免重复操作
        return error instanceof RequestError && !error.isHttpError
      },
    })
  }

  // 幂等操作 - 中等重试
  async createIdempotent(data: any, idempotencyKey: string) {
    return this.requestCore.postWithRetry<Result>('/create', data, {
      retries: 3,
      delay: 1500,
      headers: { 'Idempotency-Key': idempotencyKey },
    })
  }
}
```

### 3. 并发控制

```typescript
// ✅ 推荐：合理的并发数控制
class ConcurrencyService {
  constructor(private requestCore: RequestCore) {}

  // CPU密集型 - 低并发
  async processCPUIntensive(items: any[]) {
    return this.requestCore.requestConcurrent(
      items.map((item) => ({ url: '/cpu-intensive', data: item })),
      { maxConcurrency: 2 }
    )
  }

  // I/O密集型 - 高并发
  async processIOIntensive(items: any[]) {
    return this.requestCore.requestConcurrent(
      items.map((item) => ({ url: '/io-intensive', data: item })),
      { maxConcurrency: 10 }
    )
  }

  // 外部API - 受限并发（遵守速率限制）
  async callExternalAPI(items: any[]) {
    return this.requestCore.requestConcurrent(
      items.map((item) => ({ url: '/external-api', data: item })),
      {
        maxConcurrency: 3, // 较低并发避免触发限流
        timeout: 30000,
        retryOnError: true,
      }
    )
  }
}
```

## 🚨 注意事项

### 缓存注意事项

1. **内存管理**: 合理设置 `maxEntries` 避免内存泄漏
2. **数据一致性**: 缓存的数据可能不是最新的
3. **存储选择**: 大数据量使用 IndexedDB，小数据使用内存缓存

### 重试注意事项

1. **幂等性**: 确保重试的操作是幂等的
2. **退避策略**: 使用指数退避避免服务器过载
3. **错误分类**: 区分可重试和不可重试的错误

### 并发注意事项

1. **资源限制**: 不要设置过高的并发数
2. **错误处理**: 合理处理部分成功的情况
3. **超时设置**: 设置合理的整体超时时间

---

## 📚 相关文档

- 🚀 [快速开始](/guide/getting-started) - 基础使用方法
- 📖 [基础用法](/guide/basic-usage) - 详细功能介绍
- 📋 [API 参考](/api/request-core) - 完整 API 文档

## 🆘 获取帮助

如果在使用高级功能时遇到问题：

1. 查看 [故障排除指南](/guide/troubleshooting)
2. 浏览 [使用示例](/examples/basic-requests)
