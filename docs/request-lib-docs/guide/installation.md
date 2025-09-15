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
- 基础请求方法（GET、POST、PUT、DELETE等）
- 缓存机制（内存缓存、localStorage缓存）
- 重试机制（指数退避、自定义重试条件）
- 并发控制（并发限制、顺序请求）
- 拦截器系统
- 错误处理
- 链式调用API
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
- 自动JSON处理
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

### API层（可选但推荐）

#### request-api
API层封装，提供类型安全的API客户端创建功能：

```bash
npm install request-api
```

**包含功能**:
- 类型安全的API客户端创建
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
  const apiClient = createApiClient({
    // API 定义...
  }, {
    requestor: new AxiosRequestor()
  })
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

export const apiClient = createApiClient({
  user: UserApi,
  post: PostApi
}, {
  requestor: new AxiosRequestor(),
  globalConfig: {
    baseURL: import.meta.env.VITE_API_BASE_URL,
    timeout: 10000
  }
})

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

export const apiClient = createApiClient({
  user: UserApi,
  post: PostApi
}, {
  requestor: new AxiosRequestor(),
  globalConfig: {
    baseURL: process.env.REACT_APP_API_BASE_URL,
    timeout: 10000
  }
})

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


## ❓ 常见问题

### Q: 如何选择实现层？

**A**: 
- **Axios**: 适合 Node.js 环境和需要丰富功能的场景
- **Fetch**: 适合现代浏览器和追求更小包体积的场景

### Q: TypeScript 类型错误怎么解决？

**A**: 确保：
1. 安装了正确的类型定义包
2. `tsconfig.json` 配置正确
3. 使用最新版本的 TypeScript

### Q: 构建时提示缺少依赖？

**A**: 检查：
1. 是否安装了所有必需的包
2. 包版本是否兼容
3. 构建工具配置是否正确

### Q: 如何在老版本浏览器中使用？

**A**: 
1. 使用 Babel 进行代码转换
2. 添加必要的 polyfills
3. 选择合适的目标浏览器版本

### Q: 包体积太大怎么办？

**A**: 
1. 使用树摇优化
2. 只安装需要的实现层
3. 考虑使用 CDN 引入
4. 启用代码分割

### Q: 开发环境接口请求失败？

**A**: 检查：
1. 后端服务是否启动
2. API 地址配置是否正确
3. 是否存在跨域问题
4. 网络连接是否正常

## 📞 获取帮助

如果遇到安装或配置问题：

1. 查看 [故障排除指南](/guide/troubleshooting)
2. 浏览 [常见问题](/guide/faq)
3. 提交 [GitHub Issue](https://github.com/your-org/request-lib/issues)
4. 参与 [社区讨论](https://github.com/your-org/request-lib/discussions)

---

## 🎉 安装完成

恭喜！你已经成功安装并配置了分层架构的前端请求库。

**下一步**:
- 🚀 查看 [快速开始](/guide/getting-started) 学习基本用法
- 📖 阅读 [基本用法](/guide/basic-usage) 了解详细功能
- 💡 浏览 [使用示例](/examples/basic-requests) 获取实际案例
