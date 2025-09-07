# 内存管理系统

这个内存管理系统为请求库提供了完整的内存监控、清理和优化功能，有效解决了性能数据累积、缓存溢出等内存问题。

## 🏗️ 系统架构

### 核心组件

1. **MemoryManager** - 中央内存管理器
   - 内存使用监控和统计
   - 自动垃圾回收和清理
   - 内存阈值管理
   - 资源泄漏检测

2. **ResourceTracker** - 资源追踪器
   - 特定类型资源的生命周期管理
   - 自动过期清理
   - 使用统计和访问模式分析

3. **CleanupStrategies** - 清理策略系统
   - LRU (最近最少使用)
   - LFU (最少频率使用)
   - TTL (基于时间过期)
   - Smart (智能选择策略)

## 🚀 使用方法

### 基础使用

```typescript
import { RequestCore } from 'request-core'
import { AxiosRequestor } from 'request-imp-axios'

// 创建启用内存管理的实例
const requestCore = new RequestCore(
  new AxiosRequestor(),
  { baseURL: 'https://api.example.com' },
  {
    enableMemoryManagement: true,
    memoryConfig: {
      maxMemoryMB: 50,           // 最大内存50MB
      gcIntervalMs: 300000,      // 5分钟执行一次GC
      enableLeakDetection: true  // 启用泄漏检测
    }
  }
)

// 正常使用，内存会自动管理
const response = await requestCore.get('/users')
```

### 内存监控

```typescript
// 获取内存统计
const memoryStats = requestCore.getMemoryStats()
console.log('当前内存使用:', memoryStats.currentUsage)
console.log('峰值内存:', memoryStats.peakUsage)
console.log('垃圾回收次数:', memoryStats.gcRuns)

// 获取详细内存报告
const report = requestCore.getMemoryReport()
console.log(report)

// 获取所有统计信息
const allStats = requestCore.getAllStats()
console.log('内存:', allStats.memory)
console.log('性能:', allStats.performance)
```

### 手动内存管理

```typescript
// 强制执行垃圾回收
const gcResult = requestCore.forceGarbageCollection()
console.log(`清理了 ${gcResult.itemsCollected} 个项目`)

// 清理特定类别的资源
const cleaned = requestCore.cleanupMemory('performance')

// 设置新的内存限制
requestCore.setMemoryLimit(30) // 30MB

// 启用/禁用内存管理
requestCore.setMemoryManagement(true)
```

### 高级用法 - 直接使用内存管理器

```typescript
import { MemoryManager, ResourceTracker } from 'request-core'

// 创建内存管理器
const memoryManager = new MemoryManager({
  maxMemoryMB: 20,
  warningThresholdPercent: 80,
  enableLeakDetection: true
})

// 创建资源追踪器
const tracker = new ResourceTracker(memoryManager, {
  category: 'my_data',
  maxItems: 1000,
  ttl: 30 * 60 * 1000, // 30分钟
  onResourceCreated: (id, data) => {
    console.log(`Created resource ${id}`)
  },
  onResourceDestroyed: (id, data) => {
    console.log(`Destroyed resource ${id}`)
  }
})

// 创建和管理资源
const id = tracker.create({ name: 'test', value: 123 })
const resource = tracker.get(id)
tracker.destroy(id)
```

## 📊 清理策略详解

### LRU (Least Recently Used)
```typescript
import { LRUCleanupStrategy } from 'request-core'

const lru = new LRUCleanupStrategy()
const result = lru.execute(targets, { maxItems: 100 })
```

### LFU (Least Frequently Used)
```typescript
import { LFUCleanupStrategy } from 'request-core'

const lfu = new LFUCleanupStrategy()
const result = lfu.execute(targets, { maxItems: 100 })
```

### TTL (Time To Live)
```typescript
import { TTLCleanupStrategy } from 'request-core'

const ttl = new TTLCleanupStrategy()
const result = ttl.execute(targets, { maxAge: 60000 }) // 1分钟
```

### 智能策略
```typescript
import { SmartCleanupStrategy } from 'request-core'

const smart = new SmartCleanupStrategy()
// 自动选择最适合的清理策略
const result = smart.execute(targets, { maxItems: 100 })
```

### 策略工厂
```typescript
import { CleanupStrategyFactory } from 'request-core'

// 获取所有可用策略
const strategies = CleanupStrategyFactory.getAvailableStrategies()

// 使用策略工厂
const strategy = CleanupStrategyFactory.getStrategy('hybrid')
const result = strategy.execute(targets, config)

// 注册自定义策略
CleanupStrategyFactory.registerStrategy('custom', new MyCustomStrategy())
```

## 🔧 配置选项

### MemoryManager 配置

```typescript
interface MemoryConfig {
  maxMemoryMB: number                 // 最大内存限制 (MB)
  warningThresholdPercent: number     // 警告阈值百分比
  gcIntervalMs: number               // GC间隔时间 (ms)
  enableLeakDetection: boolean       // 是否启用泄漏检测
  maxObjectAge: number              // 对象最大存活时间 (ms)
  enableDebug: boolean              // 是否启用调试模式
}
```

### ResourceTracker 配置

```typescript
interface ResourceTrackerConfig {
  category: string                   // 资源类别名称
  maxItems?: number                 // 最大项目数量
  maxMemoryMB?: number             // 最大内存使用 (MB)
  ttl?: number                     // 生存时间 (ms)
  enableAutoCleanup?: boolean      // 是否启用自动清理
  onResourceCreated?: (id: string, data: any) => void
  onResourceDestroyed?: (id: string, data: any) => void
  onLimitExceeded?: (current: number, limit: number) => void
}
```

## 📈 性能优化建议

### 1. 合理设置内存限制
```typescript
// 根据应用规模设置合适的内存限制
const requestCore = new RequestCore(requestor, globalConfig, {
  memoryConfig: {
    maxMemoryMB: process.env.NODE_ENV === 'production' ? 100 : 20
  }
})
```

### 2. 选择合适的清理策略
```typescript
// 对于访问模式较为随机的场景，使用LRU
// 对于有明显热点数据的场景，使用LFU
// 对于有明确时效性的数据，使用TTL
// 不确定的情况下，使用Smart策略
```

### 3. 启用采样以减少性能开销
```typescript
const requestCore = new RequestCore(requestor, globalConfig, {
  performanceConfig: {
    sampleRate: 20, // 每20个请求记录1个，减少内存占用
    enableMemoryManagement: true
  }
})
```

### 4. 定期清理和监控
```typescript
// 设置定期清理任务
setInterval(() => {
  const cleaned = requestCore.cleanupMemory()
  console.log(`Cleaned ${cleaned} items`)
  
  // 检查内存使用
  const stats = requestCore.getMemoryStats()
  if (stats.currentUsage > stats.peakUsage * 0.8) {
    console.warn('Memory usage is high, consider cleanup')
  }
}, 5 * 60 * 1000) // 每5分钟
```

## 🛠️ 故障排除

### 内存使用过高
1. 检查内存报告：`requestCore.getMemoryReport()`
2. 降低采样率或最大记录数
3. 手动执行垃圾回收：`requestCore.forceGarbageCollection()`
4. 清理特定类别的资源：`requestCore.cleanupMemory('category')`

### 性能问题
1. 禁用调试模式
2. 增加采样率以减少记录频率
3. 使用更激进的清理策略
4. 考虑禁用内存管理：`requestCore.setMemoryManagement(false)`

### 内存泄漏检测
```typescript
// 启用泄漏检测
const memoryManager = new MemoryManager({
  enableLeakDetection: true,
  enableDebug: true
})

// 查看可疑对象
const stats = memoryManager.getStats()
if (stats.suspiciousObjects > 0) {
  console.warn('Potential memory leaks detected:', stats.leakWarnings)
}
```

## 📝 最佳实践

1. **生产环境建议**
   - 启用内存管理
   - 设置合适的内存限制
   - 使用适中的采样率
   - 启用泄漏检测

2. **开发环境建议**
   - 启用调试模式
   - 使用较小的内存限制以便及时发现问题
   - 定期查看内存报告

3. **监控和告警**
   - 定期检查内存使用情况
   - 设置内存使用告警
   - 记录垃圾回收频率和效果

4. **资源清理**
   - 应用退出前调用 `requestCore.destroy()`
   - 长期运行的应用定期执行清理
   - 合理设置资源TTL

## 🔍 调试和监控

```typescript
// 启用详细日志
const requestCore = new RequestCore(requestor, globalConfig, {
  memoryConfig: {
    enableDebug: true
  }
})

// 监控内存使用趋势
const monitorMemory = () => {
  const stats = requestCore.getMemoryStats()
  console.log({
    current: `${(stats.currentUsage / 1024 / 1024).toFixed(2)}MB`,
    peak: `${(stats.peakUsage / 1024 / 1024).toFixed(2)}MB`,
    gcRuns: stats.gcRuns,
    categories: Object.keys(stats.categories)
  })
}

setInterval(monitorMemory, 30000) // 每30秒监控一次
```

通过合理使用这些内存管理功能，可以有效避免内存泄漏，提高应用程序的稳定性和性能。
