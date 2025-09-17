<template>
  <div class="demo-container">
    <!-- 查询区域 -->
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
          <button @click="fetchNormal" :disabled="!isValidUserId" class="btn btn-normal">
            普通查询
          </button>
          <button @click="fetchIdempotent" :disabled="!isValidUserId" class="btn btn-idempotent">
            🔒 幂等查询
          </button>
        </div>
      </div>

      <!-- 用户信息显示 -->
      <div v-if="currentUser" class="user-card">
        <div class="user-avatar">👤</div>
        <div class="user-info">
          <h4>{{ currentUser.name }}</h4>
          <p>{{ currentUser.email }}</p>
          <p>{{ currentUser.company?.name }}</p>
        </div>
        <div class="response-badge" :class="responseType">
          {{ responseTypeText }}
        </div>
      </div>
    </div>

    <!-- 请求日志 -->
    <div class="logs-section">
      <h4>📋 请求日志 <button @click="logs = []" class="clear-btn">清空</button></h4>
      <div class="logs-container">
        <div v-for="log in logs.slice(0, 10)" :key="log.id" class="log-item">
          <span class="log-time">{{ log.time }}</span>
          <span :class="['log-status', log.type]">{{ log.status }}</span>
          <span class="log-message">{{ log.message }}</span>
          <span class="log-duration">{{ log.duration }}ms</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

class UserApi {
  requestCore: any
  
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getUser(userId: number) {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`
    return this.requestCore.get(url)
  }

  async getUserIdempotent(userId: number) {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`
    return this.requestCore.getIdempotent(
      url,
      {},
      {
        ttl: 8000,
        includeHeaders: ['accept'],
        onDuplicate: (original, duplicate) => {
          console.log('检测到重复查询:', duplicate.url)
        }
      }
    )
  }

}

const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000, debug: true }
  }
)

const userId = ref(1)
const currentUser = ref<any>(null)

const responseType = ref('')
const responseTypeText = ref('')

const logs = ref<Array<{
  id: number
  time: string
  status: string
  type: string
  message: string
  duration: number
}>>([])

let logId = 0

const isValidUserId = computed(() => {
  return userId.value && userId.value >= 1 && userId.value <= 10
})

const addLog = (status: string, type: string, message: string, duration: number) => {
  logs.value.unshift({
    id: ++logId,
    time: new Date().toLocaleTimeString(),
    status,
    type,
    message,
    duration
  })
  
  if (logs.value.length > 15) {
    logs.value = logs.value.slice(0, 15)
  }
}

const fetchNormal = async () => {
  const start = Date.now()
  
  try {
    const user = await apiClient.user.getUser(userId.value)
    const duration = Date.now() - start
    
    currentUser.value = user
    responseType.value = 'network'
    responseTypeText.value = '🌐 网络请求'
    
    addLog('成功', 'success', `普通查询完成 - ${user.name}`, duration)
    
  } catch (error: any) {
    const duration = Date.now() - start
    addLog('失败', 'error', `普通查询失败: ${error.message}`, duration)
  }
}

const fetchIdempotent = async () => {
  const start = Date.now()
  
  try {
    const user = await apiClient.user.getUserIdempotent(userId.value)
    const duration = Date.now() - start
    
    currentUser.value = user
    
    let status = '成功', type = 'success', message = '', rType = 'network', rText = '🌐 网络请求'
    
    if (duration < 30) {
      status = '缓存'
      type = 'cached'
      message = `缓存命中 - 瞬间返回 ${user.name}`
      rType = 'cached'
      rText = '💾 缓存结果'
    } else if (duration < 100) {
      status = '等待'
      type = 'pending'
      message = `等待现有请求完成 - ${user.name}`
      rType = 'pending'
      rText = '🔄 请求复用'
    } else {
      message = `新网络请求完成 - ${user.name}`
    }
    
    responseType.value = rType
    responseTypeText.value = rText
    
    addLog(status, type, message, duration)
    
  } catch (error: any) {
    const duration = Date.now() - start
    addLog('失败', 'error', `幂等查询失败: ${error.message}`, duration)
  }
}
</script>

<style scoped>
.demo-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
}

.demo-container > * {
  margin-bottom: 20px;
}

/* 查询区域 */
.query-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
}

.query-controls {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  margin-bottom: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.input-group label {
  font-weight: 600;
  color: #24292e;
  font-size: 14px;
}

.user-input {
  padding: 8px 12px;
  border: 1px solid #d1d9e0;
  border-radius: 4px;
  width: 120px;
}

.user-input:focus {
  outline: none;
  border-color: #0366d6;
  box-shadow: 0 0 0 2px rgba(3, 102, 214, 0.1);
}

.button-group {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-normal {
  background: #28a745;
  color: white;
}

.btn-normal:hover:not(:disabled) {
  background: #218838;
}

.btn-idempotent {
  background: #007acc;
  color: white;
}

.btn-idempotent:hover:not(:disabled) {
  background: #0056b3;
}

/* 用户信息卡片 */
.user-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007acc;
  margin-top: 15px;
}

.user-avatar {
  font-size: 40px;
}

.user-info {
  flex: 1;
}

.user-info h4 {
  margin: 0 0 5px 0;
  color: #24292e;
}

.user-info p {
  margin: 2px 0;
  color: #666;
  font-size: 14px;
}

.response-badge {
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
}

.response-badge.network {
  background: #28a745;
  color: white;
}

.response-badge.cached {
  background: #ffc107;
  color: #212529;
}

.response-badge.pending {
  background: #17a2b8;
  color: white;
}

/* 日志区域 */
.logs-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
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
  padding: 5px 10px;
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
}

.log-item {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 8px 0;
  border-bottom: 1px solid #f1f3f4;
  font-size: 13px;
}

.log-item:last-child {
  border-bottom: none;
}

.log-time {
  font-family: 'Courier New', monospace;
  color: #666;
  min-width: 80px;
}

.log-status {
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 11px;
  font-weight: bold;
  text-transform: uppercase;
  min-width: 50px;
  text-align: center;
}

.log-status.success { background: #28a745; color: white; }
.log-status.cached { background: #ffc107; color: #212529; }
.log-status.pending { background: #17a2b8; color: white; }
.log-status.error { background: #dc3545; color: white; }

.log-message {
  flex: 1;
}

.log-duration {
  font-family: 'Courier New', monospace;
  color: #666;
  min-width: 60px;
  text-align: right;
}
</style>
