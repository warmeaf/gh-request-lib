# 幂等请求

## 基本概念

幂等请求功能通过智能的请求去重机制，确保在指定时间窗口内，相同的请求只会被执行一次，其他重复请求将复用第一次请求的结果。

### 核心特性

- **请求去重**：在指定的时间窗口（TTL）内，完全相同的请求只执行一次，后续相同请求直接返回缓存结果
- **防止并发重复**：对于正在进行中的请求，后续相同的请求会等待第一个请求完成并共享其结果
- **灵活的键生成策略**：支持自定义幂等键生成逻辑，可根据 URL、method、data、headers 等参数灵活组合
- **智能缓存管理**：基于 TTL 的缓存过期机制，自动清理过期缓存
- **容错与降级**：提供完善的错误处理和降级策略，确保在异常情况下系统仍能正常运行

### 工作原理

幂等功能通过两层去重机制确保请求不重复：

1. **缓存层去重**：检查是否已有缓存的响应结果。如果缓存存在且未过期，直接返回缓存数据
2. **Pending 层去重**：检查是否有正在进行中的相同请求。如果存在，等待该请求完成并共享其结果

### 幂等键生成

幂等键用于唯一标识一个请求。相同的请求必须生成相同的幂等键。

**默认键生成策略**：

```
idempotent:hash(method + url + data + selected_headers)
```

**键生成流程**：

1. 如果提供了自定义 `key`，直接使用
2. 否则，基于请求配置（method、url、params、data、headers）生成哈希键
3. 添加 `idempotent:` 前缀

如果键生成过程中抛出异常，会自动使用降级键策略，确保功能可用。

## 适用场景

幂等请求功能适用于以下场景：

- **表单重复提交防护**：用户快速点击提交按钮，或网络延迟导致多次提交时，防止重复提交
- **订单创建防重**：电商场景下防止重复创建订单，避免产生重复订单
- **支付请求防重**：防止重复发起支付请求，避免重复扣款
- **数据更新/删除操作**：防止重复执行更新或删除操作，确保数据一致性
- **关键业务操作**：任何需要确保只执行一次的关键业务操作

### 不适用场景

- **数据查询**：对于 GET 请求，通常使用缓存功能更合适
- **需要每次都执行的操作**：如埋点、日志记录等需要每次都执行的请求
- **预期结果会变化的请求**：如果相同请求在不同时间点应该返回不同结果，不适合使用幂等

## API

### IdempotentFeature

幂等请求功能的核心类。

#### 构造函数

```typescript
constructor(requestor: Requestor, config?: Partial<CacheKeyConfig>)
```

**参数**：

- `requestor`: 请求执行器实例
- `config`: 可选的缓存键生成配置（实例级别，影响所有请求的键生成）

### requestIdempotent

使用幂等保护执行请求的通用方法。

#### 类型签名

```typescript
async requestIdempotent<T>(
  config: RequestConfig,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### 参数

**config: RequestConfig**

标准的请求配置对象，包含 url、method、data 等字段。

**idempotentConfig: IdempotentConfig**（可选）

```typescript
interface IdempotentConfig {
  // 幂等保护时间窗口（毫秒），默认 30000ms (30秒)
  ttl?: number

  // 自定义幂等键，不指定则自动生成
  key?: string

  // 参与键生成的 header 字段白名单
  includeHeaders?: string[]

  // 是否包含所有 headers，默认 false
  includeAllHeaders?: boolean

  // 哈希算法：'fnv1a' | 'xxhash' | 'simple'，默认 'fnv1a'
  hashAlgorithm?: 'fnv1a' | 'xxhash' | 'simple'

  // 检测到重复请求时的回调
  onDuplicate?: (
    originalRequest: RequestConfig,
    duplicateRequest: RequestConfig
  ) => void
}
```

#### 示例

```typescript
import { IdempotentFeature } from '@request-core'

const idempotentFeature = new IdempotentFeature(requestor)

// 基本使用 - 使用默认配置（30秒 TTL）
const result = await idempotentFeature.requestIdempotent({
  url: '/api/order',
  method: 'POST',
  data: { productId: 123, quantity: 1 },
})

// 自定义 TTL - 60秒内相同请求返回缓存结果
const result = await idempotentFeature.requestIdempotent(
  { url: '/api/submit', method: 'POST', data: { form: 'data' } },
  { ttl: 60000 }
)

// 自定义幂等键 - 基于业务逻辑生成键
const result = await idempotentFeature.requestIdempotent(
  { url: '/api/payment', method: 'POST', data: { orderId: '12345' } },
  { key: 'payment:order:12345' }
)

// 包含特定 headers 参与键生成
const result = await idempotentFeature.requestIdempotent(
  {
    url: '/api/user/profile',
    method: 'GET',
    headers: { Authorization: 'Bearer token', 'X-Request-Id': 'req-123' },
  },
  { includeHeaders: ['Authorization', 'X-Request-Id'] }
)

// 监听重复请求
const result = await idempotentFeature.requestIdempotent(
  { url: '/api/action', method: 'POST' },
  {
    onDuplicate: (original, duplicate) => {
      console.log('Duplicate request detected:', { original, duplicate })
    },
  }
)
```

### getIdempotent

GET 请求的幂等便捷方法。

#### 类型签名

```typescript
async getIdempotent<T>(
  url: string,
  config?: Partial<RequestConfig>,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### 示例

```typescript
const result = await idempotentFeature.getIdempotent(
  '/api/users/123',
  {},
  { ttl: 30000 }
)
```

### postIdempotent

POST 请求的幂等便捷方法。

#### 类型签名

```typescript
async postIdempotent<T>(
  url: string,
  data?: RequestData,
  config?: Partial<RequestConfig>,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### 示例

```typescript
const result = await idempotentFeature.postIdempotent(
  '/api/submit',
  { name: 'John', email: 'john@example.com' },
  {},
  { ttl: 60000 }
)
```

### putIdempotent

PUT 请求的幂等便捷方法。

#### 类型签名

```typescript
async putIdempotent<T>(
  url: string,
  data?: RequestData,
  config?: Partial<RequestConfig>,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### 示例

```typescript
const result = await idempotentFeature.putIdempotent(
  '/api/users/123',
  { name: 'John', email: 'john@example.com' },
  {},
  { ttl: 60000 }
)
```

### patchIdempotent

PATCH 请求的幂等便捷方法。

#### 类型签名

```typescript
async patchIdempotent<T>(
  url: string,
  data?: RequestData,
  config?: Partial<RequestConfig>,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### 示例

```typescript
const result = await idempotentFeature.patchIdempotent(
  '/api/users/123',
  { name: 'John' },
  {},
  { ttl: 60000 }
)
```

### deleteIdempotent

DELETE 请求的幂等便捷方法。

#### 类型签名

```typescript
async deleteIdempotent<T>(
  url: string,
  config?: Partial<RequestConfig>,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### 示例

```typescript
const result = await idempotentFeature.deleteIdempotent(
  '/api/users/123',
  {},
  { ttl: 60000 }
)
```

### clearIdempotentCache

清除幂等缓存和待处理的请求。

#### 类型签名

```typescript
async clearIdempotentCache(key?: string): Promise<void>
```

#### 参数

- `key`（可选）: 要清除的缓存键。如果不提供，则清除所有缓存。如果提供的 key 不以 `idempotent:` 开头，会自动添加前缀。

#### 示例

```typescript
// 清除特定幂等缓存
await idempotentFeature.clearIdempotentCache('payment:order:12345')

// 清除所有幂等缓存
await idempotentFeature.clearIdempotentCache()
```

**注意**：`clearIdempotentCache()` 方法会同时清理缓存和 `pendingRequests` Map 中的条目。

### destroy

销毁幂等功能实例，清理所有资源。

#### 类型签名

```typescript
async destroy(): Promise<void>
```

#### 示例

```typescript
await idempotentFeature.destroy()
```

**注意**：调用 `destroy()` 会清理所有缓存和待处理的请求，实例销毁后不应再使用。
