# request-imp-axios

基于 Axios 的请求实现层，为 `request-core` 提供具体的请求能力实现。

## 特性

- 基于成熟的 Axios 库实现
- 完整的请求/响应处理能力
- 智能参数过滤（自动过滤 `null` 和 `undefined` 值）
- 统一的超时和取消控制（基于 AbortController）
- 支持各种数据格式（JSON、FormData、Blob 等）
- 详细的错误分类处理（超时、取消、HTTP、网络错误）
- 自动的请求日志输出
- 默认安全配置（不发送凭据）
- 提供默认实例，开箱即用
- 与 request-core 完美集成
- 支持浏览器和 Node.js 环境

## 安装

```bash
npm install request-imp-axios
```

## 使用方法

### 基本使用

#### 使用默认实例（推荐）

```typescript
import { axiosRequestor } from 'request-imp-axios'

// 发送 GET 请求
const data = await axiosRequestor.request({
  url: 'https://api.example.com/users',
  method: 'GET'
})

console.log(data)
```

#### 创建自定义实例

```typescript
import { AxiosRequestor } from 'request-imp-axios'

const requestor = new AxiosRequestor()

// 发送 GET 请求
const data = await requestor.request({
  url: 'https://api.example.com/users',
  method: 'GET'
})

console.log(data)
```

### 高级配置

```typescript
import { axiosRequestor } from 'request-imp-axios'

// 发送 POST 请求
const result = await axiosRequestor.request({
  url: 'https://api.example.com/users',
  method: 'POST',
  data: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  params: {
    page: 1,
    size: 10,
    filter: null // 会被自动过滤掉
  },
  headers: {
    'Authorization': 'Bearer your-token'
  },
  timeout: 5000, // 5秒超时（默认10秒）
  responseType: 'json', // 响应类型（默认 'json'）
  signal: controller.signal // 支持外部取消控制
})

console.log(result)
```

### 默认配置

- **超时时间**: 10000ms (10秒)
- **响应类型**: 'json'
- **凭据设置**: `withCredentials: false`（不发送 cookies 等凭据）
- **参数处理**: 自动过滤 `params` 中的 `null` 和 `undefined` 值

### 与 request-core 集成

```typescript
import { RequestCore } from 'request-core'
import { axiosRequestor } from 'request-imp-axios'

const client = new RequestCore(axiosRequestor)

// 使用缓存功能
const data = await client.get('https://api.example.com/data', {
  cache: {
    ttl: 300000 // 5分钟缓存
  }
})

console.log(data)
```

### 错误处理

该实现提供了详细的错误分类：

```typescript
import { axiosRequestor } from 'request-imp-axios'

try {
  const data = await axiosRequestor.request({
    url: 'https://api.example.com/data',
    method: 'GET',
    timeout: 5000
  })
  console.log(data)
} catch (error) {
  if (error.type === 'timeout') {
    console.error('Request timeout:', error.message)
  } else if (error.type === 'http') {
    console.error('HTTP error:', error.status, error.message)
  } else if (error.type === 'network') {
    console.error('Network error:', error.message)
  } else {
    console.error('Unknown error:', error)
  }
}
```

## API

### AxiosRequestor

主要的请求实现类，实现了 `Requestor` 接口。

#### 构造函数

```typescript
new AxiosRequestor()
```

#### 默认实例

```typescript
import { axiosRequestor } from 'request-imp-axios'
// axiosRequestor 是预创建的 AxiosRequestor 实例，可直接使用
```

#### 方法

##### request<T>(config: RequestConfig): Promise<T>

发送 HTTP 请求。

**参数:**

- `config`: 请求配置对象
  - `url`: 请求地址
  - `method`: HTTP 方法 (GET, POST, PUT, DELETE 等)
  - `data`: 请求体数据
  - `params`: URL 查询参数（`null` 和 `undefined` 值会被自动过滤）
  - `headers`: 请求头
  - `timeout`: 超时时间（毫秒，默认 10000）
  - `signal`: AbortSignal 用于取消请求（支持与内部超时机制合并）
  - `responseType`: 响应类型（默认 'json'，支持 'text', 'blob', 'arraybuffer', 'document', 'stream'）

**返回值:**

Promise<T> - 解析后的响应数据

**特殊行为:**

- 自动过滤 `params` 中的 `null` 和 `undefined` 值
- 使用 AbortController 统一处理超时和取消
- 默认不发送凭据（cookies 等）
- 自动输出格式化的请求日志
- 提供详细的错误分类（timeout、http、network 等）

## 依赖

- [Axios](https://axios-http.com/) - 基于 promise 的 HTTP 库

## 许可证

ISC