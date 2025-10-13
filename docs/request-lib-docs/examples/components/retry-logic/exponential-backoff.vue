<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-tag type="success">GET</n-tag>
      <n-tag type="info">https://jsonplaceholder.typicode.com/posts/999</n-tag>
      <n-button type="primary" @click="fetchWithBackoff" :loading="loading">
        发送请求
      </n-button>
    </n-flex>

    <!-- 退避策略配置 -->
    <n-card size="small" title="指数退避配置">
      <n-flex vertical>
        <n-text>
          <n-text strong>重试次数: </n-text>
          <n-input-number
            v-model:value="retries"
            :min="1"
            :max="5"
            style="width: 120px"
          />
        </n-text>
        <n-text>
          <n-text strong>基础延迟: </n-text>
          <n-input-number
            v-model:value="baseDelay"
            :min="500"
            :max="5000"
            :step="500"
            style="width: 120px"
          />
          <n-text depth="3">毫秒</n-text>
        </n-text>
        <n-text>
          <n-text strong>退避因子: </n-text>
          <n-input-number
            v-model:value="backoffFactor"
            :min="1"
            :max="3"
            :step="0.5"
            style="width: 120px"
          />
        </n-text>
        <n-divider style="margin: 8px 0" />
        <n-text depth="3">
          延迟序列：{{ delaySequence }}
        </n-text>
      </n-flex>
    </n-card>

    <!-- 可视化时间线 -->
    <n-card size="small" title="重试时间线">
      <n-timeline>
        <n-timeline-item
          v-for="(item, index) in timeline"
          :key="index"
          :type="item.type"
          :title="item.title"
          :content="item.content"
          :time="item.time"
        />
        <n-timeline-item
          v-if="loading"
          type="info"
          title="进行中..."
          :time="getCurrentTime()"
        />
      </n-timeline>
    </n-card>

    <!-- 对比表格 -->
    <n-card size="small" title="延迟策略对比">
      <n-table :bordered="false" :single-line="false">
        <thead>
          <tr>
            <th>重试次数</th>
            <th>固定延迟 (1s)</th>
            <th>线性退避 (x1.5)</th>
            <th>指数退避 (x2)</th>
            <th>指数退避 (x3)</th>
          </tr>
        </thead>
        <tbody>
          <tr v-for="i in 5" :key="i">
            <td>第 {{ i }} 次</td>
            <td>{{ 1000 }}ms</td>
            <td>{{ Math.round(1000 * Math.pow(1.5, i - 1)) }}ms</td>
            <td>{{ Math.round(1000 * Math.pow(2, i - 1)) }}ms</td>
            <td>{{ Math.round(1000 * Math.pow(3, i - 1)) }}ms</td>
          </tr>
        </tbody>
      </n-table>
    </n-card>

    <!-- 错误信息 -->
    <n-alert v-if="errorMessage" type="error" title="请求失败">
      {{ errorMessage }}
    </n-alert>
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NFlex,
  NTag,
  NButton,
  NCard,
  NText,
  NInputNumber,
  NAlert,
  NDivider,
  NTimeline,
  NTimelineItem,
  NTable,
} from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// API类 - 演示指数退避
class PostApi {
  requestCore: any
  onRetry?: (attempt: number, delay: number) => void

  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getPost(
    postId: number,
    retries: number,
    delay: number,
    backoffFactor: number
  ) {
    return this.requestCore.requestWithRetry(
      {
        url: `https://jsonplaceholder.typicode.com/posts/${postId}`,
        method: 'GET',
      },
      {
        retries: retries,
        delay: delay,
        backoffFactor: backoffFactor,
        shouldRetry: (error: any, attempt: number) => {
          // 计算当前延迟
          const currentDelay = delay * Math.pow(backoffFactor, attempt)
          if (this.onRetry) {
            this.onRetry(attempt, currentDelay)
          }
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
const retries = ref(4)
const baseDelay = ref(1000)
const backoffFactor = ref(2)
const errorMessage = ref('')
const timeline = ref<
  Array<{ type: 'default' | 'success' | 'error' | 'warning' | 'info'; title: string; content: string; time: string }>
>([])

// 计算延迟序列
const delaySequence = computed(() => {
  const sequence: string[] = []
  for (let i = 0; i < retries.value; i++) {
    const delay = Math.round(
      baseDelay.value * Math.pow(backoffFactor.value, i)
    )
    sequence.push(`${delay}ms`)
  }
  return sequence.join(' → ')
})

// 获取当前时间
const getCurrentTime = () => {
  return new Date().toLocaleTimeString()
}

// 添加时间线项
const addTimelineItem = (
  type: 'default' | 'success' | 'error' | 'warning' | 'info',
  title: string,
  content: string
) => {
  timeline.value.push({
    type,
    title,
    content,
    time: getCurrentTime(),
  })
}

// 发送带指数退避的请求
const fetchWithBackoff = async () => {
  try {
    loading.value = true
    errorMessage.value = ''
    timeline.value = []

    addTimelineItem('info', 'Request started', 'Attempting to fetch data...')

    // 设置重试回调
    apiClient.post.onRetry = (attempt: number, delay: number) => {
      addTimelineItem(
        'error',
        `Attempt ${attempt + 1} failed`,
        `Retrying in ${delay}ms (exponential backoff)`
      )
    }

    await apiClient.post.getPost(
      999,
      retries.value,
      baseDelay.value,
      backoffFactor.value
    )

    addTimelineItem('success', 'Request succeeded', 'Data fetched successfully')
  } catch (error: any) {
    errorMessage.value = error.message || 'Request failed after all retries'
    addTimelineItem(
      'error',
      'All retries exhausted',
      `Failed after ${retries.value} retries with exponential backoff`
    )
    console.error('Request failed:', error)
  } finally {
    loading.value = false
  }
}
</script>

