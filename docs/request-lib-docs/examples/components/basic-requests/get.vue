<template>
  <div>
    <!-- 请求操作区 -->
    <div class="request-section">
      <div>
        <span class="method-tag">GET</span>
        <code>https://jsonplaceholder.typicode.com/users/{{ userId }}</code>
      </div>
    </div>

    <!-- 完整响应数据 -->
    <div>
      <h5>完整响应数据</h5>
      <pre class="json-data">{{ JSON.stringify(userData, null, 2) }}</pre>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
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
const userId = ref(1)
const userData = ref<any>(null)

// 发送请求
const fetchUser = async () => {
  userData.value = null

  const user = await apiClient.user.getUser(userId.value)
  userData.value = user
}

// 页面加载时自动发送一次请求
fetchUser()
</script>

<style scoped>
.request-section {
  padding-bottom: 15px;
}

.method-tag {
  padding: 2px 8px;
  color: white;
  background: #28a745;
}

code {
  padding: 2px 8px;
  background: #f5f5f5;
}

.json-data {
  margin-top: 10px;
  padding: 10px;
  background: #f8f9fa;
  color: #333;
  white-space: pre;
  overflow-x: auto;
}
</style>
