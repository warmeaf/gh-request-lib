# 幂等请求API

本文档介绍如何在 API 客户端中使用幂等请求功能，防止重复提交，确保相同请求在短时间内只执行一次。

## 核心概念

幂等请求功能通过请求去重机制，防止在短时间内重复提交相同的请求。这对于防止表单重复提交、避免重复操作等场景非常有用。

### 主要特性

- **请求去重**：相同的请求在 TTL 时间内只执行一次
- **缓存复用**：已执行的请求结果会被缓存，重复请求直接返回缓存
- **并发控制**：正在执行的请求会被等待，而不是重复执行
- **灵活的键生成**：支持自定义幂等键和多种生成策略
- **详细统计**：提供请求去重的详细统计信息

## 在 API 类中使用幂等请求

### 基础用法

```typescript
import { type RequestCore } from 'request-api'

class OrderApi {
  constructor(public requestCore: RequestCore) {}

  // 创建订单 - 防止重复提交
  async createOrder(orderData: any) {
    return this.requestCore.postIdempotent('/orders', orderData, undefined, {
      ttl: 30000, // 30 秒内相同请求只执行一次
    })
  }

  // 支付订单 - 防止重复支付
  async payOrder(orderId: string, paymentData: any) {
    return this.requestCore.requestIdempotent(
      {
        url: `/orders/${orderId}/pay`,
        method: 'POST',
        data: paymentData,
      },
      {
        ttl: 60000, // 1 分钟保护期
      }
    )
  }
}
```

### 自定义幂等键

为不同的请求指定唯一的幂等键：

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  // 更新用户信息 - 使用用户 ID 作为幂等键
  async updateUser(userId: string, userData: any) {
    return this.requestCore.putIdempotent(
      `/users/${userId}`,
      userData,
      undefined,
      {
        ttl: 10000,
        key: `update-user-${userId}`, // 自定义幂等键
      }
    )
  }

  // 上传头像 - 每个用户的上传操作独立
  async uploadAvatar(userId: string, file: File) {
    return this.requestCore.requestIdempotent(
      {
        url: `/users/${userId}/avatar`,
        method: 'POST',
        data: file,
      },
      {
        ttl: 30000,
        key: `upload-avatar-${userId}`,
      }
    )
  }
}
```

### 包含请求头的幂等判断

某些场景下需要考虑特定请求头来判断请求是否相同：

```typescript
class ApiClient {
  constructor(public requestCore: RequestCore) {}

  // 考虑 Authorization 头的请求
  async getUserData() {
    return this.requestCore.getIdempotent(
      '/user/me',
      undefined,
      {
        ttl: 60000,
        // 将 Authorization 头纳入幂等键生成
        includeHeaders: ['authorization'],
      }
    )
  }

  // 包含所有请求头
  async sensitiveOperation(data: any) {
    return this.requestCore.postIdempotent('/sensitive', data, undefined, {
      ttl: 30000,
      includeAllHeaders: true, // 包含所有请求头
    })
  }
}
```

### 重复请求回调

监听重复请求的发生：

```typescript
class MonitoredApi {
  constructor(public requestCore: RequestCore) {}

  async createPost(postData: any) {
    return this.requestCore.postIdempotent('/posts', postData, undefined, {
      ttl: 30000,
      onDuplicate: (original, duplicate) => {
        // 记录重复请求
        console.warn('检测到重复请求:', {
          url: duplicate.url,
          method: duplicate.method,
          timestamp: Date.now(),
        })

        // 发送到监控系统
        this.reportDuplicate(duplicate)
      },
    })
  }

  private reportDuplicate(config: any) {
    // 发送到监控系统的逻辑
  }
}
```

### 不同 Hash 算法

选择不同的哈希算法来生成幂等键：

```typescript
class OptimizedApi {
  constructor(public requestCore: RequestCore) {}

  // 使用 FNV1a 算法（默认，速度快）
  async quickOperation(data: any) {
    return this.requestCore.postIdempotent('/quick', data, undefined, {
      ttl: 10000,
      hashAlgorithm: 'fnv1a',
    })
  }

  // 使用 XXHash 算法（速度最快）
  async highFrequencyOperation(data: any) {
    return this.requestCore.postIdempotent('/frequent', data, undefined, {
      ttl: 5000,
      hashAlgorithm: 'xxhash',
    })
  }

  // 使用简单算法（最快，但可能冲突）
  async simpleOperation(data: any) {
    return this.requestCore.postIdempotent('/simple', data, undefined, {
      ttl: 10000,
      hashAlgorithm: 'simple',
    })
  }
}
```

### GET 请求幂等

虽然 GET 请求本身应该是幂等的，但可以用于防止短时间内重复请求：

```typescript
class DataApi {
  constructor(public requestCore: RequestCore) {}

  // 防止频繁刷新
  async getExpensiveData() {
    return this.requestCore.getIdempotent('/expensive-data', undefined, {
      ttl: 5000, // 5 秒内不重复请求
    })
  }

  // 带参数的查询
  async searchProducts(keyword: string) {
    return this.requestCore.getIdempotent(
      '/products/search',
      {
        params: { keyword },
      },
      {
        ttl: 10000,
        key: `search-${keyword}`, // 每个关键词独立
      }
    )
  }
}
```

## API 参考

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
  // 幂等保护时间（毫秒），默认 30 秒
  ttl?: number

  // 自定义幂等键
  key?: string

  // 参与幂等判断的请求头白名单
  includeHeaders?: string[]

  // 是否包含所有请求头，默认 false
  includeAllHeaders?: boolean

  // Hash 算法：'fnv1a'（默认）、'xxhash'、'simple'
  hashAlgorithm?: 'fnv1a' | 'xxhash' | 'simple'

  // 重复请求回调
  onDuplicate?: (originalRequest: RequestConfig, duplicateRequest: RequestConfig) => void
}
```

#### 工作原理

1. **首次请求**：生成幂等键，执行请求，缓存结果
2. **缓存命中**：在 TTL 内相同请求，直接返回缓存结果
3. **并发请求**：如果前一个请求还在执行，后续请求会等待其完成
4. **过期后**：超过 TTL 时间，请求会重新执行

#### 示例

```typescript
class FormApi {
  constructor(public requestCore: RequestCore) {}

  async submitForm(formData: any) {
    return this.requestCore.requestIdempotent<FormResult>(
      {
        url: '/forms/submit',
        method: 'POST',
        data: formData,
      },
      {
        ttl: 30000,
        key: `form-${formData.formId}`,
        onDuplicate: (original, duplicate) => {
          console.warn('表单重复提交被阻止')
        },
      }
    )
  }
}
```

### HTTP 方法便捷函数

#### getIdempotent

```typescript
async getIdempotent<T>(
  url: string,
  config?: Partial<RequestConfig>,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### postIdempotent

```typescript
async postIdempotent<T>(
  url: string,
  data?: any,
  config?: Partial<RequestConfig>,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### putIdempotent

```typescript
async putIdempotent<T>(
  url: string,
  data?: any,
  config?: Partial<RequestConfig>,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### patchIdempotent

```typescript
async patchIdempotent<T>(
  url: string,
  data?: any,
  config?: Partial<RequestConfig>,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### deleteIdempotent

```typescript
async deleteIdempotent<T>(
  url: string,
  config?: Partial<RequestConfig>,
  idempotentConfig?: IdempotentConfig
): Promise<T>
```

#### 示例

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.getIdempotent<User>(`/users/${id}`, undefined, {
      ttl: 60000,
    })
  }

  async createUser(userData: any) {
    return this.requestCore.postIdempotent<User>('/users', userData, undefined, {
      ttl: 30000,
    })
  }

  async updateUser(id: string, userData: any) {
    return this.requestCore.putIdempotent<User>(`/users/${id}`, userData, undefined, {
      ttl: 10000,
    })
  }

  async deleteUser(id: string) {
    return this.requestCore.deleteIdempotent<void>(`/users/${id}`, undefined, {
      ttl: 30000,
    })
  }
}
```

### clearIdempotentCache

清除幂等缓存。

#### 类型签名

```typescript
async clearIdempotentCache(key?: string): Promise<void>
```

#### 参数

- **key**（可选）: 要清除的幂等键。如果不提供，则清除所有幂等缓存。

#### 示例

```typescript
class OrderApi {
  constructor(public requestCore: RequestCore) {}

  async createOrder(orderData: any) {
    return this.requestCore.postIdempotent('/orders', orderData, undefined, {
      ttl: 30000,
      key: `create-order-${orderData.userId}`,
    })
  }

  // 取消订单时清除幂等缓存
  async cancelOrder(orderId: string, userId: string) {
    await this.requestCore.delete(`/orders/${orderId}`)
    
    // 清除该用户创建订单的幂等缓存
    await this.requestCore.clearIdempotentCache(`create-order-${userId}`)
  }

  // 登出时清除所有幂等缓存
  async logout() {
    await this.requestCore.clearIdempotentCache()
  }
}
```

### getIdempotentStats

获取幂等请求的统计信息。

#### 类型签名

```typescript
getIdempotentStats(): IdempotentStats
```

#### 返回值

```typescript
interface IdempotentStats {
  // 总请求数
  totalRequests: number

  // 阻止的重复请求数
  duplicatesBlocked: number

  // 复用正在进行请求的次数
  pendingRequestsReused: number

  // 纯缓存命中次数
  cacheHits: number

  // 实际发起的网络请求数
  actualNetworkRequests: number

  // 重复率（百分比）
  duplicateRate: number

  // 平均响应时间（毫秒）
  avgResponseTime: number

  // 键生成平均时间（毫秒）
  keyGenerationTime: number
}
```

#### 示例

```typescript
const stats = apiClient.order.requestCore.getIdempotentStats()

console.log(`
  总请求: ${stats.totalRequests}
  阻止重复: ${stats.duplicatesBlocked}
  重复率: ${stats.duplicateRate.toFixed(2)}%
  实际网络请求: ${stats.actualNetworkRequests}
  平均响应时间: ${stats.avgResponseTime}ms
`)
```

## 完整示例

### 表单提交防重

```typescript
import { createApiClient, type RequestCore } from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

class FormApi {
  constructor(public requestCore: RequestCore) {}

  // 提交表单 - 防止重复提交
  async submitForm(formData: {
    formId: string
    userId: string
    fields: Record<string, any>
  }) {
    return this.requestCore.postIdempotent(
      '/forms/submit',
      formData,
      undefined,
      {
        ttl: 30000, // 30 秒保护期
        key: `form-${formData.formId}-${formData.userId}`,
        onDuplicate: (original, duplicate) => {
          // 显示提示信息
          console.warn('表单已提交，请勿重复提交')
          // 可以在这里显示 UI 提示
        },
      }
    )
  }

  // 提交后清除幂等缓存
  async deleteForm(formId: string, userId: string) {
    await this.requestCore.delete(`/forms/${formId}`)
    await this.requestCore.clearIdempotentCache(`form-${formId}-${userId}`)
  }
}

const apiClient = createApiClient(
  { form: FormApi },
  {
    requestor: createAxiosRequestor({
      baseURL: 'https://api.example.com',
    }),
  }
)

// 使用
async function handleFormSubmit(formData: any) {
  try {
    const result = await apiClient.form.submitForm(formData)
    console.log('表单提交成功:', result)
  } catch (error) {
    console.error('表单提交失败:', error)
  }
}
```

### 支付场景

```typescript
class PaymentApi {
  constructor(public requestCore: RequestCore) {}

  // 创建支付订单 - 严格防重
  async createPayment(paymentData: {
    orderId: string
    amount: number
    method: string
  }) {
    return this.requestCore.postIdempotent(
      '/payments',
      paymentData,
      undefined,
      {
        ttl: 60000, // 1 分钟保护期
        key: `payment-${paymentData.orderId}`,
        includeHeaders: ['authorization'], // 考虑用户身份
        onDuplicate: (original, duplicate) => {
          console.error('检测到重复支付请求，已阻止')
          // 发送警报
          this.alertDuplicatePayment(paymentData.orderId)
        },
      }
    )
  }

  // 确认支付
  async confirmPayment(paymentId: string, confirmData: any) {
    return this.requestCore.postIdempotent(
      `/payments/${paymentId}/confirm`,
      confirmData,
      undefined,
      {
        ttl: 30000,
        key: `confirm-payment-${paymentId}`,
      }
    )
  }

  private alertDuplicatePayment(orderId: string) {
    // 发送警报到监控系统
    console.error(`重复支付警报: 订单 ${orderId}`)
  }
}

const apiClient = createApiClient(
  { payment: PaymentApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 用户操作防重

```typescript
class UserActionApi {
  constructor(public requestCore: RequestCore) {}

  // 点赞 - 防止快速重复点击
  async likePost(postId: string, userId: string) {
    return this.requestCore.postIdempotent(
      `/posts/${postId}/like`,
      { userId },
      undefined,
      {
        ttl: 5000, // 5 秒保护期
        key: `like-${postId}-${userId}`,
        onDuplicate: () => {
          console.log('操作太快，请稍后再试')
        },
      }
    )
  }

  // 关注用户
  async followUser(targetUserId: string, currentUserId: string) {
    return this.requestCore.postIdempotent(
      `/users/${targetUserId}/follow`,
      { followerId: currentUserId },
      undefined,
      {
        ttl: 10000,
        key: `follow-${targetUserId}-${currentUserId}`,
      }
    )
  }

  // 发表评论
  async postComment(postId: string, commentData: any) {
    return this.requestCore.postIdempotent(
      `/posts/${postId}/comments`,
      commentData,
      undefined,
      {
        ttl: 15000,
        key: `comment-${postId}-${Date.now()}`, // 使用时间戳确保唯一性
      }
    )
  }
}

const apiClient = createApiClient(
  { userAction: UserActionApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 文件上传防重

```typescript
class UploadApi {
  constructor(public requestCore: RequestCore) {}

  // 上传文件 - 根据文件内容判断
  async uploadFile(file: File, userId: string) {
    // 计算文件哈希作为幂等键的一部分
    const fileHash = await this.calculateFileHash(file)

    return this.requestCore.requestIdempotent(
      {
        url: '/upload',
        method: 'POST',
        data: file,
        headers: {
          'Content-Type': file.type,
        },
      },
      {
        ttl: 60000,
        key: `upload-${userId}-${fileHash}`,
        onDuplicate: () => {
          console.log('相同文件已在上传中或已上传')
        },
      }
    )
  }

  private async calculateFileHash(file: File): Promise<string> {
    // 简单的文件标识：名称 + 大小 + 修改时间
    return `${file.name}-${file.size}-${file.lastModified}`
  }
}

const apiClient = createApiClient(
  { upload: UploadApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 统计和监控

```typescript
class MonitoredApi {
  constructor(public requestCore: RequestCore) {}

  async performOperation(data: any) {
    const result = await this.requestCore.postIdempotent(
      '/operation',
      data,
      undefined,
      {
        ttl: 30000,
        onDuplicate: (original, duplicate) => {
          // 记录重复请求
          this.logDuplicate(duplicate)
        },
      }
    )

    // 定期输出统计信息
    this.logStats()

    return result
  }

  private logDuplicate(config: any) {
    console.warn('重复请求被阻止:', {
      url: config.url,
      method: config.method,
      timestamp: Date.now(),
    })
  }

  private logStats() {
    const stats = this.requestCore.getIdempotentStats()

    // 定期输出（例如每 100 个请求）
    if (stats.totalRequests % 100 === 0) {
      console.log('幂等统计:', {
        total: stats.totalRequests,
        duplicates: stats.duplicatesBlocked,
        rate: `${stats.duplicateRate.toFixed(2)}%`,
        savings: `${stats.duplicatesBlocked} 个请求被节省`,
      })
    }
  }
}

const apiClient = createApiClient(
  { monitored: MonitoredApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

## 最佳实践

### 1. 根据操作重要性设置 TTL

```typescript
class BestPracticeApi {
  constructor(public requestCore: RequestCore) {}

  // 关键操作 - 较长的保护期
  async criticalOperation(data: any) {
    return this.requestCore.postIdempotent('/critical', data, undefined, {
      ttl: 60000, // 1 分钟
    })
  }

  // 普通操作 - 标准保护期
  async normalOperation(data: any) {
    return this.requestCore.postIdempotent('/normal', data, undefined, {
      ttl: 30000, // 30 秒
    })
  }

  // 频繁操作 - 较短的保护期
  async frequentOperation(data: any) {
    return this.requestCore.postIdempotent('/frequent', data, undefined, {
      ttl: 5000, // 5 秒
    })
  }
}
```

### 2. 使用自定义键确保唯一性

```typescript
class CustomKeyApi {
  constructor(public requestCore: RequestCore) {}

  // 为每个用户的操作使用独立的键
  async userOperation(userId: string, data: any) {
    return this.requestCore.postIdempotent('/operation', data, undefined, {
      ttl: 30000,
      key: `operation-${userId}-${data.actionId}`,
    })
  }

  // 基于业务ID的键
  async processOrder(orderId: string, data: any) {
    return this.requestCore.postIdempotent('/process', data, undefined, {
      ttl: 60000,
      key: `process-order-${orderId}`,
    })
  }
}
```

### 3. 监听重复请求用于用户提示

```typescript
class UserFriendlyApi {
  constructor(public requestCore: RequestCore) {}

  async submitData(data: any) {
    return this.requestCore.postIdempotent('/data', data, undefined, {
      ttl: 30000,
      onDuplicate: (original, duplicate) => {
        // 显示友好的用户提示
        this.showToast('请求已提交，请勿重复操作')
        
        // 禁用提交按钮一段时间
        this.disableSubmitButton(5000)
      },
    })
  }

  private showToast(message: string) {
    // 显示 toast 提示
    console.log(`[Toast] ${message}`)
  }

  private disableSubmitButton(duration: number) {
    // 禁用按钮的逻辑
    console.log(`按钮禁用 ${duration}ms`)
  }
}
```

### 4. 适时清除幂等缓存

```typescript
class CacheManagementApi {
  constructor(public requestCore: RequestCore) {}

  async createResource(data: any) {
    return this.requestCore.postIdempotent('/resources', data, undefined, {
      ttl: 30000,
      key: `create-resource-${data.id}`,
    })
  }

  // 删除资源时清除相关缓存
  async deleteResource(id: string) {
    await this.requestCore.delete(`/resources/${id}`)
    await this.requestCore.clearIdempotentCache(`create-resource-${id}`)
  }

  // 用户登出时清除所有幂等缓存
  async logout() {
    await this.requestCore.clearIdempotentCache()
    console.log('已清除所有幂等缓存')
  }
}
```

### 5. 选择合适的 Hash 算法

```typescript
class OptimizedHashApi {
  constructor(public requestCore: RequestCore) {}

  // 高频操作 - 使用最快的算法
  async highFrequency(data: any) {
    return this.requestCore.postIdempotent('/frequent', data, undefined, {
      ttl: 5000,
      hashAlgorithm: 'xxhash', // 最快
    })
  }

  // 普通操作 - 使用默认算法
  async normalOperation(data: any) {
    return this.requestCore.postIdempotent('/normal', data, undefined, {
      ttl: 30000,
      hashAlgorithm: 'fnv1a', // 默认，平衡
    })
  }

  // 简单操作 - 简单算法足够
  async simpleOperation(data: any) {
    return this.requestCore.postIdempotent('/simple', data, undefined, {
      ttl: 10000,
      hashAlgorithm: 'simple', // 最简单
    })
  }
}
```

## 注意事项

1. **TTL 设置**：根据业务场景合理设置 TTL，避免过长或过短
2. **自定义键**：使用自定义键时确保键的唯一性
3. **请求头考虑**：仅在必要时包含请求头，避免不必要的键差异
4. **清除缓存**：在资源删除或状态变更时及时清除相关缓存
5. **用户体验**：使用 onDuplicate 回调提供友好的用户提示
6. **性能影响**：幂等功能会增加少量性能开销（键生成和缓存查询）
7. **存储限制**：幂等缓存会占用内存或存储空间，注意清理

## 与缓存的区别

| 特性 | 幂等请求 | 缓存请求 |
|------|----------|----------|
| 目的 | 防止重复提交 | 减少网络请求 |
| 适用场景 | 写操作、敏感操作 | 读操作、静态数据 |
| TTL 一般长度 | 较短（秒到分钟） | 较长（分钟到小时） |
| 并发处理 | 等待第一个完成 | 共享缓存数据 |
| 清除时机 | 资源变更时 | 数据更新时 |

## Hash 算法对比

| 算法 | 速度 | 冲突率 | 适用场景 |
|------|------|--------|----------|
| simple | 最快 | 较高 | 简单场景、低频操作 |
| fnv1a | 快 | 低 | 大多数场景（默认） |
| xxhash | 非常快 | 很低 | 高频操作、性能敏感 |

## 相关文档

- [基础请求 API](./basic-requests.md) - 了解基础请求方法
- [缓存请求 API](./caching.md) - 缓存响应数据
- [并发请求 API](./concurrent-requests.md) - 批量请求管理