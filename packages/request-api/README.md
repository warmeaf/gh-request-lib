# request-api

业务层 API 客户端工厂，提供类型安全的 API 管理和工厂方法。

## 功能特性

- ✅ 工厂方法支持树摇优化
- ✅ 类型安全的 API 客户端创建
- ✅ 基于 RequestCore 的统一请求管理
- ✅ 支持多种请求实现（通过 Requestor 接口）
- ✅ 统一的错误处理和拦截器
- ✅ 缓存、重试、并发等特性
- ✅ 全局配置和拦截器管理
- ✅ 灵活的资源管理

## 使用方法

### 基础用法（推荐）

```typescript
import { createApiClient, createRequestCore } from 'request-api'
import type { RequestCore } from 'request-api'
// 导入具体的 requestor 实现
import { AxiosRequestor } from 'request-imp-axios'

// 定义 API 类
class UserApi {
  constructor(private requestCore: RequestCore) {}
  
  async getUser(id: string) {
    return this.requestCore.get<User>(`/users/${id}`)
  }
  
  async createUser(userData: CreateUserRequest) {
    return this.requestCore.post<User>('/users', userData)
  }
}

class ProductApi {
  constructor(private requestCore: RequestCore) {}
  
  async getProducts() {
    return this.requestCore.get<Product[]>('/products')
  }
  
  async getProduct(id: string) {
    return this.requestCore.get<Product>(`/products/${id}`)
  }
}

// 方式一：直接传入 requestor 实例
const apiClient = createApiClient({
  user: UserApi,
  product: ProductApi
}, {
  requestor: new AxiosRequestor(),
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000
  }
})

// 使用
const user = await apiClient.user.getUser('123')
const products = await apiClient.product.getProducts()
```

### 使用已有的 RequestCore 实例

```typescript
import { createRequestCore, createApiClient } from 'request-api'
import { FetchRequestor } from 'request-imp-fetch'

// 先创建 RequestCore 实例
const requestCore = createRequestCore(new FetchRequestor(), {
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000,
    headers: {
      'Authorization': 'Bearer your-token'
    }
  },
  interceptors: [
    {
      request: (config) => {
        console.log('Request:', config)
        return config
      },
      response: (response) => {
        console.log('Response:', response)
        return response
      }
    }
  ]
})

// 使用已有的 RequestCore 创建客户端
const apiClient = createApiClient({
  user: UserApi,
  product: ProductApi
}, {
  requestCore
})
```

## API 参考

### 核心函数

#### createRequestCore(requestor, options?)
创建 RequestCore 实例。

**参数:**
- `requestor`: Requestor 实现实例（如 AxiosRequestor 或 FetchRequestor）
- `options`: 可选配置选项
  - `globalConfig`: 全局配置对象
  - `interceptors`: 拦截器数组

**返回值:** RequestCore 实例

```typescript
const requestCore = createRequestCore(new AxiosRequestor(), {
  globalConfig: { baseURL: 'https://api.example.com' },
  interceptors: [{ request: (config) => config }]
})
```

#### createApiClient(apis, options)
创建类型安全的 API 客户端对象，支持树摇优化。

**参数:**
- `apis`: API 类的映射对象
- `options`: 配置选项（二选一）
  - `requestor`: Requestor 实现实例
  - `requestCore`: 已创建的 RequestCore 实例
  - `globalConfig`: 全局配置（仅在使用 requestor 时有效）
  - `interceptors`: 拦截器数组（仅在使用 requestor 时有效）

**返回值:** 增强的 API 客户端对象

```typescript
const apiClient = createApiClient({
  user: UserApi,
  product: ProductApi
}, {
  requestor: new FetchRequestor(),
  globalConfig: { baseURL: 'https://api.example.com' }
})
```

### API 客户端方法

创建的 API 客户端除了包含所有定义的 API 实例外，还提供以下管理方法：

#### clearCache(key?)
清除缓存。

**参数:**
- `key`: 可选，缓存键。不传则清除所有缓存

```typescript
apiClient.clearCache() // 清除所有缓存
apiClient.clearCache('users') // 清除特定缓存
```

#### getCacheStats()
获取缓存统计信息。

**返回值:** 缓存统计对象

```typescript
const stats = apiClient.getCacheStats()
console.log('Cache hit rate:', stats.hitRate)
```

#### setGlobalConfig(config)
设置全局配置。

**参数:**
- `config`: 全局配置对象

```typescript
apiClient.setGlobalConfig({
  timeout: 10000,
  headers: { 'Authorization': 'Bearer new-token' }
})
```

#### addInterceptor(interceptor)
添加拦截器。

**参数:**
- `interceptor`: 拦截器对象

```typescript
apiClient.addInterceptor({
  request: (config) => {
    console.log('Outgoing request:', config)
    return config
  }
})
```

#### clearInterceptors()
清除所有拦截器。

```typescript
apiClient.clearInterceptors()
```

#### destroy()
销毁客户端，清理资源。

```typescript
apiClient.destroy()
```

#### getAllStats()
获取所有统计信息。

**返回值:** 包含各种统计信息的对象

```typescript
const allStats = apiClient.getAllStats()
console.log('Request count:', allStats.requestCount)
console.log('Error count:', allStats.errorCount)
```

### 类型定义

#### ApiClass<T>
API 类的接口定义。

```typescript
interface ApiClass<T extends ApiInstance = ApiInstance> {
  new (requestCore: RequestCore): T
}
```

#### ApiInstance
API 实例的接口定义。

```typescript
interface ApiInstance {
  requestCore: RequestCore
  [key: string]: any
}
```

#### ApiClient<T>
增强的 API 客户端类型，包含所有 API 实例和管理方法。

```typescript
type ApiClient<T extends Record<string, ApiClass<any>>> = {
  [K in keyof T]: InstanceType<T[K]>
} & {
  clearCache(key?: string): void
  getCacheStats(): any
  setGlobalConfig(config: GlobalConfig): void
  addInterceptor(interceptor: RequestInterceptor): void
  clearInterceptors(): void
  destroy(): void
  getAllStats(): any
}
```

## 错误处理

request-api 基于 request-core，使用统一的错误处理机制。所有错误都是 `RequestError` 类型，包含详细的错误信息和建议。

```typescript
import { RequestError, RequestErrorType } from 'request-api'

try {
  const user = await apiClient.user.getUser('123')
} catch (error) {
  if (error instanceof RequestError) {
    console.log('Error type:', error.type)
    console.log('Error message:', error.message)
    console.log('Suggestion:', error.suggestion)
  }
}
```

## 高级用法

### 动态配置管理

```typescript
// 运行时更新配置
apiClient.setGlobalConfig({
  baseURL: process.env.NODE_ENV === 'production' 
    ? 'https://prod-api.example.com'
    : 'https://dev-api.example.com',
  headers: {
    'Authorization': `Bearer ${getAuthToken()}`
  }
})

// 添加请求拦截器
apiClient.addInterceptor({
  request: (config) => {
    // 添加时间戳或签名
    config.params = { ...config.params, timestamp: Date.now() }
    return config
  },
  response: (response) => {
    // 统一处理响应格式
    return response.data
  }
})
```

### 缓存管理

```typescript
// 获取缓存统计信息
const cacheStats = apiClient.getCacheStats()
console.log('Cache stats:', cacheStats)

// 清理特定缓存
apiClient.clearCache('/api/users')

// 定期清理缓存
setInterval(() => {
  apiClient.clearCache()
}, 5 * 60 * 1000) // 5分钟清理一次
```

### 资源清理

```typescript
// 组件销毁时清理资源
useEffect(() => {
  return () => {
    apiClient.destroy()
  }
}, [])
```

## 最佳实践

1. **始终使用工厂方法**：`createApiClient` 支持树摇优化，减少打包体积
2. **合理选择 Requestor**：根据项目需求选择 axios 或 fetch 实现
3. **及时清理资源**：在应用销毁时调用 `destroy()` 方法清理资源
4. **统一错误处理**：在拦截器中添加全局错误处理逻辑
5. **合理配置缓存**：根据业务场景设置合适的缓存时间和策略
6. **类型安全**：充分利用 TypeScript 类型系统，确保 API 调用的类型安全
7. **按功能分组**：将相关的 API 组织到同一个类中，便于管理和维护