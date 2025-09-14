// 浏览器演示主文件
import { apiClient, switchImplementation, userApi, postApi, getCurrentApiClient, clearCache } from './api'

window.testBasicRequest = testBasicRequest
window.testUserList = testUserList
window.testRetry = testRetry
window.testCache = testCache
window.clearCache = clearCacheHandler
window.testPost = testPost
window.testError = testError
window.testPerformance = testPerformance

// 当前的 API 客户端和 API 实例（用于切换实现）
let currentApiClient = apiClient
let currentUserApi = userApi
let currentPostApi = postApi

// 监听实现切换
document.addEventListener('DOMContentLoaded', () => {
  const radios = document.querySelectorAll('input[name="implementation"]')
  radios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      if (e.target.checked) {
        handleImplementationSwitch(e.target.value)
      }
    })
  })
})

// 处理实现切换
async function handleImplementationSwitch(implementation) {
  try {
    // 创建日志回调函数
    const logCallback = (message, type) => {
      log('basic-result', message, type)
    }

    // 调用切换函数
    const result = switchImplementation(implementation, logCallback)
    
    // 更新全局引用
    if (result) {
      currentApiClient = result.apiClient
      currentUserApi = result.userApi
      currentPostApi = result.postApi
      
      // 更新 window 对象引用
      window.currentApiClient = currentApiClient
      window.currentUserApi = currentUserApi
      window.currentPostApi = currentPostApi
    }
    
  } catch (error) {
    log('basic-result', `❌ 实现切换失败: ${error.message}`, 'error')
    console.error('Implementation switch failed:', error)
  }
}

// 工具函数：日志输出
function log(elementId, message, type = 'info') {
  const element = document.getElementById(elementId)
  const timestamp = new Date().toLocaleTimeString()
  const className =
    type === 'error'
      ? 'error'
      : type === 'success'
      ? 'success'
      : type === 'loading'
      ? 'loading'
      : ''

  if (element) {
    element.innerHTML = `<span class="${className}">[${timestamp}] ${message}</span>`
  }
  console.log(`[${timestamp}] ${message}`)
}

// 工具函数：追加日志
function appendLog(elementId, message, type = 'info') {
  const element = document.getElementById(elementId)
  const timestamp = new Date().toLocaleTimeString()
  const className =
    type === 'error'
      ? 'error'
      : type === 'success'
      ? 'success'
      : type === 'loading'
      ? 'loading'
      : ''

  if (element) {
    element.innerHTML += `\n<span class="${className}">[${timestamp}] ${message}</span>`
    element.scrollTop = element.scrollHeight
  }
  console.log(`[${timestamp}] ${message}`)
}

// 1. 基础请求功能
async function testBasicRequest() {
  log('basic-result', '正在获取用户信息...', 'loading')

  try {
    const user = await currentUserApi.getUserInfo('1')
    log(
      'basic-result',
      `获取用户信息成功：\n${JSON.stringify(user, null, 2)}`,
      'success'
    )
  } catch (error) {
    log('basic-result', `获取用户信息失败：${error.message}`, 'error')
  }
}

async function testUserList() {
  log('basic-result', '正在获取用户列表...', 'loading')

  try {
    const users = await currentUserApi.getUserList()
    log(
      'basic-result',
      `获取用户列表成功，共 ${users.length} 个用户：\n${JSON.stringify(
        users.slice(0, 3),
        null,
        2
      )}...`,
      'success'
    )
  } catch (error) {
    log('basic-result', `获取用户列表失败：${error.message}`, 'error')
  }
}

// 2. 重试功能演示
async function testRetry() {
  log('retry-result', '测试重试机制（模拟失败请求）...', 'loading')

  try {
    // 尝试获取不存在的用户，会触发重试
    const user = await currentUserApi.getUserInfo('999999')
    log(
      'retry-result',
      `意外成功：\n${JSON.stringify(user, null, 2)}`,
      'success'
    )
  } catch (error) {
    log(
      'retry-result',
      `重试后最终失败（这是预期的）：${error.message}`,
      'error'
    )
  }
}

// 3. 缓存功能演示
async function testCache() {
  log('cache-result', '测试缓存功能...', 'loading')

  try {
    appendLog(
      'cache-result',
      '首次请求用户列表（应该发起网络请求）...',
      'loading'
    )
    const start1 = Date.now()
    const users1 = await currentUserApi.getUserList()
    const time1 = Date.now() - start1

    appendLog(
      'cache-result',
      `首次请求完成，耗时：${time1}ms，用户数：${users1.length}`,
      'success'
    )

    appendLog('cache-result', '再次请求用户列表（应该命中缓存）...', 'loading')
    const start2 = Date.now()
    const users2 = await currentUserApi.getUserList()
    const time2 = Date.now() - start2

    appendLog(
      'cache-result',
      `缓存请求完成，耗时：${time2}ms，用户数：${users2.length}`,
      'success'
    )
    appendLog(
      'cache-result',
      `缓存效果：速度提升 ${time1 - time2}ms`,
      'success'
    )
  } catch (error) {
    log('cache-result', `缓存测试失败：${error.message}`, 'error')
  }
}

function clearCacheHandler() {
  clearCache()
  log('cache-result', '缓存已清除', 'success')
}

// 4. POST 请求演示
async function testPost() {
  log('post-result', '正在创建新文章...', 'loading')

  try {
    const newPost = await currentPostApi.createPost({
      userId: 1,
      title: '浏览器演示文章',
      body: '这是在浏览器中创建的测试文章，用于演示 POST 请求功能。',
    })

    log(
      'post-result',
      `文章创建成功：\n${JSON.stringify(newPost, null, 2)}`,
      'success'
    )
  } catch (error) {
    log('post-result', `文章创建失败：${error.message}`, 'error')
  }
}

// 5. 错误处理演示
async function testError() {
  log('error-result', '测试错误处理机制...', 'loading')

  try {
    // 尝试访问不存在的端点
    await currentPostApi.getPost(99999)
    log('error-result', '意外成功（这不应该发生）', 'error')
  } catch (error) {
    log(
      'error-result',
      `成功捕获错误（这是预期的）：\n错误类型：${error.constructor.name}\n错误信息：${error.message}`,
      'success'
    )
  }
}

// 6. 性能测试
async function testPerformance() {
  log('performance-result', '开始并发请求测试...', 'loading')

  const concurrency = 5 // 并发数
  const requests = []

  const startTime = Date.now()

  try {
    // 创建多个并发请求
    for (let i = 1; i <= concurrency; i++) {
      requests.push(
        currentUserApi
          .getUserInfo(i.toString())
          .then((user) => ({
            success: true,
            userId: i,
            data: user,
          }))
          .catch((error) => ({
            success: false,
            userId: i,
            error: error.message,
          }))
      )
    }

    appendLog(
      'performance-result',
      `发起 ${concurrency} 个并发请求...`,
      'loading'
    )

    const results = await Promise.all(requests)
    const totalTime = Date.now() - startTime

    const successful = results.filter((r) => r.success).length
    const failed = results.filter((r) => !r.success).length

    appendLog('performance-result', `并发测试完成：`, 'success')
    appendLog('performance-result', `总耗时：${totalTime}ms`, 'info')
    appendLog('performance-result', `成功：${successful} 个`, 'success')
    appendLog(
      'performance-result',
      `失败：${failed} 个`,
      failed > 0 ? 'error' : 'info'
    )
    appendLog(
      'performance-result',
      `平均响应时间：${Math.round(totalTime / concurrency)}ms`,
      'info'
    )

    // 显示详细结果
    results.forEach((result) => {
      if (result.success) {
        appendLog(
          'performance-result',
          `用户 ${result.userId}：${result.data.name}`,
          'success'
        )
      } else {
        appendLog(
          'performance-result',
          `用户 ${result.userId}：${result.error}`,
          'error'
        )
      }
    })
  } catch (error) {
    log('performance-result', `性能测试失败：${error.message}`, 'error')
  }
}

// 页面加载完成后的初始化
document.addEventListener('DOMContentLoaded', () => {
  console.log('🚀 Request library browser demo loaded (createApiClient pattern)')
  console.log('apiClient:', currentApiClient)
  console.log('userApi:', currentUserApi)
  console.log('postApi:', currentPostApi)
  
  // 初始化 window 对象引用，方便调试
  window.currentApiClient = currentApiClient
  window.currentUserApi = currentUserApi
  window.currentPostApi = currentPostApi
  window.apiClient = apiClient
  window.userApi = userApi
  window.postApi = postApi
  
  // 添加全局测试函数引用
  window.handleImplementationSwitch = handleImplementationSwitch
  
  console.log('🎯 Global objects setup, available in console:')
  console.log('  - window.currentApiClient (current API client)')
  console.log('  - window.currentUserApi (current user API)')
  console.log('  - window.currentPostApi (current post API)')
  console.log('  - window.handleImplementationSwitch(implementation) (switch implementation)')
})
