<template>
  <n-flex vertical>
    <!-- TTL 设置 -->
    <n-card size="small" title="缓存时间配置">
      <n-flex vertical>
        <n-text depth="3">选择缓存有效期（TTL）：</n-text>
        <n-radio-group v-model:value="selectedTtl">
          <n-flex>
            <n-radio :value="10000">10秒（短期）</n-radio>
            <n-radio :value="30000">30秒（中期）</n-radio>
            <n-radio :value="60000">60秒（长期）</n-radio>
          </n-flex>
        </n-radio-group>
        <n-text depth="3">
          当前缓存有效期：<n-tag type="info">{{ selectedTtl / 1000 }}秒</n-tag>
        </n-text>
      </n-flex>
    </n-card>

    <!-- 请求操作 -->
    <n-flex align="center">
      <n-tag type="success">GET</n-tag>
      <n-tag type="info"
        >https://jsonplaceholder.typicode.com/todos/{{ todoId }}</n-tag
      >
      <n-input-number
        v-model:value="todoId"
        :min="1"
        :max="200"
        style="width: 120px"
      />
      <n-button type="primary" @click="fetchTodo" :loading="loading">
        发送请求
      </n-button>
    </n-flex>

    <!-- 缓存状态监控 -->
    <n-card size="small" title="缓存状态监控">
      <n-flex vertical>
        <n-text>
          <n-text strong>请求时间: </n-text>
          <n-tag>{{ lastRequestTime || '未请求' }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>响应速度: </n-text>
          <n-tag :type="getDurationTag()">{{ requestDuration }}ms</n-tag>
        </n-text>
        <n-text>
          <n-text strong>数据来源: </n-text>
          <n-tag :type="fromCache ? 'success' : 'warning'">
            {{ fromCache ? '缓存' : '服务器' }}
          </n-tag>
        </n-text>
        <n-text>
          <n-text strong>缓存过期时间: </n-text>
          <n-tag v-if="cacheExpireTime" type="error">
            {{ formatExpireTime() }}
          </n-tag>
          <n-tag v-else>未缓存</n-tag>
        </n-text>
        <n-progress
          v-if="cacheExpireTime && remainingPercent > 0"
          type="line"
          :percentage="remainingPercent"
          :status="getProgressStatus()"
        />
        <n-text depth="3">
          提示：缓存过期后，下次请求将重新从服务器获取数据
        </n-text>
      </n-flex>
    </n-card>

    <!-- 响应数据 -->
    <n-code
      v-if="todoData"
      :code="JSON.stringify(todoData, null, 2)"
      :hljs="hljs"
      language="json"
    />
    <n-empty v-else description="选择TTL并发送请求" />
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import {
  NFlex,
  NTag,
  NCode,
  NButton,
  NEmpty,
  NCard,
  NText,
  NRadioGroup,
  NRadio,
  NInputNumber,
  NProgress,
} from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', json)

// TodoAPI类 - 演示TTL
class TodoApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getTodo(todoId: number, ttl: number) {
    return this.requestCore.requestWithCache(
      {
        url: `https://jsonplaceholder.typicode.com/todos/${todoId}`,
        method: 'GET',
      },
      {
        ttl: ttl,
        key: `todo-${todoId}-${ttl}`,
      }
    )
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { todo: TodoApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 状态管理
const todoId = ref(1)
const todoData = ref<any>(null)
const loading = ref(false)
const selectedTtl = ref(30000) // 默认 30 秒
const fromCache = ref(false)
const requestDuration = ref(0)
const lastRequestTime = ref('')
const cacheExpireTime = ref(0)
const currentTime = ref(Date.now())

// 定时器更新当前时间
let timer: NodeJS.Timeout | null = null
onMounted(() => {
  timer = setInterval(() => {
    currentTime.value = Date.now()
  }, 100)
})

onUnmounted(() => {
  if (timer) {
    clearInterval(timer)
  }
})

// 计算缓存剩余时间百分比
const remainingPercent = computed(() => {
  if (!cacheExpireTime.value) return 0
  const remaining = cacheExpireTime.value - currentTime.value
  if (remaining <= 0) {
    cacheExpireTime.value = 0
    return 0
  }
  return (remaining / selectedTtl.value) * 100
})

// 格式化过期时间
const formatExpireTime = () => {
  if (!cacheExpireTime.value) return '未缓存'
  const remaining = Math.max(0, cacheExpireTime.value - currentTime.value)
  if (remaining === 0) return '已过期'
  const seconds = Math.floor(remaining / 1000)
  const ms = remaining % 1000
  return `${seconds}秒${ms}毫秒后过期`
}

// 获取进度条状态
const getProgressStatus = () => {
  const percent = remainingPercent.value
  if (percent > 50) return 'success'
  if (percent > 20) return 'warning'
  return 'error'
}

// 获取响应时间标签类型
const getDurationTag = () => {
  if (requestDuration.value < 10) return 'success'
  if (requestDuration.value < 100) return 'warning'
  return 'default'
}

// 发送请求
const fetchTodo = async () => {
  try {
    loading.value = true
    const startTime = Date.now()

    todoData.value = await apiClient.todo.getTodo(todoId.value, selectedTtl.value)

    const endTime = Date.now()
    requestDuration.value = endTime - startTime
    fromCache.value = requestDuration.value < 10
    lastRequestTime.value = new Date().toLocaleTimeString()

    if (!fromCache.value) {
      // 如果是从服务器获取的，设置缓存过期时间
      cacheExpireTime.value = endTime + selectedTtl.value
    }
  } catch (error) {
    console.error('Request failed:', error)
  } finally {
    loading.value = false
  }
}
</script>

