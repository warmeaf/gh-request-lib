# request-imp-fetch

基于浏览器 Fetch API 的请求实现层，为 `request-core` 提供具体的请求能力实现。

## 特性

- 基于现代浏览器的 Fetch API 实现
- 完整的请求/响应处理能力
- 支持超时控制
- 支持各种数据格式（JSON、FormData、Blob、ArrayBuffer 等）
- 自动设置合适的 Content-Type 头
- 统一的错误处理机制
- 与 request-core 完美集成

## 安装

```bash
npm install request-imp-fetch
```

## 使用方法

### 基本使用

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
import { FetchRequestor } from 'request-imp-fetch'

const requestor = new FetchRequestor()

// 发送 POST 请求
const result = await requestor.request({
  url: 'https://api.example.com/users',
  method: 'POST',
  data: {
    name: 'John Doe',
    email: 'john@example.com'
  },
  headers: {
    'Authorization': 'Bearer your-token'
  },
  timeout: 5000, // 5秒超时
  responseType: 'json' // 响应类型
})

console.log(result)
```

### 与 request-core 集成

```typescript
import { RequestCore } from 'request-core'
import { FetchRequestor } from 'request-imp-fetch'

const requestor = new FetchRequestor()
const client = new RequestCore(requestor)

// 使用缓存功能
const data = await client.get('https://api.example.com/data', {
  cache: {
    ttl: 300000 // 5分钟缓存
  }
})

console.log(data)
```

## API

### FetchRequestor

主要的请求实现类，实现了 `Requestor` 接口。

#### 构造函数

```typescript
new FetchRequestor()
```

#### 方法

##### request<T>(config: RequestConfig): Promise<T>

发送 HTTP 请求。

**参数:**

- `config`: 请求配置对象
  - `url`: 请求地址
  - `method`: HTTP 方法 (GET, POST, PUT, DELETE 等)
  - `data`: 请求体数据
  - `params`: URL 查询参数
  - `headers`: 请求头
  - `timeout`: 超时时间（毫秒）
  - `signal`: AbortSignal 用于取消请求
  - `responseType`: 响应类型 ('json', 'text', 'blob', 'arraybuffer')

**返回值:**

Promise<T> - 解析后的响应数据

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