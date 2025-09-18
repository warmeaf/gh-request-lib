# 幂等请求示例

## 概念介绍

对完全相同的请求（方法、URL、参数、数据、参与对比的请求头）在设定时间窗口内只执行一次。后续相同请求将直接复用结果或等待正在进行中的请求返回，避免重复操作与浪费网络资源。

## 使用场景

- 表单提交：防止用户连点造成重复提交
- 数据查询：短时间内去重相同查询，提升性能
- 创建/更新：避免重复创建或重复更新导致的不一致
- 支付类操作：保证一次且仅一次执行，避免重复扣费

## 使用示例演示

以下 Demo 可直接体验幂等行为：

::::preview POST 幂等请求 || 防重复提交演示

demo-preview=./components/idempotent-requests/post.vue

::::

::::preview GET 幂等请求 || 防重复查询演示

demo-preview=./components/idempotent-requests/get.vue

::::

最小可用代码示例：

```ts
import { createApiClient } from 'request-api'
import { fetchRequestor } from 'request-imp-fetch'

class PostApi {
  constructor(public requestCore: any) {}

  // 普通 POST 请求
  async create(data: any) {
    return this.requestCore.post('/posts', data)
  }

  // 幂等 POST（防重复提交）
  async createIdempotent(data: any, cfg: any = {}) {
    return this.requestCore.postIdempotent(
      '/posts',
      data,
      {},
      {
        ttl: 30000,
        includeHeaders: ['authorization', 'content-type'],
        onDuplicate: () => console.log('Duplicate request blocked'),
        ...cfg,
      }
    )
  }
}

const api = createApiClient(
  { post: PostApi },
  { requestor: fetchRequestor, globalConfig: { timeout: 10000, debug: true } }
)

// 第一次：执行并缓存
await api.post.createIdempotent({ title: 'Hello', body: 'World' })
// 短时间内再次：直接命中缓存或复用进行中的请求
await api.post.createIdempotent({ title: 'Hello', body: 'World' })
```

GET 幂等示例：

```ts
const list1 = await api.post.requestCore.getIdempotent('/posts', { params: { page: 1 } }, { ttl: 8000 })
const list2 = await api.post.requestCore.getIdempotent('/posts', { params: { page: 1 } }, { ttl: 8000 })
console.log('Same data:', JSON.stringify(list1) === JSON.stringify(list2))
```

## API 和 配置参数说明

支持的方法（均在 `RequestCore` 上）：

```ts
requestIdempotent<T>(config: RequestConfig, idempotentConfig?: IdempotentConfig): Promise<T>
getIdempotent<T>(url: string, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T>
postIdempotent<T>(url: string, data?: any, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T>
putIdempotent<T>(url: string, data?: any, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T>
patchIdempotent<T>(url: string, data?: any, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T>
deleteIdempotent<T>(url: string, config?: Partial<RequestConfig>, idempotentConfig?: IdempotentConfig): Promise<T>

clearIdempotentCache(key?: string): Promise<void>
getIdempotentStats(): IdempotentStats
```

配置参数（`IdempotentConfig`）：

| 参数 | 类型 | 默认值 | 说明 |
| --- | --- | --- | --- |
| `ttl` | number | `30000` | 幂等保护时间（毫秒） |
| `key` | string | 自动生成 | 自定义幂等键（优先使用） |
| `includeHeaders` | string[] | `['content-type','authorization']` | 参与幂等判断的请求头白名单 |
| `includeAllHeaders` | boolean | `false` | 是否包含所有请求头（为 `true` 时忽略白名单） |
| `hashAlgorithm` | 'fnv1a'\|'xxhash'\|'simple' | `'fnv1a'` | 哈希算法 |
| `onDuplicate` | (original, duplicate) => void | - | 重复请求回调（仅通知） |

统计信息类型（`getIdempotentStats()`）：

```ts
type IdempotentStats = {
  totalRequests: number
  duplicatesBlocked: number
  pendingRequestsReused: number
  cacheHits: number
  actualNetworkRequests: number
  duplicateRate: number
  avgResponseTime: number
  keyGenerationTime: number
}
```

## 注意事项

- 合理设置 `ttl`：提交类 5–30s，查询类可更长
- 如自定义 `key`，需确保唯一性以避免误命中
- `includeAllHeaders=true` 时注意环境差异导致键不一致
- 仅成功结果会被缓存；失败不会缓存，下次会重新请求
- 可用 `clearIdempotentCache(key?)` 手动清理；不传 `key` 清理全部
