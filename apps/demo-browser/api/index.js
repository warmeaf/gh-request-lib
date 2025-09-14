import { createApiClient, createRequestBus } from 'request-bus'
import UserApi from './user'
import PostApi from './post'

// 创建 API 客户端实例（使用 createApiClient 工厂方法）
export const apiClient = createApiClient({
  user: UserApi,
  post: PostApi
}, {
  implementation: 'axios',
  globalConfig: {
    debug: true,
    timeout: 10000,
  },
})

// 导出 API 实例
export const userApi = apiClient.user
export const postApi = apiClient.post

// 用于实现切换的变量
let currentImplementation = 'axios'
let currentApiClient = apiClient

export function switchImplementation(implementation, logCallback = null) {
  console.log(`Switching to ${implementation} implementation...`)

  try {
    // 重新创建 API 客户端实例
    currentApiClient = createApiClient({
      user: UserApi,
      post: PostApi
    }, {
      implementation: implementation,
      globalConfig: {
        debug: true,
        timeout: 10000,
      },
    })

    currentImplementation = implementation

    // 更新全局引用（如果存在window对象）
    if (typeof window !== 'undefined') {
      window.currentApiClient = currentApiClient
      window.userApi = currentApiClient.user
      window.postApi = currentApiClient.post
    }

    const message = `✅ 已成功切换到 ${implementation} 实现`
    console.log(message)
    
    // 调用日志回调函数（如果提供）
    if (logCallback && typeof logCallback === 'function') {
      logCallback(message, 'success')
    }

    return {
      apiClient: currentApiClient,
      userApi: currentApiClient.user,
      postApi: currentApiClient.post
    }
  } catch (error) {
    const message = `❌ 切换实现失败: ${error.message}`
    console.error(message)
    
    // 调用日志回调函数（如果提供）
    if (logCallback && typeof logCallback === 'function') {
      logCallback(message, 'error')
    }
    
    throw error
  }
}

// 获取当前 API 客户端
export function getCurrentApiClient() {
  return currentApiClient
}

// 清除缓存功能（需要通过 RequestBus 实现）
let requestBus = null

export function clearCache() {
  if (!requestBus) {
    // 创建一个临时的 RequestBus 实例用于缓存管理
    requestBus = createRequestBus(currentImplementation, {
      globalConfig: {
        debug: true,
        timeout: 10000,
      },
    })
  }
  requestBus.clearCache()
}
