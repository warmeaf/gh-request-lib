# 分层架构前端请求库

基于依赖倒置原则的分层架构前端请求库，提供统一的 API 接口和丰富的高级功能。

## 🏗️ 架构设计

本项目采用三层架构设计：

### 1. **核心层 (request-core)**
- 定义 `Requestor` 抽象接口
- 提供请求重试、缓存等高级功能
- 与具体实现解耦，遵循依赖倒置原则

### 2. **实现层 (request-imp-*)**
- `request-imp-axios`: 基于 Axios 的实现
- `request-imp-fetch`: 基于 Fetch API 的实现
- 实现 `Requestor` 接口，可随时切换

### 3. **业务层 (request-bus)**
- 集成核心层和实现层
- 提供业务相关的 API 封装
- 支持公司内部协议规范

## 📦 项目结构

```
├── packages/                     # 核心包目录
│   ├── request-core/             # 核心层：接口定义和高级功能
│   │   ├── src/
│   │   │   ├── features/         # 功能模块
│   │   │   │   ├── cache.ts      # 请求缓存
│   │   │   │   └── retry.ts      # 请求重试
│   │   │   ├── core.ts           # 核心类
│   │   │   ├── interface.ts      # 接口定义
│   │   │   └── index.ts          # 入口文件
│   │   └── package.json
│   │
│   ├── request-imp-axios/        # Axios 实现层
│   ├── request-imp-fetch/        # Fetch 实现层
│   └── request-bus/              # 业务层
│       ├── src/
│       │   ├── apis/             # 业务 API
│       │   │   ├── user.ts       # 用户相关 API
│       │   │   └── post.ts       # 文章相关 API
│       │   ├── config.ts         # 配置管理
│       │   └── index.ts          # 统一导出
│       └── package.json
│
├── apps/
│   └── demo-browser/             # 浏览器演示应用
└── README.md
```

## 🚀 快速开始

### 1. 安装依赖

```bash
pnpm install
```

### 2. 构建项目

```bash
# 构建所有包
pnpm run build

# 构建浏览器版本
pnpm run build:browser
```

### 3. 运行演示

```bash
# Node.js 环境演示
pnpm run demo

# 浏览器环境演示
pnpm run demo:browser
# 然后访问 http://localhost:3000
```

## 💡 使用示例

### 浏览器环境使用

```html
<!DOCTYPE html>
<html>
<head>
    <script type="module">
        import { busApi } from 'request-bus'
        
        // 获取用户信息（带重试）
        const user = await busApi.user.getUserInfo('1')
        console.log(user)
        
        // 获取用户列表（带缓存）
        const users = await busApi.user.getUserList()
        console.log(users)
    </script>
</head>
</html>
```

### Node.js 环境使用

```typescript
import { busApi } from 'request-bus'

// 获取用户信息（带重试）
const user = await busApi.user.getUserInfo('1')
console.log(user)

// 获取用户列表（带缓存）
const users = await busApi.user.getUserList()
console.log(users)
```

### CDN 使用

```html
<script src="https://unpkg.com/your-request-lib/dist/request-lib.umd.js"></script>
<script>
    const { busApi } = RequestLib
    
    busApi.user.getUserInfo('1').then(user => {
        console.log(user)
    })
</script>
```

### 切换请求实现

```typescript
// 切换到 Fetch 实现
busApi.switchImplementation('fetch')

// 切换到 Axios 实现
busApi.switchImplementation('axios')
```

### 直接使用核心层

```typescript
import { RequestCore } from 'request-core'
import { AxiosRequestor } from 'request-imp-axios'

const requestor = new AxiosRequestor()
const core = new RequestCore(requestor)

// 带重试的请求
const data = await core.getWithRetry('/api/users', 3)

// 带缓存的请求
const cachedData = await core.getWithCache('/api/posts', { ttl: 300000 })
```

## 🔧 核心功能

### 1. 请求重试
- 自动重试失败的请求
- 可配置重试次数和延迟时间
- 支持指数退避策略

### 2. 请求缓存
- 内存级别的请求缓存
- 可配置缓存时间 (TTL)
- 支持自定义缓存键

### 3. 实现切换
- 运行时切换 Axios/Fetch 实现
- 无需修改业务代码
- 完全透明的切换过程

### 4. 类型安全
- 完整的 TypeScript 类型支持
- 泛型支持，确保类型安全
- 良好的 IDE 智能提示

## 📚 API 文档

### RequestCore

核心请求类，提供统一的请求接口。

```typescript
class RequestCore {
  // 基础请求方法
  request<T>(config: RequestConfig): Promise<T>
  get<T>(url: string, config?: Partial<RequestConfig>): Promise<T>
  post<T>(url: string, data?: any, config?: Partial<RequestConfig>): Promise<T>
  
  // 高级功能
  getWithRetry<T>(url: string, retries?: number): Promise<T>
  getWithCache<T>(url: string, cacheConfig?: CacheConfig): Promise<T>
  requestWithRetry<T>(config: RequestConfig, retryConfig?: RetryConfig): Promise<T>
  requestWithCache<T>(config: RequestConfig, cacheConfig?: CacheConfig): Promise<T>
  
  // 缓存管理
  clearCache(key?: string): void
}
```

### BusApi

业务层 API，提供具体的业务接口。

```typescript
class BusApi {
  user: UserApi      // 用户相关 API
  post: PostApi      // 文章相关 API
  
  // 切换实现
  switchImplementation(implementation: 'axios' | 'fetch'): void
  
  // 清除缓存
  clearAllCache(): void
}
```

## 🔄 扩展指南

### 添加新的实现层

1. 创建新的实现包 `request-imp-xxx`
2. 实现 `Requestor` 接口
3. 在 `request-bus` 中添加配置

```typescript
// 示例：添加新的实现
export class CustomRequestor implements Requestor {
  async request<T>(config: RequestConfig): Promise<T> {
    // 自定义实现逻辑
    return customRequest(config)
  }
}
```

### 添加新的业务 API

1. 在 `packages/request-bus/src/apis/` 下创建新文件
2. 使用 `RequestConfig.getInstance()` 获取核心实例
3. 在 `index.ts` 中导出

```typescript
// 示例：添加商品 API
export class ProductApi {
  private core = RequestConfig.getInstance()
  
  async getProducts(): Promise<Product[]> {
    return this.core.getWithCache('/api/products')
  }
}
```

## 🎯 设计原则

1. **依赖倒置 (DIP)**: 核心层依赖抽象而非具体实现
2. **单一职责**: 每个层次都有明确的职责边界
3. **开闭原则**: 对扩展开放，对修改封闭
4. **可替换性**: 实现层可以随时替换而不影响上层

## 📈 性能优化

- 内置请求缓存减少重复请求
- 智能重试机制提高成功率
- TypeScript 编译时优化
- Tree-shaking 友好的模块设计

## 🤝 贡献指南

1. Fork 本仓库
2. 创建功能分支 (`git checkout -b feature/amazing-feature`)
3. 提交更改 (`git commit -m 'Add some amazing feature'`)
4. 推送到分支 (`git push origin feature/amazing-feature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 ISC 许可证 - 查看 [LICENSE](LICENSE) 文件了解详情。
