# 核心层 API

## 📖 概述

`request-core` 是请求库的核心层，采用管理器模式提供高级功能，支持缓存、重试、并发等特性。

## 🏗️ 核心架构

```typescript
class RequestCore {
  constructor(requestor: Requestor, globalConfig?: GlobalConfig)
}
```

**管理器组合：**
- `InterceptorManager` - 拦截器管理
- `ConfigManager` - 配置管理  
- `RequestExecutor` - 请求执行
- `ConvenienceMethods` - 便利方法
- `FeatureManager` - 高级功能

## 🔧 基本 API

### 核心请求方法

```typescript
// 基础请求
const response = await requestCore.request<User>({
  url: '/api/user/123',
  method: 'GET',
  headers: { 'Authorization': 'Bearer token' }
})
```

### HTTP 便利方法

```typescript
// GET 请求
const user = await requestCore.get<User>('/api/user/123')
const users = await requestCore.get<User[]>('/api/users', { params: { page: 1 } })

// POST 请求
const newUser = await requestCore.post<User>('/api/users', { name: 'John' })

// 其他方法
const updatedUser = await requestCore.put<User>('/api/user/123', userData)
await requestCore.delete('/api/user/123')
const patchedUser = await requestCore.patch<User>('/api/user/123', { name: 'New' })
await requestCore.head('/api/health')
const options = await requestCore.options('/api/endpoint')
```

### 链式构建器

```typescript
// 链式调用
const user = await requestCore.create<User>()
  .url('/api/user/123')
  .method('GET')
  .headers({ 'Authorization': 'Bearer token' })
  .timeout(5000)
  .send()

// 带重试和缓存
const data = await requestCore.create<Data>()
  .url('/api/data')
  .method('POST')
  .data({ key: 'value' })
  .retry(3)
  .cache(300000) // 缓存5分钟
  .json()
  .send()
```

## 🚀 高级功能

### 重试功能

```typescript
// 基础重试
const data = await requestCore.requestWithRetry({
  url: '/api/unstable-endpoint',
  method: 'GET'
}, {
  retries: 3,
  delay: 1000,
  backoffFactor: 2 // 指数退避
})

// 便利方法
const userData = await requestCore.getWithRetry<User>('/api/user/123', {
  retries: 3,
  delay: 2000
})
```

### 缓存功能

```typescript
// 基础缓存
const cachedData = await requestCore.requestWithCache({
  url: '/api/static-data',
  method: 'GET'
}, {
  ttl: 10 * 60 * 1000, // 缓存10分钟
  key: 'custom-key'
})

// 便利方法
const userData = await requestCore.getWithCache<User>('/api/user/123', {
  ttl: 5 * 60 * 1000 // 缓存5分钟
})

// 清除缓存
requestCore.clearCache() // 清除所有
requestCore.clearCache('specific-key') // 清除指定键
```

### 并发功能

```typescript
// 并发请求
const results = await requestCore.requestConcurrent<User>([
  { url: '/api/user/1', method: 'GET' },
  { url: '/api/user/2', method: 'GET' },
  { url: '/api/user/3', method: 'GET' }
], {
  maxConcurrency: 3, // 最多同时3个请求
  failFast: false
})

// 处理结果
results.forEach((result, index) => {
  if (result.success) {
    console.log(`Request ${index} succeeded:`, result.data)
  } else {
    console.error(`Request ${index} failed:`, result.error)
  }
})

// 便利方法
const userResults = await requestCore.getConcurrent<User>([
  '/api/user/1', '/api/user/2', '/api/user/3'
], { maxConcurrency: 2 })
```

## 🔧 配置和拦截器

### 全局配置

```typescript
// 设置全局配置
requestCore.setGlobalConfig({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: { 'User-Agent': 'MyApp/1.0' },
  debug: true,
  retries: 3,
  cacheEnabled: true,
  interceptors: [authInterceptor]
})
```

### 拦截器

```typescript
const authInterceptor: RequestInterceptor = {
  onRequest: (config) => {
    config.headers = { ...config.headers, 'Authorization': `Bearer ${getToken()}` }
    return config
  },
  onResponse: (response, config) => {
    console.log('Response received:', config.url)
    return response
  },
  onError: (error, config) => {
    if (error.status === 401) redirectToLogin()
    return error
  }
}

requestCore.addInterceptor(authInterceptor)
requestCore.clearInterceptors() // 清除所有
```

## 🎯 专用功能

### 文件操作

```typescript
// 文件上传
const uploadResult = await requestCore.uploadFile<UploadResponse>('/api/upload', {
  file: fileFromInput,
  name: 'avatar',
  filename: 'avatar.jpg',
  onProgress: (progress) => console.log(`Upload: ${progress}%`)
})

// 文件下载
const blob = await requestCore.downloadFile('/api/download/report.pdf', 'report.pdf')
```

### 分页数据

```typescript
const paginatedUsers = await requestCore.getPaginated<User>('/api/users', {
  page: 1,
  limit: 20
})
// 返回: { data, total, page, limit, hasNext, hasPrev }
```

## 📊 监控统计

```typescript
// 各种统计
const cacheStats = requestCore.getCacheStats()
const concurrentStats = requestCore.getConcurrentStats()  
const allStats = requestCore.getAllStats()
```

## 🔒 主要类型

### 核心接口

- `RequestConfig` - 请求配置接口
- `Requestor` - 请求实现者接口
- `GlobalConfig` - 全局配置接口
- `RequestInterceptor` - 拦截器接口
- `RequestBuilder<T>` - 链式构建器接口

### 功能配置

- `RetryConfig` - 重试配置
- `CacheConfig` - 缓存配置
- `ConcurrentConfig` - 并发配置
- `ConcurrentResult<T>` - 并发结果

### 数据类型

- `RequestParams` - 请求参数类型
- `RequestData` - 请求数据类型
- `FileUploadOptions` - 文件上传选项
- `PaginatedResponse<T>` - 分页响应

## 🧹 资源管理

```typescript
// 销毁实例，清理所有资源
requestCore.destroy()
```

## 🔍 调试支持

```typescript
// 调试模式
requestCore.setGlobalConfig({ debug: true })
const data = await requestCore.get('/api/data', { debug: true })
```

## 💡 最佳实践

1. **合理使用缓存** - 根据数据更新频率设置适当的TTL
2. **控制并发数量** - 避免对服务器造成压力  
3. **使用链式构建器** - 提高代码可读性和类型安全
4. **处理错误情况** - 合理设置重试策略
5. **监控统计信息** - 通过统计API优化性能