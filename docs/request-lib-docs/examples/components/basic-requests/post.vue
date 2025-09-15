<template>
  <div class="demo-container">
    <h3>📝 POST请求演示 - 创建新文章</h3>
    <div class="demo-content">
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
        
        <button 
          @click="createPost" 
          :disabled="loading || !isFormValid"
          class="submit-btn"
        >
          {{ loading ? '创建中...' : '创建文章' }}
        </button>
      </div>
      
      <div class="result-section">
        <div v-if="loading" class="loading">
          ⏳ 正在创建文章...
        </div>
        
        <div v-if="error" class="error">
          ❌ {{ error }}
        </div>
        
        <div v-if="createdPost && !loading" class="success">
          <h4>🎉 文章创建成功！</h4>
          <div class="post-card">
            <div class="post-header">
              <div class="post-id">ID: {{ createdPost.id }}</div>
              <div class="user-id">用户: {{ createdPost.userId }}</div>
            </div>
            <h5>{{ createdPost.title }}</h5>
            <p>{{ createdPost.body }}</p>
          </div>
          <details class="raw-data">
            <summary>查看完整响应数据</summary>
            <pre>{{ JSON.stringify(createdPost, null, 2) }}</pre>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { createApiClient, type ApiClass } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 定义文章API类
class PostApi {
  requestCore: any
  
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async createPost(postData: any) {
    const url = 'https://jsonplaceholder.typicode.com/posts'
    return this.requestCore.post(url, postData)
  }
}

// 创建 API 客户端实例
const apiClient = createApiClient(
  { post: PostApi },
  {
    requestor: fetchRequestor,
    globalConfig: {
      timeout: 10000,
    },
  }
)

// 获取文章 API 实例
const postApi = apiClient.post

// 表单数据
const formData = ref({
  userId: '1',
  title: '我的第一篇文章',
  body: '这是一个使用 request-bus 创建的文章演示。它展示了如何使用 POST 请求发送数据到服务器。'
})

// 组件状态
const loading = ref(false)
const error = ref('')
const createdPost = ref<any>(null)

// 表单验证
const isFormValid = computed(() => {
  return formData.value.title.trim() && formData.value.body.trim()
})

// 创建文章的方法
const createPost = async () => {
  if (!isFormValid.value) {
    error.value = '请填写标题和内容'
    return
  }

  loading.value = true
  error.value = ''
  createdPost.value = null

  try {
    const post = await postApi.createPost({
      userId: parseInt(formData.value.userId),
      title: formData.value.title,
      body: formData.value.body
    })
    createdPost.value = post
  } catch (err) {
    error.value = `创建失败: ${err.message}`
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

.submit-btn {
  padding: 10px 20px;
  background: #28a745;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.submit-btn:hover:not(:disabled) {
  background: #218838;
}

.submit-btn:disabled {
  background: #6c757d;
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

.success {
  color: #28a745;
}

.post-card {
  background: white;
  padding: 20px;
  border-radius: 6px;
  margin: 10px 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-left: 4px solid #28a745;
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
  background: #f6f8fa;
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
</style>
