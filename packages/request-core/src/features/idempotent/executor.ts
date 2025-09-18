import { RequestConfig } from '../../interface'
import { CacheFeature } from '../cache'
import { CacheKeyConfig } from '../../cache/cache-key-generator'
import { buildCacheConfig } from './cache-ops'

/**
 * @description 执行实际请求并通过缓存功能存储结果
 */
export async function executeRequestWithCache<T>(
  cacheFeature: CacheFeature,
  config: RequestConfig,
  idempotentKey: string,
  ttl: number,
  keyGeneratorConfig: CacheKeyConfig
): Promise<T> {
  const cacheConfig = buildCacheConfig(ttl, idempotentKey, keyGeneratorConfig, 'deep')

  try {
    console.log(`🚀 [Idempotent] Starting new request: ${config.method} ${config.url}`)
    const result = await cacheFeature.requestWithCache<T>(config, cacheConfig)
    console.log(`✅ [Idempotent] Request completed: ${config.method} ${config.url}`)
    return result
  } catch (error) {
    console.error(`❌ [Idempotent] Request failed: ${config.method} ${config.url}`, error)
    throw error
  }
}
