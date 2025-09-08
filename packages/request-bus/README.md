# request-bus

业务层请求总线，提供统一的 API 管理和工厂方法。

## 推荐用法

### 使用工厂方法（推荐，支持树摇）

```typescript
import { createApiClient } from 'request-bus'

// 定义 API 类
class UserApi {
  constructor(private core: RequestCore) {}
  
  async getUser(id: string) {
    return this.core.get<User>(`/users/${id}`)
  }
}

class ProductApi {
  constructor(private core: RequestCore) {}
  
  async getProducts() {
    return this.core.get<Product[]>('/products')
  }
}

// 创建类型安全的 API 客户端
const apiClient = createApiClient({
  user: UserApi,
  product: ProductApi
}, {
  implementation: 'fetch',
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000
  }
})

// 使用
const user = await apiClient.user.getUser('123')
const products = await apiClient.product.getProducts()
```

### 使用单例模式

```typescript
import { register, getApi, setGlobalConfig } from 'request-bus'

// 配置
setGlobalConfig({
  baseURL: 'https://api.example.com',
  timeout: 5000
})

// 注册
register('user', UserApi)
register('product', ProductApi)

// 使用
const userApi = getApi('user')
const user = await userApi.getUser('123')
```

### 开发调试

```typescript
import { devTools } from 'request-bus'

// 开发环境下使用调试工具
if (process.env.NODE_ENV === 'development') {
  devTools.setDebugMode(true)
  console.log('Available APIs:', devTools.listApiNames())
  console.log('Stats:', devTools.getAllStats())
}
```

## 特性

- ✅ 工厂方法支持树摇优化
- ✅ 类型安全的 API 客户端创建
- ✅ 开发工具与生产代码分离
- ✅ 支持多种请求实现（axios/fetch）
- ✅ 统一的错误处理和拦截器
- ✅ 缓存、重试、并发等特性
