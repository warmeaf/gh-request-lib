<template>
  <div class="demo-container">
    <h3>✏️ PUT请求演示 - 更新用户信息</h3>
    <div class="demo-content">
      <div class="user-selector">
        <label>选择要更新的用户:</label>
        <select v-model="selectedUserId" @change="loadUser" class="form-control">
          <option value="">请选择用户...</option>
          <option v-for="i in 10" :key="i" :value="i">用户 {{ i }}</option>
        </select>
      </div>

      <div v-if="originalUser" class="user-section">
        <div class="original-user">
          <h4>📋 原始用户信息:</h4>
          <div class="user-info-display">
            <div><strong>姓名:</strong> {{ originalUser.name }}</div>
            <div><strong>邮箱:</strong> {{ originalUser.email }}</div>
            <div><strong>电话:</strong> {{ originalUser.phone }}</div>
            <div><strong>网站:</strong> {{ originalUser.website }}</div>
          </div>
        </div>

        <div class="update-form">
          <h4>✏️ 更新用户信息:</h4>
          <div class="form-group">
            <label>姓名:</label>
            <input 
              v-model="updateForm.name" 
              type="text" 
              class="form-control"
            />
          </div>
          
          <div class="form-group">
            <label>邮箱:</label>
            <input 
              v-model="updateForm.email" 
              type="email" 
              class="form-control"
            />
          </div>
          
          <div class="form-group">
            <label>电话:</label>
            <input 
              v-model="updateForm.phone" 
              type="text" 
              class="form-control"
            />
          </div>
          
          <div class="form-group">
            <label>网站:</label>
            <input 
              v-model="updateForm.website" 
              type="text" 
              class="form-control"
            />
          </div>
          
          <button 
            @click="updateUser" 
            :disabled="loading || !hasChanges"
            class="update-btn"
          >
            {{ loading ? '更新中...' : '更新用户信息' }}
          </button>
        </div>
      </div>
      
      <div class="result-section">
        <div v-if="loadingUser" class="loading">
          🔄 正在加载用户信息...
        </div>
        
        <div v-if="loading" class="loading">
          ⏳ 正在更新用户信息...
        </div>
        
        <div v-if="error" class="error">
          ❌ {{ error }}
        </div>
        
        <div v-if="updatedUser && !loading" class="success">
          <h4>🎉 用户信息更新成功！</h4>
          <div class="comparison">
            <div class="before-after">
              <div class="before">
                <h5>更新前:</h5>
                <div class="user-card">
                  <div><strong>姓名:</strong> {{ originalUser.name }}</div>
                  <div><strong>邮箱:</strong> {{ originalUser.email }}</div>
                  <div><strong>电话:</strong> {{ originalUser.phone }}</div>
                  <div><strong>网站:</strong> {{ originalUser.website }}</div>
                </div>
              </div>
              <div class="after">
                <h5>更新后:</h5>
                <div class="user-card updated">
                  <div><strong>姓名:</strong> {{ updatedUser.name }}</div>
                  <div><strong>邮箱:</strong> {{ updatedUser.email }}</div>
                  <div><strong>电话:</strong> {{ updatedUser.phone }}</div>
                  <div><strong>网站:</strong> {{ updatedUser.website }}</div>
                </div>
              </div>
            </div>
          </div>
          <details class="raw-data">
            <summary>查看完整响应数据</summary>
            <pre>{{ JSON.stringify(updatedUser, null, 2) }}</pre>
          </details>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { createApiClient, type ApiClass } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 定义用户API类
class UserApi {
  requestCore: any
  
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getUserInfo(userId: string) {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`
    return this.requestCore.get(url)
  }

  async updateUser(userId: string, userData: any) {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`
    return this.requestCore.put(url, userData)
  }
}

// 创建 API 客户端实例
const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: fetchRequestor,
    globalConfig: {
      timeout: 10000,
    },
  }
)

// 获取用户 API 实例
const userApi = apiClient.user

// 组件状态
const selectedUserId = ref('')
const originalUser = ref<any>(null)
const updateForm = ref({
  name: '',
  email: '',
  phone: '',
  website: ''
})
const loadingUser = ref(false)
const loading = ref(false)
const error = ref('')
const updatedUser = ref<any>(null)

// 检查是否有更改
const hasChanges = computed(() => {
  if (!originalUser.value) return false
  
  return updateForm.value.name !== originalUser.value.name ||
         updateForm.value.email !== originalUser.value.email ||
         updateForm.value.phone !== originalUser.value.phone ||
         updateForm.value.website !== originalUser.value.website
})

// 加载用户信息
const loadUser = async () => {
  if (!selectedUserId.value) {
    originalUser.value = null
    return
  }

  loadingUser.value = true
  error.value = ''
  updatedUser.value = null

  try {
    const user = await userApi.getUserInfo(selectedUserId.value)
    originalUser.value = user
    
    // 填充更新表单
    updateForm.value = {
      name: user.name,
      email: user.email,
      phone: user.phone,
      website: user.website
    }
  } catch (err) {
    error.value = `加载用户失败: ${err.message}`
  } finally {
    loadingUser.value = false
  }
}

// 更新用户信息
const updateUser = async () => {
  if (!hasChanges.value) return

  loading.value = true
  error.value = ''
  updatedUser.value = null

  try {
    const userData = {
      ...originalUser.value,
      name: updateForm.value.name,
      email: updateForm.value.email,
      phone: updateForm.value.phone,
      website: updateForm.value.website
    }
    
    const updated = await userApi.updateUser(selectedUserId.value, userData)
    updatedUser.value = updated
  } catch (err) {
    error.value = `更新失败: ${err.message}`
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

.user-selector {
  margin-bottom: 20px;
}

.user-selector label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #24292e;
}

.user-section {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
  margin-bottom: 20px;
}

.original-user,
.update-form {
  background: white;
  padding: 15px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.user-info-display div {
  margin: 8px 0;
  padding: 5px 0;
}

.form-group {
  margin-bottom: 15px;
}

.form-group label {
  display: block;
  margin-bottom: 5px;
  font-weight: bold;
  color: #24292e;
  font-size: 14px;
}

.form-control {
  width: 100%;
  padding: 8px 12px;
  border: 1px solid #d1d9e0;
  border-radius: 4px;
  font-size: 14px;
}

.update-btn {
  padding: 10px 20px;
  background: #ffc107;
  color: #212529;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
  font-weight: bold;
}

.update-btn:hover:not(:disabled) {
  background: #e0a800;
}

.update-btn:disabled {
  background: #6c757d;
  color: white;
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

.comparison {
  margin: 15px 0;
}

.before-after {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 20px;
}

.before h5,
.after h5 {
  margin: 0 0 10px 0;
  color: #24292e;
}

.user-card {
  background: white;
  padding: 15px;
  border-radius: 6px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  border-left: 4px solid #6c757d;
}

.user-card.updated {
  border-left-color: #28a745;
  background: #f8fff9;
}

.user-card div {
  margin: 5px 0;
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
  .user-section,
  .before-after {
    grid-template-columns: 1fr;
  }
}
</style>
