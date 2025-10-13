<template>
  <n-flex vertical>
    <!-- 请求操作区 -->
    <n-flex align="center">
      <n-tag type="success">GET</n-tag>
      <n-tag type="info"
        >https://jsonplaceholder.typicode.com/users/{{ userId }}</n-tag
      >
      <n-button type="primary" @click="fetchUser" :loading="loading">
        发送请求
      </n-button>
    </n-flex>
    <!-- 完整响应数据 -->
    <n-code
      v-if="userData"
      :code="JSON.stringify(userData, null, 2)"
      :hljs="hljs"
      language="json"
    />
    <n-empty v-else description="点击发送请求按钮获取数据" />
  </n-flex>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { NFlex, NTag, NCode, NButton, NEmpty } from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', json)

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
const loading = ref(false)

// 发送请求
const fetchUser = async () => {
  try {
    loading.value = true
    userData.value = null

    const user = await apiClient.user.getUser(userId.value)
    userData.value = user
  } catch (error) {
    console.error('Request failed:', error)
  } finally {
    loading.value = false
  }
}
</script>
