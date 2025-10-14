<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-button
        type="error"
        @click="() => fetchBatch(true)"
        :loading="loading"
      >
        Fail-Fast 模式
      </n-button>
      <n-button
        type="primary"
        @click="() => fetchBatch(false)"
        :loading="loading"
      >
        容错模式
      </n-button>
    </n-flex>

    <!-- 模式说明 -->
    <n-card size="small" title="模式说明">
      <n-flex vertical>
        <n-text>
          <n-text strong>Fail-Fast 模式: </n-text>
          任意一个请求失败时，立即停止所有请求并抛出错误
        </n-text>
        <n-text>
          <n-text strong>容错模式: </n-text>
          即使某些请求失败，继续执行其他请求，收集所有结果
        </n-text>
        <n-divider style="margin: 8px 0" />
        <n-text depth="3">
          说明：尝试获取 10 个帖子，其中 ID 999 会触发 404 错误
        </n-text>
      </n-flex>
    </n-card>

    <!-- 执行状态 -->
    <n-card size="small" title="执行状态">
      <n-flex vertical>
        <n-text>
          <n-text strong>当前模式: </n-text>
          <n-tag :type="currentMode === 'failFast' ? 'error' : 'success'">
            {{ currentMode === 'failFast' ? 'Fail-Fast' : '容错模式' }}
          </n-tag>
        </n-text>
        <n-text>
          <n-text strong>执行状态: </n-text>
          <n-tag :type="getStatusType()">{{ executionStatus }}</n-tag>
        </n-text>
        <n-text v-if="executionTime">
          <n-text strong>执行时间: </n-text>
          <n-tag type="info">{{ executionTime }}ms</n-tag>
        </n-text>
        <n-text v-if="successCount !== null">
          <n-text strong>成功数量: </n-text>
          <n-tag type="success">{{ successCount }}</n-tag>
        </n-text>
        <n-text v-if="failureCount !== null">
          <n-text strong>失败数量: </n-text>
          <n-tag :type="failureCount > 0 ? 'error' : 'default'">
            {{ failureCount }}
          </n-tag>
        </n-text>
      </n-flex>
    </n-card>

    <!-- 请求日志 -->
    <n-card size="small" title="请求日志">
      <n-scrollbar style="max-height: 300px">
        <n-flex vertical>
          <n-alert
            v-for="(log, index) in logs"
            :key="index"
            :type="log.type"
            :title="log.title"
            size="small"
            style="margin-bottom: 8px"
          >
            {{ log.message }}
          </n-alert>
          <n-empty v-if="logs.length === 0" description="暂无日志" />
        </n-flex>
      </n-scrollbar>
    </n-card>

    <!-- 结果详情 -->
    <n-card v-if="results.length > 0" size="small" title="结果详情">
      <n-scrollbar style="max-height: 200px">
        <n-flex vertical>
          <n-flex
            v-for="(result, index) in results"
            :key="index"
            align="center"
            justify="space-between"
          >
            <n-flex align="center">
              <n-tag :type="result.success ? 'success' : 'error'" size="small">
                {{ result.success ? '✓' : '✗' }}
              </n-tag>
              <n-text>Post {{ getPostId(result, index) }}</n-text>
            </n-flex>
            <n-text v-if="result.duration" depth="3">
              {{ result.duration }}ms
            </n-text>
          </n-flex>
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
  NAlert,
  NEmpty,
  NDivider,
  NScrollbar,
} from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// PostAPI类 - 演示 Fail-Fast
class PostApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getBatchPosts(failFast: boolean) {
    // 创建请求配置，包含一个会失败的请求
    const postIds = [1, 2, 3, 4, 5, 999, 6, 7, 8, 9] // 999 不存在，会返回 404
    const configs = postIds.map(id => ({
      url: `https://jsonplaceholder.typicode.com/posts/${id}`,
      method: 'GET' as const,
    }))

    return await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 5,
      failFast: failFast,
    })
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
const currentMode = ref<'failFast' | 'graceful'>('failFast')
const executionStatus = ref('未执行')
const executionTime = ref(0)
const successCount = ref<number | null>(null)
const failureCount = ref<number | null>(null)
const logs = ref<
  Array<{ type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }>
>([])
const results = ref<any[]>([])

// 获取 Post ID
const getPostId = (result: any, index: number) => {
  const postIds = [1, 2, 3, 4, 5, 999, 6, 7, 8, 9]
  return postIds[index]
}

// 获取状态标签类型
const getStatusType = (): 'success' | 'error' | 'warning' | 'default' | 'info' | 'primary' => {
  if (executionStatus.value === '执行成功') return 'success'
  if (executionStatus.value === '执行失败') return 'error'
  if (executionStatus.value === '执行中...') return 'info'
  return 'default'
}

// 添加日志
const addLog = (
  type: 'success' | 'error' | 'warning' | 'info',
  title: string,
  message: string
) => {
  logs.value.unshift({ type, title, message })
}

// 批量请求
const fetchBatch = async (failFast: boolean) => {
  try {
    loading.value = true
    currentMode.value = failFast ? 'failFast' : 'graceful'
    executionStatus.value = '执行中...'
    executionTime.value = 0
    successCount.value = null
    failureCount.value = null
    logs.value = []
    results.value = []

    addLog(
      'info',
      '开始执行',
      `Mode: ${failFast ? 'Fail-Fast' : 'Graceful'}, Total requests: 10`
    )

    const startTime = Date.now()

    try {
      const batchResults = await apiClient.post.getBatchPosts(failFast)

      executionTime.value = Date.now() - startTime
      results.value = batchResults

      // 统计成功和失败
      const successful = batchResults.filter(r => r.success).length
      const failed = batchResults.filter(r => !r.success).length

      successCount.value = successful
      failureCount.value = failed

      executionStatus.value = '执行成功'
      addLog(
        'success',
        '批量请求完成',
        `Completed in ${executionTime.value}ms, Success: ${successful}, Failed: ${failed}`
      )

      if (failed > 0) {
        addLog(
          'warning',
          '部分请求失败',
          `${failed} requests failed but other requests continued (Graceful mode)`
        )
      }
    } catch (error: any) {
      // Fail-Fast 模式会抛出错误
      executionTime.value = Date.now() - startTime
      executionStatus.value = '执行失败'
      
      addLog(
        'error',
        'Fail-Fast 触发',
        `Request failed and all remaining requests were cancelled`
      )
      addLog(
        'error',
        '错误信息',
        error.message || 'Unknown error'
      )

      console.error('Fail-Fast mode triggered:', error)
    }
  } catch (error: any) {
    executionStatus.value = '执行失败'
    addLog('error', '意外错误', error.message || 'Unexpected error')
    console.error('Batch request failed:', error)
  } finally {
    loading.value = false
  }
}
</script>

