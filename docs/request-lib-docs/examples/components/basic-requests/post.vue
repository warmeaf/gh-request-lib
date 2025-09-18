<template>
  <div>
    <!-- 请求操作区 -->
    <div>
      <div class="url-display">
        <span class="method-tag">POST</span>
        <code>https://jsonplaceholder.typicode.com/posts</code>
      </div>

      <!-- 请求体数据 -->
      <div>
        <h5>请求体数据：</h5>
        <div class="form-grid">
          <div class="form-field">
            <label>标题</label>
            <input
              v-model="postData.title"
              type="text"
              placeholder="输入文章标题"
              class="form-input"
            />
          </div>
          <div class="form-field">
            <label>作者</label>
            <select v-model="postData.userId" class="form-input">
              <option value="1">用户 1</option>
              <option value="2">用户 2</option>
              <option value="3">用户 3</option>
            </select>
          </div>
          <div class="form-field full-width">
            <label>内容</label>
            <textarea
              v-model="postData.body"
              placeholder="输入文章内容..."
              rows="3"
              class="form-input"
            ></textarea>
          </div>
        </div>

        <button
          @click="createPost"
          :disabled="loading || !isFormValid"
          class="submit-btn"
        >
          {{ loading ? '发送请求...' : '创建文章' }}
        </button>
      </div>
    </div>

    <!-- 响应结果区 -->
    <div>
      <h4>响应结果</h4>

      <!-- 加载状态 -->
      <div v-if="loading" class="loading">
        <div>⏳</div>
        <span>正在创建文章...</span>
      </div>

      <!-- 错误状态 -->
      <div v-if="error" class="error-result">
        <div class="status-badge error">❌ 请求失败</div>
        <div class="error-message">{{ error }}</div>
      </div>

      <!-- 成功状态 -->
      <div v-if="createdPost && !loading" class="success-result">
        <div class="status-badge success">✅ 创建成功</div>

        <!-- 响应数据展示 -->
        <div class="response-data">
          <!-- 完整响应数据 -->
          <div>
            <h5>完整响应数据</h5>
            <pre class="json-data">{{
              JSON.stringify(createdPost, null, 2)
            }}</pre>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 简化的文章API类
class PostApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async createPost(postData: any) {
    return this.requestCore.post(
      'https://jsonplaceholder.typicode.com/posts',
      postData
    )
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
const postData = ref({
  title: '我的新文章',
  body: '这是一个使用 POST 请求创建的文章示例...',
  userId: '1',
})

const loading = ref(false)
const error = ref('')
const createdPost = ref<any>(null)

// 表单验证
const isFormValid = computed(() => {
  return postData.value.title.trim() && postData.value.body.trim()
})

// 创建文章
const createPost = async () => {
  if (!isFormValid.value) {
    error.value = 'Please fill in title and content'
    return
  }

  loading.value = true
  error.value = ''
  createdPost.value = null

  try {
    const result = await apiClient.post.createPost({
      title: postData.value.title,
      body: postData.value.body,
      userId: parseInt(postData.value.userId),
    })
    createdPost.value = result
  } catch (err: any) {
    error.value = err.message || 'Request failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
.url-display {
  margin-bottom: 15px;
}

.method-tag {
  padding: 2px 8px;
  color: white;
  background: #ffc107;
}

code {
  padding: 2px 8px;
  background: #f5f5f5;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
}

.form-field.full-width {
  grid-column: 1 / -1;
}

.form-field label {
  display: block;
  margin-bottom: 5px;
  color: #333;
  font-weight: bold;
}

.form-input {
  width: 100%;
  padding: 5px 10px;
  border: 1px solid #ccc;
}

textarea.form-input {
  height: 60px;
}

.submit-btn {
  padding: 8px 16px;
  background: #ffc107;
  color: #333;
  border: none;
  cursor: pointer;
}

.submit-btn:disabled {
  background: #6c757d;
  color: #fff;
  cursor: not-allowed;
}

.loading {
  padding: 20px;
  color: #666;
}

.error-result,
.success-result {
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

.response-data {
  margin-top: 15px;
}

.json-data {
  margin: 0;
  padding: 10px;
  background: #f8f9fa;
  color: #333;
  font-size: 12px;
  white-space: pre;
  overflow-x: auto;
}
</style>
