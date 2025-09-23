/**
 * @description 安全的JSON序列化
 */
export function safeStringify(data: unknown): string {
  // 先处理 JSON.stringify 会返回 undefined 的特殊情况
  if (data === undefined) {
    return '[undefined]'
  }
  
  if (typeof data === 'function') {
    return '[function]'
  }
  
  if (typeof data === 'symbol') {
    return '[symbol]'
  }
  
  if (typeof data === 'bigint') {
    return '[bigint]'
  }
  
  try {
    const result = JSON.stringify(data)
    // JSON.stringify 可能还会返回 undefined (比如对于某些复杂情况)
    return result === undefined ? `[${typeof data}]` : result
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
 * @description 清理不可序列化的值
 */
function cleanUnserializableValues(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data
  }
  
  // 处理基础类型
  if (typeof data === 'string' || typeof data === 'number' || typeof data === 'boolean') {
    return data
  }
  
  // 过滤掉不可序列化的类型
  if (typeof data === 'function' || typeof data === 'symbol' || typeof data === 'bigint') {
    return undefined // 这些值会被 JSON.stringify 过滤掉
  }
  
  // 处理 Date 对象
  if (data instanceof Date) {
    return data
  }
  
  // 处理数组
  if (Array.isArray(data)) {
    return data.map(item => cleanUnserializableValues(item))
  }
  
  // 处理普通对象
  if (typeof data === 'object') {
    const cleaned: Record<string, unknown> = {}
    for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
      const cleanedValue = cleanUnserializableValues(value)
      // 只保留不是 undefined 的值
      if (cleanedValue !== undefined) {
        cleaned[key] = cleanedValue
      }
    }
    return cleaned
  }
  
  return data
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
      // 先尝试直接序列化原始数据
      try {
        return JSON.parse(JSON.stringify(data)) as T
      } catch (directError) {
        // 检查错误类型，判断是否可以通过清理数据来修复
        const errorMessage = directError instanceof Error ? directError.message : String(directError)
        
        // 如果是因为不可序列化的值（BigInt、循环引用等），尝试清理数据
        if (errorMessage.includes('BigInt') || 
            errorMessage.includes('circular') || 
            errorMessage.includes('Converting circular')) {
          try {
            const cleanedData = cleanUnserializableValues(data)
            return JSON.parse(JSON.stringify(cleanedData)) as T
          } catch (cleanedError) {
            // 如果清理后仍然失败，返回原对象
            console.warn('[IdempotentFeature] Deep clone failed even after cleaning, returning original data:', cleanedError)
            return data
          }
        } else {
          // 其他类型的错误（比如toJSON方法抛出错误），直接返回原对象
          console.warn('[IdempotentFeature] Deep clone failed, returning original data:', directError)
          return data
        }
      }
    } else if (cloneType === 'shallow') {
      if (Array.isArray(data)) {
        const cloned = [...data] as unknown as T
        // 检查克隆是否成功（长度应该相同）
        return cloned
      }
      if (data && typeof data === 'object') {
        const cloned = { ...(data as Record<string, unknown>) } as unknown as T
        
        // 获取原对象的所有属性（包括不可枚举的）
        const originalAllKeys = Object.getOwnPropertyNames(data as Record<string, unknown>)
        const clonedAllKeys = Object.getOwnPropertyNames(cloned as Record<string, unknown>)
        
        // 如果原对象有属性但克隆后没有属性，说明克隆失败
        if (originalAllKeys.length > 0 && clonedAllKeys.length === 0) {
          console.warn('[IdempotentFeature] Shallow clone failed, returning original data')
          return data
        }
        
        // 如果原对象有不可枚举属性，但克隆后丢失了，也认为是部分失败
        const originalEnumerableKeys = Object.keys(data as Record<string, unknown>)
        const clonedEnumerableKeys = Object.keys(cloned as Record<string, unknown>)
        const hasNonEnumerableProps = originalAllKeys.length > originalEnumerableKeys.length
        
        if (hasNonEnumerableProps && clonedEnumerableKeys.length === 0) {
          console.warn('[IdempotentFeature] Shallow clone failed to copy non-enumerable properties, returning original data')
          return data
        }
        
        return cloned
      }
    }
  } catch (error) {
    console.warn('[IdempotentFeature] Clone failed, returning original data:', error)
    return data
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
