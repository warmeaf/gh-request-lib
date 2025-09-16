# API层 API

## 📖 概述

`request-api` 是请求库的应用层，提供类型安全的 API 客户端创建和统一的配置管理。

## 🏗️ 核心特性

- ✅ 类型安全的 API 客户端创建
- ✅ 工厂方法支持树摇优化  
- ✅ 统一的错误处理和拦截器
- ✅ 缓存、重试、并发等特性
- ✅ 全局配置管理

## 🚀 快速上手

### 基本用法

```typescript
import { createApiClient, type RequestCore } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'

// 定义类型
interface User {
  id: string
  name: string
}

interface CreateUserRequest {
  name: string
}

// 定义 API 类
class UserApi {
  constructor(private requestCore: RequestCore) {}
  
  async getUser(id: string) {
    return this.requestCore.get<User>(`/users/${id}`)
  }
  
  async createUser(data: CreateUserRequest) {
    return this.requestCore.post<User>('/users', data)
  }
}

// 创建 API 客户端
const apiClient = createApiClient({
  user: UserApi
}, {
  requestor: new AxiosRequestor(),
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000
  }
})

// 使用
const user = await apiClient.user.getUser('123')
```

### 使用已有 RequestCore 实例

```typescript
import { createRequestCore, createApiClient } from 'request-api'
import { FetchRequestor } from 'request-imp-fetch'

// 先创建 RequestCore 实例
const requestCore = createRequestCore(new FetchRequestor(), {
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000
  },
  interceptors: [
    {
      onRequest: (config) => {
        console.log('Request:', config)
        return config
      },
      onResponse: (response) => {
        console.log('Response:', response)
        return response
      }
    }
  ]
})

// 使用已有的 RequestCore
const apiClient = createApiClient({ user: UserApi }, { requestCore })
```

## 📚 API 参考

### 核心函数

#### createRequestCore(requestor, options?)
创建 RequestCore 实例

- `requestor`: Requestor 实现实例
- `options.globalConfig`: 全局配置
- `options.interceptors`: 拦截器数组

#### createApiClient(apis, options)
创建 API 客户端，支持树摇优化

- `apis`: API 类映射对象
- `options.requestor` 或 `options.requestCore`: 二选一
- `options.globalConfig`: 全局配置
- `options.interceptors`: 拦截器数组

### API 客户端方法

创建的客户端提供以下管理方法：

- `clearCache(key?)` - 清除缓存
- `getCacheStats()` - 获取缓存统计
- `setGlobalConfig(config)` - 设置全局配置
- `addInterceptor(interceptor)` - 添加拦截器
- `clearInterceptors()` - 清除拦截器
- `destroy()` - 销毁客户端
- `getAllStats()` - 获取统计信息

## 💡 主要类型

- `ApiClass<T>` - API 类接口，构造函数接收 RequestCore
- `ApiInstance` - API 实例接口，包含 requestCore 属性
- `ApiClient<T>` - 增强的客户端类型，包含所有 API 实例和管理方法

## 🔄 集成使用

### 导入依赖

```typescript
import { createApiClient, RequestError } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'
import { FetchRequestor } from 'request-imp-fetch'
```

## 🎯 最佳实践

### API 类设计
- 清晰的职责分离，每个 API 类负责一个业务模块
- 构造函数接收 RequestCore 实例
- 使用 TypeScript 泛型确保类型安全

### 错误处理
```typescript
try {
  const user = await apiClient.user.getUser('123')
} catch (error) {
  if (error instanceof RequestError) {
    console.error('Request failed:', error.message)
  }
}
```

### 资源管理
- 使用完毕后调用 `destroy()` 方法释放资源
- 在 React 组件卸载时清理客户端
- 利用树摇优化，只导入实际使用的功能
