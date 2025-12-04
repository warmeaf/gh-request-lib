# RequestCore 基础方法

在 API 类中，通过 `requestCore` 实例可以使用以下基础请求方法。

## request

基础请求方法，所有其他方法的底层实现。

```typescript
async request<T>(config: RequestConfig): Promise<T>
```

**参数**

```typescript
interface RequestConfig {
  url: string
  method: 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH' | 'HEAD' | 'OPTIONS'
  data?: any
  params?: Record<string, string | number | boolean>
  headers?: Record<string, string>
  timeout?: number
  signal?: AbortSignal
  responseType?: 'json' | 'text' | 'blob' | 'arraybuffer'
  debug?: boolean
  tag?: string
  metadata?: Record<string, unknown>
}
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.request({
      url: `/users/${id}`,
      method: 'GET',
      timeout: 5000,
    })
  }
}
```

## HTTP 方法快捷方式

### get

发起 GET 请求。

```typescript
async get<T>(url: string, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get(`/users/${id}`)
  }

  async getUserWithParams(id: string) {
    return this.requestCore.get(`/users/${id}`, {
      params: { include: 'profile' },
      timeout: 3000,
    })
  }
}
```

### post

发起 POST 请求。

```typescript
async post<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async createUser(userData: any) {
    return this.requestCore.post('/users', userData)
  }

  async createUserWithHeaders(userData: any) {
    return this.requestCore.post('/users', userData, {
      headers: {
        'X-Custom-Header': 'value',
      },
    })
  }
}
```

### put

发起 PUT 请求。

```typescript
async put<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async updateUser(id: string, userData: any) {
    return this.requestCore.put(`/users/${id}`, userData)
  }
}
```

### delete

发起 DELETE 请求。

```typescript
async delete<T>(url: string, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async deleteUser(id: string) {
    return this.requestCore.delete(`/users/${id}`)
  }
}
```

### patch

发起 PATCH 请求。

```typescript
async patch<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async patchUser(id: string, partialData: any) {
    return this.requestCore.patch(`/users/${id}`, partialData)
  }
}
```

### head

发起 HEAD 请求。

```typescript
async head(url: string, config?: Partial<RequestConfig>): Promise<void>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async checkUserExists(id: string) {
    try {
      await this.requestCore.head(`/users/${id}`)
      return true
    } catch {
      return false
    }
  }
}
```

### options

发起 OPTIONS 请求。

```typescript
async options<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T>
```

**示例**

```typescript
class UserApi {
  constructor(public requestCore: RequestCore) {}

  async getUserOptions() {
    return this.requestCore.options('/users')
  }
}
```
