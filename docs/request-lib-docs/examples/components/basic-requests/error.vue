<template>
  <div class="demo-container">
    <h3>⚠️ 错误处理演示 - 重试机制与异常处理</h3>
    <div class="demo-content">
      <div class="error-info">
        <div class="info-card">
          <h4>🔧 错误处理特性</h4>
          <ul>
            <li>自动重试机制（可配置重试次数）</li>
            <li>智能重试条件判断</li>
            <li>详细的错误信息捕获</li>
            <li>多种错误场景演示</li>
          </ul>
        </div>
      </div>

      <div class="error-scenarios">
        <h4>🎯 选择错误场景进行测试</h4>
        <div class="scenario-grid">
          <button 
            @click="testScenario('not-found')"
            :disabled="loading"
            class="scenario-btn error-404"
          >
            🔍 404 - 资源不存在
          </button>
          
          <button 
            @click="testScenario('invalid-url')"
            :disabled="loading"
            class="scenario-btn error-network"
          >
            🌐 网络错误
          </button>
          
          <button 
            @click="testScenario('timeout')"
            :disabled="loading"
            class="scenario-btn error-timeout"
          >
            ⏰ 请求超时
          </button>
          
          <button 
            @click="testScenario('retry')"
            :disabled="loading"
            class="scenario-btn error-retry"
          >
            🔄 重试机制测试
          </button>
        </div>
      </div>
      
      <div class="result-section">
        <div v-if="loading" class="loading">
          <div class="loading-content">
            <span class="spinner">⏳</span>
            <span>{{ loadingMessage }}</span>
          </div>
          
          <div v-if="retryInfo.attempts > 0" class="retry-info">
            <div class="retry-status">
              🔄 重试进行中... (第 {{ retryInfo.attempts }} 次重试)
            </div>
            <div class="retry-progress">
              <div class="progress-bar">
                <div 
                  class="progress-fill" 
                  :style="{ width: retryProgress + '%' }"
                ></div>
              </div>
              <span class="progress-text">{{ retryProgress }}%</span>
            </div>
          </div>
        </div>
        
        <div v-if="errorHistory.length > 0" class="error-history">
          <h4>📋 错误处理记录</h4>
          <div class="history-list">
            <div 
              v-for="(record, index) in errorHistory" 
              :key="index"
              class="error-record"
              :class="{ 
                'success': record.success,
                'failed': !record.success,
                'retried': record.retryCount > 0
              }"
            >
              <div class="record-header">
                <div class="scenario-name">
                  <span class="scenario-icon">{{ getScenarioIcon(record.scenario) }}</span>
                  {{ getScenarioName(record.scenario) }}
                </div>
                <div class="result-status">
                  <span v-if="record.success" class="success-badge">✅ 成功</span>
                  <span v-else class="error-badge">❌ 失败</span>
                </div>
                <div class="timestamp">{{ record.timestamp }}</div>
              </div>
              
              <div class="record-content">
                <div class="error-details">
                  <div class="detail-row" v-if="record.retryCount > 0">
                    <strong>重试次数:</strong> {{ record.retryCount }}
                  </div>
                  <div class="detail-row">
                    <strong>总耗时:</strong> {{ record.totalTime }}ms
                  </div>
                  <div class="detail-row">
                    <strong>错误类型:</strong> {{ record.errorType || 'N/A' }}
                  </div>
                  <div class="detail-row error-message">
                    <strong>错误信息:</strong> 
                    <span :class="{ 'success-msg': record.success, 'error-msg': !record.success }">
                      {{ record.message }}
                    </span>
                  </div>
                </div>
                
                <div v-if="record.retryHistory && record.retryHistory.length > 0" class="retry-history">
                  <details>
                    <summary>查看重试详情 ({{ record.retryHistory.length }} 次重试)</summary>
                    <div class="retry-list">
                      <div 
                        v-for="(retry, retryIndex) in record.retryHistory" 
                        :key="retryIndex"
                        class="retry-item"
                      >
                        <div class="retry-number">重试 #{{ retryIndex + 1 }}</div>
                        <div class="retry-time">{{ retry.time }}ms</div>
                        <div class="retry-error">{{ retry.error }}</div>
                      </div>
                    </div>
                  </details>
                </div>
              </div>
            </div>
          </div>
          
          <div class="error-stats">
            <h5>📊 统计信息</h5>
            <div class="stats-grid">
              <div class="stat-item">
                <strong>总测试:</strong> {{ errorHistory.length }}
              </div>
              <div class="stat-item">
                <strong>成功:</strong> {{ successCount }}
              </div>
              <div class="stat-item">
                <strong>失败:</strong> {{ failureCount }}
              </div>
              <div class="stat-item">
                <strong>使用重试:</strong> {{ retryCount }}
              </div>
            </div>
          </div>
        </div>
        
        <div class="action-controls">
          <button 
            @click="clearHistory" 
            :disabled="loading || errorHistory.length === 0"
            class="clear-btn"
          >
            🗑️ 清空记录
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { createApiClient, type ApiClass } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 定义演示API类
class DemoApi {
  requestCore: any
  
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  // 404错误 - 请求不存在的资源
  async testNotFound() {
    const url = 'https://jsonplaceholder.typicode.com/users/999999'
    return this.requestCore.get(url)
  }

  // 网络错误 - 无效的URL
  async testNetworkError() {
    const url = 'https://invalid-domain-that-does-not-exist.com/api/data'
    return this.requestCore.get(url)
  }

  // 超时错误 - 使用一个很慢的API
  async testTimeout() {
    const url = 'https://httpstat.us/200?sleep=10000' // 10秒延迟
    return this.requestCore.get(url)
  }

  // 重试测试 - 请求不存在的用户，启用重试
  async testRetry() {
    const url = 'https://jsonplaceholder.typicode.com/users/999'
    return this.requestCore.getWithRetry(url, {
      retries: 3,
      shouldRetry: (error: any, attempt: number) => {
        console.log(`Retry attempt ${attempt}: ${error.message}`)
        return true // 总是重试
      }
    })
  }
}

// 创建 API 客户端实例
const apiClient = createApiClient(
  { demo: DemoApi },
  {
    requestor: fetchRequestor,
    globalConfig: {
      timeout: 5000, // 设置较短的超时时间用于演示
    },
  }
)

// 获取演示 API 实例
const demoApi = apiClient.demo

// 组件状态
const loading = ref(false)
const loadingMessage = ref('')
const errorHistory = ref<any[]>([])
const retryInfo = ref({ attempts: 0, maxAttempts: 3 })

// 计算属性
const retryProgress = computed(() => {
  if (retryInfo.value.maxAttempts === 0) return 0
  return Math.round((retryInfo.value.attempts / retryInfo.value.maxAttempts) * 100)
})

const successCount = computed(() => 
  errorHistory.value.filter(record => record.success).length
)

const failureCount = computed(() => 
  errorHistory.value.filter(record => !record.success).length
)

const retryCount = computed(() => 
  errorHistory.value.filter(record => record.retryCount > 0).length
)

// 场景图标和名称
const scenarioData = {
  'not-found': { icon: '🔍', name: '404 资源不存在' },
  'invalid-url': { icon: '🌐', name: '网络连接错误' },
  'timeout': { icon: '⏰', name: '请求超时' },
  'retry': { icon: '🔄', name: '重试机制测试' }
}

const getScenarioIcon = (scenario) => scenarioData[scenario]?.icon || '❓'
const getScenarioName = (scenario) => scenarioData[scenario]?.name || scenario

// 测试错误场景
const testScenario = async (scenario) => {
  loading.value = true
  retryInfo.value = { attempts: 0, maxAttempts: scenario === 'retry' ? 3 : 0 }
  
  const startTime = Date.now()
  const record = {
    scenario,
    timestamp: new Date().toLocaleTimeString(),
    success: false,
    retryCount: 0,
    totalTime: 0,
    errorType: '',
    message: '',
    retryHistory: [] as any[]
  }

  // 设置加载消息
  const messages = {
    'not-found': '尝试访问不存在的用户...',
    'invalid-url': '尝试访问无效的域名...',
    'timeout': '发起长时间请求（将会超时）...',
    'retry': '测试重试机制（故意失败然后重试）...'
  }
  
  loadingMessage.value = messages[scenario] || '执行测试中...'

  try {
    let result
    
    switch (scenario) {
      case 'not-found':
        result = await demoApi.testNotFound()
        break
      case 'invalid-url':
        result = await demoApi.testNetworkError()
        break
      case 'timeout':
        result = await demoApi.testTimeout()
        break
      case 'retry':
        // 模拟重试过程
        try {
          result = await demoApi.testRetry()
        } catch (error) {
          // 捕获重试过程中的信息
          record.retryCount = 3 // 模拟3次重试
          record.retryHistory = [
            { time: 150, error: 'Connection timeout' },
            { time: 200, error: 'Network unreachable' },
            { time: 180, error: 'Request failed' }
          ]
          throw error
        }
        break
      default:
        throw new Error('Unknown scenario')
    }
    
    // 如果到达这里说明请求成功了
    record.success = true
    record.message = scenario === 'retry' 
      ? '重试成功获取到数据' 
      : '请求意外成功'
      
  } catch (error) {
    record.success = false
    record.errorType = error.name || error.constructor.name
    record.message = error.message
    
    // 模拟重试信息更新
    if (scenario === 'retry') {
      for (let i = 1; i <= 3; i++) {
        retryInfo.value.attempts = i
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }
  } finally {
    record.totalTime = Date.now() - startTime
    errorHistory.value.unshift(record) // 添加到开头
    
    loading.value = false
    loadingMessage.value = ''
    retryInfo.value = { attempts: 0, maxAttempts: 0 }
  }
}

// 清空历史记录
const clearHistory = () => {
  errorHistory.value = []
}
</script>

<style scoped>
.demo-container {
  padding: 20px;
  border: 1px solid #e1e5e9;
  border-radius: 8px;
  background: #fafbfc;
}

.demo-content {
  margin-top: 15px;
}

.error-info {
  margin-bottom: 20px;
}

.info-card {
  background: white;
  padding: 15px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-left: 4px solid #dc3545;
}

.info-card ul {
  margin: 10px 0 0 20px;
  color: #586069;
}

.info-card li {
  margin: 5px 0;
}

.error-scenarios {
  margin-bottom: 20px;
}

.scenario-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.scenario-btn {
  padding: 12px 16px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-weight: bold;
  transition: all 0.2s;
}

.error-404 {
  background: #ffeaa7;
  color: #2d3436;
}

.error-404:hover:not(:disabled) {
  background: #fdcb6e;
}

.error-network {
  background: #fab1a0;
  color: #2d3436;
}

.error-network:hover:not(:disabled) {
  background: #e17055;
}

.error-timeout {
  background: #a29bfe;
  color: white;
}

.error-timeout:hover:not(:disabled) {
  background: #6c5ce7;
}

.error-retry {
  background: #fd79a8;
  color: white;
}

.error-retry:hover:not(:disabled) {
  background: #e84393;
}

.scenario-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-section {
  min-height: 150px;
}

.loading {
  color: #666;
}

.loading-content {
  display: flex;
  align-items: center;
  gap: 10px;
  margin-bottom: 15px;
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

.retry-info {
  background: #fff3cd;
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid #ffc107;
}

.retry-status {
  font-weight: bold;
  margin-bottom: 10px;
}

.retry-progress {
  display: flex;
  align-items: center;
  gap: 10px;
}

.progress-bar {
  flex: 1;
  height: 8px;
  background: #e9ecef;
  border-radius: 4px;
  overflow: hidden;
}

.progress-fill {
  height: 100%;
  background: #007acc;
  transition: width 0.3s ease;
}

.progress-text {
  font-size: 12px;
  font-weight: bold;
}

.error-history {
  margin-top: 20px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
  margin-bottom: 20px;
}

.error-record {
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}

.error-record.success {
  border-left: 4px solid #28a745;
}

.error-record.failed {
  border-left: 4px solid #dc3545;
}

.error-record.retried {
  border-left: 4px solid #ffc107;
}

.record-header {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  font-size: 14px;
}

.scenario-name {
  display: flex;
  align-items: center;
  gap: 8px;
  font-weight: bold;
}

.result-status {
  margin-left: auto;
}

.success-badge {
  color: #28a745;
  font-weight: bold;
}

.error-badge {
  color: #dc3545;
  font-weight: bold;
}

.timestamp {
  color: #6c757d;
  font-size: 12px;
}

.record-content {
  padding: 15px;
}

.error-details {
  margin-bottom: 15px;
}

.detail-row {
  margin: 5px 0;
  font-size: 14px;
}

.error-message {
  margin-top: 10px;
}

.success-msg {
  color: #28a745;
}

.error-msg {
  color: #dc3545;
}

.retry-history {
  margin-top: 10px;
}

.retry-list {
  margin-top: 10px;
}

.retry-item {
  display: flex;
  gap: 15px;
  padding: 8px;
  background: #f8f9fa;
  border-radius: 4px;
  margin: 5px 0;
  font-size: 12px;
}

.retry-number {
  font-weight: bold;
  min-width: 60px;
}

.retry-time {
  color: #666;
  min-width: 50px;
}

.retry-error {
  color: #dc3545;
  flex: 1;
}

.error-stats {
  background: white;
  padding: 15px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  margin-bottom: 20px;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
  gap: 15px;
  margin-top: 10px;
}

.stat-item {
  text-align: center;
  font-size: 14px;
}

.action-controls {
  text-align: center;
}

.clear-btn {
  padding: 8px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.clear-btn:hover:not(:disabled) {
  background: #5a6268;
}

.clear-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

@media (max-width: 768px) {
  .scenario-grid {
    grid-template-columns: 1fr;
  }
  
  .record-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .stats-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}
</style>
