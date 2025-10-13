<template>
  <n-flex vertical>
    <!-- 请求操作区 -->
    <n-flex align="center">
      <n-tag type="warning">POST</n-tag>
      <n-tag type="info">https://jsonplaceholder.typicode.com/posts</n-tag>
    </n-flex>

    <!-- 请求体数据表单 -->
    <n-flex vertical>
      <n-flex vertical>
        <n-text depth="3">请求体数据</n-text>
        <n-flex vertical>
          <n-text depth="3">标题</n-text>
          <n-input
            v-model:value="postData.title"
            placeholder="输入文章标题"
          />
        </n-flex>

        <n-flex vertical>
          <n-text depth="3">作者</n-text>
          <n-select
            v-model:value="postData.userId"
            :options="userOptions"
          />
        </n-flex>

        <n-flex vertical>
          <n-text depth="3">内容</n-text>
          <n-input
            v-model:value="postData.body"
            type="textarea"
            placeholder="输入文章内容..."
            :rows="3"
          />
        </n-flex>
      </n-flex>

      <n-button
        type="primary"
        @click="createPost"
        :disabled="!isFormValid"
        :loading="loading"
      >
        创建文章
      </n-button>
    </n-flex>

    <!-- 响应结果区 -->
    <n-alert v-if="error" type="error" title="请求失败">
      {{ error }}
    </n-alert>

    <n-code
      v-if="createdPost"
      :code="JSON.stringify(createdPost, null, 2)"
      :hljs="hljs"
      language="json"
    />

    <n-empty v-if="!createdPost && !error && !loading" description="填写表单并点击创建文章按钮" />
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { NFlex, NTag, NCode, NButton, NEmpty, NInput, NSelect, NAlert, NText } from 'naive-ui'
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

// 用户选项
const userOptions = [
  { label: '用户 1', value: 1 },
  { label: '用户 2', value: 2 },
  { label: '用户 3', value: 3 },
]

// 状态管理
const postData = ref({
  title: '我的新文章',
  body: '这是一个使用 POST 请求创建的文章示例...',
  userId: 1,
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
      userId: postData.value.userId,
    })
    createdPost.value = result
  } catch (err: any) {
    error.value = err.message || 'Request failed'
  } finally {
    loading.value = false
  }
}
</script>
