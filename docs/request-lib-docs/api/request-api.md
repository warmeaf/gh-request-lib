# API层 API

## 📖 概述

`request-api` 是请求库的 API 层，作为上层业务代码与底层请求实现之间的桥梁。它提供了类型安全的 API 客户端创建、工厂方法和统一的配置管理，支持多种使用模式以满足不同的业务需求。

## 🏗️ 核心特性

- ✅ 工厂方法支持树摇优化
- ✅ 类型安全的 API 客户端创建
- ✅ 基于 RequestCore 的统一请求管理
- ✅ 支持多种请求实现（通过 Requestor 接口）
- ✅ 统一的错误处理和拦截器
- ✅ 缓存、重试、并发等特性
- ✅ 全局配置和拦截器管理
- ✅ 灵活的资源管理

## 🚀 创建和初始化

### 工厂方法（推荐）

#### `createApiClient<T>(apis, options)`

创建类型安全的 API 客户端，**支持树摇优化**，适合生产环境使用。

```typescript
import { createApiClient } from 'request-api'
import type { RequestCore } from 'request-api'
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

// 创建 API 客户端
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

## 📚 API 参考

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

```typescript
const stats = apiClient.getCacheStats()
console.log('Cache stats:', stats)
```

#### setGlobalConfig(config)
设置全局配置。

```typescript
apiClient.setGlobalConfig({
  baseURL: 'https://new-api.example.com',
  timeout: 10000
})
```

#### addInterceptor(interceptor)
添加拦截器。

```typescript
apiClient.addInterceptor({
  request: (config) => {
    // 请求拦截
    return config
  },
  response: (response) => {
    // 响应拦截
    return response
  }
})
```

#### clearInterceptors()
清除所有拦截器。

```typescript
apiClient.clearInterceptors()
```

#### destroy()
销毁客户端，释放资源。

```typescript
apiClient.destroy()
```

#### getAllStats()
获取所有统计信息。

```typescript
const stats = apiClient.getAllStats()
console.log('All stats:', stats)
```

## 💡 类型定义

### ApiClass
API 类的接口定义。

```typescript
interface ApiClass<T extends ApiInstance = ApiInstance> {
  new (requestCore: RequestCore): T
}
```

### ApiInstance
API 实例的接口定义。

```typescript
interface ApiInstance {
  requestCore: RequestCore
  [key: string]: any
}
```

### ApiClient
增强的 API 客户端类型。

```typescript
type ApiClient<T extends Record<string, ApiClass<any>>> = {
  [K in keyof T]: InstanceType<T[K]>
} & {
  // 缓存管理功能
  clearCache(key?: string): void
  getCacheStats(): any
  // 全局配置管理
  setGlobalConfig(config: GlobalConfig): void
  // 拦截器管理
  addInterceptor(interceptor: RequestInterceptor): void
  clearInterceptors(): void
  // 实用方法
  destroy(): void
  getAllStats(): any
}
```

## 🔄 与其他层的集成

### 与 request-core 集成
request-api 依赖 request-core 提供的核心功能：

```typescript
import type { RequestCore, GlobalConfig, RequestInterceptor } from 'request-core'
```

### 与实现层集成
支持所有 request-imp-* 实现：

```typescript
import { AxiosRequestor } from 'request-imp-axios'
import { FetchRequestor } from 'request-imp-fetch'
```

## 🎯 最佳实践

### 1. API 类设计

```typescript
// ✅ 推荐：清晰的职责分离
class UserApi {
  constructor(private requestCore: RequestCore) {}
  
  async getUser(id: string) {
    return this.requestCore.get<User>(`/users/${id}`)
  }
  
  async updateUser(id: string, data: Partial<User>) {
    return this.requestCore.put<User>(`/users/${id}`, data)
  }
}
```

### 2. 错误处理

```typescript
try {
  const user = await apiClient.user.getUser('123')
  console.log(user)
} catch (error) {
  if (error instanceof RequestError) {
    console.error('Request failed:', error.message)
  }
}
```

### 3. 配置管理

```typescript
// 统一配置管理
const apiClient = createApiClient(apis, {
  requestor: new AxiosRequestor(),
  globalConfig: {
    baseURL: process.env.API_BASE_URL,
    timeout: 5000,
    headers: {
      'Authorization': `Bearer ${token}`
    }
  }
})
```

## 🚀 性能优化

### 树摇优化
request-api 设计为支持树摇优化，只导入您实际使用的功能：

```typescript
// 只导入需要的部分
import { createApiClient } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'
```

### 资源管理
及时清理资源以避免内存泄漏：

```typescript
// 在组件卸载时清理
useEffect(() => {
  return () => {
    apiClient.destroy()
  }
}, [])
```
