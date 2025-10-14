<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-button type="primary" @click="sendMessages" :loading="sending">
        发送消息队列
      </n-button>
      <n-button type="warning" @click="sendFastMessages" :loading="sending">
        快速发送（测试队列满）
      </n-button>
      <n-button type="error" @click="sendSlowMessages" :loading="sending">
        慢速发送（测试超时）
      </n-button>
      <n-button @click="clearAll">清除所有</n-button>
    </n-flex>

    <!-- 场景说明 -->
    <n-card size="small" title="场景说明">
      <n-flex vertical>
        <n-text>
          模拟消息发送系统，通过队列限制和超时机制防止系统过载。
        </n-text>
        <n-text depth="3">
          <n-text strong>快速发送：</n-text>触发队列满限制（maxQueueSize）
        </n-text>
        <n-text depth="3">
          <n-text strong>慢速发送：</n-text>触发任务超时限制（timeout）
        </n-text>
      </n-flex>
    </n-card>

    <!-- 队列配置 -->
    <n-card size="small" title="队列配置">
      <n-flex vertical>
        <n-flex align="center">
          <n-text strong style="min-width: 120px">队列大小限制:</n-text>
          <n-input-number
            v-model:value="maxQueueSize"
            :min="5"
            :max="100"
            style="width: 120px"
            :disabled="sending"
          />
          <n-text depth="3">（建议：消息系统 50-100）</n-text>
        </n-flex>
        <n-flex align="center">
          <n-text strong style="min-width: 120px">任务超时时间:</n-text>
          <n-input-number
            v-model:value="taskTimeout"
            :min="1000"
            :max="30000"
            :step="1000"
            style="width: 120px"
            :disabled="sending"
          />
          <n-text depth="3">ms（建议：10s-30s）</n-text>
        </n-flex>
        <n-flex align="center">
          <n-text strong style="min-width: 120px">消息数量:</n-text>
          <n-input-number
            v-model:value="messageCount"
            :min="5"
            :max="50"
            style="width: 120px"
            :disabled="sending"
          />
          <n-text depth="3">（测试用）</n-text>
        </n-flex>
      </n-flex>
    </n-card>

    <!-- 队列状态 -->
    <n-card size="small" title="队列状态">
      <n-flex vertical>
        <n-flex align="center">
          <n-text strong>当前队列大小:</n-text>
          <n-tag :type="queueSize >= maxQueueSize ? 'error' : 'info'">
            {{ queueSize }} / {{ maxQueueSize }}
          </n-tag>
          <n-progress
            v-if="queueSize > 0"
            type="line"
            :percentage="(queueSize / maxQueueSize) * 100"
            :status="queueSize >= maxQueueSize ? 'error' : 'info'"
            style="flex: 1; max-width: 300px"
          />
        </n-flex>
        <n-flex align="center">
          <n-text strong>队列满次数:</n-text>
          <n-tag :type="queueFullCount > 0 ? 'error' : 'default'">
            {{ queueFullCount }}
          </n-tag>
        </n-flex>
        <n-flex align="center">
          <n-text strong>任务超时次数:</n-text>
          <n-tag :type="taskTimeoutCount > 0 ? 'warning' : 'default'">
            {{ taskTimeoutCount }}
          </n-tag>
        </n-flex>
        <n-flex align="center">
          <n-text strong>成功/失败:</n-text>
          <n-tag type="success">{{ successCount }}</n-tag>
          <n-text>/</n-text>
          <n-tag type="error">{{ failedCount }}</n-tag>
        </n-flex>
      </n-flex>
    </n-card>

    <!-- 消息列表 -->
    <n-card size="small" title="消息队列">
      <n-scrollbar style="max-height: 250px">
        <n-flex vertical>
          <n-card
            v-for="message in messages"
            :key="message.id"
            size="small"
            :bordered="false"
          >
            <n-flex align="center" justify="space-between">
              <n-flex align="center">
                <n-tag size="small" type="info">{{ message.id }}</n-tag>
                <n-text>{{ message.content }}</n-text>
              </n-flex>
              <n-flex align="center">
                <n-tag :type="getStatusTagType(message.status)">
                  {{ getStatusText(message.status) }}
                </n-tag>
                <n-text v-if="message.duration" depth="3" style="font-size: 12px">
                  {{ message.duration }}ms
                </n-text>
              </n-flex>
            </n-flex>
            <n-text v-if="message.error" type="error" style="font-size: 12px; margin-top: 4px">
              {{ message.error }}
            </n-text>
          </n-card>
          <n-empty v-if="messages.length === 0" description="暂无消息" />
        </n-flex>
      </n-scrollbar>
    </n-card>

    <!-- 事件日志 -->
    <n-card size="small" title="事件日志">
      <n-scrollbar style="max-height: 200px">
        <n-flex vertical>
          <n-text
            v-for="(log, index) in logs"
            :key="index"
            :type="log.type"
            style="font-size: 12px"
          >
            [{{ log.time }}] {{ log.message }}
          </n-text>
          <n-empty v-if="logs.length === 0" description="暂无日志" />
        </n-flex>
      </n-scrollbar>
    </n-card>

    <!-- 配置建议 -->
    <n-card size="small" title="不同场景的配置建议">
      <n-table :bordered="false" :single-line="false" size="small">
        <thead>
          <tr>
            <th>场景</th>
            <th>队列大小</th>
            <th>超时时间</th>
            <th>说明</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>
              <n-button
                text
                type="primary"
                size="small"
                @click="applyPreset('message')"
              >
                消息发送
              </n-button>
            </td>
            <td>50-100</td>
            <td>10s</td>
            <td>防止用户快速发送大量消息</td>
          </tr>
          <tr>
            <td>
              <n-button text type="primary" size="small" @click="applyPreset('file')">
                文件上传
              </n-button>
            </td>
            <td>5-10</td>
            <td>5min</td>
            <td>限制同时上传文件数量</td>
          </tr>
          <tr>
            <td>
              <n-button text type="primary" size="small" @click="applyPreset('sync')">
                数据同步
              </n-button>
            </td>
            <td>100-200</td>
            <td>30s</td>
            <td>允许较大的同步队列</td>
          </tr>
          <tr>
            <td>
              <n-button text type="primary" size="small" @click="applyPreset('api')">
                API 调用
              </n-button>
            </td>
            <td>20-50</td>
            <td>15s</td>
            <td>一般业务操作</td>
          </tr>
        </tbody>
      </n-table>
    </n-card>
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
  NProgress,
  NEmpty,
  NScrollbar,
  NTable,
} from 'naive-ui'
import { createApiClient, RequestCore } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 消息状态类型
type MessageStatus = 'pending' | 'sending' | 'success' | 'failed' | 'timeout' | 'queue-full'

// 消息类型
interface Message {
  id: number
  content: string
  status: MessageStatus
  duration?: number
  error?: string
}

// 日志类型
interface LogItem {
  time: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info' | 'default'
}

// 消息API类
class MessageApi {
  requestCore: RequestCore
  onQueueFull?: (key: string) => void
  onTaskTimeout?: (task: any) => void

  constructor(requestCore: RequestCore) {
    this.requestCore = requestCore
  }

  // 发送消息（串行执行，带队列限制和超时）
  async sendMessage(
    conversationId: string,
    message: Message,
    maxQueueSize: number,
    timeout: number,
    simulateDelay: number = 0
  ) {
    return this.requestCore.postSerial(
      `https://jsonplaceholder.typicode.com/posts`,
      `conversation-${conversationId}`,
      {
        messageId: message.id,
        content: message.content,
        timestamp: Date.now(),
        simulateDelay, // 用于模拟慢速请求
      },
      undefined,
      {
        maxQueueSize,
        timeout,
        onQueueFull: (key) => {
          console.warn(`Queue ${key} is full`)
          if (this.onQueueFull) {
            this.onQueueFull(key)
          }
        },
        onTaskTimeout: (task) => {
          console.warn(`Task ${task.id} timeout`)
          if (this.onTaskTimeout) {
            this.onTaskTimeout(task)
          }
        },
      }
    )
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { message: MessageApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 状态管理
const sending = ref(false)
const maxQueueSize = ref(10)
const taskTimeout = ref(5000)
const messageCount = ref(15)
const queueSize = ref(0)
const queueFullCount = ref(0)
const taskTimeoutCount = ref(0)
const successCount = ref(0)
const failedCount = ref(0)
const messages = ref<Message[]>([])
const logs = ref<LogItem[]>([])

// 添加日志
const addLog = (message: string, type: LogItem['type'] = 'info') => {
  const time = new Date().toLocaleTimeString()
  logs.value.unshift({ time, message, type })
  // 限制日志数量
  if (logs.value.length > 50) {
    logs.value.pop()
  }
}

// 获取状态标签类型
const getStatusTagType = (status: MessageStatus) => {
  const typeMap: Record<MessageStatus, any> = {
    pending: 'default',
    sending: 'info',
    success: 'success',
    failed: 'error',
    timeout: 'warning',
    'queue-full': 'error',
  }
  return typeMap[status] || 'default'
}

// 获取状态文本
const getStatusText = (status: MessageStatus) => {
  const textMap: Record<MessageStatus, string> = {
    pending: '待发送',
    sending: '发送中',
    success: '成功',
    failed: '失败',
    timeout: '超时',
    'queue-full': '队列满',
  }
  return textMap[status] || status
}

// 更新消息状态
const updateMessageStatus = (
  id: number,
  status: MessageStatus,
  duration?: number,
  error?: string
) => {
  const message = messages.value.find((m) => m.id === id)
  if (message) {
    message.status = status
    if (duration !== undefined) {
      message.duration = duration
    }
    if (error) {
      message.error = error
    }
  }
}

// 发送消息
const sendMessages = async () => {
  try {
    sending.value = true
    resetCounters()

    // 初始化消息列表
    messages.value = Array.from({ length: messageCount.value }, (_, i) => ({
      id: i + 1,
      content: `Message ${i + 1}`,
      status: 'pending' as MessageStatus,
    }))

    addLog(`Starting to send ${messageCount.value} messages...`, 'info')
    addLog(
      `Queue config: maxSize=${maxQueueSize.value}, timeout=${taskTimeout.value}ms`,
      'info'
    )

    const startTime = Date.now()

    // 设置回调
    apiClient.message.onQueueFull = (key: string) => {
      queueFullCount.value++
      addLog(`Queue ${key} is full! Unable to add more tasks.`, 'error')
    }

    apiClient.message.onTaskTimeout = (task: any) => {
      taskTimeoutCount.value++
      addLog(`Task ${task.id} timeout after ${taskTimeout.value}ms`, 'warning')
    }

    // 并发提交所有消息到队列
    const promises = messages.value.map(async (message) => {
      queueSize.value++
      updateMessageStatus(message.id, 'sending')

      const messageStart = Date.now()

      try {
        await apiClient.message.sendMessage(
          'demo-conversation',
          message,
          maxQueueSize.value,
          taskTimeout.value,
          0 // 正常延迟
        )

        const duration = Date.now() - messageStart
        updateMessageStatus(message.id, 'success', duration)
        successCount.value++
        addLog(`Message ${message.id} sent successfully`, 'success')
      } catch (error: any) {
        const duration = Date.now() - messageStart

        if (error.message?.includes('Queue is full')) {
          updateMessageStatus(message.id, 'queue-full', duration, error.message)
          addLog(`Message ${message.id} rejected: queue full`, 'error')
        } else if (error.message?.includes('timeout')) {
          updateMessageStatus(message.id, 'timeout', duration, error.message)
          addLog(`Message ${message.id} timeout`, 'warning')
        } else {
          updateMessageStatus(message.id, 'failed', duration, error.message)
          addLog(`Message ${message.id} failed: ${error.message}`, 'error')
        }

        failedCount.value++
      } finally {
        queueSize.value--
      }
    })

    await Promise.allSettled(promises)

    const totalDuration = Date.now() - startTime
    addLog(
      `Completed: ${successCount.value} success, ${failedCount.value} failed, took ${totalDuration}ms`,
      'success'
    )

    console.log('Message sending completed:', {
      total: messageCount.value,
      success: successCount.value,
      failed: failedCount.value,
      queueFull: queueFullCount.value,
      timeout: taskTimeoutCount.value,
      duration: totalDuration,
    })
  } catch (error: any) {
    console.error('Message sending error:', error)
    addLog(`Error: ${error.message}`, 'error')
  } finally {
    sending.value = false
    queueSize.value = 0
  }
}

// 快速发送消息（测试队列满）
const sendFastMessages = async () => {
  try {
    sending.value = true
    resetCounters()

    // 创建超过队列限制的消息数量
    const count = maxQueueSize.value + 10
    messages.value = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      content: `Fast message ${i + 1}`,
      status: 'pending' as MessageStatus,
    }))

    addLog(`Fast sending ${count} messages (exceeds queue limit)...`, 'warning')
    addLog(`Queue limit: ${maxQueueSize.value}`, 'info')

    const startTime = Date.now()

    // 设置回调
    apiClient.message.onQueueFull = (key: string) => {
      queueFullCount.value++
      addLog(`❌ Queue ${key} is full! Rejecting new tasks.`, 'error')
    }

    // 快速并发提交（几乎同时提交所有请求）
    const promises = messages.value.map(async (message, index) => {
      // 添加微小延迟以观察队列增长
      await new Promise((resolve) => setTimeout(resolve, index * 10))

      queueSize.value++
      updateMessageStatus(message.id, 'sending')

      const messageStart = Date.now()

      try {
        await apiClient.message.sendMessage(
          'demo-fast',
          message,
          maxQueueSize.value,
          taskTimeout.value,
          100 // 每个消息添加小延迟以填满队列
        )

        const duration = Date.now() - messageStart
        updateMessageStatus(message.id, 'success', duration)
        successCount.value++
      } catch (error: any) {
        const duration = Date.now() - messageStart

        if (error.message?.includes('Queue is full')) {
          updateMessageStatus(message.id, 'queue-full', duration, 'Queue is full')
          addLog(`Message ${message.id} rejected: queue full`, 'error')
        } else {
          updateMessageStatus(message.id, 'failed', duration, error.message)
        }

        failedCount.value++
      } finally {
        queueSize.value = Math.max(0, queueSize.value - 1)
      }
    })

    await Promise.allSettled(promises)

    const totalDuration = Date.now() - startTime
    addLog(
      `Fast sending completed: ${successCount.value}/${count} sent, ${queueFullCount.value} rejected`,
      queueFullCount.value > 0 ? 'warning' : 'success'
    )

    console.log('Fast sending completed:', {
      total: count,
      success: successCount.value,
      rejected: queueFullCount.value,
      duration: totalDuration,
    })
  } catch (error: any) {
    console.error('Fast sending error:', error)
    addLog(`Error: ${error.message}`, 'error')
  } finally {
    sending.value = false
    queueSize.value = 0
  }
}

// 慢速发送消息（测试超时）
const sendSlowMessages = async () => {
  try {
    sending.value = true
    resetCounters()

    const count = 10
    messages.value = Array.from({ length: count }, (_, i) => ({
      id: i + 1,
      content: `Slow message ${i + 1}`,
      status: 'pending' as MessageStatus,
    }))

    addLog(`Slow sending ${count} messages (simulating timeout)...`, 'warning')
    addLog(`Timeout limit: ${taskTimeout.value}ms`, 'info')

    const startTime = Date.now()

    // 设置回调
    apiClient.message.onTaskTimeout = (task: any) => {
      taskTimeoutCount.value++
      addLog(`⏱️ Task timeout after ${taskTimeout.value}ms`, 'warning')
    }

    // 并发提交，但模拟慢速请求
    const promises = messages.value.map(async (message) => {
      queueSize.value++
      updateMessageStatus(message.id, 'sending')

      const messageStart = Date.now()
      const willTimeout = Math.random() < 0.5 // 50% 概率超时

      try {
        await apiClient.message.sendMessage(
          'demo-slow',
          message,
          maxQueueSize.value,
          taskTimeout.value,
          willTimeout ? taskTimeout.value + 1000 : 500 // 部分请求超时
        )

        const duration = Date.now() - messageStart
        updateMessageStatus(message.id, 'success', duration)
        successCount.value++
        addLog(`Message ${message.id} sent successfully`, 'success')
      } catch (error: any) {
        const duration = Date.now() - messageStart

        if (error.message?.includes('timeout') || duration >= taskTimeout.value) {
          updateMessageStatus(message.id, 'timeout', duration, 'Task timeout')
          addLog(`Message ${message.id} timeout after ${duration}ms`, 'warning')
        } else {
          updateMessageStatus(message.id, 'failed', duration, error.message)
        }

        failedCount.value++
      } finally {
        queueSize.value--
      }
    })

    await Promise.allSettled(promises)

    const totalDuration = Date.now() - startTime
    addLog(
      `Slow sending completed: ${successCount.value} success, ${taskTimeoutCount.value} timeout`,
      taskTimeoutCount.value > 0 ? 'warning' : 'success'
    )

    console.log('Slow sending completed:', {
      total: count,
      success: successCount.value,
      timeout: taskTimeoutCount.value,
      duration: totalDuration,
    })
  } catch (error: any) {
    console.error('Slow sending error:', error)
    addLog(`Error: ${error.message}`, 'error')
  } finally {
    sending.value = false
    queueSize.value = 0
  }
}

// 重置计数器
const resetCounters = () => {
  queueFullCount.value = 0
  taskTimeoutCount.value = 0
  successCount.value = 0
  failedCount.value = 0
  logs.value = []
}

// 清除所有
const clearAll = () => {
  messages.value = []
  logs.value = []
  resetCounters()
  queueSize.value = 0
}

// 应用预设配置
const applyPreset = (preset: string) => {
  const presets: Record<string, { maxQueueSize: number; timeout: number }> = {
    message: { maxQueueSize: 50, timeout: 10000 },
    file: { maxQueueSize: 5, timeout: 300000 },
    sync: { maxQueueSize: 100, timeout: 30000 },
    api: { maxQueueSize: 20, timeout: 15000 },
  }

  const config = presets[preset]
  if (config) {
    maxQueueSize.value = config.maxQueueSize
    taskTimeout.value = config.timeout
    addLog(`Applied ${preset} preset configuration`, 'info')
  }
}
</script>

