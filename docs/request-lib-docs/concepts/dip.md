# 依赖倒置

## 架构设计

本请求库采用依赖倒置原则（DIP）构建分层架构，实现了高度的可扩展性和可维护性。

### 核心原则

1. **高层模块不依赖低层模块**，两者都依赖抽象
2. **抽象不依赖细节**，细节依赖抽象

### 架构层次

```
request-api (应用层)
     ↓ 依赖
request-core (抽象层) ← 定义 Requestor 接口
     ↑ 实现
     ├── request-imp-axios (实现层)
     └── request-imp-fetch (实现层)
```

## 关键接口

### Requestor 接口

```typescript
export interface Requestor {
  request<T = unknown>(config: RequestConfig): Promise<T>
}
```

这是整个架构的核心抽象，所有 HTTP 客户端实现都必须实现此接口。

## 实际应用

### 具体实现依赖抽象

```typescript
// request-imp-axios 和 request-imp-fetch 都依赖 request-core 的抽象
import { Requestor, RequestConfig } from 'request-core'

export class AxiosRequestor implements Requestor {
  async request<T>(config: RequestConfig): Promise<T> { /* ... */ }
}

export class FetchRequestor implements Requestor {
  async request<T>(config: RequestConfig): Promise<T> { /* ... */ }
}
```

### 依赖注入和面向接口编程

```typescript
// RequestCore 通过构造函数接收 Requestor 实现
const axiosClient = new RequestCore(new AxiosRequestor())
const fetchClient = new RequestCore(new FetchRequestor())

// 或使用工厂方法
const client = createRequestCore(new AxiosRequestor())
```

## 收益

- **可扩展性**: 轻松添加新的 HTTP 客户端实现（如 XHR、Node.js 原生等）
- **可测试性**: 可以轻松创建 Mock 实现进行单元测试
- **可维护性**: 修改具体实现不影响使用方代码
- **灵活性**: 运行时动态切换不同实现
