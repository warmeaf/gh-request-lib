<template>
  <div class="demo-container">
    <h3>💾 缓存功能演示 - 智能缓存管理</h3>
    <div class="demo-content">
      <div class="cache-info">
        <div class="info-card">
          <h4>🔍 缓存机制说明</h4>
          <ul>
            <li>首次请求：从服务器获取数据（较慢）</li>
            <li>后续请求：从缓存中获取数据（极快）</li>
            <li>缓存TTL：30秒（可配置）</li>
            <li>支持主动清除缓存</li>
          </ul>
        </div>
      </div>

      <div class="controls">
        <button 
          @click="fetchUsers" 
          :disabled="loading"
          class="fetch-btn"
        >
          {{ loading ? '获取中...' : '📋 获取用户列表' }}
        </button>
        
        <button 
          @click="clearCache" 
          :disabled="loading"
          class="clear-btn"
        >
          🗑️ 清除缓存
        </button>
        
        <button 
          @click="clearResults" 
          class="reset-btn"
        >
          📝 清空结果
        </button>
      </div>
      
      <div class="result-section">
        <div v-if="loading" class="loading">
          ⏳ {{ loadingMessage }}
        </div>
        
        <div v-if="error" class="error">
          ❌ {{ error }}
        </div>
        
        <div v-if="requestHistory.length > 0" class="history-section">
          <h4>📊 请求历史记录</h4>
          <div class="history-list">
            <div 
              v-for="(record, index) in requestHistory" 
              :key="index"
              class="history-item"
              :class="{ 'cached': record.fromCache }"
            >
              <div class="history-header">
                <div class="request-number">请求 #{{ index + 1 }}</div>
                <div class="cache-status">
                  <span v-if="record.fromCache" class="cache-hit">💾 命中缓存</span>
                  <span v-else class="cache-miss">🌐 网络请求</span>
                </div>
                <div class="response-time">{{ record.responseTime }}ms</div>
                <div class="timestamp">{{ record.timestamp }}</div>
              </div>
              
              <div class="history-content">
                <div class="performance-info">
                  <div class="perf-item">
                    <strong>响应时间:</strong> 
                    <span :class="record.fromCache ? 'fast' : 'slow'">
                      {{ record.responseTime }}ms
                    </span>
                  </div>
                  <div class="perf-item">
                    <strong>数据源:</strong> 
                    {{ record.fromCache ? '本地缓存' : 'JSONPlaceholder API' }}
                  </div>
                  <div class="perf-item">
                    <strong>用户数量:</strong> {{ record.userCount }}
                  </div>
                </div>
                
                <div class="sample-users">
                  <strong>前3个用户:</strong>
                  <div class="user-list">
                    <div 
                      v-for="user in record.sampleUsers" 
                      :key="user.id"
                      class="user-item"
                    >
                      <span class="user-name">{{ user.name }}</span>
                      <span class="user-email">{{ user.email }}</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
          
          <div v-if="requestHistory.length > 1" class="performance-summary">
            <h5>⚡ 缓存性能分析</h5>
            <div class="summary-stats">
              <div class="stat-item">
                <strong>总请求数:</strong> {{ requestHistory.length }}
              </div>
              <div class="stat-item">
                <strong>缓存命中:</strong> {{ cacheHits }}
              </div>
              <div class="stat-item">
                <strong>网络请求:</strong> {{ networkRequests }}
              </div>
              <div class="stat-item">
                <strong>平均响应时间:</strong> {{ averageResponseTime }}ms
              </div>
              <div class="stat-item performance-gain" v-if="performanceGain > 0">
                <strong>性能提升:</strong> 
                <span class="gain">{{ performanceGain.toFixed(1) }}倍</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { createApiClient, type ApiClass } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 定义用户API类
class UserApi {
  requestCore: any
  
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getUserList() {
    const url = 'https://jsonplaceholder.typicode.com/users'
    // 使用缓存，TTL 30秒
    return this.requestCore.getWithCache(url, { ttl: 30 * 1000 })
  }
}

// 创建 API 客户端实例
const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: fetchRequestor,
    globalConfig: {
      timeout: 10000,
    },
  }
)

// 获取用户 API 实例
const userApi = apiClient.user

// 组件状态
const loading = ref(false)
const error = ref('')
const loadingMessage = ref('')
const requestHistory = ref<any[]>([])

// 计算属性
const cacheHits = computed(() => 
  requestHistory.value.filter(record => record.fromCache).length
)

const networkRequests = computed(() => 
  requestHistory.value.filter(record => !record.fromCache).length
)

const averageResponseTime = computed(() => {
  if (requestHistory.value.length === 0) return 0
  const total = requestHistory.value.reduce((sum, record) => sum + record.responseTime, 0)
  return Math.round(total / requestHistory.value.length)
})

const performanceGain = computed(() => {
  const networkTimes = requestHistory.value
    .filter(record => !record.fromCache)
    .map(record => record.responseTime)
  const cacheTimes = requestHistory.value
    .filter(record => record.fromCache)
    .map(record => record.responseTime)
  
  if (networkTimes.length === 0 || cacheTimes.length === 0) return 0
  
  const avgNetworkTime = networkTimes.reduce((sum, time) => sum + time, 0) / networkTimes.length
  const avgCacheTime = cacheTimes.reduce((sum, time) => sum + time, 0) / cacheTimes.length
  
  return avgNetworkTime / avgCacheTime
})

// 获取用户列表
const fetchUsers = async () => {
  loading.value = true
  error.value = ''
  
  const startTime = Date.now()
  const isFirstRequest = requestHistory.value.length === 0
  
  loadingMessage.value = isFirstRequest 
    ? '首次请求，从服务器获取数据...' 
    : '检查缓存中，可能从缓存获取数据...'

  try {
    const users = await userApi.getUserList()
    const responseTime = Date.now() - startTime
    const timestamp = new Date().toLocaleTimeString()
    
    // 简单判断是否来自缓存（响应时间很短通常来自缓存）
    const fromCache = responseTime < 100 && requestHistory.value.length > 0
    
    // 记录请求历史
    const record = {
      timestamp,
      responseTime,
      fromCache,
      userCount: users.length,
      sampleUsers: users.slice(0, 3).map(user => ({
        id: user.id,
        name: user.name,
        email: user.email
      }))
    }
    
    requestHistory.value.push(record)
    
  } catch (err) {
    error.value = `请求失败: ${err.message}`
  } finally {
    loading.value = false
    loadingMessage.value = ''
  }
}

// 清除缓存
const clearCache = () => {
  apiClient.clearCache()
  // 添加一个清除缓存的记录
  requestHistory.value.push({
    timestamp: new Date().toLocaleTimeString(),
    responseTime: 0,
    fromCache: false,
    userCount: 0,
    sampleUsers: [],
    isCacheClear: true
  })
}

// 清空结果
const clearResults = () => {
  requestHistory.value = []
  error.value = ''
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

.cache-info {
  margin-bottom: 20px;
}

.info-card {
  background: white;
  padding: 15px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-left: 4px solid #007acc;
}

.info-card ul {
  margin: 10px 0 0 20px;
  color: #586069;
}

.info-card li {
  margin: 5px 0;
}

.controls {
  display: flex;
  gap: 10px;
  margin-bottom: 20px;
  flex-wrap: wrap;
}

.fetch-btn {
  padding: 10px 16px;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.fetch-btn:hover:not(:disabled) {
  background: #005a9e;
}

.clear-btn {
  padding: 10px 16px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.clear-btn:hover:not(:disabled) {
  background: #c82333;
}

.reset-btn {
  padding: 10px 16px;
  background: #6c757d;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.reset-btn:hover {
  background: #5a6268;
}

button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.result-section {
  min-height: 100px;
}

.loading {
  color: #666;
  font-style: italic;
}

.error {
  color: #d73a49;
  padding: 10px;
  background: #ffeef0;
  border-left: 4px solid #d73a49;
  border-radius: 4px;
}

.history-section {
  margin-top: 20px;
}

.history-list {
  display: flex;
  flex-direction: column;
  gap: 15px;
}

.history-item {
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  overflow: hidden;
}

.history-item.cached {
  border-left: 4px solid #28a745;
}

.history-item:not(.cached) {
  border-left: 4px solid #007acc;
}

.history-header {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 10px 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #e9ecef;
  font-size: 14px;
}

.request-number {
  font-weight: bold;
  color: #495057;
}

.cache-hit {
  color: #28a745;
  font-weight: bold;
}

.cache-miss {
  color: #007acc;
  font-weight: bold;
}

.response-time {
  margin-left: auto;
  font-weight: bold;
}

.timestamp {
  color: #6c757d;
  font-size: 12px;
}

.history-content {
  padding: 15px;
}

.performance-info {
  margin-bottom: 15px;
}

.perf-item {
  margin: 5px 0;
  font-size: 14px;
}

.fast {
  color: #28a745;
  font-weight: bold;
}

.slow {
  color: #007acc;
}

.sample-users {
  font-size: 14px;
}

.user-list {
  margin-top: 8px;
}

.user-item {
  display: flex;
  gap: 10px;
  padding: 5px 0;
  border-bottom: 1px solid #f1f3f4;
}

.user-item:last-child {
  border-bottom: none;
}

.user-name {
  font-weight: bold;
  color: #24292e;
  min-width: 120px;
}

.user-email {
  color: #586069;
  font-size: 12px;
}

.performance-summary {
  margin-top: 20px;
  background: white;
  padding: 15px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-left: 4px solid #28a745;
}

.summary-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 10px;
  margin-top: 10px;
}

.stat-item {
  font-size: 14px;
}

.performance-gain {
  grid-column: 1 / -1;
  text-align: center;
  font-size: 16px;
  padding: 10px;
  background: #d4edda;
  border-radius: 4px;
}

.gain {
  color: #155724;
  font-weight: bold;
  font-size: 18px;
}

@media (max-width: 768px) {
  .controls {
    flex-direction: column;
  }
  
  .controls button {
    width: 100%;
  }
  
  .history-header {
    flex-direction: column;
    align-items: flex-start;
    gap: 5px;
  }
  
  .summary-stats {
    grid-template-columns: 1fr;
  }
}
</style>
