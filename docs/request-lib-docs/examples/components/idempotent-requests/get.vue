<template>
  <div class="demo-container">
    <!-- 操作说明 -->
    <div class="instructions">
      <h4>💡 体验步骤</h4>
      <ol>
        <li>点击「幂等查询」获取数据（会发起网络请求）</li>
        <li>立即再次点击「幂等查询」（8秒内直接返回缓存结果）</li>
        <li>对比：点击「普通查询」每次都会发起新的网络请求</li>
      </ol>
    </div>

    <!-- 查询区域 -->
    <div class="operation-section">
      <div class="input-row">
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
          @click="fetchNormal"
          :disabled="!isValidUserId || isLoading"
          class="btn btn-normal"
        >
          {{ isLoading && requestType === 'normal' ? '请求中...' : '普通查询' }}
        </button>
        <button
          @click="fetchIdempotent"
          :disabled="!isValidUserId || isLoading"
          class="btn btn-idempotent"
        >
          {{ isLoading && requestType === 'idempotent' ? '请求中...' : '🔒 幂等查询' }}
        </button>
      </div>
    </div>

    <!-- 结果展示 -->
    <div v-if="currentUser" class="result-section">
      <div class="status-badge" :class="responseStatus">
        {{ statusText }}
      </div>
      <div class="user-info">
        <h4>{{ currentUser.name }}</h4>
        <p>📧 {{ currentUser.email }}</p>
        <p>🏢 {{ currentUser.company?.name }}</p>
      </div>
    </div>

    <!-- 统计面板 -->
    <div class="stats-panel">
      <h4>📊 请求统计 <button @click="clearCache" class="clear-btn">清除缓存</button></h4>
      <div class="stats-grid">
        <div class="stat-card">
          <span class="stat-number">{{ normalRequestCount }}</span>
          <span class="stat-label">普通请求</span>
        </div>
        <div class="stat-card">
          <span class="stat-number">{{ idempotentRequestCount }}</span>
          <span class="stat-label">幂等请求</span>
        </div>
        <div class="stat-card">
          <span class="stat-number">{{ cacheHitCount }}</span>
          <span class="stat-label">缓存命中</span>
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
        ttl: 8000, // 8秒缓存时间
        includeHeaders: ['accept'],
        onDuplicate: (original, duplicate) => {
          console.log('Duplicate request detected - returning cached result:', duplicate.url)
          // 更新缓存命中计数
          cacheHitCount.value++
        },
      }
    )
  }
}

const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000, debug: true },
  }
)

const userId = ref(1)
const currentUser = ref<any>(null)
const isLoading = ref(false)
const requestType = ref<'normal' | 'idempotent' | ''>('')

const responseStatus = ref('')
const statusText = ref('')

const normalRequestCount = ref(0)
const idempotentRequestCount = ref(0)
const cacheHitCount = ref(0)

const isValidUserId = computed(() => {
  return userId.value && userId.value >= 1 && userId.value <= 10
})

const clearCache = () => {
  // 清除幂等缓存
  apiClient.user.requestCore.clearIdempotentCache()
  normalRequestCount.value = 0
  idempotentRequestCount.value = 0
  cacheHitCount.value = 0
  console.log('Cache and stats cleared')
}

const fetchNormal = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  requestType.value = 'normal'
  
  try {
    console.log('🚀 Starting normal request...')
    const user = await apiClient.user.getUser(userId.value)
    console.log('✅ Normal request completed', user)

    currentUser.value = user
    responseStatus.value = 'network'
    statusText.value = '🌐 网络请求'
    normalRequestCount.value++
  } catch (error: any) {
    console.error('❌ Normal request failed:', error)
  } finally {
    isLoading.value = false
    requestType.value = ''
  }
}

const fetchIdempotent = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  requestType.value = 'idempotent'
  const startTime = Date.now()
  
  try {
    console.log('🔒 Starting idempotent request...')
    const user = await apiClient.user.getUserIdempotent(userId.value)
    console.log('✅ Idempotent request completed', user)

    currentUser.value = user
    
    // 判断是否来自缓存（通过时间判断，实际请求通常较慢）
    const endTime = Date.now()
    const requestDuration = endTime - startTime
    const isFromCache = requestDuration < 100 // 少于100ms认为是缓存
    
    if (isFromCache && idempotentRequestCount.value > 0) {
      responseStatus.value = 'cached'
      statusText.value = '⚡ 缓存结果'
    } else {
      responseStatus.value = 'network'
      statusText.value = '🌐 网络请求'
    }
    
    idempotentRequestCount.value++
  } catch (error: any) {
    console.error('❌ Idempotent request failed:', error)
  } finally {
    isLoading.value = false
    requestType.value = ''
  }
}
</script>

<style scoped>
.demo-container {
  max-width: 700px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  background: #f8fafc;
  border-radius: 12px;
}

.demo-container > * {
  margin-bottom: 16px;
}

/* 操作说明 */
.instructions {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  padding: 16px;
  border-radius: 8px;
  margin-bottom: 20px;
}

.instructions h4 {
  margin: 0 0 12px 0;
  font-size: 16px;
}

.instructions ol {
  margin: 0;
  padding-left: 20px;
}

.instructions li {
  margin: 6px 0;
  font-size: 14px;
  line-height: 1.4;
}

/* 操作区域 */
.operation-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.input-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin-bottom: 16px;
}

.input-row label {
  font-weight: 600;
  color: #374151;
  min-width: 60px;
}

.user-input {
  padding: 8px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  width: 100px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.user-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.button-group {
  display: flex;
  gap: 12px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 6px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
  min-width: 120px;
}

.btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
  transform: none;
}

.btn-normal {
  background: #10b981;
  color: white;
}

.btn-normal:hover:not(:disabled) {
  background: #059669;
  transform: translateY(-1px);
}

.btn-idempotent {
  background: #3b82f6;
  color: white;
}

.btn-idempotent:hover:not(:disabled) {
  background: #2563eb;
  transform: translateY(-1px);
}

/* 结果展示 */
.result-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.status-badge {
  display: inline-block;
  padding: 6px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  margin-bottom: 12px;
}

.status-badge.network {
  background: #10b981;
  color: white;
}

.status-badge.cached {
  background: #f59e0b;
  color: white;
}

.user-info h4 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 18px;
}

.user-info p {
  margin: 4px 0;
  color: #6b7280;
  font-size: 14px;
}

/* 统计面板 */
.stats-panel {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.stats-panel h4 {
  margin: 0 0 16px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
  font-size: 16px;
  color: #1f2937;
}

.clear-btn {
  background: #ef4444;
  color: white;
  border: none;
  padding: 6px 12px;
  border-radius: 4px;
  font-size: 12px;
  cursor: pointer;
  transition: background-color 0.2s;
}

.clear-btn:hover {
  background: #dc2626;
}

.stats-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
}

.stat-card {
  background: #f8fafc;
  padding: 16px;
  border-radius: 8px;
  text-align: center;
  border: 2px solid #e2e8f0;
}

.stat-number {
  display: block;
  font-size: 24px;
  font-weight: bold;
  color: #3b82f6;
  margin-bottom: 4px;
}

.stat-label {
  font-size: 12px;
  color: #6b7280;
  font-weight: 500;
}
</style>
