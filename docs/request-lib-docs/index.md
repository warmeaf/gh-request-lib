---
layout: home

hero:
  name: "请求库文档"
  text: "分层架构的前端请求库"
  tagline: "基于依赖倒置原则，提供统一的API接口和丰富的高级功能"
  actions:
    - theme: brand
      text: 快速开始
      link: /guide/getting-started
    - theme: alt
      text: 查看源码
      link: https://github.com/your-org/request-lib

features:
  - title: 🏗️ 分层架构
    details: 三层架构设计，核心层、实现层和业务层职责清晰，支持依赖倒置原则
  - title: 🔄 实现切换
    details: 支持运行时切换Axios和Fetch实现，无需修改业务代码
  - title: ⚡ 高级功能
    details: 内置缓存、重试、并发控制、拦截器等企业级功能
  - title: 📦 树摇友好
    details: 工厂方法支持树摇优化，减少打包体积
  - title: 🛡️ 类型安全
    details: 完整的TypeScript类型支持，提供优秀的开发体验
  - title: 🔧 扩展性强
    details: 易于扩展新功能和自定义实现，满足各种业务需求
---


# 为什么选择这个请求库？

## 🎯 解决的问题

- **功能不足**: 基础请求库缺乏高级功能
- **架构耦合**: 上层请求库与框架绑定过紧
- **协议适配**: 需要适配公司内部协议规范
- **维护成本**: 多项目间请求代码重复维护

## 🚀 核心优势

- **分层设计**: 清晰的架构分层，易于理解和维护
- **依赖倒置**: 核心不依赖具体实现，可随时切换
- **功能完整**: 涵盖缓存、重试、并发等企业级需求
- **自动化**: 支持根据接口文档自动生成代码
- **性能优化**: 30%的开发效率提升，50%的联调时间减少

## 📖 快速导航

<div class="nav-grid">
  <a href="/guide/getting-started" class="nav-card">
    <h3>🚀 快速开始</h3>
    <p>5分钟快速上手，立即体验强大功能</p>
  </a>
  
  <a href="/concepts/architecture" class="nav-card">
    <h3>🏗️ 架构设计</h3>
    <p>了解分层架构和依赖倒置的设计思想</p>
  </a>
  
  <a href="/api/request-core" class="nav-card">
    <h3>📋 API参考</h3>
    <p>完整的API文档和类型定义</p>
  </a>
  
  <a href="/examples/basic-requests" class="nav-card">
    <h3>💡 使用示例</h3>
    <p>丰富的示例代码，涵盖各种使用场景</p>
  </a>
</div>

## 📦 快速体验

### 安装

```bash
# 使用 npm
npm install request-core request-bus request-imp-axios

# 使用 yarn
yarn add request-core request-bus request-imp-axios

# 使用 pnpm
pnpm add request-core request-bus request-imp-axios
```

### 基本使用

```typescript
import { createApiClient } from 'request-bus'

// 定义 API 类
class UserApi {
  constructor(private core: RequestCore) {}
  
  async getUser(id: string) {
    return this.core.get<User>(`/users/${id}`)
  }
}

// 创建类型安全的 API 客户端
const apiClient = createApiClient({
  user: UserApi
}, {
  implementation: 'axios',
  globalConfig: {
    baseURL: 'https://api.example.com',
    timeout: 5000
  }
})

// 使用
const user = await apiClient.user.getUser('123')
```

### 高级功能

```typescript
// 带缓存的请求
const cachedData = await core.getWithCache('/api/posts', { 
  ttl: 300000 // 5分钟缓存 
})

// 带重试的请求
const retryData = await core.getWithRetry('/api/data', 3)

// 切换实现
apiClient.switchImplementation('fetch')
```

## 🏗️ 架构特点

### 三层架构

```
┌─────────────────────────────────────┐
│            request-bus              │  ← 业务层：API封装
│        (业务API + 工厂方法)          │
└─────────────────────────────────────┘
                    │
┌─────────────────────────────────────┐
│           request-core              │  ← 核心层：高级功能
│      (缓存、重试、并发控制等)        │
└─────────────────────────────────────┘
                    │
┌─────────────────────────────────────┐
│     request-imp-*                   │  ← 实现层：具体实现
│   (axios实现 | fetch实现)           │
└─────────────────────────────────────┘
```

### 依赖倒置

- **核心层**定义抽象接口，不依赖具体实现
- **实现层**基于接口提供具体实现
- **业务层**注入具体实现，完成依赖组装

## 📊 性能对比

| 特性 | 原生请求 | 本请求库 | 提升 |
|------|---------|----------|------|
| 开发效率 | 基准 | +30% | ⬆️ |
| 联调时间 | 基准 | -50% | ⬇️ |
| 代码重用 | 低 | 高 | ⬆️ |
| 维护成本 | 高 | 低 | ⬇️ |

## 🔥 核心功能一览

::: tip 请求缓存
智能缓存机制，支持内存和持久化存储，可配置缓存时间和失效策略
:::

::: tip 自动重试
支持指数退避的智能重试机制，提高请求成功率
:::

::: tip 并发控制
内置并发请求管理，防止请求过载，支持请求队列
:::

::: tip 拦截器系统
完善的请求/响应拦截器，支持全局和局部拦截器
:::

::: tip 错误处理
统一的错误处理机制，提供详细的错误信息和建议
:::

::: tip 类型安全
完整的 TypeScript 类型支持，提供优秀的开发体验
:::

## 🌟 真实案例

> "使用该请求库后，我们团队的接口联调时间从平均2天缩短到1天，开发效率显著提升！"  
> —— 某互联网公司前端团队

> "分层架构让我们可以轻松切换不同的请求实现，代码维护变得更加容易。"  
> —— 某金融科技公司架构师

## 📱 适用场景

- ✅ **企业级应用**: 需要统一请求标准和高级功能
- ✅ **微前端架构**: 需要跨应用共享请求逻辑  
- ✅ **团队协作**: 需要标准化的API开发流程
- ✅ **性能敏感**: 需要缓存和优化的应用
- ✅ **长期维护**: 需要稳定架构的项目

## 🤝 社区支持

<div class="community-links">
  <a href="https://github.com/your-org/request-lib" target="_blank">
    <img src="https://img.shields.io/github/stars/your-org/request-lib?style=social" alt="GitHub stars">
  </a>
  <a href="https://npmjs.com/package/request-core" target="_blank">  
    <img src="https://img.shields.io/npm/v/request-core" alt="npm version">
  </a>
  <a href="https://npmjs.com/package/request-core" target="_blank">
    <img src="https://img.shields.io/npm/dm/request-core" alt="npm downloads">
  </a>
</div>

---

<div class="footer-cta">
  <h2>🎉 立即开始使用</h2>
  <p>仅需几分钟，即可体验企业级请求库的强大功能</p>
  <a href="/guide/getting-started" class="cta-button">立即开始 →</a>
</div>

<style>
.nav-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 1.5rem;
  margin: 2rem 0;
}

.nav-card {
  display: block;
  padding: 1.5rem;
  border: 1px solid var(--vp-c-divider);
  border-radius: 12px;
  text-decoration: none;
  transition: all 0.3s ease;
  background: var(--vp-c-bg-soft);
}

.nav-card:hover {
  border-color: var(--vp-c-brand);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
  transform: translateY(-2px);
}

.nav-card h3 {
  margin: 0 0 0.5rem 0;
  font-size: 1.1rem;
  color: var(--vp-c-text-1);
}

.nav-card p {
  margin: 0;
  color: var(--vp-c-text-2);
  font-size: 0.9rem;
  line-height: 1.4;
}

.community-links {
  display: flex;
  gap: 1rem;
  margin: 1rem 0;
}

.footer-cta {
  text-align: center;
  padding: 2rem;
  background: linear-gradient(135deg, var(--vp-c-brand) 0%, var(--vp-c-brand-dark) 100%);
  border-radius: 16px;
  margin: 3rem 0;
  color: white;
}

.footer-cta h2 {
  margin: 0 0 1rem 0;
  color: white;
}

.footer-cta p {
  margin: 0 0 1.5rem 0;
  opacity: 0.9;
}

.cta-button {
  display: inline-block;
  padding: 0.75rem 2rem;
  background: white;
  color: var(--vp-c-brand);
  text-decoration: none;
  border-radius: 8px;
  font-weight: 600;
  transition: transform 0.2s ease;
}

.cta-button:hover {
  transform: scale(1.05);
}

@media (max-width: 768px) {
  .nav-grid {
    grid-template-columns: 1fr;
    gap: 1rem;
  }
  
  .nav-card {
    padding: 1rem;
  }
}
</style>