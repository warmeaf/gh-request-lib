<template>
  <n-flex vertical>
    <!-- 说明 -->
    <n-alert type="info" title="Hash 算法对比">
      对比不同 Hash 算法的性能特征，包括速度、冲突率和适用场景。
    </n-alert>

    <!-- 算法选择 -->
    <n-card size="small" title="选择 Hash 算法">
      <n-flex align="center">
        <n-text strong>当前算法：</n-text>
        <n-select
          v-model:value="selectedAlgorithm"
          :options="algorithmOptions"
          style="width: 200px"
        />
        <n-tag :type="getAlgorithmTagType(selectedAlgorithm)">
          {{ getAlgorithmDescription(selectedAlgorithm) }}
        </n-tag>
      </n-flex>
    </n-card>

    <!-- 测试操作 -->
    <n-card size="small" title="性能测试">
      <n-flex vertical>
        <n-flex align="center">
          <n-button
            type="primary"
            @click="singleTest"
            :loading="singleLoading"
          >
            单次测试
          </n-button>
          <n-button
            type="warning"
            @click="batchTest"
            :loading="batchLoading"
          >
            批量测试 (100次)
          </n-button>
          <n-button
            type="info"
            @click="compareAllAlgorithms"
            :loading="compareLoading"
          >
            对比所有算法
          </n-button>
          <n-button @click="resetResults">
            重置结果
          </n-button>
        </n-flex>

        <n-text depth="3">
          提示：批量测试可以更准确地评估算法性能
        </n-text>
      </n-flex>
    </n-card>

    <!-- 当前算法性能 -->
    <n-card v-if="currentResult" size="small" :title="`${selectedAlgorithm.toUpperCase()} 算法性能`">
      <n-flex vertical>
        <n-grid cols="3" x-gap="12" y-gap="12">
          <n-gi>
            <n-statistic label="平均键生成时间">
              <template #default>
                <n-text type="success">{{ currentResult.avgKeyGenTime.toFixed(4) }}</n-text>
              </template>
              <template #suffix>
                <n-text depth="3">ms</n-text>
              </template>
            </n-statistic>
          </n-gi>
          <n-gi>
            <n-statistic label="测试次数" :value="currentResult.testCount">
              <template #suffix>
                <n-text depth="3">次</n-text>
              </template>
            </n-statistic>
          </n-gi>
          <n-gi>
            <n-statistic label="总耗时">
              <template #default>
                <n-text type="info">{{ currentResult.totalTime.toFixed(2) }}</n-text>
              </template>
              <template #suffix>
                <n-text depth="3">ms</n-text>
              </template>
            </n-statistic>
          </n-gi>
        </n-grid>

        <n-divider />

        <n-flex vertical>
          <n-text strong>性能等级：</n-text>
          <n-progress
            type="line"
            :percentage="getPerformanceScore(currentResult.avgKeyGenTime)"
            :color="getPerformanceColor(currentResult.avgKeyGenTime)"
          >
            <n-text>{{ getPerformanceLevel(currentResult.avgKeyGenTime) }}</n-text>
          </n-progress>
        </n-flex>
      </n-flex>
    </n-card>

    <!-- 算法对比 -->
    <n-card v-if="comparisonResults.length > 0" size="small" title="算法性能对比">
      <n-flex vertical>
        <n-text depth="3">
          基准：最快的算法为 100%，其他算法相对性能
        </n-text>

        <n-flex vertical>
          <n-card
            v-for="result in sortedComparisonResults"
            :key="result.algorithm"
            size="small"
            :bordered="false"
          >
            <n-flex vertical>
              <n-flex align="center" justify="space-between">
                <n-flex align="center">
                  <n-tag :type="getAlgorithmTagType(result.algorithm)" size="large">
                    {{ result.algorithm.toUpperCase() }}
                  </n-tag>
                  <n-text depth="3">{{ getAlgorithmFullName(result.algorithm) }}</n-text>
                </n-flex>
                <n-text strong>{{ result.avgKeyGenTime.toFixed(4) }}ms</n-text>
              </n-flex>

              <n-progress
                type="line"
                :percentage="(fastestTime / result.avgKeyGenTime) * 100"
                :color="getSpeedColor(result.rank ?? 0)"
                :show-indicator="false"
              />

              <n-flex justify="space-between">
                <n-text depth="3">
                  <n-text strong>排名：</n-text>{{ result.rank }}/{{ comparisonResults.length }}
                </n-text>
                <n-text depth="3">
                  <n-text strong>相对速度：</n-text>{{ result.relativeSpeed }}
                </n-text>
                <n-text depth="3">
                  <n-text strong>测试次数：</n-text>{{ result.testCount }}
                </n-text>
              </n-flex>
            </n-flex>
          </n-card>
        </n-flex>
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
  NAlert,
  NSelect,
  NDivider,
  NStatistic,
  NGrid,
  NGi,
  NProgress,
} from 'naive-ui'
import { createApiClient, type RequestCore } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// Hash算法类型
type HashAlgorithm = 'simple' | 'fnv1a' | 'xxhash'

// API类 - 支持不同的 Hash 算法
class HashTestApi {
  requestCore: RequestCore
  constructor(requestCore: RequestCore) {
    this.requestCore = requestCore
  }

  // 使用指定算法的幂等请求
  async testRequest(data: any, algorithm: HashAlgorithm) {
    return this.requestCore.postIdempotent(
      'https://jsonplaceholder.typicode.com/posts',
      data,
      undefined,
      {
        ttl: 5000,
        hashAlgorithm: algorithm,
        key: `test-${algorithm}`,
      }
    )
  }

  // 获取幂等统计
  getIdempotentStats() {
    return this.requestCore.getIdempotentStats()
  }

  // 清除缓存
  clearIdempotentCache() {
    return this.requestCore.clearIdempotentCache()
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { hashTest: HashTestApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 算法选项
const algorithmOptions = [
  { label: 'Simple - 最快', value: 'simple' },
  { label: 'FNV1a - 推荐（默认）', value: 'fnv1a' },
  { label: 'XXHash - 高性能', value: 'xxhash' },
]

// 状态管理
const selectedAlgorithm = ref<HashAlgorithm>('fnv1a')
const singleLoading = ref(false)
const batchLoading = ref(false)
const compareLoading = ref(false)

// 测试结果类型
interface TestResult {
  algorithm: HashAlgorithm
  avgKeyGenTime: number
  testCount: number
  totalTime: number
  rank?: number
  relativeSpeed?: string
}

const currentResult = ref<TestResult | null>(null)
const comparisonResults = ref<TestResult[]>([])

// 获取算法标签类型
const getAlgorithmTagType = (algorithm: HashAlgorithm) => {
  switch (algorithm) {
    case 'simple':
      return 'success'
    case 'fnv1a':
      return 'info'
    case 'xxhash':
      return 'warning'
    default:
      return 'default'
  }
}

// 获取算法描述
const getAlgorithmDescription = (algorithm: HashAlgorithm) => {
  switch (algorithm) {
    case 'simple':
      return '最快'
    case 'fnv1a':
      return '推荐'
    case 'xxhash':
      return '高性能'
    default:
      return ''
  }
}

// 获取算法全名
const getAlgorithmFullName = (algorithm: HashAlgorithm) => {
  switch (algorithm) {
    case 'simple':
      return 'Simple Hash'
    case 'fnv1a':
      return 'Fowler-Noll-Vo 1a'
    case 'xxhash':
      return 'xxHash'
    default:
      return ''
  }
}

// 获取性能分数
const getPerformanceScore = (time: number) => {
  // 时间越短，分数越高
  if (time < 0.01) return 100
  if (time < 0.05) return 90
  if (time < 0.1) return 80
  if (time < 0.5) return 70
  return 60
}

// 获取性能颜色
const getPerformanceColor = (time: number) => {
  if (time < 0.05) return '#18a058'
  if (time < 0.1) return '#2080f0'
  if (time < 0.5) return '#f0a020'
  return '#d03050'
}

// 获取性能等级
const getPerformanceLevel = (time: number) => {
  if (time < 0.01) return '极快'
  if (time < 0.05) return '很快'
  if (time < 0.1) return '快'
  if (time < 0.5) return '一般'
  return '慢'
}

// 获取速度颜色
const getSpeedColor = (rank: number) => {
  if (rank === 1) return '#18a058'
  if (rank === 2) return '#2080f0'
  return '#f0a020'
}

// 最快时间
const fastestTime = computed(() => {
  if (comparisonResults.value.length === 0) return 0
  return Math.min(...comparisonResults.value.map(r => r.avgKeyGenTime))
})

// 排序后的对比结果
const sortedComparisonResults = computed(() => {
  return [...comparisonResults.value].sort((a, b) => a.avgKeyGenTime - b.avgKeyGenTime)
})

// 单次测试
const singleTest = async () => {
  singleLoading.value = true

  try {
    // 先清除缓存
    await apiClient.hashTest.clearIdempotentCache()

    const startTime = performance.now()

    await apiClient.hashTest.testRequest(
      {
        title: 'Test',
        body: 'Test content',
        userId: 1,
      },
      selectedAlgorithm.value
    )

    const endTime = performance.now()
    const stats = apiClient.hashTest.getIdempotentStats()

    currentResult.value = {
      algorithm: selectedAlgorithm.value,
      avgKeyGenTime: stats.keyGenerationTime,
      testCount: 1,
      totalTime: endTime - startTime,
    }

    console.log('Single test completed:', currentResult.value)
  } catch (error: any) {
    console.error('Single test failed:', error)
  } finally {
    singleLoading.value = false
  }
}

// 批量测试
const batchTest = async () => {
  batchLoading.value = true

  try {
    // 先清除缓存
    await apiClient.hashTest.clearIdempotentCache()

    const testCount = 100
    const startTime = performance.now()

    // 执行批量测试
    for (let i = 0; i < testCount; i++) {
      await apiClient.hashTest.testRequest(
        {
          title: `Test ${i}`,
          body: `Test content ${i}`,
          userId: 1,
        },
        selectedAlgorithm.value
      )
    }

    const endTime = performance.now()
    const stats = apiClient.hashTest.getIdempotentStats()

    currentResult.value = {
      algorithm: selectedAlgorithm.value,
      avgKeyGenTime: stats.keyGenerationTime,
      testCount: testCount,
      totalTime: endTime - startTime,
    }

    console.log('Batch test completed:', currentResult.value)
  } catch (error: any) {
    console.error('Batch test failed:', error)
  } finally {
    batchLoading.value = false
  }
}

// 对比所有算法
const compareAllAlgorithms = async () => {
  compareLoading.value = true
  comparisonResults.value = []

  try {
    const algorithms: HashAlgorithm[] = ['simple', 'fnv1a', 'xxhash']
    const testCount = 100

    for (const algorithm of algorithms) {
      // 清除缓存
      await apiClient.hashTest.clearIdempotentCache()

      const startTime = performance.now()

      // 执行测试
      for (let i = 0; i < testCount; i++) {
        await apiClient.hashTest.testRequest(
          {
            title: `Test ${i}`,
            body: `Test content ${i}`,
            userId: 1,
          },
          algorithm
        )
      }

      const endTime = performance.now()
      const stats = apiClient.hashTest.getIdempotentStats()

      comparisonResults.value.push({
        algorithm,
        avgKeyGenTime: stats.keyGenerationTime,
        testCount: testCount,
        totalTime: endTime - startTime,
      })
    }

    // 排序并添加排名
    const sorted = [...comparisonResults.value].sort((a, b) => a.avgKeyGenTime - b.avgKeyGenTime)
    const fastest = sorted[0].avgKeyGenTime

    comparisonResults.value = comparisonResults.value.map((result, index) => {
      const rank = sorted.findIndex(r => r.algorithm === result.algorithm) + 1
      const relativeSpeed = ((fastest / result.avgKeyGenTime) * 100).toFixed(1) + '%'
      
      return {
        ...result,
        rank,
        relativeSpeed,
      }
    })

    console.log('Comparison completed:', comparisonResults.value)
  } catch (error: any) {
    console.error('Comparison failed:', error)
  } finally {
    compareLoading.value = false
  }
}

// 重置结果
const resetResults = () => {
  currentResult.value = null
  comparisonResults.value = []
  console.log('Results reset')
}
</script>

