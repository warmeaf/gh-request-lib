# 重试请求示例

本文档演示了 request-api 库的重试功能，包括基础重试、指数退避、抖动策略和自定义重试条件。所有示例都使用 [JSONPlaceholder](https://jsonplaceholder.typicode.com/) 作为测试 API。

## 基础重试

演示如何使用 `requestWithRetry` 方法实现请求重试，自动处理失败的请求。

:::preview 基础重试使用

demo-preview=./components/retry-logic/basic-retry.vue

:::

**关键要点：**
- 使用 `requestWithRetry`、`getWithRetry`、`postWithRetry` 等方法启用重试
- 设置 `retries` 参数指定最大重试次数
- 设置 `delay` 参数指定重试延迟（毫秒）
- 默认重试条件：网络错误、5xx 服务器错误、超时错误
- 记录每次重试的详细信息，便于调试

## 指数退避

演示指数退避策略，延迟时间按指数增长，适合处理服务器负载问题。

:::preview 指数退避策略

demo-preview=./components/retry-logic/exponential-backoff.vue

:::

**关键要点：**
- 使用 `backoffFactor` 参数启用指数退避
- 延迟序列：delay × 1, delay × 2, delay × 4, delay × 8...
- 适合服务器负载较高的场景，避免过度请求
- 可视化展示重试时间线和延迟对比

## 抖动策略

演示抖动（Jitter）策略，在延迟基础上添加随机偏移，避免多个客户端同时重试。

:::preview 抖动策略演示

demo-preview=./components/retry-logic/jitter-demo.vue

:::

**关键要点：**
- 使用 `jitter` 参数添加随机抖动（0-1 之间）
- 例如：jitter=0.3 表示实际延迟为计算值的 70%~130%
- 避免多个客户端同时重试，减轻服务器压力
- 结合指数退避使用效果更佳

## 自定义重试条件

演示如何使用 `shouldRetry` 函数自定义重试判断逻辑，精确控制哪些错误需要重试。

:::preview 自定义重试条件

demo-preview=./components/retry-logic/custom-retry.vue

:::

**关键要点：**
- 使用 `shouldRetry` 函数自定义重试逻辑
- 可以根据错误类型、状态码、重试次数等条件判断
- 提供多种预设策略：智能重试、积极重试、保守重试、仅网络错误
- 避免无意义的重试（如 4xx 客户端错误）

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
        return error?.message?.includes('network')
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
          // 根据错误类型和重试次数决定是否继续
          switch (error?.status) {
            case 429: // Too Many Requests
              return true // 总是重试
            case 503: // Service Unavailable
              return attempt < 3 // 仅在前 3 次重试
            case 500: // Internal Server Error
              return attempt < 2 // 仅在前 2 次重试
            default:
              // 网络错误总是重试
              return error?.message?.includes('network')
          }
        },
      }
    )
  }
}
```

### 4. 避免无意义的重试

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
          // 不重试的情况
          const noRetryStatuses = [
            400, // Bad Request - 请求参数错误
            401, // Unauthorized - 未授权
            403, // Forbidden - 禁止访问
            404, // Not Found - 资源不存在
            422, // Unprocessable Entity - 验证失败
          ]

          if (error?.status && noRetryStatuses.includes(error.status)) {
            return false
          }

          // 重试网络错误和 5xx 错误
          return (
            error?.message?.includes('network') ||
            (error?.status >= 500 && error?.status < 600)
          )
        },
      }
    )
  }
}
```

## 重试策略对比

| 策略 | 适用场景 | 重试次数 | 延迟模式 | 优点 | 缺点 |
|------|----------|----------|----------|------|------|
| **固定延迟** | 简单场景 | 3 | 固定 1s | 简单易懂 | 可能加重服务器负担 |
| **指数退避** | 服务器负载高 | 4-5 | 1s→2s→4s→8s | 减轻服务器压力 | 总等待时间较长 |
| **指数退避+抖动** | 高并发场景 | 4-5 | 指数+随机偏移 | 避免请求集中 | 实现稍复杂 |
| **自定义条件** | 复杂业务场景 | 可变 | 可定制 | 精确控制 | 需要深入理解错误类型 |

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

## 注意事项

1. **幂等性考虑**：对于非幂等的写操作（如创建资源），谨慎使用重试，避免重复创建
2. **重试次数**：不要设置过多的重试次数，避免长时间阻塞用户操作
3. **延迟设置**：合理设置延迟时间，平衡用户体验和服务器压力
4. **错误类型**：仅重试可恢复的错误（网络错误、5xx 错误），不要重试 4xx 客户端错误
5. **监控日志**：记录重试信息，帮助诊断问题和优化策略
6. **用户体验**：对于用户发起的操作，考虑显示重试状态和进度

## 相关文档

- [重试请求 API](../api/retry-logic.md) - 完整的重试 API 文档
- [基础请求示例](./basic-requests.md) - 基础请求方法
- [幂等请求示例](./idempotent-requests.md) - 防止重复提交