<template>
  <div class="demo-container">
    <!-- 请求操作区 -->
    <div class="request-section">
      <div class="url-display">
        <span class="method-tag put">PUT</span>
        <code
          >https://jsonplaceholder.typicode.com/users/{{
            selectedUserId || '{id}'
          }}</code
        >
      </div>

      <!-- 用户选择 -->
      <div class="user-selector">
        <label>选择用户:</label>
        <select v-model="selectedUserId" @change="loadUser" class="user-select">
          <option value="">选择要更新的用户...</option>
          <option v-for="i in 3" :key="i" :value="i">用户 {{ i }}</option>
        </select>
      </div>

      <!-- 更新表单 -->
      <div v-if="originalUser" class="update-form">
        <h5>更新数据：</h5>
        <div class="form-grid">
          <div class="form-field">
            <label>姓名</label>
            <input v-model="updateForm.name" type="text" class="form-input" />
          </div>
          <div class="form-field">
            <label>邮箱</label>
            <input v-model="updateForm.email" type="email" class="form-input" />
          </div>
          <div class="form-field">
            <label>电话</label>
            <input v-model="updateForm.phone" type="text" class="form-input" />
          </div>
          <div class="form-field">
            <label>网站</label>
            <input
              v-model="updateForm.website"
              type="text"
              class="form-input"
            />
          </div>
        </div>

        <button
          @click="updateUser"
          :disabled="loading || !hasChanges"
          class="update-btn"
        >
          {{ loading ? '更新中...' : '更新用户' }}
        </button>
      </div>
    </div>

    <!-- 响应结果区 -->
    <div class="response-section">
      <h4>响应结果</h4>

      <!-- 加载状态 -->
      <div v-if="loadingUser || loading" class="loading">
        <div class="spinner">⏳</div>
        <span>{{ loadingUser ? '加载用户信息...' : '更新用户信息...' }}</span>
      </div>

      <!-- 错误状态 -->
      <div v-if="error" class="error-result">
        <div class="status-badge error">❌ 请求失败</div>
        <div class="error-message">{{ error }}</div>
      </div>

      <!-- 成功状态 -->
      <div
        v-if="updatedUser && !loading && !loadingUser"
        class="success-result"
      >
        <div class="status-badge success">✅ 更新成功</div>

        <!-- 对比展示 -->
        <div class="response-data">
          <div class="comparison-view">
            <div class="before-card">
              <h5>更新前</h5>
              <div class="user-info">
                <div class="info-item">
                  <span class="label">姓名</span>
                  <span class="value">{{ originalUser.name }}</span>
                </div>
                <div class="info-item">
                  <span class="label">邮箱</span>
                  <span class="value">{{ originalUser.email }}</span>
                </div>
                <div class="info-item">
                  <span class="label">电话</span>
                  <span class="value">{{ originalUser.phone }}</span>
                </div>
                <div class="info-item">
                  <span class="label">网站</span>
                  <span class="value">{{ originalUser.website }}</span>
                </div>
              </div>
            </div>

            <div class="arrow">→</div>

            <div class="after-card">
              <h5>更新后</h5>
              <div class="user-info">
                <div class="info-item">
                  <span class="label">姓名</span>
                  <span class="value highlight">{{ updatedUser.name }}</span>
                </div>
                <div class="info-item">
                  <span class="label">邮箱</span>
                  <span class="value highlight">{{ updatedUser.email }}</span>
                </div>
                <div class="info-item">
                  <span class="label">电话</span>
                  <span class="value highlight">{{ updatedUser.phone }}</span>
                </div>
                <div class="info-item">
                  <span class="label">网站</span>
                  <span class="value highlight">{{ updatedUser.website }}</span>
                </div>
              </div>
            </div>
          </div>

          <!-- 完整响应数据 -->
          <div class="raw-response">
            <h5>完整响应数据：</h5>
            <pre class="json-data">{{
              JSON.stringify(updatedUser, null, 2)
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

// 简化的用户API类
class UserApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getUser(userId: number) {
    return this.requestCore.get(
      `https://jsonplaceholder.typicode.com/users/${userId}`
    )
  }

  async updateUser(userId: number, userData: any) {
    return this.requestCore.put(
      `https://jsonplaceholder.typicode.com/users/${userId}`,
      userData
    )
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 状态管理
const selectedUserId = ref('')
const originalUser = ref<any>(null)
const updateForm = ref({
  name: '',
  email: '',
  phone: '',
  website: '',
})
const loadingUser = ref(false)
const loading = ref(false)
const error = ref('')
const updatedUser = ref<any>(null)

// 检查是否有更改
const hasChanges = computed(() => {
  if (!originalUser.value) return false
  return (
    updateForm.value.name !== originalUser.value.name ||
    updateForm.value.email !== originalUser.value.email ||
    updateForm.value.phone !== originalUser.value.phone ||
    updateForm.value.website !== originalUser.value.website
  )
})

// 加载用户信息
const loadUser = async () => {
  if (!selectedUserId.value) {
    originalUser.value = null
    updatedUser.value = null
    return
  }

  loadingUser.value = true
  error.value = ''
  updatedUser.value = null

  try {
    const user = await apiClient.user.getUser(parseInt(selectedUserId.value))
    originalUser.value = user

    // 填充更新表单
    updateForm.value = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      website: user.website,
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load user'
  } finally {
    loadingUser.value = false
  }
}

// 更新用户信息
const updateUser = async () => {
  if (!hasChanges.value || !selectedUserId.value) return

  loading.value = true
  error.value = ''
  updatedUser.value = null

  try {
    const userData = {
      ...originalUser.value,
      name: updateForm.value.name,
      email: updateForm.value.email,
      phone: updateForm.value.phone,
      website: updateForm.value.website,
    }

    const updated = await apiClient.user.updateUser(
      parseInt(selectedUserId.value),
      userData
    )
    updatedUser.value = updated
  } catch (err: any) {
    error.value = err.message || 'Update failed'
  } finally {
    loading.value = false
  }
}
</script>

<style scoped>
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
  font-weight: bold;
  background: #6f42c1;
}

code {
  padding: 2px 8px;
  background: #f5f5f5;
  border: 1px solid #ddd;
}

/* .user-selector {
  margin-bottom: 15px;
} */

.user-selector label {
  display: block;
  margin-bottom: 5px;
  color: #333;
  font-weight: bold;
}

.user-select {
  padding: 5px 10px;
  border: 1px solid #ccc;
}

.update-form {
  background: #fff;
  padding: 15px;
  border: 1px solid #ddd;
}

.update-form h5 {
  margin: 0 0 15px 0;
  color: #333;
}

.form-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 15px;
  margin-bottom: 15px;
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

.update-btn {
  padding: 8px 16px;
  background: #6f42c1;
  color: white;
  border: none;
  cursor: pointer;
}

.update-btn:disabled {
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

.comparison-view {
  display: grid;
  grid-template-columns: 1fr auto 1fr;
  gap: 15px;
  margin-bottom: 15px;
}

.before-card,
.after-card {
  background: #f8f9fa;
  padding: 15px;
  border: 1px solid #ddd;
}

.before-card {
  border-left: 4px solid #6c757d;
}

.after-card {
  border-left: 4px solid #6f42c1;
}

.before-card h5,
.after-card h5 {
  margin: 0 0 10px 0;
  color: #333;
}

.arrow {
  font-size: 20px;
  color: #6f42c1;
  align-self: center;
}

.info-item {
  display: flex;
  justify-content: space-between;
  padding: 5px 0;
  border-bottom: 1px solid #ddd;
}

.info-item:last-child {
  border-bottom: none;
}

.label {
  font-weight: bold;
  color: #666;
}

.value {
  color: #333;
}

.value.highlight {
  color: #6f42c1;
  background: #e7e1f0;
  padding: 2px 5px;
}

.raw-response {
  background: #f8f9fa;
  border: 1px solid #ddd;
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
