# 缓存请求示例

本文档演示了 request-api 库的缓存功能，包括基础缓存使用、不同存储类型、缓存管理和 TTL（生存时间）控制。所有示例都使用 [JSONPlaceholder](https://jsonplaceholder.typicode.com/) 作为测试 API。

## 基础缓存

演示如何使用 `getWithCache` 方法实现请求缓存，避免重复请求，提升应用性能。

:::preview 基础缓存使用

demo-preview=./components/caching/basic-cache.vue

:::

**关键要点：**
- 使用 `getWithCache` 方法启用缓存
- 设置 `ttl` 参数指定缓存有效期（毫秒）
- 使用 `key` 参数自定义缓存键
- 在缓存有效期内，相同请求直接返回缓存数据
- 使用 `clearCache` 方法清除特定缓存

## 存储类型

演示不同的缓存存储类型：内存存储、LocalStorage 和 IndexedDB。

:::preview 不同存储类型

demo-preview=./components/caching/storage-types.vue

:::

**关键要点：**
- **内存存储**：页面刷新后数据丢失，适合临时数据
- **LocalStorage**：持久化存储，适合小量数据（5-10MB限制），跨会话保留
- **IndexedDB**：默认选项，持久化存储，适合大量数据，跨会话保留
- 通过 `storageType` 参数指定存储类型

## 缓存管理

演示缓存管理功能，包括清除特定缓存、清除所有缓存和查看缓存统计信息。

:::preview 缓存管理

demo-preview=./components/caching/cache-management.vue

:::

**关键要点：**
- `clearCache(key)` - 清除指定键的缓存
- `clearCache()` - 清除所有缓存
- `getCacheStats()` - 获取缓存统计信息（条目数、命中率等）
- 数据更新后应及时清除相关缓存，保证数据一致性

## TTL（生存时间）演示

演示 TTL（Time To Live）缓存过期机制，可视化缓存的生命周期。

:::preview TTL 演示

demo-preview=./components/caching/ttl-demo.vue

:::

**关键要点：**
- `ttl` 参数指定缓存有效期（毫秒）
- 缓存过期后，下次请求将重新从服务器获取数据
- 合理设置 TTL 可以平衡数据新鲜度和性能
- 不同类型的数据应设置不同的 TTL：
  - 静态数据：24小时或更长
  - 用户资料：5-10分钟
  - 实时数据：10-30秒

## 最佳实践

### 1. 合理设置缓存时间

根据数据的更新频率设置合适的 TTL：

```typescript
// 静态配置数据 - 长时间缓存
async getConfig() {
  return this.requestCore.getWithCache('/config', {
    ttl: 24 * 60 * 60 * 1000, // 24小时
  })
}

// 用户资料 - 中等时间缓存
async getUserProfile(id: string) {
  return this.requestCore.getWithCache(`/users/${id}/profile`, {
    ttl: 5 * 60 * 1000, // 5分钟
  })
}

// 实时数据 - 短时间缓存
async getLiveData() {
  return this.requestCore.getWithCache('/live-data', {
    ttl: 10000, // 10秒
  })
}
```

### 2. 使用自定义缓存键

为不同的请求场景指定唯一的缓存键：

```typescript
async getUser(id: string, includeProfile: boolean) {
  return this.requestCore.requestWithCache(
    {
      url: `/users/${id}`,
      method: 'GET',
      params: { includeProfile },
    },
    {
      ttl: 60000,
      // 区分不同参数的请求
      key: `user-${id}-${includeProfile ? 'with-profile' : 'basic'}`,
    }
  )
}
```

### 3. 数据更新时清除缓存

修改、删除数据后要及时清除相关缓存：

```typescript
async updateUser(id: string, data: any) {
  const result = await this.requestCore.put(`/users/${id}`, data)
  // 更新后清除该用户的缓存
  this.requestCore.clearCache(`user-${id}`)
  return result
}

async deleteUser(id: string) {
  await this.requestCore.delete(`/users/${id}`)
  // 删除后清除缓存
  this.requestCore.clearCache(`user-${id}`)
}
```

### 4. 选择合适的存储类型

根据数据特点选择合适的存储方式：

```typescript
import { StorageType } from 'request-core'

// 临时会话数据 - 使用内存
async getSessionData() {
  return this.requestCore.requestWithCache(
    { url: '/session', method: 'GET' },
    {
      ttl: 60000,
      storageType: StorageType.MEMORY,
    }
  )
}

// 需要跨页面刷新保存的数据 - 使用 LocalStorage
async getPreferences() {
  return this.requestCore.requestWithCache(
    { url: '/preferences', method: 'GET' },
    {
      ttl: 24 * 60 * 60 * 1000,
      storageType: StorageType.LOCAL_STORAGE,
    }
  )
}

// 大量数据 - 使用 IndexedDB
async getAnalyticsData() {
  return this.requestCore.requestWithCache(
    { url: '/analytics', method: 'GET' },
    {
      ttl: 60 * 60 * 1000,
      storageType: StorageType.INDEXED_DB,
      maxEntries: 200,
    }
  )
}
```

## 相关文档

- [缓存请求 API](../api/caching.md) - 完整的缓存 API 文档
- [基础请求示例](./basic-requests.md) - 基础请求方法
- [幂等请求示例](./idempotent-requests.md) - 防止重复提交