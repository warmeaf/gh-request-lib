<template>
  <div class="demo-container">
    <h3>🗑️ DELETE请求演示 - 删除文章</h3>
    <div class="demo-content">
      <div class="post-selector">
        <label>选择要删除的文章:</label>
        <select v-model="selectedPostId" @change="loadPost" class="form-control">
          <option value="">请选择文章...</option>
          <option v-for="i in 100" :key="i" :value="i">文章 {{ i }}</option>
        </select>
      </div>

      <div v-if="postToDelete" class="post-section">
        <div class="post-preview">
          <h4>📖 文章预览:</h4>
          <div class="post-card">
            <div class="post-header">
              <div class="post-id">ID: {{ postToDelete.id }}</div>
              <div class="user-id">用户: {{ postToDelete.userId }}</div>
            </div>
            <h5>{{ postToDelete.title }}</h5>
            <p>{{ postToDelete.body }}</p>
          </div>
        </div>

        <div class="delete-section">
          <div class="warning-box">
            ⚠️ <strong>警告:</strong> 此操作将永久删除这篇文章，无法恢复！
          </div>
          
          <div class="confirmation">
            <label class="checkbox-label">
              <input 
                v-model="confirmDelete" 
                type="checkbox" 
                class="checkbox"
              />
              我确认要删除这篇文章
            </label>
          </div>
          
          <button 
            @click="deletePost" 
            :disabled="loading || !confirmDelete"
            class="delete-btn"
          >
            {{ loading ? '删除中...' : '🗑️ 删除文章' }}
          </button>
        </div>
      </div>
      
      <div class="result-section">
        <div v-if="loadingPost" class="loading">
          🔄 正在加载文章信息...
        </div>
        
        <div v-if="loading" class="loading">
          ⏳ 正在删除文章...
        </div>
        
        <div v-if="error" class="error">
          ❌ {{ error }}
        </div>
        
        <div v-if="deleteSuccess && !loading" class="success">
          <h4>🎉 文章删除成功！</h4>
          <div class="success-info">
            <div class="success-card">
              <div class="success-icon">✅</div>
              <div class="success-content">
                <p><strong>已删除文章:</strong> {{ deletedPostTitle }}</p>
                <p><strong>文章ID:</strong> {{ selectedPostId }}</p>
                <p><strong>删除时间:</strong> {{ deleteTime }}</p>
                <p class="note">
                  <em>注意：由于这是演示API，实际的数据并未真正删除。</em>
                </p>
              </div>
            </div>
          </div>
          <details class="raw-data">
            <summary>查看响应信息</summary>
            <pre>{{ JSON.stringify(deleteResponse, null, 2) }}</pre>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { createRequestBus } from 'request-bus'

// 创建请求总线实例
const requestBus = createRequestBus('fetch', {
  globalConfig: {
    timeout: 10000,
  },
})

// 定义文章API类
class PostApi {
  requestCore: any
  
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getPost(postId: string) {
    const url = `https://jsonplaceholder.typicode.com/posts/${postId}`
    return this.requestCore.get(url)
  }

  async deletePost(postId: string) {
    const url = `https://jsonplaceholder.typicode.com/posts/${postId}`
    return this.requestCore.delete(url)
  }
}

// 注册API
const postApi = requestBus.register('post', PostApi)

// 组件状态
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
    return
  }

  loadingPost.value = true
  error.value = ''
  deleteSuccess.value = false
  confirmDelete.value = false

  try {
    const post = await postApi.getPost(selectedPostId.value)
    postToDelete.value = post
  } catch (err) {
    error.value = `加载文章失败: ${err.message}`
  } finally {
    loadingPost.value = false
  }
}

// 删除文章
const deletePost = async () => {
  if (!confirmDelete.value || !postToDelete.value) return

  loading.value = true
  error.value = ''
  deleteSuccess.value = false

  try {
    const response = await postApi.deletePost(selectedPostId.value)
    
    // 记录删除的文章信息
    deletedPostTitle.value = postToDelete.value.title
    deleteTime.value = new Date().toLocaleString()
    deleteResponse.value = response
    deleteSuccess.value = true
    
    // 清除表单
    postToDelete.value = null
    selectedPostId.value = ''
    confirmDelete.value = false
    
  } catch (err) {
    error.value = `删除失败: ${err.message}`
  } finally {
    loading.value = false
  }
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

.post-selector {
  margin-bottom: 20px;
}

.post-selector label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #24292e;
}

.post-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.post-preview,
.delete-section {
  background: white;
  padding: 15px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.post-card {
  background: #f8f9fa;
  padding: 15px;
  border-radius: 6px;
  border-left: 4px solid #007acc;
}

.post-header {
  display: flex;
  justify-content: space-between;
  margin-bottom: 10px;
  font-size: 12px;
  color: #666;
}

.post-id, .user-id {
  padding: 2px 8px;
  background: white;
  border-radius: 3px;
}

.post-card h5 {
  margin: 10px 0;
  color: #0366d6;
  font-size: 16px;
}

.post-card p {
  margin: 0;
  line-height: 1.5;
  color: #24292e;
  font-size: 14px;
}

.warning-box {
  background: #fff3cd;
  border: 1px solid #ffeaa7;
  color: #856404;
  padding: 10px;
  border-radius: 4px;
  margin-bottom: 15px;
  border-left: 4px solid #ffc107;
}

.confirmation {
  margin-bottom: 15px;
}

.checkbox-label {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  user-select: none;
}

.checkbox {
  width: 16px;
  height: 16px;
}

.delete-btn {
  padding: 10px 20px;
  background: #dc3545;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
}

.delete-btn:hover:not(:disabled) {
  background: #c82333;
}

.delete-btn:disabled {
  background: #6c757d;
  cursor: not-allowed;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d9e0;
  border-radius: 4px;
  font-size: 14px;
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

.success {
  color: #28a745;
}

.success-info {
  margin: 15px 0;
}

.success-card {
  display: flex;
  gap: 15px;
  background: white;
  padding: 20px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-left: 4px solid #28a745;
}

.success-icon {
  font-size: 32px;
  color: #28a745;
}

.success-content p {
  margin: 5px 0;
}

.note {
  font-size: 12px;
  color: #666;
  font-style: italic;
  margin-top: 10px !important;
}

.raw-data {
  margin-top: 15px;
  padding: 10px;
  background: #f6f8fa;
  border-radius: 4px;
}

.raw-data pre {
  margin: 10px 0 0 0;
  font-size: 12px;
  color: #586069;
  white-space: pre-wrap;
}

@media (max-width: 768px) {
  .post-section {
    grid-template-columns: 1fr;
  }
}
</style>
