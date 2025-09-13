# 实现层API

## 📖 概述

实现层是请求库架构的基础层，负责提供具体的 HTTP 请求发送能力。该层通过实现统一的 `Requestor` 接口，为上层提供标准化的请求执行服务，同时封装了不同 HTTP 库的差异性。

### 🎯 核心职责

- **接口实现**: 实现 `Requestor` 接口，提供标准化的请求方法
- **协议处理**: 处理 HTTP 协议相关的细节（请求头、参数序列化等）
- **错误标准化**: 将不同 HTTP 库的错误转换为统一的 `RequestError`
- **性能优化**: 处理超时控制、请求取消等性能相关功能
- **环境适配**: 适配不同的运行环境（浏览器、Node.js）

### 🏗️ 架构位置

```
┌─────────────────────────────────────────────┐
│               业务层 (request-bus)            │
├─────────────────────────────────────────────┤
│               核心层 (request-core)           │
├─────────────────────────────────────────────┤
│            实现层 (request-imp-*)            │  ← 当前层级
│  ┌─────────────────┬─────────────────────┐   │
│  │  AxiosRequestor │   FetchRequestor    │   │
│  └─────────────────┴─────────────────────┘   │
└─────────────────────────────────────────────┘
```

### 🎨 设计原则

1. **依赖倒置**: 依赖抽象接口而非具体实现
2. **错误统一**: 统一的错误处理和格式化
3. **配置标准**: 统一的配置接口和参数处理
4. **性能一致**: 相同的超时和取消机制
5. **日志规范**: 统一的日志输出格式

## 🚀 可用实现

目前请求库提供了两个官方实现，分别基于不同的 HTTP 库构建：

### Axios 实现 (`request-imp-axios`)

基于成熟的 [Axios](https://axios-http.com/) 库实现，提供完整的 HTTP 客户端功能。

**特点优势:**
- ✅ 成熟稳定，社区支持广泛
- ✅ 完整的浏览器和 Node.js 支持
- ✅ 内置请求/响应拦截器
- ✅ 自动JSON数据转换
- ✅ 完整的错误处理机制
- ✅ 支持上传进度跟踪
- ✅ 广泛的配置选项

**适用场景:**
- 需要最大兼容性的项目
- 复杂的企业级应用
- 需要细粒度控制的场景
- Node.js 服务端应用

### Fetch 实现 (`request-imp-fetch`)

基于现代浏览器的 [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) 实现，轻量且高效。

**特点优势:**
- ✅ 现代浏览器原生支持
- ✅ 更小的包体积
- ✅ Promise 原生支持
- ✅ 流式响应处理
- ✅ 更好的性能表现
- ✅ 更简洁的API设计

**适用场景:**
- 现代浏览器环境
- 对包体积敏感的项目
- PWA 和移动端应用
- 简单的 HTTP 请求需求

## 📦 Axios 实现详解

### 安装和引入

```bash
npm install request-imp-axios
```

```typescript
import { AxiosRequestor } from 'request-imp-axios'

// 创建实例
const requestor = new AxiosRequestor()
```

### 核心特性

#### 1. 完整的HTTP方法支持

```typescript
// GET 请求
await requestor.request({
  url: '/api/users',
  method: 'GET',
  params: { page: 1, limit: 10 }
})

// POST 请求
await requestor.request({
  url: '/api/users',
  method: 'POST',
  data: { name: 'John', email: 'john@example.com' }
})

// 文件上传
await requestor.request({
  url: '/api/upload',
  method: 'POST',
  data: formData,
  headers: { 'Content-Type': 'multipart/form-data' }
})
```

#### 2. 自动参数处理

```typescript
await requestor.request({
  url: '/api/search',
  method: 'GET',
  params: {
    keyword: 'javascript',
    page: 1,
    size: 20,
    sort: null,      // 自动过滤 null 值
    filter: undefined // 自动过滤 undefined 值
  }
})
// 实际请求: /api/search?keyword=javascript&page=1&size=20
```

#### 3. 响应类型处理

```typescript
// JSON 响应（默认）
const users = await requestor.request<User[]>({
  url: '/api/users',
  method: 'GET'
})

// 文本响应
const text = await requestor.request<string>({
  url: '/api/status',
  method: 'GET',
  responseType: 'text'
})

// 二进制响应
const blob = await requestor.request<Blob>({
  url: '/api/download',
  method: 'GET',
  responseType: 'blob'
})
```

#### 4. 超时和取消控制

```typescript
// 超时控制
await requestor.request({
  url: '/api/data',
  method: 'GET',
  timeout: 5000 // 5秒超时
})

// 手动取消
const controller = new AbortController()
setTimeout(() => controller.abort(), 3000) // 3秒后取消

await requestor.request({
  url: '/api/data',
  method: 'GET',
  signal: controller.signal
})
```

#### 5. 错误处理机制

```typescript
try {
  const data = await requestor.request({
    url: '/api/protected',
    method: 'GET'
  })
} catch (error) {
  if (error instanceof RequestError) {
    switch (error.type) {
      case 'HTTP_ERROR':
        console.log(`HTTP Error: ${error.status}`)
        break
      case 'NETWORK_ERROR':
        console.log('Network error occurred')
        break
      case 'TIMEOUT_ERROR':
        console.log('Request timeout')
        break
    }
  }
}
```

### 实现细节

#### 配置转换

AxiosRequestor 将统一的 `RequestConfig` 转换为 Axios 特有的配置：

```typescript
// 输入配置
const config: RequestConfig = {
  url: '/api/users',
  method: 'GET',
  timeout: 5000,
  headers: { 'Authorization': 'Bearer token' }
}

// 转换为 Axios 配置
const axiosConfig: AxiosRequestConfig = {
  url: '/api/users',
  method: 'GET',
  signal: controller.signal, // 使用 AbortController 替代 timeout
  headers: { 'Authorization': 'Bearer token' },
  withCredentials: false // 与 Fetch 实现保持一致
}
```

#### 错误映射

```typescript
// Axios 错误 -> RequestError 映射
if (axios.isAxiosError(error)) {
  const axiosError = error as AxiosError
  
  // 网络错误
  if (!axiosError.response) {
    throw ErrorHandler.createNetworkError(axiosError.message, context)
  }
  
  // HTTP 状态码错误
  if (axiosError.response.status >= 400) {
    throw ErrorHandler.createHttpError(
      axiosError.response.status,
      axiosError.response.statusText,
      context
    )
  }
}
```

## 🌐 Fetch 实现详解

### 安装和引入

```bash
npm install request-imp-fetch
```

```typescript
import { FetchRequestor } from 'request-imp-fetch'

// 创建实例
const requestor = new FetchRequestor()
```

### 核心特性

#### 1. 现代化请求处理

```typescript
// 基础请求
await requestor.request({
  url: 'https://api.example.com/data',
  method: 'GET'
})

// 带参数的请求
await requestor.request({
  url: 'https://api.example.com/search',
  method: 'GET',
  params: { q: 'keyword', limit: 10 }
})
```

#### 2. 智能 Content-Type 处理

```typescript
// 自动设置 JSON Content-Type
await requestor.request({
  url: '/api/users',
  method: 'POST',
  data: { name: 'John' } // 自动设置 application/json
})

// FormData 自动识别
const formData = new FormData()
formData.append('file', file)
await requestor.request({
  url: '/api/upload',
  method: 'POST',
  data: formData // 不设置 Content-Type，让浏览器自动处理
})
```

#### 3. 流式响应支持

```typescript
// 大文件下载
const response = await requestor.request<Blob>({
  url: '/api/large-file',
  method: 'GET',
  responseType: 'blob'
})

// ArrayBuffer 处理
const buffer = await requestor.request<ArrayBuffer>({
  url: '/api/binary-data',
  method: 'GET',
  responseType: 'arraybuffer'
})
```

## 🔍 实现对比

### 功能对比表

| 功能特性 | Axios 实现 | Fetch 实现 | 说明 |
|----------|-----------|-----------|------|
| **基础功能** ||||
| HTTP 方法支持 | ✅ 全部 | ✅ 全部 | GET, POST, PUT, DELETE 等 |
| 请求头处理 | ✅ 完整 | ✅ 完整 | 自动设置和合并 |
| 参数序列化 | ✅ 自动 | ✅ 自动 | URL参数和请求体 |
| **数据类型支持** ||||
| JSON 数据 | ✅ 自动转换 | ✅ 自动转换 | 请求和响应 |
| FormData | ✅ 完整支持 | ✅ 完整支持 | 文件上传 |
| Blob/ArrayBuffer | ✅ 支持 | ✅ 支持 | 二进制数据 |
| URLSearchParams | ✅ 支持 | ✅ 支持 | 表单编码 |
| ReadableStream | ❌ 有限 | ✅ 原生支持 | 流式数据 |
| **错误处理** ||||
| HTTP 状态码 | ✅ 完整 | ✅ 完整 | 4xx, 5xx 错误 |
| 网络错误 | ✅ 完整 | ✅ 完整 | 连接失败等 |
| 超时错误 | ✅ 完整 | ✅ 完整 | 超时检测 |
| **性能特性** ||||
| 请求取消 | ✅ AbortSignal | ✅ AbortSignal | 统一取消机制 |
| 超时控制 | ✅ 统一实现 | ✅ 统一实现 | AbortController |
| 并发控制 | ✅ 上层控制 | ✅ 上层控制 | RequestCore 负责 |
| **环境支持** ||||
| 现代浏览器 | ✅ 完整 | ✅ 原生 | Chrome 42+ |
| 旧版浏览器 | ✅ 兼容 | ❌ 需 polyfill | IE11 需 polyfill |
| Node.js | ✅ 完整 | ⚠️ 需 polyfill | Node 18+ 原生支持 |
| **包体积** ||||
| 压缩后大小 | ~13KB | ~3KB | 生产环境 |
| 依赖数量 | 多个 | 零依赖 | 外部依赖 |

## 🛠️ 选择指南

### 选择 Axios 实现的场景

**推荐使用 Axios 实现当：**

1. **兼容性要求高** - 需要支持 IE11 或其他旧版浏览器
2. **Node.js 环境** - 服务端应用，成熟的 Node.js 支持
3. **复杂配置需求** - 需要细粒度控制和高级功能
4. **企业级项目** - 需要最大稳定性和详细的错误处理

### 选择 Fetch 实现的场景

**推荐使用 Fetch 实现当：**

1. **现代浏览器环境** - PWA 或现代 Web 应用
2. **包体积敏感** - 移动端或性能要求高的场景
3. **流式数据处理** - 大文件下载或实时数据流
4. **简单的 HTTP 需求** - 基础的 REST API 调用

## 🔧 自定义实现

如果现有的实现不能满足需求，可以创建自定义实现：

```typescript
import { Requestor, RequestConfig, ErrorHandler, LogFormatter } from 'request-core'

class CustomRequestor implements Requestor {
  async request<T>(config: RequestConfig): Promise<T> {
    const startTime = Date.now()
    console.log(LogFormatter.formatRequestStart('CustomRequestor', config.method, config.url))
    
    try {
      // 自定义实现逻辑
      const response = await this.sendRequest(config)
      const result = await this.parseResponse<T>(response, config)
      
      const duration = Date.now() - startTime
      console.log(LogFormatter.formatRequestSuccess('CustomRequestor', config.method, config.url, duration))
      
      return result
    } catch (error) {
      const duration = Date.now() - startTime
      console.error(LogFormatter.formatRequestError('CustomRequestor', config.method, config.url, error, duration))
      
      // 统一错误处理
      throw ErrorHandler.wrapError(error, {
        url: config.url,
        method: config.method
      })
    }
  }
  
  private async sendRequest(config: RequestConfig) {
    // 实现具体的请求发送逻辑
    // 可以基于任何 HTTP 库或原生 API
  }
  
  private async parseResponse<T>(response: any, config: RequestConfig): Promise<T> {
    // 实现响应解析逻辑
  }
}
```

### 集成自定义实现

```typescript
import { RequestCore } from 'request-core'
import { CustomRequestor } from './custom-requestor'

const customRequestor = new CustomRequestor()
const requestCore = new RequestCore(customRequestor)

// 直接使用
const data = await requestCore.get('/api/data')
```

---

**相关文档:**
- [核心层API](/api/request-core) - 了解上层接口
- [业务层API](/api/request-bus) - 了解完整的集成方案
- [架构设计](/concepts/architecture) - 了解整体架构思路