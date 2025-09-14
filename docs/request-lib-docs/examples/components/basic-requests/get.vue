<template>
  <div class="demo-container">
    <h3>📊 GET请求演示 - 获取用户信息</h3>
    <div class="demo-content">
      <div class="controls">
        <input 
          v-model="userId" 
          type="number" 
          placeholder="请输入用户ID (1-10)" 
          min="1" 
          max="10"
          class="user-input"
        />
        <button 
          @click="fetchUser" 
          :disabled="loading"
          class="fetch-btn"
        >
          {{ loading ? '获取中...' : '获取用户信息' }}
        </button>
      </div>
      
      <div class="result-section">
        <div v-if="loading" class="loading">
          🔄 正在获取用户信息...
        </div>
        
        <div v-if="error" class="error">
          ❌ {{ error }}
        </div>
        
        <div v-if="userData && !loading" class="success">
          <h4>✅ 用户信息获取成功：</h4>
          <div class="user-card">
            <div class="user-avatar">👤</div>
            <div class="user-info">
              <div><strong>姓名:</strong> {{ userData.name }}</div>
              <div><strong>邮箱:</strong> {{ userData.email }}</div>
              <div><strong>电话:</strong> {{ userData.phone }}</div>
              <div><strong>网站:</strong> {{ userData.website }}</div>
              <div><strong>公司:</strong> {{ userData.company?.name }}</div>
              <div><strong>地址:</strong> {{ userData.address?.city }}, {{ userData.address?.street }}</div>
            </div>
          </div>
          <details class="raw-data">
            <summary>查看完整响应数据</summary>
            <pre>{{ JSON.stringify(userData, null, 2) }}</pre>
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
}

// 注册API
const userApi = requestBus.register('user', UserApi)

// 组件状态
const userId = ref(1)
const loading = ref(false)
const error = ref('')
const userData = ref<any>(null)

// 获取用户信息的方法
const fetchUser = async () => {
  if (!userId.value || userId.value < 1 || userId.value > 10) {
    error.value = '请输入有效的用户ID (1-10)'
    return
  }

  loading.value = true
  error.value = ''
  userData.value = null

  try {
    const user = await userApi.getUserInfo(userId.value.toString())
    userData.value = user
  } catch (err) {
    error.value = `获取失败: ${err.message}`
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

.controls {
  display: flex;
  gap: 10px;
  align-items: center;
  margin-bottom: 20px;
}

.user-input {
  padding: 8px 12px;
  border: 1px solid #d1d9e0;
  border-radius: 4px;
  width: 200px;
}

.fetch-btn {
  padding: 8px 16px;
  background: #007acc;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.fetch-btn:hover:not(:disabled) {
  background: #005a9e;
}

.fetch-btn:disabled {
  background: #ccc;
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

.user-card {
  display: flex;
  gap: 15px;
  padding: 15px;
  background: white;
  border-radius: 6px;
  margin: 10px 0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
}

.user-avatar {
  font-size: 48px;
  align-self: flex-start;
}

.user-info {
  flex: 1;
}

.user-info > div {
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
</style>
