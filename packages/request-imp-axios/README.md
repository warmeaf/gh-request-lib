# request-imp-axios

基于 Axios 的请求实现层，为 `request-core` 提供具体的请求能力实现。

## 特性

- 基于成熟的 Axios 库实现
- 完整的请求/响应处理能力
- 支持超时控制
- 支持各种数据格式（JSON、FormData、Blob 等）
- 统一的错误处理机制
- 与 request-core 完美集成
- 支持浏览器和 Node.js 环境

## 安装

```bash
npm install request-imp-axios
```

## 使用方法

### 基本使用

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
import { AxiosRequestor } from 'request-imp-axios'

const requestor = new AxiosRequestor()

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
import { AxiosRequestor } from 'request-imp-axios'

const requestor = new AxiosRequestor()
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

### AxiosRequestor

主要的请求实现类，实现了 `Requestor` 接口。

#### 构造函数

```typescript
new AxiosRequestor()
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
  - `responseType`: 响应类型 ('json', 'text', 'blob', 'arraybuffer', 'document', 'stream')

**返回值:**

Promise<T> - 解析后的响应数据

## 依赖

- [Axios](https://axios-http.com/) - 基于 promise 的 HTTP 库

## 许可证

ISC