# 基础请求示例

本文档演示了 request-bus 库的各种基础请求功能，包括GET、POST、PUT、DELETE请求，以及缓存机制和错误处理。所有示例都使用 [JSONPlaceholder](https://jsonplaceholder.typicode.com/) 作为测试API。

## 📊 GET 请求演示

展示如何使用 GET 请求获取用户信息，包括请求过程可视化和数据展示。

:::preview GET请求 || 获取用户信息

demo-preview=./components/basic-requests/get.vue

:::

## 📝 POST 请求演示

演示如何使用 POST 请求创建新的资源（文章），包括表单验证和响应处理。

:::preview POST请求 || 创建新文章

demo-preview=./components/basic-requests/post.vue

:::

## ✏️ PUT 请求演示

展示如何使用 PUT 请求更新现有资源，包括原始数据预览和更新前后对比。

:::preview PUT请求 || 更新用户信息

demo-preview=./components/basic-requests/put.vue

:::

## 🗑️ DELETE 请求演示

演示如何安全地删除资源，包括确认机制和删除反馈。

:::preview DELETE请求 || 删除文章

demo-preview=./components/basic-requests/delete.vue

:::

## 💾 缓存功能演示

展示 request-bus 的智能缓存机制，包括缓存命中率统计和性能对比分析。

:::preview 缓存功能 || 智能缓存管理

demo-preview=./components/basic-requests/cache.vue

:::

## ⚠️ 错误处理演示

演示各种错误场景的处理，包括重试机制、超时处理和详细的错误日志。

:::preview 错误处理 || 重试机制与异常处理

demo-preview=./components/basic-requests/error.vue

:::

## 🎯 核心特性总结

### 📡 请求方法支持
- **GET**: 获取数据，支持查询参数
- **POST**: 创建新资源，支持JSON和表单数据
- **PUT**: 更新整个资源
- **DELETE**: 删除资源

### 🚀 高级功能
- **智能缓存**: 自动缓存GET请求，可配置TTL
- **自动重试**: 可配置重试次数和重试条件
- **错误处理**: 统一的错误处理和详细的错误信息
- **超时控制**: 灵活的超时配置

### 🔧 配置选项
```javascript
const requestBus = createRequestBus('fetch', {
  globalConfig: {
    timeout: 10000,     // 全局超时时间
    debug: true,        // 调试模式
    retries: 3,         // 默认重试次数
    cache: {
      ttl: 300000,      // 缓存默认TTL (5分钟)
      maxSize: 100      // 最大缓存条目数
    }
  }
})
```

### 📈 性能优势
- **缓存加速**: 重复请求可提升 3-10 倍性能
- **智能重试**: 自动处理临时网络问题
- **类型安全**: 完整的TypeScript支持
- **内存优化**: 智能的内存管理和缓存清理

### 🌟 最佳实践
1. **合理使用缓存**: 对于不经常变化的数据启用缓存
2. **设置适当的超时**: 根据网络环境调整超时时间
3. **处理错误**: 总是为请求添加错误处理
4. **监控性能**: 利用缓存统计信息优化性能
