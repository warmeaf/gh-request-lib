# 基础用法

本文档详细介绍请求库的所有基础功能和使用方法。如果你是初次使用，建议先阅读 [快速开始](/guide/getting-started) 了解基本概念。

## 🔑 核心概念

### 分层架构

请求库采用三层架构设计：

- **核心层 (RequestCore)**: 提供基础请求能力和高级功能
- **实现层 (request-imp-*)**: 基于具体请求库的实现 
- **业务层 (request-bus)**: API组织和业务逻辑封装

### 基本工作流程

```typescript
import { createApiClient } from 'request-bus'

// 1. 定义 API 类
class UserApi {
  constructor(private core: RequestCore) {}
  
  async getUser(id: string) {
    return this.core.get<User>(`/users/${id}`)
  }
}

// 2. 创建 API 客户端
const apiClient = createApiClient({ user: UserApi }, {
  implementation: 'axios',
  globalConfig: { baseURL: 'https://api.example.com' }
})

// 3. 调用 API
const user = await apiClient.user.getUser('123')
```

## 📡 基础 HTTP 方法

### GET 请求

用于获取数据的基础方法：

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  // 基础 GET 请求
  async getUser(id: string) {
    return this.core.get<User>(`/users/${id}`)
  }
  
  // 带查询参数的 GET 请求
  async getUserList(params?: { 
    page?: number
    limit?: number 
    search?: string 
  }) {
    return this.core.get<User[]>('/users', { params })
  }
  
  // 带自定义头部的 GET 请求
  async getUserWithAuth(id: string, token: string) {
    return this.core.get<User>(`/users/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json'
      }
    })
  }
}
```

### POST 请求

用于创建或提交数据：

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  // 基础 POST 请求
  async createUser(userData: Partial<User>) {
    return this.core.post<User>('/users', userData)
  }
  
  // 带额外配置的 POST 请求
  async createUserWithOptions(userData: Partial<User>) {
    return this.core.post<User>('/users', userData, {
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })
  }
  
  // 表单数据提交
  async uploadUserAvatar(userId: string, formData: FormData) {
    return this.core.post<{ url: string }>(`/users/${userId}/avatar`, formData, {
      headers: {
        'Content-Type': 'multipart/form-data'
      }
    })
  }
}
```

### PUT 和 PATCH 请求

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  // 完整更新用户
  async updateUser(id: string, userData: User) {
    return this.core.put<User>(`/users/${id}`, userData)
  }
  
  // 部分更新用户
  async patchUser(id: string, partialData: Partial<User>) {
    return this.core.patch<User>(`/users/${id}`, partialData)
  }
}
```

### DELETE 请求

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  // 删除用户
  async deleteUser(id: string) {
    return this.core.delete(`/users/${id}`)
  }
  
  // 批量删除
  async batchDeleteUsers(ids: string[]) {
    return this.core.delete('/users/batch', { data: { ids } })
  }
}
```

## ⚙️ 请求配置

### 基础配置选项

每个请求都支持丰富的配置选项：

```typescript
interface RequestConfig {
  url: string                                    // 请求URL
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  data?: any                                     // 请求体数据
  params?: Record<string, any>                   // URL查询参数
  headers?: Record<string, string>               // 请求头
  timeout?: number                               // 超时时间(ms)
  signal?: AbortSignal                          // 取消信号
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer'  // 响应类型
  debug?: boolean                               // 调试模式
  tag?: string                                  // 请求标签
  metadata?: Record<string, unknown>            // 自定义元数据
}
```

### 实际使用示例

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  async getUser(id: string) {
    return this.core.get<User>(`/users/${id}`, {
      // 超时配置
      timeout: 5000,
      
      // 自定义请求头
      headers: {
        'Accept': 'application/json',
        'Authorization': 'Bearer token'
      },
      
      // 查询参数
      params: {
        include: ['profile', 'settings'],
        fields: 'id,name,email'
      },
      
      // 调试模式
      debug: true,
      tag: 'get-user'
    })
  }
}
```

### 全局配置

通过全局配置设置默认选项：

```typescript
const apiClient = createApiClient({ user: UserApi }, {
  implementation: 'axios',
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 10000,
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'MyApp/1.0'
    },
    params: {
      version: 'v1'  // 所有请求都会包含这个参数
    }
  }
})
```

## 🛡️ 错误处理

### 错误类型

请求库提供了详细的错误分类：

```typescript
import { RequestError, RequestErrorType } from 'request-core'

class UserApi {
  constructor(private core: RequestCore) {}
  
  async getUser(id: string) {
    try {
      return await this.core.get<User>(`/users/${id}`)
    } catch (error) {
      if (error instanceof RequestError) {
        switch (error.type) {
          case RequestErrorType.NETWORK_ERROR:
            console.log('网络连接失败')
            break
          case RequestErrorType.TIMEOUT_ERROR:
            console.log('请求超时')
            break
          case RequestErrorType.VALIDATION_ERROR:
            console.log('参数验证失败:', error.message)
            break
          case RequestErrorType.SERVER_ERROR:
            console.log('服务器错误:', error.statusCode, error.message)
            break
        }
        
        // 获取错误建议
        if (error.suggestion) {
          console.log('建议:', error.suggestion)
        }
      }
      throw error
    }
  }
}
```

## 🔄 拦截器

拦截器允许你在请求发送前和响应返回后执行自定义逻辑。

### 请求拦截器

```typescript
const apiClient = createApiClient({ user: UserApi }, {
  implementation: 'axios',
  interceptors: [{
    request: (config) => {
      // 添加认证头
      const token = localStorage.getItem('authToken')
      if (token) {
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${token}`
        }
      }
      
      // 添加请求时间戳
      config.headers['X-Request-Time'] = new Date().toISOString()
      
      // 日志记录
      console.log('发送请求:', config.method, config.url)
      
      return config
    }
  }]
})
```

### 响应拦截器

```typescript
const apiClient = createApiClient({ user: UserApi }, {
  implementation: 'axios',
  interceptors: [{
    response: (response) => {
      // 统一处理响应格式
      if (response.data && typeof response.data === 'object') {
        // 假设后端返回 { code: 0, data: actual_data, message: 'success' } 格式
        if (response.data.code === 0) {
          return response.data.data  // 返回实际数据
        } else {
          throw new Error(response.data.message || 'Request failed')
        }
      }
      
      return response.data
    }
  }]
})
```

### 错误拦截器

```typescript
const apiClient = createApiClient({ user: UserApi }, {
  implementation: 'axios',
  interceptors: [{
    error: (error) => {
      // 全局错误处理
      if (error.response?.status === 401) {
        // 处理认证失败
        console.log('认证失败，重定向到登录页')
        // window.location.href = '/login'
      } else if (error.response?.status === 403) {
        // 处理权限不足
        console.log('权限不足')
      } else if (error.response?.status >= 500) {
        // 处理服务器错误
        console.log('服务器错误')
      }
      
      // 继续抛出错误
      throw error
    }
  }]
})
```

## 🗄️ 缓存功能

### 基础缓存使用

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  // 使用便捷的缓存方法（5分钟缓存）
  async getUserList() {
    return this.core.getWithCache<User[]>('/users', {
      ttl: 300000  // 5分钟
    })
  }
  
  // 使用详细缓存配置
  async getUser(id: string) {
    return this.core.get<User>(`/users/${id}`, {
      cache: {
        enabled: true,
        ttl: 600000,        // 10分钟缓存
        storage: 'memory',  // 或 'localStorage'
        key: `user-${id}`,  // 自定义缓存键
        tags: ['user', 'profile']  // 缓存标签
      }
    })
  }
}
```

### 缓存管理

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  async getUserWithCacheControl(id: string, forceRefresh = false) {
    if (forceRefresh) {
      // 清除特定缓存
      this.core.clearCache(`user-${id}`)
    }
    
    return this.core.get<User>(`/users/${id}`, {
      cache: {
        enabled: !forceRefresh,
        ttl: 300000,
        key: `user-${id}`
      }
    })
  }
  
  // 清除所有用户相关缓存
  clearUserCache() {
    this.core.clearCacheByTag('user')
  }
}
```

## 🔄 重试机制

### 基础重试

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  // 简单重试（最多3次）
  async getUser(id: string) {
    return this.core.getWithRetry<User>(`/users/${id}`, 3)
  }
  
  // 高级重试配置
  async getRobustUser(id: string) {
    return this.core.get<User>(`/users/${id}`, {
      retry: {
        retries: 3,               // 最多重试3次
        delay: 1000,             // 基础延迟1秒
        backoff: 'exponential',  // 指数退避策略
        maxDelay: 10000,         // 最大延迟10秒
        retryCondition: (error) => {
          // 仅在特定条件下重试
          const status = error.response?.status
          return !status || status >= 500 || status === 429
        }
      }
    })
  }
}
```

## ⚡ 并发控制

### 并发请求

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  // 获取多个用户（并发限制为3）
  async getMultipleUsers(ids: string[]) {
    const requests = ids.map(id => ({ url: `/users/${id}` }))
    
    return this.core.getMultiple<User>(requests, {
      concurrency: 3,  // 最多同时3个请求
      onProgress: (completed, total) => {
        console.log(`Progress: ${completed}/${total}`)
      }
    })
  }
  
  // 顺序请求（一个接一个）
  async getSequentialUsers(ids: string[]) {
    const requests = ids.map(id => ({ url: `/users/${id}` }))
    return this.core.getSequential<User>(requests)
  }
}
```

## 📁 文件操作

### 文件上传

```typescript
class FileApi {
  constructor(private core: RequestCore) {}
  
  // 单文件上传
  async uploadAvatar(file: File) {
    return this.core.uploadFile<{ url: string }>('/upload/avatar', file, {
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress}%`)
      }
    })
  }
  
  // 多文件上传
  async uploadDocuments(files: File[]) {
    return this.core.uploadMultipleFiles<{ urls: string[] }>('/upload/documents', files, {
      onProgress: (progress) => {
        console.log(`Upload progress: ${progress}%`)
      },
      concurrency: 2  // 同时上传2个文件
    })
  }
}
```

### 文件下载

```typescript
class FileApi {
  constructor(private core: RequestCore) {}
  
  // 文件下载
  async downloadFile(fileId: string, filename: string) {
    return this.core.downloadFile(`/files/${fileId}/download`, filename)
  }
  
  // 获取文件 Blob
  async getFileBlob(fileId: string) {
    return this.core.get<Blob>(`/files/${fileId}`, {
      responseType: 'blob'
    })
  }
}
```

## 📄 分页处理

```typescript
class PostApi {
  constructor(private core: RequestCore) {}
  
  // 获取分页数据
  async getPosts(params: { page: number, limit: number }) {
    return this.core.getPaginated<Post>('/posts', params)
  }
  
  // 获取所有文章（自动分页）
  async getAllPosts() {
    return this.core.getAllPaginated<Post>('/posts', {
      limit: 50,        // 每页50条
      maxPages: 10,     // 最多获取10页
      onProgress: (page, total) => {
        console.log(`Loading page ${page}, total items: ${total}`)
      }
    })
  }
}
```

## 🔗 链式调用 API

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  // 使用链式调用构建复杂请求
  async searchUsers(keyword: string) {
    return this.core.request()
      .url('/users/search')
      .method('GET')
      .params({ q: keyword, limit: 20 })
      .headers({ 'Accept': 'application/json' })
      .timeout(8000)
      .retry(2)
      .cache(300000)  // 5分钟缓存
      .tag('user-search')
      .debug(true)
      .send<User[]>()
  }
}
```

## 💡 最佳实践

### 1. API 类组织

```typescript
// api/modules/user.ts
export class UserApi {
  constructor(private core: RequestCore) {}
  
  // 获取操作
  async getUser(id: string) { /* ... */ }
  async getUserList(params?: any) { /* ... */ }
  
  // 创建操作
  async createUser(data: Partial<User>) { /* ... */ }
  
  // 更新操作
  async updateUser(id: string, data: Partial<User>) { /* ... */ }
  
  // 删除操作
  async deleteUser(id: string) { /* ... */ }
}

// api/index.ts
export { UserApi } from './modules/user'

export const createAppApiClient = () => {
  return createApiClient({
    user: UserApi
  }, {
    implementation: 'axios',
    globalConfig: {
      baseURL: process.env.VUE_APP_API_BASE_URL,
      timeout: 10000
    }
  })
}
```

### 2. 错误处理策略

```typescript
// utils/error-handler.ts
export const handleApiError = (error: any) => {
  if (error instanceof RequestError) {
    switch (error.type) {
      case RequestErrorType.NETWORK_ERROR:
        return '网络连接失败，请检查网络设置'
      case RequestErrorType.TIMEOUT_ERROR:
        return '请求超时，请稍后重试'
      case RequestErrorType.SERVER_ERROR:
        return '服务器错误，请联系技术支持'
      default:
        return error.message || '未知错误'
    }
  }
  return '系统错误'
}
```

### 3. 缓存策略

```typescript
class UserApi {
  constructor(private core: RequestCore) {}
  
  // 短期缓存：用户列表（5分钟）
  async getUserList() {
    return this.core.getWithCache<User[]>('/users', {
      ttl: 5 * 60 * 1000,
      tags: ['user-list']
    })
  }
  
  // 长期缓存：用户详情（30分钟）
  async getUser(id: string) {
    return this.core.getWithCache<User>(`/users/${id}`, {
      ttl: 30 * 60 * 1000,
      tags: ['user-detail', `user-${id}`]
    })
  }
  
  // 更新后清除相关缓存
  async updateUser(id: string, data: Partial<User>) {
    const result = await this.core.put<User>(`/users/${id}`, data)
    
    // 清除相关缓存
    this.core.clearCacheByTag('user-list')
    this.core.clearCacheByTag(`user-${id}`)
    
    return result
  }
}
```

---

## 📚 相关文档

- 🚀 [快速开始](/guide/getting-started) - 快速上手指南
- 🔧 [高级功能](/guide/advanced-features) - 探索更多高级特性  
- 💡 [使用示例](/examples/basic-requests) - 实际使用案例
- 📋 [API 参考](/api/request-core) - 完整的 API 文档

## 🆘 获取帮助

如果在使用过程中遇到问题：

1. 查看 [常见问题](/guide/troubleshooting)
2. 浏览 [使用示例](/examples/basic-requests)
3. 提交 [GitHub Issue](https://github.com/your-org/request-lib/issues)
4. 参与 [社区讨论](https://github.com/your-org/request-lib/discussions)
