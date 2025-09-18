import { RequestConfig } from '../../interface'
import { CacheKeyConfig, CacheKeyGenerator } from '../../cache/cache-key-generator'
import { DEFAULT_CACHE_KEY_CONFIG } from './constants'
import { safeStringify, simpleHash } from './utils'

/**
 * @description 生成幂等键 - 确保完全相同的请求产生相同的键
 */
export function generateIdempotentKey(
  config: RequestConfig,
  instanceKeyConfig: CacheKeyConfig,
  overrideKeyConfig?: CacheKeyConfig
): string {
  const tempKeyGenerator = new CacheKeyGenerator({
    ...DEFAULT_CACHE_KEY_CONFIG,
    ...instanceKeyConfig,
    ...overrideKeyConfig,
  })
  const baseKey = tempKeyGenerator.generateCacheKey(config)
  return `idempotent:${baseKey}`
}

/**
 * @description 生成降级键（简化版本）
 */
export function generateFallbackKey(config: RequestConfig): string {
  try {
    const parts: string[] = [
      config.method || 'GET',
      config.url || '',
      config.data ? safeStringify(config.data) : '',
    ]
    const baseKey = parts.join('|')
    const hash = simpleHash(baseKey)
    return `idempotent:fallback:${hash}`
  } catch (_error) {
    const timestamp = Date.now()
    const random = Math.random().toString(36).substring(2, 8)
    return `idempotent:emergency:${timestamp}_${random}`
  }
}
