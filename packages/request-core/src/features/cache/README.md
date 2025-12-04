# 缓存请求技术方案

## 1. 引言

在现代 Web 应用中，网络请求是性能瓶颈的主要来源之一。为了减少不必要的网络请求、降低服务器负载并提升用户体验，缓存机制成为必不可少的优化手段。本方案旨在为 `request-core` 库设计并实现一个高性能、灵活且智能的请求缓存功能。

## 2. 设计目标

- **高性能**: 采用优化的缓存键生成算法（FNV-1a），支持哈希缓存避免重复计算。
- **灵活性**: 支持多种存储适配器（内存、LocalStorage、IndexedDB）和缓存策略。
- **智能管理**: 自动清理过期缓存，支持 LRU 等多种缓存淘汰策略。
- **并发控制**: 防止相同请求的重复发送，避免资源浪费。
- **数据安全**: 支持深拷贝、浅拷贝、不拷贝三种数据克隆模式，防止缓存数据被意外修改。
- **可观测性**: 提供详细的统计信息和日志输出，便于监控和调试。
- **易用性**: 提供合理的默认配置，同时允许用户高度自定义。

## 3. API 设计

通过 `CacheFeature` 类提供缓存功能，用户可以通过配置 `CacheConfig` 来自定义缓存行为。

### 3.1. 类型定义

```typescript
/**
 * 缓存预设配置类型
 */
type CachePreset = 
  | 'default'      // 默认配置：内存存储，5分钟TTL，不克隆
  | 'short'        // 短期缓存：内存存储，1分钟TTL，不克隆
  | 'medium'       // 中期缓存：LocalStorage，30分钟TTL，浅拷贝
  | 'long'         // 长期缓存：IndexedDB，24小时TTL，深拷贝
  | 'persistent'   // 持久化缓存：IndexedDB，7天TTL，深拷贝，最大5000条

/**
 * 缓存配置接口
 */
interface CacheConfig {
  ttl?: number                                    // 缓存存活时间（毫秒），默认 5 分钟
  key?: string                                    // 自定义缓存键
  clone?: 'none' | 'shallow' | 'deep'            // 数据克隆模式，默认 'none'
  maxEntries?: number                             // 最大缓存条目数，默认 1000
  keyGenerator?: CacheKeyConfig                   // 缓存键生成器配置
  storageType?: StorageType                       // 存储类型
  storageAdapter?: StorageAdapter                 // 自定义存储适配器
  keyStrategy?: CacheKeyStrategy                  // 缓存键生成策略
  invalidationPolicy?: CacheInvalidationPolicy    // 缓存失效策略
  preset?: CachePreset                            // 预设配置，会先应用预设，然后合并用户自定义配置
}

/**
 * 缓存键生成器配置
 */
interface CacheKeyConfig {
  includeHeaders?: boolean                        // 是否包含请求头，默认 false
  headersWhitelist?: string[]                     // 请求头白名单，默认 ['content-type', 'authorization']
  maxKeyLength?: number                           // 最大键长度，默认 256
  enableHashCache?: boolean                       // 是否启用哈希缓存，默认 true
  hashAlgorithm?: 'fnv1a' | 'xxhash' | 'simple'  // 哈希算法，默认 'fnv1a'
}

/**
 * 存储类型枚举
 */
enum StorageType {
  MEMORY = 'memory',              // 内存存储
  LOCAL_STORAGE = 'localStorage', // 浏览器 LocalStorage
  INDEXED_DB = 'indexedDB'       // IndexedDB
}
```

### 3.2. 构造函数

`CacheFeature` 构造函数接受以下参数：

```typescript
constructor(
  requestor: Requestor,                    // 请求器实例（必需）
  maxEntries?: number,                     // 最大缓存条目数，默认 1000
  keyGeneratorConfig?: CacheKeyConfig,     // 缓存键生成器配置，可选
  storageType?: StorageType                // 存储类型，默认 StorageType.MEMORY
)
```

**参数说明**：
- `requestor`: 实现了 `Requestor` 接口的请求器实例，用于执行实际的网络请求
- `maxEntries`: 缓存的最大条目数，默认值为 1000。当缓存条目数超过此值时，会触发 LRU 淘汰策略
- `keyGeneratorConfig`: 缓存键生成器的配置选项，用于自定义键生成行为
- `storageType`: 存储类型，默认为 `StorageType.MEMORY`。如果指定的存储类型不可用（如 LocalStorage 或 IndexedDB 在非浏览器环境），会自动降级到内存存储

**使用示例**：

```typescript
import { CacheFeature, StorageType } from '@request-core';

// 使用默认配置（内存存储，最大 1000 条）
const cache1 = new CacheFeature(requestor);

// 指定最大缓存条目数
const cache2 = new CacheFeature(requestor, 500);

// 自定义键生成器配置和存储类型
const cache3 = new CacheFeature(
  requestor,
  1000,
  {
    includeHeaders: true,
    headersWhitelist: ['authorization'],
    enableHashCache: true
  },
  StorageType.INDEXED_DB
);
```

### 3.3. 使用示例

```typescript
import { CacheFeature, StorageType } from '@request-core';

const cacheFeature = new CacheFeature(requestor);

// 基本使用：缓存 5 分钟
const response1 = await cacheFeature.requestWithCache({
  url: '/api/users',
  method: 'GET'
}, {
  ttl: 5 * 60 * 1000
});

// 使用 LocalStorage 存储
const response2 = await cacheFeature.requestWithCache({
  url: '/api/posts',
  method: 'GET'
}, {
  ttl: 10 * 60 * 1000,
  storageType: StorageType.LOCAL_STORAGE
});

// 深拷贝数据，防止缓存被修改
const response3 = await cacheFeature.requestWithCache({
  url: '/api/profile',
  method: 'GET'
}, {
  ttl: 60 * 1000,
  clone: 'deep'
});

// 自定义缓存键
const response4 = await cacheFeature.requestWithCache({
  url: '/api/search',
  method: 'GET',
  params: { q: 'keyword', page: 1 }
}, {
  ttl: 2 * 60 * 1000,
  key: 'search-keyword-page1'
});

// 限制最大缓存条目数
const response5 = await cacheFeature.requestWithCache({
  url: '/api/list',
  method: 'GET'
}, {
  ttl: 30 * 60 * 1000,
  maxEntries: 100
});

// 使用自定义键生成策略
import { UrlPathKeyStrategy } from '@request-core';
const response6 = await cacheFeature.requestWithCache({
  url: '/api/data',
  method: 'GET'
}, {
  ttl: 5 * 60 * 1000,
  keyStrategy: new UrlPathKeyStrategy()
});

// 使用预设配置：短期缓存（1分钟，内存存储）
const response7 = await cacheFeature.requestWithCache({
  url: '/api/temp-data',
  method: 'GET'
}, {
  preset: 'short'
});

// 使用预设配置：中期缓存（30分钟，LocalStorage）
const response8 = await cacheFeature.requestWithCache({
  url: '/api/user-profile',
  method: 'GET'
}, {
  preset: 'medium'
});

// 使用预设配置：长期缓存（24小时，IndexedDB）
const response9 = await cacheFeature.requestWithCache({
  url: '/api/config',
  method: 'GET'
}, {
  preset: 'long'
});

// 预设配置可以被用户自定义配置覆盖
const response10 = await cacheFeature.requestWithCache({
  url: '/api/data',
  method: 'GET'
}, {
  preset: 'medium',        // 先应用 medium 预设（30分钟，LocalStorage）
  ttl: 60 * 60 * 1000,     // 然后覆盖 TTL 为 1 小时
  clone: 'deep'            // 覆盖克隆模式为深拷贝
});

// 清除特定缓存
await cacheFeature.clearCache('search-keyword-page1');

// 清除所有缓存
await cacheFeature.clearCache();
```

### 3.4. API 方法详解

#### 3.4.1. 核心方法

**`requestWithCache<T>(config: RequestConfig, cacheConfig?: CacheConfig): Promise<T>`**

执行带缓存的请求。如果缓存命中则直接返回缓存数据，否则执行网络请求并缓存结果。

**`clearCache(key?: string): Promise<void>`**

清除缓存。如果提供 `key` 参数，则清除指定键的缓存；否则清除所有缓存。

**`destroy(): Promise<void>`**

销毁缓存实例，清理所有资源。应该在不再使用缓存实例时调用，以释放内存和存储资源。

```typescript
// 销毁缓存实例
await cacheFeature.destroy();
```

#### 3.4.2. 存储适配器管理

**`setStorageAdapter(adapter: StorageAdapter): void`**

设置自定义存储适配器。允许使用完全自定义的存储实现。

```typescript
import { CustomStorageAdapter } from './custom-adapter';

const customAdapter = new CustomStorageAdapter();
cacheFeature.setStorageAdapter(customAdapter);
```

**`getStorageType(): StorageType`**

获取当前使用的存储类型。

```typescript
const storageType = cacheFeature.getStorageType();
console.log('Current storage:', storageType); // 'memory' | 'localStorage' | 'indexedDB'
```

#### 3.4.3. 缓存键生成器管理

**`updateKeyGeneratorConfig(config: Partial<CacheKeyConfig>): void`**

更新缓存键生成器的配置。可以动态修改键生成行为。

```typescript
// 更新键生成器配置，包含请求头
cacheFeature.updateKeyGeneratorConfig({
  includeHeaders: true,
  headersWhitelist: ['authorization', 'x-custom-header']
});
```

**`clearKeyGeneratorCache(): void`**

清理键生成器的哈希缓存。当需要释放内存或重置缓存状态时使用。

```typescript
// 清理键生成器的哈希缓存
cacheFeature.clearKeyGeneratorCache();
```

**`warmupKeyGeneratorCache(configs: RequestConfig[]): void`**

预热键生成器缓存。预先计算并缓存常用请求配置的键，提升后续请求的性能。

```typescript
// 预热常用请求的键
cacheFeature.warmupKeyGeneratorCache([
  { url: '/api/users', method: 'GET' },
  { url: '/api/posts', method: 'GET', params: { page: 1 } }
]);
```

#### 3.4.4. 缓存策略管理

**`setKeyStrategy(strategy: CacheKeyStrategy): void`**

设置缓存键生成策略。允许使用自定义的键生成逻辑。

```typescript
import { UrlPathKeyStrategy } from '@request-core';

// 使用 URL 路径策略（忽略查询参数）
cacheFeature.setKeyStrategy(new UrlPathKeyStrategy());
```

**`setInvalidationPolicy(policy: CacheInvalidationPolicy): void`**

设置缓存失效策略。允许使用自定义的失效判断逻辑。

```typescript
import { FIFOInvalidationPolicy } from '@request-core';

// 使用 FIFO（先进先出）失效策略
cacheFeature.setInvalidationPolicy(new FIFOInvalidationPolicy());
```

#### 3.4.5. 缓存项操作

**`getCacheItem(key: string): Promise<any | null>`**

获取指定键的缓存项。返回完整的缓存项对象（包含元数据），如果不存在则返回 `null`。

```typescript
const item = await cacheFeature.getCacheItem('cache-key');
if (item) {
  console.log('Data:', item.data);
  console.log('TTL remaining:', item.ttl - (Date.now() - item.timestamp));
  console.log('Access count:', item.accessCount);
}
```

**`setCacheItem(item: StorageItem): Promise<void>`**

手动设置缓存项。允许直接操作缓存存储，用于高级场景。

```typescript
await cacheFeature.setCacheItem({
  key: 'custom-key',
  data: { custom: 'data' },
  timestamp: Date.now(),
  ttl: 60000,
  accessTime: Date.now(),
  accessCount: 0
});
```

**`removeCacheItem(key: string): Promise<void>`**

移除指定键的缓存项。与 `clearCache(key)` 功能相同，但提供更明确的语义。

```typescript
await cacheFeature.removeCacheItem('cache-key');
```

**`isCacheItemValid(item: any): boolean`**

检查缓存项是否有效（未过期）。用于手动验证缓存项的有效性。

```typescript
const item = await cacheFeature.getCacheItem('cache-key');
if (item && cacheFeature.isCacheItemValid(item)) {
  console.log('Cache item is valid');
} else {
  console.log('Cache item is expired or invalid');
}
```

## 4. 实现思路

### 4.1. 核心组件

1. **`CacheFeature` (缓存功能类)**:
   - 封装缓存逻辑的核心类。
   - 依赖 `Requestor` 接口来执行实际的请求。
   - 管理缓存的存取、清理和统计。

2. **`CacheKeyGenerator` (缓存键生成器)**:
   - 根据请求配置生成唯一的缓存键。
   - 使用 FNV-1a 哈希算法，性能优秀且冲突率低。
   - 支持分层哈希和哈希结果缓存。

3. **`StorageAdapter` (存储适配器接口)**:
   - 定义统一的存储接口。
   - 支持多种实现：Memory、LocalStorage、IndexedDB。

4. **`CacheInvalidationPolicy` (缓存失效策略)**:
   - 定义缓存何时应该被淘汰。
   - 支持 LRU、FIFO、基于时间等策略。

5. **`CacheKeyStrategy` (缓存键策略)**:
   - 定义如何从请求配置生成缓存键。
   - 支持 URL 路径、完整 URL、参数化等策略。

### 4.2. 缓存流程

```
┌─────────────────────┐
│  requestWithCache() │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  生成缓存键         │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│  查询缓存           │
└──────────┬──────────┘
           │
           ├─── 缓存命中 ───┐
           │                 │
           ├─── 缓存未命中   │
           │                 │
           ▼                 ▼
┌─────────────────────┐  ┌─────────────────────┐
│  并发控制检查       │  │  更新访问时间       │
└──────────┬──────────┘  └──────────┬──────────┘
           │                         │
           ├─有等待中的请求          │
           │                         │
           ├─无等待中的请求          │
           │                         │
           ▼                         │
┌─────────────────────┐            │
│  执行网络请求       │            │
└──────────┬──────────┘            │
           │                         │
           ▼                         │
┌─────────────────────┐            │
│  存储到缓存         │            │
└──────────┬──────────┘            │
           │                         │
           ▼                         │
┌─────────────────────┐            │
│  增量清理检查       │            │
└──────────┬──────────┘            │
           │                         │
           └─────────┬───────────────┘
                     │
                     ▼
           ┌─────────────────────┐
           │  克隆数据并返回     │
           └─────────────────────┘
```

### 4.3. 关键实现细节

#### 4.3.1. 并发控制

为了防止相同请求的重复发送，使用 `pendingRequests` Map 来跟踪正在进行的请求：

```typescript
private pendingRequests: Map<string, Promise<unknown>> = new Map()

// 在 requestWithCache 中
const existingRequest = this.pendingRequests.get(cacheKey)
if (existingRequest) {
  // 返回已有的 Promise，避免重复请求
  return (await existingRequest) as T
}

// 创建并缓存请求 Promise
const requestPromise = this.executeRequestAndCache<T>(config, cacheKey, ttl, clone)
this.pendingRequests.set(cacheKey, requestPromise)

try {
  const result = await requestPromise
  return result
} finally {
  // 清理 pending request
  this.pendingRequests.delete(cacheKey)
}
```

#### 4.3.2. 增量清理机制

采用增量清理策略，避免一次性清理大量数据导致性能问题：

```typescript
private async incrementalCleanupIfNeeded(): Promise<void> {
  const now = Date.now()
  const keys = await this.storageAdapter.getKeys()
  
  // 对于小的 maxEntries，更积极地清理
  const isSmallMaxEntries = this.maxEntries <= 10
  const shouldBypassTimeCheck = isSmallMaxEntries && keys.length >= this.maxEntries
  
  // 时间间隔检查（5分钟）和容量检查（90%）
  if (!shouldBypassTimeCheck && 
      now - this.lastCleanupTime < this.cleanupInterval && 
      keys.length < this.maxEntries * 0.9) {
    return
  }
  
  this.lastCleanupTime = now
  
  // 随机采样检查过期项（最多 100 个）
  const maxCheckCount = Math.min(100, keys.length)
  const startIndex = Math.floor(Math.random() * Math.max(1, keys.length - maxCheckCount))
  
  const expiredKeys: string[] = []
  for (let i = startIndex; i < Math.min(startIndex + maxCheckCount, keys.length); i++) {
    const key = keys[i]
    const item = await this.storageAdapter.getItem(key)
    if (item && now - item.timestamp >= item.ttl) {
      expiredKeys.push(key)
    }
  }
  
  // 删除过期项
  if (expiredKeys.length > 0) {
    for (const key of expiredKeys) {
      await this.storageAdapter.removeItem(key)
    }
  }
  
  // LRU 淘汰策略
  const currentKeys = await this.storageAdapter.getKeys()
  if (currentKeys.length > this.maxEntries) {
    const items = []
    for (const key of currentKeys) {
      const item = await this.storageAdapter.getItem(key)
      if (item) items.push(item)
    }
    
    // 按访问时间排序
    items.sort((a, b) => a.accessTime - b.accessTime)
    
    // 淘汰最少使用的项（最多 50 个）
    const toEvict = Math.min(50, currentKeys.length - this.maxEntries)
    for (let i = 0; i < toEvict; i++) {
      await this.storageAdapter.removeItem(items[i].key)
    }
  }
}
```

#### 4.3.3. 数据克隆策略

支持三种克隆模式，平衡性能和数据安全：

```typescript
private safeCloneData<T>(data: T, clone: 'deep' | 'shallow' | 'none'): T {
  if (clone === 'none') return data
  
  if (clone === 'shallow') {
    return this.shallowClone(data)
  }
  
  return this.deepClone(data)
}

private shallowClone<T>(data: T): T {
  if (data === null || typeof data !== 'object') {
    return data
  }
  if (Array.isArray(data)) {
    return [...data] as unknown as T
  }
  if (data instanceof Date) {
    return new Date(data.getTime()) as unknown as T
  }
  if (data instanceof RegExp) {
    return new RegExp(data.source, data.flags) as unknown as T
  }
  return { ...(data as Record<string, unknown>) } as unknown as T
}

private deepClone<T>(data: T): T {
  // 优先使用 structuredClone（现代浏览器支持）
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(data)
    } catch (error) {
      console.warn('[Cache] structuredClone failed, falling back to JSON clone:', error)
    }
  }
  
  // 降级到 JSON 克隆
  try {
    return JSON.parse(JSON.stringify(data))
  } catch (error) {
    console.warn('[Cache] JSON clone failed, returning original data:', error)
    return data
  }
}
```

## 5. 核心算法

### 5.1. FNV-1a 哈希算法

FNV-1a（Fowler-Noll-Vo）是一种非加密哈希函数，具有以下特点：

- **高性能**: 计算速度快，适合频繁计算。
- **低冲突率**: 对于缓存键生成场景，冲突率足够低。
- **简单实现**: 算法简单，易于理解和维护。

```typescript
function fnv1aHash(str: string): number {
  let hash = 2166136261 // FNV offset basis
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i)
    hash = Math.imul(hash, 16777619) // FNV prime
  }
  return hash >>> 0 // Convert to unsigned 32-bit integer
}
```

### 5.2. LRU 缓存淘汰算法

LRU（Least Recently Used）算法根据数据的访问时间来淘汰最少使用的数据：

1. 每次访问缓存项时，更新其 `accessTime` 和 `accessCount`。
2. 当缓存容量超过限制时，按 `accessTime` 排序。
3. 淘汰 `accessTime` 最早的项。

```typescript
// 更新访问时间
this.invalidationPolicy.updateItemOnAccess(item, now)

// 淘汰逻辑
items.sort((a, b) => a.accessTime - b.accessTime)
const toEvict = Math.min(50, currentKeys.length - this.maxEntries)
for (let i = 0; i < toEvict; i++) {
  await this.storageAdapter.removeItem(items[i].key)
}
```

### 5.3. 缓存键生成优化

#### 分层哈希

避免对整个请求配置对象进行序列化，而是分层处理：

```typescript
generateCacheKey(config: RequestConfig, customKey?: string): string {
  if (customKey) return customKey
  
  // 基础部分：method + url
  let key = `${config.method || 'GET'}:${config.url}`
  
  // 参数部分
  if (config.params) {
    key += ':' + this.hashObject(config.params)
  }
  
  // 请求体部分
  if (config.data) {
    key += ':' + this.hashObject(config.data)
  }
  
  // 请求头部分（可选）
  if (this.includeHeaders && config.headers) {
    const filteredHeaders = this.filterHeaders(config.headers)
    key += ':' + this.hashObject(filteredHeaders)
  }
  
  return key
}
```

#### 哈希缓存

对于复杂对象，缓存其哈希值，避免重复计算：

```typescript
private hashCache = new Map<string, string>()

private hashObject(obj: any): string {
  const signature = this.getObjectSignature(obj)
  
  // 检查缓存
  if (this.enableHashCache && this.hashCache.has(signature)) {
    return this.hashCache.get(signature)!
  }
  
  // 计算哈希
  const hash = this.computeHash(obj)
  
  // 缓存结果
  if (this.enableHashCache) {
    this.hashCache.set(signature, hash)
  }
  
  return hash
}
```

## 6. 存储适配器详解

### 6.1. MemoryStorageAdapter（内存存储）

**优点**：
- 速度最快
- 无需考虑序列化
- 适合临时缓存

**缺点**：
- 页面刷新后丢失
- 内存限制

**使用场景**：
- 短期缓存
- 开发测试
- 不需要持久化的数据

### 6.2. LocalStorageAdapter（本地存储）

**优点**：
- 持久化存储
- API 简单
- 浏览器兼容性好

**缺点**：
- 容量限制（5-10MB）
- 同步操作，可能阻塞主线程
- 需要序列化

**使用场景**：
- 小量数据的持久化缓存
- 用户偏好设置
- 简单的缓存需求

### 6.3. IndexedDBAdapter（IndexedDB）

**优点**：
- 大容量存储（通常 50MB+）
- 异步操作，不阻塞主线程
- 支持索引和事务

**缺点**：
- API 较复杂
- 兼容性略差（但现代浏览器都支持）

**使用场景**：
- 大量数据缓存
- 需要高性能的场景
- 复杂的缓存需求

**推荐使用**：这是默认且推荐的存储方式。


## 7. 缓存失效策略

### 7.1. LRUInvalidationPolicy（最近最少使用）

根据访问时间淘汰最少使用的缓存项：

```typescript
class LRUInvalidationPolicy implements CacheInvalidationPolicy {
  shouldInvalidate(item: StorageItem, now: number): boolean {
    // 基于 TTL 判断是否过期
    return now - item.timestamp >= item.ttl
  }
  
  updateItemOnAccess(item: StorageItem, now: number): void {
    // 更新访问时间和计数
    item.accessTime = now
    item.accessCount++
  }
}
```

### 7.2. FIFOInvalidationPolicy（先进先出）

按照数据插入的顺序淘汰：

```typescript
class FIFOInvalidationPolicy implements CacheInvalidationPolicy {
  shouldInvalidate(item: StorageItem, now: number): boolean {
    return now - item.timestamp >= item.ttl
  }
  
  updateItemOnAccess(item: StorageItem, now: number): void {
    // FIFO 不更新访问时间
  }
}
```

### 7.3. TimeBasedInvalidationPolicy（基于时间）

仅基于 TTL 判断：

```typescript
class TimeBasedInvalidationPolicy implements CacheInvalidationPolicy {
  shouldInvalidate(item: StorageItem, now: number): boolean {
    return now - item.timestamp >= item.ttl
  }
  
  updateItemOnAccess(item: StorageItem, now: number): void {
    // 不更新任何字段
  }
}
```

### 7.4. CustomInvalidationPolicy（自定义）

允许用户提供自定义失效逻辑：

```typescript
const customPolicy = new CustomInvalidationPolicy(
  (item, now) => {
    // 自定义失效条件
    if (item.accessCount < 5) {
      return true // 访问次数少的优先淘汰
    }
    return now - item.timestamp >= item.ttl
  },
  (item, now) => {
    item.accessTime = now
    item.accessCount++
  }
)
```

## 8. 缓存键策略

### 8.1. UrlPathKeyStrategy（URL 路径策略）

仅使用 URL 路径作为缓存键，忽略查询参数：

```typescript
class UrlPathKeyStrategy implements CacheKeyStrategy {
  generateKey(config: RequestConfig): string {
    const url = new URL(config.url, 'http://dummy.com')
    return `${config.method || 'GET'}:${url.pathname}`
  }
}
```

**使用场景**：相同路径的请求共享缓存。

### 8.2. FullUrlKeyStrategy（完整 URL 策略）

使用完整 URL（包括查询参数）作为缓存键：

```typescript
class FullUrlKeyStrategy implements CacheKeyStrategy {
  generateKey(config: RequestConfig): string {
    return `${config.method || 'GET'}:${config.url}`
  }
}
```

**使用场景**：不同查询参数应该有不同缓存。

### 8.3. ParameterizedKeyStrategy（参数化策略）

结合 URL 和参数生成缓存键：

```typescript
class ParameterizedKeyStrategy implements CacheKeyStrategy {
  generateKey(config: RequestConfig): string {
    let key = `${config.method || 'GET'}:${config.url}`
    
    if (config.params) {
      const sortedParams = Object.keys(config.params)
        .sort()
        .map(k => `${k}=${config.params[k]}`)
        .join('&')
      key += `?${sortedParams}`
    }
    
    return key
  }
}
```

**使用场景**：精确控制哪些参数影响缓存。

### 8.4. CustomKeyStrategy（自定义策略）

允许用户提供自定义键生成函数：

```typescript
const customStrategy = new CustomKeyStrategy((config) => {
  // 只缓存 GET 请求，且按用户 ID 分组
  if (config.method === 'GET') {
    const userId = config.headers?.['X-User-ID']
    return `user-${userId}:${config.url}`
  }
  return `${config.method}:${config.url}`
})
```

## 9. 测试方案

### 9.1. 单元测试

**基本功能测试**：
- ✅ 缓存存取功能
- ✅ 缓存过期机制
- ✅ 并发控制
- ✅ 数据克隆
- ✅ 清理机制

**存储适配器测试**：
- ✅ Memory 存储适配器
- ✅ LocalStorage 存储适配器
- ✅ IndexedDB 存储适配器

**缓存策略测试**：
- ✅ LRU 失效策略
- ✅ FIFO 失效策略
- ✅ 基于时间的失效策略
- ✅ 自定义失效策略

**缓存键测试**：
- ✅ 缓存键生成
- ✅ 哈希算法
- ✅ 键策略

### 9.2. 集成测试

**完整流程测试**：
```typescript
describe('CacheFeature Integration', () => {
  it('should cache and retrieve data correctly', async () => {
    const cache = new CacheFeature(requestor)
    
    // 第一次请求（缓存未命中）
    const data1 = await cache.requestWithCache(config, { ttl: 5000 })
    
    // 第二次请求（缓存命中）
    const data2 = await cache.requestWithCache(config, { ttl: 5000 })
    
    expect(data1).toEqual(data2)
    expect(requestor.request).toHaveBeenCalledTimes(1) // 只调用一次
  })
  
  it('should handle concurrent requests correctly', async () => {
    const cache = new CacheFeature(requestor)
    
    // 同时发起多个相同请求
    const promises = Array(10).fill(null).map(() => 
      cache.requestWithCache(config, { ttl: 5000 })
    )
    
    const results = await Promise.all(promises)
    
    // 所有结果应该相同
    expect(new Set(results).size).toBe(1)
    // 只应该发起一次网络请求
    expect(requestor.request).toHaveBeenCalledTimes(1)
  })
  
  it('should clean up expired items', async () => {
    const cache = new CacheFeature(requestor, 10)
    
    // 添加缓存项
    await cache.requestWithCache(config, { ttl: 100 })
    
    // 等待过期
    await sleep(150)
    
    // 触发清理
    await cache.requestWithCache(config2, { ttl: 5000 })
    
    // 验证过期项已被清理（通过检查缓存项）
    const item = await cache.getCacheItem(cacheKey)
    expect(item).toBeNull() // 过期项已被清理
  })
})
```

### 9.3. 性能测试

**缓存键生成性能**：
```typescript
describe('Cache Key Generation Performance', () => {
  it('should generate keys efficiently', () => {
    const generator = new CacheKeyGenerator()
    const config = { method: 'GET', url: '/api/users', params: { page: 1 } }
    
    const startTime = performance.now()
    for (let i = 0; i < 10000; i++) {
      generator.generateCacheKey(config)
    }
    const endTime = performance.now()
    
    expect(endTime - startTime).toBeLessThan(100) // 应该在 100ms 内完成
  })
  
  it('should benefit from hash cache', () => {
    const generator = new CacheKeyGenerator({ enableHashCache: true })
    const config = { 
      method: 'GET', 
      url: '/api/users', 
      params: { page: 1, size: 20, filter: 'active' } 
    }
    
    // 第一次生成（无缓存）
    const start1 = performance.now()
    generator.generateCacheKey(config)
    const time1 = performance.now() - start1
    
    // 第二次生成（有缓存）
    const start2 = performance.now()
    generator.generateCacheKey(config)
    const time2 = performance.now() - start2
    
    // 第二次应该明显更快
    expect(time2).toBeLessThan(time1 * 0.5)
  })
})
```

**存储性能测试**：
```typescript
describe('Storage Performance', () => {
  it('should handle large datasets efficiently', async () => {
    const storage = new IndexedDBAdapter()
    
    const startTime = performance.now()
    
    // 存储 1000 个项目
    for (let i = 0; i < 1000; i++) {
      await storage.setItem({
        key: `key-${i}`,
        data: { id: i, name: `Item ${i}` },
        timestamp: Date.now(),
        ttl: 60000,
        accessTime: Date.now(),
        accessCount: 0
      })
    }
    
    const endTime = performance.now()
    
    expect(endTime - startTime).toBeLessThan(5000) // 应该在 5 秒内完成
  })
})
```

## 10. 使用场景与最佳实践

### 10.1. API 数据缓存

**场景**：缓存后端 API 返回的数据，减少网络请求。

```typescript
// 用户信息缓存（长期）
const userInfo = await cache.requestWithCache({
  url: '/api/user/profile',
  method: 'GET'
}, {
  ttl: 30 * 60 * 1000,  // 30 分钟
  storageType: StorageType.LOCAL_STORAGE,
  clone: 'deep'
})

// 列表数据缓存（短期）
const posts = await cache.requestWithCache({
  url: '/api/posts',
  method: 'GET',
  params: { page: 1 }
}, {
  ttl: 5 * 60 * 1000,  // 5 分钟
  storageType: StorageType.MEMORY
})
```

### 10.2. 搜索结果缓存

**场景**：缓存搜索结果，提升搜索体验。

```typescript
const searchResults = await cache.requestWithCache({
  url: '/api/search',
  method: 'GET',
  params: { q: keyword, page: 1 }
}, {
  ttl: 10 * 60 * 1000,  // 10 分钟
  key: `search-${keyword}-page1`,  // 自定义键，便于管理
  maxEntries: 50  // 限制搜索缓存数量
})

// 清除特定搜索缓存
await cache.clearCache(`search-${keyword}-page1`)
```

### 10.3. 图片/静态资源缓存

**场景**：缓存图片和静态资源 URL，减少重复请求。

```typescript
const imageData = await cache.requestWithCache({
  url: '/api/images/123',
  method: 'GET'
}, {
  ttl: 60 * 60 * 1000,  // 1 小时
  storageType: StorageType.INDEXED_DB,
  clone: 'none'  // 静态资源不需要克隆
})
```

### 10.4. 配置数据缓存

**场景**：缓存应用配置，减少启动时间。

```typescript
// 使用预设配置：长期缓存（24小时，IndexedDB，深拷贝）
const appConfig = await cache.requestWithCache({
  url: '/api/config',
  method: 'GET'
}, {
  preset: 'long',
  key: 'app-config'  // 自定义键，便于管理
})

// 或者使用持久化预设（7天）
const persistentConfig = await cache.requestWithCache({
  url: '/api/config',
  method: 'GET'
}, {
  preset: 'persistent',
  key: 'app-config'
})
```

### 10.5. 分页数据缓存

**场景**：缓存分页数据，提升翻页体验。

```typescript
// 使用参数化键策略
cache.setKeyStrategy(new ParameterizedKeyStrategy())

// 缓存每一页
for (let page = 1; page <= 5; page++) {
  const data = await cache.requestWithCache({
    url: '/api/items',
    method: 'GET',
    params: { page, size: 20 }
  }, {
    ttl: 15 * 60 * 1000,  // 15 分钟
    maxEntries: 100  // 最多缓存 100 页
  })
}
```

### 10.6. 最佳实践建议

1. **选择合适的存储类型**：
   - 临时数据 → Memory
   - 小量持久化 → LocalStorage
   - 大量持久化 → IndexedDB（推荐）

2. **设置合理的 TTL**：
   - 频繁变化的数据 → 短 TTL（1-5 分钟）
   - 稳定数据 → 长 TTL（30-60 分钟）
   - 静态配置 → 超长 TTL（24 小时）

3. **使用数据克隆**：
   - 只读数据 → `clone: 'none'`
   - 简单对象 → `clone: 'shallow'`
   - 嵌套对象 → `clone: 'deep'`

4. **限制缓存大小**：
   - 设置合理的 `maxEntries`
   - 避免缓存大对象
   - 定期清理不需要的缓存

5. **自定义缓存键**：
   - 使用有意义的键名
   - 便于管理和清理
   - 避免键冲突

6. **监控缓存状态**：
   ```typescript
   // 获取当前存储类型
   const storageType = cache.getStorageType()
   console.log('Current storage type:', storageType)
   
   // 检查特定缓存项是否有效
   const item = await cache.getCacheItem('cache-key')
   if (item && cache.isCacheItemValid(item)) {
     console.log('Cache item is valid')
   }
   ```

## 11. 性能优化

### 11.1. 已实现的优化

1. **FNV-1a 哈希算法**：
   - 速度快，冲突率低
   - 适合缓存键生成场景

2. **哈希缓存**：
   - 缓存已计算的哈希值
   - 避免重复计算

3. **分层哈希**：
   - 分别处理 URL、参数、请求体
   - 避免整体序列化

4. **增量清理**：
   - 随机采样检查（最多 100 个）
   - 分批淘汰（最多 50 个）
   - 避免一次性清理大量数据

5. **并发控制**：
   - 防止相同请求的重复发送
   - 复用 pending 请求的 Promise

6. **优先使用 structuredClone**：
   - 深拷贝性能更好
   - 支持更多数据类型

### 11.2. 性能指标

基于测试结果：

| 操作 | 性能指标 |
|------|----------|
| 缓存键生成 | < 0.01ms/次 |
| 缓存命中读取 | < 1ms |
| 缓存写入 | < 5ms (IndexedDB) |
| 并发请求合并 | 节省 90%+ 请求 |
| 增量清理 | < 100ms |

### 11.3. 内存优化

1. **限制缓存大小**：
   ```typescript
   const cache = new CacheFeature(requestor, 100) // 限制 100 条
   ```

2. **清理哈希缓存**：
   ```typescript
   cache.clearKeyGeneratorCache() // 定期清理
   ```

3. **使用浅拷贝**：
   ```typescript
   // 对于大对象，使用浅拷贝
   const data = await cache.requestWithCache(config, {
     ttl: 60000,
     clone: 'shallow'
   })
   ```

## 12. 注意事项

### 12.1. 数据一致性

缓存可能导致数据不一致，需要注意：

1. **设置合理的 TTL**：
   ```typescript
   // 频繁变化的数据使用短 TTL
   const data = await cache.requestWithCache(config, { ttl: 60 * 1000 })
   ```

2. **主动清理缓存**：
   ```typescript
   // 数据更新后清理相关缓存
   await updateUser(userId, newData)
   await cache.clearCache(`user-${userId}`)
   ```

3. **使用版本控制**：
   ```typescript
   const version = 'v1'
   const data = await cache.requestWithCache(config, {
     key: `data-${version}`,
     ttl: 5 * 60 * 1000
   })
   ```

### 12.2. 存储限制

不同存储类型有不同的限制：

| 存储类型 | 容量限制 | 持久化 | 性能 |
|---------|---------|--------|------|
| Memory | 受内存限制 | ❌ | ⭐⭐⭐⭐⭐ |
| LocalStorage | 5-10MB | ✅ | ⭐⭐⭐⭐ |
| IndexedDB | 50MB+ | ✅ | ⭐⭐⭐⭐⭐ |

### 12.3. 安全性

1. **敏感数据**：
   ```typescript
   // 敏感数据不应缓存，或使用短 TTL
   const sensitiveData = await cache.requestWithCache(config, {
     ttl: 30 * 1000,  // 30 秒
     storageType: StorageType.MEMORY  // 仅内存存储
   })
   ```

2. **数据克隆**：
   ```typescript
   // 使用深拷贝防止缓存被意外修改
   const data = await cache.requestWithCache(config, {
     clone: 'deep'
   })
   ```

### 12.4. 浏览器兼容性

1. **检测存储可用性**：
   ```typescript
   const adapter = new IndexedDBAdapter()
   if (!adapter.isAvailable()) {
     console.warn('IndexedDB not available, falling back to memory')
   }
   ```

2. **降级策略**：
   ```typescript
   // 自动降级到 Memory
   const cache = new CacheFeature(requestor, 1000, undefined, StorageType.INDEXED_DB)
   // 如果 IndexedDB 不可用，会自动使用 Memory
   ```

### 12.5. 错误处理和降级机制

缓存功能实现了完善的错误处理和自动降级机制，确保在各种异常情况下仍能正常工作。

#### 12.5.1. 存储适配器自动降级

当指定的存储类型不可用时，系统会自动降级到内存存储：

```typescript
// 在非浏览器环境或存储不可用时，自动降级到内存存储
const cache = new CacheFeature(requestor, 1000, undefined, StorageType.LOCAL_STORAGE)
// 如果 LocalStorage 不可用，会自动使用 MemoryStorageAdapter
```

**降级场景**：
- LocalStorage 在非浏览器环境不可用 → 降级到 Memory
- IndexedDB 在非浏览器环境或旧浏览器不可用 → 降级到 Memory
- 存储操作失败时 → 记录警告，但不影响请求执行

#### 12.5.2. 存储操作错误处理

所有存储操作都包含错误处理，确保单个操作的失败不会影响整体功能：

**读取操作失败**：
- 缓存读取失败时，记录警告日志
- 将错误视为缓存未命中，继续执行网络请求
- 不影响数据返回

```typescript
// 内部实现示例
try {
  cachedItem = await this.storageAdapter.getItem(cacheKey)
} catch (error) {
  // 存储适配器读取失败时，记录警告并将其视为缓存未命中
  this.handleStorageError('read', cacheKey, error, 'cache miss')
  cachedItem = null
}
```

**写入操作失败**：
- 缓存写入失败时，记录警告日志
- 数据仍然正常返回，只是未缓存
- 不影响用户体验

```typescript
// 内部实现示例
try {
  await this.storageAdapter.setItem(cacheItem)
} catch (error) {
  // 缓存存储失败，但不影响数据返回
  this.logCacheEvent('error', cacheKey, {
    'operation': 'set cache item',
    'error': error instanceof Error ? error.message : 'Unknown storage error',
    'status': 'data returned successfully'
  })
}
```

**清理操作失败**：
- 清理操作失败时，记录警告日志
- 不会抛出异常，避免影响主流程

```typescript
// 内部实现示例
try {
  await this.storageAdapter.removeItem(key)
} catch (error) {
  this.handleStorageError('remove item', key, error, 'removal failed')
  return // 移除失败时，不需要继续获取统计信息
}
```

#### 12.5.3. 统一错误日志记录

所有错误都通过统一的日志记录机制处理：

```typescript
// 错误日志格式
console.warn(
  LogFormatter.formatCacheLog('error', key, {
    'operation': operation,           // 操作类型：read, write, remove 等
    'error': error.message,           // 错误信息
    'status': status                  // 状态：cache miss, removal failed 等
  })
)
```

**日志类型**：
- `hit`: 缓存命中
- `miss`: 缓存未命中
- `set`: 设置缓存
- `clear`: 清理缓存
- `error`: 错误信息

#### 12.5.4. 键生成错误处理

缓存键生成失败时，会抛出 `RequestError`，包含原始错误信息：

```typescript
try {
  return this.keyGenerator.generateCacheKey(config, customKey)
} catch (error) {
  throw new RequestError(
    `Failed to generate cache key: ${error.message}`,
    { originalError: error }
  )
}
```

#### 12.5.5. 数据克隆错误处理

数据克隆失败时，会降级处理：

**structuredClone 失败**：
- 降级到 JSON 序列化方式
- 记录警告日志

**JSON 克隆失败**：
- 返回原始数据
- 记录警告日志

```typescript
// 内部实现示例
private deepClone<T>(data: T): T {
  if (typeof structuredClone === 'function') {
    try {
      return structuredClone(data)
    } catch (error) {
      console.warn('[Cache] structuredClone failed, falling back to JSON clone:', error)
    }
  }
  
  try {
    return JSON.parse(JSON.stringify(data))
  } catch (error) {
    console.warn('[Cache] JSON clone failed, returning original data:', error)
    return data
  }
}
```

#### 12.5.6. 销毁操作错误处理

销毁缓存实例时，即使存储适配器销毁失败，也会确保内部状态被重置：

```typescript
async destroy(): Promise<void> {
  try {
    await this.storageAdapter.destroy()
  } catch (error) {
    // 存储适配器销毁失败时记录警告，但不阻止清理过程
    this.handleStorageError('storage destroy', 'destroy', error, 'cleanup continued')
  } finally {
    // 确保内部状态总是被重置
    this.lastCleanupTime = 0
  }
}
```

#### 12.5.7. 最佳实践

1. **监听控制台日志**：
   - 关注警告日志，及时发现存储问题
   - 根据日志调整存储策略

2. **处理键生成错误**：
   ```typescript
   try {
     const data = await cache.requestWithCache(config, { ttl: 60000 })
   } catch (error) {
     if (error instanceof RequestError && error.message.includes('cache key')) {
       // 处理键生成错误
       console.error('Cache key generation failed:', error)
     }
   }
   ```

3. **定期检查存储状态**：
   ```typescript
   const storageType = cache.getStorageType()
   if (storageType === StorageType.MEMORY && expectedType !== StorageType.MEMORY) {
     console.warn('Storage downgraded to memory, check storage availability')
   }
   ```

## 13. 未来优化方向

### 13.1. 智能缓存预测

基于用户行为预测性缓存数据：

```typescript
// 用户浏览第 1 页时，预加载第 2、3 页
cache.prefetch([
  { url: '/api/items', params: { page: 2 } },
  { url: '/api/items', params: { page: 3 } }
])
```

### 13.2. 缓存优先级

为缓存项设置优先级，优先保留重要数据：

```typescript
await cache.requestWithCache(config, {
  ttl: 60000,
  priority: 'high'  // 高优先级，不易被淘汰
})
```

### 13.3. 缓存分组

支持缓存分组管理：

```typescript
// 按标签分组
await cache.requestWithCache(config, {
  ttl: 60000,
  tags: ['user-data', 'profile']
})

// 按标签清理
await cache.clearByTag('user-data')
```

### 13.4. 缓存同步

支持跨标签页缓存同步：

```typescript
// 使用 BroadcastChannel 同步缓存
const channel = new BroadcastChannel('cache-sync')
channel.postMessage({ type: 'cache-update', key: 'xxx' })
```

### 13.5. 压缩存储

对大数据进行压缩存储：

```typescript
await cache.requestWithCache(config, {
  ttl: 60000,
  compress: true  // 启用压缩
})
```

### 13.6. 缓存预热

应用启动时预热常用缓存：

```typescript
cache.warmup([
  { url: '/api/config' },
  { url: '/api/user/profile' },
  { url: '/api/menu' }
])
```

## 14. 总结

缓存功能是提升应用性能的关键手段。通过 `CacheFeature`，我们实现了一个高性能、灵活且易用的缓存解决方案，具备以下特点：

- ✅ **高性能**：FNV-1a 哈希算法、哈希缓存、分层处理
- ✅ **灵活性**：多种存储适配器、缓存策略、键策略
- ✅ **智能管理**：自动清理、LRU 淘汰、并发控制
- ✅ **数据安全**：多种克隆模式、错误处理
- ✅ **可观测性**：详细统计信息、日志输出
- ✅ **易用性**：合理默认配置、简洁 API

通过合理使用缓存功能，可以显著减少网络请求、降低服务器负载、提升用户体验。

