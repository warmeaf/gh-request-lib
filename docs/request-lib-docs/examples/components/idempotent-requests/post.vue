<template>
  <div class="demo-container">
    <!-- 操作说明 -->
    <div class="instructions">
      <h4>💡 体验步骤</h4>
      <ol>
        <li>点击「幂等提交」提交表单（会发起网络请求）</li>
        <li>立即再次点击「幂等提交」（5秒内会直接返回缓存结果，不会重复提交）</li>
        <li>对比：点击「普通提交」每次都会发起新的网络请求</li>
        <li>查看控制台了解详细的请求执行情况</li>
      </ol>
    </div>

    <!-- 表单区域 -->
    <div class="form-section">
      <div class="form-row">
        <label>标题:</label>
        <input
          v-model="formData.title"
          placeholder="文章标题"
          class="form-input"
        />
      </div>
      <div class="form-row">
        <label>内容:</label>
        <textarea
          v-model="formData.content"
          placeholder="文章内容"
          rows="3"
          class="form-input"
        ></textarea>
      </div>
      <div class="button-group">
        <button
          @click="submitNormal"
          :disabled="!isFormValid || isLoading"
          class="btn btn-normal"
        >
          {{ isLoading && requestType === 'normal' ? '提交中...' : '普通提交' }}
        </button>
        <button
          @click="submitIdempotent"
          :disabled="!isFormValid || isLoading"
          class="btn btn-idempotent"
        >
          {{ isLoading && requestType === 'idempotent' ? '提交中...' : '🔒 幂等提交' }}
        </button>
      </div>
    </div>

    <!-- 提交结果展示 -->
    <div v-if="lastResult" class="result-section">
      <div class="status-badge" :class="lastResult.status">
        {{ lastResult.statusText }}
      </div>
      <div class="result-info">
        <h4>📝 {{ lastResult.data.title }}</h4>
        <p>ID: {{ lastResult.data.id }} | 用户ID: {{ lastResult.data.userId }}</p>
        <p class="content-preview">{{ lastResult.data.body }}</p>
      </div>
    </div>

    <!-- 统计面板 -->
    <div class="stats-panel">
      <h4>📊 请求统计 <button @click="clearStats" class="clear-btn">清除缓存</button></h4>
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
          <span class="stat-number">{{ duplicateBlockedCount }}</span>
          <span class="stat-label">重复阻止</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

class PostApi {
  requestCore: any

  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async createPost(data: any) {
    return this.requestCore.post(
      'https://jsonplaceholder.typicode.com/posts',
      data
    )
  }

  async createPostIdempotent(data: any) {
    return this.requestCore.postIdempotent(
      'https://jsonplaceholder.typicode.com/posts',
      data,
      {},
      {
        ttl: 5000, // 5秒内防重复
        includeHeaders: ['content-type'],
        onDuplicate: (original, duplicate) => {
          console.log('Duplicate request blocked - reusing cached result:', duplicate.url)
          // 更新重复阻止计数
          duplicateBlockedCount.value++
        },
      }
    )
  }
}

const apiClient = createApiClient(
  { post: PostApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000, debug: true },
  }
)

const formData = ref({
  title: '测试文章标题',
  content: '这是测试内容',
})

const isLoading = ref(false)
const requestType = ref<'normal' | 'idempotent' | ''>('')
const lastResult = ref<any>(null)

const normalRequestCount = ref(0)
const idempotentRequestCount = ref(0)
const duplicateBlockedCount = ref(0)

const isFormValid = computed(() => {
  return formData.value.title.trim() && formData.value.content.trim()
})

const clearStats = () => {
  // 清除幂等缓存
  apiClient.post.requestCore.clearIdempotentCache()
  normalRequestCount.value = 0
  idempotentRequestCount.value = 0
  duplicateBlockedCount.value = 0
  lastResult.value = null
  console.log('Cache and stats cleared')
}

const submitNormal = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  requestType.value = 'normal'
  
  try {
    console.log('🚀 Starting normal submit...')
    const result = await apiClient.post.createPost({
      title: formData.value.title,
      body: formData.value.content,
      userId: 1,
    })
    console.log('✅ Normal submit completed:', result)
    
    lastResult.value = {
      data: result,
      status: 'network',
      statusText: '🌐 网络提交',
    }
    normalRequestCount.value++
  } catch (error: any) {
    console.error('❌ Normal submit failed:', error)
  } finally {
    isLoading.value = false
    requestType.value = ''
  }
}

const submitIdempotent = async () => {
  if (isLoading.value) return
  
  isLoading.value = true
  requestType.value = 'idempotent'
  const startTime = Date.now()
  
  try {
    console.log('🔒 Starting idempotent submit...')
    const result = await apiClient.post.createPostIdempotent({
      title: formData.value.title,
      body: formData.value.content,
      userId: 1,
    })
    console.log('✅ Idempotent submit completed:', result)
    
    // 判断是否来自缓存
    const requestDuration = Date.now() - startTime
    const isFromCache = requestDuration < 100 // 少于100ms认为是缓存
    
    lastResult.value = {
      data: result,
      status: isFromCache && idempotentRequestCount.value > 0 ? 'cached' : 'network',
      statusText: isFromCache && idempotentRequestCount.value > 0 ? '⚡ 缓存结果' : '🌐 网络提交',
    }
    
    idempotentRequestCount.value++
  } catch (error: any) {
    console.error('❌ Idempotent submit failed:', error)
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
  background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
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

/* 表单区域 */
.form-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  box-shadow: 0 2px 4px rgba(0,0,0,0.1);
}

.form-row {
  display: flex;
  align-items: flex-start;
  gap: 15px;
  margin-bottom: 15px;
}

.form-row label {
  min-width: 60px;
  font-weight: 600;
  color: #374151;
  padding-top: 8px;
}

.form-input {
  flex: 1;
  padding: 8px 12px;
  border: 2px solid #e5e7eb;
  border-radius: 6px;
  font-size: 14px;
  transition: border-color 0.2s;
}

.form-input:focus {
  outline: none;
  border-color: #3b82f6;
}

.button-group {
  display: flex;
  gap: 12px;
  margin-top: 20px;
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

.result-info h4 {
  margin: 0 0 8px 0;
  color: #1f2937;
  font-size: 18px;
}

.result-info p {
  margin: 4px 0;
  color: #6b7280;
  font-size: 14px;
}

.content-preview {
  background: #f3f4f6;
  padding: 8px;
  border-radius: 4px;
  font-style: italic;
  margin-top: 8px !important;
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
