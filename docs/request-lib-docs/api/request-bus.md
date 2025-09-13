# 业务层 API

## 📖 概述

`request-bus` 是请求库的业务层，作为上层业务代码与底层请求实现之间的桥梁。它提供了统一的 API 管理机制、工厂方法、配置管理和开发者工具，支持多种使用模式以满足不同的业务需求。

## 🏗️ 核心架构

### RequestBus 类

业务层核心管理器，提供 API 注册、管理、配置和调试功能。

```typescript
class RequestBus {
  constructor(requestCore: RequestCore)
  
  // API 管理
  register<T>(name: string, apiClass: ApiClass<T>, options?: RegisterOptions): T
  getApi<T>(name: string): T | undefined
  requireApi<T>(name: string): T
  deleteApi(name: string): boolean
  deleteAllApi(): number
  
  // 实现切换
  switchImplementation(implementation: RequestImplementation, options?: SwitchOptions): void
  
  // 配置管理
  setGlobalConfig(config: GlobalConfig): void
  addInterceptor(interceptor: RequestInterceptor): void
  clearInterceptors(): void
  
  // 开发者工具
  listApiNames(): string[]
  getApiInfo(name?: string): any
  getAllStats(): any
  setDebugMode(enabled: boolean): void
  help(): void
  destroy(): void
}
```

### 工厂模式

提供多种创建方式，支持不同的使用场景和优化需求。

```typescript
// 核心工厂类
class RequestCoreFactory {
  static create(implementation: RequestImplementation): RequestCore
}

class RequestBusFactory {
  static create(implementation: RequestImplementation, options?: any): RequestBus
}
```

## 🚀 创建和初始化

### 工厂方法（推荐）

#### `createApiClient<T>(apis, options)`

创建类型安全的 API 客户端，**支持树摇优化**，适合生产环境使用。

```typescript
import { createApiClient } from 'request-bus'

// 定义 API 类
class UserApi {
  constructor(private core: RequestCore) {}
  
  async getUser(id: string): Promise<User> {
    return this.core.get<User>(`/api/users/${id}`)
  }
  
  async createUser(userData: CreateUserRequest): Promise<User> {
    return this.core.post<User>('/api/users', userData)
  }
}

class ProductApi {
  constructor(private core: RequestCore) {}
  
  async getProducts(params?: ProductListParams): Promise<Product[]> {
    return this.core.get<Product[]>('/api/products', { params })
  }
}

// 创建类型安全的客户端
const apiClient = createApiClient({
  user: UserApi,
  product: ProductApi
}, {
  implementation: 'axios', // 或 'fetch'
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  },
  interceptors: [authInterceptor, loggingInterceptor]
})

// 使用 - 完全类型安全
const user = await apiClient.user.getUser('123')
const products = await apiClient.product.getProducts({ category: 'electronics' })
```

#### `createRequestBus(implementation, options)`

创建 RequestBus 实例，适合需要动态管理 API 的场景。

```typescript
import { createRequestBus } from 'request-bus'

const bus = createRequestBus('fetch', {
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000,
    debug: true
  }
})

// 注册 API
bus.register('user', UserApi, {
  description: 'User management API',
  tags: ['auth', 'user']
})

// 使用
const userApi = bus.requireApi<UserApi>('user')
const user = await userApi.getUser('123')
```

#### `createRequestCore(implementation, options)`

创建独立的 RequestCore 实例。

```typescript
import { createRequestCore } from 'request-bus'

const core = createRequestCore('axios', {
  globalConfig: {
    baseURL: 'https://api.example.com'
  }
})

// 直接使用核心功能
const data = await core.get<any>('/api/data')
const result = await core.post<any>('/api/submit', { key: 'value' })
```

## 🔧 API 管理

### API 注册

#### `register<T>(name, apiClass, options?)`

注册 API 类到业务总线中。

```typescript
interface RegisterOptions {
  override?: boolean      // 是否覆盖已存在的 API
  tags?: string[]        // API 标签，便于分类管理
  description?: string   // API 描述信息
}

// 基础注册
bus.register('user', UserApi)

// 带选项的注册
bus.register('user', UserApi, {
  override: true,
  tags: ['core', 'authentication'],
  description: '用户管理和认证相关的 API'
})

// 注册时会自动进行验证
try {
  bus.register('', UserApi) // 错误：空名称
} catch (error) {
  console.log(error.message) // API name must be a non-empty string
  console.log(error.suggestion) // 请提供有效的API名称
}
```

### API 获取

#### `getApi<T>(name)`

安全获取已注册的 API 实例。

```typescript
// 获取 API（可能返回 undefined）
const userApi = bus.getApi<UserApi>('user')
if (userApi) {
  const user = await userApi.getUser('123')
}

// 不存在的 API 返回 undefined
const unknownApi = bus.getApi('unknown') // undefined
```

#### `requireApi<T>(name)`

强制获取 API 实例，不存在时抛出错误。

```typescript
// 安全获取（推荐）
try {
  const userApi = bus.requireApi<UserApi>('user')
  const user = await userApi.getUser('123')
} catch (error) {
  console.log(error.message) // API 'user' is not registered
  console.log(error.suggestion) // 请先注册 API 'user' 或检查名称是否正确
  console.log(error.context.metadata.availableApis) // ['product', 'order']
}
```

### API 删除

#### `deleteApi(name)`

删除指定的 API 实例。

```typescript
// 删除单个 API
const deleted = bus.deleteApi('user')
console.log(deleted) // true 如果删除成功，false 如果 API 不存在

// 删除所有 API
const deletedCount = bus.deleteAllApi()
console.log(`Deleted ${deletedCount} APIs`)
```

## ⚡ 实现切换

### `switchImplementation(implementation, options?)`

动态切换底层请求实现，支持运行时切换 axios 和 fetch。

```typescript
interface SwitchOptions {
  clearCache?: boolean            // 是否清除缓存，默认 false
  preserveInterceptors?: boolean  // 是否保留拦截器，默认 true
  preserveGlobalConfig?: boolean  // 是否保留全局配置，默认 true
}

// 基础切换
bus.switchImplementation('fetch')

// 带选项的切换
bus.switchImplementation('axios', {
  clearCache: true,        // 清除所有缓存
  preserveInterceptors: true,   // 保留当前拦截器
  preserveGlobalConfig: true    // 保留全局配置
})

// 切换场景示例
if (isNetworkSlow()) {
  // 网络较慢时使用 axios（更好的超时控制）
  bus.switchImplementation('axios', {
    clearCache: true  // 清除缓存重新获取
  })
} else {
  // 网络正常时使用 fetch（更轻量）
  bus.switchImplementation('fetch')
}
```

## 🔧 配置管理

### 全局配置

#### `setGlobalConfig(config)`

设置全局请求配置，影响所有 API 实例。

```typescript
// 基础配置
bus.setGlobalConfig({
  baseURL: 'https://api.example.com',
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
    'User-Agent': 'MyApp/1.0.0'
  }
})

// 高级配置
bus.setGlobalConfig({
  baseURL: process.env.API_BASE_URL,
  timeout: 15000,
  debug: process.env.NODE_ENV === 'development',
  retries: 3,
  cacheEnabled: true,
  headers: {
    'Authorization': `Bearer ${getToken()}`,
    'Accept': 'application/json'
  }
})
```

### 拦截器管理

#### `addInterceptor(interceptor)`

添加全局拦截器，影响所有通过该 bus 的请求。

```typescript
// 认证拦截器
const authInterceptor: RequestInterceptor = {
  onRequest: (config) => {
    const token = localStorage.getItem('token')
    if (token) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      }
    }
    return config
  },
  onError: (error, config) => {
    if (error.status === 401) {
      // 处理认证失败
      localStorage.removeItem('token')
      window.location.href = '/login'
    }
    return error
  }
}

bus.addInterceptor(authInterceptor)

// 清除所有拦截器
bus.clearInterceptors()
```

## 🛠️ 开发者工具

### 调试和信息获取

#### `setDebugMode(enabled)`

切换调试模式，启用详细的日志输出。

```typescript
// 开启调试模式
bus.setDebugMode(true)

// 此后所有操作都会有详细日志
bus.register('user', UserApi)
// 输出: 🔌 [RequestBus] Registered API: user

bus.switchImplementation('fetch')
// 输出: 🔄 [RequestBus] Switching to fetch implementation
```

#### `listApiNames()`

列出所有已注册的 API 名称。

```typescript
const apiNames = bus.listApiNames()
console.log('Available APIs:', apiNames) // ['user', 'product', 'order']
```

#### `getApiInfo(name?)`

获取 API 的详细信息，包括元数据和方法列表。

```typescript
// 获取特定 API 信息
const userApiInfo = bus.getApiInfo('user')
console.log(userApiInfo)
// {
//   name: 'user',
//   metadata: {
//     tags: ['core', 'authentication'],
//     description: '用户管理和认证相关的 API',
//     registeredAt: '2023-12-01T10:00:00.000Z'
//   },
//   methods: ['getUser', 'createUser', 'updateUser', 'deleteUser']
// }

// 获取所有 API 信息
const allApiInfo = bus.getApiInfo()
```

#### `getAllStats()`

获取业务总线的完整统计信息。

```typescript
const stats = bus.getAllStats()
console.log(stats)
// {
//   version: '1.0.0',
//   apiCount: 3,
//   debugMode: true,
//   interceptorsCount: 2,
//   cacheStats: { size: 50, maxEntries: 1000 },
//   concurrentStats: { completed: 100, successful: 98 }
// }
```

#### `help()`

显示帮助信息和使用指南。

```typescript
bus.help()
// 输出完整的帮助信息
```

## 🧹 资源管理

### `destroy()`

销毁业务总线，清理所有资源。

```typescript
// 销毁实例
bus.destroy()

// 这会清理：
// - 所有注册的 API 实例
// - RequestCore 实例和相关资源
// - 缓存数据
// - 拦截器引用
// - 统计数据
```

## 🔒 类型定义

### 核心接口

```typescript
// API 类接口
interface ApiClass<T extends ApiInstance = ApiInstance> {
  new (requestCore: RequestCore): T
}

// API 实例接口
interface ApiInstance {
  requestCore: RequestCore
  [key: string]: any
}

// 请求实现类型
type RequestImplementation = 'axios' | 'fetch'

// 注册选项
interface RegisterOptions {
  override?: boolean
  tags?: string[]
  description?: string
}

// 实现切换选项
interface SwitchOptions {
  clearCache?: boolean
  preserveInterceptors?: boolean
  preserveGlobalConfig?: boolean
}
```

### 工厂方法类型

```typescript
// createApiClient 函数签名
function createApiClient<T extends Record<string, ApiClass<any>>>(
  apis: T,
  options?: {
    implementation?: RequestImplementation
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
    requestCore?: RequestCore
  }
): { [K in keyof T]: InstanceType<T[K]> }

// createRequestBus 函数签名
function createRequestBus(
  implementation?: RequestImplementation,
  options?: {
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
  }
): RequestBus

// createRequestCore 函数签名
function createRequestCore(
  implementation?: RequestImplementation,
  options?: {
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
  }
): RequestCore
```

## 🎯 使用场景和模式

### 单页应用 (SPA)

```typescript
// main.ts - 应用入口
import { createApiClient } from 'request-bus'
import { UserApi, ProductApi, OrderApi } from './api'

export const apiClient = createApiClient({
  user: UserApi,
  product: ProductApi,
  order: OrderApi
}, {
  implementation: 'fetch',
  globalConfig: {
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 10000
  }
})

// 在组件中使用
const user = await apiClient.user.getUser('123')
const products = await apiClient.product.getProducts()
```

### 微服务架构

```typescript
// 不同服务使用不同的配置
const userService = createApiClient({ user: UserApi }, {
  globalConfig: { baseURL: 'https://user-service.example.com' }
})

const productService = createApiClient({ product: ProductApi }, {
  globalConfig: { baseURL: 'https://product-service.example.com' }
})
```

### 动态 API 管理

```typescript
// 插件化应用，动态注册 API
const bus = createRequestBus('axios', {
  globalConfig: { baseURL: 'https://api.example.com' }
})

// 加载核心模块
bus.register('user', UserApi, { tags: ['core'] })
bus.register('auth', AuthApi, { tags: ['core'] })

// 根据用户权限动态加载功能模块
if (user.hasPermission('admin')) {
  const { AdminApi } = await import('./modules/admin')
  bus.register('admin', AdminApi, { tags: ['admin'] })
}
```

### 测试环境

```typescript
// 测试时使用 mock 实现
import { createRequestCore } from 'request-bus'
import { MockRequestor } from './test-utils'

const mockCore = new RequestCore(new MockRequestor())

const testApiClient = createApiClient({
  user: UserApi,
  product: ProductApi
}, {
  requestCore: mockCore
})

// 测试时使用 mock 数据
const user = await testApiClient.user.getUser('123') // 返回预设的 mock 数据
```

## 🚨 错误处理

### 统一错误处理

```typescript
import { RequestError, RequestErrorType } from 'request-bus'

// 全局错误处理拦截器
const errorHandler: RequestInterceptor = {
  onError: (error, config) => {
    if (error instanceof RequestError) {
      switch (error.type) {
        case RequestErrorType.NETWORK_ERROR:
          // 网络错误处理
          showNotification('网络连接异常，请检查网络设置')
          break
        case RequestErrorType.HTTP_ERROR:
          if (error.status === 401) {
            // 认证失败
            router.push('/login')
          } else if (error.status >= 500) {
            // 服务器错误
            showNotification('服务器异常，请稍后重试')
          }
          break
        case RequestErrorType.TIMEOUT_ERROR:
          // 超时错误
          showNotification('请求超时，请稍后重试')
          break
        default:
          showNotification(error.suggestion || '请求失败')
      }
    }
    return error
  }
}

const client = createApiClient({ user: UserApi }, {
  interceptors: [errorHandler]
})
```

## 💡 最佳实践

1. **生产环境推荐使用工厂方法**：`createApiClient` 支持树摇优化，减少打包体积
2. **合理组织 API 类**：按业务域划分，每个类专注于特定功能
3. **使用类型安全**：充分利用 TypeScript 类型系统，避免运行时错误
4. **配置分离**：将配置信息独立管理，便于不同环境的部署
5. **错误处理一致性**：使用统一的错误处理机制，提供良好的用户体验
6. **及时清理资源**：在应用销毁时调用 `destroy()` 方法
7. **开发环境启用调试**：使用调试模式便于开发和问题排查
8. **合理使用缓存**：根据数据特性设置合适的缓存策略
9. **拦截器职责单一**：每个拦截器专注于特定功能，便于维护
10. **版本管理**：支持 API 版本管理，便于平滑升级

## 🎉 总结

`request-bus` 作为业务层提供了灵活而强大的 API 管理能力，通过工厂方法、类型安全和丰富的开发者工具，帮助开发者构建可维护、高性能的请求处理方案。无论是简单的单页应用还是复杂的微服务架构，都能找到合适的使用模式。
