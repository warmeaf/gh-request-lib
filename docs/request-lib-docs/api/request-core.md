# 核心层 API

## 📖 概述

`request-core` 是请求库的核心层，采用依赖倒置原则和管理器模式，提供与底层实现无关的高级功能。它通过组合各种专用管理器来实现功能分离，支持缓存、重试、并发等高级特性。

## 🏗️ 核心架构

### RequestCore 类

核心协调器类，通过依赖注入接收实现了 `Requestor` 接口的实例，组合各种管理器提供完整功能。

```typescript
class RequestCore implements ConvenienceExecutor {
  constructor(requestor: Requestor, globalConfig?: GlobalConfig)
}
```

### 管理器组合

| 管理器 | 职责 | 功能 |
|--------|------|------|
| `InterceptorManager` | 拦截器管理 | 请求/响应/错误拦截处理 |
| `ConfigManager` | 配置管理 | 全局配置存储和合并 |
| `RequestExecutor` | 请求执行 | 实际请求的执行和协调 |
| `ConvenienceMethods` | 便利方法 | GET、POST 等快捷方法 |
| `FeatureManager` | 功能管理 | 缓存、重试、并发等高级功能 |

## 🔧 核心接口

### 基础请求方法

#### `request<T>(config: RequestConfig): Promise<T>`

核心请求执行方法，支持完整的配置和拦截器链。

```typescript
// 基础使用
const response = await requestCore.request<User>({
  url: '/api/user/123',
  method: 'GET',
  headers: {
    'Authorization': 'Bearer token'
  }
})

// 带回调监控
const response = await requestCore.request<User>({
  url: '/api/user/123',
  method: 'GET',
  onStart: (config) => console.log('Request started:', config.url),
  onEnd: (config, duration) => console.log('Request completed in', duration, 'ms'),
  onError: (config, error, duration) => console.error('Request failed:', error)
})
```

### HTTP 便利方法

#### GET 请求

```typescript
// 简单 GET 请求
const user = await requestCore.get<User>('/api/user/123')

// 带查询参数
const users = await requestCore.get<User[]>('/api/users', {
  params: { page: 1, limit: 10 }
})
```

#### POST 请求

```typescript
// JSON 数据提交
const newUser = await requestCore.post<User>('/api/users', {
  name: 'John',
  email: 'john@example.com'
})

// 表单数据提交
const result = await requestCore.postForm<ApiResponse>('/api/submit', {
  name: 'John',
  age: 30
})

// JSON 格式明确指定
const result = await requestCore.postJson<ApiResponse>('/api/data', {
  key: 'value'
})
```

#### 其他 HTTP 方法

```typescript
// PUT 请求
const updatedUser = await requestCore.put<User>('/api/user/123', userData)

// DELETE 请求
await requestCore.delete('/api/user/123')

// PATCH 请求
const patchedUser = await requestCore.patch<User>('/api/user/123', { name: 'New Name' })

// HEAD 请求
await requestCore.head('/api/health')

// OPTIONS 请求
const options = await requestCore.options('/api/endpoint')
```

### 链式构建器

#### `create<T>(): RequestBuilder<T>`

创建链式调用构建器，支持流畅的 API 构建。

```typescript
// 基础链式调用
const user = await requestCore.create<User>()
  .url('/api/user/123')
  .method('GET')
  .headers({ 'Authorization': 'Bearer token' })
  .timeout(5000)
  .send()

// 带重试的链式调用
const data = await requestCore.create<ApiResponse>()
  .url('/api/data')
  .method('POST')
  .data({ key: 'value' })
  .retry(3)
  .send()

// 带缓存的链式调用
const cachedData = await requestCore.create<CachedResponse>()
  .url('/api/expensive-data')
  .method('GET')
  .cache(300000) // 缓存5分钟
  .json()
  .send()

// 响应类型转换
const textData = await requestCore.create()
  .url('/api/text-data')
  .text() // 返回 RequestBuilder<string>
  .send()

const blobData = await requestCore.create()
  .url('/api/file')
  .blob() // 返回 RequestBuilder<Blob>
  .send()
```

## 🚀 高级功能

### 重试功能

#### 带重试的请求

```typescript
// 基础重试
const data = await requestCore.requestWithRetry({
  url: '/api/unstable-endpoint',
  method: 'GET'
}, {
  retries: 3,
  delay: 1000
})

// 指数退避重试
const data = await requestCore.requestWithRetry({
  url: '/api/service',
  method: 'POST',
  data: requestData
}, {
  retries: 5,
  delay: 1000,
  backoffFactor: 2, // 每次重试延迟翻倍
  jitter: 0.1 // 10% 抖动
})

// 自定义重试条件
const data = await requestCore.requestWithRetry({
  url: '/api/critical-service',
  method: 'GET'
}, {
  retries: 3,
  shouldRetry: (error, attempt) => {
    // 只重试网络错误和 5xx 错误
    if (error instanceof RequestError) {
      return error.status >= 500 || !error.isHttpError
    }
    return false
  }
})

// 便利重试方法
const userData = await requestCore.getWithRetry<User>('/api/user/123', {
  retries: 3,
  delay: 2000
})

const result = await requestCore.postWithRetry('/api/data', requestData, {
  retries: 5,
  backoffFactor: 1.5
})
```

### 缓存功能

#### 请求缓存

```typescript
// 基础缓存（默认5分钟）
const cachedData = await requestCore.requestWithCache({
  url: '/api/static-data',
  method: 'GET'
})

// 自定义缓存时间
const data = await requestCore.requestWithCache({
  url: '/api/user-profile',
  method: 'GET'
}, {
  ttl: 10 * 60 * 1000, // 缓存10分钟
  key: 'user-profile-123', // 自定义缓存键
  clone: 'deep' // 深拷贝返回数据
})

// 缓存配置选项
const result = await requestCore.requestWithCache({
  url: '/api/data',
  method: 'GET'
}, {
  ttl: 300000, // 5分钟 TTL
  maxEntries: 1000, // 最大缓存条目数
  storageType: StorageType.INDEXED_DB, // 使用 IndexedDB 存储
  clone: 'shallow' // 浅拷贝
})

// GET 缓存便利方法
const userData = await requestCore.getWithCache<User>('/api/user/123', {
  ttl: 15 * 60 * 1000 // 缓存15分钟
})

// 清除缓存
requestCore.clearCache() // 清除所有缓存
requestCore.clearCache('specific-key') // 清除指定键的缓存
```

### 并发功能

#### 并发请求

```typescript
// 基础并发请求
const results = await requestCore.requestConcurrent<User>([
  { url: '/api/user/1', method: 'GET' },
  { url: '/api/user/2', method: 'GET' },
  { url: '/api/user/3', method: 'GET' }
])

// 限制并发数
const results = await requestCore.requestConcurrent<ApiResponse>(
  requestConfigs,
  {
    maxConcurrency: 3, // 最多同时3个请求
    failFast: false, // 不快速失败
    timeout: 30000 // 整体超时30秒
  }
)

// 处理并发结果
results.forEach((result, index) => {
  if (result.success) {
    console.log(`Request ${index} succeeded:`, result.data)
  } else {
    console.error(`Request ${index} failed:`, result.error)
  }
})

// 并发便利方法
const userResults = await requestCore.getConcurrent<User>([
  '/api/user/1',
  '/api/user/2',
  '/api/user/3'
], {
  maxConcurrency: 2
})

const postResults = await requestCore.postConcurrent<ApiResponse>([
  { url: '/api/data/1', data: data1 },
  { url: '/api/data/2', data: data2 }
], {
  failFast: true
})

// 批量请求
const successfulData = await requestCore.batchRequests<User>([
  { url: '/api/user/1', method: 'GET' },
  { url: '/api/user/2', method: 'GET' }
], {
  concurrency: 5,
  ignoreErrors: true // 忽略单个请求的错误
})
```

#### 结果处理

```typescript
// 获取成功结果
const successfulData = requestCore.getSuccessfulResults(results)

// 获取失败结果
const failedResults = requestCore.getFailedResults(results)

// 检查是否有失败
if (requestCore.hasConcurrentFailures(results)) {
  console.log('Some requests failed')
}

// 多次执行同一请求
const multiResults = await requestCore.requestMultiple<Data>({
  url: '/api/test-endpoint',
  method: 'GET'
}, 5, { // 执行5次
  maxConcurrency: 2
})
```

### 组合功能

#### 缓存 + 重试

```typescript
// 先尝试缓存，失败则重试
const data = await requestCore.requestWithCacheAndRetry({
  url: '/api/important-data',
  method: 'GET'
}, {
  cacheConfig: { ttl: 10 * 60 * 1000 }, // 缓存10分钟
  retryConfig: { retries: 3, delay: 1000 } // 重试3次
})
```

## 🔧 配置管理

### 全局配置

```typescript
// 设置全局配置
requestCore.setGlobalConfig({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'User-Agent': 'MyApp/1.0'
  },
  debug: true, // 开启调试模式
  retries: 3, // 全局重试次数
  cacheEnabled: true, // 启用缓存
  interceptors: [authInterceptor, loggingInterceptor]
})

// 获取全局配置
const globalConfig = requestCore.getGlobalConfig()
```

### 拦截器管理

```typescript
// 添加拦截器
const authInterceptor: RequestInterceptor = {
  onRequest: (config) => {
    config.headers = {
      ...config.headers,
      'Authorization': `Bearer ${getToken()}`
    }
    return config
  },
  onResponse: (response, config) => {
    console.log('Response received:', config.url)
    return response
  },
  onError: (error, config) => {
    if (error.status === 401) {
      // 处理认证失败
      redirectToLogin()
    }
    return error
  }
}

requestCore.addInterceptor(authInterceptor)

// 获取所有拦截器
const interceptors = requestCore.getInterceptors()

// 清除所有拦截器
requestCore.clearInterceptors()
```

## 🎯 专用功能

### 文件操作

```typescript
// 文件上传
const uploadResult = await requestCore.uploadFile<UploadResponse>('/api/upload', {
  file: fileFromInput,
  name: 'avatar',
  filename: 'avatar.jpg',
  contentType: 'image/jpeg',
  additionalData: {
    userId: '123',
    category: 'profile'
  },
  onProgress: (progress) => {
    console.log(`Upload progress: ${progress}%`)
  }
})

// 文件下载
const blob = await requestCore.downloadFile('/api/download/report.pdf', 'monthly-report.pdf')
```

### 分页数据

```typescript
// 分页请求
const paginatedUsers = await requestCore.getPaginated<User>('/api/users', {
  page: 1,
  limit: 20
}, {
  headers: { 'Sort': 'name' }
})

console.log('Data:', paginatedUsers.data)
console.log('Total:', paginatedUsers.total)
console.log('Has Next:', paginatedUsers.hasNext)
```

## 📊 监控和统计

### 缓存统计

```typescript
// 获取缓存统计
const cacheStats = requestCore.getCacheStats()
console.log('Cache entries:', cacheStats.size)
console.log('Hit rate:', cacheStats.hitRate)
console.log('Key generator stats:', cacheStats.keyGeneratorStats)
```

### 并发统计

```typescript
// 获取并发统计
const concurrentStats = requestCore.getConcurrentStats()
console.log('Completed requests:', concurrentStats.completed)
console.log('Success rate:', concurrentStats.successful / concurrentStats.total)
console.log('Average duration:', concurrentStats.averageDuration)
```

### 综合统计

```typescript
// 获取所有统计信息
const allStats = requestCore.getAllStats()
console.log('Cache stats:', allStats.cache)
console.log('Concurrent stats:', allStats.concurrent)
console.log('Interceptor stats:', allStats.interceptors)
console.log('Config stats:', allStats.config)
```

## 🔒 类型定义

### 核心接口

```typescript
// 请求配置
interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  data?: RequestData
  params?: RequestParams
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer'
  onStart?: (config: RequestConfig) => void
  onEnd?: (config: RequestConfig, duration: number) => void
  onError?: (config: RequestConfig, error: unknown, duration: number) => void
  debug?: boolean
  tag?: string
  metadata?: Record<string, unknown>
}

// 请求实现者接口
interface Requestor {
  request<T = unknown>(config: RequestConfig): Promise<T>
}

// 全局配置
interface GlobalConfig {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
  debug?: boolean
  retries?: number
  cacheEnabled?: boolean
  interceptors?: RequestInterceptor[]
}

// 拦截器接口
interface RequestInterceptor {
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>
  onResponse?: <T>(response: T, config: RequestConfig) => T | Promise<T>
  onError?: (error: RequestError, config: RequestConfig) => RequestError | Promise<RequestError>
}
```

### 功能配置

```typescript
// 重试配置
interface RetryConfig {
  retries: number
  delay?: number
  backoffFactor?: number
  jitter?: number
  shouldRetry?: (error: unknown, attempt: number) => boolean
}

// 缓存配置
interface CacheConfig {
  ttl?: number
  key?: string
  clone?: 'none' | 'shallow' | 'deep'
  maxEntries?: number
  keyGenerator?: CacheKeyConfig
  storageType?: StorageType
  storageAdapter?: StorageAdapter
  keyStrategy?: CacheKeyStrategy
  invalidationPolicy?: CacheInvalidationPolicy
}

// 并发配置
interface ConcurrentConfig {
  maxConcurrency?: number
  failFast?: boolean
  timeout?: number
  retryOnError?: boolean
}

// 并发结果
interface ConcurrentResult<T> {
  success: boolean
  data?: T
  error?: Error | RequestError | unknown
  config: RequestConfig
  index: number
  duration?: number
  retryCount?: number
}
```

### 错误处理

```typescript
// 错误类
class RequestError extends Error {
  readonly type: RequestErrorType
  readonly context: RequestErrorContext
  readonly suggestion?: string
  readonly code?: string
  readonly status?: number
  readonly isHttpError: boolean
  readonly originalError?: unknown

  toDisplayMessage(): string
  toJSON(): Record<string, unknown>
}

// 错误类型
enum RequestErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  HTTP_ERROR = 'HTTP_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  CONCURRENT_ERROR = 'CONCURRENT_ERROR',
  RETRY_ERROR = 'RETRY_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR'
}

// 错误上下文
interface RequestErrorContext {
  url?: string
  method?: string
  duration?: number
  timestamp: number
  userAgent?: string
  tag?: string
  metadata?: Record<string, unknown>
}
```

### 链式构建器

```typescript
interface RequestBuilder<T = unknown> {
  url(url: string): RequestBuilder<T>
  method(method: RequestConfig['method']): RequestBuilder<T>
  data(data: RequestData): RequestBuilder<T>
  params(params: RequestParams): RequestBuilder<T>
  headers(headers: Record<string, string>): RequestBuilder<T>
  header(key: string, value: string): RequestBuilder<T>
  timeout(ms: number): RequestBuilder<T>
  tag(tag: string): RequestBuilder<T>
  debug(enabled?: boolean): RequestBuilder<T>
  retry(retries: number): RequestBuilder<T>
  cache(ttl?: number): RequestBuilder<T>
  json<U = unknown>(): RequestBuilder<U>
  text(): RequestBuilder<string>
  blob(): RequestBuilder<Blob>
  arrayBuffer(): RequestBuilder<ArrayBuffer>
  send(): Promise<T>
}
```

### 数据类型

```typescript
// 请求参数类型
type RequestParams = Record<string, string | number | boolean | null | undefined>

// 请求数据类型
type RequestData = 
  | Record<string, unknown>
  | string
  | FormData
  | Blob
  | ArrayBuffer
  | URLSearchParams
  | ReadableStream
  | null
  | undefined
  | number
  | boolean

// 文件上传选项
interface FileUploadOptions {
  file: File | Blob
  name?: string
  filename?: string
  contentType?: string
  additionalData?: Record<string, string | number | boolean>
  onProgress?: (progress: number) => void
}

// 分页参数
interface PaginationParams {
  page?: number
  limit?: number
  offset?: number
  size?: number
}

// 分页响应
interface PaginatedResponse<T> {
  data: T[]
  total: number
  page: number
  limit: number
  hasNext: boolean
  hasPrev: boolean
}
```

## 🧹 资源管理

### 销毁和清理

```typescript
// 销毁核心实例，清理所有资源
requestCore.destroy()

// 这会清理：
// - 所有缓存数据
// - 拦截器引用
// - 并发控制资源
// - 配置信息
// - 统计数据
```

## 🔍 调试支持

### 调试模式

```typescript
// 全局调试模式
requestCore.setGlobalConfig({ debug: true })

// 单个请求调试
const data = await requestCore.get('/api/data', { debug: true })

// 链式调用调试
const result = await requestCore.create()
  .url('/api/endpoint')
  .debug(true)
  .tag('important-request') // 添加标签便于日志识别
  .send()
```

## 📈 性能优化建议

### 缓存策略

```typescript
// 对于静态数据，使用长时间缓存
const staticData = await requestCore.getWithCache('/api/config', {
  ttl: 60 * 60 * 1000 // 1小时缓存
})

// 对于频繁访问的数据，使用适中缓存
const userData = await requestCore.getWithCache('/api/user/profile', {
  ttl: 5 * 60 * 1000 // 5分钟缓存
})
```

### 并发控制

```typescript
// 合理控制并发数，避免服务器压力过大
const results = await requestCore.requestConcurrent(configs, {
  maxConcurrency: navigator.hardwareConcurrency || 4
})
```

### 错误重试

```typescript
// 对于非关键请求，减少重试次数
const nonCriticalData = await requestCore.getWithRetry('/api/optional-data', {
  retries: 1
})

// 对于关键请求，使用指数退避
const criticalData = await requestCore.getWithRetry('/api/critical-data', {
  retries: 5,
  delay: 1000,
  backoffFactor: 2
})
```

## 💡 最佳实践

1. **合理使用缓存**：根据数据更新频率设置适当的 TTL
2. **控制并发数量**：避免对服务器造成过大压力
3. **使用链式构建器**：提高代码可读性和类型安全
4. **添加请求标签**：便于调试和日志分析
5. **处理错误情况**：合理设置重试策略和错误处理
6. **监控统计信息**：通过统计 API 优化性能

## 🎉 总结

通过 `request-core` 提供的这些丰富 API，您可以构建出高性能、可靠的请求处理方案。核心层采用依赖倒置原则和管理器模式，确保了代码的可扩展性和可维护性，同时提供了缓存、重试、并发等高级功能特性。