import { createRequestBus } from 'request-bus'
import UserApi from './user'
import PostApi from './post'

// 创建 RequestBus 实例（使用新的工厂模式）
export const requestBus = createRequestBus('axios', {
  globalConfig: {
    debug: true,
    timeout: 10000,
  },
})

export function switchImplementation(implementation, logCallback = null) {
  console.log(`正在切换到 ${implementation} 实现...`)

  try {
    // 使用 RequestBus 内置的 switchImplementation 方法
    requestBus.switchImplementation(implementation, {
      clearCache: false, // 保留缓存
      preserveInterceptors: true, // 保留拦截器
      preserveGlobalConfig: true // 保留全局配置
    })

    // API 实例会被自动更新，我们需要重新获取引用
    const updatedUserApi = requestBus.getApi('user')
    const updatedPostApi = requestBus.getApi('post')

    // 更新全局引用（如果存在window对象）
    if (typeof window !== 'undefined') {
      window.requestBus = requestBus
      window.userApi = updatedUserApi
      window.postApi = updatedPostApi
    }

    const message = `✅ 已成功切换到 ${implementation} 实现`
    console.log(message)
    
    // 调用日志回调函数（如果提供）
    if (logCallback && typeof logCallback === 'function') {
      logCallback(message, 'success')
    }

    return {
      requestBus,
      userApi: updatedUserApi,
      postApi: updatedPostApi
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

// 注册 API
export const userApi = requestBus.register('user', UserApi)
export const postApi = requestBus.register('post', PostApi)
