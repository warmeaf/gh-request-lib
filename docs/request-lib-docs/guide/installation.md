# 安装配置

本指南将详细介绍如何在各种环境中安装和配置分层架构的前端请求库。

## 📋 系统要求

### 运行环境

- **Node.js**: 16.0.0 或更高版本
- **浏览器支持**:
  - Chrome 88+
  - Firefox 78+
  - Safari 14+
  - Edge 88+

### 包管理器

- **npm**: 7.0.0 或更高版本
- **yarn**: 1.22.0 或更高版本
- **pnpm**: 8.0.0 或更高版本（推荐）

## 🚀 快速安装

### 完整安装（推荐）

适合大多数项目的完整功能安装：

::: code-group

```bash [pnpm]
# 安装所有必需包
pnpm add request-core request-api request-imp-axios

# 可选：同时安装 fetch 实现以支持实现切换
pnpm add request-imp-fetch
```

```bash [npm]
# 安装所有必需包
npm install request-core request-api request-imp-axios

# 可选：同时安装 fetch 实现以支持实现切换
npm install request-imp-fetch
```

```bash [yarn]
# 安装所有必需包
yarn add request-core request-api request-imp-axios

# 可选：同时安装 fetch 实现以支持实现切换
yarn add request-imp-fetch
```

:::

### 最小化安装

如果只需要基础功能，可以选择最小化安装：

::: code-group

```bash [pnpm]
# 仅安装核心功能
pnpm add request-core request-imp-axios
```

```bash [npm]
# 仅安装核心功能
npm install request-core request-imp-axios
```

```bash [yarn]
# 仅安装核心功能
yarn add request-core request-imp-axios
```

:::

## 📦 包选择指南

### 核心包（必需）

#### request-core

核心功能包，提供基础请求能力和高级功能：

```bash
npm install request-core
```

**包含功能**:

- 基础请求方法（GET、POST、PUT、DELETE 等）
- 缓存机制（内存缓存、localStorage 缓存）
- 重试机制（指数退避、自定义重试条件）
- 并发控制（并发限制、顺序请求）
- 拦截器系统
- 错误处理
- 链式调用 API
- 文件上传下载
- 分页处理

### 实现层（至少选择一个）

#### request-imp-axios

基于 Axios 的请求实现，推荐用于 Node.js 环境：

```bash
npm install request-imp-axios
```

**特点**:

- 成熟稳定，功能丰富
- 自动 JSON 处理
- 请求/响应拦截器
- 自动请求体序列化
- 更好的错误处理
- 支持上传进度

#### request-imp-fetch

基于 Fetch API 的请求实现，推荐用于现代浏览器：

```bash
npm install request-imp-fetch
```

**特点**:

- 现代浏览器原生支持
- 更小的包体积
- Promise-based API
- 流式处理支持
- Service Worker 兼容

### API 层（可选但推荐）

#### request-api

API 层封装，提供类型安全的 API 客户端创建功能：

```bash
npm install request-api
```

**包含功能**:

- 类型安全的 API 客户端创建
- 工厂方法支持
- 统一的配置管理
- 请求实现抽象
- 树摇优化支持

## 🌐 CDN 引入

### UMD 构建版本

适用于传统网页项目：

```html
<!DOCTYPE html>
<html>
  <head>
    <!-- 核心库 -->
    <script src="https://unpkg.com/request-core@latest/dist/request-core.umd.js"></script>

    <!-- 选择实现层 -->
    <script src="https://unpkg.com/request-imp-axios@latest/dist/request-imp-axios.umd.js"></script>
    <!-- 或者 -->
    <script src="https://unpkg.com/request-imp-fetch@latest/dist/request-imp-fetch.umd.js"></script>

    <!-- API层（可选） -->
    <script src="https://unpkg.com/request-api@latest/dist/request-api.umd.js"></script>
  </head>
  <body>
    <script>
      // 使用全局变量
      const { RequestCore } = window.RequestCore
      const { AxiosRequestor } = window.RequestImpAxios

      const core = new RequestCore(new AxiosRequestor())
      // 开始使用...
    </script>
  </body>
</html>
```

### ES Module CDN

适用于现代浏览器和支持 ES modules 的环境：

```html
<script type="module">
  import { RequestCore } from 'https://unpkg.com/request-core@latest/dist/request-core.es.js'
  import { AxiosRequestor } from 'https://unpkg.com/request-imp-axios@latest/dist/request-imp-axios.es.js'
  import { createApiClient } from 'https://unpkg.com/request-api@latest/dist/request-api.es.js'

  // 使用 ES modules 语法
  const apiClient = createApiClient(
    {
      // API 定义...
    },
    {
      requestor: new AxiosRequestor(),
    }
  )
</script>
```

### jsDelivr CDN（推荐）

jsDelivr 提供更好的性能和可靠性：

```html
<!-- 使用 jsDelivr CDN -->
<script src="https://cdn.jsdelivr.net/npm/request-core@latest/dist/request-core.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/request-imp-axios@latest/dist/request-imp-axios.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/request-api@latest/dist/request-api.umd.js"></script>
```

## 📱 框架集成

### Vue.js 项目

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

// 全局注入 API 客户端
app.provide('apiClient', apiClient)

app.mount('#app')
```

### React 项目

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

  // ...
}
```

## 🎉 安装完成

恭喜！你已经成功安装并配置了分层架构的前端请求库。
