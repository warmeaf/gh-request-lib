# Request API

请求库 API 层 - 组装和暴露给应用的最终 API

## 📖 简介

`request-api` 是请求库的最上层模块，负责将底层的 `request-core` 组装成便于应用使用的 API 客户端。它提供了一套简洁、类型安全的接口，用于创建和管理多个 API 实例。

### 主要职责

- 🏭 **工厂模式**：提供工厂方法创建 API 客户端
- 🔌 **组合管理**：支持多个 API 实例的统一管理
- 📦 **功能增强**：在 API 实例上附加缓存、配置、拦截器等管理功能
- 🌲 **树摇优化**：支持 Tree-shaking，减小最终打包体积
- 📘 **类型安全**：完整的 TypeScript 类型定义

## ✨ 特性

- ✅ **统一的 API 客户端**：将多个 API 类组合成单一的客户端对象
- ✅ **灵活的配置方式**：支持全局配置和单个请求配置
- ✅ **缓存管理**：提供统一的缓存清理和状态查询接口
- ✅ **拦截器支持**：支持请求和响应拦截器的添加和清理
- ✅ **生命周期管理**：提供 destroy 方法用于资源清理
- ✅ **类型推断**：完整的类型推断，开发体验友好

## 📦 安装

```bash
# 使用 pnpm
pnpm add request-api

# 使用 npm
npm install request-api

# 使用 yarn
yarn add request-api
```

> **注意**：通常需要同时安装请求实现层，如 `request-imp-axios` 或 `request-imp-fetch`

```bash
pnpm add request-api request-imp-axios
```

## 🚀 快速开始

### 基础使用

```typescript
import { createApiClient, type RequestCore } from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

// 1. 定义你的 API 类
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get(`/users/${id}`)
  }

  async createUser(data: any) {
    return this.requestCore.post('/users', { data })
  }
}

class ProductApi {
  constructor(public requestCore: RequestCore) {}

  async getProducts() {
    return this.requestCore.get('/products')
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
    },
  }
)

// 4. 使用 API 客户端
const user = await apiClient.user.getUser('123')
const products = await apiClient.product.getProducts()

// 5. 管理缓存
apiClient.clearCache() // 清除所有缓存
apiClient.clearCache('user-123') // 清除特定缓存
const stats = apiClient.getCacheStats() // 查看缓存统计

// 6. 添加拦截器
apiClient.addInterceptor({
  onRequest: async (config) => {
    console.log('Request:', config)
    return config
  },
})

// 7. 清理资源
apiClient.destroy()
```

## 📚 API 文档

### 核心函数

#### `createApiClient(apis, options)`

创建增强的 API 客户端对象。

**类型签名：**

```typescript
function createApiClient<T extends Record<string, ApiClass<any>>>(
  apis: T,
  options: ApiClientOptions
): ApiClient<T>
```

**参数：**

- `apis`: API 类的映射对象，key 为 API 名称，value 为 API 类
- `options`: 创建选项
  - `requestor?`: 请求执行器（推荐使用）
  - `requestCore?`: RequestCore 实例（内部使用）
  - `globalConfig?`: 全局配置
  - `interceptors?`: 拦截器数组

**返回值：**

增强的 API 客户端对象，包含：

- 所有 API 实例（根据 `apis` 参数的 key）
- 缓存管理方法
- 配置管理方法
- 拦截器管理方法
- 生命周期管理方法

**推荐用法：** 使用 `requestor` 选项创建客户端，所有类型（包括 `RequestCore`）都从 `request-api` 导入，无需从 `request-core` 导入任何内容。

### ApiClient 方法

创建的 API 客户端对象包含以下管理方法：

#### 缓存管理

```typescript
// 清除缓存
clearCache(key?: string): void

// 获取缓存统计信息
getCacheStats(): any
```

#### 配置管理

```typescript
// 设置全局配置
setGlobalConfig(config: GlobalConfig): void
```

#### 拦截器管理

```typescript
// 添加拦截器
addInterceptor(interceptor: RequestInterceptor): void

// 清除所有拦截器
clearInterceptors(): void
```

#### 其他方法

```typescript
// 获取所有统计信息
getAllStats(): any

// 销毁客户端，清理资源
destroy(): void
```

### 类型定义

#### `ApiClass<T>`

API 类的接口定义。

```typescript
interface ApiClass<T extends ApiInstance = ApiInstance> {
  new (requestCore: RequestCore): T
}
```

#### `ApiInstance`

API 实例的接口定义。

```typescript
interface ApiInstance {
  requestCore: RequestCore
  [key: string]: any
}
```

#### `ApiClientOptions`

API 客户端创建选项。

```typescript
interface ApiClientOptions {
  requestor?: Requestor // 请求执行器（推荐使用）
  requestCore?: RequestCore // RequestCore 实例（内部使用）
  globalConfig?: GlobalConfig // 全局配置（可选）
  interceptors?: RequestInterceptor[] // 拦截器数组（可选）
}
```

**注意：** 推荐使用 `requestor` 选项，所有类型从 `request-api` 导入即可。

#### `ApiClient<T>`

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
  // 工具方法
  destroy(): void
  getAllStats(): any
}
```

### 重导出的类型

`request-api` 导出了所有需要的类型，开发时只需从 `request-api` 导入：

```typescript
// 类型导出
export type {
  RequestCore, // RequestCore 类型（用于定义 API 类）
  PaginatedResponse, // 分页响应类型
  RestfulOptions, // RESTful 请求选项
  GlobalConfig, // 全局配置类型
  RequestInterceptor, // 拦截器类型
  Requestor, // 请求执行器类型
  ApiClass, // API 类接口
  ApiInstance, // API 实例接口
  ApiClient, // API 客户端类型
  ApiClientOptions, // API 客户端选项
}

// 错误类和枚举
export { RequestError, RequestErrorType }
```

**使用示例：**

```typescript
import {
  createApiClient,
  type RequestCore,
  type GlobalConfig,
  type RequestInterceptor,
} from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

// 定义 API 类（使用 request-api 导出的类型）
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get(`/users/${id}`)
  }
}

// 全局配置（使用 request-api 导出的类型）
const config: GlobalConfig = {
  timeout: 5000,
  baseURL: 'https://api.example.com',
}

// 拦截器（使用 request-api 导出的类型）
const interceptor: RequestInterceptor = {
  onRequest: async (config) => {
    console.log('Request intercepted')
    return config
  },
}

// 创建客户端
const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: createAxiosRequestor(),
    globalConfig: config,
    interceptors: [interceptor],
  }
)
```

## 🏗️ 目录结构

```
src/
├── index.ts              # 主入口，导出所有公共 API
├── client/
│   └── api-client.ts     # API 客户端实现
├── core/
│   └── factory.ts        # 内部工厂方法实现
└── types/
    └── index.ts          # 类型定义和重导出
```

### 文件说明

- **index.ts**: 模块的主入口文件，负责导出所有公共 API 和类型
- **client/api-client.ts**: 包含 `createApiClient` 函数和 `ApiClient` 类型定义
- **core/factory.ts**: 内部使用的工厂方法，用于创建和配置 `RequestCore` 实例
- **types/index.ts**: 定义和重导出类型，便于外部使用

## 💡 高级用法

### 多环境配置

```typescript
import { createApiClient, type RequestCore } from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

// 定义 API 类
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get(`/users/${id}`)
  }
}

// 根据环境创建不同的配置
const baseURL =
  process.env.NODE_ENV === 'production'
    ? 'https://api.prod.com'
    : 'https://api.dev.com'

const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: createAxiosRequestor({ baseURL }),
    globalConfig: {
      timeout: 5000,
    },
  }
)
```

### 完整配置示例

```typescript
import {
  createApiClient,
  type RequestCore,
  type GlobalConfig,
  type RequestInterceptor,
} from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

// 定义 API 类
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get(`/users/${id}`)
  }
}

class ProductApi {
  constructor(public requestCore: RequestCore) {}

  async getProducts() {
    return this.requestCore.get('/products')
  }
}

// 全局配置
const globalConfig: GlobalConfig = {
  baseURL: 'https://api.example.com',
  timeout: 5000,
  headers: {
    'Content-Type': 'application/json',
  },
}

// 请求拦截器
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
  onResponse: async (response) => {
    console.log('Response received:', response)
    return response
  },
}

// 创建 API 客户端
const apiClient = createApiClient(
  {
    user: UserApi,
    product: ProductApi,
  },
  {
    requestor: createAxiosRequestor(),
    globalConfig,
    interceptors: [authInterceptor],
  }
)

// 使用
const user = await apiClient.user.getUser('123')
const products = await apiClient.product.getProducts()
```

### 动态拦截器管理

```typescript
import {
  createApiClient,
  type RequestCore,
  type RequestInterceptor,
} from 'request-api'
import { createAxiosRequestor } from 'request-imp-axios'

class UserApi {
  constructor(public requestCore: RequestCore) {}

  async login(username: string, password: string) {
    return this.requestCore.post('/auth/login', {
      data: { username, password },
    })
  }
}

const apiClient = createApiClient(
  { user: UserApi },
  { requestor: createAxiosRequestor() }
)

// 创建一个带认证的拦截器
const createAuthInterceptor = (token: string): RequestInterceptor => ({
  onRequest: async (config) => {
    config.headers = {
      ...config.headers,
      Authorization: `Bearer ${token}`,
    }
    return config
  },
})

// 登录后添加认证拦截器
const loginResponse = await apiClient.user.login('user', 'pass')
apiClient.addInterceptor(createAuthInterceptor(loginResponse.token))

// 登出时清除拦截器
apiClient.clearInterceptors()
```

## 🔗 相关模块

- [request-core](../request-core/README.md) - 请求库核心层
- [request-imp-axios](../request-imp-axios/README.md) - Axios 实现层
- [request-imp-fetch](../request-imp-fetch/README.md) - Fetch 实现层
