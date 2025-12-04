# Cache Module

高性能缓存模块，为请求库提供灵活且高效的缓存解决方案。

## 功能特性

- **多种存储适配器**：支持内存、LocalStorage、IndexedDB 存储
- **智能缓存键生成**：高性能缓存键生成器，支持多种哈希算法
- **灵活的缓存策略**：支持 LRU、FIFO 和基于时间的缓存失效策略
- **多样的缓存键策略**：URL路径、完整URL、参数化和自定义键策略
- **特殊类型支持**：支持 FormData、Blob、ArrayBuffer、URLSearchParams 等特殊数据类型的缓存键生成

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
- 哈希结果缓存，避免重复计算（超过1000条时自动清理一半）
- 深度克隆机制，确保对象结构哈希的一致性
- 特殊类型处理：支持 FormData、Blob、ArrayBuffer、URLSearchParams 等
- 采样哈希：对大数组和对象使用采样哈希来减少计算量

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

**实现细节**：
- 使用 `request_cache_` 前缀避免键冲突
- 通过 `request_cache_meta` 键管理所有缓存键的元数据
- 自动进行可用性检查，在存储不可用时抛出错误
- 提供完整的错误处理和日志记录

```typescript
import { LocalStorageAdapter } from './adapters/local-storage-adapter'

const localStorageAdapter = new LocalStorageAdapter()

// 检查是否可用
if (localStorageAdapter.isAvailable()) {
  // 使用适配器
}
```

#### IndexedDBAdapter

基于浏览器 IndexedDB 的存储实现，适用于大量数据的持久化缓存。

**实现细节**：
- 延迟初始化：数据库在首次使用时才创建
- 数据库版本管理：使用版本号管理数据库结构变更
- 索引优化：创建 `timestamp` 和 `accessTime` 索引以支持高效查询
- 自动错误处理：在 IndexedDB 不可用时抛出错误
- 资源管理：提供 `destroy()` 方法关闭数据库连接

```typescript
import { IndexedDBAdapter } from './adapters/indexeddb-adapter'

const indexedDBAdapter = new IndexedDBAdapter()

// 检查是否可用
if (indexedDBAdapter.isAvailable()) {
  // 使用适配器
  // 使用完毕后可以销毁
  await indexedDBAdapter.destroy()
}
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

// 检查存储是否可用（内存存储始终可用）
if (storage.isAvailable()) {
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
  
  // 获取所有缓存键
  const keys = await storage.getKeys()
  
  // 删除指定缓存项
  await storage.removeItem(cacheKey)
  
  // 清空所有缓存
  await storage.clear()
  
  // 销毁适配器（清理资源）
  await storage.destroy()
}

// 使用 LocalStorage 适配器示例
const localStorageAdapter = new LocalStorageAdapter()
if (localStorageAdapter.isAvailable()) {
  // LocalStorage 适配器会自动管理元数据
  await localStorageAdapter.setItem({
    key: cacheKey,
    data: userData,
    timestamp: Date.now(),
    ttl: 60000,
    accessTime: Date.now(),
    accessCount: 0
  })
}

// 更新缓存键生成器配置
keyGenerator.updateConfig({
  includeHeaders: true,
  maxKeyLength: 256
})

// 预热缓存（提前生成常用请求的缓存键）
keyGenerator.warmupCache([
  { method: 'GET', url: 'https://api.example.com/users' },
  { method: 'GET', url: 'https://api.example.com/posts' }
])

// 清空内部哈希缓存
keyGenerator.clearCache()
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
  - `config`: 请求配置对象
  - `customKey`: 可选的自定义缓存键，如果提供则直接使用（会进行验证和标准化）
  - 返回：生成的缓存键字符串
- `clearCache(): void` - 清空内部哈希缓存
- `warmupCache(configs: RequestConfig[]): void` - 预热缓存，提前生成常用请求的缓存键
- `updateConfig(config: Partial<CacheKeyConfig>): void` - 动态更新配置

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
  destroy(): Promise<void>
}
```

**方法说明**：
- `getType()`: 返回存储类型枚举值
- `isAvailable()`: 检查存储是否可用（同步方法）
- `getItem(key)`: 根据键获取缓存项，不存在返回 `null`
- `setItem(item)`: 存储缓存项
- `removeItem(key)`: 删除指定键的缓存项
- `clear()`: 清空所有缓存项
- `getKeys()`: 获取所有缓存键的数组
- `destroy()`: 销毁适配器，清理资源（如关闭数据库连接）

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

1. **缓存键哈希缓存**：通过 `enableHashCache` 选项启用，避免重复计算相同对象的哈希值。当缓存超过1000条时，自动清理一半最旧的条目。
2. **快速路径处理**：对简单对象和数组（≤5个键或≤10个元素）使用快速序列化方法，避免深度遍历。
3. **对象签名**：使用对象签名来快速识别和缓存复杂对象结构，减少重复计算。
4. **采样哈希**：对大数组（>10个元素）和大对象（>10个键）使用采样哈希来减少计算量。
5. **深度克隆**：在哈希对象和数组前进行深度克隆，确保对象结构的一致性，避免外部修改影响缓存键。
6. **特殊类型优化**：针对 FormData、Blob、ArrayBuffer、URLSearchParams 等特殊类型提供专门的哈希处理。
7. **延迟初始化**：IndexedDB 适配器使用延迟初始化，只在首次使用时创建数据库连接。
8. **索引优化**：IndexedDB 适配器创建 timestamp 和 accessTime 索引，支持高效的查询和排序操作。

## 浏览器兼容性

| 特性 | 支持情况 |
|------|----------|
| MemoryStorageAdapter | 全平台支持 |
| LocalStorageAdapter | 全平台支持 |
| IndexedDBAdapter | 现代浏览器支持 |

建议优先使用 IndexedDB 适配器，它提供了最好的性能和存储容量。

## 实现细节

### CacheKeyGenerator 实现细节

#### 深度克隆机制
在哈希对象和数组数据时，`CacheKeyGenerator` 会先进行深度克隆，确保：
- 对象结构的一致性：避免外部修改影响已生成的缓存键
- 幂等性：相同输入始终生成相同的缓存键
- 安全性：不会修改原始数据对象

#### 特殊类型处理
- **FormData**: 遍历所有条目，对文件类型记录名称和大小，其他类型记录键值对
- **Blob**: 记录大小和类型信息
- **ArrayBuffer/ArrayBufferView**: 记录字节长度
- **URLSearchParams**: 转换为字符串后哈希

#### 缓存清理机制
当内部哈希缓存超过1000条时，会自动清理一半最旧的条目，保留最近使用的一半。这确保了：
- 内存使用可控
- 常用键的缓存命中率保持较高
- 清理操作不影响性能

### 适配器实现细节

#### 错误处理
所有适配器都实现了完整的错误处理：
- **可用性检查**：在操作前检查存储是否可用
- **错误捕获**：捕获并记录所有存储操作错误
- **优雅降级**：在存储不可用时抛出明确的错误信息

#### 元数据管理（LocalStorageAdapter）
LocalStorageAdapter 使用 `request_cache_meta` 键存储所有缓存键的列表，实现：
- 高效的 `getKeys()` 操作
- 准确的 `clear()` 操作
- 键的追踪和管理

#### 数据库初始化（IndexedDBAdapter）
IndexedDBAdapter 使用延迟初始化策略：
- 首次调用 `getItem`、`setItem` 等方法时才初始化数据库
- 使用单例模式确保只初始化一次
- 在 `onupgradeneeded` 事件中创建对象存储和索引