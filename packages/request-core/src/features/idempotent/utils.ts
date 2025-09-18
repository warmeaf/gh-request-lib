/**
 * @description 安全的JSON序列化
 */
export function safeStringify(data: unknown): string {
  try {
    return JSON.stringify(data)
  } catch (_error) {
    return `[${typeof data}]`
  }
}

/**
 * @description 简单哈希函数（降级方案）
 */
export function simpleHash(str: string): string {
  let hash = 0
  if (str.length === 0) return hash.toString()

  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = (hash << 5) - hash + char
    hash = hash & hash // 转换为32位整数
  }

  return Math.abs(hash).toString(36)
}

/**
 * @description 安全克隆数据
 */
export function safeCloneData<T>(
  data: T,
  cloneType: 'deep' | 'shallow' | 'none' = 'none'
): T {
  if (cloneType === 'none') return data

  try {
    if (cloneType === 'deep') {
      return JSON.parse(JSON.stringify(data)) as T
    } else if (cloneType === 'shallow') {
      if (Array.isArray(data)) return [...data] as unknown as T
      if (data && typeof data === 'object')
        return { ...(data as Record<string, unknown>) } as unknown as T
    }
  } catch (error) {
    console.warn('[IdempotentFeature] Clone failed, returning original data:', error)
  }

  return data
}

/**
 * @description 创建占位Promise（Deferred）
 */
export function createDeferred<T>(): {
  promise: Promise<T>
  resolve: (value: T) => void
  reject: (reason?: unknown) => void
} {
  let resolve!: (value: T) => void
  let reject!: (reason?: unknown) => void
  const promise = new Promise<T>((res, rej) => {
    resolve = res
    reject = rej
  })
  return { promise, resolve, reject }
}
