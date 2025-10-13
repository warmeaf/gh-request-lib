# 缓存请求API

本文档介绍如何在 API 客户端中使用缓存功能，避免重复请求，提升应用性能。

## 核心概念

缓存功能允许你缓存请求的响应数据，在缓存有效期内再次请求相同的资源时，直接返回缓存数据，避免发起实际的网络请求。

### 主要特性

- **多种存储方式**：支持内存、LocalStorage、IndexedDB、WebSQL
- **自动过期管理**：基于 TTL（生存时间）自动清理过期缓存
- **LRU 淘汰策略**：当缓存达到上限时，自动淘汰最少使用的项
- **并发控制**：相同请求的并发自动合并，避免重复请求
- **灵活的键生成**：支持自定义缓存键和多种键生成策略

## 在 API 类中使用缓存

### 基础用法

```typescript
import { type RequestCore } from 'request-api'

class UserApi {
  constructor(public requestCore: RequestCore) {}

  // 使用缓存的 GET 请求
  async getUser(id: string) {
    return this.requestCore.getWithCache(`/users/${id}`, {
      ttl: 60000, // 缓存 60 秒
    })
  }

  // 使用通用缓存方法
  async getUserProfile(id: string) {
    return this.requestCore.requestWithCache(
      {
        url: `/users/${id}/profile`,
        method: 'GET',
      },
      {
        ttl: 5 * 60 * 1000, // 缓存 5 分钟
      }
    )
  }
}
```

### 自定义缓存键

为不同的请求场景指定唯一的缓存键：

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUserWithParams(id: string, includeProfile: boolean) {
    return this.requestCore.requestWithCache(
      {
        url: `/users/${id}`,
        method: 'GET',
        params: { include: includeProfile ? 'profile' : '' },
      },
      {
        ttl: 60000,
        // 自定义缓存键，区分不同参数的请求
        key: `user-${id}-${includeProfile ? 'with-profile' : 'basic'}`,
      }
    )
  }
}
```

### 选择存储类型

根据数据特点选择合适的存储方式：

```typescript
import { StorageType } from 'request-core'

class DataApi {
  constructor(public requestCore: RequestCore) {}

  // 使用内存存储（默认）- 适合临时数据
  async getTempData() {
    return this.requestCore.requestWithCache(
      { url: '/data/temp', method: 'GET' },
      {
        ttl: 30000,
        storageType: StorageType.MEMORY,
      }
    )
  }

  // 使用 IndexedDB - 适合大量数据或需要持久化的场景
  async getLargeData() {
    return this.requestCore.requestWithCache(
      { url: '/data/large', method: 'GET' },
      {
        ttl: 10 * 60 * 1000,
        storageType: StorageType.INDEXED_DB,
      }
    )
  }

  // 使用 LocalStorage - 适合小量数据且需要跨会话保存
  async getSettings() {
    return this.requestCore.requestWithCache(
      { url: '/settings', method: 'GET' },
      {
        ttl: 24 * 60 * 60 * 1000, // 缓存 24 小时
        storageType: StorageType.LOCAL_STORAGE,
      }
    )
  }
}
```

### 数据克隆策略

控制缓存数据的克隆方式，平衡性能和数据安全性：

```typescript
class ProductApi {
  constructor(public requestCore: RequestCore) {}

  // 深度克隆（默认）- 最安全，但性能开销大
  async getProduct(id: string) {
    return this.requestCore.requestWithCache(
      { url: `/products/${id}`, method: 'GET' },
      {
        ttl: 60000,
        clone: 'deep', // 每次返回完全独立的副本
      }
    )
  }

  // 浅克隆 - 性能较好，适合简单对象
  async getProductList() {
    return this.requestCore.requestWithCache(
      { url: '/products', method: 'GET' },
      {
        ttl: 60000,
        clone: 'shallow', // 只克隆第一层
      }
    )
  }

  // 不克隆 - 性能最好，但要注意不要修改返回的数据
  async getCategories() {
    return this.requestCore.requestWithCache(
      { url: '/categories', method: 'GET' },
      {
        ttl: 5 * 60 * 1000,
        clone: 'none', // 直接返回缓存的引用
      }
    )
  }
}
```

### 控制缓存大小

限制缓存条目数量，避免内存溢出：

```typescript
class NewsApi {
  constructor(public requestCore: RequestCore) {}

  async getNews(page: number) {
    return this.requestCore.requestWithCache(
      {
        url: '/news',
        method: 'GET',
        params: { page },
      },
      {
        ttl: 2 * 60 * 1000,
        maxEntries: 50, // 最多缓存 50 条新闻请求
      }
    )
  }
}
```

## API 参考

### requestWithCache

使用缓存执行请求的通用方法。

#### 类型签名

```typescript
async requestWithCache<T>(
  config: RequestConfig,
  cacheConfig?: CacheConfig
): Promise<T>
```

#### 参数

**config: RequestConfig**

标准的请求配置对象，包含 url、method 等字段。

**cacheConfig: CacheConfig**（可选）

```typescript
interface CacheConfig {
  // 缓存生存时间（毫秒），默认 5 分钟
  ttl?: number

  // 自定义缓存键
  key?: string

  // 数据克隆策略：'deep'（深克隆）、'shallow'（浅克隆）、'none'（不克隆）
  // 默认：'none'
  clone?: 'deep' | 'shallow' | 'none'

  // 最大缓存条目数，默认 1000
  maxEntries?: number

  // 存储类型
  storageType?: StorageType

  // 自定义存储适配器
  storageAdapter?: StorageAdapter

  // 自定义缓存键生成策略
  keyStrategy?: CacheKeyStrategy

  // 自定义键生成器配置
  keyGenerator?: CacheKeyConfig

  // 自定义失效策略
  invalidationPolicy?: CacheInvalidationPolicy
}
```

#### 示例

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.requestWithCache<User>(
      {
        url: `/users/${id}`,
        method: 'GET',
      },
      {
        ttl: 60000,
        key: `user-${id}`,
        clone: 'deep',
      }
    )
  }
}
```

### getWithCache

缓存 GET 请求的便捷方法。

#### 类型签名

```typescript
async getWithCache<T>(url: string, cacheConfig?: CacheConfig): Promise<T>
```

#### 参数

- **url**: 请求地址
- **cacheConfig**: 缓存配置（可选）

#### 示例

```typescript
class ProductApi {
  constructor(public requestCore: RequestCore) {}

  async getProduct(id: string) {
    return this.requestCore.getWithCache<Product>(`/products/${id}`, {
      ttl: 5 * 60 * 1000,
    })
  }
}
```

### clearCache

清除缓存数据。

#### 类型签名

```typescript
clearCache(key?: string): void
```

#### 参数

- **key**（可选）: 要清除的缓存键。如果不提供，则清除所有缓存。

#### 示例

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async updateUser(id: string, data: any) {
    const result = await this.requestCore.put(`/users/${id}`, data)
    
    // 更新后清除该用户的缓存
    this.requestCore.clearCache(`user-${id}`)
    
    return result
  }

  async logout() {
    // 登出时清除所有缓存
    this.requestCore.clearCache()
  }
}
```

### getCacheStats

获取缓存统计信息。

#### 类型签名

```typescript
getCacheStats(): Promise<CacheStats>
```

#### 返回值

```typescript
interface CacheStats {
  size: number                    // 当前缓存条目数
  maxEntries: number             // 最大缓存条目数
  hitRate?: number               // 缓存命中率
  keyGeneratorStats: object      // 键生成器统计
  lastCleanup: number           // 上次清理时间戳
  cleanupInterval: number       // 清理间隔
  storageType: StorageType      // 存储类型
}
```

## StorageType 枚举

```typescript
enum StorageType {
  MEMORY = 'memory',              // 内存存储（默认）
  LOCAL_STORAGE = 'localStorage', // LocalStorage
  INDEXED_DB = 'indexedDB',       // IndexedDB
  WEB_SQL = 'webSQL',            // WebSQL（已废弃）
}
```

## 完整示例

### 基础场景

```typescript
import { createApiClient, type RequestCore } from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

// 定义用户 API
class UserApi {
  constructor(public requestCore: RequestCore) {}

  // 获取用户信息（带缓存）
  async getUser(id: string) {
    return this.requestCore.getWithCache(`/users/${id}`, {
      ttl: 60000, // 缓存 1 分钟
    })
  }

  // 获取用户列表（带缓存和自定义键）
  async listUsers(page: number = 1) {
    return this.requestCore.requestWithCache(
      {
        url: '/users',
        method: 'GET',
        params: { page, limit: 20 },
      },
      {
        ttl: 30000,
        key: `users-page-${page}`,
      }
    )
  }

  // 更新用户（清除缓存）
  async updateUser(id: string, data: any) {
    const result = await this.requestCore.put(`/users/${id}`, data)
    // 更新后清除缓存
    this.requestCore.clearCache(`/users/${id}`)
    return result
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
  // 第一次请求 - 从服务器获取
  const user1 = await apiClient.user.getUser('123')
  
  // 第二次请求 - 从缓存获取（1 分钟内）
  const user2 = await apiClient.user.getUser('123')
  
  // 更新用户
  await apiClient.user.updateUser('123', { name: 'New Name' })
  
  // 更新后的请求 - 重新从服务器获取（缓存已清除）
  const user3 = await apiClient.user.getUser('123')
}
```

### 高级场景 - 多存储类型

```typescript
import { StorageType } from 'request-core'

class DataApi {
  constructor(public requestCore: RequestCore) {}

  // 短期数据 - 使用内存缓存
  async getRealtimeData() {
    return this.requestCore.requestWithCache(
      { url: '/data/realtime', method: 'GET' },
      {
        ttl: 5000, // 5 秒
        storageType: StorageType.MEMORY,
      }
    )
  }

  // 用户设置 - 使用 LocalStorage 持久化
  async getUserSettings() {
    return this.requestCore.requestWithCache(
      { url: '/settings', method: 'GET' },
      {
        ttl: 24 * 60 * 60 * 1000, // 24 小时
        storageType: StorageType.LOCAL_STORAGE,
        key: 'user-settings',
      }
    )
  }

  // 大量数据 - 使用 IndexedDB
  async getLargeDataset() {
    return this.requestCore.requestWithCache(
      { url: '/data/large', method: 'GET' },
      {
        ttl: 60 * 60 * 1000, // 1 小时
        storageType: StorageType.INDEXED_DB,
        maxEntries: 100,
      }
    )
  }
}

const apiClient = createApiClient(
  { data: DataApi },
  {
    requestor: createAxiosRequestor(),
  }
)
```

### 缓存管理场景

```typescript
class ArticleApi {
  constructor(public requestCore: RequestCore) {}

  // 获取文章（带缓存）
  async getArticle(id: string) {
    return this.requestCore.getWithCache(`/articles/${id}`, {
      ttl: 5 * 60 * 1000,
      key: `article-${id}`,
    })
  }

  // 更新文章（清除单个缓存）
  async updateArticle(id: string, data: any) {
    const result = await this.requestCore.put(`/articles/${id}`, data)
    this.requestCore.clearCache(`article-${id}`)
    return result
  }

  // 删除文章（清除单个缓存）
  async deleteArticle(id: string) {
    await this.requestCore.delete(`/articles/${id}`)
    this.requestCore.clearCache(`article-${id}`)
  }

  // 批量操作后清除所有缓存
  async batchUpdate(updates: any[]) {
    const results = await Promise.all(
      updates.map(update => this.requestCore.put(`/articles/${update.id}`, update.data))
    )
    // 清除所有缓存
    this.requestCore.clearCache()
    return results
  }
}
```

## 最佳实践

### 1. 合理设置 TTL

根据数据的更新频率设置合适的缓存时间：

```typescript
class BestPracticeApi {
  constructor(public requestCore: RequestCore) {}

  // 静态数据 - 长时间缓存
  async getConfig() {
    return this.requestCore.getWithCache('/config', {
      ttl: 24 * 60 * 60 * 1000, // 24 小时
    })
  }

  // 用户资料 - 中等时间缓存
  async getUserProfile(id: string) {
    return this.requestCore.getWithCache(`/users/${id}/profile`, {
      ttl: 5 * 60 * 1000, // 5 分钟
    })
  }

  // 实时数据 - 短时间缓存
  async getLiveData() {
    return this.requestCore.getWithCache('/live-data', {
      ttl: 10000, // 10 秒
    })
  }
}
```

### 2. 使用自定义键区分不同场景

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string, includeDeleted: boolean = false) {
    return this.requestCore.requestWithCache(
      {
        url: `/users/${id}`,
        method: 'GET',
        params: { includeDeleted },
      },
      {
        ttl: 60000,
        // 区分不同参数的请求
        key: `user-${id}-${includeDeleted ? 'all' : 'active'}`,
      }
    )
  }
}
```

### 3. 数据更新时及时清除缓存

```typescript
class ProductApi {
  constructor(public requestCore: RequestCore) {}

  async getProduct(id: string) {
    return this.requestCore.getWithCache(`/products/${id}`, {
      ttl: 5 * 60 * 1000,
      key: `product-${id}`,
    })
  }

  async updateProduct(id: string, data: any) {
    const result = await this.requestCore.put(`/products/${id}`, data)
    // 更新后立即清除缓存
    this.requestCore.clearCache(`product-${id}`)
    return result
  }

  async deleteProduct(id: string) {
    await this.requestCore.delete(`/products/${id}`)
    // 删除后清除缓存
    this.requestCore.clearCache(`product-${id}`)
  }
}
```

### 4. 选择合适的存储类型

```typescript
import { StorageType } from 'request-core'

class OptimizedApi {
  constructor(public requestCore: RequestCore) {}

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
}
```

### 5. 控制克隆策略优化性能

```typescript
class PerformanceApi {
  constructor(public requestCore: RequestCore) {}

  // 只读数据 - 不克隆（最快）
  async getReadOnlyData() {
    return this.requestCore.requestWithCache(
      { url: '/readonly-data', method: 'GET' },
      {
        ttl: 60000,
        clone: 'none', // 性能最优，但不要修改返回的数据
      }
    )
  }

  // 简单对象 - 浅克隆
  async getSimpleData() {
    return this.requestCore.requestWithCache(
      { url: '/simple-data', method: 'GET' },
      {
        ttl: 60000,
        clone: 'shallow', // 性能较好
      }
    )
  }

  // 复杂嵌套对象 - 深克隆
  async getComplexData() {
    return this.requestCore.requestWithCache(
      { url: '/complex-data', method: 'GET' },
      {
        ttl: 60000,
        clone: 'deep', // 最安全
      }
    )
  }
}
```

## 注意事项

1. **缓存键的唯一性**：确保不同的请求使用不同的缓存键
2. **TTL 设置**：根据数据更新频率合理设置 TTL，避免过长或过短
3. **存储限制**：LocalStorage 有大小限制（通常 5-10MB），IndexedDB 限制较大
4. **数据一致性**：更新数据后记得清除相关缓存
5. **克隆性能**：深克隆会影响性能，仅在必要时使用
6. **浏览器兼容性**：IndexedDB 和 WebSQL 在不同浏览器的支持程度不同

## 相关文档

- [基础请求 API](./basic-requests.md) - 了解基础请求方法
- [幂等请求 API](./idempotent-requests.md) - 防止重复提交的幂等保护
- [并发请求 API](./concurrent-requests.md) - 批量请求管理
