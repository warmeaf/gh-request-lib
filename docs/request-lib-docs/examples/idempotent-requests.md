# 幂等请求示例

## 🔒 什么是幂等请求？

对完全相同的请求（方法、URL、参数、数据、指定请求头）在一定时间内只执行一次，后续相同请求直接返回结果。在 Web 应用中，幂等性主要用于：

- **防重复提交**: 防止用户快速点击按钮导致的重复操作
- **缓存优化**: 相同请求的结果可以被缓存和重用
- **网络保护**: 减少不必要的网络请求，提升性能

## 📝 POST 幂等请求演示

演示如何使用 POST 幂等请求防止重复提交表单数据。

**操作指南**：
- 快速多次点击"幂等提交"按钮，观察请求去重效果
- **首次请求**：发起网络请求并缓存结果
- **缓存命中**：直接返回缓存结果
- **请求复用**：等待正在进行的请求完成
- **保护期**：5秒内相同请求会被去重

:::preview POST 幂等请求 || 防重复提交演示

demo-preview=./components/idempotent-requests/post.vue

:::

## 📊 GET 幂等请求演示

展示如何使用 GET 幂等请求避免重复的数据查询，提升应用性能。

**操作指南**：
- 快速多次点击"幂等查询"按钮，观察请求去重效果
- **缓存命中**：直接返回缓存结果
- **请求复用**：等待正在进行的请求
- **网络请求**：发起新的网络请求
- **保护期**：8秒内相同请求会被去重

:::preview GET 幂等请求 || 防重复查询演示

demo-preview=./components/idempotent-requests/get.vue

:::

## 🎯 核心特性详解

### 🔒 防重复提交机制

- **智能键生成**: 基于请求方法、URL、参数、数据和指定请求头生成唯一键
- **时间窗口控制**: 可配置的幂等保护时间（默认 30 秒）
- **重复请求拦截**: 在保护期内的重复请求会被自动拦截
- **回调通知**: 可配置重复请求发生时的回调函数

### 📊 性能优化

- **内存缓存**: 基于高效的内存缓存实现
- **键值压缩**: 支持多种哈希算法（fnv1a、xxhash、simple）
- **自动清理**: 过期请求会被自动清理，避免内存泄漏
- **统计监控**: 详细的性能统计信息

### 🔧 配置选项

```javascript
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 定义 API 类 - 支持幂等请求
class PostApi {
  constructor(requestCore) {
    this.requestCore = requestCore
  }

  // 普通 POST 请求
  async createPost(postData) {
    return this.requestCore.post('/posts', postData)
  }

  // 幂等 POST 请求 - 防重复提交
  async createPostIdempotent(postData, idempotentConfig = {}) {
    return this.requestCore.postIdempotent(
      '/posts',
      postData,
      {},
      {
        ttl: 30000, // 30秒幂等保护期
        includeHeaders: ['authorization', 'content-type'],
        onDuplicate: (original, duplicate) => {
          console.log('Duplicate request blocked:', duplicate)
        },
        ...idempotentConfig,
      }
    )
  }
}

// 创建 API 客户端
const apiClient = createApiClient(
  { post: PostApi },
  {
    requestor: fetchRequestor,
    globalConfig: {
      timeout: 10000,
      debug: true,
    },
  }
)

// 使用幂等请求
try {
  // 第一次请求 - 正常执行
  const result1 = await apiClient.post.createPostIdempotent({
    title: 'Test Post',
    body: 'Content',
  })

  // 立即再次请求 - 被拦截，返回缓存结果
  const result2 = await apiClient.post.createPostIdempotent({
    title: 'Test Post',
    body: 'Content',
  })

  console.log(
    'Same result:',
    JSON.stringify(result1) === JSON.stringify(result2)
  )
} catch (error) {
  console.error('Request failed:', error)
}
```

### 🚀 支持的请求方法

幂等请求功能支持所有 HTTP 方法：

- **GET**: `getIdempotent()` - 防重复查询
- **POST**: `postIdempotent()` - 防重复提交
- **PUT**: `putIdempotent()` - 防重复更新
- **PATCH**: `patchIdempotent()` - 防重复部分更新

### 📋 配置参数说明

| 参数                | 类型     | 默认值                            | 说明                              |
| ------------------- | -------- | --------------------------------- | --------------------------------- |
| `ttl`               | number   | 30000                             | 幂等保护时间（毫秒）              |
| `key`               | string   | 自动生成                          | 自定义幂等键                      |
| `includeHeaders`    | string[] | ['content-type', 'authorization'] | 参与幂等判断的请求头              |
| `includeAllHeaders` | boolean  | false                             | 是否包含所有请求头                |
| `hashAlgorithm`     | string   | 'fnv1a'                           | 哈希算法（fnv1a、xxhash、simple） |
| `onDuplicate`       | function | undefined                         | 重复请求回调函数                  |

### 📈 统计信息

幂等请求提供详细的统计信息：

```javascript
const stats = apiClient.post.requestCore.getIdempotentStats()
console.log(stats)
// {
//   totalRequests: 100,
//   duplicatesBlocked: 25,
//   duplicateRate: 25.0,
//   avgResponseTime: 150,
//   cacheHitRate: 25.0,
//   keyGenerationTime: 2
// }
```

### 🌟 使用场景

1. **表单提交**: 防止用户快速点击导致的重复提交
2. **数据查询**: 避免短时间内的重复查询，提升性能
3. **支付操作**: 确保支付请求的幂等性，避免重复扣款
4. **创建操作**: 防止重复创建相同的资源
5. **更新操作**: 确保更新操作的一致性

### ⚠️ 注意事项

1. **TTL 设置**: 根据业务需求合理设置幂等保护时间
2. **内存使用**: 大量幂等请求会占用内存，注意监控
3. **键冲突**: 不同请求可能生成相同的键，需要合理配置参数
4. **异常处理**: 幂等请求失败不会被缓存，下次请求会重新执行

### 🏆 最佳实践

1. **合理设置 TTL**: 根据操作类型设置合适的保护时间
2. **监控统计信息**: 定期检查幂等统计，优化配置
3. **错误处理**: 为幂等请求添加适当的错误处理
4. **用户反馈**: 在重复请求被拦截时给用户适当的反馈
