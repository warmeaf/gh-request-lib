# 故障排除

本指南帮助您快速诊断和解决使用分层架构请求库时可能遇到的常见问题。我们按问题类型分类，提供详细的诊断步骤和解决方案。

## 🔍 快速诊断工具

### 启用调试模式

```typescript
// 全局调试模式
const apiClient = createApiClient({ user: UserApi }, {
  implementation: 'axios',
  globalConfig: {
    debug: true,
    onStart: (config) => {
      console.log('[Request Start]', {
        method: config.method,
        url: config.url,
        timestamp: new Date().toISOString()
      })
    },
    onEnd: (config, duration) => {
      console.log('[Request End]', {
        method: config.method,
        url: config.url,
        duration: `${duration}ms`
      })
    },
    onError: (config, error, duration) => {
      console.error('[Request Error]', {
        method: config.method,
        url: config.url,
        error: error.message,
        duration: `${duration}ms`
      })
    }
  }
})

// 单个请求调试
const user = await apiClient.user.getUser('123', {
  debug: true,
  tag: 'debug-user-request'
})
```

### 健康检查工具

```typescript
// utils/health-check.ts
export class HealthChecker {
  constructor(private core: RequestCore) {}

  async checkApiHealth(): Promise<HealthReport> {
    const report: HealthReport = {
      timestamp: new Date().toISOString(),
      overallStatus: 'healthy',
      services: {},
      performance: {},
      errors: []
    }

    try {
      // 基础连接测试
      const startTime = performance.now()
      await this.core.get('/health', { timeout: 5000 })
      const responseTime = performance.now() - startTime
      
      report.services.api = {
        status: 'healthy',
        responseTime: Math.round(responseTime)
      }

      // 认证服务检查
      try {
        await this.core.get('/auth/status', { timeout: 3000 })
        report.services.auth = { status: 'healthy' }
      } catch (error) {
        report.services.auth = { 
          status: 'unhealthy', 
          error: error.message 
        }
        report.errors.push(`Auth service error: ${error.message}`)
      }

    } catch (error) {
      report.overallStatus = 'unhealthy'
      report.errors.push(`Health check failed: ${error.message}`)
    }

    return report
  }
}

interface HealthReport {
  timestamp: string
  overallStatus: 'healthy' | 'degraded' | 'unhealthy'
  services: Record<string, ServiceStatus>
  performance: Record<string, any>
  errors: string[]
}

interface ServiceStatus {
  status: 'healthy' | 'unhealthy'
  responseTime?: number
  error?: string
}
```

## 🚨 常见错误及解决方案

### 1. 网络连接错误

#### 错误现象
```
NetworkError: Failed to fetch
RequestError: Network request failed
TypeError: Failed to fetch
```

#### 快速诊断

```typescript
// 网络连接诊断
async function diagnoseNetworkIssue() {
  console.log('🔍 开始网络诊断...')
  
  // 1. 检查基础连接
  try {
    const response = await fetch(window.location.origin)
    console.log('✅ 基础网络连接正常')
  } catch (error) {
    console.error('❌ 基础网络连接失败:', error)
    return
  }

  // 2. 检查API服务器连接
  const API_BASE_URL = 'https://api.example.com'
  try {
    const response = await fetch(`${API_BASE_URL}/health`, {
      method: 'GET',
      mode: 'cors'
    })
    console.log('✅ API服务器连接正常')
  } catch (error) {
    console.error('❌ API服务器连接失败:', error)
    console.log('💡 请检查：')
    console.log('   - API服务器是否运行')
    console.log('   - CORS配置是否正确')
    console.log('   - 防火墙设置')
  }
}
```

#### 解决方案

1. **网络状态监听**
```typescript
// 网络状态监听
window.addEventListener('online', () => {
  console.log('Network is back online')
  apiClient.retryFailedRequests()
})

window.addEventListener('offline', () => {
  console.log('Network is offline')
  apiClient.enableOfflineMode()
})

// 检查当前网络状态
if (!navigator.onLine) {
  console.warn('当前处于离线状态')
}
```

2. **配置重试机制**
```typescript
const apiClient = createApiClient({ user: UserApi }, {
  implementation: 'axios',
  globalConfig: {
    retry: {
      retries: 3,
      retryDelay: 1000,
      retryCondition: (error) => {
        // 仅在网络错误时重试
        return !error.response && error.code !== 'ECONNABORTED'
      }
    },
    timeout: 10000
  }
})
```

3. **CORS问题解决**
```typescript
// 开发环境代理配置
if (process.env.NODE_ENV === 'development') {
  const apiClient = createApiClient({ user: UserApi }, {
    implementation: 'axios',
    globalConfig: {
      baseURL: '/api', // 使用代理
      headers: {
        'Content-Type': 'application/json'
      }
    }
  })
}
```

### 2. 认证授权错误

#### 错误现象
```
401 Unauthorized
403 Forbidden  
AuthenticationError: Token expired
AuthenticationError: Invalid token
```

#### 诊断工具

```typescript
// 认证状态诊断
class AuthDiagnostics {
  static checkAuthStatus() {
    const token = localStorage.getItem('auth_token')
    
    if (!token) {
      console.error('❌ 未找到认证令牌')
      return { valid: false, reason: 'NO_TOKEN' }
    }

    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      const now = Date.now() / 1000
      
      if (payload.exp < now) {
        console.error('❌ 认证令牌已过期')
        return { valid: false, reason: 'TOKEN_EXPIRED' }
      }

      console.log('✅ 认证令牌有效')
      console.log('令牌信息:', {
        userId: payload.sub,
        expiry: new Date(payload.exp * 1000).toLocaleString(),
        roles: payload.roles
      })
      
      return { valid: true, payload }
    } catch (error) {
      console.error('❌ 认证令牌格式错误:', error)
      return { valid: false, reason: 'INVALID_TOKEN' }
    }
  }

  static async testApiAccess() {
    try {
      const response = await apiClient.user.getCurrentUser()
      console.log('✅ API访问正常')
      return true
    } catch (error) {
      console.error('❌ API访问失败:', error.message)
      
      if (error.statusCode === 401) {
        console.log('💡 建议：重新登录获取新的认证令牌')
      } else if (error.statusCode === 403) {
        console.log('💡 建议：检查用户权限设置')
      }
      
      return false
    }
  }
}

// 使用诊断工具
AuthDiagnostics.checkAuthStatus()
AuthDiagnostics.testApiAccess()
```

#### 解决方案

1. **自动令牌刷新**
```typescript
const authInterceptor = {
  request: async (config) => {
    const token = getToken()
    
    if (token && !isTokenExpired(token)) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      }
    } else if (token && isTokenExpired(token)) {
      try {
        const newToken = await refreshAuthToken()
        setToken(newToken)
        config.headers = {
          ...config.headers,
          'Authorization': `Bearer ${newToken}`
        }
      } catch (refreshError) {
        clearTokens()
        window.location.href = '/login'
        throw new Error('Authentication required')
      }
    }

    return config
  },

  error: (error) => {
    if (error.statusCode === 401) {
      clearTokens()
      window.location.href = '/login'
    }
    throw error
  }
}

apiClient.core.addInterceptor(authInterceptor)
```

### 3. 请求超时问题

#### 错误现象
```
TimeoutError: Request timeout
Error: timeout of 5000ms exceeded
```

#### 诊断步骤

```typescript
// 超时问题诊断
class TimeoutDiagnostics {
  static async analyzeSlowRequests() {
    console.log('🔍 分析慢请求...')
    
    const slowRequests = await apiClient.core.getSlowRequests({
      minDuration: 2000, // 超过2秒的请求
      limit: 10
    })

    slowRequests.forEach(req => {
      console.log(`⚠️ 慢请求: ${req.method} ${req.url}`)
      console.log(`   耗时: ${req.duration}ms`)
      console.log(`   可能原因:`, this.analyzePossibleCauses(req))
    })
  }

  private static analyzePossibleCauses(request: any): string[] {
    const causes = []
    
    if (request.duration > 10000) {
      causes.push('网络连接超时或服务器响应慢')
    }
    
    if (request.url.includes('/search') && request.duration > 3000) {
      causes.push('搜索查询可能需要优化')
    }
    
    if (!request.fromCache && request.duration > 1000) {
      causes.push('考虑为此端点启用缓存')
    }
    
    return causes
  }
}
```

#### 解决方案

1. **分级超时设置**
```typescript
const apiClient = createApiClient({ user: UserApi }, {
  implementation: 'axios',
  globalConfig: {
    timeout: 10000, // 全局超时10秒
  }
})

class UserApi extends BaseApi {
  // 快速操作 - 短超时
  async getUser(id: string): Promise<User> {
    return this.core.get<User>(`/users/${id}`, {
      timeout: 5000 // 5秒超时
    })
  }

  // 复杂操作 - 长超时
  async exportUsers(): Promise<Blob> {
    return this.core.get<Blob>('/users/export', {
      timeout: 60000, // 60秒超时
      responseType: 'blob'
    })
  }

  // 搜索操作 - 中等超时
  async searchUsers(query: string): Promise<User[]> {
    return this.core.get<User[]>('/users/search', {
      params: { q: query },
      timeout: 15000 // 15秒超时
    })
  }
}
```

2. **超时重试策略**
```typescript
const retryConfig = {
  retries: 3,
  retryDelay: (retryCount: number) => {
    return Math.min(1000 * Math.pow(2, retryCount), 10000) // 指数退避
  },
  retryCondition: (error) => {
    // 超时错误时重试
    return error.code === 'ECONNABORTED' || error.message.includes('timeout')
  }
}
```

### 4. 缓存相关问题

#### 错误现象
```
获取到过期数据
缓存命中率低
CacheError: Storage quota exceeded
```

#### 诊断工具

```typescript
// 缓存诊断
class CacheDiagnostics {
  static async checkCacheHealth() {
    console.log('🔍 缓存健康检查...')

    // 1. 检查存储适配器
    const adapter = apiClient.core.getCacheAdapter()
    if (!adapter.isAvailable()) {
      console.error('❌ 缓存存储适配器不可用')
      return
    }

    // 2. 检查存储空间
    try {
      const testKey = 'cache-health-test'
      const testData = { test: true, timestamp: Date.now() }
      
      await adapter.setItem({
        key: testKey,
        data: testData,
        timestamp: Date.now(),
        ttl: 1000,
        accessTime: Date.now(),
        accessCount: 0
      })

      const retrieved = await adapter.getItem(testKey)
      if (retrieved && retrieved.data.test) {
        console.log('✅ 缓存读写功能正常')
      }

      await adapter.removeItem(testKey)
    } catch (error) {
      console.error('❌ 缓存操作失败:', error.message)
      
      if (error.name === 'QuotaExceededError') {
        console.log('💡 存储空间不足，建议清理缓存')
      }
    }

    // 3. 性能分析
    const stats = await apiClient.core.getCacheStats()
    console.log('📊 缓存统计:', {
      命中率: `${(stats.hitRate * 100).toFixed(1)}%`,
      缓存大小: `${(stats.size / 1024 / 1024).toFixed(2)}MB`,
      项目数量: stats.itemCount
    })

    if (stats.hitRate < 0.3) {
      console.warn('⚠️ 缓存命中率较低，建议检查缓存策略')
    }
  }
}

// 执行缓存诊断
CacheDiagnostics.checkCacheHealth()
```

#### 解决方案

1. **优化缓存配置**
```typescript
// 不同数据类型的缓存策略
const cacheStrategies = {
  static: { ttl: 24 * 60 * 60 * 1000 }, // 静态数据24小时
  user: { ttl: 30 * 60 * 1000 },         // 用户数据30分钟
  list: { ttl: 5 * 60 * 1000 },          // 列表数据5分钟
  realtime: { enabled: false }           // 实时数据不缓存
}

class UserApi extends BaseApi {
  async getUser(id: string): Promise<User> {
    return this.core.get<User>(`/users/${id}`, {
      cache: cacheStrategies.user,
      tag: `user-${id}`
    })
  }
}
```

2. **存储配额管理**
```typescript
// 监控存储使用情况
if ('storage' in navigator && 'estimate' in navigator.storage) {
  navigator.storage.estimate().then(estimate => {
    const usage = estimate.usage || 0
    const quota = estimate.quota || 0
    const usagePercentage = (usage / quota) * 100

    console.log(`存储使用率: ${usagePercentage.toFixed(1)}%`)
    
    if (usagePercentage > 80) {
      console.warn('⚠️ 存储空间即将耗尽')
      // 执行清理操作
      apiClient.core.clearExpiredCache()
    }
  })
}
```

## 🛠️ 配置问题

### 1. TypeScript 类型错误

#### 错误现象
```typescript
Property 'user' does not exist on type 'ApiClient'
Type 'unknown' is not assignable to type 'User'
```

#### 解决方案

```typescript
// 1. 正确的类型导入
import { createApiClient } from 'request-bus'
import { UserApi } from './api/modules/user/user.api'
import type { User } from './api/modules/user/user.types'

// 2. 正确的 API 客户端类型定义
const apiClient = createApiClient({
  user: UserApi,
  // 其他 API...
}, {
  implementation: 'axios' as const
})

// 3. 类型断言和泛型使用
const user = await apiClient.user.getUser('123') as User
// 或者在 API 方法中已经定义了返回类型，直接使用
const user: User = await apiClient.user.getUser('123')
```

### 2. 构建配置问题

#### Vite 配置

```typescript
// vite.config.ts
import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src')
    }
  },
  build: {
    rollupOptions: {
      external: ['request-core', 'request-bus'],
      output: {
        globals: {
          'request-core': 'RequestCore',
          'request-bus': 'RequestBus'
        }
      }
    }
  },
  optimizeDeps: {
    include: ['request-core', 'request-bus', 'request-imp-axios']
  }
})
```

## 🌐 浏览器兼容性问题

### 1. 检测浏览器支持

```typescript
// utils/browser-support.ts
export class BrowserSupport {
  static checkFeatureSupport(): BrowserSupportReport {
    const support = {
      fetch: 'fetch' in window,
      promise: 'Promise' in window,
      localStorage: this.checkLocalStorage(),
      indexedDB: 'indexedDB' in window,
      webSQL: 'openDatabase' in window,
      crypto: 'crypto' in window && 'subtle' in crypto
    }

    const unsupported = Object.entries(support)
      .filter(([_, supported]) => !supported)
      .map(([feature]) => feature)

    return {
      support,
      unsupported,
      compatible: unsupported.length === 0
    }
  }

  private static checkLocalStorage(): boolean {
    try {
      const testKey = '__localStorage_test__'
      localStorage.setItem(testKey, 'test')
      localStorage.removeItem(testKey)
      return true
    } catch {
      return false
    }
  }
}

interface BrowserSupportReport {
  support: Record<string, boolean>
  unsupported: string[]
  compatible: boolean
}

// 使用示例
const supportReport = BrowserSupport.checkFeatureSupport()
if (!supportReport.compatible) {
  console.warn('⚠️ 浏览器兼容性问题:', supportReport.unsupported)
}
```

## 🚀 性能问题排查

### 1. 请求性能分析

```typescript
// utils/performance-analyzer.ts
export class PerformanceAnalyzer {
  private measurements: PerformanceMeasurement[] = []

  startMeasurement(name: string): void {
    performance.mark(`${name}-start`)
  }

  endMeasurement(name: string): PerformanceMeasurement {
    const endMark = `${name}-end`
    performance.mark(endMark)
    performance.measure(name, `${name}-start`, endMark)
    
    const measure = performance.getEntriesByName(name)[0] as PerformanceMeasure
    const measurement: PerformanceMeasurement = {
      name,
      duration: measure.duration,
      timestamp: Date.now()
    }

    this.measurements.push(measurement)
    return measurement
  }

  generateReport(): PerformanceReport {
    const totalRequests = this.measurements.length
    const averageDuration = totalRequests > 0 
      ? this.measurements.reduce((sum, m) => sum + m.duration, 0) / totalRequests 
      : 0
    
    return {
      totalRequests,
      averageDuration,
      slowOperations: this.measurements.filter(m => m.duration > 1000)
    }
  }
}

interface PerformanceMeasurement {
  name: string
  duration: number
  timestamp: number
}

interface PerformanceReport {
  totalRequests: number
  averageDuration: number
  slowOperations: PerformanceMeasurement[]
}
```

## 📋 问题检查清单

### 快速排查步骤

1. **基础检查**
   - [ ] 检查网络连接状态
   - [ ] 验证 API 服务器是否运行
   - [ ] 确认请求 URL 是否正确
   - [ ] 检查浏览器控制台是否有错误

2. **认证检查**
   - [ ] 验证认证令牌是否存在
   - [ ] 检查令牌是否过期
   - [ ] 确认权限设置是否正确
   - [ ] 测试 API 访问权限

3. **配置检查**
   - [ ] 验证环境变量配置
   - [ ] 检查 TypeScript 类型定义
   - [ ] 确认构建配置正确
   - [ ] 验证代理设置

### 常用调试命令

```typescript
// 在浏览器控制台中运行的调试命令

// 1. 检查 API 客户端状态
console.log('API Client:', window.apiClient)

// 2. 查看缓存统计
window.apiClient?.core.getCacheStats().then(stats => {
  console.log('Cache Stats:', stats)
})

// 3. 测试网络连接
fetch('/api/health').then(r => r.json()).then(console.log).catch(console.error)

// 4. 检查认证状态
console.log('Auth Token:', localStorage.getItem('auth_token'))
```

---

## 📚 相关文档

- 🚀 [快速开始](/guide/getting-started) - 基础配置指南
- 📖 [基础用法](/guide/basic-usage) - 核心功能使用
- 🔧 [高级功能](/guide/advanced-features) - 深度定制功能
- 💡 [最佳实践](/guide/best-practices) - 开发规范建议
- 📋 [API 参考](/api/request-core) - 完整接口文档

## 🆘 获取更多帮助

如果您遇到的问题未在此文档中涵盖：

1. 检查 [GitHub Issues](https://github.com/your-org/request-lib/issues)
2. 提交新的 [Issue](https://github.com/your-org/request-lib/issues/new)
3. 参与 [社区讨论](https://github.com/your-org/request-lib/discussions)

记住：提供详细的错误信息、浏览器版本、环境配置等信息，有助于快速定位和解决问题！
