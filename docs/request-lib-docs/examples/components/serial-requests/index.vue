<template>
  <div>
    <p>演示同一serialKey的请求会串行执行，不同serialKey的请求可以并行执行</p>
    
    <button @click="runDemo" :disabled="isLoading">
      {{ isLoading ? '请求中...' : '开始演示' }}
    </button>
    <button @click="clearLogs" :disabled="isLoading">清空</button>

    <h4>执行日志</h4>
    <ol>
      <li v-for="(log, index) in logs" :key="index">
        <strong>{{ log.time }}</strong> - {{ log.message }}
        <span v-if="log.user"> (用户: {{ log.user }})</span>
      </li>
    </ol>
  </div>
</template>

<script setup>
import { ref } from 'vue'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

const logs = ref([])
const isLoading = ref(false)

const addLog = (message, user = null) => {
  logs.value.push({
    time: new Date().toLocaleTimeString(),
    message,
    user
  })
}

const clearLogs = () => {
  logs.value = []
}

// 创建带日志的请求器
const loggingRequestor = {
  async request(config) {
    const serialKey = config.serialKey || '无'
    const userId = config.url.split('/').pop()
    const startTime = Date.now()
    
    addLog(`[${serialKey}] 开始请求用户 ${userId}`)
    
    try {
      const response = await fetchRequestor.request(config)
      const duration = Date.now() - startTime
      addLog(`[${serialKey}] 用户 ${userId} 请求完成 (${duration}ms)`, response.name)
      return response
    } catch (error) {
      const duration = Date.now() - startTime
      addLog(`[${serialKey}] 用户 ${userId} 请求失败 (${duration}ms)`)
      console.error('Request failed:', error)
      throw error
    }
  }
}

// API 类定义
class SerialDemoApi {
  constructor(requestCore) {
    this.requestCore = requestCore
  }

  // 获取用户信息 - 串行请求
  getUser(userId, serialKey) {
    return this.requestCore.getSerial(
      `https://jsonplaceholder.typicode.com/users/${userId}`,
      serialKey
    )
  }
}

// 创建 API 客户端
const apiClient = createApiClient(
  { demo: SerialDemoApi },
  { requestor: loggingRequestor }
)

const runDemo = async () => {
  clearLogs()
  isLoading.value = true

  addLog('开始串行请求演示')
  addLog('说明: group-A的请求会串行执行，group-B的请求也会串行执行，但两组之间可以并行')

  try {
    // 创建多个请求
    // group-A: 用户1、2、3 (串行执行)
    // group-B: 用户4、5 (串行执行)  
    // 两组之间并行执行
    const requests = [
      apiClient.demo.getUser(1, 'group-A'), // 串行组A
      apiClient.demo.getUser(4, 'group-B'), // 串行组B
      apiClient.demo.getUser(2, 'group-A'), // 串行组A
      apiClient.demo.getUser(5, 'group-B'), // 串行组B
      apiClient.demo.getUser(3, 'group-A'), // 串行组A
    ]

    await Promise.all(requests)
    addLog('所有请求完成')
  } catch (error) {
    addLog(`发生错误: ${error.message}`)
    console.error('Serial request demo error:', error)
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* 使用原生HTML样式，最小化自定义CSS */
button {
  margin-right: 10px;
}

button:disabled {
  opacity: 0.6;
}

ol {
  margin-top: 10px;
}

li {
  margin-bottom: 5px;
}
</style>
