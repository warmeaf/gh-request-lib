<template>
  <div class="demo-container">
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
          :disabled="!isFormValid"
          class="btn btn-normal"
        >
          普通提交
        </button>
        <button
          @click="submitIdempotent"
          :disabled="!isFormValid"
          class="btn btn-idempotent"
        >
          🔒 幂等提交
        </button>
      </div>
    </div>

    <!-- 请求统计 -->
    <div class="stats-section">
      <h4>📊 请求统计</h4>
      <div class="stats-container">
        <div class="stat-item">
          <span class="stat-label">普通请求次数:</span>
          <span class="stat-value">{{ normalRequestCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label"
            >幂等请求次数（打开控制台查看实际调用的接口情况）:</span
          >
          <span class="stat-value">{{ idempotentRequestCount }}</span>
        </div>
        <button @click="resetStats" class="reset-btn">重置统计</button>
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
        ttl: 5000,
        includeHeaders: ['content-type'],
        onDuplicate: (original, duplicate) => {
          console.log('检测到重复请求:', duplicate.url)
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

const normalRequestCount = ref(0)
const idempotentRequestCount = ref(0)

const isFormValid = computed(() => {
  return formData.value.title.trim() && formData.value.content.trim()
})

const resetStats = () => {
  normalRequestCount.value = 0
  idempotentRequestCount.value = 0
}

const submitNormal = async () => {
  try {
    const result = await apiClient.post.createPost({
      title: formData.value.title,
      body: formData.value.content,
      userId: 1,
    })
    console.log(result, 'createPost')
    normalRequestCount.value++
  } catch (error: any) {}
}

const submitIdempotent = async () => {
  try {
    const result = await apiClient.post.createPostIdempotent({
      title: formData.value.title,
      body: formData.value.content,
      userId: 1,
    })
    console.log(result, 'createPostIdempotent')
    idempotentRequestCount.value++
  } catch (error: any) {}
}
</script>

<style scoped>
.demo-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui,
    sans-serif;
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

/* 统计区域 */
.stats-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
}

.stats-section h4 {
  margin: 0 0 15px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f1f3f4;
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-label {
  font-weight: 600;
  color: #24292e;
}

.stat-value {
  font-family: 'Courier New', monospace;
  font-size: 16px;
  font-weight: bold;
  color: #007acc;
}

.reset-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 10px;
  align-self: flex-start;
}

.reset-btn:hover {
  background: #c82333;
}
</style>
