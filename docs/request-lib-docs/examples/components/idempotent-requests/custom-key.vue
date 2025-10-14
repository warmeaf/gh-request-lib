<template>
  <n-flex vertical>
    <!-- 说明 -->
    <n-alert type="info" title="自定义幂等键">
      使用自定义幂等键为不同用户和资源创建独立的幂等保护，实现更精细的控制。
    </n-alert>

    <!-- 用户选择 -->
    <n-card size="small" title="用户选择">
      <n-flex align="center">
        <n-text strong>当前用户：</n-text>
        <n-select
          v-model:value="currentUserId"
          :options="userOptions"
          style="width: 200px"
        />
      </n-flex>
    </n-card>

    <!-- 操作按钮组 -->
    <n-card size="small" title="用户操作">
      <n-flex vertical>
        <n-text depth="3">每个用户的操作使用独立的幂等键，不同用户之间互不影响</n-text>
        
        <n-flex align="center">
          <n-button
            type="primary"
            @click="updateProfile"
            :loading="updating"
          >
            更新个人资料
          </n-button>
          <n-tag type="info">
            key: update-profile-{{ currentUserId }}
          </n-tag>
        </n-flex>

        <n-flex align="center">
          <n-button
            type="success"
            @click="likePost(101)"
            :loading="liking"
          >
            点赞文章 101
          </n-button>
          <n-tag type="info">
            key: like-101-{{ currentUserId }}
          </n-tag>
        </n-flex>

        <n-flex align="center">
          <n-button
            type="warning"
            @click="followUser(999)"
            :loading="following"
          >
            关注用户 999
          </n-button>
          <n-tag type="info">
            key: follow-999-{{ currentUserId }}
          </n-tag>
        </n-flex>
      </n-flex>
    </n-card>

    <!-- 操作统计 -->
    <n-card size="small" title="操作统计">
      <n-flex vertical>
        <n-flex justify="space-between">
          <n-text>更新个人资料：</n-text>
          <n-flex>
            <n-tag type="success">实际请求：{{ stats.profile.actual }}</n-tag>
            <n-tag type="warning">点击次数：{{ stats.profile.total }}</n-tag>
            <n-tag type="error">阻止重复：{{ stats.profile.total - stats.profile.actual }}</n-tag>
          </n-flex>
        </n-flex>

        <n-flex justify="space-between">
          <n-text>点赞文章：</n-text>
          <n-flex>
            <n-tag type="success">实际请求：{{ stats.like.actual }}</n-tag>
            <n-tag type="warning">点击次数：{{ stats.like.total }}</n-tag>
            <n-tag type="error">阻止重复：{{ stats.like.total - stats.like.actual }}</n-tag>
          </n-flex>
        </n-flex>

        <n-flex justify="space-between">
          <n-text>关注用户：</n-text>
          <n-flex>
            <n-tag type="success">实际请求：{{ stats.follow.actual }}</n-tag>
            <n-tag type="warning">点击次数：{{ stats.follow.total }}</n-tag>
            <n-tag type="error">阻止重复：{{ stats.follow.total - stats.follow.actual }}</n-tag>
          </n-flex>
        </n-flex>

        <n-divider />

        <n-flex vertical>
          <n-text strong>测试建议：</n-text>
          <n-text depth="3">1. 快速多次点击同一个按钮，观察请求被阻止</n-text>
          <n-text depth="3">2. 切换不同用户，观察幂等键的独立性</n-text>
          <n-text depth="3">3. 等待 10 秒后再次点击，可以重新发起请求</n-text>
        </n-flex>
      </n-flex>
    </n-card>

    <!-- 活动日志 -->
    <n-card size="small" title="活动日志">
      <n-scrollbar style="max-height: 200px">
        <n-flex vertical>
          <n-card
            v-for="(log, index) in activityLogs"
            :key="index"
            size="small"
            :bordered="false"
          >
            <n-flex align="center" justify="space-between">
              <n-flex align="center">
                <n-tag :type="log.type">{{ log.action }}</n-tag>
                <n-text depth="3">{{ log.time }}</n-text>
              </n-flex>
              <n-text>{{ log.message }}</n-text>
            </n-flex>
          </n-card>
          <n-empty v-if="activityLogs.length === 0" description="暂无活动日志" />
        </n-flex>
      </n-scrollbar>
    </n-card>
  </n-flex>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import {
  NFlex,
  NTag,
  NButton,
  NCard,
  NText,
  NAlert,
  NSelect,
  NEmpty,
  NDivider,
  NScrollbar,
} from 'naive-ui'
import { createApiClient, type RequestCore } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

// 用户API类 - 使用自定义幂等键
class UserApi {
  requestCore: RequestCore
  constructor(requestCore: RequestCore) {
    this.requestCore = requestCore
  }

  // 更新个人资料 - 按用户隔离
  async updateProfile(userId: number, data: any) {
    return this.requestCore.putIdempotent(
      `https://jsonplaceholder.typicode.com/users/${userId}`,
      data,
      undefined,
      {
        ttl: 10000, // 10秒
        key: `update-profile-${userId}`, // 每个用户独立的幂等键
      }
    )
  }

  // 点赞文章 - 按用户和资源组合
  async likePost(postId: number, userId: number) {
    return this.requestCore.postIdempotent(
      `https://jsonplaceholder.typicode.com/posts/${postId}/like`,
      { userId },
      undefined,
      {
        ttl: 10000,
        key: `like-${postId}-${userId}`, // 用户+文章的组合键
      }
    )
  }

  // 关注用户 - 按关注关系隔离
  async followUser(targetUserId: number, currentUserId: number) {
    return this.requestCore.postIdempotent(
      `https://jsonplaceholder.typicode.com/users/${targetUserId}/follow`,
      { followerId: currentUserId },
      undefined,
      {
        ttl: 10000,
        key: `follow-${targetUserId}-${currentUserId}`, // 关注关系键
      }
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

// 用户选项
const userOptions = [
  { label: '用户 Alice (ID: 1)', value: 1 },
  { label: '用户 Bob (ID: 2)', value: 2 },
  { label: '用户 Charlie (ID: 3)', value: 3 },
  { label: '用户 David (ID: 4)', value: 4 },
]

// 状态管理
const currentUserId = ref(1)
const updating = ref(false)
const liking = ref(false)
const following = ref(false)

// 操作统计
const stats = ref({
  profile: { total: 0, actual: 0 },
  like: { total: 0, actual: 0 },
  follow: { total: 0, actual: 0 },
})

// 活动日志类型
interface ActivityLog {
  action: string
  message: string
  time: string
  type: 'success' | 'warning' | 'error' | 'info'
}

const activityLogs = ref<ActivityLog[]>([])

// 格式化时间
const formatTime = () => {
  const now = new Date()
  return `${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}:${now.getSeconds().toString().padStart(2, '0')}`
}

// 添加日志
const addLog = (action: string, message: string, type: ActivityLog['type']) => {
  activityLogs.value.unshift({
    action,
    message,
    time: formatTime(),
    type,
  })

  // 只保留最近 20 条日志
  if (activityLogs.value.length > 20) {
    activityLogs.value = activityLogs.value.slice(0, 20)
  }
}

// 更新个人资料
const updateProfile = async () => {
  stats.value.profile.total++
  updating.value = true

  try {
    const startTime = Date.now()
    await apiClient.user.updateProfile(currentUserId.value, {
      name: `User ${currentUserId.value}`,
      email: `user${currentUserId.value}@example.com`,
    })
    const duration = Date.now() - startTime

    // 根据响应时间判断是否是缓存响应
    if (duration < 50) {
      // 可能是幂等缓存
      addLog('更新资料', `User ${currentUserId.value} - 幂等保护生效 (${duration}ms)`, 'warning')
    } else {
      stats.value.profile.actual++
      addLog('更新资料', `User ${currentUserId.value} - 请求成功 (${duration}ms)`, 'success')
    }
  } catch (error: any) {
    addLog('更新资料', `User ${currentUserId.value} - 失败: ${error.message}`, 'error')
  } finally {
    updating.value = false
  }
}

// 点赞文章
const likePost = async (postId: number) => {
  stats.value.like.total++
  liking.value = true

  try {
    const startTime = Date.now()
    await apiClient.user.likePost(postId, currentUserId.value)
    const duration = Date.now() - startTime

    if (duration < 50) {
      addLog('点赞', `Post ${postId} by User ${currentUserId.value} - 幂等保护生效 (${duration}ms)`, 'warning')
    } else {
      stats.value.like.actual++
      addLog('点赞', `Post ${postId} by User ${currentUserId.value} - 请求成功 (${duration}ms)`, 'success')
    }
  } catch (error: any) {
    addLog('点赞', `Post ${postId} - 失败: ${error.message}`, 'error')
  } finally {
    liking.value = false
  }
}

// 关注用户
const followUser = async (targetUserId: number) => {
  stats.value.follow.total++
  following.value = true

  try {
    const startTime = Date.now()
    await apiClient.user.followUser(targetUserId, currentUserId.value)
    const duration = Date.now() - startTime

    if (duration < 50) {
      addLog('关注', `User ${currentUserId.value} -> User ${targetUserId} - 幂等保护生效 (${duration}ms)`, 'warning')
    } else {
      stats.value.follow.actual++
      addLog('关注', `User ${currentUserId.value} -> User ${targetUserId} - 请求成功 (${duration}ms)`, 'success')
    }
  } catch (error: any) {
    addLog('关注', `关注失败: ${error.message}`, 'error')
  } finally {
    following.value = false
  }
}
</script>

