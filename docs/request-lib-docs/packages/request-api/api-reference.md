# API 参考

## 🚀 工厂函数

### createRequestCore

```typescript
function createRequestCore(
  requestor: Requestor,
  options?: {
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
  }
): RequestCore
```

创建独立的 RequestCore 实例。

**参数：**
- `requestor` - 请求实现实例
- `options.globalConfig` - 全局配置（可选）
- `options.interceptors` - 拦截器数组（可选）

**返回值：** RequestCore 实例

---

### createApiClient

```typescript
function createApiClient<T extends Record<string, ApiClass<any>>>(
  apis: T,
  options: {
    requestor?: Requestor
    requestCore?: RequestCore
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
  }
): ApiClient<T>
```

创建类型安全的 API 客户端。

**参数：**
- `apis` - API 类映射对象
- `options.requestor` - 请求实现实例（与 requestCore 二选一）
- `options.requestCore` - RequestCore 实例（与 requestor 二选一）
- `options.globalConfig` - 全局配置（可选）
- `options.interceptors` - 拦截器数组（可选）

**返回值：** 增强的 API 客户端

## 🏷️ 类型定义

### ApiClass

API 类的构造函数接口。

```typescript
interface ApiClass<T extends ApiInstance = ApiInstance> {
  new (requestCore: RequestCore): T
}
```

### ApiInstance

API 实例的基础接口。

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
  // 缓存管理
  clearCache(key?: string): void
  getCacheStats(): any
  
  // 配置管理
  setGlobalConfig(config: GlobalConfig): void
  
  // 拦截器管理
  addInterceptor(interceptor: RequestInterceptor): void
  clearInterceptors(): void
  
  // 实用方法
  destroy(): void
  getAllStats(): any
}
```

## 📋 API 客户端方法

### 缓存管理

#### clearCache(key?: string): void

清除缓存数据。

**参数：**
- `key` - 缓存键（可选），不提供则清除所有缓存

**示例：**
```typescript
apiClient.clearCache() // 清除所有缓存
apiClient.clearCache('users') // 清除指定缓存
```

---

#### getCacheStats(): any

获取缓存统计信息。

**返回值：** 缓存统计对象

**示例：**
```typescript
const stats = apiClient.getCacheStats()
console.log('Hit rate:', stats.hitRate)
console.log('Total requests:', stats.totalRequests)
```

### 配置管理

#### setGlobalConfig(config: GlobalConfig): void

设置全局配置。

**参数：**
- `config` - 全局配置对象

**示例：**
```typescript
apiClient.setGlobalConfig({
  baseURL: 'https://new-api.example.com',
  timeout: 10000,
  headers: {
    'Authorization': 'Bearer new-token'
  }
})
```

### 拦截器管理

#### addInterceptor(interceptor: RequestInterceptor): void

添加请求/响应拦截器。

**参数：**
- `interceptor` - 拦截器对象

**示例：**
```typescript
apiClient.addInterceptor({
  request: (config) => {
    console.log('Request intercepted:', config)
    return config
  },
  response: (response) => {
    console.log('Response intercepted:', response)
    return response
  },
  requestError: (error) => {
    console.error('Request error:', error)
    throw error
  },
  responseError: (error) => {
    console.error('Response error:', error)
    throw error
  }
})
```

---

#### clearInterceptors(): void

清除所有拦截器。

**示例：**
```typescript
apiClient.clearInterceptors()
```

### 实用方法

#### destroy(): void

销毁 API 客户端，释放所有资源。

**示例：**
```typescript
// 在应用卸载时调用
apiClient.destroy()
```

---

#### getAllStats(): any

获取所有统计信息。

**返回值：** 包含各种统计信息的对象

**示例：**
```typescript
const stats = apiClient.getAllStats()
console.log('Cache stats:', stats.cache)
console.log('Request stats:', stats.requests)
console.log('Error stats:', stats.errors)
```

## 🔄 重导出类型

从 `request-core` 重导出的类型：

### RequestCore
```typescript
export type { RequestCore } from 'request-core'
```

### PaginatedResponse
```typescript
export type { PaginatedResponse } from 'request-core'
```

### RestfulOptions
```typescript
export type { RestfulOptions } from 'request-core'
```

### RequestError
```typescript
export { RequestError } from 'request-core'
```

### RequestErrorType
```typescript
export { RequestErrorType } from 'request-core'
```

## 💡 使用示例

### 完整的 API 类定义

```typescript
import type { RequestCore } from 'request-api'

interface User {
  id: string
  name: string
  email: string
}

interface CreateUserRequest {
  name: string
  email: string
}

class UserApi {
  constructor(private requestCore: RequestCore) {}
  
  async getUser(id: string): Promise<User> {
    return this.requestCore.get<User>(`/users/${id}`)
  }
  
  async getUsers(): Promise<User[]> {
    return this.requestCore.get<User[]>('/users')
  }
  
  async createUser(data: CreateUserRequest): Promise<User> {
    return this.requestCore.post<User>('/users', data)
  }
  
  async updateUser(id: string, data: Partial<User>): Promise<User> {
    return this.requestCore.put<User>(`/users/${id}`, data)
  }
  
  async deleteUser(id: string): Promise<void> {
    return this.requestCore.delete(`/users/${id}`)
  }
  
  // 使用高级功能
  async getUserWithCache(id: string): Promise<User> {
    return this.requestCore.getWithCache<User>(`/users/${id}`, {
      ttl: 300000 // 5分钟缓存
    })
  }
  
  async getUserWithRetry(id: string): Promise<User> {
    return this.requestCore.getWithRetry<User>(`/users/${id}`, 3)
  }
}
```

### 客户端创建和使用

```typescript
import { createApiClient } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'

// 创建客户端
const apiClient = createApiClient({
  user: UserApi
}, {
  requestor: new AxiosRequestor(),
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000
  }
})

// 使用 API
async function example() {
  try {
    // 基础操作
    const users = await apiClient.user.getUsers()
    const user = await apiClient.user.getUser('123')
    
    // 创建用户
    const newUser = await apiClient.user.createUser({
      name: 'John Doe',
      email: 'john@example.com'
    })
    
    // 更新用户
    const updatedUser = await apiClient.user.updateUser('123', {
      name: 'Jane Doe'
    })
    
    // 删除用户
    await apiClient.user.deleteUser('123')
    
    // 使用缓存
    const cachedUser = await apiClient.user.getUserWithCache('456')
    
    // 使用重试
    const userWithRetry = await apiClient.user.getUserWithRetry('789')
    
  } catch (error) {
    console.error('API call failed:', error)
  }
}
```
