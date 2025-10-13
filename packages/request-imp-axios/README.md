# Request-Imp-Axios

基于 Axios 的 HTTP 请求实现层。

## 📖 简介

`request-imp-axios` 实现了 `Requestor` 接口，提供基于 [Axios](https://axios-http.com/) 的 HTTP 请求能力。

### 主要职责

- 🔌 **实现 Requestor 接口**：提供标准化的请求执行能力
- 🔄 **配置转换**：将通用 `RequestConfig` 转换为 Axios 配置
- ⚡ **超时控制**：使用 `AbortController` 统一处理超时和取消
- 🎯 **错误转换**：将 Axios 错误转换为统一的 `RequestError` 格式
- 🧹 **参数过滤**：自动过滤请求参数中的 `null` 和 `undefined` 值

## 📦 安装

```bash
pnpm add request-imp-axios
```

## 🚀 快速开始

```typescript
import { AxiosRequestor, axiosRequestor } from 'request-imp-axios'

// 使用默认实例（推荐）
const requestor = axiosRequestor

// 或创建新实例
const customRequestor = new AxiosRequestor()

// 发送请求
const response = await requestor.request({
  url: 'https://api.example.com/users',
  method: 'GET',
  params: { page: 1 },
  timeout: 5000,
})
```

## 🔧 核心模块

### AxiosRequestor

请求执行器类，实现 `Requestor` 接口。

```typescript
export class AxiosRequestor implements Requestor {
  async request<T>(config: RequestConfig): Promise<T>
}
```

**功能**：

- 执行 HTTP 请求
- 处理超时控制
- 转换错误为统一格式
- 记录性能日志

### config-builder.ts

将通用 `RequestConfig` 转换为 Axios 配置。

```typescript
export function buildAxiosConfig(
  config: RequestConfig,
  filteredParams: Record<string, any> | undefined,
  signal: AbortSignal
): AxiosRequestConfig
```

### error-transformer.ts

将 Axios 错误转换为统一的 `RequestError`。

```typescript
export function transformAxiosError(
  error: unknown,
  config: RequestConfig,
  timeout: number,
  isTimedOut: boolean
): RequestError
```

**处理的错误类型**：

- **超时错误**：`ECONNABORTED`、`ERR_CANCELED` (超时)
- **HTTP 错误**：4xx、5xx 响应
- **网络错误**：连接失败、DNS 解析失败等

### params-filter.ts

过滤请求参数中的 `null` 和 `undefined` 值。

```typescript
export function filterParams(
  params?: Record<string, any>
): Record<string, string | number | boolean> | undefined

// 示例
filterParams({ name: 'Alice', age: null, count: 0 })
// => { name: 'Alice', count: 0 }
```

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

### AxiosRequestor

```typescript
class AxiosRequestor implements Requestor {
  async request<T>(config: RequestConfig): Promise<T>
}
```

**参数**：

- `config: RequestConfig` - 请求配置对象

**返回值**：

- `Promise<T>` - 响应数据

**异常**：

- `RequestError` - 请求失败时抛出

### axiosRequestor

预创建的默认实例，可直接使用：

```typescript
import { axiosRequestor } from 'request-imp-axios'
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

**内部 Axios 配置**：

```typescript
{
  url: config.url,
  method: config.method,
  data: config.data,
  params: filteredParams,       // 自动过滤 null/undefined
  headers: config.headers,
  signal: abortSignal,          // 统一的 AbortSignal
  responseType: 'json',
  withCredentials: false
}
```

## 🐛 错误处理

所有 Axios 错误都会被转换为统一的 `RequestError`：

### 错误类型

**1. 超时错误 (TIMEOUT_ERROR)**

- 触发条件：`ECONNABORTED`、超时取消
- 包含建议信息

**2. HTTP 错误 (HTTP_ERROR)**

- 触发条件：4xx、5xx 状态码
- 包含状态码和建议

**3. 网络错误 (NETWORK_ERROR)**

- 触发条件：连接失败、DNS 解析失败等
- 包含错误原因

### 错误信息

```typescript
interface RequestError {
  message: string // 错误消息
  type: RequestErrorType // 错误类型
  status?: number // HTTP 状态码
  suggestion?: string // 错误建议
  originalError?: unknown // 原始 Axios 错误
}
```

## 🔗 相关链接

- [Axios 官方文档](https://axios-http.com/)
- [request-core](../request-core)
- [request-imp-fetch](../request-imp-fetch)
