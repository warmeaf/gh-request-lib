<template>
  <n-flex vertical>
    <!-- 请求操作区 -->
    <n-flex align="center">
      <n-tag type="warning">PUT</n-tag>
      <n-tag type="info"
        >https://jsonplaceholder.typicode.com/posts/{{ postId }}</n-tag
      >
    </n-flex>

    <!-- 文章ID选择 -->
    <n-flex vertical>
      <n-flex vertical>
        <n-text depth="3">选择要更新的文章 ID</n-text>
        <n-select
          v-model:value="postId"
          :options="postOptions"
          @update:value="loadPost"
        />
      </n-flex>

      <!-- 更新表单 -->
      <n-flex v-if="originalPost" vertical>
        <n-divider>编辑文章</n-divider>

        <n-flex vertical>
          <n-text depth="3">标题</n-text>
          <n-input v-model:value="updateForm.title" placeholder="输入文章标题" />
        </n-flex>

        <n-flex vertical>
          <n-text depth="3">作者 ID</n-text>
          <n-select v-model:value="updateForm.userId" :options="userOptions" />
        </n-flex>

        <n-flex vertical>
          <n-text depth="3">内容</n-text>
          <n-input
            v-model:value="updateForm.body"
            type="textarea"
            placeholder="输入文章内容..."
            :rows="3"
          />
        </n-flex>

        <n-button
          type="primary"
          @click="updatePost"
          :disabled="!isFormValid || !hasChanges"
          :loading="loading"
        >
          更新文章
        </n-button>
      </n-flex>
    </n-flex>

    <!-- 响应结果区 -->
    <n-alert v-if="error" type="error" title="请求失败">
      {{ error }}
    </n-alert>

    <!-- 对比展示 -->
    <n-flex v-if="updatedPost && originalPost" vertical>
      <n-divider>更新对比</n-divider>

      <n-grid :cols="2" :x-gap="12">
        <n-gi>
          <n-card title="更新前" size="small" :bordered="true">
            <n-flex vertical size="small">
              <n-flex align="center">
                <n-text strong>标题:</n-text>
                <n-text>{{ originalPost.title }}</n-text>
              </n-flex>
              <n-flex align="center">
                <n-text strong>作者ID:</n-text>
                <n-text>{{ originalPost.userId }}</n-text>
              </n-flex>
              <n-flex vertical>
                <n-text strong>内容:</n-text>
                <n-text>{{ originalPost.body }}</n-text>
              </n-flex>
            </n-flex>
          </n-card>
        </n-gi>

        <n-gi>
          <n-card title="更新后" size="small" :bordered="true">
            <n-flex vertical size="small">
              <n-flex align="center">
                <n-text strong>标题:</n-text>
                <n-text type="success">{{ updatedPost.title }}</n-text>
              </n-flex>
              <n-flex align="center">
                <n-text strong>作者ID:</n-text>
                <n-text type="success">{{ updatedPost.userId }}</n-text>
              </n-flex>
              <n-flex vertical>
                <n-text strong>内容:</n-text>
                <n-text type="success">{{ updatedPost.body }}</n-text>
              </n-flex>
            </n-flex>
          </n-card>
        </n-gi>
      </n-grid>

      <n-divider>完整响应数据</n-divider>

      <n-code
        :code="JSON.stringify(updatedPost, null, 2)"
        :hljs="hljs"
        language="json"
      />
    </n-flex>

    <n-empty
      v-if="!originalPost && !loadingPost && !error"
      description="选择要更新的文章"
    />
  </n-flex>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import {
  NFlex,
  NTag,
  NCode,
  NButton,
  NEmpty,
  NInput,
  NSelect,
  NAlert,
  NText,
  NCard,
  NGrid,
  NGi,
  NDivider,
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

  async updatePost(postId: number, postData: any) {
    return this.requestCore.put(
      `https://jsonplaceholder.typicode.com/posts/${postId}`,
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

// 文章选项
const postOptions = [
  { label: '文章 1', value: 1 },
  { label: '文章 2', value: 2 },
  { label: '文章 3', value: 3 },
  { label: '文章 4', value: 4 },
  { label: '文章 5', value: 5 },
]

// 用户选项
const userOptions = [
  { label: '用户 1', value: 1 },
  { label: '用户 2', value: 2 },
  { label: '用户 3', value: 3 },
]

// 状态管理
const postId = ref(1)
const originalPost = ref<any>(null)
const updateForm = ref({
  title: '',
  body: '',
  userId: 1,
})
const loadingPost = ref(false)
const loading = ref(false)
const error = ref('')
const updatedPost = ref<any>(null)

// 表单验证
const isFormValid = computed(() => {
  return updateForm.value.title.trim() && updateForm.value.body.trim()
})

// 检查是否有更改
const hasChanges = computed(() => {
  if (!originalPost.value) return false
  return (
    updateForm.value.title !== originalPost.value.title ||
    updateForm.value.body !== originalPost.value.body ||
    updateForm.value.userId !== originalPost.value.userId
  )
})

// 加载文章详情
const loadPost = async () => {
  if (!postId.value) {
    originalPost.value = null
    return
  }

  loadingPost.value = true
  error.value = ''
  updatedPost.value = null

  try {
    const result = await apiClient.post.getPost(postId.value)
    originalPost.value = result

    // 填充更新表单
    updateForm.value = {
      title: result.title,
      body: result.body,
      userId: result.userId,
    }
  } catch (err: any) {
    error.value = err.message || 'Failed to load post'
    originalPost.value = null
  } finally {
    loadingPost.value = false
  }
}

// 更新文章
const updatePost = async () => {
  if (!isFormValid.value || !hasChanges.value || !postId.value) {
    return
  }

  loading.value = true
  error.value = ''
  updatedPost.value = null

  try {
    const result = await apiClient.post.updatePost(postId.value, {
      title: updateForm.value.title,
      body: updateForm.value.body,
      userId: updateForm.value.userId,
      id: postId.value,
    })
    updatedPost.value = result
  } catch (err: any) {
    error.value = err.message || 'Update failed'
  } finally {
    loading.value = false
  }
}

// 初始化加载第一个文章（仅在客户端）
onMounted(() => {
  loadPost()
})
</script>

