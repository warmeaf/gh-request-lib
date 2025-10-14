<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-button type="primary" @click="updateUsers" :loading="loading">
        更新多个用户（独立队列）
      </n-button>
      <n-button @click="clearLogs">清除日志</n-button>
    </n-flex>

    <!-- 配置 -->
    <n-card size="small" title="场景说明">
      <n-flex vertical>
        <n-text>
          此示例演示多个独立的串行队列。每个用户有自己的更新队列，
          不同用户的更新可以并行执行，但同一用户的多次更新会按顺序执行。
        </n-text>
        <n-text depth="3"> 场景：3个用户，每个用户进行3次更新操作 </n-text>
      </n-flex>
    </n-card>

    <!-- 队列状态 -->
    <n-card size="small" title="队列状态">
      <n-flex vertical>
        <n-text>
          <n-text strong>总队列数: </n-text>
          <n-tag type="info">{{ queueCount }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>总完成数: </n-text>
          <n-tag type="success">{{ completedCount }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>总耗时: </n-text>
          <n-tag type="warning">{{ totalDuration }}ms</n-tag>
        </n-text>
        <n-divider style="margin: 8px 0" />
        <n-flex
          v-for="queue in queues"
          :key="queue.userId"
          vertical
          style="margin-bottom: 8px"
        >
          <n-flex align="center">
            <n-tag type="primary" size="small">用户 {{ queue.userId }}</n-tag>
            <n-progress
              type="line"
              :percentage="(queue.completed / queue.total) * 100"
              :status="queue.completed === queue.total ? 'success' : 'default'"
              style="flex: 1"
            />
            <n-text depth="3">{{ queue.completed }}/{{ queue.total }}</n-text>
          </n-flex>
        </n-flex>
      </n-flex>
    </n-card>

    <!-- 执行日志 -->
    <n-card size="small" title="执行日志">
      <n-scrollbar style="max-height: 300px">
        <n-flex vertical>
          <n-flex
            v-for="(log, index) in logs"
            :key="index"
            align="center"
            style="padding: 4px 0"
          >
            <n-tag :type="log.type" size="small">{{ log.user }}</n-tag>
            <n-text
              :type="log.status === 'success' ? 'success' : 'default'"
              style="flex: 1"
            >
              {{ log.message }}
            </n-text>
            <n-text depth="3" style="font-size: 12px">{{ log.time }}</n-text>
          </n-flex>
          <n-empty v-if="logs.length === 0" description="暂无日志" />
        </n-flex>
      </n-scrollbar>
    </n-card>

    <!-- 统计信息 -->
    <n-card v-if="statsData" size="small" title="统计信息">
      <n-code
        :code="JSON.stringify(statsData, null, 2)"
        :hljs="hljs"
        language="json"
      />
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
  NProgress,
  NEmpty,
  NScrollbar,
  NDivider,
  NCode,
} from 'naive-ui'
import { createApiClient, RequestCore } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', json)

// 日志项类型
interface LogItem {
  user: string
  message: string
  time: string
  status: 'success' | 'error'
  type: 'primary' | 'success' | 'error'
}

// 队列状态类型
interface QueueStatus {
  userId: number
  total: number
  completed: number
}

// 用户API类 - 演示多队列
class UserApi {
  requestCore: RequestCore
  onUpdate?: (userId: number, version: number) => void

  constructor(requestCore: RequestCore) {
    this.requestCore = requestCore
  }

  // 更新用户资料（每个用户独立队列）
  async updateUserProfile(userId: number, version: number, data: any) {
    if (this.onUpdate) {
      this.onUpdate(userId, version)
    }

    return this.requestCore.putSerial(
      `https://jsonplaceholder.typicode.com/users/${userId}`,
      `user-${userId}`, // 每个用户有独立的串行队列
      {
        ...data,
        version,
      }
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
const queueCount = ref(0)
const completedCount = ref(0)
const totalDuration = ref(0)
const queues = ref<QueueStatus[]>([])
const logs = ref<LogItem[]>([])
const statsData = ref<any>(null)

// 添加日志
const addLog = (
  userId: number,
  message: string,
  status: 'success' | 'error' = 'success'
) => {
  const time = new Date().toLocaleTimeString()
  logs.value.push({
    user: `用户${userId}`,
    message,
    time,
    status,
    type: status === 'success' ? 'primary' : 'error',
  })
}

// 更新队列状态
const updateQueueStatus = (userId: number) => {
  const queue = queues.value.find((q) => q.userId === userId)
  if (queue) {
    queue.completed++
  }
  completedCount.value++
}

// 更新多个用户
const updateUsers = async () => {
  try {
    loading.value = true
    logs.value = []
    completedCount.value = 0
    statsData.value = null

    // 初始化队列状态
    const userIds = [1, 2, 3]
    const updatesPerUser = 3
    queueCount.value = userIds.length

    queues.value = userIds.map((userId) => ({
      userId,
      total: updatesPerUser,
      completed: 0,
    }))

    addLog(0, 'Starting multi-queue updates...', 'success')

    const startTime = Date.now()

    // 设置更新回调
    apiClient.user.onUpdate = (userId: number, version: number) => {
      addLog(userId, `Updating version ${version}...`, 'success')
    }

    // 为每个用户创建多个更新请求
    const allPromises: Promise<any>[] = []

    for (const userId of userIds) {
      // 每个用户的多次更新会进入各自的队列
      for (let version = 1; version <= updatesPerUser; version++) {
        const promise = apiClient.user
          .updateUserProfile(userId, version, {
            name: `User ${userId} - Version ${version}`,
            email: `user${userId}@example.com`,
          })
          .then((result) => {
            updateQueueStatus(userId)
            addLog(userId, `Version ${version} updated successfully`, 'success')
            return result
          })
          .catch((error) => {
            addLog(
              userId,
              `Version ${version} update failed: ${error.message}`,
              'error'
            )
            throw error
          })

        allPromises.push(promise)
      }
    }

    // 等待所有更新完成
    await Promise.allSettled(allPromises)

    totalDuration.value = Date.now() - startTime

    addLog(0, `All updates completed in ${totalDuration.value}ms`, 'success')

    // 获取统计信息
    statsData.value = apiClient.user.requestCore.getSerialStats()

    console.log('Multi-queue updates completed:', {
      duration: totalDuration.value,
      queues: queueCount.value,
      totalUpdates: completedCount.value,
      stats: statsData.value,
    })
  } catch (error: any) {
    console.error('Multi-queue updates failed:', error)
    addLog(0, `Error: ${error.message}`, 'error')
  } finally {
    loading.value = false
  }
}

// 清除日志
const clearLogs = () => {
  logs.value = []
  completedCount.value = 0
  totalDuration.value = 0
  queues.value = []
  statsData.value = null
}
</script>
