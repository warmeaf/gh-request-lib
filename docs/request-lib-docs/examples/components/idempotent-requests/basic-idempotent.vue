<template>
  <n-flex vertical>
    <!-- 请求操作区 -->
    <n-flex align="center">
      <n-tag type="warning">POST</n-tag>
      <n-tag type="info">https://jsonplaceholder.typicode.com/posts</n-tag>
    </n-flex>

    <!-- 表单区域 -->
    <n-card size="small" title="表单内容">
      <n-flex vertical>
        <n-flex vertical>
          <n-text depth="3">标题</n-text>
          <n-input
            v-model:value="formData.title"
            placeholder="输入文章标题"
          />
        </n-flex>

        <n-flex vertical>
          <n-text depth="3">内容</n-text>
          <n-input
            v-model:value="formData.body"
            type="textarea"
            placeholder="输入文章内容..."
            :rows="3"
          />
        </n-flex>

        <n-flex align="center">
          <n-button
            type="primary"
            @click="submitForm"
            :disabled="!isFormValid"
            :loading="loading"
          >
            提交表单
          </n-button>
          <n-button @click="submitFormMultipleTimes">
            快速点击 5 次测试
          </n-button>
          <n-button @click="clearResult">清除结果</n-button>
        </n-flex>
      </n-flex>
    </n-card>

    <!-- 幂等保护状态 -->
    <n-card size="small" title="幂等保护状态">
      <n-flex vertical>
        <n-text>
          <n-text strong>保护时间 (TTL): </n-text>
          <n-tag type="info">{{ ttl / 1000 }}秒</n-tag>
        </n-text>
        <n-text>
          <n-text strong>提交次数: </n-text>
          <n-tag type="warning">{{ clickCount }}</n-tag>
        </n-text>
        <n-text>
          <n-text strong>实际请求次数: </n-text>
          <n-tag :type="actualRequestCount === clickCount ? 'default' : 'success'">
            {{ actualRequestCount }}
          </n-tag>
        </n-text>
        <n-text>
          <n-text strong>阻止的重复请求: </n-text>
          <n-tag type="error">{{ clickCount - actualRequestCount }}</n-tag>
        </n-text>
        <n-text depth="3">
          提示：在 {{ ttl / 1000 }} 秒内多次提交相同内容，只会执行第一次请求
        </n-text>
        <n-progress
          v-if="timeRemaining > 0"
          :percentage="(timeRemaining / ttl) * 100"
          :show-indicator="false"
          status="success"
        />
        <n-text v-if="timeRemaining > 0" depth="3">
          幂等保护剩余时间：{{ (timeRemaining / 1000).toFixed(1) }}秒
        </n-text>
      </n-flex>
    </n-card>

    <!-- 重复请求日志 -->
    <n-card v-if="duplicateLogs.length > 0" size="small" title="重复请求日志">
      <n-scrollbar style="max-height: 150px">
        <n-flex vertical>
          <n-alert
            v-for="(log, index) in duplicateLogs"
            :key="index"
            type="warning"
            size="small"
          >
            {{ log }}
          </n-alert>
        </n-flex>
      </n-scrollbar>
    </n-card>

    <!-- 响应结果 -->
    <n-alert v-if="error" type="error" title="请求失败">
      {{ error }}
    </n-alert>

    <n-code
      v-if="result"
      :code="JSON.stringify(result, null, 2)"
      :hljs="hljs"
      language="json"
    />

    <n-empty v-if="!result && !error && !loading" description="填写表单并点击提交按钮" />
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
  NInput,
  NCard,
  NText,
  NAlert,
  NProgress,
  NScrollbar,
} from 'naive-ui'
import { createApiClient, type RequestCore } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'
import hljs from 'highlight.js/lib/core'
import json from 'highlight.js/lib/languages/json'

hljs.registerLanguage('json', json)

// 文章API类 - 使用幂等请求
class PostApi {
  requestCore: RequestCore
  constructor(requestCore: RequestCore) {
    this.requestCore = requestCore
  }

  // 使用幂等请求提交表单
  async createPost(postData: any, onDuplicate?: (original: any, duplicate: any) => void) {
    return this.requestCore.postIdempotent(
      'https://jsonplaceholder.typicode.com/posts',
      postData,
      undefined,
      {
        ttl: 30000, // 30秒保护期
        onDuplicate: onDuplicate,
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
const formData = ref({
  title: '我的新文章',
  body: '这是一个使用幂等请求防止重复提交的示例...',
  userId: 1,
})

const loading = ref(false)
const error = ref('')
const result = ref<any>(null)
const clickCount = ref(0)
const actualRequestCount = ref(0)
const duplicateLogs = ref<string[]>([])
const ttl = ref(30000) // 30秒
const timeRemaining = ref(0)
let ttlTimer: any = null

// 表单验证
const isFormValid = computed(() => {
  return formData.value.title.trim() && formData.value.body.trim()
})

// 格式化时间
const formatTime = () => {
  const now = new Date()
  return `${now.getHours()}:${now.getMinutes()}:${now.getSeconds()}`
}

// 开始倒计时
const startTTLCountdown = () => {
  // 清除之前的定时器
  if (ttlTimer) {
    clearInterval(ttlTimer)
  }

  timeRemaining.value = ttl.value

  ttlTimer = setInterval(() => {
    timeRemaining.value -= 100
    if (timeRemaining.value <= 0) {
      clearInterval(ttlTimer)
      timeRemaining.value = 0
    }
  }, 100)
}

// 提交表单
const submitForm = async () => {
  if (!isFormValid.value) {
    error.value = 'Please fill in title and content'
    return
  }

  clickCount.value++
  loading.value = true
  error.value = ''

  try {
    // 使用标志位标识是否是重复请求
    let isDuplicate = false
    
    const response = await apiClient.post.createPost(
      {
        title: formData.value.title,
        body: formData.value.body,
        userId: formData.value.userId,
      },
      (original, duplicate) => {
        // 重复请求回调 - 标记为重复请求
        isDuplicate = true
        const log = `[${formatTime()}] Duplicate request blocked`
        duplicateLogs.value.unshift(log)
        console.warn('Duplicate request detected:', duplicate)
      }
    )

    // 只有非重复请求才增加实际请求计数并重启倒计时
    if (!isDuplicate) {
      actualRequestCount.value++
      result.value = response
      startTTLCountdown()
    }
  } catch (err: any) {
    error.value = err.message || 'Request failed'
    // 发生错误时也算作实际请求
    actualRequestCount.value++
  } finally {
    loading.value = false
  }
}

// 快速点击多次测试
const submitFormMultipleTimes = async () => {
  if (!isFormValid.value) {
    error.value = 'Please fill in title and content'
    return
  }

  console.log('Starting multiple submissions test...')
  
  // 快速连续提交 5 次
  for (let i = 0; i < 5; i++) {
    submitForm()
    await new Promise(resolve => setTimeout(resolve, 100))
  }
  
  console.log('Multiple submissions test completed')
}

// 清除结果
const clearResult = () => {
  result.value = null
  error.value = ''
  clickCount.value = 0
  actualRequestCount.value = 0
  duplicateLogs.value = []
  timeRemaining.value = 0
  if (ttlTimer) {
    clearInterval(ttlTimer)
  }
}
</script>

