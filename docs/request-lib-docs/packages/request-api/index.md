# request-api 包

## 📖 包概述

`request-api` 是请求库的 API 层包，提供类型安全的 API 客户端创建和管理功能。

### 主要功能

- ✅ **工厂方法**: 提供 `createApiClient` 和 `createRequestCore` 工厂函数
- ✅ **类型安全**: 完整的 TypeScript 类型定义
- ✅ **树摇优化**: 支持现代打包工具的树摇优化
- ✅ **灵活配置**: 支持多种配置方式和实现切换

### 安装

```bash
npm install request-api request-core
```

### 快速开始

```typescript
import { createApiClient } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'

const apiClient = createApiClient({
  user: UserApi
}, {
  requestor: new AxiosRequestor(),
  globalConfig: {
    baseURL: 'https://api.example.com'
  }
})
```

## 📁 包结构

### 核心导出

- `createApiClient` - 创建 API 客户端的工厂函数
- `createRequestCore` - 创建 RequestCore 实例的工厂函数
- `ApiClass` - API 类型定义
- `ApiInstance` - API 实例类型定义
- `ApiClient` - 增强的 API 客户端类型

### 重导出类型

从 `request-core` 重导出的常用类型：

- `RequestCore`
- `PaginatedResponse`
- `RestfulOptions`
- `RequestError`
- `RequestErrorType`

## 🔗 相关文档

- [工厂方法详解](./factory-methods)
- [API 参考](./api-reference)
