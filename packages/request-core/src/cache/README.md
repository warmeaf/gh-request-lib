# Cache Module

高性能缓存模块，为请求库提供灵活且高效的缓存解决方案。

## 功能特性

- **多种存储适配器**：支持内存、LocalStorage、IndexedDB 和 WebSQL 存储
- **智能缓存键生成**：高性能缓存键生成器，支持多种哈希算法
- **灵活的缓存策略**：支持 LRU、FIFO 和基于时间的缓存失效策略
- **多样的缓存键策略**：URL路径、完整URL、参数化和自定义键策略
- **统计信息**：提供缓存命中率、缓存大小等统计信息

## 核心组件

### CacheKeyGenerator (缓存键生成器)

高性能缓存键生成器，用于根据请求配置生成唯一的缓存键。

```typescript
import { CacheKeyGenerator } from './cache-key-generator'

const generator = new CacheKeyGenerator({
  includeHeaders: true,
  headersWhitelist: ['content-type', 'authorization'],
  maxKeyLength: 512,
  enableHashCache: true,
  hashAlgorithm: 'fnv1a'
})

const cacheKey = generator.generateCacheKey(requestConfig)
```

#### 特性

- 使用 FNV-1a 哈希算法，性能和冲突率都更好
- 分层哈希，避免不必要的序列化
- 快速路径处理常见情况
- 哈希结果缓存，避免重复计算
- 二进制哈希，直接处理对象结构

### Storage Adapters (存储适配器)

提供统一接口的存储适配器，支持多种存储方案。

#### MemoryStorageAdapter

基于 Map 的内存存储实现，适用于临时缓存。

```typescript
import { MemoryStorageAdapter } from './adapters/memory-adapter'

const memoryAdapter = new MemoryStorageAdapter()
```

#### LocalStorageAdapter

基于浏览器 LocalStorage 的存储实现，适用于持久化缓存。

```typescript
import { LocalStorageAdapter } from './adapters/local-storage-adapter'

const localStorageAdapter = new LocalStorageAdapter()
```

#### IndexedDBAdapter

基于浏览器 IndexedDB 的存储实现，适用于大量数据的持久化缓存。

```typescript
import { IndexedDBAdapter } from './adapters/indexeddb-adapter'

const indexedDBAdapter = new IndexedDBAdapter()
```

#### WebSQLAdapter

基于浏览器 WebSQL 的存储实现（已废弃，但为了兼容性保留）。

```typescript
import { WebSQLAdapter } from './adapters/websql-adapter'

const webSQLAdapter = new WebSQLAdapter()
```

### Cache Strategies (缓存策略)

#### Cache Key Strategies (缓存键策略)

- `UrlPathKeyStrategy`: 基于URL路径生成缓存键
- `FullUrlKeyStrategy`: 基于完整URL生成缓存键
- `ParameterizedKeyStrategy`: 基于URL和参数生成缓存键
- `CustomKeyStrategy`: 允许用户提供自定义的键生成函数

#### Cache Invalidation Policies (缓存失效策略)

- `LRUInvalidationPolicy`: 最近最少使用算法
- `FIFOInvalidationPolicy`: 先进先出算法
- `TimeBasedInvalidationPolicy`: 基于时间戳和TTL
- `CustomInvalidationPolicy`: 允许用户提供自定义的失效函数

## 使用示例

```typescript
// 创建缓存键生成器
const keyGenerator = new CacheKeyGenerator({
  includeHeaders: true,
  hashAlgorithm: 'fnv1a'
})

// 生成缓存键
const cacheKey = keyGenerator.generateCacheKey({
  method: 'GET',
  url: 'https://api.example.com/users',
  params: { page: 1, size: 10 }
})

// 使用内存存储适配器
const storage = new MemoryStorageAdapter()

// 存储数据
await storage.setItem({
  key: cacheKey,
  data: userData,
  timestamp: Date.now(),
  ttl: 60000, // 1分钟
  accessTime: Date.now(),
  accessCount: 0
})

// 获取数据
const cachedItem = await storage.getItem(cacheKey)
```

## API 参考

### CacheKeyGenerator

#### 构造函数

```typescript
new CacheKeyGenerator(config?: CacheKeyConfig)
```

#### CacheKeyConfig

| 属性 | 类型 | 默认值 | 描述 |
|------|------|--------|------|
| includeHeaders | boolean | false | 是否包含请求头 |
| headersWhitelist | string[] | ['content-type', 'authorization'] | 请求头白名单 |
| maxKeyLength | number | 512 | 最大键长度 |
| enableHashCache | boolean | true | 是否启用哈希缓存 |
| hashAlgorithm | 'fnv1a' \| 'xxhash' \| 'simple' | 'fnv1a' | 哈希算法选择 |

#### 方法

- `generateCacheKey(config: RequestConfig, customKey?: string): string` - 生成缓存键
- `getStats(): object` - 获取统计信息
- `resetStats(): void` - 重置统计信息
- `clearCache(): void` - 清空内部缓存
- `warmupCache(configs: RequestConfig[]): void` - 预热缓存
- `updateConfig(config: Partial<CacheKeyConfig>): void` - 更新配置

### StorageAdapter

所有存储适配器都实现了以下接口：

```typescript
interface StorageAdapter<T = unknown> {
  getType(): StorageType
  isAvailable(): boolean
  getItem(key: string): Promise<StorageItem<T> | null>
  setItem(item: StorageItem<T>): Promise<void>
  removeItem(key: string): Promise<void>
  clear(): Promise<void>
  getKeys(): Promise<string[]>
  getStats(): Promise<{ size: number; maxSize?: number; [key: string]: unknown }>
  destroy(): Promise<void>
}
```

### StorageItem

```typescript
interface StorageItem<T = unknown> {
  key: string
  data: T
  timestamp: number
  ttl: number
  accessTime: number
  accessCount: number
}
```

## 性能优化

1. **缓存键哈希缓存**：通过 `enableHashCache` 选项启用，避免重复计算相同对象的哈希值
2. **快速路径处理**：对简单对象和数组使用快速序列化方法
3. **对象签名**：使用对象签名来快速识别和缓存复杂对象结构
4. **采样哈希**：对大数组和对象使用采样哈希来减少计算量

## 浏览器兼容性

| 特性 | 支持情况 |
|------|----------|
| MemoryStorageAdapter | 全平台支持 |
| LocalStorageAdapter | 全平台支持 |
| IndexedDBAdapter | 现代浏览器支持 |
| WebSQLAdapter | 已废弃，仅部分旧浏览器支持 |

建议优先使用 IndexedDB 适配器，它提供了最好的性能和存储容量。