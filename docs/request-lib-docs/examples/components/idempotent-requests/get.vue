<template>
  <div class="demo-container">
    <h3>📊 GET幂等请求演示 - 防重复查询</h3>
    <div class="demo-content">
      <div class="info-section">
        <div class="info-card">
          <h4>💡 演示说明</h4>
          <p>快速多次点击查询按钮测试新的请求去重机制：</p>
          <ul class="demo-features">
            <li><strong>缓存命中</strong>：已完成的请求直接返回缓存结果 (&lt;30ms)</li>
            <li><strong>请求去重</strong>：正在进行的请求会等待完成 (30-100ms)</li>
            <li><strong>新网络请求</strong>：首次或过期后的网络请求 (&gt;100ms)</li>
          </ul>
          <div class="protection-info">
            <span class="protection-badge">保护期: {{ ttl / 1000 }}秒</span>
            <span class="cache-info">缓存策略: 智能去重</span>
          </div>
        </div>
      </div>

      <div class="query-section">
        <div class="query-controls">
          <div class="input-group">
            <label>用户ID:</label>
            <input 
              v-model="userId" 
              type="number" 
              placeholder="1-10" 
              min="1" 
              max="10"
              class="user-input"
            />
          </div>
          <div class="button-group">
            <button 
              @click="fetchUserNormal" 
              :disabled="!isValidUserId"
              class="query-btn normal"
            >
              🚀 普通查询
            </button>
            <button 
              @click="fetchUserIdempotent" 
              :disabled="!isValidUserId"
              class="query-btn idempotent"
            >
              🔒 幂等查询 (推荐快速点击测试)
            </button>
          </div>
        </div>

        <div v-if="currentUser" class="user-display">
          <div class="user-card">
            <div class="user-avatar">👤</div>
            <div class="user-info">
              <h4>{{ currentUser.name }}</h4>
              <div><strong>Email:</strong> {{ currentUser.email }}</div>
              <div><strong>Phone:</strong> {{ currentUser.phone }}</div>
              <div><strong>Company:</strong> {{ currentUser.company?.name }}</div>
            </div>
            <div class="cache-indicator">
              <span :class="['cache-badge', lastRequestCached ? 'cached' : 'fresh']">
                {{ lastRequestCached ? '📋 缓存结果' : '🌐 网络请求' }}
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- 请求时间线 -->
      <div class="timeline-section">
        <h4>⏰ 请求时间线 <button @click="clearTimeline" class="clear-btn">清空</button></h4>
        <div class="timeline-container">
          <div 
            v-for="event in timeline" 
            :key="event.id"
            :class="['timeline-item', event.type]"
          >
            <div class="timeline-marker"></div>
            <div class="timeline-content">
              <div class="timeline-header">
                <span class="timeline-time">{{ event.time }}</span>
                <span :class="['timeline-status', event.status]">{{ event.statusText }}</span>
                <span class="timeline-type">{{ event.requestType }}</span>
              </div>
              <div class="timeline-message">{{ event.message }}</div>
              <div class="timeline-meta">
                <span>响应时间: {{ event.duration }}ms</span>
                <span v-if="event.cached" class="cached-flag">💾 缓存命中</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 详细统计信息 -->
      <div class="performance-section">
        <h4>📈 幂等请求统计详情</h4>
        <div class="stats-grid-detailed">
          <div class="stat-card-detailed total">
            <div class="stat-icon">📊</div>
            <div class="stat-info">
              <div class="stat-value">{{ realIdempotentStats.totalRequests }}</div>
              <div class="stat-label">总请求数</div>
            </div>
          </div>
          <div class="stat-card-detailed network">
            <div class="stat-icon">🌐</div>
            <div class="stat-info">
              <div class="stat-value">{{ realIdempotentStats.actualNetworkRequests }}</div>
              <div class="stat-label">网络请求</div>
            </div>
          </div>
          <div class="stat-card-detailed cache">
            <div class="stat-icon">💾</div>
            <div class="stat-info">
              <div class="stat-value">{{ realIdempotentStats.cacheHits }}</div>
              <div class="stat-label">缓存命中</div>
            </div>
          </div>
          <div class="stat-card-detailed pending">
            <div class="stat-icon">🔄</div>
            <div class="stat-info">
              <div class="stat-value">{{ realIdempotentStats.pendingRequestsReused }}</div>
              <div class="stat-label">请求复用</div>
            </div>
          </div>
          <div class="stat-card-detailed blocked">
            <div class="stat-icon">🚫</div>
            <div class="stat-info">
              <div class="stat-value">{{ realIdempotentStats.duplicatesBlocked }}</div>
              <div class="stat-label">重复拦截</div>
            </div>
          </div>
          <div class="stat-card-detailed rate">
            <div class="stat-icon">📈</div>
            <div class="stat-info">
              <div class="stat-value">{{ realIdempotentStats.duplicateRate.toFixed(1) }}%</div>
              <div class="stat-label">拦截率</div>
            </div>
          </div>
          <div class="stat-card-detailed time">
            <div class="stat-icon">⏱️</div>
            <div class="stat-info">
              <div class="stat-value">{{ realIdempotentStats.avgResponseTime.toFixed(0) }}ms</div>
              <div class="stat-label">平均响应时间</div>
            </div>
          </div>
          <div class="stat-card-detailed keytime">
            <div class="stat-icon">🔑</div>
            <div class="stat-info">
              <div class="stat-value">{{ realIdempotentStats.keyGenerationTime.toFixed(1) }}ms</div>
              <div class="stat-label">键生成时间</div>
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

// 定义用户API类 - 支持幂等请求
class UserApi {
  requestCore: any
  
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  // 普通 GET 请求
  async getUser(userId: string) {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`
    return this.requestCore.get(url)
  }

  // 幂等 GET 请求
  async getUserIdempotent(userId: string) {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`
    return this.requestCore.getIdempotent(url, {}, {
      ttl: 8000, // 8秒幂等保护期
      includeHeaders: ['accept'],
      onDuplicate: (original: any, duplicate: any) => {
        console.log('🔄 Duplicate query blocked:', duplicate.url)
      }
    })
  }

  // 获取幂等统计信息
  getIdempotentStats() {
    return this.requestCore.getIdempotentStats ? this.requestCore.getIdempotentStats() : {
      totalRequests: 0,
      duplicatesBlocked: 0,
      pendingRequestsReused: 0,
      cacheHits: 0,
      actualNetworkRequests: 0,
      duplicateRate: 0,
      avgResponseTime: 0,
      keyGenerationTime: 0
    }
  }
}

// 创建 API 客户端实例
const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: fetchRequestor,
    globalConfig: {
      timeout: 10000,
      debug: true,
    },
  }
)

const userApi = apiClient.user

// 组件状态
const ttl = ref(8000) // 8秒保护期
const userId = ref(1)
const currentUser = ref<any>(null)
const lastRequestCached = ref(false)
const timeline = ref<Array<any>>([])
let timelineId = 0

// 统计信息
const normalStats = ref({
  count: 0,
  totalTime: 0,
  avgTime: 0
})

const idempotentStats = ref({
  count: 0,
  cacheHits: 0,
  totalTime: 0,
  avgTime: 0,
  hitRate: 0
})

// 真实的幂等统计信息
const realIdempotentStats = ref({
  totalRequests: 0,
  duplicatesBlocked: 0,
  pendingRequestsReused: 0,
  cacheHits: 0,
  actualNetworkRequests: 0,
  duplicateRate: 0,
  avgResponseTime: 0,
  keyGenerationTime: 0
})

// 验证用户ID
const isValidUserId = computed(() => {
  return userId.value && userId.value >= 1 && userId.value <= 10
})

// 添加时间线事件
const addTimelineEvent = (type: string, status: string, statusText: string, message: string, requestType: string, duration: number, cached = false) => {
  timeline.value.unshift({
    id: ++timelineId,
    type,
    status,
    statusText,
    message,
    requestType,
    duration,
    cached,
    time: new Date().toLocaleTimeString()
  })

  // 限制事件数量
  if (timeline.value.length > 15) {
    timeline.value.pop()
  }
}

// 普通查询
const fetchUserNormal = async () => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substr(2, 9)
  
  addTimelineEvent('info', 'pending', 'PENDING', `开始普通查询 User ${userId.value} [${requestId}]`, '普通请求', 0)

  try {
    const user = await userApi.getUser(userId.value.toString())
    const duration = Date.now() - startTime
    
    currentUser.value = user
    lastRequestCached.value = false
    
    // 更新统计
    normalStats.value.count++
    normalStats.value.totalTime += duration
    normalStats.value.avgTime = normalStats.value.totalTime / normalStats.value.count
    
    addTimelineEvent('success', 'success', 'SUCCESS', `✅ 普通查询成功 [${requestId}] - ${user.name}`, '普通请求', duration)
    
  } catch (error) {
    const duration = Date.now() - startTime
    addTimelineEvent('error', 'error', 'ERROR', `❌ 普通查询失败 [${requestId}]: ${error.message}`, '普通请求', duration)
  }
}

// 幂等查询
const fetchUserIdempotent = async () => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substr(2, 9)
  
  addTimelineEvent('info', 'pending', 'PENDING', `开始幂等查询 User ${userId.value} [${requestId}]`, '幂等请求', 0)

  try {
    const user = await userApi.getUserIdempotent(userId.value.toString())
    const duration = Date.now() - startTime
    
    currentUser.value = user
    
    // 获取真实的统计信息
    const realStats = userApi.getIdempotentStats()
    realIdempotentStats.value = { ...realStats }
    
    // 判断是否是不同类型的响应（基于响应时间）
    const isCacheHit = duration < 30        // 极短响应时间 - 缓存命中
    const isPendingReuse = duration >= 30 && duration < 100  // 中等响应时间 - 等待pending请求
    const isNetworkRequest = duration >= 100 // 长响应时间 - 新的网络请求
    
    if (isCacheHit) {
      lastRequestCached.value = true
      addTimelineEvent('warning', 'cached', 'CACHED', `💾 缓存命中 [${requestId}] - 瞬间返回 ${user.name}`, '幂等请求', duration, true)
    } else if (isPendingReuse) {
      lastRequestCached.value = false
      addTimelineEvent('warning', 'pending', 'PENDING', `🔄 等待进行中请求 [${requestId}] - 复用结果 ${user.name}`, '幂等请求', duration, true)
    } else {
      lastRequestCached.value = false
      addTimelineEvent('success', 'success', 'SUCCESS', `🌐 新网络请求 [${requestId}] - ${user.name}`, '幂等请求', duration)
    }
    
    // 更新本地统计（用于兼容性展示）
    idempotentStats.value.count++
    idempotentStats.value.totalTime += duration
    idempotentStats.value.avgTime = idempotentStats.value.totalTime / idempotentStats.value.count
    
    if (isCacheHit || isPendingReuse) {
      idempotentStats.value.cacheHits++
    }
    
    idempotentStats.value.hitRate = (idempotentStats.value.cacheHits / idempotentStats.value.count) * 100
    
  } catch (error) {
    const duration = Date.now() - startTime
    
    // 即使失败也更新真实统计
    const realStats = userApi.getIdempotentStats()
    realIdempotentStats.value = { ...realStats }
    
    // 更新本地统计
    idempotentStats.value.count++
    idempotentStats.value.totalTime += duration
    idempotentStats.value.avgTime = idempotentStats.value.totalTime / idempotentStats.value.count
    
    addTimelineEvent('error', 'error', 'ERROR', `❌ 幂等查询失败 [${requestId}]: ${error.message}`, '幂等请求', duration)
  }
}

// 清空时间线
const clearTimeline = () => {
  timeline.value = []
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

.info-section {
  margin-bottom: 20px;
}

.info-card {
  background: #f0f8ff;
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid #0366d6;
}

.info-card h4 {
  margin: 0 0 10px 0;
  color: #0366d6;
}

.info-card p {
  margin: 0 0 10px 0;
  color: #24292e;
}

.protection-info {
  display: flex;
  gap: 15px;
  align-items: center;
}

.protection-badge {
  background: #28a745;
  color: white;
  padding: 4px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: bold;
}

.cache-info {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.query-section {
  background: white;
  padding: 20px;
  border-radius: 6px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.query-controls {
  display: flex;
  gap: 20px;
  align-items: end;
  margin-bottom: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
}

.input-group label {
  margin-bottom: 5px;
  font-weight: bold;
  color: #24292e;
  font-size: 14px;
}

.user-input {
  padding: 8px 12px;
  border: 1px solid #d1d9e0;
  border-radius: 4px;
  width: 100px;
}

.button-group {
  display: flex;
  gap: 10px;
}

.query-btn {
  padding: 10px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: background-color 0.2s;
}

.query-btn.normal {
  background: #28a745;
  color: white;
}

.query-btn.normal:hover:not(:disabled) {
  background: #218838;
}

.query-btn.idempotent {
  background: #007acc;
  color: white;
}

.query-btn.idempotent:hover:not(:disabled) {
  background: #005a9e;
}

.query-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.user-display {
  border-top: 1px solid #e1e5e9;
  padding-top: 20px;
}

.user-card {
  display: flex;
  gap: 15px;
  align-items: center;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 4px solid #007acc;
}

.user-avatar {
  font-size: 48px;
}

.user-info {
  flex: 1;
}

.user-info h4 {
  margin: 0 0 8px 0;
  color: #24292e;
}

.user-info > div {
  margin: 4px 0;
  font-size: 14px;
  color: #586069;
}

.cache-indicator {
  text-align: center;
}

.cache-badge {
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
}

.cache-badge.fresh {
  background: #28a745;
  color: white;
}

.cache-badge.cached {
  background: #ffc107;
  color: #212529;
}

.timeline-section {
  background: white;
  padding: 20px;
  border-radius: 6px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.timeline-section h4 {
  margin: 0 0 15px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.clear-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
}

.clear-btn:hover {
  background: #c82333;
}

.timeline-container {
  max-height: 400px;
  overflow-y: auto;
  position: relative;
  padding-left: 20px;
}

.timeline-container::before {
  content: '';
  position: absolute;
  left: 8px;
  top: 0;
  bottom: 0;
  width: 2px;
  background: #e1e5e9;
}

.timeline-item {
  position: relative;
  margin-bottom: 20px;
  padding: 12px;
  background: #f8f9fa;
  border-radius: 6px;
  border-left: 3px solid transparent;
}

.timeline-item.success { border-left-color: #28a745; }
.timeline-item.warning { border-left-color: #ffc107; }
.timeline-item.error { border-left-color: #dc3545; }
.timeline-item.info { border-left-color: #007acc; }

.timeline-marker {
  position: absolute;
  left: -26px;
  top: 15px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: currentColor;
}

.timeline-marker::before {
  content: '';
  position: absolute;
  top: 50%;
  left: 50%;
  width: 6px;
  height: 6px;
  background: white;
  border-radius: 50%;
  transform: translate(-50%, -50%);
}

.timeline-header {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 5px;
}

.timeline-time {
  font-family: monospace;
  font-size: 11px;
  color: #666;
}

.timeline-status {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
}

.timeline-status.success { background: #28a745; color: white; }
.timeline-status.cached { background: #ffc107; color: #212529; }
.timeline-status.error { background: #dc3545; color: white; }
.timeline-status.pending { background: #007acc; color: white; }

.timeline-type {
  font-size: 11px;
  color: #666;
  font-style: italic;
}

.timeline-message {
  color: #24292e;
  line-height: 1.4;
  font-size: 13px;
}

.timeline-meta {
  display: flex;
  gap: 15px;
  margin-top: 5px;
  font-size: 11px;
  color: #666;
}

.cached-flag {
  color: #f57c00;
  font-weight: bold;
}

.performance-section {
  background: white;
  padding: 20px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.performance-section h4 {
  margin: 0 0 15px 0;
}

.performance-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.performance-card {
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid;
}

.performance-card.normal {
  background: #f0fff4;
  border-left-color: #28a745;
}

.performance-card.idempotent {
  background: #f0f8ff;
  border-left-color: #007acc;
}

.performance-card h5 {
  margin: 0 0 10px 0;
  color: #24292e;
}

.metric {
  display: flex;
  justify-content: space-between;
  margin: 8px 0;
  font-size: 14px;
}

.metric-label {
  color: #586069;
}

.metric-value {
  font-weight: bold;
  color: #24292e;
}

.demo-features {
  margin: 10px 0;
  padding-left: 20px;
}

.demo-features li {
  margin: 5px 0;
  font-size: 14px;
  color: #24292e;
}

.stats-grid-detailed {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  gap: 15px;
}

.stat-card-detailed {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  border-left: 4px solid;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card-detailed:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 15px rgba(0,0,0,0.1);
}

.stat-card-detailed.total { border-left-color: #6c757d; }
.stat-card-detailed.network { border-left-color: #007acc; }
.stat-card-detailed.cache { border-left-color: #28a745; }
.stat-card-detailed.pending { border-left-color: #ffc107; }
.stat-card-detailed.blocked { border-left-color: #dc3545; }
.stat-card-detailed.rate { border-left-color: #6f42c1; }
.stat-card-detailed.time { border-left-color: #fd7e14; }
.stat-card-detailed.keytime { border-left-color: #20c997; }

.stat-icon {
  font-size: 24px;
  opacity: 0.8;
}

.stat-info {
  flex: 1;
}

.stat-info .stat-value {
  font-size: 20px;
  font-weight: bold;
  color: #24292e;
  margin-bottom: 4px;
}

.stat-info .stat-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}
</style>
