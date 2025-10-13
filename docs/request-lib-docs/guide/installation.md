# 安装配置

本指南介绍如何在各种环境中安装和配置请求库。

## 系统要求

### 运行环境

- **Node.js**: 16.0.0+
- **浏览器**: Chrome 88+, Firefox 78+, Safari 14+, Edge 88+

### 包管理器

- **npm**: 7.0.0+
- **yarn**: 1.22.0+
- **pnpm**: 8.0.0+ (推荐)

## 快速安装

### 完整安装（推荐）

::: code-group

```bash [pnpm]
pnpm add request-api request-imp-axios
```

```bash [npm]
npm install request-api request-imp-axios
```

```bash [yarn]
yarn add request-api request-imp-axios
```

:::

## 包说明

### 实现层（至少选择一个）

#### request-imp-axios

基于 Axios 的实现。

::: code-group

```bash [pnpm]
pnpm add request-imp-axios
```

```bash [npm]
npm install request-imp-axios
```

```bash [yarn]
yarn add request-imp-axios
```

:::

**特点**: 成熟稳定、功能丰富、自动 JSON 处理、更好的错误处理

#### request-imp-fetch

基于 Fetch API 的实现。

::: code-group

```bash [pnpm]
pnpm add request-imp-fetch
```

```bash [npm]
npm install request-imp-fetch
```

```bash [yarn]
yarn add request-imp-fetch
```

:::

**特点**: 原生支持、包体积小、Promise-based、Service Worker 兼容

### API 层（必须）

#### request-api

提供类型安全的 API 客户端创建功能。

::: code-group

```bash [pnpm]
pnpm add request-api
```

```bash [npm]
npm install request-api
```

```bash [yarn]
yarn add request-api
```

:::

**包含功能**: 类型安全的 API 客户端、工厂方法支持、统一配置管理、树摇优化支持

## 框架集成

### Vue.js

```typescript
// src/api/index.ts
import { createApiClient } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'
import { UserApi, PostApi } from './modules'

export const apiClient = createApiClient(
  {
    user: UserApi,
    post: PostApi,
  },
  {
    requestor: new AxiosRequestor(),
    globalConfig: {
      baseURL: import.meta.env.VITE_API_BASE_URL,
      timeout: 10000,
    },
  }
)

// main.ts
import { createApp } from 'vue'
import App from './App.vue'
import { apiClient } from './api'

const app = createApp(App)
app.provide('apiClient', apiClient)
app.mount('#app')
```

### React

```typescript
// src/api/index.ts
import { createApiClient } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'
import { UserApi, PostApi } from './modules'

export const apiClient = createApiClient(
  {
    user: UserApi,
    post: PostApi,
  },
  {
    requestor: new AxiosRequestor(),
    globalConfig: {
      baseURL: process.env.REACT_APP_API_BASE_URL,
      timeout: 10000,
    },
  }
)

// src/hooks/useApi.ts
import { apiClient } from '../api'

export const useApi = () => {
  return apiClient
}

// 在组件中使用
import { useApi } from '../hooks/useApi'

function UserList() {
  const api = useApi()

  const fetchUsers = async () => {
    const users = await api.user.getUserList()
    return users
  }
}
```
