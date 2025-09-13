# 最佳实践

本指南汇总了在生产环境中使用分层架构请求库的最佳实践和经验总结。这些实践来自真实的项目经验，可以帮助您构建更稳定、高效、可维护的应用。

## 🏗️ 项目结构和代码组织

### 推荐的项目结构

```
src/
├── api/                          # API 相关文件
│   ├── modules/                  # API 模块
│   │   ├── auth/                 # 认证相关
│   │   │   ├── index.ts         # 导出文件
│   │   │   ├── auth.api.ts      # 认证 API 类
│   │   │   └── auth.types.ts    # 认证相关类型
│   │   ├── user/                # 用户相关
│   │   │   ├── index.ts         
│   │   │   ├── user.api.ts      
│   │   │   └── user.types.ts    
│   │   └── common/              # 通用模块
│   │       ├── base.api.ts      # 基础 API 类
│   │       └── common.types.ts  # 通用类型
│   ├── config/                  # 配置文件
│   │   ├── environments.ts      # 环境配置
│   │   ├── interceptors.ts      # 拦截器配置
│   │   └── cache.ts            # 缓存配置
│   ├── utils/                   # 工具函数
│   │   ├── error-handler.ts     # 错误处理
│   │   ├── transformers.ts      # 数据转换
│   │   └── validators.ts        # 数据验证
│   └── index.ts                 # 主导出文件
├── types/                       # 全局类型定义
│   ├── api.ts                  # API 相关类型
│   ├── common.ts               # 通用类型
│   └── index.ts                # 类型导出
└── constants/                   # 常量定义
    ├── api.ts                  # API 常量
    └── errors.ts               # 错误常量
```

### API 模块化组织

```typescript
// api/modules/user/user.api.ts
import { BaseApi } from '../common/base.api'
import type { User, CreateUserRequest, UpdateUserRequest } from './user.types'
import type { PaginationParams, PaginatedResponse } from '../../types'

export class UserApi extends BaseApi {
  private readonly namespace = 'users'

  // 获取用户详情
  async getUser(id: string): Promise<User> {
    return this.core.get<User>(`/${this.namespace}/${id}`, {
      tag: 'user-detail',
      cache: { enabled: true, ttl: 10 * 60 * 1000 } // 10分钟缓存
    })
  }

  // 获取用户列表
  async getUsers(params: PaginationParams = {}): Promise<PaginatedResponse<User>> {
    return this.core.getPaginated<User>(`/${this.namespace}`, params)
  }

  // 创建用户
  async createUser(data: CreateUserRequest): Promise<User> {
    const user = await this.core.post<User>(`/${this.namespace}`, data, {
      tag: 'user-create'
    })
    
    // 创建成功后清除相关缓存
    this.clearRelatedCache(['user-list'])
    return user
  }

  // 更新用户
  async updateUser(id: string, data: UpdateUserRequest): Promise<User> {
    const user = await this.core.patch<User>(`/${this.namespace}/${id}`, data, {
      tag: 'user-update'
    })
    
    // 更新成功后清除相关缓存
    this.clearRelatedCache(['user-list', `user-${id}`])
    return user
  }
}

// api/modules/common/base.api.ts
import type { RequestCore } from 'request-core'

export abstract class BaseApi {
  constructor(protected core: RequestCore) {}

  // 清除相关缓存的通用方法
  protected clearRelatedCache(tags: string[]): void {
    tags.forEach(tag => {
      this.core.clearCacheByTag(tag)
    })
  }

  // 通用错误处理
  protected handleError(error: any, context: string): never {
    console.error(`[${this.constructor.name}] ${context}:`, error)
    throw error
  }

  // 数据验证
  protected validateRequired<T>(data: T, fields: (keyof T)[]): void {
    for (const field of fields) {
      if (!data[field]) {
        throw new Error(`Field '${String(field)}' is required`)
      }
    }
  }
}
```

### 类型定义组织

```typescript
// api/modules/user/user.types.ts
import type { BaseEntity } from '../../types/common'

export interface User extends BaseEntity {
  id: string
  username: string
  email: string
  firstName: string
  lastName: string
  avatar?: string
  role: UserRole
  status: UserStatus
  lastLoginAt?: string
  createdAt: string
  updatedAt: string
}

export interface CreateUserRequest {
  username: string
  email: string
  password: string
  firstName: string
  lastName: string
  role: UserRole
}

export interface UpdateUserRequest {
  username?: string
  email?: string
  firstName?: string
  lastName?: string
  avatar?: string
  status?: UserStatus
}

export enum UserRole {
  ADMIN = 'admin',
  USER = 'user',
  MODERATOR = 'moderator'
}

export enum UserStatus {
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  SUSPENDED = 'suspended'
}
```

## 🎨 API 设计原则

### 1. 单一职责原则

每个 API 类应该只负责一个业务领域：

```typescript
// ✅ 好的设计 - 职责明确
class UserApi {
  async getUser(id: string) { /* ... */ }
  async createUser(data: CreateUserRequest) { /* ... */ }
  async updateUser(id: string, data: UpdateUserRequest) { /* ... */ }
}

class PostApi {
  async getPost(id: string) { /* ... */ }
  async createPost(data: CreatePostRequest) { /* ... */ }
  async getUserPosts(userId: string) { /* ... */ }
}

// ❌ 不好的设计 - 职责混乱
class UserPostApi {
  async getUser(id: string) { /* ... */ }
  async createPost(data: CreatePostRequest) { /* ... */ }
  async updateUserProfile(id: string, data: any) { /* ... */ }
}
```

### 2. 一致的方法命名

建立统一的命名规范：

```typescript
class ResourceApi {
  // 获取单个资源
  async getResource(id: string): Promise<Resource> { }
  
  // 获取资源列表
  async getResources(filters?: ResourceFilters): Promise<PaginatedResponse<Resource>> { }
  
  // 创建资源
  async createResource(data: CreateResourceRequest): Promise<Resource> { }
  
  // 更新资源（全量）
  async updateResource(id: string, data: UpdateResourceRequest): Promise<Resource> { }
  
  // 部分更新资源
  async patchResource(id: string, data: Partial<Resource>): Promise<Resource> { }
  
  // 删除资源
  async deleteResource(id: string): Promise<void> { }
  
  // 批量操作
  async batchCreateResources(data: CreateResourceRequest[]): Promise<Resource[]> { }
  async batchUpdateResources(updates: Array<{ id: string, data: Partial<Resource> }>): Promise<Resource[]> { }
  async batchDeleteResources(ids: string[]): Promise<void> { }
  
  // 特殊操作使用描述性名称
  async activateResource(id: string): Promise<Resource> { }
  async deactivateResource(id: string): Promise<Resource> { }
  async archiveResource(id: string): Promise<Resource> { }
}
```

### 3. 合理的缓存策略

针对不同的数据特性设置合适的缓存：

```typescript
class UserApi extends BaseApi {
  // 用户详情 - 长缓存（30分钟）
  async getUser(id: string): Promise<User> {
    return this.core.get<User>(`/users/${id}`, {
      cache: {
        enabled: true,
        ttl: 30 * 60 * 1000,
        tags: [`user-${id}`]
      }
    })
  }

  // 用户列表 - 短缓存（5分钟）
  async getUsers(params?: UserListFilters): Promise<PaginatedResponse<User>> {
    return this.core.get<PaginatedResponse<User>>('/users', {
      params,
      cache: {
        enabled: true,
        ttl: 5 * 60 * 1000,
        tags: ['user-list']
      }
    })
  }

  // 用户统计 - 中等缓存（15分钟）
  async getUserStats(): Promise<UserStats> {
    return this.core.get<UserStats>('/users/stats', {
      cache: {
        enabled: true,
        ttl: 15 * 60 * 1000,
        tags: ['user-stats']
      }
    })
  }

  // 敏感操作 - 不缓存
  async getCurrentUserProfile(): Promise<User> {
    return this.core.get<User>('/users/me', {
      cache: { enabled: false }
    })
  }
}
```

## 🛡️ 错误处理最佳实践

### 1. 分层错误处理

```typescript
// utils/error-handler.ts
import { RequestError, RequestErrorType } from 'request-core'

export enum AppErrorCode {
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR = 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR = 'AUTHORIZATION_ERROR',
  RESOURCE_NOT_FOUND = 'RESOURCE_NOT_FOUND',
  RESOURCE_CONFLICT = 'RESOURCE_CONFLICT',
  RATE_LIMIT_EXCEEDED = 'RATE_LIMIT_EXCEEDED',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE'
}

export class AppError extends Error {
  constructor(
    public code: AppErrorCode,
    message: string,
    public statusCode?: number,
    public originalError?: any
  ) {
    super(message)
    this.name = 'AppError'
  }
}

export class ErrorHandler {
  static handle(error: any): AppError {
    if (error instanceof RequestError) {
      return this.handleRequestError(error)
    }

    if (error instanceof AppError) {
      return error
    }

    return new AppError(
      AppErrorCode.SERVICE_UNAVAILABLE,
      '服务暂时不可用，请稍后再试',
      500,
      error
    )
  }

  private static handleRequestError(error: RequestError): AppError {
    switch (error.type) {
      case RequestErrorType.NETWORK_ERROR:
        return new AppError(
          AppErrorCode.SERVICE_UNAVAILABLE,
          '网络连接失败，请检查网络设置',
          0,
          error
        )

      case RequestErrorType.TIMEOUT_ERROR:
        return new AppError(
          AppErrorCode.SERVICE_UNAVAILABLE,
          '请求超时，请稍后重试',
          408,
          error
        )

      case RequestErrorType.SERVER_ERROR:
        if (error.statusCode === 401) {
          return new AppError(
            AppErrorCode.AUTHENTICATION_ERROR,
            '身份认证失败，请重新登录',
            401,
            error
          )
        }
        if (error.statusCode === 403) {
          return new AppError(
            AppErrorCode.AUTHORIZATION_ERROR,
            '没有权限执行此操作',
            403,
            error
          )
        }
        if (error.statusCode === 404) {
          return new AppError(
            AppErrorCode.RESOURCE_NOT_FOUND,
            '请求的资源不存在',
            404,
            error
          )
        }
        return new AppError(
          AppErrorCode.SERVICE_UNAVAILABLE,
          '服务器错误，请稍后重试',
          error.statusCode,
          error
        )

      default:
        return new AppError(
          AppErrorCode.SERVICE_UNAVAILABLE,
          '未知错误',
          500,
          error
        )
    }
  }

  // 获取用户友好的错误消息
  static getUserMessage(error: AppError): string {
    const messages = {
      [AppErrorCode.VALIDATION_ERROR]: '输入信息有误，请检查后重试',
      [AppErrorCode.AUTHENTICATION_ERROR]: '登录已过期，请重新登录',
      [AppErrorCode.AUTHORIZATION_ERROR]: '权限不足，无法执行此操作',
      [AppErrorCode.RESOURCE_NOT_FOUND]: '请求的内容不存在',
      [AppErrorCode.RESOURCE_CONFLICT]: '操作冲突，请刷新页面后重试',
      [AppErrorCode.RATE_LIMIT_EXCEEDED]: '操作过于频繁，请稍后再试',
      [AppErrorCode.SERVICE_UNAVAILABLE]: '服务暂时不可用，请稍后再试'
    }

    return messages[error.code] || error.message
  }
}
```

### 2. 全局错误拦截器

```typescript
// config/interceptors.ts
export const errorInterceptor = {
  error: (error: any) => {
    const appError = ErrorHandler.handle(error)
    
    // 记录错误日志
    console.error('[API Error]', {
      code: appError.code,
      message: appError.message,
      statusCode: appError.statusCode,
      timestamp: new Date().toISOString(),
      url: error.config?.url,
      method: error.config?.method
    })

    // 特殊错误处理
    if (appError.code === AppErrorCode.AUTHENTICATION_ERROR) {
      localStorage.removeItem('auth_token')
      window.location.href = '/login'
    }

    throw appError
  }
}
```

## 🔒 安全最佳实践

### 1. 认证和授权

```typescript
// utils/auth.ts
class AuthManager {
  private tokenKey = 'auth_token'
  private refreshTokenKey = 'refresh_token'

  getToken(): string | null {
    return localStorage.getItem(this.tokenKey)
  }

  setToken(token: string, refreshToken?: string): void {
    localStorage.setItem(this.tokenKey, token)
    if (refreshToken) {
      localStorage.setItem(this.refreshTokenKey, refreshToken)
    }
  }

  clearTokens(): void {
    localStorage.removeItem(this.tokenKey)
    localStorage.removeItem(this.refreshTokenKey)
  }

  isTokenExpired(token: string): boolean {
    try {
      const payload = JSON.parse(atob(token.split('.')[1]))
      return Date.now() >= payload.exp * 1000
    } catch {
      return true
    }
  }
}

// 认证拦截器
export const authInterceptor = {
  request: (config: RequestConfig) => {
    const token = authManager.getToken()
    
    if (token && !authManager.isTokenExpired(token)) {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${token}`
      }
    } else if (token) {
      // Token过期，尝试刷新
      authManager.clearTokens()
      window.location.href = '/login'
    }

    return config
  }
}
```

### 2. 数据验证和清理

```typescript
// utils/validators.ts
export class DataValidator {
  // XSS防护
  static sanitizeHtml(input: string): string {
    const div = document.createElement('div')
    div.textContent = input
    return div.innerHTML
  }

  // SQL注入防护（参数化查询参数）
  static sanitizeQueryParam(param: string): string {
    return encodeURIComponent(param)
  }

  // 敏感信息过滤
  static sanitizeForLog(data: any): any {
    const sensitiveFields = ['password', 'token', 'secret', 'key', 'auth']
    
    if (typeof data === 'object' && data !== null) {
      const sanitized = { ...data }
      for (const [key, value] of Object.entries(sanitized)) {
        if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
          sanitized[key] = '***'
        } else if (typeof value === 'object') {
          sanitized[key] = this.sanitizeForLog(value)
        }
      }
      return sanitized
    }
    
    return data
  }
}

// 在API层应用验证
class SecureUserApi extends BaseApi {
  async createUser(data: CreateUserRequest): Promise<User> {
    // 客户端数据清理
    const sanitizedData = {
      ...data,
      username: DataValidator.sanitizeHtml(data.username),
      firstName: DataValidator.sanitizeHtml(data.firstName),
      lastName: DataValidator.sanitizeHtml(data.lastName)
    }

    return this.core.post<User>('/users', sanitizedData, {
      tag: 'user-create'
    })
  }

  async searchUsers(query: string): Promise<User[]> {
    // 查询参数清理
    const sanitizedQuery = DataValidator.sanitizeQueryParam(query)
    
    return this.core.get<User[]>('/users/search', {
      params: { q: sanitizedQuery }
    })
  }
}
```

### 3. 敏感数据保护

```typescript
// utils/crypto.ts
class CryptoManager {
  private readonly algorithm = 'AES-GCM'
  private readonly keyLength = 256

  async generateKey(): Promise<CryptoKey> {
    return crypto.subtle.generateKey(
      { name: this.algorithm, length: this.keyLength },
      true,
      ['encrypt', 'decrypt']
    )
  }

  async encryptData(data: string, key: CryptoKey): Promise<string> {
    const iv = crypto.getRandomValues(new Uint8Array(12))
    const encodedData = new TextEncoder().encode(data)
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: this.algorithm, iv },
      key,
      encodedData
    )

    const combined = new Uint8Array(iv.length + encryptedData.byteLength)
    combined.set(iv)
    combined.set(new Uint8Array(encryptedData), iv.length)
    
    return btoa(String.fromCharCode(...combined))
  }

  async decryptData(encryptedData: string, key: CryptoKey): Promise<string> {
    const combined = new Uint8Array(
      atob(encryptedData).split('').map(char => char.charCodeAt(0))
    )
    
    const iv = combined.slice(0, 12)
    const data = combined.slice(12)
    
    const decryptedData = await crypto.subtle.decrypt(
      { name: this.algorithm, iv },
      key,
      data
    )

    return new TextDecoder().decode(decryptedData)
  }
}

// 敏感数据传输
class SecureApi extends BaseApi {
  private cryptoManager = new CryptoManager()

  async updatePassword(userId: string, newPassword: string): Promise<void> {
    // 敏感数据加密传输
    const key = await this.cryptoManager.generateKey()
    const encryptedPassword = await this.cryptoManager.encryptData(newPassword, key)
    
    await this.core.patch(`/users/${userId}/password`, {
      password: encryptedPassword
    }, {
      timeout: 15000, // 加密操作可能需要更多时间
      cache: { enabled: false } // 敏感操作不缓存
    })
  }
}
```

## 🧪 测试策略

### 1. API 层单元测试

```typescript
// __tests__/api/user.api.test.ts
import { UserApi } from '../src/api/modules/user/user.api'
import { RequestCore } from 'request-core'
import { MockRequestor } from '../src/test-utils/mock-requestor'

describe('UserApi', () => {
  let userApi: UserApi
  let mockCore: RequestCore
  let mockRequestor: MockRequestor

  beforeEach(() => {
    mockRequestor = new MockRequestor()
    mockCore = new RequestCore(mockRequestor)
    userApi = new UserApi(mockCore)
  })

  describe('getUser', () => {
    it('should fetch user successfully', async () => {
      // Arrange
      const userId = '123'
      const expectedUser = { id: userId, name: 'Test User' }
      mockRequestor.mockGet(`/users/${userId}`, expectedUser)

      // Act
      const result = await userApi.getUser(userId)

      // Assert
      expect(result).toEqual(expectedUser)
      expect(mockRequestor.getLastRequest()).toMatchObject({
        method: 'GET',
        url: `/users/${userId}`,
        tag: 'user-detail'
      })
    })

    it('should handle user not found error', async () => {
      // Arrange
      const userId = '999'
      mockRequestor.mockError(`/users/${userId}`, new Error('User not found'), 404)

      // Act & Assert
      await expect(userApi.getUser(userId)).rejects.toThrow('User not found')
    })
  })

  describe('createUser', () => {
    it('should create user and clear cache', async () => {
      // Arrange
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        firstName: 'Test',
        lastName: 'User',
        role: UserRole.USER
      }
      const expectedUser = { ...userData, id: '123' }
      mockRequestor.mockPost('/users', expectedUser)

      const clearCacheSpy = jest.spyOn(userApi as any, 'clearRelatedCache')

      // Act
      const result = await userApi.createUser(userData)

      // Assert
      expect(result).toEqual(expectedUser)
      expect(clearCacheSpy).toHaveBeenCalledWith(['user-list'])
    })

    it('should validate required fields', async () => {
      // Arrange
      const invalidData = { username: 'ab' } // 用户名太短

      // Act & Assert
      await expect(userApi.createUser(invalidData as any)).rejects.toThrow(
        '用户名至少需要3个字符'
      )
    })
  })
})
```

### 2. 集成测试

```typescript
// __tests__/integration/api-client.test.ts
import { createApiClient } from 'request-bus'
import { UserApi } from '../src/api/modules/user/user.api'

describe('API Client Integration', () => {
  let apiClient: ReturnType<typeof createApiClient>

  beforeEach(() => {
    apiClient = createApiClient({ user: UserApi }, {
      implementation: 'axios',
      globalConfig: {
        baseURL: 'http://localhost:3001/api',
        timeout: 5000
      }
    })
  })

  it('should handle authentication flow', async () => {
    // 测试认证流程
    const loginData = { username: 'test', password: 'password' }
    
    // 假设有 AuthApi
    // const authResult = await apiClient.auth.login(loginData)
    // expect(authResult.token).toBeTruthy()
    
    // 使用认证后的客户端
    // const user = await apiClient.user.getCurrentUser()
    // expect(user.username).toBe('test')
  })

  it('should handle network errors gracefully', async () => {
    // 模拟网络错误
    jest.setTimeout(10000)
    
    // 关闭测试服务器或使用错误的URL
    const errorClient = createApiClient({ user: UserApi }, {
      implementation: 'axios',
      globalConfig: {
        baseURL: 'http://nonexistent.example.com',
        timeout: 1000
      }
    })

    await expect(errorClient.user.getUser('123')).rejects.toThrow()
  })
})
```

### 3. E2E 测试

```typescript
// __tests__/e2e/user-management.test.ts
import { test, expect } from '@playwright/test'

test.describe('User Management', () => {
  test.beforeEach(async ({ page }) => {
    // 登录
    await page.goto('/login')
    await page.fill('[data-testid="username"]', 'admin')
    await page.fill('[data-testid="password"]', 'password')
    await page.click('[data-testid="login-button"]')
    await expect(page).toHaveURL('/dashboard')
  })

  test('should create a new user', async ({ page }) => {
    // 导航到用户管理页面
    await page.goto('/users')
    
    // 点击创建用户按钮
    await page.click('[data-testid="create-user-button"]')
    
    // 填写用户信息
    await page.fill('[data-testid="user-username"]', 'newuser')
    await page.fill('[data-testid="user-email"]', 'newuser@example.com')
    await page.fill('[data-testid="user-firstName"]', 'New')
    await page.fill('[data-testid="user-lastName"]', 'User')
    
    // 提交表单
    await page.click('[data-testid="submit-button"]')
    
    // 验证用户创建成功
    await expect(page.locator('[data-testid="success-message"]')).toBeVisible()
    await expect(page.locator('text=newuser')).toBeVisible()
  })

  test('should handle API errors gracefully', async ({ page }) => {
    // 模拟服务器错误
    await page.route('**/api/users', route => {
      route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Internal Server Error' })
      })
    })

    await page.goto('/users')
    
    // 验证错误处理
    await expect(page.locator('[data-testid="error-message"]')).toBeVisible()
    await expect(page.locator('text=服务器错误')).toBeVisible()
  })
})
```

## 👥 团队协作最佳实践

### 1. 代码规范

```typescript
// .eslintrc.js
module.exports = {
  extends: [
    '@typescript-eslint/recommended',
    'prettier'
  ],
  rules: {
    // API 方法命名规范
    'camelcase': ['error', { 
      allow: ['^UNSAFE_', '^unstable_'],
      properties: 'never',
      ignoreDestructuring: false
    }],
    
    // 禁止使用 any 类型
    '@typescript-eslint/no-explicit-any': 'warn',
    
    // 必须处理 Promise
    '@typescript-eslint/no-floating-promises': 'error',
    
    // API 类必须继承 BaseApi
    'no-restricted-syntax': [
      'error',
      {
        selector: 'ClassDeclaration[id.name=/Api$/]:not([superClass.name="BaseApi"])',
        message: 'API classes must extend BaseApi'
      }
    ]
  }
}

// prettier.config.js
module.exports = {
  semi: false,
  singleQuote: true,
  tabWidth: 2,
  trailingComma: 'es5',
  printWidth: 100,
  arrowParens: 'avoid'
}
```

### 2. 文档规范

```typescript
/**
 * 用户管理 API
 * @description 提供用户的 CRUD 操作和相关业务功能
 * @example
 * ```typescript
 * const userApi = new UserApi(core)
 * const user = await userApi.getUser('123')
 * ```
 */
export class UserApi extends BaseApi {
  /**
   * 获取用户详情
   * @param id - 用户ID
   * @returns Promise<User> 用户详情
   * @throws {AppError} 当用户不存在时抛出 RESOURCE_NOT_FOUND 错误
   * @example
   * ```typescript
   * try {
   *   const user = await userApi.getUser('123')
   *   console.log(user.username)
   * } catch (error) {
   *   if (error.code === AppErrorCode.RESOURCE_NOT_FOUND) {
   *     console.log('用户不存在')
   *   }
   * }
   * ```
   */
  async getUser(id: string): Promise<User> {
    this.validateRequired({ id }, ['id'])
    
    return this.core.get<User>(`/users/${id}`, {
      tag: 'user-detail',
      cache: { 
        enabled: true, 
        ttl: 10 * 60 * 1000,
        tags: [`user-${id}`]
      }
    })
  }

  /**
   * 创建新用户
   * @param data - 用户创建数据
   * @returns Promise<User> 创建的用户信息
   * @throws {AppError} 数据验证失败时抛出 VALIDATION_ERROR
   * @throws {AppError} 用户名或邮箱已存在时抛出 RESOURCE_CONFLICT
   */
  async createUser(data: CreateUserRequest): Promise<User> {
    this.validateUserData(data)
    
    const user = await this.core.post<User>('/users', data, {
      tag: 'user-create',
      timeout: 10000
    })
    
    // 清除相关缓存
    this.clearRelatedCache(['user-list'])
    
    return user
  }
}
```

### 3. 版本管理

```typescript
// api/version.ts
export const API_VERSION = '1.2.0'

export const BREAKING_CHANGES = {
  '2.0.0': [
    'UserApi.getUsers 方法的返回值格式变更',
    '移除了已废弃的 UserApi.getUserProfile 方法',
    'CreateUserRequest 接口新增必填字段 email'
  ],
  '1.5.0': [
    '新增 UserApi.batchUpdateUsers 方法',
    'UpdateUserRequest 接口新增可选字段 avatar'
  ]
}

// 版本兼容性检查
export function checkCompatibility(requiredVersion: string): boolean {
  const [major, minor] = API_VERSION.split('.').map(Number)
  const [reqMajor, reqMinor] = requiredVersion.split('.').map(Number)
  
  if (major !== reqMajor) {
    console.warn(`API version mismatch: required ${requiredVersion}, current ${API_VERSION}`)
    return false
  }
  
  if (minor < reqMinor) {
    console.warn(`API version too old: required ${requiredVersion}, current ${API_VERSION}`)
    return false
  }
  
  return true
}
```

---

## 📚 相关文档

- 🚀 [快速开始](/guide/getting-started) - 快速上手指南
- 📖 [基础用法](/guide/basic-usage) - 核心功能详解
- 🔧 [高级功能](/guide/advanced-features) - 深度定制和优化
- 💡 [使用示例](/examples/basic-requests) - 实际应用案例
- 📋 [API 参考](/api/request-core) - 完整的 API 文档

## 💡 关键建议总结

1. **架构设计**: 遵循单一职责原则，保持 API 类职责明确
2. **错误处理**: 建立分层的错误处理机制，提供友好的用户体验
3. **性能优化**: 合理使用缓存，实施请求优化策略
4. **安全防护**: 做好数据验证、认证授权和敏感信息保护
5. **测试覆盖**: 建立完整的测试体系，确保代码质量
6. **团队协作**: 制定清晰的规范，维护良好的文档
7. **持续改进**: 定期审查和优化，跟上最佳实践的发展

通过遵循这些最佳实践，您可以构建出更加稳定、高效、可维护的企业级应用。
