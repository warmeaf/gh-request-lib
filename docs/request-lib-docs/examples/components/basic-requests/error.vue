<template>
  <div class="demo-container">
    <!-- 请求操作区 -->
    <div class="request-section">
      <div class="error-scenarios">
        <h4>测试错误场景：</h4>
        <div class="scenario-buttons">
          <button
            @click="testScenario('not-found')"
            :disabled="loading"
            class="scenario-btn"
          >
            404错误
          </button>

          <button
            @click="testScenario('network-error')"
            :disabled="loading"
            class="scenario-btn"
          >
            网络错误
          </button>

          <button
            @click="testScenario('timeout')"
            :disabled="loading"
            class="scenario-btn"
          >
            请求超时
          </button>
        </div>
      </div>
    </div>

    <!-- 响应结果区 -->
    <div class="response-section">
      <h4>错误处理结果</h4>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading">
        <span>⏳ {{ loadingMessage }}</span>
      </div>

      <!-- 最新结果 -->
      <div v-if="currentResult && !loading" class="current-result">
        <div v-if="currentResult.success" class="status-badge success">
          ✅ 意外成功
        </div>
        <div v-else class="status-badge error">❌ 请求失败</div>

        <div class="error-details">
          <div class="detail-row">
            <strong>场景：</strong> {{ currentResult.scenarioName }}
          </div>
          <div class="detail-row">
            <strong>耗时：</strong> {{ currentResult.totalTime }}ms
          </div>
          <div class="detail-row">
            <strong>错误类型：</strong> {{ currentResult.errorType || 'N/A' }}
          </div>
          <div class="detail-row">
            <strong>错误信息：</strong>
            <span class="error-message">{{ currentResult.message }}</span>
          </div>
        </div>

        <!-- 完整错误信息 -->
        <div class="raw-error">
          <h5>完整错误信息：</h5>
          <pre class="error-data">{{
            JSON.stringify(currentResult, null, 2)
          }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 简化的演示API类
class DemoApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async testNotFound() {
    return this.requestCore.get(
      'https://jsonplaceholder.typicode.com/users/999999'
    )
  }

  async testNetworkError() {
    return this.requestCore.get(
      'https://invalid-domain-that-does-not-exist.com/api/data'
    )
  }

  async testTimeout() {
    return this.requestCore.get('https://httpstat.us/200?sleep=10000')
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { demo: DemoApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 3000 },
  }
)

// 状态管理
const loading = ref(false)
const loadingMessage = ref('')
const currentResult = ref<any>(null)

// 场景配置
const scenarioConfig = {
  'not-found': {
    name: '404错误 - 资源不存在',
    message: '测试请求不存在的资源...',
  },
  'network-error': {
    name: '网络错误 - 无效域名',
    message: '测试网络连接错误...',
  },
  timeout: {
    name: '请求超时 - 响应时间过长',
    message: '测试请求超时（3秒）...',
  },
}

// 测试错误场景
const testScenario = async (scenario: string) => {
  loading.value = true
  currentResult.value = null

  const startTime = Date.now()
  const config = scenarioConfig[scenario]
  loadingMessage.value = config?.message || 'Testing...'

  const result = {
    scenario,
    scenarioName: config?.name || scenario,
    timestamp: new Date().toLocaleTimeString(),
    success: false,
    totalTime: 0,
    errorType: '',
    message: '',
    errorDetails: null as any,
  }

  try {
    let response

    switch (scenario) {
      case 'not-found':
        response = await apiClient.demo.testNotFound()
        break
      case 'network-error':
        response = await apiClient.demo.testNetworkError()
        break
      case 'timeout':
        response = await apiClient.demo.testTimeout()
        break
      default:
        throw new Error('Unknown scenario')
    }

    // 意外成功
    result.success = true
    result.message = 'Request succeeded unexpectedly'
    result.errorDetails = response
  } catch (error: any) {
    result.success = false
    result.errorType = error.name || 'Error'
    result.message = error.message || 'Unknown error occurred'
    result.errorDetails = {
      name: error.name,
      message: error.message,
      stack: error.stack?.split('\n').slice(0, 3).join('\n'),
    }
  } finally {
    result.totalTime = Date.now() - startTime
    currentResult.value = result

    loading.value = false
    loadingMessage.value = ''
  }
}
</script>

<style scoped>
.request-section {
  margin-bottom: 20px;
}

.scenario-buttons {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.scenario-btn {
  background: #007bff;
  color: white;
  border: none;
  cursor: pointer;
}

.scenario-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.loading {
  color: #666;
}

.status-badge {
  font-weight: bold;
}

.status-badge.success {
  background: #d4edda;
  color: #155724;
}

.status-badge.error {
  background: #f8d7da;
  color: #721c24;
}

.error-details {
  background: #f8f9fa;
  border: 1px solid #ddd;
}

.error-data {
  margin: 0;
  background: #f8f9fa;
  color: #333;
  white-space: pre;
  overflow-x: auto;
}
</style>
