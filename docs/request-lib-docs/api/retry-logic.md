# 重试请求API

本文档介绍如何在 API 客户端中使用重试功能，自动重试失败的请求，提高应用的健壮性。

## 核心概念

重试功能允许在请求失败时自动重新发起请求，适用于网络不稳定、服务器临时错误等场景。系统会根据配置的策略自动重试，直到成功或达到最大重试次数。

### 主要特性

- **智能重试判断**：自动识别可重试的错误类型（网络错误、5xx 错误等）
- **指数退避**：支持指数退避策略，避免过度请求
- **抖动（Jitter）**：添加随机延迟，避免请求集中
- **自定义重试条件**：支持自定义重试判断逻辑
- **详细日志**：记录每次重试的详细信息

## 在 API 类中使用重试

### 基础用法

```typescript
import { type RequestCore } from 'request-api'

class UserApi {
  constructor(public requestCore: RequestCore) {}

  // 使用重试的 GET 请求
  async getUser(id: string) {
    return this.requestCore.getWithRetry(`/users/${id}`, {
      retries: 3, // 最多重试 3 次
    })
  }

  // 使用重试的 POST 请求
  async createUser(data: any) {
    return this.requestCore.postWithRetry('/users', data, {
      retries: 2,
      delay: 1000, // 重试延迟 1 秒
    })
  }

  // 使用通用重试方法
  async updateUser(id: string, data: any) {
    return this.requestCore.requestWithRetry(
      {
        url: `/users/${id}`,
        method: 'PUT',
        data,
      },
      {
        retries: 3,
        delay: 1000,
      }
    )
  }
}
```

### 指数退避策略

当服务器负载较高时，使用指数退避避免雪崩：

```typescript
class ApiClient {
  constructor(public requestCore: RequestCore) {}

  async fetchData() {
    return this.requestCore.requestWithRetry(
      {
        url: '/api/data',
        method: 'GET',
      },
      {
        retries: 4,
        delay: 1000,        // 基础延迟 1 秒
        backoffFactor: 2,   // 指数退避因子
        // 重试延迟序列：1s, 2s, 4s, 8s
      }
    )
  }
}
```

### 添加抖动避免请求集中

```typescript
class OrderApi {
  constructor(public requestCore: RequestCore) {}

  async submitOrder(orderData: any) {
    return this.requestCore.postWithRetry('/orders', orderData, {
      retries: 3,
      delay: 1000,
      backoffFactor: 2,
      jitter: 0.3,  // 添加 30% 的随机抖动
      // 实际延迟会在计算值的基础上 ±30%
    })
  }
}
```

### 自定义重试条件

```typescript
class CustomApi {
  constructor(public requestCore: RequestCore) {}

  async fetchImportantData() {
    return this.requestCore.requestWithRetry(
      {
        url: '/important-data',
        method: 'GET',
      },
      {
        retries: 5,
        delay: 2000,
        // 自定义重试判断逻辑
        shouldRetry: (error, attempt) => {
          // 只重试网络错误和 503 错误
          if (error instanceof RequestError) {
            if (error.type === RequestErrorType.NETWORK_ERROR) {
              return true
            }
            if (error.status === 503) {
              return true
            }
          }
          return false
        },
      }
    )
  }
}
```

### 不同场景的重试策略

```typescript
class DataApi {
  constructor(public requestCore: RequestCore) {}

  // 关键数据 - 积极重试
  async getCriticalData() {
    return this.requestCore.getWithRetry('/critical-data', {
      retries: 5,
      delay: 1000,
      backoffFactor: 2,
    })
  }

  // 普通数据 - 中等重试
  async getNormalData() {
    return this.requestCore.getWithRetry('/normal-data', {
      retries: 3,
      delay: 1000,
    })
  }

  // 非关键数据 - 快速失败
  async getOptionalData() {
    return this.requestCore.getWithRetry('/optional-data', {
      retries: 1,
      delay: 500,
    })
  }
}
```

## API 参考

### requestWithRetry

使用重试执行请求的通用方法。

#### 类型签名

```typescript
async requestWithRetry<T>(
  config: RequestConfig,
  retryConfig?: RetryConfig
): Promise<T>
```

#### 参数

**config: RequestConfig**

标准的请求配置对象，包含 url、method 等字段。

**retryConfig: RetryConfig**（可选）

```typescript
interface RetryConfig {
  // 重试次数，默认 3
  retries?: number

  // 基础延迟时间（毫秒），默认 1000
  delay?: number

  // 指数退避因子，默认 1（不使用指数退避）
  // 设置为 >1 的值（如 2）启用指数退避
  backoffFactor?: number

  // 抖动因子（0-1 之间），默认 0
  // 例如 0.3 表示在计算的延迟基础上 ±30% 的随机值
  jitter?: number

  // 自定义重试判断函数
  shouldRetry?: (error: unknown, attempt: number) => boolean
}
```

#### 默认重试条件

如果不提供 `shouldRetry` 函数，系统会使用默认的重试判断逻辑：

- **5xx 服务器错误**：自动重试
- **网络错误**：自动重试（如连接失败、DNS 解析失败等）
- **超时错误**：自动重试
- **4xx 客户端错误**：不重试（除非自定义 shouldRetry）

#### 示例

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.requestWithRetry<User>(
      {
        url: `/users/${id}`,
        method: 'GET',
      },
      {
        retries: 3,
        delay: 1000,
        backoffFactor: 2,
        jitter: 0.2,
      }
    )
  }
}
```

### getWithRetry

重试 GET 请求的便捷方法。

#### 类型签名

```typescript
async getWithRetry<T>(url: string, retryConfig?: RetryConfig): Promise<T>
```

#### 参数

- **url**: 请求地址
- **retryConfig**: 重试配置（可选）

#### 示例

```typescript
class ProductApi {
  constructor(public requestCore: RequestCore) {}

  async getProduct(id: string) {
    return this.requestCore.getWithRetry<Product>(`/products/${id}`, {
      retries: 3,
      delay: 1000,
    })
  }
}
```

### postWithRetry

重试 POST 请求的便捷方法。

#### 类型签名

```typescript
async postWithRetry<T>(
  url: string,
  data?: any,
  retryConfig?: RetryConfig
): Promise<T>
```

#### 参数

- **url**: 请求地址
- **data**: 请求体数据（可选）
- **retryConfig**: 重试配置（可选）

#### 示例

```typescript
class OrderApi {
  constructor(public requestCore: RequestCore) {}

  async createOrder(orderData: any) {
    return this.requestCore.postWithRetry<Order>('/orders', orderData, {
      retries: 2,
      delay: 1500,
    })
  }
}
```

## 重试策略详解

### 1. 固定延迟

最简单的重试策略，每次重试都使用相同的延迟时间：

```typescript
class SimpleRetryApi {
  constructor(public requestCore: RequestCore) {}

  async fetchData() {
    return this.requestCore.requestWithRetry(
      { url: '/data', method: 'GET' },
      {
        retries: 3,
        delay: 1000, // 每次重试都延迟 1 秒
      }
    )
    // 重试序列：1s -> 1s -> 1s
  }
}
```

### 2. 指数退避

延迟时间按指数增长，适合处理服务器负载问题：

```typescript
class ExponentialBackoffApi {
  constructor(public requestCore: RequestCore) {}

  async fetchData() {
    return this.requestCore.requestWithRetry(
      { url: '/data', method: 'GET' },
      {
        retries: 4,
        delay: 1000,
        backoffFactor: 2,
      }
    )
    // 重试序列：1s -> 2s -> 4s -> 8s
  }
}
```

### 3. 指数退避 + 抖动

在指数退避的基础上添加随机抖动，避免多个客户端同时重试：

```typescript
class JitteredBackoffApi {
  constructor(public requestCore: RequestCore) {}

  async fetchData() {
    return this.requestCore.requestWithRetry(
      { url: '/data', method: 'GET' },
      {
        retries: 4,
        delay: 1000,
        backoffFactor: 2,
        jitter: 0.3, // 30% 抖动
      }
    )
    // 重试序列（示例）：
    // 0.7s ~ 1.3s -> 1.4s ~ 2.6s -> 2.8s ~ 5.2s -> 5.6s ~ 10.4s
  }
}
```

## 完整示例

### 基础场景

```typescript
import { createApiClient, type RequestCore } from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

// 定义 API 类
class UserApi {
  constructor(public requestCore: RequestCore) {}

  // 获取用户 - 使用重试
  async getUser(id: string) {
    return this.requestCore.getWithRetry(`/users/${id}`, {
      retries: 3,
      delay: 1000,
    })
  }

  // 创建用户 - 使用重试和指数退避
  async createUser(userData: any) {
    return this.requestCore.postWithRetry('/users', userData, {
      retries: 3,
      delay: 1000,
      backoffFactor: 2,
    })
  }

  // 更新用户 - 使用重试和抖动
  async updateUser(id: string, userData: any) {
    return this.requestCore.requestWithRetry(
      {
        url: `/users/${id}`,
        method: 'PUT',
        data: userData,
      },
      {
        retries: 3,
        delay: 1000,
        backoffFactor: 2,
        jitter: 0.2,
      }
    )
  }
}

// 创建 API 客户端
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
  try {
    // 自动重试最多 3 次
    const user = await apiClient.user.getUser('123')
    console.log('User:', user)
  } catch (error) {
    // 所有重试都失败后才会抛出错误
    console.error('Failed after all retries:', error)
  }
}
```

### 自定义重试条件

```typescript
import { RequestError, RequestErrorType } from 'request-api'

class PaymentApi {
  constructor(public requestCore: RequestCore) {}

  async processPayment(paymentData: any) {
    return this.requestCore.requestWithRetry(
      {
        url: '/payments',
        method: 'POST',
        data: paymentData,
      },
      {
        retries: 5,
        delay: 2000,
        backoffFactor: 1.5,
        shouldRetry: (error, attempt) => {
          console.log(`Retry attempt ${attempt}`)

          if (error instanceof RequestError) {
            // 仅重试网络错误和特定的服务器错误
            if (error.type === RequestErrorType.NETWORK_ERROR) {
              return true
            }

            // 503 Service Unavailable - 重试
            if (error.status === 503) {
              return true
            }

            // 502 Bad Gateway - 重试
            if (error.status === 502) {
              return true
            }

            // 429 Too Many Requests - 重试（但延迟更长）
            if (error.status === 429) {
              return true
            }

            // 其他错误不重试
            return false
          }

          return false
        },
      }
    )
  }
}

const apiClient = createApiClient(
  { payment: PaymentApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 不同优先级的重试策略

```typescript
class DataApi {
  constructor(public requestCore: RequestCore) {}

  // 关键数据 - 积极重试
  async getCriticalData() {
    return this.requestCore.getWithRetry('/critical-data', {
      retries: 5,        // 重试 5 次
      delay: 2000,       // 初始延迟 2 秒
      backoffFactor: 2,  // 指数退避
      jitter: 0.3,       // 30% 抖动
    })
  }

  // 普通数据 - 标准重试
  async getNormalData() {
    return this.requestCore.getWithRetry('/normal-data', {
      retries: 3,
      delay: 1000,
      backoffFactor: 1.5,
    })
  }

  // 实时数据 - 快速失败
  async getRealtimeData() {
    return this.requestCore.getWithRetry('/realtime-data', {
      retries: 1,
      delay: 500,
    })
  }

  // 可选数据 - 不重试
  async getOptionalData() {
    // 直接使用普通请求，不重试
    return this.requestCore.get('/optional-data')
  }
}

const apiClient = createApiClient(
  { data: DataApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 结合错误处理

```typescript
class RobustApi {
  constructor(public requestCore: RequestCore) {}

  async fetchDataWithFallback() {
    try {
      // 尝试从主服务器获取
      return await this.requestCore.getWithRetry('/primary/data', {
        retries: 2,
        delay: 1000,
      })
    } catch (primaryError) {
      console.warn('Primary server failed, trying backup...', primaryError)

      try {
        // 主服务器失败，尝试备份服务器
        return await this.requestCore.getWithRetry('/backup/data', {
          retries: 3,
          delay: 1500,
        })
      } catch (backupError) {
        console.error('Both servers failed:', backupError)
        // 返回缓存数据或默认值
        return this.getCachedOrDefaultData()
      }
    }
  }

  private getCachedOrDefaultData() {
    // 实现缓存或默认数据逻辑
    return { data: 'default' }
  }
}

const apiClient = createApiClient(
  { robust: RobustApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

## 最佳实践

### 1. 根据操作类型选择重试策略

```typescript
class BestPracticeApi {
  constructor(public requestCore: RequestCore) {}

  // 读操作 - 可以积极重试
  async getData(id: string) {
    return this.requestCore.getWithRetry(`/data/${id}`, {
      retries: 3,
      delay: 1000,
      backoffFactor: 2,
    })
  }

  // 写操作 - 谨慎重试（考虑幂等性）
  async createData(data: any) {
    return this.requestCore.postWithRetry('/data', data, {
      retries: 2,        // 较少的重试次数
      delay: 2000,       // 较长的延迟
      shouldRetry: (error) => {
        // 只在明确是网络错误时重试
        if (error instanceof RequestError) {
          return error.type === RequestErrorType.NETWORK_ERROR
        }
        return false
      },
    })
  }
}
```

### 2. 使用指数退避避免服务器过载

```typescript
class ServerFriendlyApi {
  constructor(public requestCore: RequestCore) {}

  async heavyOperation() {
    return this.requestCore.requestWithRetry(
      {
        url: '/heavy-operation',
        method: 'POST',
        data: { /* ... */ },
      },
      {
        retries: 4,
        delay: 1000,
        backoffFactor: 2,  // 1s, 2s, 4s, 8s
        jitter: 0.3,       // 添加抖动避免集中
      }
    )
  }
}
```

### 3. 自定义重试逻辑处理特殊情况

```typescript
class SmartRetryApi {
  constructor(public requestCore: RequestCore) {}

  async smartFetch() {
    return this.requestCore.requestWithRetry(
      {
        url: '/data',
        method: 'GET',
      },
      {
        retries: 5,
        delay: 1000,
        shouldRetry: (error, attempt) => {
          if (!(error instanceof RequestError)) {
            return false
          }

          // 根据错误类型和重试次数决定是否继续
          switch (error.status) {
            case 429: // Too Many Requests
              // 总是重试，但需要更长的延迟
              return true
            case 503: // Service Unavailable
              // 仅在前 3 次重试
              return attempt < 3
            case 500: // Internal Server Error
              // 仅在前 2 次重试
              return attempt < 2
            default:
              // 网络错误总是重试
              return error.type === RequestErrorType.NETWORK_ERROR
          }
        },
      }
    )
  }
}
```

### 4. 记录重试信息用于监控

```typescript
class MonitoredApi {
  constructor(public requestCore: RequestCore) {}

  async monitoredRequest() {
    const startTime = Date.now()
    let attemptCount = 0

    try {
      return await this.requestCore.requestWithRetry(
        { url: '/data', method: 'GET' },
        {
          retries: 3,
          delay: 1000,
          shouldRetry: (error, attempt) => {
            attemptCount = attempt + 1

            // 记录重试信息
            console.log(`Retry attempt ${attemptCount}`, {
              error: error instanceof Error ? error.message : 'Unknown',
              timestamp: Date.now(),
            })

            // 默认重试逻辑
            return error instanceof RequestError && 
              error.type === RequestErrorType.NETWORK_ERROR
          },
        }
      )
    } catch (error) {
      // 记录最终失败
      console.error('Request failed after all retries', {
        attemptCount,
        duration: Date.now() - startTime,
        error: error instanceof Error ? error.message : 'Unknown',
      })
      throw error
    }
  }
}
```

### 5. 避免无意义的重试

```typescript
class EfficientApi {
  constructor(public requestCore: RequestCore) {}

  async efficientRequest() {
    return this.requestCore.requestWithRetry(
      { url: '/data', method: 'GET' },
      {
        retries: 3,
        delay: 1000,
        shouldRetry: (error) => {
          if (!(error instanceof RequestError)) {
            return false
          }

          // 不重试的情况
          const noRetryStatuses = [
            400, // Bad Request - 请求参数错误
            401, // Unauthorized - 未授权
            403, // Forbidden - 禁止访问
            404, // Not Found - 资源不存在
            422, // Unprocessable Entity - 验证失败
          ]

          if (error.status && noRetryStatuses.includes(error.status)) {
            return false
          }

          // 重试网络错误和 5xx 错误
          return (
            error.type === RequestErrorType.NETWORK_ERROR ||
            (error.status && error.status >= 500 && error.status < 600)
          )
        },
      }
    )
  }
}
```

## 注意事项

1. **幂等性考虑**：对于非幂等的写操作（如创建资源），谨慎使用重试，避免重复创建
2. **重试次数**：不要设置过多的重试次数，避免长时间阻塞用户操作
3. **延迟设置**：合理设置延迟时间，避免过度请求服务器
4. **错误类型**：仅重试可恢复的错误（网络错误、5xx 错误），不要重试 4xx 客户端错误
5. **监控日志**：记录重试信息，帮助诊断问题
6. **用户体验**：对于用户发起的操作，考虑显示重试状态

## 常见错误码处理建议

| 错误码 | 是否重试 | 说明 |
|--------|----------|------|
| 400    | ❌ 否    | 请求参数错误，重试无意义 |
| 401    | ❌ 否    | 未授权，需要重新登录 |
| 403    | ❌ 否    | 禁止访问，权限问题 |
| 404    | ❌ 否    | 资源不存在，重试无意义 |
| 408    | ✅ 是    | 请求超时，可以重试 |
| 429    | ✅ 是    | 请求过多，延迟后重试 |
| 500    | ✅ 是    | 服务器错误，可以重试 |
| 502    | ✅ 是    | 网关错误，可以重试 |
| 503    | ✅ 是    | 服务不可用，可以重试 |
| 504    | ✅ 是    | 网关超时，可以重试 |
| 网络错误 | ✅ 是  | 连接失败等，可以重试 |

## 相关文档

- [基础请求 API](./basic-requests.md) - 了解基础请求方法
- [幂等请求 API](./idempotent-requests.md) - 防止重复提交
- [缓存请求 API](./caching.md) - 缓存响应数据