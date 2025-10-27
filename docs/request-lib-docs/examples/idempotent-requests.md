# 幂等请求示例

本文档演示了 request-api 库的幂等请求功能，防止重复提交，确保相同请求在短时间内只执行一次。所有示例都使用 [JSONPlaceholder](https://jsonplaceholder.typicode.com/) 作为测试 API。

## 基础幂等请求

演示如何使用幂等请求防止表单重复提交，在指定时间内相同请求只执行一次。

<ClientOnly>
:::preview 基础幂等请求

demo-preview=./components/idempotent-requests/basic-idempotent.vue

:::
</ClientOnly>

**关键要点：**

- 使用 `postIdempotent`、`putIdempotent` 等方法执行幂等请求
- 设置 `ttl` 参数指定幂等保护时间（毫秒）
- 在 TTL 时间内，相同请求会直接返回第一次的结果
- 正在执行的请求，后续相同请求会等待其完成
- 适合防止表单重复提交、重复点击等场景

## 自定义幂等键

演示如何使用自定义幂等键，为不同的请求场景指定唯一的幂等标识。

<ClientOnly>
:::preview 自定义幂等键

demo-preview=./components/idempotent-requests/custom-key.vue

:::
</ClientOnly>

**关键要点：**

- 使用 `key` 参数自定义幂等键
- 不同的幂等键之间互不影响
- 可以使用用户ID、资源ID等作为键的一部分
- 合理设计幂等键可以实现更精细的控制
- 支持为每个用户、每个资源创建独立的幂等保护

**幂等键设计模式：**

| 模式 | key 示例 | 适用场景 |
|------|---------|---------|
| **按用户隔离** | `action-${userId}` | 用户操作、个人资料更新 |
| **按资源隔离** | `update-${resourceId}` | 资源编辑、数据更新 |
| **按业务隔离** | `pay-${orderId}` | 订单支付、交易提交 |
| **组合键** | `like-${postId}-${userId}` | 点赞、收藏等交互 |

## 幂等统计与监控

演示如何监控幂等请求的执行情况，包括重复请求统计、回调处理等。

<ClientOnly>
:::preview 幂等统计与监控

demo-preview=./components/idempotent-requests/stats-monitoring.vue

:::
</ClientOnly>

**关键要点：**

- 使用 `onDuplicate` 回调监听重复请求
- 使用 `getIdempotentStats()` 获取统计信息
- 统计包括总请求数、阻止次数、重复率等
- 可以基于统计数据优化用户体验
- 适合监控和分析用户行为

**统计指标说明：**

| 指标 | 说明 | 应用场景 |
|------|------|---------|
| **totalRequests** | 总请求数 | 了解请求总量 |
| **duplicatesBlocked** | 阻止的重复请求数 | 评估防重效果 |
| **duplicateRate** | 重复率（百分比） | 分析用户重复提交行为 |
| **actualNetworkRequests** | 实际网络请求数 | 评估性能优化效果 |
| **avgResponseTime** | 平均响应时间 | 性能监控 |

## Hash 算法对比

演示不同 Hash 算法的特性和性能，帮助选择适合的算法。

<ClientOnly>
:::preview Hash 算法对比

demo-preview=./components/idempotent-requests/hash-comparison.vue

:::
</ClientOnly>

**关键要点：**

- 支持三种 Hash 算法：`simple`、`fnv1a`（默认）、`xxhash`
- `simple`：最快，但冲突率较高，适合简单场景
- `fnv1a`：平衡性能和冲突率，适合大多数场景（推荐）
- `xxhash`：速度快且冲突率低，适合高频操作
- 根据请求频率和数据复杂度选择合适的算法

**算法选择指南：**

| 场景 | 推荐算法 | 原因 |
|------|---------|------|
| **简单表单提交** | simple | 请求频率低，数据简单 |
| **一般业务操作** | fnv1a | 平衡性能和可靠性 |
| **高频交互操作** | xxhash | 性能优先，冲突率低 |
| **复杂数据请求** | fnv1a/xxhash | 避免哈希冲突 |

## 最佳实践

### 1. 根据操作重要性设置 TTL

```typescript
class BestPracticeApi {
  constructor(public requestCore: RequestCore) {}

  // ✅ 好：关键操作 - 较长的保护期
  async createPayment(data: any) {
    return this.requestCore.postIdempotent('/payments', data, undefined, {
      ttl: 60000, // 1 分钟
    })
  }

  // ✅ 好：普通操作 - 标准保护期
  async submitForm(data: any) {
    return this.requestCore.postIdempotent('/forms', data, undefined, {
      ttl: 30000, // 30 秒
    })
  }

  // ✅ 好：频繁操作 - 较短的保护期
  async likePost(postId: string) {
    return this.requestCore.postIdempotent(`/posts/${postId}/like`, {}, undefined, {
      ttl: 5000, // 5 秒
    })
  }

  // ❌ 不好：所有操作使用相同的 TTL
  async anyOperation(data: any) {
    return this.requestCore.postIdempotent('/api', data, undefined, {
      ttl: 30000, // 缺乏针对性
    })
  }
}
```

### 2. 使用自定义键确保唯一性

```typescript
class CustomKeyApi {
  constructor(public requestCore: RequestCore) {}

  // ✅ 好：每个用户的操作使用独立的键
  async updateProfile(userId: string, data: any) {
    return this.requestCore.putIdempotent(
      `/users/${userId}/profile`,
      data,
      undefined,
      {
        ttl: 30000,
        key: `update-profile-${userId}`, // 用户隔离
      }
    )
  }

  // ✅ 好：组合键实现精细控制
  async likePost(postId: string, userId: string) {
    return this.requestCore.postIdempotent(
      `/posts/${postId}/like`,
      { userId },
      undefined,
      {
        ttl: 10000,
        key: `like-${postId}-${userId}`, // 用户+资源组合
      }
    )
  }

  // ❌ 不好：不指定自定义键，可能导致不同用户的操作冲突
  async updateProfileBad(userId: string, data: any) {
    return this.requestCore.putIdempotent(
      `/users/${userId}/profile`,
      data,
      undefined,
      {
        ttl: 30000,
        // 没有自定义 key，使用默认的请求哈希
      }
    )
  }
}
```

### 3. 监听重复请求用于用户提示

```typescript
class UserFriendlyApi {
  constructor(public requestCore: RequestCore) {}

  async submitForm(formData: any) {
    return this.requestCore.postIdempotent('/forms', formData, undefined, {
      ttl: 30000,
      onDuplicate: (original, duplicate) => {
        // ✅ 显示友好的用户提示
        console.warn('请求已提交，请勿重复操作')
        this.showNotification('请求已提交，请勿重复操作')
        
        // ✅ 记录到监控系统
        this.reportDuplicate({
          url: duplicate.url,
          timestamp: Date.now(),
        })
      },
    })
  }

  private showNotification(message: string) {
    // 显示 toast 或其他提示
    console.log(`[Notification] ${message}`)
  }

  private reportDuplicate(info: any) {
    // 发送到监控系统
    console.log(`[Monitor] Duplicate request:`, info)
  }
}
```

### 4. 适时清除幂等缓存

```typescript
class CacheManagementApi {
  constructor(public requestCore: RequestCore) {}

  // 创建订单
  async createOrder(orderData: any) {
    return this.requestCore.postIdempotent('/orders', orderData, undefined, {
      ttl: 30000,
      key: `create-order-${orderData.userId}`,
    })
  }

  // ✅ 好：取消订单时清除相关缓存
  async cancelOrder(orderId: string, userId: string) {
    await this.requestCore.delete(`/orders/${orderId}`)
    // 清除该用户创建订单的幂等缓存
    await this.requestCore.clearIdempotentCache(`create-order-${userId}`)
  }

  // ✅ 好：用户登出时清除所有幂等缓存
  async logout() {
    await this.requestCore.clearIdempotentCache()
    console.log('Cleared all idempotent cache')
  }

  // ✅ 好：支付成功后清除支付相关的幂等缓存
  async confirmPayment(paymentId: string, orderId: string) {
    const result = await this.requestCore.post(`/payments/${paymentId}/confirm`, {})
    // 清除支付幂等缓存，允许后续操作
    await this.requestCore.clearIdempotentCache(`payment-${orderId}`)
    return result
  }
}
```

### 5. 选择合适的 Hash 算法

```typescript
class OptimizedHashApi {
  constructor(public requestCore: RequestCore) {}

  // ✅ 高频操作 - 使用最快的算法
  async likePost(postId: string) {
    return this.requestCore.postIdempotent(
      `/posts/${postId}/like`,
      {},
      undefined,
      {
        ttl: 5000,
        hashAlgorithm: 'xxhash', // 高性能
      }
    )
  }

  // ✅ 普通操作 - 使用默认算法
  async submitForm(data: any) {
    return this.requestCore.postIdempotent('/forms', data, undefined, {
      ttl: 30000,
      hashAlgorithm: 'fnv1a', // 默认，平衡
    })
  }

  // ✅ 简单操作 - 简单算法足够
  async quickAction(data: any) {
    return this.requestCore.postIdempotent('/quick', data, undefined, {
      ttl: 10000,
      hashAlgorithm: 'simple', // 简单场景
    })
  }
}
```

### 6. 综合示例：表单提交防重

```typescript
class FormApi {
  constructor(public requestCore: RequestCore) {}
  private submitCount = 0

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
        // 设置合理的保护期
        ttl: 30000, // 30 秒

        // 使用组合键确保唯一性
        key: `form-${formData.formId}-${formData.userId}`,

        // 使用默认算法（平衡性能和可靠性）
        hashAlgorithm: 'fnv1a',

        // 监听重复提交
        onDuplicate: (original, duplicate) => {
          this.submitCount++
          console.warn(`表单重复提交被阻止 (${this.submitCount} 次)`)
          
          // 显示用户提示
          this.notifyUser('表单已提交，请勿重复提交')
          
          // 记录到监控系统
          this.reportToMonitoring('duplicate_form_submit', {
            formId: formData.formId,
            userId: formData.userId,
            count: this.submitCount,
            timestamp: Date.now(),
          })
        },
      }
    )
  }

  // 重置统计
  resetStats() {
    this.submitCount = 0
  }

  private notifyUser(message: string) {
    // 实际项目中使用 toast 或 message 组件
    console.log(`[User Notification] ${message}`)
  }

  private reportToMonitoring(event: string, data: any) {
    // 上报到监控系统
    console.log(`[Monitoring] Event: ${event}`, data)
  }
}
```

### 7. 支付场景最佳实践

```typescript
class PaymentApi {
  constructor(public requestCore: RequestCore) {}

  // 创建支付 - 严格防重
  async createPayment(paymentData: {
    orderId: string
    amount: number
    userId: string
  }) {
    return this.requestCore.postIdempotent(
      '/payments',
      paymentData,
      undefined,
      {
        // ✅ 较长的保护期
        ttl: 60000, // 1 分钟

        // ✅ 基于订单的幂等键
        key: `payment-${paymentData.orderId}`,

        // ✅ 考虑用户身份
        includeHeaders: ['authorization'],

        // ✅ 使用可靠的算法
        hashAlgorithm: 'fnv1a',

        // ✅ 严格监控重复支付
        onDuplicate: (original, duplicate) => {
          console.error('检测到重复支付请求，已阻止')
          
          // 发送警报
          this.alertDuplicatePayment(paymentData.orderId, paymentData.userId)
          
          // 记录到安全日志
          this.logSecurityEvent('duplicate_payment_blocked', paymentData)
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

  private alertDuplicatePayment(orderId: string, userId: string) {
    // 发送警报到监控系统或通知管理员
    console.error(`[ALERT] Duplicate payment attempt: Order ${orderId}, User ${userId}`)
  }

  private logSecurityEvent(event: string, data: any) {
    // 记录到安全日志
    console.warn(`[Security] ${event}:`, data)
  }
}
```

## 性能对比

| 算法 | 键生成时间 | 冲突率 | 内存占用 | 适用场景 |
|------|-----------|--------|---------|---------|
| simple | ~0.01ms | 中等 | 低 | 简单场景、低频操作 |
| fnv1a | ~0.05ms | 低 | 中等 | 大多数场景（推荐） |
| xxhash | ~0.03ms | 很低 | 中等 | 高频操作、性能敏感 |

**结论：**
- 默认使用 `fnv1a` 算法，适合大多数场景
- 高频操作优先选择 `xxhash` 算法
- 简单场景可以使用 `simple` 算法
- 冲突率影响幂等效果，性能敏感场景需要权衡

## 适用场景

### 适合使用幂等请求的场景

✅ **表单提交**：防止用户重复点击提交按钮  
✅ **支付操作**：防止重复支付，确保资金安全  
✅ **订单创建**：避免生成重复订单  
✅ **用户操作**：点赞、收藏、关注等防止快速重复点击  
✅ **数据更新**：防止短时间内多次更新相同数据  
✅ **文件上传**：避免重复上传相同文件  

### 不适合使用幂等请求的场景

❌ **查询操作**：GET 请求应使用缓存功能而非幂等  
❌ **需要立即响应的操作**：幂等会增加轻微延迟  
❌ **长时间间隔的操作**：超过 TTL 后不再保护  
❌ **需要每次都执行的操作**：如发送不同内容的消息  

## 与其他功能的对比

| 功能 | 幂等请求 | 缓存请求 | 串行请求 |
|------|---------|---------|---------|
| **主要目的** | 防止重复提交 | 减少网络请求 | 保证执行顺序 |
| **适用方法** | 所有 HTTP 方法 | 主要用于 GET | 所有 HTTP 方法 |
| **执行方式** | 去重执行 | 缓存复用 | 队列执行 |
| **TTL 长度** | 较短（秒到分钟） | 较长（分钟到小时） | 无 TTL 概念 |
| **并发处理** | 等待第一个完成 | 直接返回缓存 | 按顺序执行 |
| **典型用例** | 表单提交、支付 | 数据查询 | 状态变更 |

## 注意事项

1. **TTL 设置**：根据业务场景合理设置 TTL，避免过长或过短
2. **自定义键**：使用自定义键时确保键的唯一性和可读性
3. **请求头考虑**：仅在必要时包含请求头，避免不必要的键差异
4. **清除缓存**：在资源删除或状态变更时及时清除相关缓存
5. **用户体验**：使用 onDuplicate 回调提供友好的用户提示
6. **性能影响**：幂等功能会增加少量性能开销（键生成和缓存查询）
7. **存储限制**：幂等缓存会占用内存，注意定期清理
8. **算法选择**：根据请求频率和数据复杂度选择合适的 Hash 算法

## 常见问题

### 1. 幂等请求和防抖/节流的区别？

```typescript
// ❌ 防抖：只执行最后一次
function debounce(fn: Function, delay: number) {
  let timer: any
  return (...args: any[]) => {
    clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

// ❌ 节流：固定间隔执行
function throttle(fn: Function, delay: number) {
  let last = 0
  return (...args: any[]) => {
    const now = Date.now()
    if (now - last >= delay) {
      fn(...args)
      last = now
    }
  }
}

// ✅ 幂等：执行第一次，后续去重
async function idempotent(data: any) {
  return requestCore.postIdempotent('/api', data, undefined, {
    ttl: 5000,
  })
}
```

**区别：**
- **防抖**：延迟执行，最终只执行最后一次
- **节流**：定期执行，忽略中间的调用
- **幂等**：立即执行第一次，在 TTL 内去重后续相同请求

### 2. 如何判断请求被去重了？

```typescript
// 使用 onDuplicate 回调
await requestCore.postIdempotent('/api', data, undefined, {
  ttl: 30000,
  onDuplicate: (original, duplicate) => {
    console.log('检测到重复请求')
    // 显示提示
    showToast('请求已提交，请勿重复操作')
  },
})

// 或者查看统计信息
const stats = requestCore.getIdempotentStats()
console.log('重复请求数:', stats.duplicatesBlocked)
console.log('重复率:', stats.duplicateRate)
```

### 3. 幂等缓存什么时候清除？

幂等缓存会在以下情况清除：

1. **TTL 过期**：超过设置的 TTL 时间后自动清除
2. **手动清除**：调用 `clearIdempotentCache()` 方法
3. **应用重启**：内存缓存会丢失（如果使用持久化存储则保留）

```typescript
// 手动清除特定键
await requestCore.clearIdempotentCache('form-123')

// 清除所有幂等缓存
await requestCore.clearIdempotentCache()
```

### 4. 幂等请求可以和重试功能结合使用吗？

可以，但需要注意它们的交互：

```typescript
// 外层包装重试逻辑
async function submitWithRetry(data: any, maxRetries: number = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      // 内层使用幂等保护
      return await requestCore.postIdempotent('/api', data, undefined, {
        ttl: 30000,
        key: `submit-${data.id}`,
      })
    } catch (error) {
      console.warn(`Attempt ${i + 1} failed:`, error)
      if (i === maxRetries - 1) throw error
      await delay(1000 * (i + 1))
    }
  }
}
```

**注意：** 幂等保护在重试过程中仍然生效，相同的请求在 TTL 内只会执行一次。

### 5. 如何处理不同参数的相同 URL？

默认情况下，URL、方法、数据都会参与幂等键的生成：

```typescript
// 这两个请求被视为不同的请求
await requestCore.postIdempotent('/api/search', { keyword: 'vue' }, undefined, { ttl: 10000 })
await requestCore.postIdempotent('/api/search', { keyword: 'react' }, undefined, { ttl: 10000 })

// 如果需要忽略参数差异，使用自定义键
await requestCore.postIdempotent('/api/search', { keyword: 'vue' }, undefined, {
  ttl: 10000,
  key: 'search-any', // 所有搜索共用一个幂等键
})
```

## 相关文档

- [幂等请求 API](../api/idempotent-requests.md) - 完整的幂等请求 API 文档
- [缓存请求示例](./caching.md) - 使用缓存减少网络请求
- [串行请求示例](./serial-requests.md) - 保证请求执行顺序
- [基础请求示例](./basic-requests.md) - 基础请求方法