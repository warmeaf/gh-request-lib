# 缓存请求

## 基本概念

缓存功能允许你缓存请求的响应数据，在缓存有效期内再次请求相同的资源时，直接返回缓存数据，避免发起实际的网络请求。

### 主要特性

- **多种存储方式**：支持内存、LocalStorage、IndexedDB、WebSQL
- **自动过期管理**：基于 TTL（生存时间）自动清理过期缓存
- **LRU 淘汰策略**：当缓存达到上限时，自动淘汰最少使用的项
- **并发控制**：相同请求的并发自动合并，避免重复请求
- **灵活的键生成**：支持自定义缓存键和多种键生成策略

## 适用场景

缓存功能适用于以下场景：

- **减少重复请求**：避免在短时间内重复请求相同的数据
- **提升应用性能**：通过缓存减少网络请求，加快响应速度
- **离线数据支持**：使用持久化存储（LocalStorage、IndexedDB）支持离线访问
- **降低服务器负载**：减少对服务器的请求压力
- **改善用户体验**：快速返回缓存数据，提升用户交互体验

## API

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

### getWithCache

缓存 GET 请求的便捷方法。

#### 类型签名

```typescript
async getWithCache<T>(url: string, cacheConfig?: CacheConfig): Promise<T>
```

#### 参数

- **url**: 请求地址
- **cacheConfig**: 缓存配置（可选）

### clearCache

清除缓存数据。

#### 类型签名

```typescript
clearCache(key?: string): void
```

#### 参数

- **key**（可选）: 要清除的缓存键。如果不提供，则清除所有缓存。

## StorageType 枚举

```typescript
enum StorageType {
  MEMORY = 'memory', // 内存存储（默认）
  LOCAL_STORAGE = 'localStorage', // LocalStorage
  INDEXED_DB = 'indexedDB', // IndexedDB
  WEB_SQL = 'webSQL', // WebSQL（已废弃）
}
```
