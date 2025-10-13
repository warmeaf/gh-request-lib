<template>
  <n-flex vertical>
    <!-- 存储类型选择 -->
    <n-card size="small" title="选择存储类型">
      <n-radio-group v-model:value="storageType">
        <n-flex>
          <n-radio value="memory">内存存储</n-radio>
          <n-radio value="localStorage">LocalStorage</n-radio>
          <n-radio value="indexedDB">IndexedDB（默认）</n-radio>
        </n-flex>
      </n-radio-group>
      <n-text depth="3" style="margin-top: 8px; display: block">
        {{ storageTypeDescription }}
      </n-text>
    </n-card>

    <!-- 请求操作区 -->
    <n-flex align="center">
      <n-tag type="success">GET</n-tag>
      <n-tag type="info"
        >https://jsonplaceholder.typicode.com/posts/{{ postId }}</n-tag
      >
      <n-input-number
        v-model:value="postId"
        :min="1"
        :max="100"
        style="width: 120px"
      />
      <n-button type="primary" @click="fetchPost" :loading="loading">
        发送请求
      </n-button>
    </n-flex>

    <!-- 缓存信息 -->
    <n-card size="small" title="缓存信息">
      <n-flex vertical>
        <n-text>
          <n-text strong>当前存储类型: </n-text>
          <n-tag :type="getStorageTypeTag()">{{ storageTypeName }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>缓存有效期: </n-text>
          <n-tag type="info">300秒（5分钟）</n-tag>
        </n-text>
        <n-text depth="3">
          提示：刷新页面后，只有 LocalStorage 和 IndexedDB 的缓存数据会保留
        </n-text>
      </n-flex>
    </n-card>

    <!-- 响应数据 -->
    <n-code
      v-if="postData"
      :code="JSON.stringify(postData, null, 2)"
      :hljs="hljs"
      language="json"
    />
    <n-empty v-else description="选择存储类型并发送请求" />
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import {
  NFlex,
  NTag,
  NCode,
  NButton,
  NEmpty,
  NCard,
  NText,
  NRadioGroup,
  NRadio,
  NInputNumber,
} from 'naive-ui'
import { createApiClient, StorageType } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', json)

// 文章API类 - 支持不同存储类型
class PostApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getPost(postId: number, storageType: StorageType) {
    return this.requestCore.requestWithCache(
      {
        url: `https://jsonplaceholder.typicode.com/posts/${postId}`,
        method: 'GET',
      },
      {
        ttl: 300000, // 缓存 5 分钟
        storageType: storageType,
        key: `post-${postId}-${storageType}`,
      }
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
const postId = ref(1)
const postData = ref<any>(null)
const loading = ref(false)
const storageType = ref<'memory' | 'localStorage' | 'indexedDB'>('indexedDB')

// 存储类型映射
const storageTypeMap: Record<string, StorageType> = {
  memory: StorageType.MEMORY,
  localStorage: StorageType.LOCAL_STORAGE,
  indexedDB: StorageType.INDEXED_DB,
}

// 存储类型名称
const storageTypeName = computed(() => {
  const names: Record<string, string> = {
    memory: '内存存储',
    localStorage: 'LocalStorage',
    indexedDB: 'IndexedDB',
  }
  return names[storageType.value]
})

// 存储类型描述
const storageTypeDescription = computed(() => {
  const descriptions: Record<string, string> = {
    memory: '存储在内存中，页面刷新后数据丢失，适合临时数据',
    localStorage: '存储在 LocalStorage，持久化保存，适合小量数据（5-10MB限制）',
    indexedDB: '存储在 IndexedDB，持久化保存，适合大量数据',
  }
  return descriptions[storageType.value]
})

// 获取存储类型标签颜色
const getStorageTypeTag = (): 'default' | 'success' | 'error' | 'warning' | 'info' | 'primary' => {
  const tags: Record<string, 'default' | 'success' | 'error' | 'warning' | 'info' | 'primary'> = {
    memory: 'warning',
    localStorage: 'info',
    indexedDB: 'success',
  }
  return tags[storageType.value]
}

// 发送请求
const fetchPost = async () => {
  try {
    loading.value = true
    postData.value = null

    const currentStorageType = storageTypeMap[storageType.value]
    const post = await apiClient.post.getPost(postId.value, currentStorageType)
    postData.value = post
  } catch (error) {
    console.error('Request failed:', error)
  } finally {
    loading.value = false
  }
}
</script>
