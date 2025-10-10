# 重试机制示例

## 概念介绍

重试机制是指在请求失败时自动重新发起请求的功能。当遇到临时性故障（如网络超时、服务器 5xx 错误）时，系统会按照配置的策略（重试次数、延迟时间、退避算法等）自动重试，提高请求的成功率和系统的健壮性。

支持以下特性：

- **智能重试判断**：自动判断错误类型，仅对可重试的错误（如网络错误、5xx 服务器错误）进行重试
- **灵活的延迟策略**：支持固定延迟、指数退避、随机抖动等多种延迟策略
- **自定义重试条件**：可通过 `shouldRetry` 函数自定义重试逻辑
- **详细的日志记录**：自动记录每次重试的状态和原因

## 使用场景

### 1. 处理临时性网络故障

适用于网络不稳定或偶发性连接超时的情况：

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

// 自动重试网络错误
const userData = await client.user.requestCore.getWithRetry('/users/123', {
  retries: 3, // 重试 3 次
  delay: 1000, // 每次延迟 1 秒
})
```

### 2. 应对服务器临时故障

当服务器返回 5xx 错误时自动重试：

```typescript
// 重试服务器错误
const result = await requestCore.postWithRetry(
  '/api/orders',
  orderData,
  {
    retries: 5, // 重试 5 次
    delay: 2000, // 初始延迟 2 秒
    backoffFactor: 2, // 指数退避因子
  }
)
```

### 3. 关键业务操作保障

对于重要的业务操作（如支付、订单提交），使用重试增强成功率：

```typescript
// 支付请求 - 使用退避和抖动策略
const paymentResult = await requestCore.requestWithRetry(
  {
    url: '/api/payment/create',
    method: 'POST',
    data: paymentData,
  },
  {
    retries: 3,
    delay: 1000,
    backoffFactor: 2, // 延迟翻倍：1s -> 2s -> 4s
    jitter: 0.3, // 30% 的随机抖动
  }
)
```

### 4. 自定义重试逻辑

根据特定错误码或业务规则决定是否重试：

```typescript
const result = await requestCore.requestWithRetry(
  { url: '/api/data', method: 'GET' },
  {
    retries: 3,
    delay: 1000,
    shouldRetry: (error, attempt) => {
      // 自定义重试逻辑
      if (error instanceof RequestError) {
        // 仅重试 503 Service Unavailable
        if (error.status === 503) {
          return true
        }
        // 不重试 4xx 客户端错误
        if (error.status && error.status >= 400 && error.status < 500) {
          return false
        }
      }
      // 其他情况使用默认逻辑
      return true
    },
  }
)
```

## API 和配置参数说明

### 核心方法

#### `requestWithRetry<T>(config, retryConfig?): Promise<T>`

执行带重试的通用请求方法。

**参数**：

- `config: RequestConfig` - 请求配置
- `retryConfig?: RetryConfig` - 重试配置

**示例**：

```typescript
const data = await requestCore.requestWithRetry(
  {
    url: '/api/data',
    method: 'GET',
    timeout: 5000,
  },
  {
    retries: 3,
    delay: 1000,
    backoffFactor: 2,
    jitter: 0.2,
  }
)
```

### 便利方法

#### `getWithRetry<T>(url, retryConfig?): Promise<T>`

重试 GET 请求的便利方法。

```typescript
const users = await requestCore.getWithRetry('/api/users', {
  retries: 3,
  delay: 1000,
})
```

#### `postWithRetry<T>(url, data?, retryConfig?): Promise<T>`

重试 POST 请求的便利方法。

```typescript
const result = await requestCore.postWithRetry(
  '/api/users',
  { name: 'John', email: 'john@example.com' },
  {
    retries: 5,
    delay: 2000,
    backoffFactor: 2,
  }
)
```

### 链式调用

使用链式调用构建器简化重试请求：

```typescript
const data = await requestCore
  .create()
  .url('/api/data')
  .method('GET')
  .retry(3) // 设置重试 3 次
  .timeout(5000)
  .send()
```

### 配置参数详解

#### RetryConfig 重试配置

```typescript
interface RetryConfig {
  retries: number // 重试次数（必填）
  delay?: number // 基础延迟时间（毫秒），默认 1000
  backoffFactor?: number // 退避因子，默认 1（无退避）
  jitter?: number // 抖动比例 (0-1)，默认 0（无抖动）
  shouldRetry?: (error: unknown, attempt: number) => boolean // 自定义重试判断函数
}
```

#### 参数说明

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `retries` | number | - | **必填**，重试次数（如设为 3，则总共尝试 4 次） |
| `delay` | number | `1000` | 基础延迟时间（毫秒），第一次重试前的等待时间 |
| `backoffFactor` | number | `1` | 指数退避因子，大于 1 时启用指数退避 |
| `jitter` | number | `0` | 随机抖动比例（0-1），用于避免"惊群效应" |
| `shouldRetry` | function | 默认函数 | 自定义重试判断逻辑，返回 `true` 继续重试 |

#### 延迟计算公式

```typescript
// 基础公式
actualDelay = baseDelay * (backoffFactor ^ attempt) + jitterDelta

// jitterDelta 计算
jitterDelta = baseDelay * (backoffFactor ^ attempt) * random(0, jitter)
```

**示例**：

- `delay: 1000, backoffFactor: 1, jitter: 0`：固定延迟 1000ms
- `delay: 1000, backoffFactor: 2, jitter: 0`：指数退避 1s -> 2s -> 4s
- `delay: 1000, backoffFactor: 2, jitter: 0.3`：指数退避 + 30% 随机抖动

#### 默认重试判断逻辑

默认的 `shouldRetry` 函数会在以下情况重试：

1. **HTTP 5xx 服务器错误**（500-599）
2. **网络错误**：消息中包含 `network`、`timeout`、`connection`、`fetch`
3. **非 HTTP 错误**：如请求配置错误、拦截器错误等

**不重试的情况**：

- **HTTP 4xx 客户端错误**（400-499）：如 401 未授权、404 未找到等
- **HTTP 2xx/3xx 成功/重定向响应**

### 完整示例

```typescript
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import { RequestError } from 'request-core'

// 定义 API 类
class OrderApi {
  constructor(public requestCore: any) {}

  // 创建订单 - 使用重试
  async createOrder(orderData: any) {
    return this.requestCore.postWithRetry(
      '/orders',
      orderData,
      {
        retries: 3,
        delay: 1000,
        backoffFactor: 2, // 1s -> 2s -> 4s
        jitter: 0.2, // 20% 抖动
      }
    )
  }

  // 查询订单 - 自定义重试逻辑
  async getOrder(orderId: string) {
    return this.requestCore.requestWithRetry(
      {
        url: `/orders/${orderId}`,
        method: 'GET',
      },
      {
        retries: 5,
        delay: 500,
        shouldRetry: (error, attempt) => {
          // 仅重试网络错误和 503 错误
          if (error instanceof RequestError) {
            if (error.status === 503) {
              console.log(`Retry attempt ${attempt} for 503 error`)
              return true
            }
            if (!error.isHttpError) {
              return true
            }
            return false
          }
          return false
        },
      }
    )
  }
}

// 创建 API 客户端
const client = createApiClient(
  { order: OrderApi },
  {
    requestor: fetchRequestor,
    globalConfig: {
      baseURL: 'https://api.example.com',
      timeout: 10000,
    },
  }
)

// 使用重试功能
async function main() {
  try {
    // 创建订单
    const order = await client.order.createOrder({
      items: [{ id: 1, quantity: 2 }],
      total: 100,
    })
    console.log('Order created:', order)

    // 查询订单
    const orderDetail = await client.order.getOrder(order.id)
    console.log('Order detail:', orderDetail)
  } catch (error) {
    console.error('Request failed after all retries:', error)
  }
}
```

## 注意事项

### ⚠️ 重试次数和延迟设置

1. **合理设置重试次数**

   ```typescript
   // ✅ 一般场景：2-3 次重试
   await requestCore.getWithRetry('/api/data', {
     retries: 3,
     delay: 1000,
   })

   // ✅ 关键操作：5 次以上重试
   await requestCore.postWithRetry('/api/payment', data, {
     retries: 5,
     delay: 2000,
     backoffFactor: 2,
   })

   // ❌ 避免过多重试次数
   await requestCore.getWithRetry('/api/data', {
     retries: 100, // 过多！
   })
   ```

2. **使用指数退避避免服务器过载**

   ```typescript
   // ✅ 推荐：使用指数退避
   await requestCore.requestWithRetry(config, {
     retries: 5,
     delay: 1000,
     backoffFactor: 2, // 1s -> 2s -> 4s -> 8s -> 16s
   })

   // ❌ 不推荐：固定短延迟
   await requestCore.requestWithRetry(config, {
     retries: 10,
     delay: 100, // 可能导致服务器过载
   })
   ```

3. **添加随机抖动避免惊群效应**
   ```typescript
   // ✅ 推荐：添加抖动
   await requestCore.requestWithRetry(config, {
     retries: 3,
     delay: 1000,
     backoffFactor: 2,
     jitter: 0.3, // 30% 随机抖动
   })
   ```

### 🔒 幂等性要求

1. **确保请求幂等性**

   ```typescript
   // ✅ 幂等请求：安全重试
   await requestCore.getWithRetry('/api/user/profile') // GET 请求天然幂等
   
   // PUT 更新整个资源 - 使用通用 requestWithRetry
   await requestCore.requestWithRetry(
     { url: '/api/users/123', method: 'PUT', data: userData },
     { retries: 3 }
   )

   // ⚠️ 非幂等请求：需要额外保障
   await requestCore.postWithRetry('/api/orders', orderData) // POST 可能重复创建
   ```

2. **非幂等操作的解决方案**

   ```typescript
   // 方案 1：使用幂等键
   await requestCore.postWithRetry(
     '/api/orders',
     orderData,
     {
       retries: 3,
       headers: {
         'Idempotency-Key': generateUniqueId(), // 服务器端去重
       },
     }
   )

   // 方案 2：使用幂等请求功能
   await requestCore.postIdempotent('/api/orders', orderData, {}, {
     ttl: 30000,
   })
   ```

### 🎯 自定义重试逻辑

1. **根据错误类型判断**

   ```typescript
   await requestCore.requestWithRetry(config, {
     retries: 3,
     shouldRetry: (error, attempt) => {
       if (error instanceof RequestError) {
         // 不重试客户端错误
         if (error.status && error.status >= 400 && error.status < 500) {
           return false
         }
         // 重试服务器错误和网络错误
         return true
       }
       return false
     },
   })
   ```

2. **根据尝试次数调整策略**

   ```typescript
   await requestCore.requestWithRetry(config, {
     retries: 5,
     delay: 1000,
     shouldRetry: (error, attempt) => {
       // 前 3 次尝试：重试所有错误
       if (attempt < 3) {
         return true
       }
       // 后续尝试：仅重试网络错误
       if (error instanceof RequestError) {
         return !error.isHttpError
       }
       return false
     },
   })
   ```

3. **根据业务错误码判断**
   ```typescript
   await requestCore.requestWithRetry(config, {
     retries: 3,
     shouldRetry: (error, attempt) => {
       if (error instanceof RequestError && error.response?.data?.code) {
         const code = error.response.data.code
         // 仅重试特定业务错误码
         return ['RATE_LIMIT', 'SERVICE_BUSY', 'TEMPORARY_ERROR'].includes(code)
       }
       return true
     },
   })
   ```

### 📊 日志和监控

1. **查看重试日志**

   重试过程会自动输出日志：

   ```
   🔄 [Retry] Making request (attempt 1/4)
     URL: /api/data
     Method: GET

   ⏳ [Retry] Request failed, will retry in 1000ms
     URL: /api/data
     Remaining retries: 3
     Error: Network error

   🔄 [Retry] Making request (attempt 2/4)
     URL: /api/data
     Method: GET
   ```

2. **捕获和处理最终失败**
   ```typescript
   try {
     await requestCore.getWithRetry('/api/data', { retries: 3 })
   } catch (error) {
     // 所有重试都失败后会抛出最后一个错误
     console.error('Request failed after all retries:', error)
     // 记录到监控系统
     logToMonitoring({
       type: 'retry_exhausted',
       url: '/api/data',
       error: error,
     })
   }
   ```

### 🏗️ 最佳实践

1. **分层设置重试策略**

   ```typescript
   // 基础数据查询：少重试、短延迟
   const basicData = await requestCore.getWithRetry('/api/config', {
     retries: 2,
     delay: 500,
   })

   // 业务操作：中等重试、指数退避
   const orderResult = await requestCore.postWithRetry('/api/orders', data, {
     retries: 3,
     delay: 1000,
     backoffFactor: 2,
   })

   // 关键交易：多次重试、长延迟、抖动
   const paymentResult = await requestCore.postWithRetry('/api/payment', data, {
     retries: 5,
     delay: 2000,
     backoffFactor: 2,
     jitter: 0.3,
   })
   ```

2. **结合超时配置**

   ```typescript
   // 设置合理的超时时间
   const data = await requestCore.requestWithRetry(
     {
       url: '/api/data',
       method: 'GET',
       timeout: 5000, // 5 秒超时
     },
     {
       retries: 3,
       delay: 1000,
     }
   )
   // 总耗时最多：5s * 4 次尝试 + 1s * 3 次延迟 = 23s
   ```

3. **与其他功能组合使用**

   ```typescript
   // 结合缓存：失败重试，成功缓存
   const data = await requestCore.getWithCache('/api/data', {
     ttl: 5 * 60 * 1000, // 缓存 5 分钟
   })
   // 如果缓存未命中，内部会使用重试机制

   // 结合幂等：防重复 + 自动重试
   const result = await requestCore.postIdempotent(
     '/api/orders',
     orderData,
     {},
     {
       ttl: 30000, // 30 秒内去重
     }
   )
   ```

4. **监控重试率**
   ```typescript
   // 记录重试情况用于后续分析
   let retryCount = 0
   await requestCore.requestWithRetry(config, {
     retries: 3,
     shouldRetry: (error, attempt) => {
       retryCount = attempt
       return true // 使用默认逻辑
     },
   })
   console.log(`Request completed after ${retryCount + 1} attempts`)
   ```

### ⏱️ 性能考虑

1. **计算最大等待时间**

   ```typescript
   // 示例：retries=3, delay=1000, backoffFactor=2
   // 延迟序列：1s -> 2s -> 4s
   // 最大等待时间 = 1 + 2 + 4 = 7 秒（不包括请求本身的时间）
   ```

2. **避免过长的总耗时**
   ```typescript
   // ❌ 可能导致用户长时间等待
   await requestCore.requestWithRetry(config, {
     retries: 10,
     delay: 5000,
     backoffFactor: 2,
   })
   // 最坏情况可能等待数分钟
   ```

---

通过合理配置重试机制，你可以显著提高应用的可靠性和容错能力，减少因临时性故障导致的请求失败，提升用户体验。
