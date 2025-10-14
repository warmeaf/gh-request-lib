<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-button type="primary" @click="fetchWithLimit" :loading="loading">
        发送批量请求
      </n-button>
      <n-button @click="resetStats">重置统计</n-button>
    </n-flex>

    <!-- 并发控制配置 -->
    <n-card size="small" title="并发控制配置">
      <n-flex vertical>
        <n-text>
          <n-text strong>请求总数: </n-text>
          <n-slider
            v-model:value="totalRequests"
            :min="5"
            :max="50"
            :step="5"
            :marks="{ 5: '5', 25: '25', 50: '50' }"
          />
          <n-tag type="info">{{ totalRequests }} 个</n-tag>
        </n-text>
        <n-text>
          <n-text strong>最大并发数: </n-text>
          <n-slider
            v-model:value="maxConcurrency"
            :min="1"
            :max="20"
            :step="1"
            :marks="{ 1: '1', 5: '5', 10: '10', 20: '无限制' }"
          />
          <n-tag type="success">
            {{ maxConcurrency === 20 ? '无限制' : `${maxConcurrency} 个` }}
          </n-tag>
        </n-text>
        <n-divider style="margin: 8px 0" />
        <n-text depth="3">
          说明：限制最大并发数可以避免同时发起过多请求，保护服务器和客户端资源
        </n-text>
      </n-flex>
    </n-card>

    <!-- 实时监控 -->
    <n-card size="small" title="实时监控">
      <n-flex vertical>
        <n-text>
          <n-text strong>总请求数: </n-text>
          <n-tag type="info">{{ stats.total }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>已完成: </n-text>
          <n-tag type="success">{{ stats.completed }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>进行中: </n-text>
          <n-tag type="warning">{{ stats.inProgress }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>等待中: </n-text>
          <n-tag>{{ stats.pending }}</n-tag>
        </n-text>
        <n-progress
          type="line"
          :percentage="stats.percentage"
          :status="loading ? 'info' : 'success'"
        />
        <n-text depth="3">
          实际最大并发: {{ stats.peakConcurrency }}
        </n-text>
      </n-flex>
    </n-card>

    <!-- 执行时间线 -->
    <n-card size="small" title="执行时间线">
      <n-scrollbar style="max-height: 250px">
        <n-flex vertical>
          <n-flex
            v-for="(event, index) in timeline"
            :key="index"
            align="center"
          >
            <n-text depth="3" style="width: 80px">
              [{{ event.time }}]
            </n-text>
            <n-tag
              :type="
                event.type === 'start'
                  ? 'info'
                  : event.type === 'complete'
                  ? 'success'
                  : 'warning'
              "
              size="small"
            >
              {{ event.label }}
            </n-tag>
            <n-text>{{ event.message }}</n-text>
          </n-flex>
          <n-empty v-if="timeline.length === 0" description="暂无事件" />
        </n-flex>
      </n-scrollbar>
    </n-card>

    <!-- 性能统计 -->
    <n-card v-if="performanceStats" size="small" title="性能统计">
      <n-flex vertical>
        <n-text>
          <n-text strong>总耗时: </n-text>
          <n-tag type="info">{{ performanceStats.totalDuration }}ms</n-tag>
        </n-text>
        <n-text>
          <n-text strong>平均耗时: </n-text>
          <n-tag>{{ performanceStats.averageDuration }}ms</n-tag>
        </n-text>
        <n-text>
          <n-text strong>成功率: </n-text>
          <n-tag :type="performanceStats.successRate >= 80 ? 'success' : 'warning'">
            {{ performanceStats.successRate }}%
          </n-tag>
        </n-text>
        <n-text>
          <n-text strong>吞吐量: </n-text>
          <n-tag type="success">
            {{ performanceStats.throughput }} 请求/秒
          </n-tag>
        </n-text>
      </n-flex>
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
  NSlider,
  NProgress,
  NEmpty,
  NDivider,
  NScrollbar,
} from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// PostAPI类 - 演示并发控制
class PostApi {
  requestCore: any
  onProgress?: (completed: number, inProgress: number, total: number) => void

  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  // 手动实现并发控制和进度追踪
  async getPostsConcurrent(count: number, maxConcurrency: number | undefined) {
    const urls = Array.from(
      { length: count },
      (_, i) => `https://jsonplaceholder.typicode.com/posts/${(i % 100) + 1}`
    )

    // 统计变量
    let completed = 0
    let inProgress = 0
    const total = count
    const results: any[] = []

    // 更新进度的辅助函数
    const updateProgress = () => {
      if (this.onProgress) {
        this.onProgress(completed, inProgress, total)
      }
    }

    // 执行单个请求的包装函数
    const executeRequest = async (url: string, index: number) => {
      inProgress++
      updateProgress()

      const startTime = Date.now()
      try {
        const data = await this.requestCore.request({
          url,
          method: 'GET',
        })

        const duration = Date.now() - startTime
        results[index] = {
          success: true,
          data,
          duration,
          index,
        }
      } catch (error) {
        const duration = Date.now() - startTime
        results[index] = {
          success: false,
          error,
          duration,
          index,
        }
      } finally {
        inProgress--
        completed++
        updateProgress()
      }
    }

    // 如果没有并发限制，使用 Promise.all
    if (!maxConcurrency || maxConcurrency === 20) {
      await Promise.all(urls.map((url, index) => executeRequest(url, index)))
      return results
    }

    // 有并发限制时，手动控制并发
    let currentIndex = 0
    const executing: Promise<void>[] = []

    while (currentIndex < urls.length || executing.length > 0) {
      // 启动新请求直到达到并发限制
      while (executing.length < maxConcurrency && currentIndex < urls.length) {
        const index = currentIndex++
        const promise = executeRequest(urls[index], index)
        executing.push(promise)

        // 请求完成后从执行列表中移除
        promise.then(() => {
          const idx = executing.indexOf(promise)
          if (idx !== -1) {
            executing.splice(idx, 1)
          }
        })
      }

      // 等待至少一个请求完成
      if (executing.length > 0) {
        await Promise.race(executing)
      }
    }

    return results
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
const totalRequests = ref(20)
const maxConcurrency = ref(5)
const stats = ref({
  total: 0,
  completed: 0,
  inProgress: 0,
  pending: 0,
  percentage: 0,
  peakConcurrency: 0,
})
const timeline = ref<
  Array<{ time: string; type: string; label: string; message: string }>
>([])
const performanceStats = ref<any>(null)

// 计算等待中的请求数
const updateStats = (completed: number, inProgress: number, total: number) => {
  stats.value.completed = completed
  stats.value.inProgress = inProgress
  stats.value.pending = total - completed - inProgress
  stats.value.percentage = Math.round((completed / total) * 100)

  // 更新峰值并发
  if (inProgress > stats.value.peakConcurrency) {
    stats.value.peakConcurrency = inProgress
  }
}

// 添加时间线事件
const addTimelineEvent = (
  type: string,
  label: string,
  message: string
) => {
  const time = new Date().toLocaleTimeString()
  timeline.value.unshift({ time, type, label, message })

  // 限制事件数量
  if (timeline.value.length > 50) {
    timeline.value.pop()
  }
}

// 发送带限制的并发请求
const fetchWithLimit = async () => {
  try {
    loading.value = true
    stats.value = {
      total: totalRequests.value,
      completed: 0,
      inProgress: 0,
      pending: totalRequests.value,
      percentage: 0,
      peakConcurrency: 0,
    }
    timeline.value = []
    performanceStats.value = null

    addTimelineEvent('start', '开始', `Total ${totalRequests.value} requests`)
    addTimelineEvent(
      'info',
      '配置',
      `Max concurrency: ${maxConcurrency.value === 20 ? 'unlimited' : maxConcurrency.value}`
    )

    const startTime = Date.now()

    // 设置进度回调
    apiClient.post.onProgress = (completed, inProgress, total) => {
      updateStats(completed, inProgress, total)
    }

    const results = await apiClient.post.getPostsConcurrent(
      totalRequests.value,
      maxConcurrency.value
    )

    const totalDuration = Date.now() - startTime

    // 计算统计信息
    const successful = results.filter(r => r.success).length
    const failed = results.filter(r => !r.success).length
    const durations = results
      .filter(r => r.duration)
      .map(r => r.duration || 0)
    const averageDuration = Math.round(
      durations.reduce((a, b) => a + b, 0) / durations.length
    )

    performanceStats.value = {
      totalDuration,
      averageDuration,
      successRate: Math.round((successful / results.length) * 100),
      throughput: ((results.length / totalDuration) * 1000).toFixed(2),
    }

    addTimelineEvent(
      'complete',
      '完成',
      `Completed in ${totalDuration}ms, success: ${successful}, failed: ${failed}`
    )

    console.log('Concurrent requests completed:', performanceStats.value)
  } catch (error) {
    console.error('Concurrent requests failed:', error)
    addTimelineEvent('error', '失败', `Error: ${error}`)
  } finally {
    loading.value = false
  }
}

// 重置统计
const resetStats = () => {
  stats.value = {
    total: 0,
    completed: 0,
    inProgress: 0,
    pending: 0,
    percentage: 0,
    peakConcurrency: 0,
  }
  timeline.value = []
  performanceStats.value = null
}
</script>

