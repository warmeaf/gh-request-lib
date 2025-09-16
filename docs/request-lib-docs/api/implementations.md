# 实现层API

## 📖 概述

实现层提供具体的 HTTP 请求发送能力，通过实现统一的 `Requestor` 接口，封装不同 HTTP 库的差异性。

### 🎯 核心职责

- 实现 `Requestor` 接口，提供标准化的请求方法
- 处理 HTTP 协议细节（请求头、参数序列化等）
- 将不同 HTTP 库的错误转换为统一的 `RequestError`
- 统一的超时控制和请求取消机制

## 🚀 可用实现

### Axios 实现 (`request-imp-axios`)

基于成熟的 [Axios](https://axios-http.com/) 库实现。

**特点:**
- ✅ 成熟稳定，完整的浏览器和 Node.js 支持
- ✅ 自动JSON数据转换，完整的错误处理
- ✅ 支持上传进度跟踪，广泛的配置选项

**适用场景:** 企业级应用、Node.js 服务端、需要最大兼容性的项目

### Fetch 实现 (`request-imp-fetch`)

基于现代浏览器的 [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) 实现。

**特点:**
- ✅ 现代浏览器原生支持，更小的包体积（~3KB）
- ✅ Promise 原生支持，流式响应处理
- ✅ 更好的性能表现

**适用场景:** 现代浏览器环境、PWA 应用、对包体积敏感的项目

## 📦 基本使用

### 安装和导入

```bash
npm install request-imp-axios
# 或
npm install request-imp-fetch
```

```typescript
import { AxiosRequestor } from 'request-imp-axios'
import { FetchRequestor } from 'request-imp-fetch'

const axiosRequestor = new AxiosRequestor()
const fetchRequestor = new FetchRequestor()
```

### 核心特性

#### 统一的请求接口

```typescript
// 基础用法
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

// 超时和取消控制
const controller = new AbortController()
await requestor.request({
  url: '/api/data',
  method: 'GET',
  timeout: 5000,
  signal: controller.signal
})
```

#### 自动功能处理

- **参数过滤**: 自动过滤 `null` 和 `undefined` 参数
- **响应类型**: 支持 `json`、`text`、`blob`、`arraybuffer`
- **错误标准化**: 统一的 `RequestError` 错误格式
- **日志记录**: 统一的请求日志格式


## 🔍 实现对比

| 特性 | Axios 实现 | Fetch 实现 |
|------|-----------|-----------|
| **包体积** | ~13KB | ~3KB |
| **环境支持** | 浏览器 + Node.js | 现代浏览器 |
| **兼容性** | IE11+ | Chrome 42+ |
| **依赖** | 有外部依赖 | 零依赖 |
| **流式数据** | 有限支持 | 原生支持 |
| **错误处理** | 完整 | 完整 |
| **超时取消** | AbortSignal | AbortSignal |

## 🛠️ 选择指南

### 选择 Axios 实现

**适合场景:**
- 需要支持旧版浏览器（IE11+）或 Node.js 服务端
- 企业级项目，需要最大稳定性
- 复杂配置需求和细粒度控制

### 选择 Fetch 实现

**适合场景:**
- 现代浏览器环境的 PWA 或 Web 应用
- 对包体积敏感的移动端项目
- 需要流式数据处理的场景

## 🔧 自定义实现

如需创建自定义实现，需要实现 `Requestor` 接口：

```typescript
import { Requestor, RequestConfig, ErrorHandler } from 'request-core'

class CustomRequestor implements Requestor {
  async request<T>(config: RequestConfig): Promise<T> {
    try {
      // 1. 发送请求的具体实现
      const response = await this.sendRequest(config)
      // 2. 解析响应数据
      return this.parseResponse<T>(response, config)
    } catch (error) {
      // 3. 统一错误处理
      throw ErrorHandler.wrapError(error, {
        url: config.url,
        method: config.method
      })
    }
  }
  
  private async sendRequest(config: RequestConfig) {
    // 基于任何 HTTP 库的具体实现
  }
  
  private parseResponse<T>(response: any, config: RequestConfig): T {
    // 响应解析逻辑
  }
}
```

**使用自定义实现:**
```typescript
import { RequestCore } from 'request-core'

const customRequestor = new CustomRequestor()
const requestCore = new RequestCore(customRequestor)
const data = await requestCore.get('/api/data')
```