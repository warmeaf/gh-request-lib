# request-bus

业务层请求总线，提供统一的 API 管理和工厂方法。

## 功能特性

- ✅ 工厂方法支持树摇优化
- ✅ 类型安全的 API 客户端创建
- ✅ 开发工具与生产代码分离
- ✅ 支持多种请求实现（axios/fetch）
- ✅ 统一的错误处理和拦截器
- ✅ 缓存、重试、并发等特性
- ✅ API 注册和管理
- ✅ 全局配置和拦截器管理
- ✅ 开发调试工具

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

## API 参考

### 核心函数

#### createApiClient(apis, options)
创建类型安全的 API 客户端对象，支持树摇优化。

**参数:**
- `apis`: API 类的映射对象
- `options`: 配置选项
  - `implementation`: 请求实现方式 ('axios' | 'fetch')
  - `globalConfig`: 全局配置
  - `interceptors`: 拦截器数组
  - `requestCore`: 自定义 RequestCore 实例

**返回值:** API 客户端对象

#### createRequestCore(implementation, options)
创建 RequestCore 实例。

**参数:**
- `implementation`: 请求实现方式 ('axios' | 'fetch')
- `options`: 配置选项
  - `globalConfig`: 全局配置
  - `interceptors`: 拦截器数组

**返回值:** RequestCore 实例

#### register(name, apiClass, options)
注册 API 实例。

**参数:**
- `name`: API 名称
- `apiClass`: API 类
- `options`: 配置选项
  - `override`: 是否覆盖已存在的 API
  - `tags`: 标签数组
  - `description`: 描述信息

#### getApi(name)
获取已注册的 API 实例。

**参数:**
- `name`: API 名称

**返回值:** API 实例或 undefined

#### requireApi(name)
安全获取 API 实例，如果不存在则抛出错误。

**参数:**
- `name`: API 名称

**返回值:** API 实例

#### switchImplementation(implementation, options)
切换请求实现方式。

**参数:**
- `implementation`: 请求实现方式 ('axios' | 'fetch')
- `options`: 配置选项
  - `clearCache`: 是否清除缓存
  - `preserveInterceptors`: 是否保留拦截器
  - `preserveGlobalConfig`: 是否保留全局配置

#### setGlobalConfig(config)
设置全局配置。

**参数:**
- `config`: 全局配置对象

#### addGlobalInterceptor(interceptor)
添加全局拦截器。

**参数:**
- `interceptor`: 拦截器对象

#### clearCache(key)
清除缓存。

**参数:**
- `key`: 缓存键（可选，不传则清除所有缓存）

### 开发工具

#### devTools.setDebugMode(enabled)
切换调试模式。

**参数:**
- `enabled`: 是否启用调试模式

#### devTools.listApiNames()
列出所有已注册的 API 名称。

**返回值:** API 名称数组

#### devTools.getAllStats()
获取所有统计信息。

**返回值:** 统计信息对象

#### devTools.getApiInfo(name)
获取 API 详细信息。

**参数:**
- `name`: API 名称（可选，不传则返回所有 API 信息）

#### devTools.help()
显示帮助信息。

## 错误处理

request-bus 使用统一的错误处理机制，所有错误都是 `RequestError` 类型，包含详细的错误信息和建议。

```typescript
import { RequestError, RequestErrorType } from 'request-bus'

try {
  const user = await apiClient.user.getUser('123')
} catch (error) {
  if (error instanceof RequestError) {
    console.log('错误类型:', error.type)
    console.log('错误信息:', error.message)
    console.log('建议:', error.suggestion)
  }
}
```

## 最佳实践

1. **生产环境推荐使用工厂方法**：支持树摇优化，减少打包体积
2. **合理使用拦截器**：全局拦截器会影响所有 API，局部拦截器只影响特定请求
3. **及时清理资源**：在应用销毁时调用 `destroy()` 方法清理资源
4. **开发环境启用调试模式**：便于调试和性能分析
5. **合理配置缓存**：根据业务场景设置合适的缓存时间和策略