<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-tag type="success">GET</n-tag>
      <n-tag type="info">https://jsonplaceholder.typicode.com/posts/999</n-tag>
      <n-button type="primary" @click="fetchWithJitter" :loading="loading">
        发送请求
      </n-button>
      <n-button @click="compareStrategies">对比策略</n-button>
    </n-flex>

    <!-- 抖动配置 -->
    <n-card size="small" title="抖动配置">
      <n-flex vertical>
        <n-text>
          <n-text strong>抖动因子: </n-text>
          <n-slider
            v-model:value="jitter"
            :min="0"
            :max="1"
            :step="0.1"
            :marks="jitterMarks"
          />
          <n-tag type="info">{{ (jitter * 100).toFixed(0) }}%</n-tag>
        </n-text>
        <n-divider style="margin: 8px 0" />
        <n-text depth="3">
          抖动因子说明：在计算的延迟基础上添加随机偏移
        </n-text>
        <n-text depth="3">
          例如：抖动 30% 时，实际延迟范围为 计算值 × (0.7 ~ 1.3)
        </n-text>
      </n-flex>
    </n-card>

    <!-- 重试配置 -->
    <n-card size="small" title="基础配置">
      <n-flex vertical>
        <n-text>
          <n-text strong>重试次数: </n-text>
          <n-input-number
            v-model:value="retries"
            :min="3"
            :max="8"
            style="width: 120px"
          />
        </n-text>
        <n-text>
          <n-text strong>基础延迟: </n-text>
          <n-tag>1000ms</n-tag>
        </n-text>
        <n-text>
          <n-text strong>退避因子: </n-text>
          <n-tag>2 (指数退避)</n-tag>
        </n-text>
      </n-flex>
    </n-card>

    <!-- 实际延迟展示 -->
    <n-card size="small" title="实际延迟记录">
      <n-flex vertical>
        <n-text
          v-for="(record, index) in delayRecords"
          :key="index"
        >
          <n-text strong>第 {{ index + 1 }} 次重试: </n-text>
          <n-text>理论延迟 {{ record.theoretical }}ms</n-text>
          <n-text> → </n-text>
          <n-text type="success">实际延迟 {{ record.actual }}ms</n-text>
          <n-text depth="3"> ({{ record.variance }})</n-text>
        </n-text>
        <n-empty v-if="delayRecords.length === 0" description="发送请求后显示" />
      </n-flex>
    </n-card>

    <!-- 策略对比图表 -->
    <n-card v-if="comparisonData.length > 0" size="small" title="延迟分布对比">
      <n-flex vertical>
        <n-text depth="3">
          模拟 100 次请求的延迟分布（指数退避 + 不同抖动因子）
        </n-text>
        <n-table :bordered="false" :single-line="false" size="small">
          <thead>
            <tr>
              <th>重试次数</th>
              <th>无抖动</th>
              <th>抖动 20%</th>
              <th>抖动 50%</th>
              <th>抖动 100%</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(data, index) in comparisonData" :key="index">
              <td>第 {{ index + 1 }} 次</td>
              <td>{{ data.noJitter }}ms</td>
              <td>{{ data.jitter20 }}</td>
              <td>{{ data.jitter50 }}</td>
              <td>{{ data.jitter100 }}</td>
            </tr>
          </tbody>
        </n-table>
        <n-text depth="3">
          说明：抖动可以避免多个客户端同时重试，减轻服务器压力
        </n-text>
      </n-flex>
    </n-card>

    <!-- 错误信息 -->
    <n-alert v-if="errorMessage" type="error" title="请求失败">
      {{ errorMessage }}
    </n-alert>
  </n-flex>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  NFlex,
  NTag,
  NButton,
  NCard,
  NText,
  NInputNumber,
  NAlert,
  NDivider,
  NSlider,
  NEmpty,
  NTable,
} from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// API类 - 演示抖动策略
class PostApi {
  requestCore: any
  onRetry?: (attempt: number, theoreticalDelay: number, actualDelay: number) => void

  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getPost(postId: number, retries: number, jitter: number) {
    const baseDelay = 1000
    const backoffFactor = 2
    const retryDelays: number[] = []

    return this.requestCore.requestWithRetry(
      {
        url: `https://jsonplaceholder.typicode.com/posts/${postId}`,
        method: 'GET',
      },
      {
        retries: retries,
        delay: baseDelay,
        backoffFactor: backoffFactor,
        jitter: jitter,
        shouldRetry: (error: any, attempt: number) => {
          // 记录延迟
          const startTime = Date.now()
          const theoreticalDelay = baseDelay * Math.pow(backoffFactor, attempt)

          // 等待后计算实际延迟
          setTimeout(() => {
            const actualDelay = Date.now() - startTime
            retryDelays.push(actualDelay)
            if (this.onRetry) {
              this.onRetry(attempt, theoreticalDelay, actualDelay)
            }
          }, 0)

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
const retries = ref(5)
const jitter = ref(0.3)
const errorMessage = ref('')
const delayRecords = ref<
  Array<{ theoretical: number; actual: number; variance: string }>
>([])
const comparisonData = ref<any[]>([])

// 抖动标记
const jitterMarks = {
  0: '0%',
  0.2: '20%',
  0.5: '50%',
  0.8: '80%',
  1: '100%',
}

// 计算带抖动的延迟范围
const calculateJitteredDelay = (baseDelay: number, jitterFactor: number) => {
  if (jitterFactor === 0) return baseDelay
  const minDelay = Math.round(baseDelay * (1 - jitterFactor))
  const maxDelay = Math.round(baseDelay * (1 + jitterFactor))
  return `${minDelay}~${maxDelay}ms`
}

// 对比不同策略
const compareStrategies = () => {
  comparisonData.value = []
  const baseDelay = 1000
  const backoffFactor = 2

  for (let i = 0; i < 5; i++) {
    const theoreticalDelay = baseDelay * Math.pow(backoffFactor, i)
    comparisonData.value.push({
      noJitter: theoreticalDelay,
      jitter20: calculateJitteredDelay(theoreticalDelay, 0.2),
      jitter50: calculateJitteredDelay(theoreticalDelay, 0.5),
      jitter100: calculateJitteredDelay(theoreticalDelay, 1),
    })
  }
}

// 发送带抖动的请求
const fetchWithJitter = async () => {
  try {
    loading.value = true
    errorMessage.value = ''
    delayRecords.value = []

    // 设置重试回调
    apiClient.post.onRetry = (
      attempt: number,
      theoreticalDelay: number,
      actualDelay: number
    ) => {
      const variance =
        ((actualDelay - theoreticalDelay) / theoreticalDelay) * 100
      delayRecords.value.push({
        theoretical: Math.round(theoreticalDelay),
        actual: Math.round(actualDelay),
        variance: `${variance >= 0 ? '+' : ''}${variance.toFixed(1)}%`,
      })
    }

    await apiClient.post.getPost(999, retries.value, jitter.value)
  } catch (error: any) {
    errorMessage.value = error.message || 'Request failed after all retries'
    console.error('Request failed:', error)
  } finally {
    loading.value = false
  }
}
</script>

