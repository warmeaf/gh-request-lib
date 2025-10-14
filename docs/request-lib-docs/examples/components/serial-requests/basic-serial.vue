<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-button type="primary" @click="executeSerial" :loading="loading">
        执行串行请求
      </n-button>
      <n-button type="default" @click="executeConcurrent" :loading="loading">
        执行并发请求（对比）
      </n-button>
      <n-button @click="clearResults">清除结果</n-button>
    </n-flex>

    <!-- 配置 -->
    <n-card size="small" title="请求配置">
      <n-flex vertical>
        <n-text>
          <n-text strong>请求数量: </n-text>
          <n-input-number
            v-model:value="requestCount"
            :min="2"
            :max="10"
            style="width: 120px"
          />
        </n-text>
        <n-text depth="3">
          提示：对比串行和并发请求的执行顺序和时间差异
        </n-text>
      </n-flex>
    </n-card>

    <!-- 执行状态 -->
    <n-card size="small" title="执行状态">
      <n-flex vertical>
        <n-text>
          <n-text strong>执行模式: </n-text>
          <n-tag :type="executionMode === 'serial' ? 'info' : 'success'">
            {{ executionMode === 'serial' ? '串行执行' : '并发执行' }}
          </n-tag>
        </n-text>
        <n-text>
          <n-text strong>总耗时: </n-text>
          <n-tag type="warning">{{ duration }}ms</n-tag>
        </n-text>
        <n-text>
          <n-text strong>已完成: </n-text>
          <n-tag type="success">{{ completedCount }} / {{ requestCount }}</n-tag>
        </n-text>
        <n-progress
          v-if="loading"
          type="line"
          :percentage="(completedCount / requestCount) * 100"
          status="info"
        />
      </n-flex>
    </n-card>

    <!-- 请求时间线 -->
    <n-card size="small" title="请求时间线">
      <n-scrollbar style="max-height: 300px">
        <n-flex vertical>
          <n-timeline>
            <n-timeline-item
              v-for="(item, index) in timeline"
              :key="index"
              :type="item.type"
              :title="item.title"
              :time="item.time"
            >
              <n-text>{{ item.content }}</n-text>
              <n-flex v-if="item.data" style="margin-top: 8px">
                <n-tag size="small" type="info">
                  用户: {{ item.data.name }}
                </n-tag>
                <n-tag size="small" type="default">
                  耗时: {{ item.duration }}ms
                </n-tag>
              </n-flex>
            </n-timeline-item>
          </n-timeline>
          <n-empty v-if="timeline.length === 0" description="暂无数据" />
        </n-flex>
      </n-scrollbar>
    </n-card>

    <!-- 性能对比 -->
    <n-card v-if="performanceData" size="small" title="性能对比">
      <n-flex vertical>
        <n-text>
          <n-text strong>串行执行耗时: </n-text>
          <n-tag type="info">{{ performanceData.serial }}ms</n-tag>
        </n-text>
        <n-text>
          <n-text strong>并发执行耗时: </n-text>
          <n-tag type="success">{{ performanceData.concurrent }}ms</n-tag>
        </n-text>
        <n-text depth="3">
          串行执行确保了请求的顺序性，但耗时约为并发的 
          {{ (performanceData.serial / performanceData.concurrent).toFixed(1) }} 倍
        </n-text>
      </n-flex>
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
  NTimeline,
  NTimelineItem,
} from 'naive-ui'
import { createApiClient, RequestCore } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 时间线项类型
interface TimelineItem {
  type: 'success' | 'error' | 'warning' | 'info' | 'default'
  title: string
  content: string
  time: string
  data?: any
  duration?: number
}

// 用户API类 - 演示串行请求
class UserApi {
  requestCore: RequestCore
  constructor(requestCore: RequestCore) {
    this.requestCore = requestCore
  }

  // 串行获取用户数据
  async getUserSerial(userId: number) {
    return this.requestCore.getSerial(
      `https://jsonplaceholder.typicode.com/users/${userId}`,
      'user-fetch' // 相同的 serialKey 确保顺序执行
    )
  }

  // 并发获取用户数据（对比）
  async getUserConcurrent(userId: number) {
    return this.requestCore.get(
      `https://jsonplaceholder.typicode.com/users/${userId}`
    )
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
const requestCount = ref(5)
const executionMode = ref<'serial' | 'concurrent'>('serial')
const duration = ref(0)
const completedCount = ref(0)
const timeline = ref<TimelineItem[]>([])
const performanceData = ref<{ serial: number; concurrent: number } | null>(null)

// 添加时间线项
const addTimelineItem = (
  title: string,
  content: string,
  type: TimelineItem['type'] = 'info',
  data?: any,
  duration?: number
) => {
  const time = new Date().toLocaleTimeString()
  timeline.value.push({ title, content, time, type, data, duration })
}

// 执行串行请求
const executeSerial = async () => {
  try {
    loading.value = true
    executionMode.value = 'serial'
    timeline.value = []
    completedCount.value = 0

    addTimelineItem('开始执行', '开始执行串行请求...', 'info')

    const startTime = Date.now()
    const userIds = Array.from({ length: requestCount.value }, (_, i) => i + 1)

    // 并发提交到串行队列（由队列控制执行顺序）
    const promises = userIds.map(async (id, index) => {
      const requestStart = Date.now()
      const data = await apiClient.user.getUserSerial(id)
      const requestDuration = Date.now() - requestStart
      
      completedCount.value++
      addTimelineItem(
        `请求 ${index + 1}`,
        `获取用户 ${id} 成功`,
        'success',
        data,
        requestDuration
      )
      
      return data
    })

    await Promise.all(promises)

    duration.value = Date.now() - startTime
    addTimelineItem('完成', `所有请求已完成，总耗时 ${duration.value}ms`, 'success')

    // 更新性能对比数据
    if (!performanceData.value) {
      performanceData.value = { serial: duration.value, concurrent: 0 }
    } else {
      performanceData.value.serial = duration.value
    }

    console.log('Serial execution completed:', {
      duration: duration.value,
      count: requestCount.value,
    })
  } catch (error: any) {
    console.error('Serial execution failed:', error)
    addTimelineItem('错误', error.message || 'Request failed', 'error')
  } finally {
    loading.value = false
  }
}

// 执行并发请求（对比）
const executeConcurrent = async () => {
  try {
    loading.value = true
    executionMode.value = 'concurrent'
    timeline.value = []
    completedCount.value = 0

    addTimelineItem('开始执行', '开始执行并发请求...', 'info')

    const startTime = Date.now()
    const userIds = Array.from({ length: requestCount.value }, (_, i) => i + 1)

    // 并发执行（无序）
    const promises = userIds.map(async (id, index) => {
      const requestStart = Date.now()
      const data = await apiClient.user.getUserConcurrent(id)
      const requestDuration = Date.now() - requestStart
      
      completedCount.value++
      addTimelineItem(
        `请求 ${index + 1}`,
        `获取用户 ${id} 成功`,
        'success',
        data,
        requestDuration
      )
      
      return data
    })

    await Promise.all(promises)

    duration.value = Date.now() - startTime
    addTimelineItem('完成', `所有请求已完成，总耗时 ${duration.value}ms`, 'success')

    // 更新性能对比数据
    if (!performanceData.value) {
      performanceData.value = { serial: 0, concurrent: duration.value }
    } else {
      performanceData.value.concurrent = duration.value
    }

    console.log('Concurrent execution completed:', {
      duration: duration.value,
      count: requestCount.value,
    })
  } catch (error: any) {
    console.error('Concurrent execution failed:', error)
    addTimelineItem('错误', error.message || 'Request failed', 'error')
  } finally {
    loading.value = false
  }
}

// 清除结果
const clearResults = () => {
  timeline.value = []
  duration.value = 0
  completedCount.value = 0
  performanceData.value = null
}
</script>

