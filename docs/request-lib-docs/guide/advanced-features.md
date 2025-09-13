# 高级功能

本文档介绍请求库的高级功能和深度定制能力。这些功能适合有经验的开发者和需要精细控制的企业级应用场景。

## 🚀 高级缓存系统

### 多种存储适配器

请求库提供了四种存储适配器，满足不同场景的缓存需求：

```typescript
import { StorageType } from 'request-core'

// 1. 内存存储 - 最快，但进程退出后数据丢失
const memoryCache = createApiClient(
  { user: UserApi },
  {
    implementation: 'axios',
    globalConfig: {
      cache: {
        storageType: StorageType.MEMORY,
        maxEntries: 1000,
      },
    },
  }
)

// 2. LocalStorage - 持久化，但容量有限
const localStorageCache = createApiClient(
  { user: UserApi },
  {
    implementation: 'axios',
    globalConfig: {
      cache: {
        storageType: StorageType.LOCAL_STORAGE,
        maxEntries: 500,
      },
    },
  }
)

// 3. IndexedDB - 大容量，现代浏览器推荐
const indexedDBCache = createApiClient(
  { user: UserApi },
  {
    implementation: 'axios',
    globalConfig: {
      cache: {
        storageType: StorageType.INDEXED_DB,
        maxEntries: 10000,
      },
    },
  }
)

// 4. WebSQL - 已废弃，仅兼容性需要
const webSQLCache = createApiClient(
  { user: UserApi },
  {
    implementation: 'axios',
    globalConfig: {
      cache: {
        storageType: StorageType.WEB_SQL,
        maxEntries: 2000,
      },
    },
  }
)
```

### 高级缓存失效策略

```typescript
import {
  LRUInvalidationPolicy,
  FIFOInvalidationPolicy,
  TimeBasedInvalidationPolicy,
  CustomInvalidationPolicy,
} from 'request-core'

class CacheManager {
  // 1. LRU策略 - 最近最少使用
  getLRUPolicy() {
    return new LRUInvalidationPolicy({
      maxEntries: 1000,
      maxSize: 50 * 1024 * 1024, // 50MB
    })
  }

  // 2. FIFO策略 - 先进先出
  getFIFOPolicy() {
    return new FIFOInvalidationPolicy({
      maxEntries: 500,
    })
  }

  // 3. 时间基础策略 - 基于时间和TTL
  getTimeBasedPolicy() {
    return new TimeBasedInvalidationPolicy({
      defaultTTL: 30 * 60 * 1000, // 30分钟
      maxAge: 24 * 60 * 60 * 1000, // 24小时绝对过期
    })
  }

  // 4. 自定义策略 - 复杂业务逻辑
  getCustomPolicy() {
    return new CustomInvalidationPolicy((item, context) => {
      // 自定义失效逻辑
      const now = Date.now()
      const itemAge = now - item.timestamp
      const accessFrequency = item.accessCount / (itemAge / 1000 / 60) // 每分钟访问次数

      // 高频访问的数据保留更久
      if (accessFrequency > 10) {
        return itemAge > 60 * 60 * 1000 // 1小时
      } else if (accessFrequency > 1) {
        return itemAge > 30 * 60 * 1000 // 30分钟
      } else {
        return itemAge > 5 * 60 * 1000 // 5分钟
      }
    })
  }
}
```

### 缓存预热和批量操作

```typescript
class UserApi {
  constructor(private core: RequestCore) {}

  // 缓存预热 - 提前加载常用数据
  async warmupCache(userIds: string[]) {
    const warmupPromises = userIds.map(async (id) => {
      try {
        await this.core.get<User>(`/users/${id}`, {
          cache: {
            enabled: true,
            ttl: 60 * 60 * 1000, // 1小时
            tags: ['user-warmup'],
          },
        })
      } catch (error) {
        console.warn(`Failed to warmup cache for user ${id}:`, error)
      }
    })

    await Promise.allSettled(warmupPromises)
    console.log(`Warmed up cache for ${userIds.length} users`)
  }

  // 智能缓存刷新 - 基于访问频率
  async smartCacheRefresh() {
    const cacheStats = await this.core.getCacheStats()
    const hotKeys = cacheStats.entries
      .filter((entry) => entry.accessCount > 10)
      .sort((a, b) => b.accessCount - a.accessCount)
      .slice(0, 50) // 取前50个热点数据

    for (const entry of hotKeys) {
      if (entry.age > 30 * 60 * 1000) {
        // 超过30分钟的热点数据
        try {
          // 后台刷新缓存
          this.refreshCacheInBackground(entry.key)
        } catch (error) {
          console.warn(`Failed to refresh cache for key ${entry.key}:`, error)
        }
      }
    }
  }

  private async refreshCacheInBackground(cacheKey: string) {
    // 解析缓存键获取原始请求信息
    const requestInfo = this.parseCacheKey(cacheKey)
    if (requestInfo) {
      await this.core.get(requestInfo.url, {
        ...requestInfo.config,
        cache: {
          enabled: true,
          key: cacheKey,
          ttl: 60 * 60 * 1000, // 刷新后缓存1小时
        },
      })
    }
  }

  private parseCacheKey(cacheKey: string): { url: string; config: any } | null {
    // 实现缓存键解析逻辑
    // 这里需要根据实际的键格式来实现
    return null
  }
}
```

## 🔧 自定义实现层开发

### 创建自定义请求实现

```typescript
import { Requestor, RequestConfig } from 'request-core'

// 1. 基于 GraphQL 的自定义实现
class GraphQLRequestor implements Requestor {
  constructor(
    private endpoint: string,
    private defaultHeaders: Record<string, string> = {}
  ) {}

  async request<T>(config: RequestConfig): Promise<T> {
    const { data, headers = {}, ...otherConfig } = config

    // 构建 GraphQL 查询
    const graphqlQuery = this.buildGraphQLQuery(config)

    const response = await fetch(this.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...this.defaultHeaders,
        ...headers,
      },
      body: JSON.stringify(graphqlQuery),
    })

    if (!response.ok) {
      throw new Error(`GraphQL request failed: ${response.statusText}`)
    }

    const result = await response.json()

    if (result.errors) {
      throw new Error(`GraphQL errors: ${JSON.stringify(result.errors)}`)
    }

    return result.data
  }

  private buildGraphQLQuery(config: RequestConfig) {
    // 根据 REST API 配置构建 GraphQL 查询
    // 这是一个简化的实现
    const operation = this.mapMethodToOperation(config.method)
    const variables = config.data || {}

    return {
      query: `${operation} { ${this.buildFieldSelection(config.url)} }`,
      variables,
    }
  }

  private mapMethodToOperation(method: string): string {
    switch (method) {
      case 'GET':
        return 'query'
      case 'POST':
        return 'mutation'
      case 'PUT':
        return 'mutation'
      case 'DELETE':
        return 'mutation'
      default:
        return 'query'
    }
  }

  private buildFieldSelection(url: string): string {
    // 根据 URL 构建字段选择
    // 简化实现
    const parts = url.split('/').filter(Boolean)
    return parts[parts.length - 1] || 'data'
  }
}

// 2. WebSocket 实现
class WebSocketRequestor implements Requestor {
  private ws: WebSocket | null = null
  private requestMap = new Map<
    string,
    { resolve: Function; reject: Function }
  >()

  constructor(private wsUrl: string) {
    this.connect()
  }

  private connect() {
    this.ws = new WebSocket(this.wsUrl)

    this.ws.onmessage = (event) => {
      const response = JSON.parse(event.data)
      const request = this.requestMap.get(response.id)

      if (request) {
        if (response.error) {
          request.reject(new Error(response.error))
        } else {
          request.resolve(response.data)
        }
        this.requestMap.delete(response.id)
      }
    }

    this.ws.onerror = (error) => {
      console.error('WebSocket error:', error)
    }
  }

  async request<T>(config: RequestConfig): Promise<T> {
    return new Promise((resolve, reject) => {
      const requestId = this.generateRequestId()
      this.requestMap.set(requestId, { resolve, reject })

      const message = {
        id: requestId,
        method: config.method,
        url: config.url,
        data: config.data,
        headers: config.headers,
      }

      if (this.ws?.readyState === WebSocket.OPEN) {
        this.ws.send(JSON.stringify(message))
      } else {
        reject(new Error('WebSocket is not connected'))
      }

      // 设置超时
      setTimeout(() => {
        if (this.requestMap.has(requestId)) {
          this.requestMap.delete(requestId)
          reject(new Error('Request timeout'))
        }
      }, config.timeout || 10000)
    })
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

// 注册自定义实现
class CustomRequestCoreFactory {
  static create(implementation: string): RequestCore {
    let requestor: Requestor

    switch (implementation) {
      case 'graphql':
        requestor = new GraphQLRequestor('https://api.example.com/graphql')
        break
      case 'websocket':
        requestor = new WebSocketRequestor('wss://api.example.com/ws')
        break
      default:
        throw new Error(`Unsupported implementation: ${implementation}`)
    }

    return new RequestCore(requestor)
  }
}
```

### 实现层扩展和中间件

```typescript
// 请求实现装饰器模式
abstract class RequestorDecorator implements Requestor {
  constructor(protected requestor: Requestor) {}

  abstract request<T>(config: RequestConfig): Promise<T>
}

// 压缩中间件
class CompressionDecorator extends RequestorDecorator {
  async request<T>(config: RequestConfig): Promise<T> {
    // 添加压缩支持
    const newConfig = {
      ...config,
      headers: {
        ...config.headers,
        'Accept-Encoding': 'gzip, deflate, br',
      },
    }

    const response = await this.requestor.request<T>(newConfig)

    // 如果响应被压缩，进行解压
    return this.decompressIfNeeded(response)
  }

  private decompressIfNeeded<T>(response: T): T {
    // 解压逻辑
    return response
  }
}

// 加密中间件
class EncryptionDecorator extends RequestorDecorator {
  constructor(requestor: Requestor, private encryptionKey: string) {
    super(requestor)
  }

  async request<T>(config: RequestConfig): Promise<T> {
    // 加密请求数据
    if (config.data) {
      config.data = await this.encrypt(config.data)
    }

    const response = await this.requestor.request<T>(config)

    // 解密响应数据
    return this.decrypt(response)
  }

  private async encrypt(data: any): Promise<any> {
    // 实现加密逻辑
    return data
  }

  private async decrypt<T>(data: T): Promise<T> {
    // 实现解密逻辑
    return data
  }
}

// 使用装饰器
const baseRequestor = new AxiosRequestor()
const compressedRequestor = new CompressionDecorator(baseRequestor)
const encryptedRequestor = new EncryptionDecorator(
  compressedRequestor,
  'my-secret-key'
)

const core = new RequestCore(encryptedRequestor)
```

## 🎭 高级拦截器模式

### 条件拦截器

```typescript
class ConditionalInterceptor {
  constructor(
    private condition: (config: RequestConfig) => boolean,
    private interceptor: RequestInterceptor
  ) {}

  install(core: RequestCore): void {
    core.addInterceptor({
      request: (config) => {
        if (this.condition(config) && this.interceptor.request) {
          return this.interceptor.request(config)
        }
        return config
      },

      response: (response) => {
        if (this.condition(response.config) && this.interceptor.response) {
          return this.interceptor.response(response)
        }
        return response
      },

      error: (error) => {
        if (this.condition(error.config) && this.interceptor.error) {
          return this.interceptor.error(error)
        }
        throw error
      },
    })
  }
}

// 使用条件拦截器
const apiClient = createApiClient(
  { user: UserApi },
  {
    implementation: 'axios',
  }
)

// 仅对特定API应用认证拦截器
const authInterceptor = new ConditionalInterceptor(
  (config) => config.url.includes('/api/secured/'),
  {
    request: (config) => {
      config.headers = {
        ...config.headers,
        Authorization: `Bearer ${getToken()}`,
      }
      return config
    },
  }
)

authInterceptor.install(apiClient.core)
```

### 拦截器链和组合

```typescript
class InterceptorChain {
  private interceptors: RequestInterceptor[] = []

  add(interceptor: RequestInterceptor): this {
    this.interceptors.push(interceptor)
    return this
  }

  async executeRequest(config: RequestConfig): Promise<RequestConfig> {
    let result = config

    for (const interceptor of this.interceptors) {
      if (interceptor.request) {
        result = await interceptor.request(result)
      }
    }

    return result
  }

  async executeResponse<T>(response: T): Promise<T> {
    let result = response

    // 响应拦截器逆序执行
    for (const interceptor of [...this.interceptors].reverse()) {
      if (interceptor.response) {
        result = await interceptor.response(result)
      }
    }

    return result
  }

  async executeError(error: any): Promise<any> {
    for (const interceptor of [...this.interceptors].reverse()) {
      if (interceptor.error) {
        try {
          return await interceptor.error(error)
        } catch (e) {
          error = e
        }
      }
    }
    throw error
  }
}

// 使用拦截器链
const chain = new InterceptorChain()
  .add({
    request: (config) => {
      console.log('第一个拦截器')
      return config
    },
  })
  .add({
    request: (config) => {
      console.log('第二个拦截器')
      config.headers = { ...config.headers, 'X-Custom': 'value' }
      return config
    },
  })
  .add({
    response: (response) => {
      console.log('响应拦截器')
      return response
    },
  })
```

## 🏢 企业级配置管理

### 分层配置系统

```typescript
interface EnvironmentConfig {
  development: EnvSettings
  staging: EnvSettings
  production: EnvSettings
}

interface EnvSettings {
  baseURL: string
  timeout: number
  retries: number
  cacheConfig: CacheConfig
  securityConfig: SecurityConfig
  monitoringConfig: MonitoringConfig
}

interface SecurityConfig {
  enableEncryption: boolean
  apiKey: string
  allowedOrigins: string[]
  rateLimiting: {
    enabled: boolean
    maxRequests: number
    windowMs: number
  }
}

interface MonitoringConfig {
  enableTracking: boolean
  sampleRate: number
  endpoints: {
    metrics: string
    errors: string
  }
}

class ConfigManager {
  private config: EnvSettings
  private watchers: Array<(config: EnvSettings) => void> = []

  constructor(private environment: string = 'development') {
    this.loadConfig()
    this.setupConfigWatcher()
  }

  private loadConfig(): void {
    // 从环境变量、配置文件或远程服务加载配置
    const envConfig = this.getEnvironmentConfig()
    this.config = {
      ...this.getDefaultConfig(),
      ...envConfig[this.environment as keyof EnvironmentConfig],
    }
  }

  private getDefaultConfig(): EnvSettings {
    return {
      baseURL: 'https://api.example.com',
      timeout: 10000,
      retries: 3,
      cacheConfig: {
        enabled: true,
        ttl: 300000,
        storageType: StorageType.MEMORY,
      },
      securityConfig: {
        enableEncryption: false,
        apiKey: '',
        allowedOrigins: ['*'],
        rateLimiting: {
          enabled: false,
          maxRequests: 100,
          windowMs: 60000,
        },
      },
      monitoringConfig: {
        enableTracking: true,
        sampleRate: 1.0,
        endpoints: {
          metrics: '/metrics',
          errors: '/errors',
        },
      },
    }
  }

  private getEnvironmentConfig(): EnvironmentConfig {
    return {
      development: {
        baseURL: 'http://localhost:3000/api',
        timeout: 30000,
        retries: 1,
        // ... 其他开发环境配置
      },
      staging: {
        baseURL: 'https://staging-api.example.com',
        timeout: 15000,
        retries: 2,
        // ... 其他测试环境配置
      },
      production: {
        baseURL: 'https://api.example.com',
        timeout: 10000,
        retries: 3,
        // ... 其他生产环境配置
      },
    } as EnvironmentConfig
  }

  // 动态配置更新
  updateConfig(updates: Partial<EnvSettings>): void {
    this.config = { ...this.config, ...updates }
    this.notifyWatchers()
  }

  // 配置监听器
  onConfigChange(callback: (config: EnvSettings) => void): void {
    this.watchers.push(callback)
  }

  private notifyWatchers(): void {
    this.watchers.forEach((callback) => callback(this.config))
  }

  private setupConfigWatcher(): void {
    // 监听远程配置变化
    if (this.config.monitoringConfig.enableTracking) {
      setInterval(() => {
        this.checkRemoteConfig()
      }, 60000) // 每分钟检查一次
    }
  }

  private async checkRemoteConfig(): Promise<void> {
    try {
      const response = await fetch('/api/config', {
        headers: {
          Authorization: `Bearer ${this.config.securityConfig.apiKey}`,
        },
      })

      if (response.ok) {
        const remoteConfig = await response.json()
        if (this.hasConfigChanged(remoteConfig)) {
          this.updateConfig(remoteConfig)
          console.log('Configuration updated from remote')
        }
      }
    } catch (error) {
      console.warn('Failed to fetch remote config:', error)
    }
  }

  private hasConfigChanged(remoteConfig: Partial<EnvSettings>): boolean {
    // 比较配置是否有变化
    return (
      JSON.stringify(this.config) !==
      JSON.stringify({ ...this.config, ...remoteConfig })
    )
  }

  getConfig(): EnvSettings {
    return { ...this.config }
  }
}
```

### 配置热更新

```typescript
class HotReloadableApiClient {
  private configManager: ConfigManager
  private apiClient: any
  private currentConfig: EnvSettings

  constructor(apis: any, environment?: string) {
    this.configManager = new ConfigManager(environment)
    this.currentConfig = this.configManager.getConfig()
    this.apiClient = this.createApiClient(apis, this.currentConfig)

    // 监听配置变化
    this.configManager.onConfigChange((newConfig) => {
      this.handleConfigChange(newConfig, apis)
    })
  }

  private createApiClient(apis: any, config: EnvSettings) {
    return createApiClient(apis, {
      implementation: 'axios',
      globalConfig: {
        baseURL: config.baseURL,
        timeout: config.timeout,
        // ... 其他配置
      },
    })
  }

  private handleConfigChange(newConfig: EnvSettings, apis: any): void {
    const significantChanges = this.hasSignificantChanges(
      this.currentConfig,
      newConfig
    )

    if (significantChanges) {
      console.log('Significant config changes detected, recreating API client')

      // 销毁当前客户端
      if (this.apiClient.destroy) {
        this.apiClient.destroy()
      }

      // 创建新的客户端
      this.apiClient = this.createApiClient(apis, newConfig)
      this.currentConfig = newConfig
    } else {
      // 仅更新配置，不重新创建客户端
      this.apiClient.updateGlobalConfig(newConfig)
      this.currentConfig = newConfig
    }
  }

  private hasSignificantChanges(
    oldConfig: EnvSettings,
    newConfig: EnvSettings
  ): boolean {
    // 检查是否有需要重新创建客户端的重大变化
    return (
      oldConfig.baseURL !== newConfig.baseURL ||
      oldConfig.securityConfig.enableEncryption !==
        newConfig.securityConfig.enableEncryption
    )
  }

  get client() {
    return this.apiClient
  }

  updateConfig(updates: Partial<EnvSettings>): void {
    this.configManager.updateConfig(updates)
  }
}
```

## 🛡️ 安全功能

### 请求签名和验证

```typescript
class RequestSigner {
  constructor(
    private secretKey: string,
    private algorithm: 'HMAC-SHA256' | 'RSA-SHA256' = 'HMAC-SHA256'
  ) {}

  async signRequest(config: RequestConfig): Promise<RequestConfig> {
    const timestamp = Date.now().toString()
    const nonce = this.generateNonce()

    const signatureData = this.buildSignatureString(config, timestamp, nonce)
    const signature = await this.calculateSignature(signatureData)

    return {
      ...config,
      headers: {
        ...config.headers,
        'X-Timestamp': timestamp,
        'X-Nonce': nonce,
        'X-Signature': signature,
        'X-Signature-Algorithm': this.algorithm,
      },
    }
  }

  private buildSignatureString(
    config: RequestConfig,
    timestamp: string,
    nonce: string
  ): string {
    const method = config.method.toUpperCase()
    const url = config.url
    const body = config.data ? JSON.stringify(config.data) : ''
    const contentType = config.headers?.['content-type'] || 'application/json'

    return `${method}\n${url}\n${body}\n${contentType}\n${timestamp}\n${nonce}`
  }

  private async calculateSignature(data: string): Promise<string> {
    if (this.algorithm === 'HMAC-SHA256') {
      return this.hmacSHA256(data, this.secretKey)
    } else {
      return this.rsaSHA256(data, this.secretKey)
    }
  }

  private async hmacSHA256(data: string, key: string): Promise<string> {
    const encoder = new TextEncoder()
    const keyData = encoder.encode(key)
    const messageData = encoder.encode(data)

    const cryptoKey = await crypto.subtle.importKey(
      'raw',
      keyData,
      { name: 'HMAC', hash: 'SHA-256' },
      false,
      ['sign']
    )

    const signature = await crypto.subtle.sign('HMAC', cryptoKey, messageData)
    return Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, '0'))
      .join('')
  }

  private async rsaSHA256(data: string, privateKey: string): Promise<string> {
    // RSA签名实现
    // 这里需要实现RSA私钥签名逻辑
    return ''
  }

  private generateNonce(): string {
    return crypto
      .getRandomValues(new Uint8Array(16))
      .reduce((str, byte) => str + byte.toString(16).padStart(2, '0'), '')
  }
}

// 安全拦截器
class SecurityInterceptor {
  constructor(
    private signer: RequestSigner,
    private rateLimiter: RateLimiter,
    private encryptor?: DataEncryptor
  ) {}

  install(core: RequestCore): void {
    core.addInterceptor({
      request: async (config) => {
        // 1. 速率限制检查
        await this.rateLimiter.checkLimit(config)

        // 2. 数据加密
        if (this.encryptor && config.data) {
          config.data = await this.encryptor.encrypt(config.data)
        }

        // 3. 请求签名
        return this.signer.signRequest(config)
      },

      response: async (response) => {
        // 解密响应数据
        if (this.encryptor && response.data) {
          response.data = await this.encryptor.decrypt(response.data)
        }
        return response
      },
    })
  }
}
```

---

## 📚 相关文档

- 🚀 [快速开始](/guide/getting-started) - 快速上手指南
- 📖 [基础用法](/guide/basic-usage) - 核心功能详解
- 💡 [使用示例](/examples/basic-requests) - 实际应用案例
- 📋 [API 参考](/api/request-core) - 完整的 API 文档
- 🏗️ [架构设计](/concepts/architecture) - 了解设计思想

## 🆘 获取帮助

如果在使用高级功能时遇到问题：

1. 查看 [故障排除指南](/guide/troubleshooting)
2. 浏览 [开发者文档](/development/custom-implementation)
3. 提交 [GitHub Issue](https://github.com/your-org/request-lib/issues)
4. 参与 [社区讨论](https://github.com/your-org/request-lib/discussions)

## 💡 高级功能使用建议

1. **缓存策略**: 根据数据特性选择合适的缓存策略和存储方式
2. **配置管理**: 建立完善的配置管理体系，支持动态更新
3. **安全防护**: 在敏感环境中启用请求签名和数据加密
