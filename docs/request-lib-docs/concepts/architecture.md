# 架构设计

## 1. 简介

### 背景

虽然前端具有诸多成熟的请求库，但在实际项目开发中发现，它们很难完全契合实际的开发需求。

**axios**

axios 虽然很成熟，但它只是一个基础库，没有提供诸多的上层功能，比如：

1. 请求重试
2. 请求缓存
3. 请求幂等
4. 请求串行
5. 请求并发
6. ...

**VueRequest / SWR**

它们虽然提供的功能很多，但仍然存在诸多问题：

1. 与上层框架过度绑定导致开发场景受限，也无法提供统一的 API
2. 成熟度不够，issue 的回复也难以做到及时，存在一定风险
3. 它们没有聚合基础请求库，仍然需要手动整合

**除此之外更重要的是**

公共库不包含公司内部制定的协议规范，即便使用公共库，也必须针对它们做二次封装。

**综上，需要自行封装一套适配公司业务的前端请求库**

## 2. 技术栈与环境

- **包管理器:** pnpm (利用其 workspace 功能管理多包项目)
- **语言:** TypeScript (提供类型安全和接口定义能力)
- **核心依赖 (可选):**
  - `axios` 或 `fetch` (作为底层请求实现)
  - `spark-md5` (用于请求哈希，实现幂等性)
- **开发环境:** Node.js (LTS 版本), pnpm

## 3. 库结构的宏观设计（架构设计）

### 初始设计

![初始设计](./assets/design01.png)

整个库结构包含三层，从下往上依次是：

- `请求实现层（request-imp）`： 提供请求基本功能
- `request-core`： 提供网络上层控制，比如请求串行、请求并行、请求重试、请求防重等功能
- `request-api`： 为请求绑定业务功能，该层接入公司内部协议规范和接口文档，向外提供业务接口 API

> 层是一种对代码结构的逻辑划分，在具体实现上可以有多种方式：
>
> - 每个层一个 monorepo 子包
> - 每个层一个子文件夹
> - ...

### **<font style="color:rgb(0, 0, 0);">优化设计</font>**

在三层中，请求实现层的实现有多种方式：

- 基于`fetch`原生
- 基于`axios`等第三方库
- ...

<font style="color:rgb(51, 51, 51);">这种实现的多样性可能导致这一次层的不稳定，而</font>`<font style="color:rgb(0, 0, 0);background-color:rgb(240, 240, 240);">request-imp</font>`<font style="color:rgb(51, 51, 51);">是基础层，它的不稳性会传导到上一层。</font>

<font style="color:rgb(51, 51, 51);">所</font><font style="color:rgb(51, 51, 51);">以必须寻求一种方案来隔离这种不稳定性。</font>

<font style="color:rgb(51, 51, 51);">我们可以基于 DIP（Dependence Inversion Principle，依赖倒置原则），彻底将</font>`<font style="color:rgb(0, 0, 0);background-color:rgb(240, 240, 240);">request-core</font>`<font style="color:rgb(51, 51, 51);">和请求的实现解耦，而</font>`<font style="color:rgb(0, 0, 0);background-color:rgb(240, 240, 240);">typescript</font>`<font style="color:rgb(51, 51, 51);">的类型系统让这一切的落地成为了可能。</font>

<font style="color:rgb(51, 51, 51);">于是结构演变为：</font>

![优化设计](./assets/design02.png)

### **<font style="color:rgb(26, 28, 30);">使用示例 (main.ts)</font>**

<font style="color:rgb(26, 28, 30);">最后，应用程序只需要调用 request-api 暴露的业务 API 即可，完全不需要关心底层的实现细节</font>

```typescript
import { createApiClient } from 'request-api'
import type { RequestCore } from 'request-api'
import { AxiosRequestor } from 'request-imp-axios'

// 1. 定义 API 类
class UserApi {
  constructor(private requestCore: RequestCore) {}

  async getUser(id: string) {
    return this.requestCore.get<User>(`/users/${id}`)
  }

  async getUserList() {
    return this.requestCore.get<User[]>('/users')
  }
}

// 2. 创建 API 客户端
const apiClient = createApiClient(
  {
    user: UserApi,
  },
  {
    requestor: new AxiosRequestor(), // 使用 Axios 实现
    globalConfig: {
      baseURL: 'https://jsonplaceholder.typicode.com',
      timeout: 5000,
    },
  }
)

// 3. 使用 API
const user = await apiClient.user.getUser('1')
console.log('User:', user)
```

### **架构图**

```mermaid
graph TD
    %% 用户层
    subgraph UserLayer[🧑‍💻 用户层]
        User[用户代码<br/>业务逻辑]
    end

    %% API抽象层
    subgraph ApiLayer[📦 API层 - request-api]
        ApiFactory[工厂方法]
        ApiClient[API客户端]
        ApiFactory --> ApiClient
    end

    %% 核心业务层
    subgraph CoreLayer[🏗️ 核心层 - request-core]
        RequestCore[RequestCore<br/>核心协调器]

        %% 核心抽象接口
        subgraph CoreAbstractions[核心抽象]
            Requestor{{Requestor接口<br/>📋 请求器契约}}
            RequestConfig[RequestConfig<br/>请求配置]
            Features[高级功能<br/>重试 缓存 并发]
        end

        RequestCore -.->|依赖| Requestor
        RequestCore --> Features
    end

    %% 实现层
    subgraph ImplLayer[⚡ 实现层 - request-imp-*]
        AxiosImpl[AxiosRequestor<br/>🔧 Axios实现]
        FetchImpl[FetchRequestor<br/>🔧 Fetch实现]
        CustomImpl[CustomRequestor<br/>🔧 自定义实现]
    end

    %% 依赖关系流向
    User -->|使用| ApiClient
    ApiClient -->|委托| RequestCore

    %% 依赖倒置核心体现
    Requestor -.->|实现| AxiosImpl
    Requestor -.->|实现| FetchImpl
    Requestor -.->|实现| CustomImpl

    %% 依赖注入
    RequestCore -.->|注入| AxiosImpl
    RequestCore -.->|注入| FetchImpl
    RequestCore -.->|注入| CustomImpl

    %% 样式定义
    classDef userStyle fill:#e3f2fd,stroke:#1976d2,stroke-width:2px
    classDef apiStyle fill:#f3e5f5,stroke:#7b1fa2,stroke-width:2px
    classDef coreStyle fill:#e8f5e8,stroke:#388e3c,stroke-width:2px
    classDef implStyle fill:#fff3e0,stroke:#f57c00,stroke-width:2px
    classDef abstractStyle fill:#fce4ec,stroke:#c2185b,stroke-width:3px,stroke-dasharray: 5 5

    class UserLayer userStyle
    class ApiLayer apiStyle
    class CoreLayer coreStyle
    class ImplLayer implStyle
    class Requestor abstractStyle
```

### **核心理念**

1. **分层**
   - `request-imp-*`: 提供具体的 HTTP 请求发送能力 (如 `request-axios-imp`, `request-fetch-imp`)。它们实现统一的 `Requestor` 接口
   - `request-core`: 核心层，定义 `Requestor` 接口，并基于此接口提供缓存、重试、幂等、并发/串行控制等与具体实现无关的高级功能。通过依赖注入接收 `request-imp` 的具体实现
   - `request-api`: api 层，负责注入 `request-imp` 实现到 `request-core`，调用 `request-core` 提供的功能，集成公司特定业务逻辑和协议规范，并暴露最终给应用使用的 API 函数
2. **依赖倒置 (DIP)**
   - `request-core` 不直接依赖具体的实现 (axios/fetch)，而是依赖抽象的 `Requestor` 接口。具体实现 (`request-imp-*`) 反过来依赖（实现）这个接口。这使得底层实现可以轻松替换，而不影响核心层和业务层。
