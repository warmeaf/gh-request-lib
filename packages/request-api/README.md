# Request API

请求库API层 - 组装和暴露给应用的最终 API

## 分层架构

### 1. 类型层 (Types Layer) - `src/types/`
- **ApiClass** - API类的接口定义
- **ApiInstance** - API实例的接口定义  
- **类型重导出** - 从request-core重导出常用类型

### 2. 核心层 (Core Layer) - `src/core/`
- **factory.ts** - 创建RequestCore实例的工厂方法
- 负责RequestCore的创建和初始化配置

### 3. 客户端层 (Client Layer) - `src/client/`
- **api-client.ts** - 增强的API客户端实现
- 提供API实例集合管理
- 统一的缓存、配置、拦截器管理接口

## 主要功能

### createRequestCore
创建独立的RequestCore实例，支持全局配置和拦截器初始化。

```typescript
import { createRequestCore } from 'request-api'

const core = createRequestCore(requestor, {
  globalConfig: { baseURL: 'https://api.example.com' },
  interceptors: [authInterceptor, logInterceptor]
})
```

### createApiClient  
创建包含多个API实例的客户端对象，提供统一管理接口。

```typescript
import { createApiClient } from 'request-api'

const client = createApiClient(
  {
    user: UserApi,
    order: OrderApi
  },
  {
    requestor: fetchRequestor,
    globalConfig: { baseURL: 'https://api.example.com' }
  }
)

// 使用API
const user = await client.user.getUser('123')
const order = await client.order.getOrder('456')

// 管理功能
client.clearCache()
client.setGlobalConfig(newConfig)
client.addInterceptor(newInterceptor)
```

## API客户端增强功能

- **缓存管理**: `clearCache()`, `getCacheStats()`
- **全局配置**: `setGlobalConfig()`  
- **拦截器管理**: `addInterceptor()`, `clearInterceptors()`
- **实用方法**: `destroy()`, `getAllStats()``

## 测试结构

- `__test__/types.test.ts` - 类型接口测试
- `__test__/core/factory.test.ts` - 工厂方法测试  
- `__test__/client/api-client.test.ts` - API客户端测试
- `__test__/index.test.ts` - 导出测试
- `__test__/integration.test.ts` - 集成测试

## 设计原则

1. **分层清晰** - 按功能职责分层，便于维护和测试
2. **类型安全** - 完整的TypeScript类型定义
3. **便于树摇** - 支持按需导入，减少打包体积
4. **统一管理** - 提供统一的API客户端管理接口
5. **可扩展性** - 支持自定义API类和配置扩展