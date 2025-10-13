# 基础请求 API

本文档介绍 `request-api` 提供的基础请求 API，包括如何创建 API 客户端、定义 API 类以及使用各种 HTTP 请求方法。

## 核心概念

### API 类定义

API 类是封装特定业务逻辑的类，通过构造函数接收 `RequestCore` 实例来发起请求。

```typescript
import { type RequestCore } from 'request-api'

class UserApi {
  constructor(public requestCore: RequestCore) {}

  // 定义业务方法
  async getUser(id: string) {
    return this.requestCore.get(`/users/${id}`)
  }

  async createUser(data: any) {
    return this.requestCore.post('/users', data)
  }
}
```

### 创建 API 客户端

使用 `createApiClient` 工厂方法创建包含多个 API 实例的客户端对象。

```typescript
import { createApiClient } from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

// 创建 API 客户端
const apiClient = createApiClient(
  {
    user: UserApi,
    product: ProductApi,
  },
  {
    requestor: createAxiosRequestor({
      baseURL: 'https://api.example.com',
    }),
    globalConfig: {
      timeout: 5000,
    },
  }
)

// 使用 API 客户端
const user = await apiClient.user.getUser('123')
```

## API 参考

### createApiClient

创建增强的 API 客户端对象。

#### 类型签名

```typescript
function createApiClient<T extends Record<string, ApiClass<any>>>(
  apis: T,
  options: ApiClientOptions
): ApiClient<T>
```

#### 参数

**apis**

- 类型: `Record<string, ApiClass>`
- 必填: 是
- 说明: API 类的映射对象，key 为 API 名称，value 为 API 类构造函数

**options**

- 类型: `ApiClientOptions`
- 必填: 是
- 说明: 创建选项

```typescript
interface ApiClientOptions {
  // 请求执行器（推荐使用，二选一）
  requestor?: Requestor

  // RequestCore 实例（高级用法，二选一）
  requestCore?: RequestCore

  // 全局配置（可选）
  globalConfig?: GlobalConfig

  // 拦截器数组（可选）
  interceptors?: RequestInterceptor[]
}
```

#### 返回值

返回一个增强的 API 客户端对象，包含：

- 所有 API 实例（根据 `apis` 参数的 key）
- 缓存管理方法
- 配置管理方法
- 拦截器管理方法
- 生命周期管理方法

### ApiClient 实例方法

#### 缓存管理

**clearCache(key?: string): void**

清除缓存数据。

- `key` (可选): 指定要清除的缓存键，不提供则清除所有缓存

```typescript
// 清除所有缓存
apiClient.clearCache()

// 清除特定缓存
apiClient.clearCache('user-123')
```

**getCacheStats(): any**

获取缓存统计信息。

```typescript
const stats = apiClient.getCacheStats()
console.log(stats)
```

#### 配置管理

**setGlobalConfig(config: GlobalConfig): void**

设置全局配置。

```typescript
apiClient.setGlobalConfig({
  timeout: 10000,
  baseURL: 'https://api.example.com',
  headers: {
    'Content-Type': 'application/json',
  },
})
```

#### 拦截器管理

**addInterceptor(interceptor: RequestInterceptor): void**

添加请求/响应拦截器。

```typescript
apiClient.addInterceptor({
  onRequest: async (config) => {
    // 请求前处理
    console.log('Request:', config)
    return config
  },
  onResponse: async (response) => {
    // 响应后处理
    console.log('Response:', response)
    return response
  },
  onError: (error) => {
    // 错误处理
    console.error('Error:', error)
  },
})
```

**clearInterceptors(): void**

清除所有拦截器。

```typescript
apiClient.clearInterceptors()
```

#### 其他方法

**getAllStats(): any**

获取所有统计信息。

```typescript
const stats = apiClient.getAllStats()
console.log(stats)
```

**destroy(): void**

销毁客户端，清理所有资源。

```typescript
apiClient.destroy()
```

## RequestCore 基础方法

在 API 类中，通过 `requestCore` 实例可以使用以下基础请求方法。

### request

基础请求方法，所有其他方法的底层实现。

```typescript
async request<T>(config: RequestConfig): Promise<T>
```

**参数**

```typescript
interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  data?: any
  params?: Record<string, string | number | boolean>
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer'
  debug?: boolean
  tag?: string
  metadata?: Record<string, unknown>
}
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.request({
      url: `/users/${id}`,
      method: 'GET',
      timeout: 5000,
    })
  }
}
```

### HTTP 方法快捷方式

#### get

发起 GET 请求。

```typescript
async get<T>(url: string, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get(`/users/${id}`)
  }

  async getUserWithParams(id: string) {
    return this.requestCore.get(`/users/${id}`, {
      params: { include: 'profile' },
      timeout: 3000,
    })
  }
}
```

#### post

发起 POST 请求。

```typescript
async post<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async createUser(userData: any) {
    return this.requestCore.post('/users', userData)
  }

  async createUserWithHeaders(userData: any) {
    return this.requestCore.post('/users', userData, {
      headers: {
        'X-Custom-Header': 'value',
      },
    })
  }
}
```

#### put

发起 PUT 请求。

```typescript
async put<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async updateUser(id: string, userData: any) {
    return this.requestCore.put(`/users/${id}`, userData)
  }
}
```

#### delete

发起 DELETE 请求。

```typescript
async delete<T>(url: string, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async deleteUser(id: string) {
    return this.requestCore.delete(`/users/${id}`)
  }
}
```

#### patch

发起 PATCH 请求。

```typescript
async patch<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async patchUser(id: string, partialData: any) {
    return this.requestCore.patch(`/users/${id}`, partialData)
  }
}
```

#### head

发起 HEAD 请求。

```typescript
async head(url: string, config?: Partial<RequestConfig>): Promise<void>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async checkUserExists(id: string) {
    try {
      await this.requestCore.head(`/users/${id}`)
      return true
    } catch {
      return false
    }
  }
}
```

#### options

发起 OPTIONS 请求。

```typescript
async options<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUserOptions() {
    return this.requestCore.options('/users')
  }
}
```

## 完整示例

### 基础使用

```typescript
import { createApiClient, type RequestCore } from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

// 1. 定义 API 类
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get(`/users/${id}`)
  }

  async listUsers(params?: { page?: number; limit?: number }) {
    return this.requestCore.get('/users', { params })
  }

  async createUser(data: any) {
    return this.requestCore.post('/users', data)
  }

  async updateUser(id: string, data: any) {
    return this.requestCore.put(`/users/${id}`, data)
  }

  async deleteUser(id: string) {
    return this.requestCore.delete(`/users/${id}`)
  }
}

class ProductApi {
  constructor(public requestCore: RequestCore) {}

  async getProducts() {
    return this.requestCore.get('/products')
  }

  async getProduct(id: string) {
    return this.requestCore.get(`/products/${id}`)
  }
}

// 2. 创建请求执行器
const requestor = createAxiosRequestor({
  baseURL: 'https://api.example.com',
})

// 3. 创建 API 客户端
const apiClient = createApiClient(
  {
    user: UserApi,
    product: ProductApi,
  },
  {
    requestor,
    globalConfig: {
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    },
  }
)

// 4. 使用 API
async function main() {
  // GET 请求
  const user = await apiClient.user.getUser('123')

  // GET 带参数
  const users = await apiClient.user.listUsers({ page: 1, limit: 10 })

  // POST 请求
  const newUser = await apiClient.user.createUser({
    name: 'John',
    email: 'john@example.com',
  })

  // PUT 请求
  const updatedUser = await apiClient.user.updateUser('123', {
    name: 'John Doe',
  })

  // DELETE 请求
  await apiClient.user.deleteUser('123')

  // 其他 API
  const products = await apiClient.product.getProducts()
}
```

### 使用拦截器

```typescript
import {
  createApiClient,
  type RequestCore,
  type RequestInterceptor,
} from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get(`/users/${id}`)
  }
}

// 认证拦截器
const authInterceptor: RequestInterceptor = {
  onRequest: async (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${token}`,
      }
    }
    return config
  },
}

// 日志拦截器
const loggingInterceptor: RequestInterceptor = {
  onRequest: async (config) => {
    console.log('[Request]', config.method, config.url)
    return config
  },
  onResponse: async (response) => {
    console.log('[Response]', response)
    return response
  },
  onError: (error) => {
    console.error('[Error]', error.message)
  },
}

// 创建带拦截器的客户端
const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: createAxiosRequestor(),
    interceptors: [authInterceptor, loggingInterceptor],
  }
)

// 动态添加拦截器
apiClient.addInterceptor({
  onRequest: async (config) => {
    config.headers = {
      ...config.headers,
      'X-Request-Time': Date.now().toString(),
    }
    return config
  },
})
```

### 错误处理

```typescript
import {
  createApiClient,
  type RequestCore,
  RequestError,
  RequestErrorType,
} from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get(`/users/${id}`)
  }
}

const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: createAxiosRequestor(),
  }
)

// 使用 try-catch 处理错误
async function getUserSafely(id: string) {
  try {
    const user = await apiClient.user.getUser(id)
    return { success: true, data: user }
  } catch (error) {
    if (error instanceof RequestError) {
      console.error('Request Error Type:', error.type)
      console.error('Status:', error.status)
      console.error('Message:', error.message)
      console.error('Suggestion:', error.suggestion)

      // 根据错误类型处理
      switch (error.type) {
        case RequestErrorType.NETWORK_ERROR:
          return { success: false, error: 'Network connection failed' }
        case RequestErrorType.TIMEOUT_ERROR:
          return { success: false, error: 'Request timeout' }
        case RequestErrorType.HTTP_ERROR:
          if (error.status === 404) {
            return { success: false, error: 'User not found' }
          }
          return { success: false, error: 'Server error' }
        default:
          return { success: false, error: 'Unknown error' }
      }
    }
    return { success: false, error: 'Unexpected error' }
  }
}
```

## 类型定义

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

### ApiClientOptions

API 客户端创建选项。

```typescript
interface ApiClientOptions {
  requestor?: Requestor
  requestCore?: RequestCore
  globalConfig?: GlobalConfig
  interceptors?: RequestInterceptor[]
}
```

### GlobalConfig

全局配置接口。

```typescript
interface GlobalConfig {
  baseURL?: string
  timeout?: number
  headers?: Record<string, string>
  debug?: boolean
  retries?: number
  cacheEnabled?: boolean
  interceptors?: RequestInterceptor[]
  idempotentEnabled?: boolean
  idempotentTtl?: number
  idempotentMethods?: string[]
}
```

### RequestInterceptor

拦截器接口。

```typescript
interface RequestInterceptor {
  onRequest?: (config: RequestConfig) => RequestConfig | Promise<RequestConfig>
  onResponse?: <T>(response: T, config: RequestConfig) => T | Promise<T>
  onError?: (error: RequestError, config: RequestConfig) => any
}
```

### RequestError

增强的请求错误类。

```typescript
class RequestError extends Error {
  type: RequestErrorType
  status?: number
  isHttpError: boolean
  suggestion?: string
  code?: string
  context: RequestErrorContext
  originalError?: unknown

  toDisplayMessage(): string
  toJSON(): Record<string, unknown>
}
```

### RequestErrorType

错误类型枚举。

```typescript
enum RequestErrorType {
  NETWORK_ERROR = 'NETWORK_ERROR',
  HTTP_ERROR = 'HTTP_ERROR',
  TIMEOUT_ERROR = 'TIMEOUT_ERROR',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  CACHE_ERROR = 'CACHE_ERROR',
  CONCURRENT_ERROR = 'CONCURRENT_ERROR',
  RETRY_ERROR = 'RETRY_ERROR',
  UNKNOWN_ERROR = 'UNKNOWN_ERROR',
}
```

## 最佳实践

### 1. API 类组织

按业务模块组织 API 类，每个类负责一个特定的业务领域。

```typescript
// 用户相关 API
class UserApi {
  constructor(public requestCore: RequestCore) {}
  // 用户相关方法
}

// 产品相关 API
class ProductApi {
  constructor(public requestCore: RequestCore) {}
  // 产品相关方法
}

// 订单相关 API
class OrderApi {
  constructor(public requestCore: RequestCore) {}
  // 订单相关方法
}
```

### 2. 统一错误处理

在拦截器中统一处理错误。

```typescript
const errorInterceptor: RequestInterceptor = {
  onError: (error) => {
    if (error instanceof RequestError) {
      // 统一错误处理逻辑
      if (error.status === 401) {
        // 处理未授权
        redirectToLogin()
      } else if (error.status === 500) {
        // 显示服务器错误
        showErrorMessage('Server error occurred')
      }
    }
  },
}
```

### 3. 类型安全

为 API 方法定义明确的返回类型。

```typescript
interface User {
  id: string
  name: string
  email: string
}

interface CreateUserDTO {
  name: string
  email: string
  password: string
}

class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string): Promise<User> {
    return this.requestCore.get<User>(`/users/${id}`)
  }

  async createUser(data: CreateUserDTO): Promise<User> {
    return this.requestCore.post<User>('/users', data)
  }
}
```

### 4. 配置复用

在创建客户端时设置合理的全局配置。

```typescript
const apiClient = createApiClient(apis, {
  requestor: createAxiosRequestor({
    baseURL: process.env.API_BASE_URL,
  }),
  globalConfig: {
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
    },
  },
})
```

### 5. 单例模式

在应用中使用单例模式管理 API 客户端。

```typescript
// api-client.ts
let apiClientInstance: ApiClient<any> | null = null

export function getApiClient() {
  if (!apiClientInstance) {
    apiClientInstance = createApiClient(
      {
        user: UserApi,
        product: ProductApi,
      },
      {
        requestor: createAxiosRequestor(),
        globalConfig: {
          timeout: 5000,
        },
      }
    )
  }
  return apiClientInstance
}

// 在应用中使用
import { getApiClient } from './api-client'

const apiClient = getApiClient()
const user = await apiClient.user.getUser('123')
```

## 相关文档

- [缓存 API](./caching.md) - 缓存请求和响应
- [重试 API](./retry-logic.md) - 自动重试失败的请求
- [并发 API](./concurrent-requests.md) - 并发请求管理
- [幂等 API](./idempotent-requests.md) - 幂等请求保护
- [串行 API](./serial-requests.md) - 串行请求队列
