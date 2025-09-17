<template>
  <div class="demo-container">
    <h3>🔒 POST幂等请求演示 - 防重复提交</h3>
    <div class="demo-content">
      <div class="info-section">
        <div class="info-card">
          <h4>💡 演示说明</h4>
          <p>快速多次点击提交按钮测试新的请求去重机制：</p>
          <ul class="demo-features">
            <li><strong>缓存命中</strong>：已完成的请求直接返回缓存结果</li>
            <li><strong>请求去重</strong>：正在进行的请求会等待完成，避免重复网络请求</li>
            <li><strong>统计详细</strong>：区分缓存命中、请求复用、实际网络请求</li>
          </ul>
          <div class="protection-info">
            <span class="protection-badge">保护期: {{ ttl / 1000 }}秒</span>
            <span class="key-info">幂等键: 基于表单内容自动生成</span>
          </div>
        </div>
      </div>

      <div class="form-section">
        <div class="form-group">
          <label>用户ID:</label>
          <select v-model="formData.userId" class="form-control">
            <option value="1">用户 1</option>
            <option value="2">用户 2</option>
            <option value="3">用户 3</option>
          </select>
        </div>
        
        <div class="form-group">
          <label>文章标题:</label>
          <input 
            v-model="formData.title" 
            type="text" 
            placeholder="请输入文章标题" 
            class="form-control"
          />
        </div>
        
        <div class="form-group">
          <label>文章内容:</label>
          <textarea 
            v-model="formData.body" 
            placeholder="请输入文章内容..."
            rows="4"
            class="form-control textarea"
          ></textarea>
        </div>
        
        <div class="button-group">
          <button 
            @click="submitForm" 
            :disabled="!isFormValid"
            class="submit-btn normal"
          >
            🚀 普通提交
          </button>
          <button 
            @click="submitIdempotent" 
            :disabled="!isFormValid"
            class="submit-btn idempotent"
          >
            🔒 幂等提交 (推荐快速点击测试)
          </button>
        </div>
      </div>

      <!-- 请求日志 -->
      <div class="logs-section">
        <h4>📋 请求日志 <button @click="clearLogs" class="clear-btn">清空</button></h4>
        <div class="logs-container">
          <div 
            v-for="log in logs" 
            :key="log.id"
            :class="['log-item', log.type]"
          >
            <div class="log-header">
              <span class="log-time">{{ log.time }}</span>
              <span :class="['log-status', log.status]">{{ log.status }}</span>
              <span class="log-type">{{ log.requestType }}</span>
            </div>
            <div class="log-content">{{ log.message }}</div>
            <div v-if="log.duration" class="log-meta">
              响应时间: {{ log.duration }}ms
            </div>
          </div>
        </div>
      </div>

      <!-- 统计信息 -->
      <div class="stats-section">
        <h4>📊 详细统计信息</h4>
        <div class="stats-grid">
          <div class="stat-card total">
            <div class="stat-value">{{ stats.totalRequests }}</div>
            <div class="stat-label">总请求数</div>
          </div>
          <div class="stat-card network">
            <div class="stat-value">{{ stats.actualNetworkRequests }}</div>
            <div class="stat-label">实际网络请求</div>
          </div>
          <div class="stat-card cache">
            <div class="stat-value">{{ stats.cacheHits }}</div>
            <div class="stat-label">缓存命中</div>
          </div>
          <div class="stat-card pending">
            <div class="stat-value">{{ stats.pendingRequestsReused }}</div>
            <div class="stat-label">请求复用</div>
          </div>
          <div class="stat-card blocked">
            <div class="stat-value">{{ stats.duplicatesBlocked }}</div>
            <div class="stat-label">重复拦截</div>
          </div>
          <div class="stat-card rate">
            <div class="stat-value">{{ stats.duplicateRate.toFixed(1) }}%</div>
            <div class="stat-label">拦截率</div>
          </div>
          <div class="stat-card time">
            <div class="stat-value">{{ stats.avgResponseTime.toFixed(0) }}ms</div>
            <div class="stat-label">平均响应时间</div>
          </div>
          <div class="stat-card keytime">
            <div class="stat-value">{{ stats.keyGenerationTime.toFixed(1) }}ms</div>
            <div class="stat-label">键生成时间</div>
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

// 定义文章API类 - 支持幂等请求
class PostApi {
  requestCore: any
  
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  // 普通 POST 请求
  async createPost(postData: any) {
    const url = 'https://jsonplaceholder.typicode.com/posts'
    return this.requestCore.post(url, postData)
  }

  // 幂等 POST 请求
  async createPostIdempotent(postData: any, config = {}) {
    const url = 'https://jsonplaceholder.typicode.com/posts'
    return this.requestCore.postIdempotent(url, postData, config, {
      ttl: 5000, // 5秒幂等保护期
      includeHeaders: ['content-type'],
      onDuplicate: (original: any, duplicate: any) => {
        console.log('🚫 Duplicate request blocked:', duplicate.url)
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
  { post: PostApi },
  {
    requestor: fetchRequestor,
    globalConfig: {
      timeout: 10000,
      debug: true,
    },
  }
)

const postApi = apiClient.post

// 组件状态
const ttl = ref(5000) // 5秒保护期
const formData = ref({
  userId: '1',
  title: '测试文章标题',
  body: '这是一个用于测试幂等请求的文章内容。快速点击幂等提交按钮可以观察防重复提交效果。'
})

const logs = ref<Array<any>>([])
let logId = 0

// 统计信息
const stats = ref({
  totalRequests: 0,
  duplicatesBlocked: 0,
  pendingRequestsReused: 0,
  cacheHits: 0,
  actualNetworkRequests: 0,
  duplicateRate: 0,
  avgResponseTime: 0,
  keyGenerationTime: 0
})

// 表单验证
const isFormValid = computed(() => {
  return formData.value.title.trim() && formData.value.body.trim()
})

// 添加日志的方法
const addLog = (type: string, status: string, message: string, requestType: string, duration?: number) => {
  logs.value.unshift({
    id: ++logId,
    type,
    status,
    message,
    requestType,
    duration,
    time: new Date().toLocaleTimeString()
  })

  // 限制日志数量
  if (logs.value.length > 20) {
    logs.value.pop()
  }
}

// 普通提交
const submitForm = async () => {
  const startTime = Date.now()
  
  addLog('info', 'pending', '发送普通POST请求...', '普通请求')

  try {
    const result = await postApi.createPost({
      userId: parseInt(formData.value.userId),
      title: formData.value.title,
      body: formData.value.body
    })
    
    const duration = Date.now() - startTime
    addLog('success', 'success', `普通请求成功 - ID: ${result.id}`, '普通请求', duration)
    
    // 更新统计
    stats.value.totalRequests++
    updateAvgResponseTime(duration)
    
  } catch (error) {
    const duration = Date.now() - startTime
    addLog('error', 'error', `普通请求失败: ${error.message}`, '普通请求', duration)
  }
}

// 幂等提交
const submitIdempotent = async () => {
  const startTime = Date.now()
  const requestId = Math.random().toString(36).substr(2, 9)
  
  addLog('info', 'pending', `发送幂等POST请求... [${requestId}]`, '幂等请求')

  try {
    const result = await postApi.createPostIdempotent({
      userId: parseInt(formData.value.userId),
      title: formData.value.title,
      body: formData.value.body
    })
    
    const duration = Date.now() - startTime
    
    // 获取真实的统计信息
    const realStats = postApi.getIdempotentStats()
    stats.value = { ...realStats }
    
    // 判断是否是重复请求（通过响应时间和统计信息）
    const isDuplicate = duration < 100 // 响应时间很短
    const isCacheHit = duration < 30    // 极短的响应时间，可能是缓存命中
    const isPendingReuse = duration < 100 && duration >= 30 // 中等响应时间，可能是等待pending请求
    
    if (isCacheHit) {
      addLog('warning', 'cached', `💾 缓存命中 [${requestId}] - 返回缓存结果 ID: ${result.id}`, '幂等请求', duration)
    } else if (isPendingReuse) {
      addLog('warning', 'pending', `🔄 等待进行中请求 [${requestId}] - ID: ${result.id}`, '幂等请求', duration)
    } else {
      addLog('success', 'success', `✅ 新请求成功 [${requestId}] - ID: ${result.id}`, '幂等请求', duration)
    }
    
  } catch (error) {
    const duration = Date.now() - startTime
    addLog('error', 'error', `❌ 幂等请求失败 [${requestId}]: ${error.message}`, '幂等请求', duration)
    
    // 即使失败也更新统计
    const realStats = postApi.getIdempotentStats()
    stats.value = { ...realStats }
  }
}

// 更新平均响应时间
const updateAvgResponseTime = (responseTime: number) => {
  const totalResponseTime = stats.value.avgResponseTime * (stats.value.totalRequests - 1)
  stats.value.avgResponseTime = (totalResponseTime + responseTime) / stats.value.totalRequests
}

// 清空日志
const clearLogs = () => {
  logs.value = []
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

.key-info {
  font-size: 12px;
  color: #666;
  font-style: italic;
}

.form-section {
  background: white;
  padding: 20px;
  border-radius: 6px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #24292e;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d9e0;
  border-radius: 4px;
  font-size: 14px;
}

.textarea {
  resize: vertical;
  font-family: inherit;
}

.button-group {
  display: flex;
  gap: 15px;
}

.submit-btn {
  padding: 10px 20px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
  transition: background-color 0.2s;
}

.submit-btn.normal {
  background: #28a745;
  color: white;
}

.submit-btn.normal:hover:not(:disabled) {
  background: #218838;
}

.submit-btn.idempotent {
  background: #007acc;
  color: white;
}

.submit-btn.idempotent:hover:not(:disabled) {
  background: #005a9e;
}

.submit-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.logs-section {
  background: white;
  padding: 20px;
  border-radius: 6px;
  margin-bottom: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.logs-section h4 {
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

.logs-container {
  max-height: 300px;
  overflow-y: auto;
  border: 1px solid #e1e5e9;
  border-radius: 4px;
}

.log-item {
  padding: 10px;
  border-bottom: 1px solid #e1e5e9;
  font-size: 13px;
}

.log-item:last-child {
  border-bottom: none;
}

.log-item.success {
  background: #f0fff4;
}

.log-item.warning {
  background: #fffbf0;
}

.log-item.error {
  background: #ffeef0;
}

.log-item.info {
  background: #f6f8fa;
}

.log-header {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 5px;
}

.log-time {
  color: #666;
  font-family: monospace;
  font-size: 11px;
}

.log-status {
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 10px;
  font-weight: bold;
  text-transform: uppercase;
}

.log-status.success { background: #28a745; color: white; }
.log-status.cached { background: #28a745; color: white; }
.log-status.blocked { background: #ffc107; color: #212529; }
.log-status.error { background: #dc3545; color: white; }
.log-status.pending { background: #007acc; color: white; }

.log-type {
  font-size: 11px;
  color: #666;
  font-style: italic;
}

.log-content {
  color: #24292e;
  line-height: 1.4;
}

.log-meta {
  font-size: 11px;
  color: #666;
  margin-top: 5px;
}

.stats-section {
  background: white;
  padding: 20px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.stats-section h4 {
  margin: 0 0 15px 0;
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

.stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 12px;
}

.stat-card {
  background: #f8f9fa;
  padding: 12px;
  border-radius: 6px;
  text-align: center;
  border-left: 4px solid;
  transition: transform 0.2s, box-shadow 0.2s;
}

.stat-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0,0,0,0.1);
}

.stat-card.total { border-left-color: #6c757d; }
.stat-card.network { border-left-color: #007acc; }
.stat-card.cache { border-left-color: #28a745; }
.stat-card.pending { border-left-color: #ffc107; }
.stat-card.blocked { border-left-color: #dc3545; }
.stat-card.rate { border-left-color: #6f42c1; }
.stat-card.time { border-left-color: #fd7e14; }
.stat-card.keytime { border-left-color: #20c997; }

.stat-value {
  font-size: 24px;
  font-weight: bold;
  color: #007acc;
  margin-bottom: 5px;
}

.stat-label {
  font-size: 12px;
  color: #666;
  text-transform: uppercase;
}
</style>
