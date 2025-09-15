# 工厂方法

`request-api` 提供了两个主要的工厂方法，用于创建和管理请求相关的实例。

## 🏭 createRequestCore

创建独立的 RequestCore 实例。

### 函数签名

```typescript
function createRequestCore(
  requestor: Requestor,
  options?: {
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
  }
): RequestCore
```

### 参数说明

- **requestor**: Requestor 实现实例（如 `AxiosRequestor` 或 `FetchRequestor`）
- **options**: 可选配置对象
  - `globalConfig`: 全局请求配置
  - `interceptors`: 拦截器数组

### 使用示例

```typescript
import { createRequestCore } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'

// 基础用法
const requestCore = createRequestCore(new AxiosRequestor())

// 带配置的用法
const requestCore = createRequestCore(new AxiosRequestor(), {
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000,
    headers: {
      'Content-Type': 'application/json'
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
```

## 🏗️ createApiClient

创建类型安全的 API 客户端，支持树摇优化。

### 函数签名

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

### 参数说明

- **apis**: API 类的映射对象
- **options**: 配置选项（以下两种方式二选一）
  - 方式一：使用 `requestor` + 可选的 `globalConfig` 和 `interceptors`
  - 方式二：使用已创建的 `requestCore`

### 使用示例

#### 方式一：直接传入 Requestor

```typescript
import { createApiClient } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'

class UserApi {
  constructor(private requestCore: RequestCore) {}
  
  async getUser(id: string) {
    return this.requestCore.get<User>(`/users/${id}`)
  }
}

class ProductApi {
  constructor(private requestCore: RequestCore) {}
  
  async getProducts() {
    return this.requestCore.get<Product[]>('/products')
  }
}

const apiClient = createApiClient({
  user: UserApi,
  product: ProductApi
}, {
  requestor: new AxiosRequestor(),
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000
  },
  interceptors: [
    {
      request: (config) => {
        // 添加认证头
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${getToken()}`
        }
        return config
      }
    }
  ]
})

// 使用 API 客户端
const user = await apiClient.user.getUser('123')
const products = await apiClient.product.getProducts()
```

#### 方式二：使用已有的 RequestCore

```typescript
import { createRequestCore, createApiClient } from 'request-api'
import { FetchRequestor } from 'request-imp-fetch'

// 先创建 RequestCore
const requestCore = createRequestCore(new FetchRequestor(), {
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000
  }
})

// 使用已有的 RequestCore 创建客户端
const apiClient = createApiClient({
  user: UserApi,
  product: ProductApi
}, {
  requestCore
})
```

## 📝 API 客户端增强功能

创建的 API 客户端不仅包含所有定义的 API 实例，还提供额外的管理功能：

### 缓存管理

```typescript
// 清除所有缓存
apiClient.clearCache()

// 清除特定缓存
apiClient.clearCache('users')

// 获取缓存统计
const stats = apiClient.getCacheStats()
```

### 配置管理

```typescript
// 动态更新全局配置
apiClient.setGlobalConfig({
  baseURL: 'https://new-api.example.com',
  timeout: 10000
})
```

### 拦截器管理

```typescript
// 添加拦截器
apiClient.addInterceptor({
  request: (config) => {
    // 请求拦截逻辑
    return config
  },
  response: (response) => {
    // 响应拦截逻辑
    return response
  }
})

// 清除所有拦截器
apiClient.clearInterceptors()
```

### 资源管理

```typescript
// 获取所有统计信息
const allStats = apiClient.getAllStats()

// 销毁客户端（释放资源）
apiClient.destroy()
```

## 🎯 最佳实践

### 1. 合理组织 API 类

```typescript
// ✅ 推荐：按业务模块划分
const apiClient = createApiClient({
  user: UserApi,
  product: ProductApi,
  order: OrderApi,
  payment: PaymentApi
}, options)

// ❌ 不推荐：单个巨大的 API 类
const apiClient = createApiClient({
  api: GiantApi // 包含所有接口
}, options)
```

### 2. 统一错误处理

```typescript
const apiClient = createApiClient(apis, {
  requestor: new AxiosRequestor(),
  interceptors: [
    {
      response: (response) => response,
      responseError: (error) => {
        // 统一错误处理
        if (error.status === 401) {
          // 跳转到登录页
          redirectToLogin()
        }
        throw error
      }
    }
  ]
})
```

### 3. 环境配置管理

```typescript
const apiClient = createApiClient(apis, {
  requestor: new AxiosRequestor(),
  globalConfig: {
    baseURL: process.env.NODE_ENV === 'production' 
      ? 'https://api.example.com'
      : 'http://localhost:3000',
    timeout: 5000
  }
})
```

### 4. 类型安全

```typescript
// 利用 TypeScript 的类型推导
const apiClient = createApiClient({
  user: UserApi,
  product: ProductApi
}, options)

// TypeScript 会自动推导出正确的类型
const user = await apiClient.user.getUser('123') // user: User
const products = await apiClient.product.getProducts() // products: Product[]
```
