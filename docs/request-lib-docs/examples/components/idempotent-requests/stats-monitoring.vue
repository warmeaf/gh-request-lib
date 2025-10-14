<template>
  <n-flex vertical>
    <!-- 说明 -->
    <n-alert type="info" title="幂等统计与监控">
      实时监控幂等请求的执行情况，包括请求统计、性能指标等。
    </n-alert>

    <!-- 操作区 -->
    <n-card size="small" title="测试操作">
      <n-flex align="center">
        <n-button
          type="primary"
          @click="submitRequest"
          :loading="loading"
        >
          提交请求
        </n-button>
        <n-button
          type="warning"
          @click="rapidSubmit"
          :loading="rapidLoading"
        >
          快速提交 10 次
        </n-button>
        <n-button @click="resetStats">
          重置统计
        </n-button>
        <n-button @click="clearCache">
          清除幂等缓存
        </n-button>
      </n-flex>
    </n-card>

    <!-- 实时统计 -->
    <n-card size="small" title="实时统计信息">
      <n-flex vertical>
        <n-grid cols="2" x-gap="12" y-gap="12">
          <n-gi>
            <n-statistic label="总请求数" :value="stats.totalRequests">
              <template #suffix>
                <n-text depth="3">次</n-text>
              </template>
            </n-statistic>
          </n-gi>
          <n-gi>
            <n-statistic label="实际网络请求" :value="stats.actualNetworkRequests">
              <template #suffix>
                <n-text depth="3">次</n-text>
              </template>
            </n-statistic>
          </n-gi>
          <n-gi>
            <n-statistic label="阻止的重复请求" :value="stats.duplicatesBlocked">
              <template #suffix>
                <n-text depth="3">次</n-text>
              </template>
            </n-statistic>
          </n-gi>
          <n-gi>
            <n-statistic label="缓存命中" :value="stats.cacheHits">
              <template #suffix>
                <n-text depth="3">次</n-text>
              </template>
            </n-statistic>
          </n-gi>
        </n-grid>

        <n-divider />

        <n-flex vertical>
          <n-flex justify="space-between">
            <n-text strong>平均响应时间</n-text>
            <n-tag type="info">{{ stats.avgResponseTime.toFixed(2) }}ms</n-tag>
          </n-flex>
          <n-flex justify="space-between">
            <n-text strong>键生成平均时间</n-text>
            <n-tag type="info">{{ stats.keyGenerationTime.toFixed(4) }}ms</n-tag>
          </n-flex>
        </n-flex>

      </n-flex>
    </n-card>

    <!-- 重复请求监控 -->
    <n-card size="small" title="重复请求监控">
      <n-flex vertical>
        <n-text depth="3">使用 onDuplicate 回调监听每次重复请求</n-text>
        
        <n-scrollbar style="max-height: 200px">
          <n-flex vertical>
            <n-alert
              v-for="(duplicate, index) in duplicateRequests"
              :key="index"
              type="warning"
              size="small"
            >
              <n-flex vertical>
                <n-text>
                  <n-text strong>[{{ duplicate.time }}]</n-text> 检测到重复请求
                </n-text>
                <n-text depth="3">URL: {{ duplicate.url }}</n-text>
                <n-text depth="3">方法: {{ duplicate.method }}</n-text>
              </n-flex>
            </n-alert>
            <n-empty v-if="duplicateRequests.length === 0" description="暂无重复请求" size="small" />
          </n-flex>
        </n-scrollbar>
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
  NAlert,
  NEmpty,
  NDivider,
  NScrollbar,
  NStatistic,
  NGrid,
  NGi,
} from 'naive-ui'
import { createApiClient, type RequestCore } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// API类 - 带统计监控
class MonitoredApi {
  requestCore: RequestCore
  constructor(requestCore: RequestCore) {
    this.requestCore = requestCore
  }

  // 提交数据 - 启用幂等保护和监控
  async submitData(
    data: any,
    onDuplicate?: (original: any, duplicate: any) => void
  ) {
    return this.requestCore.postIdempotent(
      'https://jsonplaceholder.typicode.com/posts',
      data,
      undefined,
      {
        ttl: 30000, // 30秒
        key: 'monitored-submit',
        onDuplicate: onDuplicate,
      }
    )
  }

  // 获取幂等统计
  getIdempotentStats() {
    return this.requestCore.getIdempotentStats()
  }

  // 清除幂等缓存
  clearIdempotentCache() {
    return this.requestCore.clearIdempotentCache()
  }

  // 重置幂等统计
  resetIdempotentStats() {
    return this.requestCore.resetIdempotentStats()
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { monitored: MonitoredApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 状态管理
const loading = ref(false)
const rapidLoading = ref(false)

// 统计信息
const stats = ref({
  totalRequests: 0,
  duplicatesBlocked: 0,
  cacheHits: 0,
  actualNetworkRequests: 0,
  avgResponseTime: 0,
  keyGenerationTime: 0,
})

// 重复请求记录
interface DuplicateRequest {
  time: string
  url: string
  method: string
}

const duplicateRequests = ref<DuplicateRequest[]>([])

// 格式化时间
const formatTime = () => {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
}

// 更新统计信息
const updateStats = () => {
  const idempotentStats = apiClient.monitored.getIdempotentStats()
  stats.value = {
    ...idempotentStats,
  }
}

// 提交请求
const submitRequest = async () => {
  loading.value = true

  try {
    await apiClient.monitored.submitData(
      {
        title: 'Test Post',
        body: 'Test content',
        userId: 1,
      },
      (_original, duplicate) => {
        // 记录重复请求
        duplicateRequests.value.unshift({
          time: formatTime(),
          url: duplicate.url || '',
          method: duplicate.method || '',
        })

        // 只保留最近 10 条
        if (duplicateRequests.value.length > 10) {
          duplicateRequests.value = duplicateRequests.value.slice(0, 10)
        }

        console.warn('Duplicate request detected:', duplicate)
      }
    )

    // 更新统计
    updateStats()
  } catch (error: any) {
    console.error('Request failed:', error)
  } finally {
    loading.value = false
  }
}

// 快速提交多次
const rapidSubmit = async () => {
  rapidLoading.value = true

  try {
    console.log('Starting rapid submit...')

    // 快速连续提交 10 次
    const promises: Promise<any>[] = []
    for (let i = 0; i < 10; i++) {
      promises.push(
        apiClient.monitored.submitData(
          {
            title: 'Rapid Test Post',
            body: 'Rapid test content',
            userId: 1,
          },
          (_original, duplicate) => {
            // 记录重复请求
            duplicateRequests.value.unshift({
              time: formatTime(),
              url: duplicate.url || '',
              method: duplicate.method || '',
            })

            if (duplicateRequests.value.length > 10) {
              duplicateRequests.value = duplicateRequests.value.slice(0, 10)
            }
          }
        )
      )
    }

    await Promise.all(promises)

    // 更新统计
    updateStats()

    console.log('Rapid submit completed')
  } catch (error: any) {
    console.error('Rapid submit failed:', error)
  } finally {
    rapidLoading.value = false
  }
}

// 重置统计
const resetStats = () => {
  // 重置库内部的统计数据
  apiClient.monitored.resetIdempotentStats()
  
  // 重置本地显示数据
  stats.value = {
    totalRequests: 0,
    duplicatesBlocked: 0,
    cacheHits: 0,
    actualNetworkRequests: 0,
    avgResponseTime: 0,
    keyGenerationTime: 0,
  }
  duplicateRequests.value = []
  console.log('Stats reset')
}

// 清除缓存
const clearCache = async () => {
  await apiClient.monitored.clearIdempotentCache()
  console.log('Idempotent cache cleared')
}
</script>

