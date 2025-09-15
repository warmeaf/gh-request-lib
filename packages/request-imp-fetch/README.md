# request-imp-fetch

基于浏览器 Fetch API 的请求实现层，为 `request-core` 提供具体的请求能力实现。

## 特性

- 基于现代浏览器的 Fetch API 实现
- 完整的请求/响应处理能力
- 智能参数过滤（自动过滤 `null` 和 `undefined` 值）
- 统一的超时和取消控制（基于 AbortController）
- 支持多种数据格式（JSON、FormData、Blob、ArrayBuffer、URLSearchParams、ReadableStream 等）
- 智能 Content-Type 设置（仅在必要时添加）
- JSON 解析容错（失败时自动回退到 text）
- 详细的错误分类处理（超时、取消、HTTP、网络错误）
- 自动的请求日志输出
- 默认安全配置（不发送凭据）
- 提供默认实例，开箱即用
- 统一的错误处理机制
- 与 request-core 完美集成

## 安装

```bash
npm install request-imp-fetch
```

## 使用方法

### 基本使用

#### 使用默认实例（推荐）

```typescript
import { fetchRequestor } from 'request-imp-fetch'

// 发送 GET 请求
const data = await fetchRequestor.request({
  url: 'https://api.example.com/users',
  method: 'GET'
})

console.log(data)
```

#### 创建自定义实例

```typescript
import { FetchRequestor } from 'request-imp-fetch'

const requestor = new FetchRequestor()

// 发送 GET 请求
const data = await requestor.request({
  url: 'https://api.example.com/users',
  method: 'GET'
})

console.log(data)
```

### 高级配置

```typescript
import { fetchRequestor } from 'request-imp-fetch'

// 发送 POST 请求
const result = await fetchRequestor.request({
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

### 多种数据格式支持

```typescript
import { fetchRequestor } from 'request-imp-fetch'

// 发送 FormData
const formData = new FormData()
formData.append('file', file)
formData.append('name', 'example')

await fetchRequestor.request({
  url: 'https://api.example.com/upload',
  method: 'POST',
  data: formData // 自动保留 FormData，不设置 Content-Type
})

// 发送 Blob
await fetchRequestor.request({
  url: 'https://api.example.com/upload',
  method: 'POST',
  data: blob // 自动处理 Blob 数据
})

// 发送 URLSearchParams
const params = new URLSearchParams()
params.append('key1', 'value1')
params.append('key2', 'value2')

await fetchRequestor.request({
  url: 'https://api.example.com/form',
  method: 'POST',
  data: params // 自动设置合适的 Content-Type
})
```

### 默认配置

- **超时时间**: 10000ms (10秒)
- **响应类型**: 'json'（失败时自动回退到 'text'）
- **凭据设置**: `credentials: 'omit'`（不发送 cookies 等凭据）
- **参数处理**: 自动过滤 `params` 中的 `null` 和 `undefined` 值
- **Content-Type**: 仅在发送 JSON 数据时自动添加 `application/json`

### 与 request-core 集成

```typescript
import { RequestCore } from 'request-core'
import { fetchRequestor } from 'request-imp-fetch'

const client = new RequestCore(fetchRequestor)

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
import { fetchRequestor } from 'request-imp-fetch'

try {
  const data = await fetchRequestor.request({
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

### FetchRequestor

主要的请求实现类，实现了 `Requestor` 接口。

#### 构造函数

```typescript
new FetchRequestor()
```

#### 默认实例

```typescript
import { fetchRequestor } from 'request-imp-fetch'
// fetchRequestor 是预创建的 FetchRequestor 实例，可直接使用
```

#### 方法

##### request<T>(config: RequestConfig): Promise<T>

发送 HTTP 请求。

**参数:**

- `config`: 请求配置对象
  - `url`: 请求地址
  - `method`: HTTP 方法 (GET, POST, PUT, DELETE 等)
  - `data`: 请求体数据（支持 JSON、FormData、Blob、ArrayBuffer、URLSearchParams、ReadableStream、string）
  - `params`: URL 查询参数（`null` 和 `undefined` 值会被自动过滤）
  - `headers`: 请求头（大小写无关检测，避免重复设置）
  - `timeout`: 超时时间（毫秒，默认 10000）
  - `signal`: AbortSignal 用于取消请求（支持与内部超时机制合并）
  - `responseType`: 响应类型（默认 'json'，支持 'text', 'blob', 'arraybuffer'）

**返回值:**

Promise<T> - 解析后的响应数据

**特殊行为:**

- 自动过滤 `params` 中的 `null` 和 `undefined` 值
- 使用 AbortController 统一处理超时和取消
- 智能 Content-Type 设置（仅在发送 JSON 数据时添加）
- JSON 解析容错（失败时自动回退到 text）
- 默认不发送凭据（cookies 等）
- 自动输出格式化的请求日志
- 提供详细的错误分类（timeout、http、network 等）
- 支持多种原生数据类型，保持其原始特性

## 浏览器兼容性

需要支持以下特性的现代浏览器：

- Fetch API
- Promise
- async/await

| 浏览器 | 版本 |
|--------|------|
| Chrome | 42+ |
| Firefox | 39+ |
| Safari | 10.1+ |
| Edge | 14+ |

## 许可证

ISC