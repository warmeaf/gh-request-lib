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
pnpm add request-core request-api request-imp-axios
```

```bash [npm]
npm install request-core request-api request-imp-axios
```

```bash [yarn]
yarn add request-core request-api request-imp-axios
```

:::

### 最小化安装

::: code-group

```bash [pnpm]
pnpm add request-core request-imp-axios
```

```bash [npm]
npm install request-core request-imp-axios
```

```bash [yarn]
yarn add request-core request-imp-axios
```

:::

## 包说明

### 核心包（必需）

#### request-core

核心功能包，提供基础请求能力和高级功能。

```bash
npm install request-core
```

**包含功能**:

- 基础请求方法（GET、POST、PUT、DELETE 等）
- 缓存机制
- 重试机制
- 并发控制
- 拦截器系统
- 错误处理

### 实现层（至少选择一个）

#### request-imp-axios

基于 Axios 的实现。

```bash
npm install request-imp-axios
```

**特点**: 成熟稳定、功能丰富、自动 JSON 处理、更好的错误处理

#### request-imp-fetch

基于 Fetch API 的实现。

```bash
npm install request-imp-fetch
```

**特点**: 原生支持、包体积小、Promise-based、Service Worker 兼容

### API 层（可选但推荐）

#### request-api

提供类型安全的 API 客户端创建功能。

```bash
npm install request-api
```

**包含功能**: 类型安全的 API 客户端、工厂方法支持、统一配置管理、树摇优化支持

## CDN 引入

### UMD 构建版本

```html
<!DOCTYPE html>
<html>
  <head>
    <script src="https://unpkg.com/request-core@latest/dist/request-core.umd.js"></script>
    <script src="https://unpkg.com/request-imp-axios@latest/dist/request-imp-axios.umd.js"></script>
    <script src="https://unpkg.com/request-api@latest/dist/request-api.umd.js"></script>
  </head>
  <body>
    <script>
      const { RequestCore } = window.RequestCore
      const { AxiosRequestor } = window.RequestImpAxios

      const core = new RequestCore(new AxiosRequestor())
    </script>
  </body>
</html>
```

### ES Module CDN

```html
<script type="module">
  import { RequestCore } from 'https://unpkg.com/request-core@latest/dist/request-core.es.js'
  import { AxiosRequestor } from 'https://unpkg.com/request-imp-axios@latest/dist/request-imp-axios.es.js'
  import { createApiClient } from 'https://unpkg.com/request-api@latest/dist/request-api.es.js'

  const apiClient = createApiClient(
    {
      // API 定义
    },
    {
      requestor: new AxiosRequestor(),
    }
  )
</script>
```

### jsDelivr CDN（推荐）

```html
<script src="https://cdn.jsdelivr.net/npm/request-core@latest/dist/request-core.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/request-imp-axios@latest/dist/request-imp-axios.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/request-api@latest/dist/request-api.umd.js"></script>
```

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
