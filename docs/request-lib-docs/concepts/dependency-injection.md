# 依赖注入

## 📖 概述

依赖注入（Dependency Injection，简称 DI）是本请求库架构设计的核心技术之一。它使得各个组件之间保持松耦合关系，增强了系统的可测试性、可扩展性和可维护性。本文档将详细介绍依赖注入在项目中的应用和最佳实践。

## 🎯 什么是依赖注入

### 基本概念

**依赖注入**是一种设计模式，用于实现控制反转（IoC）。它的核心思想是：
- 组件不直接创建其所依赖的对象
- 而是通过外部容器或调用者将依赖对象传递给组件
- 这样可以降低组件间的耦合度

### 传统方式 vs 依赖注入

**传统方式（高耦合）**：
```typescript
class RequestCore {
  private requestor: AxiosRequestor
  
  constructor() {
    // 直接创建具体实现，造成强耦合
    this.requestor = new AxiosRequestor()
  }
}
```

**依赖注入方式（低耦合）**：
```typescript
class RequestCore {
  constructor(private requestor: Requestor) {
    // 通过接口注入，依赖抽象而非具体实现
  }
}
```

## 🏗️ 项目中的依赖注入实现

### 1. 核心层的依赖注入

#### RequestCore 构造函数注入

```typescript
export class RequestCore implements ConvenienceExecutor {
  private interceptorManager: InterceptorManager
  private configManager: ConfigManager
  private requestExecutor: RequestExecutor
  private convenienceMethods: ConvenienceMethods
  private featureManager: FeatureManager

  /**
   * 通过依赖注入接收一个实现了 Requestor 接口的实例
   * @param requestor 具体的请求实现者
   * @param globalConfig 全局配置（可选）
   */
  constructor(
    private requestor: Requestor, 
    globalConfig?: GlobalConfig
  ) {
    // 创建管理器实例，将依赖注入到各管理器
    this.interceptorManager = new InterceptorManager()
    this.configManager = new ConfigManager()
    this.requestExecutor = new RequestExecutor(requestor) // 注入 requestor
    this.convenienceMethods = new ConvenienceMethods(this) // 注入 this
    this.featureManager = new FeatureManager(requestor)   // 注入 requestor
    
    if (globalConfig) {
      this.setGlobalConfig(globalConfig)
    }
  }
}
```

**关键特点**：
- RequestCore 不知道具体使用哪种实现（Axios 或 Fetch）
- 依赖于抽象的 `Requestor` 接口
- 各个管理器通过构造函数接收所需依赖

### 2. 管理器层的依赖注入

#### RequestExecutor 的依赖注入

```typescript
export class RequestExecutor {
  constructor(private requestor: Requestor) {
    // 注入请求实现者
  }
  
  async execute<T>(config: RequestConfig): Promise<T> {
    // 使用注入的 requestor 执行请求
    return this.requestor.request<T>(config)
  }
}
```

#### FeatureManager 的依赖注入

```typescript
export class FeatureManager {
  private retryFeature: RetryFeature
  private cacheFeature: CacheFeature
  private concurrentFeature: ConcurrentFeature
  
  constructor(requestor: Requestor) {
    // 将 requestor 注入到各个功能模块
    this.retryFeature = new RetryFeature(requestor)
    this.cacheFeature = new CacheFeature(requestor)
    this.concurrentFeature = new ConcurrentFeature(requestor)
  }
}
```

### 3. 业务层的依赖注入

#### RequestBus 的构造函数注入

```typescript
class RequestBus {
  private apiMap: Map<string, ApiInstance> = new Map()
  private requestCore: RequestCore

  constructor(requestCore: RequestCore) {
    // 注入 RequestCore 实例
    this.requestCore = requestCore
  }
  
  register<T>(name: string, apiClass: ApiClass<T>): T {
    // 创建 API 实例时注入 requestCore
    const apiInstance = new apiClass(this.requestCore)
    this.apiMap.set(name, apiInstance)
    return apiInstance
  }
}
```

#### API 类的依赖注入

```typescript
class UserApi {
  constructor(private core: RequestCore) {
    // 注入 RequestCore 实例
  }
  
  async getUserInfo(id: string) {
    // 使用注入的 core 执行请求
    return this.core.get<User>(`/users/${id}`)
  }
}
```

## 🏭 工厂模式与依赖注入

### 1. RequestCoreFactory

```typescript
export class RequestCoreFactory {
  /**
   * 工厂方法：根据实现类型创建 RequestCore
   * @param implementation 实现类型
   */
  static create(implementation: RequestImplementation = 'axios'): RequestCore {
    let requestor: Requestor
    
    switch (implementation) {
      case 'axios':
        requestor = new AxiosRequestor() // 创建 Axios 实现
        break
      case 'fetch':
        requestor = new FetchRequestor() // 创建 Fetch 实现
        break
      default:
        throw new Error(`Unsupported implementation: ${implementation}`)
    }
    
    // 将选择的实现注入到 RequestCore
    return new RequestCore(requestor)
  }
}
```

### 2. 增强的工厂方法

```typescript
/**
 * 创建配置完整的 RequestCore 实例
 */
export function createRequestCore(
  implementation: RequestImplementation = 'axios',
  options?: {
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
  }
): RequestCore {
  // 通过工厂创建核心实例
  const core = RequestCoreFactory.create(implementation)
  
  // 注入全局配置
  if (options?.globalConfig) {
    core.setGlobalConfig(options.globalConfig)
  }
  
  // 注入拦截器
  if (options?.interceptors?.length) {
    options.interceptors.forEach(i => core.addInterceptor(i))
  }
  
  return core
}
```

### 3. API 客户端工厂

```typescript
/**
 * 创建类型安全的 API 客户端，支持依赖注入
 */
export function createApiClient<T extends Record<string, ApiClass<any>>>(
  apis: T,
  options?: {
    implementation?: RequestImplementation
    globalConfig?: GlobalConfig
    interceptors?: RequestInterceptor[]
    requestCore?: RequestCore  // 支持注入自定义 RequestCore
  }
): { [K in keyof T]: InstanceType<T[K]> } {
  // 优先使用注入的 requestCore，否则创建新实例
  const core = options?.requestCore || createRequestCore(
    options?.implementation ?? 'axios', 
    {
      globalConfig: options?.globalConfig,
      interceptors: options?.interceptors
    }
  )
  
  // 为每个 API 类注入 RequestCore 实例
  const entries = Object.entries(apis).map(([name, ApiCtor]) => {
    const instance = new ApiCtor(core) // 构造函数注入
    return [name, instance]
  }) as Array<[keyof T, InstanceType<T[keyof T]>]>
  
  return Object.fromEntries(entries) as { [K in keyof T]: InstanceType<T[K]> }
}
```

## 💡 使用示例

### 基础用法

```typescript
import { createRequestCore } from 'request-bus'
import { AxiosRequestor, FetchRequestor } from 'request-imp-*'

// 方式1：使用工厂方法（推荐）
const core1 = createRequestCore('axios', {
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000
  }
})

// 方式2：手动依赖注入
const requestor = new AxiosRequestor()
const core2 = new RequestCore(requestor, {
  baseURL: 'https://api.example.com'
})
```

### API 客户端创建

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
    baseURL: 'https://api.example.com'
  }
})

// 使用 API
const user = await apiClient.user.getUser('123')
const products = await apiClient.product.getProducts()
```

### 高级用法：自定义依赖注入

```typescript
import { RequestCore } from 'request-core'
import { CustomRequestor } from './custom-requestor'

// 创建自定义实现
const customRequestor = new CustomRequestor({
  timeout: 10000,
  retries: 3
})

// 手动注入自定义实现
const core = new RequestCore(customRequestor)

// 注入到 API 客户端
const apiClient = createApiClient({
  user: UserApi
}, {
  requestCore: core // 注入自定义 core
})
```

## 🧪 测试中的依赖注入

### Mock 测试

```typescript
import { RequestCore, Requestor, RequestConfig } from 'request-core'

// 创建 Mock 实现
class MockRequestor implements Requestor {
  async request<T>(config: RequestConfig): Promise<T> {
    // 返回模拟数据
    return {
      id: '1',
      name: 'Test User'
    } as unknown as T
  }
}

// 测试用例
describe('UserApi', () => {
  let userApi: UserApi
  let mockRequestor: MockRequestor
  
  beforeEach(() => {
    mockRequestor = new MockRequestor()
    const core = new RequestCore(mockRequestor) // 注入 Mock
    userApi = new UserApi(core)
  })
  
  it('should get user info', async () => {
    const user = await userApi.getUserInfo('1')
    expect(user.name).toBe('Test User')
  })
})
```

### 集成测试

```typescript
import { createRequestCore } from 'request-bus'

// 测试环境使用 Mock 实现
const testCore = createRequestCore('fetch', {
  globalConfig: {
    baseURL: 'http://localhost:3000/api' // 测试服务器
  },
  interceptors: [{
    onRequest: (config) => {
      config.headers = { ...config.headers, 'X-Test': 'true' }
      return config
    }
  }]
})

const apiClient = createApiClient({
  user: UserApi
}, {
  requestCore: testCore // 注入测试配置
})
```

## 🎨 高级特性

### 1. 条件注入

```typescript
function createProductionCore(): RequestCore {
  const implementation = process.env.NODE_ENV === 'production' ? 'axios' : 'fetch'
  
  return createRequestCore(implementation, {
    globalConfig: {
      baseURL: process.env.API_BASE_URL,
      timeout: process.env.REQUEST_TIMEOUT
    }
  })
}
```

### 2. 装饰器注入（可扩展）

```typescript
// 自定义装饰器（示例）
function InjectRequestCore(target: any, propertyKey: string) {
  target[propertyKey] = createRequestCore()
}

class UserService {
  @InjectRequestCore
  private core!: RequestCore
  
  async getUsers() {
    return this.core.get<User[]>('/users')
  }
}
```

### 3. 中间件注入

```typescript
function withMiddleware(core: RequestCore, middleware: RequestInterceptor[]): RequestCore {
  middleware.forEach(interceptor => {
    core.addInterceptor(interceptor)
  })
  return core
}

// 使用中间件
const coreWithAuth = withMiddleware(
  createRequestCore('axios'),
  [authInterceptor, loggingInterceptor]
)
```

## ✅ 最佳实践

### 1. 接口优先原则

```typescript
// ✅ 好的做法：依赖接口
class RequestCore {
  constructor(private requestor: Requestor) {} // 依赖抽象
}

// ❌ 不好的做法：依赖具体实现
class RequestCore {
  constructor() {
    this.requestor = new AxiosRequestor() // 依赖具体实现
  }
}
```

### 2. 构造函数注入

```typescript
// ✅ 推荐：构造函数注入
class UserApi {
  constructor(private core: RequestCore) {
    // 依赖在构造时确定，不可变
  }
}

// ❌ 不推荐：属性注入
class UserApi {
  core: RequestCore | undefined
  
  setCore(core: RequestCore) {
    this.core = core // 依赖可变，容易出错
  }
}
```

### 3. 单一职责原则

```typescript
// ✅ 好的做法：职责单一
class RequestExecutor {
  constructor(private requestor: Requestor) {}
  
  execute<T>(config: RequestConfig): Promise<T> {
    return this.requestor.request<T>(config)
  }
}

// ❌ 不好的做法：职责混合
class RequestExecutor {
  constructor(
    private requestor: Requestor,
    private logger: Logger,
    private cache: Cache,
    private retry: RetryService
  ) {
    // 依赖过多，职责不清晰
  }
}
```

### 4. 工厂方法封装复杂性

```typescript
// ✅ 好的做法：工厂方法隐藏创建复杂性
export function createApiClient<T>(apis: T, options?: ClientOptions) {
  const core = options?.requestCore || createRequestCore(
    options?.implementation ?? 'axios',
    options
  )
  
  return Object.entries(apis).reduce((client, [name, ApiCtor]) => {
    client[name] = new ApiCtor(core)
    return client
  }, {} as any)
}

// ❌ 不好的做法：暴露创建复杂性
// 用户需要手动创建和注入所有依赖
```

## 📊 依赖注入的优势

### 技术优势

1. **松耦合**：组件间通过接口通信，降低耦合度
2. **可测试性**：易于创建 Mock 对象进行单元测试
3. **可扩展性**：新增实现只需实现接口即可
4. **可维护性**：变更某个实现不会影响其他组件

### 开发优势

1. **代码复用**：相同的核心逻辑可以配合不同实现
2. **配置灵活**：通过注入不同配置适应不同环境
3. **调试方便**：可以注入调试版本的依赖
4. **渐进增强**：可以逐步替换和升级依赖

### 业务优势

1. **环境适应**：开发、测试、生产环境使用不同配置
2. **A/B 测试**：运行时切换不同实现进行对比
3. **灾难恢复**：主要服务故障时快速切换备选方案
4. **性能优化**：根据场景选择最优实现

## 🔍 总结

依赖注入是本请求库实现高内聚低耦合的关键技术。通过构造函数注入、工厂模式和接口抽象的结合使用，我们实现了：

- **灵活的架构**：支持多种实现方式和配置选项
- **优秀的可测试性**：通过 Mock 注入简化测试编写
- **出色的可扩展性**：新功能和实现可以无缝集成
- **良好的开发体验**：类型安全的 API 和智能提示

这种设计确保了请求库不仅功能强大，而且具备企业级应用所需的可维护性和可扩展性。
