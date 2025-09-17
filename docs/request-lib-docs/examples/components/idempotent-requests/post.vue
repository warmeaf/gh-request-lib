<template>
  <div class="demo-container">
    <!-- 表单区域 -->
    <div class="form-section">
      <div class="form-row">
        <label>标题:</label>
        <input v-model="formData.title" placeholder="文章标题" class="form-input" />
      </div>
      <div class="form-row">
        <label>内容:</label>
        <textarea v-model="formData.content" placeholder="文章内容" rows="3" class="form-input"></textarea>
      </div>
      <div class="button-group">
        <button @click="submitNormal" :disabled="!isFormValid" class="btn btn-normal">
          普通提交
        </button>
        <button @click="submitIdempotent" :disabled="!isFormValid" class="btn btn-idempotent">
          🔒 幂等提交
        </button>
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

class PostApi {
  requestCore: any
  
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async createPost(data: any) {
    return this.requestCore.post('https://jsonplaceholder.typicode.com/posts', data)
  }

  async createPostIdempotent(data: any) {
    return this.requestCore.postIdempotent(
      'https://jsonplaceholder.typicode.com/posts', 
      data,
      {},
      {
        ttl: 5000,
        includeHeaders: ['content-type'],
        onDuplicate: (original, duplicate) => {
          console.log('检测到重复请求:', duplicate.url)
        }
      }
    )
  }

}

const apiClient = createApiClient(
  { post: PostApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000, debug: true }
  }
)

const formData = ref({
  title: '测试文章标题',
  content: '这是测试内容'
})

const logs = ref<Array<{
  id: number
  time: string
  status: string
  type: string
  message: string
  duration: number
}>>([])

let logId = 0

const isFormValid = computed(() => {
  return formData.value.title.trim() && formData.value.content.trim()
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

const submitNormal = async () => {
  const start = Date.now()
  
  try {
    const result = await apiClient.post.createPost({
      title: formData.value.title,
      body: formData.value.content,
      userId: 1
    })
    
    const duration = Date.now() - start
    addLog('成功', 'success', `普通请求完成 - ID: ${result.id}`, duration)
    
  } catch (error: any) {
    const duration = Date.now() - start
    addLog('失败', 'error', `普通请求失败: ${error.message}`, duration)
  }
}

const submitIdempotent = async () => {
  const start = Date.now()
  
  try {
    const result = await apiClient.post.createPostIdempotent({
      title: formData.value.title,
      body: formData.value.content,
      userId: 1
    })
    
    const duration = Date.now() - start
    
    let status = '成功', type = 'success', message = ''
    
    if (duration < 30) {
      status = '缓存'
      type = 'cached'  
      message = `缓存命中 - 瞬间返回 ID: ${result.id}`
    } else if (duration < 100) {
      status = '等待'
      type = 'pending'
      message = `等待现有请求完成 - ID: ${result.id}`
    } else {
      message = `新请求完成 - ID: ${result.id}`
    }
    
    addLog(status, type, message, duration)
    
  } catch (error: any) {
    const duration = Date.now() - start
    addLog('失败', 'error', `幂等请求失败: ${error.message}`, duration)
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

/* 表单区域 */
.form-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
}

.form-row {
  display: flex;
  align-items: center;
  gap: 15px;
  margin-bottom: 15px;
}

.form-row label {
  min-width: 60px;
  font-weight: 600;
  color: #24292e;
}

.form-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid #d1d9e0;
  border-radius: 4px;
  font-size: 14px;
}

.form-input:focus {
  outline: none;
  border-color: #0366d6;
  box-shadow: 0 0 0 2px rgba(3, 102, 214, 0.1);
}

.button-group {
  display: flex;
  gap: 10px;
  margin-top: 20px;
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
