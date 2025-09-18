<template>
  <div class="demo-container">
    <h3>🗑️ DELETE 请求演示</h3>
    
    <!-- 请求操作区 -->
    <div class="request-section">
      <div class="url-display">
        <span class="method-tag delete">DELETE</span>
        <code>https://jsonplaceholder.typicode.com/posts/{{ selectedPostId || '{id}' }}</code>
      </div>
      
      <!-- 文章选择 -->
      <div class="post-selector">
        <label>选择文章:</label>
        <select v-model="selectedPostId" @change="loadPost" class="post-select">
          <option value="">选择要删除的文章...</option>
          <option v-for="i in 5" :key="i" :value="i">文章 {{ i }}</option>
        </select>
      </div>

      <!-- 文章预览与删除确认 -->
      <div v-if="postToDelete" class="delete-confirmation">
        <div class="post-preview">
          <h5>即将删除的文章：</h5>
          <div class="post-card">
            <div class="post-header">
              <span class="post-id">ID: {{ postToDelete.id }}</span>
              <span class="user-badge">用户{{ postToDelete.userId }}</span>
            </div>
            <h6>{{ postToDelete.title }}</h6>
            <p>{{ postToDelete.body.substring(0, 100) }}...</p>
          </div>
        </div>
        
        <div class="warning-section">
          <div class="warning-box">
            ⚠️ <strong>警告:</strong> 此操作将永久删除文章，无法恢复！
          </div>
          
          <label class="checkbox-label">
            <input v-model="confirmDelete" type="checkbox" class="checkbox" />
            我确认删除这篇文章
          </label>
          
          <button 
            @click="deletePost" 
            :disabled="loading || !confirmDelete"
            class="delete-btn"
          >
            {{ loading ? '删除中...' : '确认删除' }}
          </button>
        </div>
      </div>
    </div>

    <!-- 响应结果区 -->
    <div class="response-section">
      <h4>响应结果</h4>
      
      <!-- 加载状态 -->
      <div v-if="loadingPost || loading" class="loading">
        <div class="spinner">⏳</div>
        <span>{{ loadingPost ? '加载文章信息...' : '删除文章中...' }}</span>
      </div>
      
      <!-- 错误状态 -->
      <div v-if="error" class="error-result">
        <div class="status-badge error">❌ 请求失败</div>
        <div class="error-message">{{ error }}</div>
      </div>
      
      <!-- 成功状态 -->
      <div v-if="deleteSuccess && !loading && !loadingPost" class="success-result">
        <div class="status-badge success">✅ 删除成功</div>
        
        <!-- 删除结果展示 -->
        <div class="response-data">
          <div class="delete-summary">
            <div class="success-card">
              <div class="success-icon">🎉</div>
              <div class="success-content">
                <h5>文章删除成功</h5>
                <div class="delete-info">
                  <div class="info-row">
                    <span class="label">文章标题:</span>
                    <span class="value">{{ deletedPostTitle }}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">文章ID:</span>
                    <span class="value">{{ selectedPostId }}</span>
                  </div>
                  <div class="info-row">
                    <span class="label">删除时间:</span>
                    <span class="value">{{ deleteTime }}</span>
                  </div>
                </div>
                <div class="note">
                  <em>注意：这是演示API，数据并未真正删除。</em>
                </div>
              </div>
            </div>
          </div>
          
          <!-- 完整响应数据 -->
          <div class="raw-response">
            <h5>完整响应数据：</h5>
            <pre class="json-data">{{ JSON.stringify(deleteResponse, null, 2) }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 简化的文章API类
class PostApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getPost(postId: number) {
    return this.requestCore.get(`https://jsonplaceholder.typicode.com/posts/${postId}`)
  }

  async deletePost(postId: number) {
    return this.requestCore.delete(`https://jsonplaceholder.typicode.com/posts/${postId}`)
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { post: PostApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 状态管理
const selectedPostId = ref('')
const postToDelete = ref<any>(null)
const confirmDelete = ref(false)
const loadingPost = ref(false)
const loading = ref(false)
const error = ref('')
const deleteSuccess = ref(false)
const deletedPostTitle = ref('')
const deleteTime = ref('')
const deleteResponse = ref<any>(null)

// 加载文章信息
const loadPost = async () => {
  if (!selectedPostId.value) {
    postToDelete.value = null
    deleteSuccess.value = false
    return
  }

  loadingPost.value = true
  error.value = ''
  deleteSuccess.value = false
  confirmDelete.value = false

  try {
    const post = await apiClient.post.getPost(parseInt(selectedPostId.value))
    postToDelete.value = post
  } catch (err: any) {
    error.value = err.message || 'Failed to load post'
  } finally {
    loadingPost.value = false
  }
}

// 删除文章
const deletePost = async () => {
  if (!confirmDelete.value || !postToDelete.value || !selectedPostId.value) return

  loading.value = true
  error.value = ''
  deleteSuccess.value = false

  try {
    const response = await apiClient.post.deletePost(parseInt(selectedPostId.value))
    
    // 记录删除的文章信息
    deletedPostTitle.value = postToDelete.value.title
    deleteTime.value = new Date().toLocaleString()
    deleteResponse.value = response || {}
    deleteSuccess.value = true
    
    // 清除表单
    postToDelete.value = null
    selectedPostId.value = ''
    confirmDelete.value = false
    
  } catch (err: any) {
    error.value = err.message || 'Delete failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.demo-container {
  padding: 20px;
  border: 1px solid #ccc;
  background: #f9f9f9;
}

.demo-container h3 {
  margin: 0 0 20px 0;
  color: #333;
}

.request-section {
  padding: 15px;
  background: #fff;
  border: 1px solid #ddd;
  margin-bottom: 20px;
}

.url-display {
  margin-bottom: 15px;
  font-family: monospace;
}

.method-tag {
  padding: 2px 8px;
  color: white;
  font-size: 12px;
  font-weight: bold;
}

.method-tag.delete {
  background: #dc3545;
}

.url-display code {
  padding: 5px 10px;
  background: #f5f5f5;
  border: 1px solid #ddd;
}

.post-selector {
  margin-bottom: 15px;
}

.post-selector label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
}

.post-select {
  padding: 5px 10px;
  border: 1px solid #ccc;
}

.delete-confirmation {
  border: 1px solid #ddd;
  padding: 15px;
  background: #fff;
}

.post-preview h5 {
  margin: 0 0 10px 0;
  color: #333;
}

.post-card {
  background: #f8f9fa;
  padding: 10px;
  border: 1px solid #ddd;
  margin-bottom: 15px;
}

.post-header {
  margin-bottom: 10px;
  font-size: 12px;
  color: #666;
}

.post-id, .user-badge {
  padding: 2px 6px;
  background: #e9ecef;
  margin-right: 10px;
}

.post-card h6 {
  margin: 10px 0 5px 0;
  color: #007bff;
}

.post-card p {
  margin: 0;
  color: #666;
  font-size: 14px;
}

.warning-section {
  margin-top: 15px;
}

.warning-box {
  background: #fff3cd;
  color: #856404;
  padding: 10px;
  border: 1px solid #ffeaa7;
  margin-bottom: 10px;
}

.checkbox-label {
  margin: 10px 0;
}

.checkbox {
  margin-right: 8px;
}

.delete-btn {
  padding: 8px 16px;
  background: #dc3545;
  color: white;
  border: none;
  cursor: pointer;
}

.delete-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.response-section {
  border: 1px solid #ddd;
}

.response-section h4 {
  margin: 0;
  padding: 10px 15px;
  background: #f8f9fa;
  border-bottom: 1px solid #ddd;
  color: #333;
}

.loading {
  padding: 20px;
  color: #666;
}

.error-result, .success-result {
  padding: 15px;
}

.status-badge {
  padding: 5px 10px;
  margin-bottom: 10px;
  font-size: 14px;
}

.status-badge.success {
  background: #d4edda;
  color: #155724;
}

.status-badge.error {
  background: #f8d7da;
  color: #721c24;
}

.error-message {
  color: #dc3545;
  background: #f8d7da;
  padding: 10px;
  border: 1px solid #f5c6cb;
}

.success-card {
  background: #fff;
  padding: 15px;
  border: 1px solid #ddd;
}

.success-icon {
  font-size: 24px;
  margin-bottom: 10px;
}

.success-content h5 {
  margin: 0 0 10px 0;
  color: #333;
}

.delete-info {
  margin-bottom: 10px;
}

.info-row {
  margin: 5px 0;
}

.label {
  font-weight: bold;
  color: #666;
}

.value {
  color: #333;
  margin-left: 10px;
}

.note {
  font-size: 12px;
  color: #666;
  font-style: italic;
  margin-top: 10px;
}

.raw-response {
  background: #f8f9fa;
  border: 1px solid #ddd;
  margin-top: 15px;
}

.raw-response h5 {
  margin: 0;
  padding: 10px;
  background: #e9ecef;
  color: #333;
}

.json-data {
  margin: 0;
  padding: 10px;
  background: #f8f9fa;
  color: #333;
  font-family: monospace;
  font-size: 12px;
  white-space: pre;
  overflow-x: auto;
}
</style>
