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
pnpm add request-core request-bus request-imp-axios

# 可选：同时安装 fetch 实现以支持实现切换
pnpm add request-imp-fetch
```

```bash [npm]
# 安装所有必需包
npm install request-core request-bus request-imp-axios

# 可选：同时安装 fetch 实现以支持实现切换
npm install request-imp-fetch
```

```bash [yarn]
# 安装所有必需包
yarn add request-core request-bus request-imp-axios

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

### 业务层（可选但推荐）

#### request-bus
业务层封装，提供高级API组织功能：

```bash
npm install request-bus
```

**包含功能**:
- API类组织管理
- 工厂方法
- 类型安全的API客户端
- 实现切换支持
- 调试和开发工具

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
  
  <!-- 业务层（可选） -->
  <script src="https://unpkg.com/request-bus@latest/dist/request-bus.umd.js"></script>
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
  import { createApiClient } from 'https://unpkg.com/request-bus@latest/dist/request-bus.es.js'
  
  // 使用 ES modules 语法
  const apiClient = createApiClient({
    // API 定义...
  }, {
    implementation: 'axios'
  })
</script>
```

### jsDelivr CDN（推荐）

jsDelivr 提供更好的性能和可靠性：

```html
<!-- 使用 jsDelivr CDN -->
<script src="https://cdn.jsdelivr.net/npm/request-core@latest/dist/request-core.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/request-imp-axios@latest/dist/request-imp-axios.umd.js"></script>
<script src="https://cdn.jsdelivr.net/npm/request-bus@latest/dist/request-bus.umd.js"></script>
```

## ⚙️ 配置指南

### TypeScript 配置

为了获得最佳的 TypeScript 支持，需要正确配置 `tsconfig.json`：

```json
{
  "compilerOptions": {
    "target": "ES2018",
    "lib": ["ES2018", "DOM"],
    "module": "ESNext",
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "preserve"
  },
  "include": [
    "src/**/*",
    "types/**/*"
  ],
  "exclude": [
    "node_modules",
    "dist"
  ]
}
```

### 构建工具配置

#### Vite 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  optimizeDeps: {
    include: [
      'request-core',
      'request-bus',
      'request-imp-axios',
      'request-imp-fetch'
    ]
  },
  build: {
    rollupOptions: {
      external: id => {
        // 如果你想要树摇优化，可以将未使用的实现标记为外部依赖
        return false
      }
    }
  }
})
```

#### Webpack 配置

```javascript
// webpack.config.js
module.exports = {
  resolve: {
    alias: {
      // 可选：为请求库创建别名
      '@request': path.resolve(__dirname, 'src/api')
    }
  },
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        requestLib: {
          test: /[\\/]node_modules[\\/](request-core|request-bus|request-imp-)[\\/]/,
          name: 'request-lib',
          priority: 10,
        }
      }
    }
  }
}
```

#### Rollup 配置

```javascript
// rollup.config.js
import resolve from '@rollup/plugin-node-resolve'
import commonjs from '@rollup/plugin-commonjs'
import typescript from '@rollup/plugin-typescript'

export default {
  input: 'src/main.ts',
  output: {
    file: 'dist/bundle.js',
    format: 'esm'
  },
  plugins: [
    resolve({
      preferBuiltins: false,
      browser: true
    }),
    commonjs(),
    typescript()
  ],
  external: [
    // 如果要排除某些依赖，在这里列出
  ]
}
```

### Babel 配置

如果需要支持旧版浏览器：

```json
{
  "presets": [
    [
      "@babel/preset-env",
      {
        "targets": {
          "browsers": [
            "> 1%",
            "last 2 versions",
            "not ie <= 11"
          ]
        }
      }
    ],
    "@babel/preset-typescript"
  ],
  "plugins": [
    "@babel/plugin-proposal-class-properties",
    "@babel/plugin-proposal-optional-chaining",
    "@babel/plugin-proposal-nullish-coalescing-operator"
  ]
}
```

## 📱 框架集成

### Vue.js 项目

```typescript
// src/api/index.ts
import { createApiClient } from 'request-bus'
import { UserApi, PostApi } from './modules'

export const apiClient = createApiClient({
  user: UserApi,
  post: PostApi
}, {
  implementation: 'axios',
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
import { createApiClient } from 'request-bus'
import { UserApi, PostApi } from './modules'

export const apiClient = createApiClient({
  user: UserApi,
  post: PostApi
}, {
  implementation: 'axios',
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

### Angular 项目

```typescript
// src/app/services/api.service.ts
import { Injectable } from '@angular/core'
import { createApiClient } from 'request-bus'
import { UserApi, PostApi } from './api-modules'

@Injectable({
  providedIn: 'root'
})
export class ApiService {
  private client = createApiClient({
    user: UserApi,
    post: PostApi
  }, {
    implementation: 'axios',
    globalConfig: {
      baseURL: environment.apiBaseUrl,
      timeout: 10000
    }
  })

  get user() {
    return this.client.user
  }

  get post() {
    return this.client.post
  }
}

// src/app/components/user-list.component.ts
import { Component, OnInit } from '@angular/core'
import { ApiService } from '../services/api.service'

@Component({
  selector: 'app-user-list',
  templateUrl: './user-list.component.html'
})
export class UserListComponent implements OnInit {
  constructor(private apiService: ApiService) {}

  async ngOnInit() {
    const users = await this.apiService.user.getUserList()
    // ...
  }
}
```

## 🔧 开发环境设置

### 项目结构推荐

```
src/
├── api/                    # API 相关文件
│   ├── modules/           # API 模块
│   │   ├── user.ts       # 用户相关 API
│   │   ├── post.ts       # 文章相关 API
│   │   └── index.ts      # 导出所有模块
│   ├── types/            # API 类型定义
│   │   ├── user.ts       # 用户类型
│   │   ├── post.ts       # 文章类型
│   │   └── common.ts     # 通用类型
│   ├── config/           # 配置文件
│   │   ├── development.ts
│   │   ├── production.ts
│   │   └── index.ts
│   └── index.ts          # API 客户端导出
├── utils/                 # 工具函数
└── main.ts               # 入口文件
```

### 环境变量配置

创建环境变量文件：

```bash
# .env
VITE_API_BASE_URL=http://localhost:3000/api
VITE_API_TIMEOUT=10000
VITE_API_IMPLEMENTATION=axios

# .env.production
VITE_API_BASE_URL=https://api.example.com
VITE_API_TIMEOUT=5000
VITE_API_IMPLEMENTATION=fetch
```

### 开发工具配置

#### ESLint 配置

```json
{
  "extends": [
    "@typescript-eslint/recommended"
  ],
  "rules": {
    "@typescript-eslint/no-explicit-any": "warn",
    "@typescript-eslint/no-unused-vars": "error"
  }
}
```

#### Prettier 配置

```json
{
  "printWidth": 80,
  "tabWidth": 2,
  "useTabs": false,
  "semi": true,
  "singleQuote": true,
  "trailingComma": "es5"
}
```

## 🚀 生产环境部署

### 构建优化

```typescript
// 生产环境 API 客户端配置
import { createApiClient } from 'request-bus'

export const apiClient = createApiClient({
  // API 模块...
}, {
  implementation: 'fetch', // 生产环境推荐使用 fetch
  globalConfig: {
    baseURL: process.env.NODE_ENV === 'production' 
      ? 'https://api.example.com' 
      : 'http://localhost:3000/api',
    timeout: process.env.NODE_ENV === 'production' ? 5000 : 10000,
    headers: {
      'Content-Type': 'application/json'
    }
  },
  interceptors: [{
    error: (error) => {
      // 生产环境错误处理
      if (process.env.NODE_ENV === 'production') {
        // 发送错误报告到监控服务
        sendErrorReport(error)
      }
      throw error
    }
  }]
})
```

### 包分析和优化

```bash
# 分析打包大小
npm run build -- --analyze

# 或使用 webpack-bundle-analyzer
npx webpack-bundle-analyzer dist/static/js/*.js
```

### CDN 部署

对于静态资源，可以将请求库部署到 CDN：

```html
<!-- 生产环境使用固定版本 -->
<script src="https://cdn.jsdelivr.net/npm/request-core@1.0.0/dist/request-core.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/request-imp-fetch@1.0.0/dist/request-imp-fetch.umd.min.js"></script>
```

## ❓ 常见问题

### Q: 如何选择实现层？

**A**: 
- **Axios**: 适合 Node.js 环境和需要丰富功能的场景
- **Fetch**: 适合现代浏览器和追求更小包体积的场景
- **两者都装**: 支持运行时切换，适合需要灵活性的项目

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
