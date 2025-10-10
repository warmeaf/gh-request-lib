# 缓存请求示例

## 概念介绍

缓存请求是指将 HTTP 请求的响应结果保存在本地存储中，在指定的时间内（TTL）再次请求相同资源时直接返回缓存数据，避免重复的网络请求。支持多种存储方式（内存、LocalStorage、IndexedDB、WebSQL）、灵活的缓存键策略和失效策略。

## 使用场景

### 1. 静态数据缓存

适用于不常变化的数据，如配置信息、字典数据：

```typescript
// 缓存应用配置信息
const config = await requestCore.getWithCache('/api/config', {
  ttl: 24 * 60 * 60 * 1000, // 24小时
})
```

### 2. 列表数据缓存

提升列表页面的加载速度：

```typescript
// 缓存用户列表
const users = await requestCore.getWithCache('/api/users', {
  ttl: 5 * 60 * 1000, // 5分钟
  storageType: StorageType.INDEXED_DB,
})
```

### 3. 详情页面缓存

减少重复查询相同资源：

```typescript
// 缓存用户详情
const userDetail = await requestCore.requestWithCache(
  { url: `/api/users/${userId}`, method: 'GET' },
  {
    ttl: 10 * 60 * 1000, // 10分钟
    key: `user-detail-${userId}`, // 自定义缓存键
  }
)
```

### 4. 搜索结果缓存

缓存搜索结果避免重复搜索：

```typescript
// 缓存搜索结果
const results = await requestCore.requestWithCache(
  { url: '/api/search', method: 'GET', params: { q: searchTerm } },
  { ttl: 3 * 60 * 1000 } // 3分钟
)
```

## API 和配置参数说明

### 核心方法

#### `requestWithCache<T>(config, cacheConfig?): Promise<T>`

执行带缓存的通用请求方法。

**参数**：

- `config: RequestConfig` - 请求配置
- `cacheConfig?: CacheConfig` - 缓存配置

**示例**：

```typescript
const data = await requestCore.requestWithCache(
  {
    url: '/api/data',
    method: 'GET',
    params: { page: 1 },
  },
  {
    ttl: 5 * 60 * 1000, // 5分钟
    storageType: StorageType.INDEXED_DB,
    clone: 'deep',
  }
)
```

### 便利方法

#### `getWithCache<T>(url, cacheConfig?): Promise<T>`

缓存 GET 请求的便利方法。

```typescript
const users = await requestCore.getWithCache('/api/users', {
  ttl: 10 * 60 * 1000, // 10分钟
})
```

### 缓存管理方法

#### `clearCache(key?: string): void`

清除缓存数据（同步方法）。

```typescript
// 清除指定缓存
requestCore.clearCache('specific-cache-key')

// 清除所有缓存
requestCore.clearCache()
```

#### `getCacheStats(): Promise<CacheStats>`

获取缓存统计信息（异步方法）。

```typescript
const stats = await requestCore.getCacheStats()
console.log('Cache size:', stats.size)
console.log('Max entries:', stats.maxEntries)
console.log('Storage type:', stats.storageType)
```

### 配置参数详解

#### CacheConfig 缓存配置

```typescript
interface CacheConfig {
  ttl?: number // 缓存时间（毫秒），默认 5 * 60 * 1000 (5分钟)
  key?: string // 自定义缓存键，优先使用
  clone?: 'none' | 'shallow' | 'deep' // 数据克隆方式，默认 'none'
  maxEntries?: number // 最大缓存条目数，默认 1000
  keyGenerator?: CacheKeyConfig // 缓存键生成器配置
  storageType?: StorageType // 存储类型
  storageAdapter?: StorageAdapter // 自定义存储适配器
  keyStrategy?: CacheKeyStrategy // 缓存键生成策略
  invalidationPolicy?: CacheInvalidationPolicy // 缓存失效策略
}
```

#### StorageType 存储类型

```typescript
enum StorageType {
  MEMORY = 'memory', // 内存存储
  LOCAL_STORAGE = 'localStorage', // LocalStorage 存储
  INDEXED_DB = 'indexedDB', // IndexedDB 存储（默认，推荐用于大数据）
  WEB_SQL = 'webSQL', // WebSQL 存储（已废弃）
}
```

**选择指南**：

- `MEMORY`：适用于临时数据，刷新页面后失效
- `LOCAL_STORAGE`：适用于小量数据（< 5MB），需要持久化
- `INDEXED_DB`：适用于大量数据，支持复杂查询
- `WEB_SQL`：已废弃，不推荐使用

#### CacheKeyConfig 键生成器配置

```typescript
interface CacheKeyConfig {
  includeHeaders?: boolean // 是否包含请求头，默认 false
  headersWhitelist?: string[] // 请求头白名单，默认 ['content-type', 'authorization']
  maxKeyLength?: number // 最大键长度，默认 256
  enableHashCache?: boolean // 启用哈希缓存，默认 true
  hashAlgorithm?: 'fnv1a' | 'xxhash' | 'simple' // 哈希算法，默认 'fnv1a'
}
```

#### 缓存键策略

内置策略：

```typescript
// URL 路径策略（仅基于路径生成键）
import { UrlPathKeyStrategy } from 'request-core'
const keyStrategy = new UrlPathKeyStrategy()

// 完整 URL 策略（基于完整 URL 生成键）
import { FullUrlKeyStrategy } from 'request-core'
const keyStrategy = new FullUrlKeyStrategy()

// 参数化策略（基于 URL 和参数生成键）
import { ParameterizedKeyStrategy } from 'request-core'
const keyStrategy = new ParameterizedKeyStrategy()

// 自定义策略
import { CustomKeyStrategy } from 'request-core'
const keyStrategy = new CustomKeyStrategy((config) => {
  return `custom-${config.url}-${JSON.stringify(config.params)}`
})
```

#### 缓存失效策略

内置策略：

```typescript
// LRU 策略（最近最少使用）
import { LRUInvalidationPolicy } from 'request-core'
const invalidationPolicy = new LRUInvalidationPolicy()

// FIFO 策略（先进先出）
import { FIFOInvalidationPolicy } from 'request-core'
const invalidationPolicy = new FIFOInvalidationPolicy()

// 基于时间的策略（基于 TTL）
import { TimeBasedInvalidationPolicy } from 'request-core'
const invalidationPolicy = new TimeBasedInvalidationPolicy()

// 自定义策略
import { CustomInvalidationPolicy } from 'request-core'
const invalidationPolicy = new CustomInvalidationPolicy((item, now) => {
  return now - item.timestamp >= item.ttl
})
```

### 完整示例

```typescript
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import { StorageType, ParameterizedKeyStrategy } from 'request-core'

// 创建 API 客户端
const client = createApiClient(
  { user: UserApi },
  {
    requestor: fetchRequestor,
    globalConfig: { baseURL: 'https://api.example.com' },
  }
)

// 使用缓存请求
const users = await client.user.requestCore.getWithCache('/users', {
  ttl: 10 * 60 * 1000, // 10分钟
  storageType: StorageType.INDEXED_DB,
  clone: 'deep', // 深拷贝返回数据
  keyStrategy: new ParameterizedKeyStrategy(),
})

// 清除特定缓存
client.clearCache('user-list')

// 获取缓存统计
const stats = await client.getCacheStats()
console.log('Cache stats:', stats)
```

## 注意事项

### ⚠️ 性能优化

1. **选择合适的存储类型**

   ```typescript
   // ✅ 小数据用 MEMORY 或 LOCAL_STORAGE
   requestCore.getWithCache('/api/config', {
     ttl: 24 * 60 * 60 * 1000,
     storageType: StorageType.LOCAL_STORAGE,
   })

   // ✅ 大数据用 INDEXED_DB
   requestCore.getWithCache('/api/large-dataset', {
     ttl: 10 * 60 * 1000,
     storageType: StorageType.INDEXED_DB,
   })
   ```

2. **合理设置 TTL**

   ```typescript
   // ✅ 静态数据设置长 TTL
   const config = await requestCore.getWithCache('/api/config', {
     ttl: 24 * 60 * 60 * 1000, // 24小时
   })

   // ✅ 动态数据设置短 TTL
   const news = await requestCore.getWithCache('/api/news', {
     ttl: 2 * 60 * 1000, // 2分钟
   })
   ```

3. **控制缓存条目数量**
   ```typescript
   // 设置合理的最大缓存条目数
   const data = await requestCore.getWithCache('/api/data', {
     maxEntries: 500, // 根据实际情况调整
   })
   ```

### 🔒 数据安全

1. **敏感数据不要缓存**

   ```typescript
   // ❌ 不要缓存敏感数据
   const password = await requestCore.getWithCache('/api/user/password') // 危险！

   // ✅ 敏感数据使用普通请求
   const password = await requestCore.get('/api/user/password')
   ```

2. **使用内存存储处理敏感数据**
   ```typescript
   // ✅ 临时缓存用内存存储
   const token = await requestCore.getWithCache('/api/auth/token', {
     ttl: 5 * 60 * 1000,
     storageType: StorageType.MEMORY, // 刷新页面后自动清除
   })
   ```

### 🧹 缓存管理

1. **及时清理缓存**

   ```typescript
   // 在数据更新后清除相关缓存
   await client.user.requestCore.post('/api/users', userData)
   client.clearCache() // 清除所有用户相关缓存

   // 或清除特定缓存
   client.clearCache('user-list')
   ```

2. **监控缓存状态**

   ```typescript
   // 定期检查缓存状态
   setInterval(async () => {
     const stats = await client.getCacheStats()
     if (stats.size > stats.maxEntries * 0.9) {
       console.warn('Cache is nearly full:', stats)
     }
   }, 60000) // 每分钟检查一次
   ```

3. **应用关闭时清理**
   ```typescript
   window.addEventListener('beforeunload', () => {
     client.clearCache()
     client.destroy()
   })
   ```

### 📊 数据一致性

1. **避免数据克隆开销**

   ```typescript
   // ❌ 不需要修改数据时避免克隆
   const data = await requestCore.getWithCache('/api/data', {
     clone: 'deep', // 不必要的开销
   })

   // ✅ 只在需要修改数据时使用克隆
   const data = await requestCore.getWithCache('/api/data', {
     clone: 'none', // 默认值，性能最好
   })

   // 如需修改数据
   const mutableData = await requestCore.getWithCache('/api/data', {
     clone: 'deep', // 防止修改影响缓存
   })
   mutableData.name = 'New Name' // 安全修改
   ```

2. **并发请求去重**
   ```typescript
   // ✅ 缓存功能自动处理并发请求去重
   // 多个相同请求会自动复用第一个请求的结果
   const [data1, data2, data3] = await Promise.all([
     requestCore.getWithCache('/api/data'),
     requestCore.getWithCache('/api/data'),
     requestCore.getWithCache('/api/data'),
   ])
   // 只会发起一次网络请求
   ```

### 🏗️ 最佳实践

1. **为不同类型的数据设置不同的缓存策略**

   ```typescript
   // 静态配置：长期缓存 + LocalStorage
   const config = await requestCore.getWithCache('/api/config', {
     ttl: 24 * 60 * 60 * 1000,
     storageType: StorageType.LOCAL_STORAGE,
   })

   // 用户数据：中期缓存 + IndexedDB
   const userData = await requestCore.getWithCache('/api/user/profile', {
     ttl: 30 * 60 * 1000,
     storageType: StorageType.INDEXED_DB,
   })

   // 实时数据：短期缓存 + Memory
   const liveData = await requestCore.getWithCache('/api/live/data', {
     ttl: 30 * 1000,
     storageType: StorageType.MEMORY,
   })
   ```

2. **使用自定义缓存键避免冲突**

   ```typescript
   // ✅ 使用描述性的自定义键
   const data = await requestCore.getWithCache('/api/data', {
     key: `user-${userId}-data-${dataType}`,
   })

   // ❌ 避免依赖自动生成的键（可能冲突）
   ```

3. **优雅降级处理**
   ```typescript
   try {
     const data = await requestCore.getWithCache('/api/data', {
       storageType: StorageType.INDEXED_DB,
     })
   } catch (error) {
     // IndexedDB 不可用时自动降级到 Memory
     console.warn('Cache fallback to memory:', error)
   }
   ```

---

通过合理使用缓存功能，你可以显著提升应用的性能和用户体验，减少不必要的网络请求，同时降低服务器负载。
