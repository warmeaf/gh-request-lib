<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-button type="primary" @click="processOrders" :loading="loading">
        处理订单队列
      </n-button>
      <n-button type="warning" @click="processWithErrors" :loading="loading">
        模拟错误场景
      </n-button>
      <n-button @click="clearAll">清除所有</n-button>
    </n-flex>

    <!-- 场景说明 -->
    <n-card size="small" title="场景说明">
      <n-flex vertical>
        <n-text>
          模拟电商订单处理场景：订单状态变更必须按顺序执行，避免状态不一致。
        </n-text>
        <n-text depth="3">
          订单流程：待支付 → 已支付 → 配货中 → 已发货 → 已完成
        </n-text>
      </n-flex>
    </n-card>

    <!-- 订单列表 -->
    <n-card size="small" title="订单列表">
      <n-flex vertical>
        <n-card
          v-for="order in orders"
          :key="order.id"
          size="small"
          :bordered="false"
        >
          <n-flex align="center" justify="space-between">
            <n-flex align="center">
              <n-tag type="info">订单 {{ order.id }}</n-tag>
              <n-text>{{ order.product }}</n-text>
            </n-flex>
            <n-flex align="center">
              <n-tag :type="getStatusType(order.status)">
                {{ order.status }}
              </n-tag>
            </n-flex>
          </n-flex>
          <n-flex vertical style="margin-top: 8px">
            <n-steps :current="order.currentStep" size="small">
              <n-step
                v-for="(step, index) in orderSteps"
                :key="index"
                :title="step"
              />
            </n-steps>
          </n-flex>
        </n-card>
        <n-empty v-if="orders.length === 0" description="暂无订单" />
      </n-flex>
    </n-card>

    <!-- 处理日志 -->
    <n-card size="small" title="处理日志">
      <n-scrollbar style="max-height: 250px">
        <n-flex vertical>
          <n-text v-for="(log, index) in logs" :key="index" :type="log.type">
            [{{ log.time }}] {{ log.message }}
          </n-text>
          <n-empty v-if="logs.length === 0" description="暂无日志" />
        </n-flex>
      </n-scrollbar>
    </n-card>

    <!-- 统计信息 -->
    <n-card v-if="statistics" size="small" title="处理统计">
      <n-flex vertical>
        <n-text>
          <n-text strong>总订单数: </n-text>
          <n-tag type="info">{{ statistics.total }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>成功处理: </n-text>
          <n-tag type="success">{{ statistics.success }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>处理失败: </n-text>
          <n-tag :type="statistics.failed > 0 ? 'error' : 'default'">
            {{ statistics.failed }}
          </n-tag>
        </n-text>
        <n-text>
          <n-text strong>总耗时: </n-text>
          <n-tag type="warning">{{ statistics.duration }}ms</n-tag>
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
  NEmpty,
  NScrollbar,
  NSteps,
  NStep,
} from 'naive-ui'
import { createApiClient, RequestCore } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 订单类型
interface Order {
  id: number
  product: string
  status: string
  currentStep: number
  processing: boolean
}

// 日志类型
interface LogItem {
  time: string
  message: string
  type: 'success' | 'error' | 'warning' | 'info' | 'default'
}

// 统计信息类型
interface Statistics {
  total: number
  success: number
  failed: number
  duration: number
}

// 订单状态步骤
const orderSteps = ['待支付', '已支付', '配货中', '已发货', '已完成']

// 订单API类
class OrderApi {
  requestCore: RequestCore
  onStateChange?: (orderId: number, newState: string) => void

  constructor(requestCore: RequestCore) {
    this.requestCore = requestCore
  }

  // 更新订单状态（串行执行）
  async updateOrderState(
    orderId: number,
    newState: string,
    simulateError: boolean = false
  ) {
    if (this.onStateChange) {
      this.onStateChange(orderId, newState)
    }

    // 模拟错误
    if (simulateError && Math.random() < 0.3) {
      throw new Error(`Failed to update order ${orderId} to state: ${newState}`)
    }

    return this.requestCore.postSerial(
      `https://jsonplaceholder.typicode.com/posts`,
      `order-${orderId}`, // 每个订单独立的串行队列
      {
        orderId,
        state: newState,
        timestamp: Date.now(),
      }
    )
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { order: OrderApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 状态管理
const loading = ref(false)
const orders = ref<Order[]>([])
const logs = ref<LogItem[]>([])
const statistics = ref<Statistics | null>(null)

// 添加日志
const addLog = (message: string, type: LogItem['type'] = 'info') => {
  const time = new Date().toLocaleTimeString()
  logs.value.push({ time, message, type })
}

// 获取状态标签类型
const getStatusType = (status: string) => {
  const statusMap: Record<string, any> = {
    待支付: 'default',
    已支付: 'info',
    配货中: 'warning',
    已发货: 'primary',
    已完成: 'success',
    处理失败: 'error',
  }
  return statusMap[status] || 'default'
}

// 初始化订单
const initOrders = (count: number = 3) => {
  orders.value = Array.from({ length: count }, (_, i) => ({
    id: i + 1,
    product: `商品 ${i + 1}`,
    status: '待支付',
    currentStep: 0,
    processing: false,
  }))
}

// 更新订单状态
const updateOrderStatus = (
  orderId: number,
  status: string,
  currentStep: number
) => {
  const order = orders.value.find((o) => o.id === orderId)
  if (order) {
    order.status = status
    order.currentStep = currentStep
  }
}

// 处理订单
const processOrders = async () => {
  try {
    loading.value = true
    logs.value = []
    statistics.value = null

    initOrders(3)

    addLog('Starting order processing...', 'info')

    const startTime = Date.now()
    let successCount = 0
    let failedCount = 0

    // 设置状态变更回调
    apiClient.order.onStateChange = (orderId: number, newState: string) => {
      const stepIndex = orderSteps.indexOf(newState)
      updateOrderStatus(orderId, newState, stepIndex)
      addLog(`Order ${orderId}: Transitioning to ${newState}`, 'info')
    }

    // 为每个订单创建状态变更序列
    const allPromises: Promise<any>[] = []

    for (const order of orders.value) {
      order.processing = true

      // 串行执行每个订单的状态变更
      const stateTransitions = orderSteps.slice(1) // 跳过初始状态

      for (const state of stateTransitions) {
        const promise = apiClient.order
          .updateOrderState(order.id, state, false)
          .then(() => {
            addLog(`Order ${order.id}: ${state} completed`, 'success')
          })
          .catch((error: Error) => {
            addLog(
              `Order ${order.id}: ${state} failed - ${error.message}`,
              'error'
            )
            updateOrderStatus(order.id, '处理失败', -1)
            throw error
          })

        allPromises.push(promise)

        // 添加一点延迟以便观察过程
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    // 等待所有状态变更完成
    const results = await Promise.allSettled(allPromises)

    successCount = results.filter((r) => r.status === 'fulfilled').length
    failedCount = results.filter((r) => r.status === 'rejected').length

    const duration = Date.now() - startTime

    statistics.value = {
      total: orders.value.length,
      success: orders.value.filter((o) => o.status === '已完成').length,
      failed: orders.value.filter((o) => o.status === '处理失败').length,
      duration,
    }

    addLog(
      `Processing completed: ${successCount} succeeded, ${failedCount} failed`,
      'success'
    )

    console.log('Order processing completed:', statistics.value)
  } catch (error: any) {
    console.error('Order processing error:', error)
    addLog(`Error: ${error.message}`, 'error')
  } finally {
    loading.value = false
    orders.value.forEach((order) => {
      order.processing = false
    })
  }
}

// 处理订单（模拟错误）
const processWithErrors = async () => {
  try {
    loading.value = true
    logs.value = []
    statistics.value = null

    initOrders(3)

    addLog('Starting order processing with error simulation...', 'warning')

    const startTime = Date.now()

    // 设置状态变更回调
    apiClient.order.onStateChange = (orderId: number, newState: string) => {
      const stepIndex = orderSteps.indexOf(newState)
      updateOrderStatus(orderId, newState, stepIndex)
      addLog(`Order ${orderId}: Transitioning to ${newState}`, 'info')
    }

    // 为每个订单创建状态变更序列
    const allPromises: Promise<any>[] = []

    for (const order of orders.value) {
      order.processing = true

      const stateTransitions = orderSteps.slice(1)

      for (const state of stateTransitions) {
        const promise = apiClient.order
          .updateOrderState(order.id, state, true) // 启用错误模拟
          .then(() => {
            addLog(`Order ${order.id}: ${state} completed`, 'success')
          })
          .catch((error: Error) => {
            addLog(
              `Order ${order.id}: ${state} failed - ${error.message}`,
              'error'
            )
            updateOrderStatus(order.id, '处理失败', orderSteps.indexOf(state))
          })

        allPromises.push(promise)

        // 添加一点延迟
        await new Promise((resolve) => setTimeout(resolve, 100))
      }
    }

    // 等待所有状态变更完成
    await Promise.allSettled(allPromises)

    const duration = Date.now() - startTime

    statistics.value = {
      total: orders.value.length,
      success: orders.value.filter((o) => o.status === '已完成').length,
      failed: orders.value.filter((o) => o.status === '处理失败').length,
      duration,
    }

    addLog(
      `Processing with errors completed: ${statistics.value.success} succeeded, ${statistics.value.failed} failed`,
      statistics.value.failed > 0 ? 'warning' : 'success'
    )

    console.log('Order processing with errors completed:', statistics.value)
  } catch (error: any) {
    console.error('Order processing error:', error)
    addLog(`Error: ${error.message}`, 'error')
  } finally {
    loading.value = false
    orders.value.forEach((order) => {
      order.processing = false
    })
  }
}

// 清除所有
const clearAll = () => {
  orders.value = []
  logs.value = []
  statistics.value = null
}
</script>
