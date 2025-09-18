import { CacheFeature, CacheConfig } from '../cache'
import { IdempotentRequestContext, CacheOperationResult, CacheItem } from './types'
import { CacheKeyConfig } from '../../cache/cache-key-generator'

/**
 * @description 安全的缓存操作，带降级策略
 */
export async function safeCacheOperation<T>(
  operation: () => Promise<T | null>,
  context: IdempotentRequestContext,
  fallbackValue?: T
): Promise<CacheOperationResult<T | null>> {
  try {
    const data = await operation()
    return { success: true, data }
  } catch (error) {
    const err = error instanceof Error ? error : new Error('Unknown cache error')

    if (fallbackValue !== undefined) {
      console.warn(
        `🔄 [Idempotent] Cache operation failed, using fallback for ${context.config.method} ${context.config.url}:`,
        err.message
      )
      return {
        success: false,
        data: fallbackValue,
        error: err,
        fallbackUsed: true,
      }
    }

    return { success: false, error: err, fallbackUsed: false }
  }
}

/**
 * @description 获取缓存命中结果
 */
export async function getCacheHitResult<T>(
  cacheFeature: CacheFeature,
  context: IdempotentRequestContext,
  onHit: (cachedItem: CacheItem) => Promise<void>
): Promise<T | null> {
  const cachedItem = await cacheFeature.getCacheItem(context.idempotentKey)
  if (!cachedItem) return null

  if (cacheFeature.isCacheItemValid(cachedItem)) {
    await onHit(cachedItem)
    return cachedItem.data as T
  } else {
    await cacheFeature.removeCacheItem(context.idempotentKey)
    return null
  }
}

/**
 * @description 构造缓存配置
 */
export function buildCacheConfig(
  ttl: number,
  idempotentKey: string,
  keyGeneratorConfig: CacheKeyConfig | undefined,
  clone: 'deep' | 'shallow' | 'none'
): CacheConfig {
  return {
    ttl,
    key: idempotentKey,
    keyGenerator: keyGeneratorConfig,
    clone,
  }
}
