<template>
  <div class="demo-container">
    <!-- 查询区域 -->
    <div class="query-section">
      <div class="query-controls">
        <div class="input-group">
          <label>用户ID:</label>
          <input
            v-model="userId"
            type="number"
            placeholder="1-10"
            min="1"
            max="10"
            class="user-input"
          />
        </div>
        <div class="button-group">
          <button
            @click="fetchNormal"
            :disabled="!isValidUserId"
            class="btn btn-normal"
          >
            普通查询
          </button>
          <button
            @click="fetchIdempotent"
            :disabled="!isValidUserId"
            class="btn btn-idempotent"
          >
            🔒 幂等查询
          </button>
        </div>
      </div>

      <!-- 用户信息显示 -->
      <div v-if="currentUser" class="user-card">
        <div class="user-avatar">👤</div>
        <div class="user-info">
          <h4>{{ currentUser.name }}</h4>
          <p>{{ currentUser.email }}</p>
          <p>{{ currentUser.company?.name }}</p>
        </div>
        <div class="response-badge" :class="responseType">
          {{ responseTypeText }}
        </div>
      </div>
    </div>

    <!-- 请求统计 -->
    <div class="stats-section">
      <h4>📊 请求统计</h4>
      <div class="stats-container">
        <div class="stat-item">
          <span class="stat-label">普通请求次数:</span>
          <span class="stat-value">{{ normalRequestCount }}</span>
        </div>
        <div class="stat-item">
          <span class="stat-label">幂等请求次数:</span>
          <span class="stat-value">{{ idempotentRequestCount }}</span>
        </div>
        <button @click="resetStats" class="reset-btn">重置统计</button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

class UserApi {
  requestCore: any

  constructor(requestCore: any) {
    this.requestCore = requestCore
  }

  async getUser(userId: number) {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`
    return this.requestCore.get(url)
  }

  async getUserIdempotent(userId: number) {
    const url = `https://jsonplaceholder.typicode.com/users/${userId}`
    return this.requestCore.getIdempotent(
      url,
      {},
      {
        ttl: 8000,
        includeHeaders: ['accept'],
        onDuplicate: (original, duplicate) => {
          console.log('检测到重复查询:', duplicate.url)
        },
      }
    )
  }
}

const apiClient = createApiClient(
  { user: UserApi },
  {
    requestor: fetchRequestor,
    globalConfig: { timeout: 10000, debug: true },
  }
)

const userId = ref(1)
const currentUser = ref<any>(null)

const responseType = ref('')
const responseTypeText = ref('')

const normalRequestCount = ref(0)
const idempotentRequestCount = ref(0)

const isValidUserId = computed(() => {
  return userId.value && userId.value >= 1 && userId.value <= 10
})

const resetStats = () => {
  normalRequestCount.value = 0
  idempotentRequestCount.value = 0
}

const fetchNormal = async () => {
  try {
    const user = await apiClient.user.getUser(userId.value)
    console.log(user, 'getUser')

    currentUser.value = user
    responseType.value = 'network'
    responseTypeText.value = '🌐 网络请求'

    normalRequestCount.value++
  } catch (error: any) {}
}

const fetchIdempotent = async () => {
  try {
    const user = await apiClient.user.getUserIdempotent(userId.value)
    console.log(user, 'getUserIdempotent')

    currentUser.value = user

    idempotentRequestCount.value++
  } catch (error: any) {}
}
</script>

<style scoped>
.demo-container {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui,
    sans-serif;
}

.demo-container > * {
  margin-bottom: 20px;
}

/* 查询区域 */
.query-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
}

.query-controls {
  display: flex;
  gap: 20px;
  align-items: flex-end;
  margin-bottom: 20px;
}

.input-group {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.input-group label {
  font-weight: 600;
  color: #24292e;
  font-size: 14px;
}

.user-input {
  padding: 8px 12px;
  border: 1px solid #d1d9e0;
  border-radius: 4px;
  width: 120px;
}

.user-input:focus {
  outline: none;
  border-color: #0366d6;
  box-shadow: 0 0 0 2px rgba(3, 102, 214, 0.1);
}

.button-group {
  display: flex;
  gap: 10px;
}

.btn {
  padding: 10px 20px;
  border: none;
  border-radius: 5px;
  cursor: pointer;
  font-size: 14px;
  font-weight: 600;
  transition: all 0.2s;
}

.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.btn-normal {
  background: #28a745;
  color: white;
}

.btn-normal:hover:not(:disabled) {
  background: #218838;
}

.btn-idempotent {
  background: #007acc;
  color: white;
}

.btn-idempotent:hover:not(:disabled) {
  background: #0056b3;
}

/* 用户信息卡片 */
.user-card {
  display: flex;
  align-items: center;
  gap: 15px;
  padding: 15px;
  background: #f8f9fa;
  border-radius: 8px;
  border-left: 4px solid #007acc;
  margin-top: 15px;
}

.user-avatar {
  font-size: 40px;
}

.user-info {
  flex: 1;
}

.user-info h4 {
  margin: 0 0 5px 0;
  color: #24292e;
}

.user-info p {
  margin: 2px 0;
  color: #666;
  font-size: 14px;
}

.response-badge {
  padding: 8px 12px;
  border-radius: 20px;
  font-size: 12px;
  font-weight: bold;
  text-align: center;
}

.response-badge.network {
  background: #28a745;
  color: white;
}

.response-badge.cached {
  background: #ffc107;
  color: #212529;
}

.response-badge.pending {
  background: #17a2b8;
  color: white;
}

/* 统计区域 */
.stats-section {
  background: white;
  padding: 20px;
  border-radius: 8px;
  border: 1px solid #e1e5e9;
}

.stats-section h4 {
  margin: 0 0 15px 0;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stats-container {
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 0;
  border-bottom: 1px solid #f1f3f4;
}

.stat-item:last-child {
  border-bottom: none;
}

.stat-label {
  font-weight: 600;
  color: #24292e;
}

.stat-value {
  font-family: 'Courier New', monospace;
  font-size: 16px;
  font-weight: bold;
  color: #007acc;
}

.reset-btn {
  background: #dc3545;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 4px;
  font-size: 14px;
  cursor: pointer;
  margin-top: 10px;
  align-self: flex-start;
}

.reset-btn:hover {
  background: #c82333;
}
</style>
