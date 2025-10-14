<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-button type="primary" @click="fetchConcurrent" :loading="loading">
        批量获取用户（并发）
      </n-button>
      <n-button type="default" @click="fetchSerial" :loading="loading">
        批量获取用户（串行）
      </n-button>
      <n-button @click="clearResults">清除结果</n-button>
    </n-flex>

    <!-- 配置 -->
    <n-card size="small" title="批量请求配置">
      <n-flex vertical>
        <n-text>
          <n-text strong>用户数量: </n-text>
          <n-input-number
            v-model:value="userCount"
            :min="1"
            :max="20"
            style="width: 120px"
          />
        </n-text>
        <n-text depth="3">
          提示：对比并发和串行请求的执行时间差异
        </n-text>
      </n-flex>
    </n-card>

    <!-- 执行状态 -->
    <n-card size="small" title="执行状态">
      <n-flex vertical>
        <n-text>
          <n-text strong>执行模式: </n-text>
          <n-tag :type="executionMode === 'concurrent' ? 'success' : 'warning'">
            {{ executionMode === 'concurrent' ? '并发执行' : '串行执行' }}
          </n-tag>
        </n-text>
        <n-text>
          <n-text strong>总耗时: </n-text>
          <n-tag type="info">{{ duration }}ms</n-tag>
        </n-text>
        <n-text>
          <n-text strong>成功数量: </n-text>
          <n-tag type="success">{{ successCount }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>失败数量: </n-text>
          <n-tag :type="failureCount > 0 ? 'error' : 'default'">
            {{ failureCount }}
          </n-tag>
        </n-text>
        <n-progress
          v-if="loading"
          type="line"
          :percentage="progress"
          status="info"
        />
      </n-flex>
    </n-card>

    <!-- 性能对比 -->
    <n-card v-if="performanceComparison" size="small" title="性能对比">
      <n-flex vertical>
        <n-text>
          <n-text strong>并发请求耗时: </n-text>
          <n-tag type="success">{{ performanceComparison.concurrent }}ms</n-tag>
        </n-text>
        <n-text>
          <n-text strong>串行请求耗时: </n-text>
          <n-tag type="warning">{{ performanceComparison.serial }}ms</n-tag>
        </n-text>
        <n-text>
          <n-text strong>性能提升: </n-text>
          <n-tag type="info">
            {{ ((1 - performanceComparison.concurrent / performanceComparison.serial) * 100).toFixed(1) }}%
          </n-tag>
        </n-text>
        <n-text depth="3">
          并发请求比串行请求快 {{ (performanceComparison.serial / performanceComparison.concurrent).toFixed(1) }} 倍
        </n-text>
      </n-flex>
    </n-card>

    <!-- 结果列表 -->
    <n-card size="small" title="请求结果">
      <n-scrollbar style="max-height: 300px">
        <n-flex vertical>
          <n-card
            v-for="(result, index) in results"
            :key="index"
            size="small"
            :bordered="false"
          >
            <n-flex align="center" justify="space-between">
              <n-flex align="center">
                <n-tag :type="result.success ? 'success' : 'error'">
                  {{ result.success ? '成功' : '失败' }}
                </n-tag>
                <n-text>用户 {{ result.index + 1 }}</n-text>
                <n-text v-if="result.duration" depth="3">
                  ({{ result.duration }}ms)
                </n-text>
              </n-flex>
              <n-text v-if="result.data">
                {{ result.data.name }}
              </n-text>
            </n-flex>
          </n-card>
          <n-empty v-if="results.length === 0" description="暂无结果" />
        </n-flex>
      </n-scrollbar>
    </n-card>
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
  NProgress,
  NEmpty,
  NScrollbar,
} from 'naive-ui'
import { createApiClient, RequestCore } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 定义请求结果类型
interface RequestResult {
  success: boolean
  data?: any
  error?: any
  index: number
  duration?: number
}

// 用户API类 - 演示并发请求
class UserApi {
  requestCore: RequestCore
  constructor(requestCore: RequestCore) {
    this.requestCore = requestCore
  }

  // 并发获取多个用户
  async getUsersConcurrent(userIds: number[]) {
    const configs = userIds.map(id => ({
      url: `https://jsonplaceholder.typicode.com/users/${id}`,
      method: 'GET' as const,
    }))

    return await this.requestCore.requestConcurrent(configs)
  }

  // 串行获取多个用户
  async getUsersSerial(userIds: number[]) {
    const results: RequestResult[] = []
    for (let i = 0; i < userIds.length; i++) {
      const id = userIds[i]
      try {
        const startTime = Date.now()
        const data = await this.requestCore.get(
          `https://jsonplaceholder.typicode.com/users/${id}`
        )
        results.push({
          success: true,
          data,
          index: i,
          duration: Date.now() - startTime,
        })
      } catch (error) {
        results.push({
          success: false,
          error,
          index: i,
        })
      }
    }
    return results
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 状态管理
const loading = ref(false)
const userCount = ref(5)
const executionMode = ref<'concurrent' | 'serial'>('concurrent')
const duration = ref(0)
const successCount = ref(0)
const failureCount = ref(0)
const progress = ref(0)
const results = ref<RequestResult[]>([])
const performanceComparison = ref<{ concurrent: number; serial: number } | null>(
  null
)

// 并发获取用户
const fetchConcurrent = async () => {
  try {
    loading.value = true
    executionMode.value = 'concurrent'
    results.value = []
    progress.value = 0

    const userIds = Array.from({ length: userCount.value }, (_, i) => i + 1)
    const startTime = Date.now()

    const concurrentResults = await apiClient.user.getUsersConcurrent(userIds)

    duration.value = Date.now() - startTime
    results.value = concurrentResults

    // 统计成功和失败
    successCount.value = concurrentResults.filter(r => r.success).length
    failureCount.value = concurrentResults.filter(r => !r.success).length

    // 记录并发性能
    if (!performanceComparison.value) {
      performanceComparison.value = { concurrent: duration.value, serial: 0 }
    } else {
      performanceComparison.value.concurrent = duration.value
    }

    console.log('Concurrent fetch completed:', {
      duration: duration.value,
      success: successCount.value,
      failed: failureCount.value,
    })
  } catch (error) {
    console.error('Concurrent fetch failed:', error)
  } finally {
    loading.value = false
  }
}

// 串行获取用户
const fetchSerial = async () => {
  try {
    loading.value = true
    executionMode.value = 'serial'
    results.value = []
    progress.value = 0

    const userIds = Array.from({ length: userCount.value }, (_, i) => i + 1)
    const startTime = Date.now()

    const serialResults = await apiClient.user.getUsersSerial(userIds)

    duration.value = Date.now() - startTime
    results.value = serialResults

    // 统计成功和失败
    successCount.value = serialResults.filter(r => r.success).length
    failureCount.value = serialResults.filter(r => !r.success).length

    // 记录串行性能
    if (!performanceComparison.value) {
      performanceComparison.value = { concurrent: 0, serial: duration.value }
    } else {
      performanceComparison.value.serial = duration.value
    }

    console.log('Serial fetch completed:', {
      duration: duration.value,
      success: successCount.value,
      failed: failureCount.value,
    })
  } catch (error) {
    console.error('Serial fetch failed:', error)
  } finally {
    loading.value = false
  }
}

// 清除结果
const clearResults = () => {
  results.value = []
  duration.value = 0
  successCount.value = 0
  failureCount.value = 0
  progress.value = 0
  performanceComparison.value = null
}
</script>

