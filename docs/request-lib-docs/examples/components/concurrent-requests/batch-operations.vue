<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex align="center">
      <n-button type="primary" @click="batchCreate" :loading="loading">
        批量创建文章
      </n-button>
      <n-button type="success" @click="batchUpdate" :loading="loading">
        批量更新文章
      </n-button>
      <n-button type="error" @click="batchDelete" :loading="loading">
        批量删除文章
      </n-button>
    </n-flex>

    <!-- 批量操作配置 -->
    <n-card size="small" title="批量操作配置">
      <n-flex vertical>
        <n-text>
          <n-text strong>操作数量: </n-text>
          <n-input-number
            v-model:value="batchSize"
            :min="1"
            :max="20"
            style="width: 120px"
          />
        </n-text>
        <n-text>
          <n-text strong>最大并发: </n-text>
          <n-input-number
            v-model:value="maxConcurrency"
            :min="1"
            :max="10"
            style="width: 120px"
          />
        </n-text>
        <n-text depth="3">
          提示：写操作（创建、更新、删除）通常需要限制较低的并发数
        </n-text>
      </n-flex>
    </n-card>

    <!-- 执行结果 -->
    <n-card size="small" title="执行结果">
      <n-flex vertical>
        <n-text>
          <n-text strong>操作类型: </n-text>
          <n-tag :type="getOperationTypeTag()">{{ operationType }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>总数: </n-text>
          <n-tag type="info">{{ stats.total }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>成功: </n-text>
          <n-tag type="success">{{ stats.success }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>失败: </n-text>
          <n-tag :type="stats.failed > 0 ? 'error' : 'default'">
            {{ stats.failed }}
          </n-tag>
        </n-text>
        <n-text v-if="stats.duration">
          <n-text strong>耗时: </n-text>
          <n-tag type="info">{{ stats.duration }}ms</n-tag>
        </n-text>
        <n-progress
          v-if="stats.total > 0"
          type="line"
          :percentage="(stats.success / stats.total) * 100"
          :status="stats.failed > 0 ? 'warning' : 'success'"
        />
      </n-flex>
    </n-card>

    <!-- 详细结果 -->
    <n-card size="small" title="操作详情">
      <n-tabs type="segment">
        <n-tab-pane name="all" tab="全部">
          <n-scrollbar style="max-height: 300px">
            <n-flex vertical>
              <n-card
                v-for="(result, index) in allResults"
                :key="index"
                size="small"
                :bordered="false"
              >
                <n-flex align="center" justify="space-between">
                  <n-flex align="center">
                    <n-tag :type="result.success ? 'success' : 'error'" size="small">
                      {{ result.success ? '✓ 成功' : '✗ 失败' }}
                    </n-tag>
                    <n-text>{{ result.label }}</n-text>
                  </n-flex>
                  <n-flex align="center">
                    <n-text v-if="result.duration" depth="3">
                      {{ result.duration }}ms
                    </n-text>
                  </n-flex>
                </n-flex>
                <n-text v-if="!result.success && result.error" depth="3">
                  Error: {{ result.error }}
                </n-text>
              </n-card>
              <n-empty v-if="allResults.length === 0" description="暂无结果" />
            </n-flex>
          </n-scrollbar>
        </n-tab-pane>

        <n-tab-pane name="success" tab="成功">
          <n-scrollbar style="max-height: 300px">
            <n-flex vertical>
              <n-card
                v-for="(result, index) in successResults"
                :key="index"
                size="small"
                :bordered="false"
              >
                <n-flex align="center" justify="space-between">
                  <n-text>{{ result.label }}</n-text>
                  <n-text v-if="result.data" depth="3">
                    ID: {{ result.data.id }}
                  </n-text>
                </n-flex>
              </n-card>
              <n-empty v-if="successResults.length === 0" description="暂无成功记录" />
            </n-flex>
          </n-scrollbar>
        </n-tab-pane>

        <n-tab-pane name="failed" tab="失败">
          <n-scrollbar style="max-height: 300px">
            <n-flex vertical>
              <n-alert
                v-for="(result, index) in failedResults"
                :key="index"
                type="error"
                :title="result.label"
                size="small"
                style="margin-bottom: 8px"
              >
                {{ result.error || 'Unknown error' }}
              </n-alert>
              <n-empty v-if="failedResults.length === 0" description="暂无失败记录" />
            </n-flex>
          </n-scrollbar>
        </n-tab-pane>
      </n-tabs>
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
  NAlert,
  NScrollbar,
  NTabs,
  NTabPane,
} from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// PostAPI类 - 演示批量操作
class PostApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  // 批量创建文章
  async batchCreate(count: number, maxConcurrency: number) {
    const requests = Array.from({ length: count }, (_, i) => ({
      url: 'https://jsonplaceholder.typicode.com/posts',
      data: {
        title: `Article ${i + 1}`,
        body: `Content of article ${i + 1}`,
        userId: (i % 10) + 1,
      },
    }))

    return await this.requestCore.postConcurrent(requests, {
      maxConcurrency,
      failFast: false,
    })
  }

  // 批量更新文章
  async batchUpdate(count: number, maxConcurrency: number) {
    const configs = Array.from({ length: count }, (_, i) => ({
      url: `https://jsonplaceholder.typicode.com/posts/${i + 1}`,
      method: 'PUT' as const,
      data: {
        title: `Updated Article ${i + 1}`,
        body: `Updated content ${i + 1}`,
      },
    }))

    return await this.requestCore.requestConcurrent(configs, {
      maxConcurrency,
      failFast: false,
    })
  }

  // 批量删除文章
  async batchDelete(count: number, maxConcurrency: number) {
    const configs = Array.from({ length: count }, (_, i) => ({
      url: `https://jsonplaceholder.typicode.com/posts/${i + 1}`,
      method: 'DELETE' as const,
    }))

    return await this.requestCore.requestConcurrent(configs, {
      maxConcurrency,
      failFast: false,
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
const batchSize = ref(10)
const maxConcurrency = ref(3)
const operationType = ref<'创建' | '更新' | '删除' | ''>('')
const stats = ref({
  total: 0,
  success: 0,
  failed: 0,
  duration: 0,
})
const allResults = ref<any[]>([])

// 计算属性
const successResults = computed(() => allResults.value.filter(r => r.success))
const failedResults = computed(() => allResults.value.filter(r => !r.success))

// 获取操作类型标签
const getOperationTypeTag = (): 'default' | 'success' | 'error' | 'warning' | 'info' | 'primary' => {
  if (operationType.value === '创建') return 'primary'
  if (operationType.value === '更新') return 'success'
  if (operationType.value === '删除') return 'error'
  return 'default'
}

// 处理批量操作结果
const processBatchResults = (
  results: any[],
  operation: '创建' | '更新' | '删除'
) => {
  allResults.value = results.map((result, index) => ({
    ...result,
    label: `${operation} #${index + 1}`,
    error: result.error?.message || result.error,
  }))

  stats.value.total = results.length
  stats.value.success = results.filter(r => r.success).length
  stats.value.failed = results.filter(r => !r.success).length
}

// 批量创建
const batchCreate = async () => {
  try {
    loading.value = true
    operationType.value = '创建'
    allResults.value = []

    const startTime = Date.now()
    const results = await apiClient.post.batchCreate(
      batchSize.value,
      maxConcurrency.value
    )
    stats.value.duration = Date.now() - startTime

    processBatchResults(results, '创建')

    console.log('Batch create completed:', stats.value)
  } catch (error) {
    console.error('Batch create failed:', error)
  } finally {
    loading.value = false
  }
}

// 批量更新
const batchUpdate = async () => {
  try {
    loading.value = true
    operationType.value = '更新'
    allResults.value = []

    const startTime = Date.now()
    const results = await apiClient.post.batchUpdate(
      batchSize.value,
      maxConcurrency.value
    )
    stats.value.duration = Date.now() - startTime

    processBatchResults(results, '更新')

    console.log('Batch update completed:', stats.value)
  } catch (error) {
    console.error('Batch update failed:', error)
  } finally {
    loading.value = false
  }
}

// 批量删除
const batchDelete = async () => {
  try {
    loading.value = true
    operationType.value = '删除'
    allResults.value = []

    const startTime = Date.now()
    const results = await apiClient.post.batchDelete(
      batchSize.value,
      maxConcurrency.value
    )
    stats.value.duration = Date.now() - startTime

    processBatchResults(results, '删除')

    console.log('Batch delete completed:', stats.value)
  } catch (error) {
    console.error('Batch delete failed:', error)
  } finally {
    loading.value = false
  }
}
</script>

