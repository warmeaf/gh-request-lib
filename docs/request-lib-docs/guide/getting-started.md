# 快速开始

本指南帮助你快速上手分层架构的前端请求库。

## 安装

```bash
# 安装必需的包
npm install request-core request-api request-imp-axios
# or
pnpm add request-core request-api request-imp-axios
```

> 更详细的安装选项请查看 [安装指南](/guide/installation)

## 基础使用

创建 API 类并使用：

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
    requestor: new AxiosRequestor(),
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

## 使用 Fetch 实现

如果更倾向于使用 Fetch API，可以轻松切换：

```bash
# 安装 Fetch 实现
npm install request-core request-api request-imp-fetch
```

```typescript
import { createApiClient } from 'request-api'
import type { RequestCore } from 'request-api'
import { FetchRequestor } from 'request-imp-fetch'

const apiClient = createApiClient(
  {
    user: UserApi,
  },
  {
    requestor: new FetchRequestor(),
    globalConfig: {
      baseURL: 'https://jsonplaceholder.typicode.com',
      timeout: 5000,
    },
  }
)
```

## 核心功能

- **实现切换**: 支持 Axios、Fetch 等多种请求实现
- **智能缓存**: 内置多种缓存策略
- **重试机制**: 自动重试失败请求
- **并发控制**: 智能管理并发请求数量
- **链式调用**: 提供流畅的链式 API
- **文件操作**: 支持文件上传下载
- **分页处理**: 内置分页支持
