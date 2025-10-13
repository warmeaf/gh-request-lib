<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-tag :type="getMethodTag()">{{ selectedMethod }}</n-tag>
      <n-tag type="info">{{ getUrl() }}</n-tag>
      <n-button type="primary" @click="sendRequest" :loading="loading">
        发送请求
      </n-button>
    </n-flex>

    <!-- 请求配置 -->
    <n-card size="small" title="请求配置">
      <n-flex vertical>
        <n-text>
          <n-text strong>请求方法: </n-text>
          <n-radio-group v-model:value="selectedMethod">
            <n-flex>
              <n-radio value="GET">GET</n-radio>
              <n-radio value="POST">POST</n-radio>
            </n-flex>
          </n-radio-group>
        </n-text>
        <n-text>
          <n-text strong>资源 ID: </n-text>
          <n-input-number
            v-model:value="resourceId"
            :min="1"
            :max="1000"
            style="width: 120px"
          />
          <n-text depth="3">(999+ 会触发 404 错误)</n-text>
        </n-text>
      </n-flex>
    </n-card>

    <!-- 重试策略选择 -->
    <n-card size="small" title="自定义重试策略">
      <n-flex vertical>
        <n-text>
          <n-text strong>重试策略: </n-text>
          <n-select
            v-model:value="selectedStrategy"
            :options="strategyOptions"
            style="width: 100%"
          />
        </n-text>
        <n-divider style="margin: 8px 0" />
        <n-text depth="3">
          {{ strategyDescriptions[selectedStrategy] }}
        </n-text>
      </n-flex>
    </n-card>

    <!-- 重试条件说明 -->
    <n-card size="small" title="当前重试规则">
      <n-flex vertical>
        <n-text strong>会重试的错误:</n-text>
        <n-ul>
          <n-li
            v-for="(condition, index) in currentRetryConditions"
            :key="index"
          >
            <n-tag :type="condition.type" size="small">
              {{ condition.label }}
            </n-tag>
            <n-text depth="3"> - {{ condition.description }}</n-text>
          </n-li>
        </n-ul>
        <n-text strong style="margin-top: 8px">不会重试的错误:</n-text>
        <n-ul>
          <n-li
            v-for="(condition, index) in currentNoRetryConditions"
            :key="index"
          >
            <n-tag type="default" size="small">
              {{ condition.label }}
            </n-tag>
            <n-text depth="3"> - {{ condition.description }}</n-text>
          </n-li>
        </n-ul>
      </n-flex>
    </n-card>

    <!-- 请求日志 -->
    <n-card size="small" title="请求日志">
      <n-scrollbar style="max-height: 200px">
        <n-flex vertical>
          <n-text
            v-for="(log, index) in requestLogs"
            :key="index"
            :type="getLogType(log.type)"
          >
            [{{ log.time }}] {{ log.message }}
          </n-text>
          <n-empty v-if="requestLogs.length === 0" description="暂无日志" />
        </n-flex>
      </n-scrollbar>
    </n-card>

    <!-- 结果展示 -->
    <n-alert v-if="errorMessage" type="error" title="请求失败">
      {{ errorMessage }}
    </n-alert>

    <n-alert v-if="successMessage" type="success" title="请求成功">
      {{ successMessage }}
    </n-alert>

    <n-code
      v-if="responseData"
      :code="JSON.stringify(responseData, null, 2)"
      :hljs="hljs"
      language="json"
    />
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NFlex,
  NTag,
  NCode,
  NButton,
  NCard,
  NText,
  NInputNumber,
  NAlert,
  NDivider,
  NRadioGroup,
  NRadio,
  NSelect,
  NEmpty,
  NScrollbar,
  NUl,
  NLi,
} from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', json)

// 重试策略类型
type RetryStrategy = 'aggressive' | 'conservative' | 'network-only' | 'smart'

// API类 - 演示自定义重试条件
class ApiClient {
  requestCore: any
  onRetry?: (attempt: number, error: any, willRetry: boolean) => void

  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  // 积极重试策略 - 几乎所有错误都重试
  async aggressiveRetry(url: string, method: string) {
    return this.requestCore.requestWithRetry(
      { url, method },
      {
        retries: 5,
        delay: 1000,
        backoffFactor: 1.5,
        shouldRetry: (error: any, attempt: number) => {
          const willRetry = true // 总是重试
          if (this.onRetry) this.onRetry(attempt, error, willRetry)
          return willRetry
        },
      }
    )
  }

  // 保守重试策略 - 仅网络错误重试
  async conservativeRetry(url: string, method: string) {
    return this.requestCore.requestWithRetry(
      { url, method },
      {
        retries: 3,
        delay: 2000,
        shouldRetry: (error: any, attempt: number) => {
          // 仅重试网络错误
          const isNetworkError = error?.message?.includes('network') || 
                                 error?.message?.includes('fetch')
          if (this.onRetry) this.onRetry(attempt, error, isNetworkError)
          return isNetworkError
        },
      }
    )
  }

  // 仅网络错误策略 - 只重试纯网络问题
  async networkOnlyRetry(url: string, method: string) {
    return this.requestCore.requestWithRetry(
      { url, method },
      {
        retries: 4,
        delay: 1500,
        shouldRetry: (error: any, attempt: number) => {
          // 只重试网络连接问题
          const isNetworkIssue = 
            error?.message?.includes('Failed to fetch') ||
            error?.message?.includes('Network request failed')
          if (this.onRetry) this.onRetry(attempt, error, isNetworkIssue)
          return isNetworkIssue
        },
      }
    )
  }

  // 智能重试策略 - 根据错误类型和状态码智能判断
  async smartRetry(url: string, method: string) {
    return this.requestCore.requestWithRetry(
      { url, method },
      {
        retries: 4,
        delay: 1000,
        backoffFactor: 2,
        shouldRetry: (error: any, attempt: number) => {
          let willRetry = false

          // 网络错误 - 总是重试
          if (error?.message?.includes('network') || 
              error?.message?.includes('fetch')) {
            willRetry = true
          }
          // 5xx 服务器错误 - 重试
          else if (error?.status >= 500 && error?.status < 600) {
            willRetry = true
          }
          // 429 Too Many Requests - 仅前 2 次重试
          else if (error?.status === 429 && attempt < 2) {
            willRetry = true
          }
          // 408 Request Timeout - 重试
          else if (error?.status === 408) {
            willRetry = true
          }
          // 其他错误不重试

          if (this.onRetry) this.onRetry(attempt, error, willRetry)
          return willRetry
        },
      }
    )
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { api: ApiClient },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 状态管理
const loading = ref(false)
const selectedMethod = ref<'GET' | 'POST'>('GET')
const resourceId = ref(999)
const selectedStrategy = ref<RetryStrategy>('smart')
const errorMessage = ref('')
const successMessage = ref('')
const responseData = ref<any>(null)
const requestLogs = ref<Array<{ time: string; message: string; type: string }>>([])

// 策略选项
const strategyOptions = [
  { label: '智能重试 (推荐)', value: 'smart' },
  { label: '积极重试', value: 'aggressive' },
  { label: '保守重试', value: 'conservative' },
  { label: '仅网络错误', value: 'network-only' },
]

// 策略描述
const strategyDescriptions: Record<RetryStrategy, string> = {
  smart: '根据错误类型智能判断：网络错误和 5xx 总是重试，429 限制重试次数，4xx 不重试',
  aggressive: '几乎所有错误都会重试，重试次数最多（5次）',
  conservative: '只重试网络相关错误，重试次数较少（3次）',
  'network-only': '仅重试纯网络连接问题，不重试 HTTP 错误',
}

// 当前重试条件
const currentRetryConditions = computed(() => {
  const conditions: Record<RetryStrategy, any[]> = {
    smart: [
      { label: '网络错误', type: 'error', description: '连接失败、DNS错误等' },
      { label: '5xx错误', type: 'error', description: '服务器内部错误' },
      { label: '429错误', type: 'warning', description: '请求过多（限前2次）' },
      { label: '408错误', type: 'warning', description: '请求超时' },
    ],
    aggressive: [
      { label: '所有错误', type: 'error', description: '包括4xx、5xx、网络错误等' },
    ],
    conservative: [
      { label: '网络错误', type: 'error', description: '仅网络相关问题' },
    ],
    'network-only': [
      { label: '连接失败', type: 'error', description: 'Failed to fetch' },
      { label: '网络请求失败', type: 'error', description: 'Network request failed' },
    ],
  }
  return conditions[selectedStrategy.value]
})

// 不会重试的条件
const currentNoRetryConditions = computed(() => {
  const conditions: Record<RetryStrategy, any[]> = {
    smart: [
      { label: '400错误', description: '请求参数错误' },
      { label: '401错误', description: '未授权' },
      { label: '403错误', description: '禁止访问' },
      { label: '404错误', description: '资源不存在' },
    ],
    aggressive: [],
    conservative: [
      { label: '所有HTTP错误', description: '4xx、5xx 等状态码错误' },
    ],
    'network-only': [
      { label: '所有HTTP错误', description: '包括4xx、5xx等所有状态码' },
    ],
  }
  return conditions[selectedStrategy.value]
})

// 获取方法标签颜色
const getMethodTag = () => {
  return selectedMethod.value === 'GET' ? 'success' : 'warning'
}

// 获取URL
const getUrl = () => {
  if (selectedMethod.value === 'GET') {
    return `https://jsonplaceholder.typicode.com/posts/${resourceId.value}`
  } else {
    return 'https://jsonplaceholder.typicode.com/posts'
  }
}

// 获取日志类型
const getLogType = (type: string) => {
  if (type === 'error') return 'error'
  if (type === 'success') return 'success'
  if (type === 'warning') return 'warning'
  return 'default'
}

// 添加日志
const addLog = (message: string, type: string = 'info') => {
  const time = new Date().toLocaleTimeString()
  requestLogs.value.push({ time, message, type })
}

// 发送请求
const sendRequest = async () => {
  try {
    loading.value = true
    errorMessage.value = ''
    successMessage.value = ''
    responseData.value = null
    requestLogs.value = []

    const url = getUrl()
    addLog(`Starting request: ${selectedMethod.value} ${url}`, 'info')
    addLog(`Retry strategy: ${selectedStrategy.value}`, 'info')

    // 设置重试回调
    apiClient.api.onRetry = (attempt: number, error: any, willRetry: boolean) => {
      const errorMsg = error?.message || error?.status || 'Unknown error'
      addLog(`Attempt ${attempt + 1} failed: ${errorMsg}`, 'error')
      if (willRetry) {
        addLog(`Will retry according to ${selectedStrategy.value} strategy`, 'warning')
      } else {
        addLog(`Will NOT retry (not matching retry conditions)`, 'info')
      }
    }

    // 根据策略调用不同方法
    let result
    switch (selectedStrategy.value) {
      case 'aggressive':
        result = await apiClient.api.aggressiveRetry(url, selectedMethod.value)
        break
      case 'conservative':
        result = await apiClient.api.conservativeRetry(url, selectedMethod.value)
        break
      case 'network-only':
        result = await apiClient.api.networkOnlyRetry(url, selectedMethod.value)
        break
      case 'smart':
      default:
        result = await apiClient.api.smartRetry(url, selectedMethod.value)
        break
    }

    responseData.value = result
    successMessage.value = 'Request succeeded!'
    addLog('Request succeeded!', 'success')
  } catch (error: any) {
    errorMessage.value = error.message || 'Request failed after all retries'
    addLog(`Final error: ${errorMessage.value}`, 'error')
    console.error('Request failed:', error)
  } finally {
    loading.value = false
  }
}
</script>

