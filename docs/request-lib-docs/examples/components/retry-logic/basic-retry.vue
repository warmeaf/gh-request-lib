<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-tag type="success">GET</n-tag>
      <n-tag type="info">https://jsonplaceholder.typicode.com/posts/999</n-tag>
      <n-button type="primary" @click="fetchWithRetry" :loading="loading">
        发送请求（带重试）
      </n-button>
      <n-button @click="clearLogs">清除日志</n-button>
    </n-flex>

    <!-- 重试配置 -->
    <n-card size="small" title="重试配置">
      <n-flex vertical>
        <n-text>
          <n-text strong>最大重试次数: </n-text>
          <n-input-number
            v-model:value="retries"
            :min="1"
            :max="5"
            style="width: 120px"
          />
        </n-text>
        <n-text>
          <n-text strong>重试延迟: </n-text>
          <n-input-number
            v-model:value="delay"
            :min="500"
            :max="5000"
            :step="500"
            style="width: 120px"
          />
          <n-text depth="3">毫秒</n-text>
        </n-text>
        <n-text depth="3">
          提示：此示例使用一个不存在的资源 ID (999) 来模拟失败场景
        </n-text>
      </n-flex>
    </n-card>

    <!-- 重试状态 -->
    <n-card size="small" title="重试状态">
      <n-flex vertical>
        <n-text>
          <n-text strong>当前尝试次数: </n-text>
          <n-tag :type="attemptCount > 0 ? 'warning' : 'default'">
            {{ attemptCount }} / {{ retries + 1 }}
          </n-tag>
        </n-text>
        <n-text>
          <n-text strong>请求状态: </n-text>
          <n-tag :type="getStatusTag()">{{ requestStatus }}</n-tag>
        </n-text>
        <n-progress
          v-if="loading && attemptCount > 0"
          type="line"
          :percentage="(attemptCount / (retries + 1)) * 100"
          status="warning"
        />
      </n-flex>
    </n-card>

    <!-- 重试日志 -->
    <n-card size="small" title="重试日志">
      <n-scrollbar style="max-height: 200px">
        <n-flex vertical>
          <n-text
            v-for="(log, index) in retryLogs"
            :key="index"
            :type="log.type === 'error' ? 'error' : log.type === 'success' ? 'success' : 'default'"
          >
            [{{ log.time }}] {{ log.message }}
          </n-text>
          <n-empty v-if="retryLogs.length === 0" description="暂无日志" />
        </n-flex>
      </n-scrollbar>
    </n-card>

    <!-- 错误信息 -->
    <n-alert v-if="errorMessage" type="error" title="请求失败">
      {{ errorMessage }}
    </n-alert>

    <!-- 响应数据 -->
    <n-code
      v-if="responseData"
      :code="JSON.stringify(responseData, null, 2)"
      :hljs="hljs"
      language="json"
    />
  </n-flex>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  NFlex,
  NTag,
  NCode,
  NButton,
  NCard,
  NText,
  NInputNumber,
  NProgress,
  NAlert,
  NEmpty,
  NScrollbar,
} from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', json)

// API类 - 演示基础重试
class PostApi {
  requestCore: any
  onRetry?: (attempt: number, error: any) => void

  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getPost(postId: number, retries: number, delay: number) {
    return this.requestCore.requestWithRetry(
      {
        url: `https://jsonplaceholder.typicode.com/posts/${postId}`,
        method: 'GET',
      },
      {
        retries: retries,
        delay: delay,
        shouldRetry: (error: any, attempt: number) => {
          // 通知外部重试事件
          if (this.onRetry) {
            this.onRetry(attempt, error)
          }
          // 对于 404 错误，仍然重试（仅用于演示）
          return true
        },
      }
    )
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { post: PostApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 状态管理
const loading = ref(false)
const retries = ref(3)
const delay = ref(1000)
const attemptCount = ref(0)
const requestStatus = ref('未开始')
const responseData = ref<any>(null)
const errorMessage = ref('')
const retryLogs = ref<Array<{ time: string; message: string; type: string }>>([])

// 添加日志
const addLog = (message: string, type: string = 'info') => {
  const time = new Date().toLocaleTimeString()
  retryLogs.value.push({ time, message, type })
}

// 获取状态标签颜色
const getStatusTag = () => {
  if (requestStatus.value === '请求成功') return 'success'
  if (requestStatus.value === '重试中...') return 'warning'
  if (requestStatus.value === '请求失败') return 'error'
  return 'default'
}

// 清除日志
const clearLogs = () => {
  retryLogs.value = []
  attemptCount.value = 0
  requestStatus.value = '未开始'
  errorMessage.value = ''
  responseData.value = null
}

// 发送带重试的请求
const fetchWithRetry = async () => {
  try {
    loading.value = true
    attemptCount.value = 0
    requestStatus.value = '请求中...'
    responseData.value = null
    errorMessage.value = ''
    retryLogs.value = []

    addLog('Starting request with retry...', 'info')
    addLog(`Retry config: retries=${retries.value}, delay=${delay.value}ms`, 'info')

    // 设置重试回调
    apiClient.post.onRetry = (attempt: number, error: any) => {
      attemptCount.value = attempt + 1
      requestStatus.value = '重试中...'
      const errorMsg = error?.message || error?.status || 'Unknown error'
      addLog(`Attempt ${attempt + 1} failed: ${errorMsg}`, 'error')
      addLog(`Retrying in ${delay.value}ms...`, 'info')
    }

    const post = await apiClient.post.getPost(999, retries.value, delay.value)

    responseData.value = post
    requestStatus.value = '请求成功'
    addLog('Request succeeded!', 'success')
  } catch (error: any) {
    requestStatus.value = '请求失败'
    errorMessage.value = error.message || 'Request failed after all retries'
    addLog(`All retries exhausted. Final error: ${errorMessage.value}`, 'error')
    console.error('Request failed:', error)
  } finally {
    loading.value = false
  }
}
</script>

