<template>
  <n-flex vertical>
    <!-- 请求操作区 -->
    <n-flex align="center">
      <n-tag type="error">DELETE</n-tag>
      <n-tag type="info"
        >https://jsonplaceholder.typicode.com/posts/{{ postId }}</n-tag
      >
    </n-flex>

    <!-- 文章ID选择 -->
    <n-flex vertical>
      <n-flex vertical>
        <n-text depth="3">选择要删除的文章 ID</n-text>
        <n-select
          v-model:value="postId"
          :options="postOptions"
          @update:value="loadPost"
        />
      </n-flex>

      <!-- 文章详情 -->
      <n-card v-if="postData" title="文章详情" size="small">
        <n-flex vertical>
          <n-flex align="center">
            <n-text strong>ID:</n-text>
            <n-text>{{ postData.id }}</n-text>
          </n-flex>
          <n-flex align="center">
            <n-text strong>标题:</n-text>
            <n-text>{{ postData.title }}</n-text>
          </n-flex>
          <n-flex align="center">
            <n-text strong>作者ID:</n-text>
            <n-text>{{ postData.userId }}</n-text>
          </n-flex>
          <n-flex vertical>
            <n-text strong>内容:</n-text>
            <n-text>{{ postData.body }}</n-text>
          </n-flex>
        </n-flex>
      </n-card>

      <n-button
        type="error"
        @click="deletePost"
        :disabled="!postData || deleted"
        :loading="loading"
      >
        {{ deleted ? '已删除' : '删除文章' }}
      </n-button>
    </n-flex>

    <!-- 响应结果区 -->
    <n-alert v-if="error" type="error" title="删除失败">
      {{ error }}
    </n-alert>

    <n-alert v-if="deleted && deleteResult" type="success" title="删除成功">
      文章已成功删除
    </n-alert>

    <n-code
      v-if="deleteResult"
      :code="JSON.stringify(deleteResult, null, 2)"
      :hljs="hljs"
      language="json"
    />

    <n-empty
      v-if="!postData && !loading && !deleted"
      description="选择要删除的文章"
    />
  </n-flex>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import {
  NFlex,
  NTag,
  NCode,
  NButton,
  NEmpty,
  NSelect,
  NAlert,
  NText,
  NCard,
} from 'naive-ui'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', json)

// 简化的文章API类
class PostApi {
  requestCore: any
  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getPost(postId: number) {
    return this.requestCore.get(
      `https://jsonplaceholder.typicode.com/posts/${postId}`
    )
  }

  async deletePost(postId: number) {
    return this.requestCore.delete(
      `https://jsonplaceholder.typicode.com/posts/${postId}`
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

// 文章选项
const postOptions = [
  { label: '文章 1', value: 1 },
  { label: '文章 2', value: 2 },
  { label: '文章 3', value: 3 },
  { label: '文章 4', value: 4 },
  { label: '文章 5', value: 5 },
]

// 状态管理
const postId = ref(1)
const postData = ref<any>(null)
const loading = ref(false)
const error = ref('')
const deleteResult = ref<any>(null)
const deleted = ref(false)

// 加载文章详情
const loadPost = async () => {
  if (!postId.value) {
    postData.value = null
    return
  }

  loading.value = true
  error.value = ''
  deleteResult.value = null
  deleted.value = false

  try {
    const result = await apiClient.post.getPost(postId.value)
    postData.value = result
  } catch (err: any) {
    error.value = err.message || 'Failed to load post'
    postData.value = null
  } finally {
    loading.value = false
  }
}

// 删除文章
const deletePost = async () => {
  if (!postId.value || deleted.value) {
    return
  }

  loading.value = true
  error.value = ''
  deleteResult.value = null

  try {
    const result = await apiClient.post.deletePost(postId.value)
    deleteResult.value = result
    deleted.value = true
  } catch (err: any) {
    error.value = err.message || 'Delete failed'
  } finally {
    loading.value = false
  }
}

// 初始化加载第一个文章（仅在客户端）
onMounted(() => {
  loadPost()
})
</script>

