<template>
  <n-flex vertical>
    <!-- 操作区 -->
    <n-flex>
      <n-button type="primary" @click="fetchUser" :loading="loading">
        获取用户 1
      </n-button>
      <n-button type="primary" @click="fetchPost" :loading="loading">
        获取文章 1
      </n-button>
      <n-button @click="clearSpecificCache">清除用户缓存</n-button>
      <n-button @click="clearAllCache" type="warning">清除所有缓存</n-button>
      <n-button @click="getCacheStats">查看缓存统计</n-button>
    </n-flex>

    <!-- 缓存统计信息 -->
    <n-card v-if="cacheStats" size="small" title="缓存统计信息">
      <n-flex vertical>
        <n-text>
          <n-text strong>缓存条目数: </n-text>
          <n-tag type="success">{{ cacheStats.size }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>最大缓存数: </n-text>
          <n-tag type="info">{{ cacheStats.maxEntries }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>存储类型: </n-text>
          <n-tag type="warning">{{ cacheStats.storageType }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>上次清理时间: </n-text>
          <n-tag>{{ formatTimestamp(cacheStats.lastCleanup) }}</n-tag>
        </n-text>
        <n-text v-if="cacheStats.hitRate !== undefined">
          <n-text strong>缓存命中率: </n-text>
          <n-tag :type="getHitRateType(cacheStats.hitRate)">
            {{ (cacheStats.hitRate * 100).toFixed(2) }}%
          </n-tag>
        </n-text>
      </n-flex>
    </n-card>

    <!-- 请求日志 -->
    <n-card size="small" title="请求日志">
      <n-flex vertical>
        <n-text
          v-for="(log, index) in requestLogs"
          :key="index"
          :type="log.type === 'cache' ? 'success' : 'default'"
        >
          [{{ log.time }}] {{ log.message }}
        </n-text>
        <n-empty v-if="requestLogs.length === 0" description="暂无日志" />
      </n-flex>
    </n-card>

    <!-- 数据显示 -->
    <n-tabs type="card" v-if="userData || postData">
      <n-tab-pane name="user" tab="用户数据">
        <n-code
          v-if="userData"
          :code="JSON.stringify(userData, null, 2)"
          :hljs="hljs"
          language="json"
        />
        <n-empty v-else description="暂无用户数据" />
      </n-tab-pane>
      <n-tab-pane name="post" tab="文章数据">
        <n-code
          v-if="postData"
          :code="JSON.stringify(postData, null, 2)"
          :hljs="hljs"
          language="json"
        />
        <n-empty v-else description="暂无文章数据" />
      </n-tab-pane>
    </n-tabs>
  </n-flex>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  NFlex,
  NTag,
  NCode,
  NButton,
  NEmpty,
  NCard,
  NText,
  NTabs,
  NTabPane,
} from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', json)

// API类 - 演示缓存管理
class UserApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getUser(userId: number) {
    return this.requestCore.getWithCache(
      `https://jsonplaceholder.typicode.com/users/${userId}`,
      {
        ttl: 300000, // 缓存 5 分钟
        key: `user-${userId}`,
      }
    )
  }

  clearUserCache(userId: number) {
    this.requestCore.clearCache(`user-${userId}`)
  }

  clearAllCache() {
    this.requestCore.clearCache()
  }

  async getCacheStats() {
    return this.requestCore.getCacheStats()
  }
}

class PostApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getPost(postId: number) {
    return this.requestCore.getWithCache(
      `https://jsonplaceholder.typicode.com/posts/${postId}`,
      {
        ttl: 300000, // 缓存 5 分钟
        key: `post-${postId}`,
      }
    )
  }
}

// 创建API客户端
const apiClient = createApiClient(
  { user: UserApi, post: PostApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000 },
  }
)

// 状态管理
const userData = ref<any>(null)
const postData = ref<any>(null)
const loading = ref(false)
const cacheStats = ref<any>(null)
const requestLogs = ref<Array<{ time: string; message: string; type: string }>>(
  []
)

// 添加日志
const addLog = (message: string, type: string = 'request') => {
  const time = new Date().toLocaleTimeString()
  requestLogs.value.unshift({ time, message, type })
  if (requestLogs.value.length > 10) {
    requestLogs.value.pop()
  }
}

// 获取用户数据
const fetchUser = async () => {
  try {
    loading.value = true
    const startTime = Date.now()

    userData.value = await apiClient.user.getUser(1)

    const duration = Date.now() - startTime
    const fromCache = duration < 10
    addLog(
      `Fetched user data (${duration}ms) - ${fromCache ? 'From cache' : 'From server'}`,
      fromCache ? 'cache' : 'request'
    )
  } catch (error) {
    console.error('Request failed:', error)
    addLog(`Failed to fetch user: ${error}`, 'error')
  } finally {
    loading.value = false
  }
}

// 获取文章数据
const fetchPost = async () => {
  try {
    loading.value = true
    const startTime = Date.now()

    postData.value = await apiClient.post.getPost(1)

    const duration = Date.now() - startTime
    const fromCache = duration < 10
    addLog(
      `Fetched post data (${duration}ms) - ${fromCache ? 'From cache' : 'From server'}`,
      fromCache ? 'cache' : 'request'
    )
  } catch (error) {
    console.error('Request failed:', error)
    addLog(`Failed to fetch post: ${error}`, 'error')
  } finally {
    loading.value = false
  }
}

// 清除特定缓存
const clearSpecificCache = () => {
  apiClient.user.clearUserCache(1)
  addLog('Cleared user cache', 'cache')
  console.log('User cache cleared')
}

// 清除所有缓存
const clearAllCache = () => {
  apiClient.user.clearAllCache()
  addLog('Cleared all cache', 'cache')
  console.log('All cache cleared')
}

// 获取缓存统计
const getCacheStats = async () => {
  try {
    cacheStats.value = await apiClient.user.getCacheStats()
    addLog('Fetched cache statistics', 'cache')
  } catch (error) {
    console.error('Failed to get cache stats:', error)
    addLog(`Failed to get cache stats: ${error}`, 'error')
  }
}

// 格式化时间戳
const formatTimestamp = (timestamp: number) => {
  return new Date(timestamp).toLocaleString()
}

// 获取命中率颜色
const getHitRateType = (hitRate: number) => {
  if (hitRate >= 0.8) return 'success'
  if (hitRate >= 0.5) return 'warning'
  return 'error'
}
</script>

