<template>
  <n-flex vertical>
    <!-- 请求操作区 -->
    <n-flex align="center">
      <n-tag type="success">GET</n-tag>
      <n-tag type="info">https://jsonplaceholder.typicode.com/users/1</n-tag>
      <n-button type="primary" @click="fetchUser" :loading="loading">
        发送请求
      </n-button>
      <n-button @click="clearUserCache">清除缓存</n-button>
    </n-flex>

    <!-- 请求信息 -->
    <n-card size="small" title="请求状态">
      <n-flex vertical>
        <n-text>
          <n-text strong>请求次数: </n-text>
          <n-tag type="warning">{{ requestCount }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>缓存状态: </n-text>
          <n-tag :type="fromCache ? 'success' : 'default'">
            {{ fromCache ? '从缓存读取' : '从服务器获取' }}
          </n-tag>
        </n-text>
        <n-text depth="3">
          提示：在缓存有效期（60秒）内再次点击"发送请求"，数据将从缓存中读取，不会增加请求次数
        </n-text>
      </n-flex>
    </n-card>

    <!-- 响应数据 -->
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
import { NFlex, NTag, NCode, NButton, NEmpty, NCard, NText } from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', json)

// 用户API类 - 使用缓存
class UserApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getUser(userId: number) {
    // 使用 getWithCache 方法，设置 60 秒缓存
    return this.requestCore.getWithCache(
      `https://jsonplaceholder.typicode.com/users/${userId}`,
      {
        ttl: 60000, // 缓存 60 秒
        key: `user-${userId}`, // 自定义缓存键
      }
    )
  }

  clearCache(userId: number) {
    this.requestCore.clearCache(`user-${userId}`)
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
const fromCache = ref(false)
const requestCount = ref(0)

// 发送请求
const fetchUser = async () => {
  try {
    loading.value = true
    const startTime = Date.now()

    const user = await apiClient.user.getUser(userId.value)
    const endTime = Date.now()
    
    userData.value = user
    
    // 根据响应时间判断是否从缓存读取
    // 缓存响应通常小于 10ms，网络请求通常大于 50ms
    fromCache.value = endTime - startTime < 10
    
    if (!fromCache.value) {
      requestCount.value++
    }
  } catch (error) {
    console.error('Request failed:', error)
  } finally {
    loading.value = false
  }
}

// 清除缓存
const clearUserCache = () => {
  apiClient.user.clearCache(userId.value)
  fromCache.value = false
  console.log('Cache cleared')
}
</script>

