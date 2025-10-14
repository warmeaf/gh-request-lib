# 并发请求示例

本文档演示了 request-api 库的并发请求功能，包括基础并发、并发控制、Fail-Fast 模式和批量操作。所有示例都使用 [JSONPlaceholder](https://jsonplaceholder.typicode.com/) 作为测试 API。

## 基础并发

演示并发请求与串行请求的性能对比，直观展示并发请求的优势。

:::preview 基础并发请求

demo-preview=./components/concurrent-requests/basic-concurrent.vue

:::

**关键要点：**

- 使用 `requestConcurrent` 方法并发执行多个请求
- 并发请求可大幅缩短总执行时间（通常快 3-10 倍）
- 结果数组的顺序与输入配置数组一致
- 使用 `getSuccessfulResults` 提取成功的结果数据

## 并发控制

演示如何通过 `maxConcurrency` 参数限制同时发起的请求数量，避免资源过度占用。

:::preview 并发数量控制

demo-preview=./components/concurrent-requests/concurrency-limit.vue

:::

**关键要点：**

- 使用 `maxConcurrency` 参数限制最大并发数
- 浏览器环境通常建议 4-6 个并发（同域限制）
- Node.js 环境可设置更大值（10-20）
- 写操作（POST/PUT/DELETE）应使用较低的并发数（3-5）
- 实时监控并发执行状态和峰值并发数

## Fail-Fast 模式

演示 Fail-Fast 模式（快速失败）和容错模式的区别，以及各自的适用场景。

:::preview Fail-Fast 模式

demo-preview=./components/concurrent-requests/fail-fast.vue

:::

**关键要点：**

- **Fail-Fast 模式**：任意请求失败立即停止所有请求并抛出错误
- **容错模式**：即使某些请求失败，继续执行其他请求
- Fail-Fast 适用于强依赖关系场景（全有或全无）
- 容错模式适用于独立请求场景（部分成功即可）
- 使用 `hasConcurrentFailures` 检查是否有失败

**模式对比：**

| 特性     | Fail-Fast 模式         | 容错模式               |
| -------- | ---------------------- | ---------------------- |
| 失败行为 | ❌ 立即停止所有请求    | ✅ 继续执行其他请求    |
| 返回结果 | 抛出错误，无结果       | 包含成功和失败结果     |
| 适用场景 | 强依赖关系，全有或全无 | 独立请求，部分成功即可 |
| 执行时间 | 更快（遇错即停）       | 更长（等待所有完成）   |
| 资源消耗 | 更少（提前终止）       | 更多（完整执行）       |

## 批量操作

演示批量创建、更新、删除等写操作的并发处理，以及结果的分类和错误处理。

:::preview 批量操作

demo-preview=./components/concurrent-requests/batch-operations.vue

:::

**关键要点：**

- 使用 `postConcurrent` 便捷方法批量 POST 请求
- 批量操作通常需要限制较低的并发数
- 使用 `getSuccessfulResults` 和 `getFailedResults` 分离成功和失败结果
- 记录失败的操作项以便后续重试
- 使用容错模式获取部分成功结果

**最佳实践：**

- **读操作（GET）**：可以使用较高的并发数（10-20），因为读操作对服务器压力较小
- **写操作（POST/PUT/DELETE）**：应限制较低的并发数（3-5），避免对数据库造成过大压力
- **失败处理**：批量操作失败时，记录失败项以便后续重试
- **容错模式**：批量操作建议使用容错模式而非 Fail-Fast，以获取部分成功结果

## 最佳实践

### 1. 合理设置并发数量

```typescript
class BestPracticeApi {
  constructor(public requestCore: RequestCore) {}

  // 读操作 - 可以更高的并发
  async batchRead(ids: string[]) {
    const configs = ids.map((id) => ({
      url: `/data/${id}`,
      method: 'GET' as const,
    }))

    return await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 20, // 读操作可以更高
    })
  }

  // 写操作 - 较低的并发
  async batchWrite(data: any[]) {
    const configs = data.map((item) => ({
      url: '/data',
      method: 'POST' as const,
      data: item,
    }))

    return await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 5, // 写操作限制更严格
    })
  }
}
```

### 2. 处理部分失败

```typescript
class RobustApi {
  constructor(public requestCore: RequestCore) {}

  async batchProcess(items: any[]) {
    const configs = items.map((item) => ({
      url: '/process',
      method: 'POST' as const,
      data: item,
    }))

    const results = await this.requestCore.requestConcurrent(configs, {
      maxConcurrency: 5,
      failFast: false, // 允许部分失败
    })

    const successful = this.requestCore.getSuccessfulResults(results)
    const failed = this.requestCore.getFailedResults(results)

    // 记录失败的项，以便后续重试
    if (failed.length > 0) {
      const failedItems = failed.map((f) => items[f.index])
      await this.saveFailedItems(failedItems)
      console.warn(`${failed.length} items failed, saved for retry`)
    }

    return successful
  }

  private async saveFailedItems(items: any[]) {
    // 保存失败项的逻辑
  }
}
```

### 3. 使用超时保护

```typescript
class TimeoutProtectedApi {
  constructor(public requestCore: RequestCore) {}

  async batchFetch(urls: string[]) {
    try {
      return await this.requestCore.getConcurrent(urls, {
        maxConcurrency: 10,
        timeout: 30000, // 整个批量操作 30 秒超时
      })
    } catch (error) {
      if (error instanceof Error && error.message.includes('timeout')) {
        console.error('Batch operation timeout')
        // 降级处理
        return this.fallbackFetch(urls)
      }
      throw error
    }
  }

  private async fallbackFetch(urls: string[]) {
    // 降级逻辑：减少并发数或使用缓存
    return []
  }
}
```

### 4. 分批处理大量请求

```typescript
class ChunkedApi {
  constructor(public requestCore: RequestCore) {}

  // 将大量请求分批处理
  async processManyRequests(items: any[], batchSize: number = 100) {
    const results = []

    // 分批处理
    for (let i = 0; i < items.length; i += batchSize) {
      const batch = items.slice(i, i + batchSize)
      console.log(
        `Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(
          items.length / batchSize
        )}`
      )

      const configs = batch.map((item) => ({
        url: '/process',
        method: 'POST' as const,
        data: item,
      }))

      const batchResults = await this.requestCore.requestConcurrent(configs, {
        maxConcurrency: 10,
      })

      results.push(...batchResults)

      // 批次之间添加短暂延迟，避免服务器过载
      if (i + batchSize < items.length) {
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }

    return results
  }
}
```

## 性能对比

| 场景               | 串行执行 | 并发执行（并发数 5） | 性能提升 |
| ------------------ | -------- | -------------------- | -------- |
| 获取 10 个资源     | ~5000ms  | ~1000ms              | 5x       |
| 获取 20 个资源     | ~10000ms | ~2000ms              | 5x       |
| 批量创建 10 条记录 | ~5000ms  | ~1500ms              | 3.3x     |
| 批量更新 20 条记录 | ~10000ms | ~3000ms              | 3.3x     |

_注：实际性能取决于网络延迟、服务器响应时间等因素_

## 适用场景

### 适合使用并发请求的场景

✅ **页面初始化数据加载**：同时获取用户信息、配置、权限等
✅ **批量数据获取**：获取多个用户、文章、产品等
✅ **图片/文件预加载**：批量加载资源文件
✅ **批量文件上传**：同时上传多个文件
✅ **分页数据并行获取**：一次性加载多页数据
✅ **API 健康检查**：同时检查多个服务的健康状态

### 不适合使用并发请求的场景

❌ **请求之间有强依赖关系**：使用串行请求
❌ **服务器有严格的速率限制**：可能触发限流
❌ **需要严格的执行顺序**：使用串行请求功能
❌ **单个请求即可满足需求**：没必要使用并发

## 注意事项

1. **并发数量**：根据服务器能力和网络条件合理设置 maxConcurrency
2. **内存占用**：大量并发请求会占用较多内存，注意监控
3. **错误处理**：决定是使用 failFast 还是允许部分失败
4. **超时设置**：为批量操作设置合理的超时时间
5. **结果顺序**：结果数组的顺序与输入配置数组一致（通过 index 字段标识）
6. **服务器限制**：注意服务器的速率限制（rate limiting）
7. **浏览器限制**：同域名并发数通常限制在 6 个左右

## 相关文档

- [并发请求 API](../api/concurrent-requests.md) - 完整的并发请求 API 文档
- [串行请求示例](./serial-requests.md) - 按顺序执行请求
- [重试请求示例](./retry-logic.md) - 自动重试失败的请求
