# 快速开始

欢迎使用分层架构的前端请求库！本指南将帮助你在几分钟内快速上手并体验企业级请求库的强大功能。

## 🚀 快速安装

```bash
# 安装必需的包
npm install request-core request-api request-imp-axios
# or
pnpm add request-core request-api request-imp-axios
```

> 💡 更详细的安装选项和配置请查看 [安装指南](/guide/installation)

## 🎯 10 秒快速体验

最简单的使用方式，创建 API 类并使用：

```typescript
import { createApiClient } from 'request-api'
import type { RequestCore } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'

// 1. 定义 API 类
class UserApi {
  constructor(private requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get<User>(`/users/${id}`)
  }

  async getUserList() {
    return this.requestCore.get<User[]>('/users')
  }
}

// 2. 创建 API 客户端
const apiClient = createApiClient(
  {
    user: UserApi,
  },
  {
    requestor: new AxiosRequestor(), // 使用 Axios 实现
    globalConfig: {
      baseURL: 'https://jsonplaceholder.typicode.com',
      timeout: 5000,
    },
  }
)

// 3. 使用 API
const user = await apiClient.user.getUser('1')
console.log('User:', user)
```

## 🔄 使用 Fetch 实现

如果你更倾向于使用现代的 Fetch API，也可以轻松切换：

```bash
# 安装必需的包
npm install request-core request-api request-imp-fetch
# or
pnpm add request-core request-api request-imp-fetch
```

```typescript
import { createApiClient } from 'request-api'
import type { RequestCore } from 'request-api'
import { FetchRequestor } from 'request-imp-fetch'

// 使用 Fetch 实现创建客户端
const apiClient = createApiClient(
  {
    user: UserApi,
  },
  {
    requestor: new FetchRequestor(), // 使用 Fetch 实现
    globalConfig: {
      baseURL: 'https://jsonplaceholder.typicode.com',
      timeout: 5000,
    },
  }
)
```

## ⚡ 核心功能

请求库提供了丰富的企业级功能：

- **🔄 实现切换**: 支持 Axios、Fetch 等多种请求实现，可根据需求选择
- **💾 智能缓存**: 内置多种缓存策略，支持内存、localStorage、indexdb 等存储方式
- **🔁 重试机制**: 自动重试失败请求，支持指数退避策略
- **⚡ 并发控制**: 智能管理并发请求数量，防止服务器过载
- **🔗 链式调用**: 提供流畅的链式 API，代码更优雅
- **📁 文件操作**: 支持文件上传下载，带进度提示
- **📄 分页处理**: 内置分页支持，可自动获取全部数据

## 🚀 快速上手

现在您已经了解了基础用法，可以开始探索更多功能：

- **📖 [基础用法](/guide/basic-usage)** - 详细了解所有基础功能和配置选项
- **🔧 [进阶功能](/guide/advanced-features)** - 探索缓存、重试、并发控制等高级特性
- **🛠️ [故障排除](/guide/troubleshooting)** - 解决常见问题和调试技巧

恭喜！您现在已经掌握了请求库的基本使用方法。如果遇到问题，可以查看 [故障排除指南](/guide/troubleshooting)
