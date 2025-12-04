# 重试逻辑

## 基本概念

重试逻辑功能在网络请求失败时自动进行重试，提高应用的健壮性和用户体验。该功能通过智能的错误识别和灵活的延迟策略，确保只在合适的场景下进行重试。

### 主要特性

- **智能错误识别**：自动识别可重试的错误类型（5xx 服务器错误、网络错误、超时错误等），避免对永久性错误进行无意义的重试
- **灵活的延迟策略**：支持固定延迟、指数退避和抖动机制，避免对服务器造成冲击
- **自定义重试条件**：支持通过 `shouldRetry` 函数自定义重试判断逻辑
- **详细的日志输出**：提供完整的重试过程日志，便于调试和监控
- **参数验证**：完善的参数校验，确保配置的合法性

### 默认重试策略

系统提供了开箱即用的默认重试策略，会自动识别以下可重试的错误：

- **5xx 服务器错误**：状态码在 500-599 之间的错误，表示服务器临时故障
- **非 HTTP 错误**：网络连接失败、超时等非 HTTP 协议层面的错误
- **网络相关错误**：错误消息包含 `network`、`timeout`、`connection`、`fetch` 等关键词的错误

对于 4xx 客户端错误（如 400、401、404 等），默认不会重试，因为这些错误通常是永久性的。

### 延迟策略

重试功能支持三种延迟策略：

1. **固定延迟**：每次重试前等待固定的时间
2. **指数退避**：延迟时间按指数增长，给服务器更多恢复时间
3. **抖动机制**：在延迟时间基础上增加随机抖动，避免多个客户端同时重试（惊群效应）

延迟计算公式：
- **基础延迟**：`delayBase = backoffFactor === 1 ? baseDelay : baseDelay * Math.pow(backoffFactor, attempt)`
- **抖动增量**：`jitterDelta = delayBase * (Math.random() * jitter)`（仅在 `jitter > 0` 时计算）
- **最终延迟**：`waitMs = Math.max(0, Math.floor(delayBase + jitterDelta))`

## 适用场景

重试逻辑功能适用于以下场景：

- **网络波动**：在网络不稳定的环境下，临时性的网络错误可以通过重试恢复
- **服务器临时故障**：服务器返回 5xx 错误时，通常表示临时故障，重试可能成功
- **超时错误**：请求超时时，可能是服务器负载过高或网络延迟，重试可能成功
- **连接错误**：网络连接失败时，重试可以重新建立连接
- **高可用性要求**：对于关键业务请求，通过重试提高成功率

### 不适用场景

- **幂等性要求**：对于非幂等的请求（如创建订单、支付等），需要先确保请求的幂等性，再使用重试
- **4xx 客户端错误**：如 400 Bad Request、401 Unauthorized、404 Not Found 等，这些错误通常是永久性的，重试无意义
- **业务逻辑错误**：由业务逻辑导致的错误，重试不会改变结果

## API

### RetryFeature

重试功能的核心类。

#### 构造函数

```typescript
constructor(requestor: Requestor)
```

**参数**：
- `requestor`: 实现了 `Requestor` 接口的请求器实例，用于执行实际的网络请求

### requestWithRetry

使用重试逻辑执行请求的通用方法。

#### 类型签名

```typescript
async requestWithRetry<T>(
  config: RequestConfig,
  retryConfig?: RetryConfig
): Promise<T>
```

#### 参数

**config: RequestConfig**

标准的请求配置对象，包含 url、method、data 等字段。

**retryConfig: RetryConfig**（可选）

```typescript
interface RetryConfig {
  // 重试次数（不包括首次请求），默认 3
  retries: number

  // 基础延迟时间（毫秒），默认 1000ms
  delay?: number

  // 退避因子，用于指数退避，默认 1（不退避）
  // 当 backoffFactor > 1 时，使用指数退避策略
  backoffFactor?: number

  // 抖动因子（0-1），默认 0（无抖动）
  // 在延迟时间基础上增加随机抖动，避免惊群效应
  jitter?: number

  // 自定义重试判断函数
  // 返回 true 表示应该重试，false 表示不应该重试
  shouldRetry?: (error: unknown, attempt: number) => boolean
}
```

#### 示例

```typescript
import { RetryFeature } from '@request-core'

const retryFeature = new RetryFeature(requestor)

// 基本使用 - 重试 3 次，使用默认延迟策略
const result = await retryFeature.requestWithRetry(
  {
    url: '/api/data',
    method: 'GET'
  },
  {
    retries: 3
  }
)

// 固定延迟 - 每次重试前等待 2 秒
const result = await retryFeature.requestWithRetry(
  {
    url: '/api/data',
    method: 'GET'
  },
  {
    retries: 3,
    delay: 2000
  }
)

// 指数退避 - 延迟时间按指数增长
// 第1次重试：1000ms，第2次：2000ms，第3次：4000ms
const result = await retryFeature.requestWithRetry(
  {
    url: '/api/data',
    method: 'GET'
  },
  {
    retries: 3,
    delay: 1000,
    backoffFactor: 2
  }
)

// 指数退避 + 抖动 - 推荐的生产环境配置
// 在指数退避基础上增加 0-10% 的随机抖动
const result = await retryFeature.requestWithRetry(
  {
    url: '/api/data',
    method: 'GET'
  },
  {
    retries: 3,
    delay: 1000,
    backoffFactor: 2,
    jitter: 0.1
  }
)

// 自定义重试条件 - 只对 503 状态码重试
const result = await retryFeature.requestWithRetry(
  {
    url: '/api/data',
    method: 'GET'
  },
  {
    retries: 3,
    shouldRetry: (error, attempt) => {
      if (error instanceof RequestError && error.status === 503) {
        return true
      }
      return false
    }
  }
)

// 自定义重试条件 - 只对特定错误类型重试
const result = await retryFeature.requestWithRetry(
  {
    url: '/api/data',
    method: 'GET'
  },
  {
    retries: 3,
    shouldRetry: (error, attempt) => {
      if (error instanceof RequestError) {
        // 仅对 502、503、504 重试
        return [502, 503, 504].includes(error.status || 0)
      }
      return false
    }
  }
)
```

#### 参数验证

如果配置参数不合法，会立即抛出 `RequestError`：

- `retries < 0`：抛出 `Retries must be non-negative`
- `delay < 0`：抛出 `Delay must be non-negative`
- `backoffFactor <= 0`：抛出 `Backoff factor must be positive`
- `jitter < 0 || jitter > 1`：抛出 `Jitter must be between 0 and 1`

#### 错误处理

- **最后一次尝试失败**：不会调用 `shouldRetry`，直接抛出最后一次请求的错误
- **`shouldRetry` 抛出异常**：停止重试，抛出原始请求错误（不是 `shouldRetry` 抛出的异常）
- **`shouldRetry` 返回 `false`**：停止重试，抛出原始请求错误
- **所有尝试都失败**：抛出最后一次请求的错误

#### 日志输出

重试功能会输出详细的日志信息：

- **尝试请求日志**（console.log）：每次尝试前输出尝试次数、URL、方法
- **重试警告日志**（console.warn）：重试前输出延迟时间、剩余重试次数、错误信息
- **最终失败日志**（console.error）：所有尝试都失败时输出总尝试次数、错误信息

