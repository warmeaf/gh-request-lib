# Request-Imp-Fetch

基于 Fetch API 的 HTTP 请求实现层。

## 📖 简介

`request-imp-fetch` 实现了 `Requestor` 接口，提供基于浏览器原生 [Fetch API](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API) 的 HTTP 请求能力。

### 主要职责

- 🔌 **实现 Requestor 接口**：提供标准化的请求执行能力
- 🌐 **URL 构建**：将参数对象转换为查询字符串并附加到 URL
- 📦 **请求体构建**：处理不同类型的请求体（JSON、FormData、Blob 等）
- ⚡ **超时控制**：使用 `AbortController` 统一处理超时和取消
- 📄 **响应解析**：根据类型解析响应（json、text、blob、arraybuffer）
- 🎯 **错误转换**：将 Fetch 错误转换为统一的 `RequestError` 格式
- 🔧 **请求头管理**：提供大小写无关的请求头操作

## 📦 安装

```bash
pnpm add request-imp-fetch
```

## 🚀 快速开始

```typescript
import { FetchRequestor, fetchRequestor } from 'request-imp-fetch'

// 使用默认实例（推荐）
const requestor = fetchRequestor

// 或创建新实例
const customRequestor = new FetchRequestor()

// 发送请求
const response = await requestor.request({
  url: 'https://api.example.com/users',
  method: 'GET',
  params: { page: 1 },
  timeout: 5000,
})
```

## 🔧 核心模块

### FetchRequestor

请求执行器类，实现 `Requestor` 接口。

```typescript
export class FetchRequestor implements Requestor {
  async request<T>(config: RequestConfig): Promise<T>
}
```

**功能**：

- 执行 HTTP 请求
- 处理超时控制
- 转换错误为统一格式
- 记录性能日志

### url-builder.ts

构建带查询参数的 URL。

```typescript
export function buildUrlWithParams(
  url: string,
  params?: Record<string, any>
): string

// 示例
buildUrlWithParams('/api/users', { page: 1, limit: 10 })
// => '/api/users?page=1&limit=10'
```

**功能**：
- 自动过滤 `null` 和 `undefined` 值
- 使用 `URLSearchParams` 进行参数编码
- 支持相对和绝对 URL

### body-builder.ts

构建请求体并自动设置 `Content-Type`。

```typescript
export function buildRequestBody(
  data: any,
  method: string,
  headers: Record<string, string>
): BodyInit | undefined
```

**支持的数据类型**：
- **对象**：自动转换为 JSON，设置 `Content-Type: application/json`
- **字符串**：直接使用，设置 `Content-Type: application/json`
- **FormData**：直接使用，浏览器自动设置 Content-Type
- **Blob**：直接使用
- **ArrayBuffer**：直接使用
- **URLSearchParams**：直接使用
- **ReadableStream**：直接使用（流式上传）

### error-transformer.ts

将 Fetch 错误转换为统一的 `RequestError`。

```typescript
export function transformFetchError(
  error: unknown,
  config: RequestConfig,
  timeout: number,
  isTimedOut: boolean
): RequestError
```

**处理的错误类型**：

- **超时错误**：`AbortError` (超时)
- **HTTP 错误**：`response.ok === false`
- **网络错误**：连接失败、CORS 错误等

### response-parser.ts

根据指定类型解析响应数据。

```typescript
export async function parseResponse<T>(
  response: Response,
  responseType: ResponseType = 'json'
): Promise<T>
```

**支持的响应类型**：
- `'json'`：解析为 JSON（默认，失败时降级为 text）
- `'text'`：解析为文本
- `'blob'`：解析为 Blob
- `'arraybuffer'`：解析为 ArrayBuffer

### headers-utils.ts

大小写无关的请求头操作工具。

```typescript
export function hasHeaderIgnoreCase(
  headers: Record<string, string>,
  key: string
): boolean

export function setHeaderIfAbsent(
  headers: Record<string, string>,
  key: string,
  value: string
): void
```

**功能**：
- 检查请求头是否存在（忽略大小写）
- 仅在不存在时设置请求头

### timeout-controller.ts

使用 `AbortController` 统一处理超时和取消。

```typescript
export function createTimeoutController(
  timeout: number,
  externalSignal?: AbortSignal
): TimeoutControllerResult
```

**功能**：

- 创建超时控制器
- 合并外部 `AbortSignal`
- 区分超时和手动取消

## 📚 API 参考

### FetchRequestor

```typescript
class FetchRequestor implements Requestor {
  async request<T>(config: RequestConfig): Promise<T>
}
```

**参数**：

- `config: RequestConfig` - 请求配置对象

**返回值**：

- `Promise<T>` - 响应数据

**异常**：

- `RequestError` - 请求失败时抛出

### fetchRequestor

预创建的默认实例，可直接使用：

```typescript
import { fetchRequestor } from 'request-imp-fetch'
```

## 🛠️ 配置选项

支持的 `RequestConfig` 选项：

```typescript
interface RequestConfig {
  url: string                    // 请求 URL
  method: 'GET' | 'POST' | ...  // HTTP 方法
  data?: RequestData            // 请求体
  params?: RequestParams        // URL 参数
  headers?: Record<string, string> // 请求头
  timeout?: number              // 超时时间（毫秒）
  signal?: AbortSignal          // 取消信号
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer'
}
```

**内部 Fetch 配置**：

```typescript
{
  method: method.toUpperCase(),
  headers: headers,
  credentials: 'omit',          // 不发送凭据（与 Axios 对齐）
  redirect: 'follow',
  referrerPolicy: 'strict-origin-when-cross-origin',
  signal: abortSignal,          // 统一的 AbortSignal
  body: buildRequestBody(...)   // 自动构建请求体
}
```

## 🐛 错误处理

所有 Fetch 错误都会被转换为统一的 `RequestError`：

### 错误类型

**1. 超时错误 (TIMEOUT_ERROR)**

- 触发条件：`AbortError` + 超时标志
- 包含建议信息

**2. HTTP 错误 (HTTP_ERROR)**

- 触发条件：`response.ok === false`
- 包含状态码和建议

**3. 网络错误 (NETWORK_ERROR)**

- 触发条件：连接失败、CORS 错误等
- 包含错误原因

### 错误信息

```typescript
interface RequestError {
  message: string // 错误消息
  type: RequestErrorType // 错误类型
  status?: number // HTTP 状态码
  suggestion?: string // 错误建议
  originalError?: unknown // 原始 Fetch 错误
}
```

## ⚡ 特性

### 1. 自动 Content-Type 设置

根据请求体类型自动设置 `Content-Type`：

```typescript
// 对象 → application/json
await requestor.request({ 
  url: '/api/users', 
  method: 'POST',
  data: { name: 'Alice' } 
})

// FormData → multipart/form-data（浏览器自动设置）
const formData = new FormData()
formData.append('file', file)
await requestor.request({ 
  url: '/api/upload', 
  method: 'POST',
  data: formData 
})
```

### 2. 智能响应解析

`json` 类型解析失败时自动降级为 `text`：

```typescript
// 如果响应不是有效的 JSON，返回原始文本
const data = await requestor.request({
  url: '/api/data',
  method: 'GET',
  responseType: 'json' // 失败时自动降级为 text
})
```

### 3. 参数自动过滤

自动过滤 `null` 和 `undefined` 参数：

```typescript
const params = {
  name: 'Alice',
  age: null,
  city: undefined,
  page: 1
}

// 实际 URL: /api/users?name=Alice&page=1
await requestor.request({ url: '/api/users', method: 'GET', params })
```

### 4. 大小写无关的请求头

避免重复设置相同的请求头（忽略大小写）：

```typescript
const headers = {
  'content-type': 'application/json',
  'Authorization': 'Bearer token'
}

// setHeaderIfAbsent 不会重复设置 Content-Type
setHeaderIfAbsent(headers, 'Content-Type', 'text/plain')
// headers 仍然是 'content-type': 'application/json'
```

## 🔗 相关链接

- [Fetch API 文档](https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API)
- [request-core](../request-core)
- [request-imp-axios](../request-imp-axios)
