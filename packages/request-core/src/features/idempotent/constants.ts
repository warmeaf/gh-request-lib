import { CacheKeyConfig } from '../../cache/cache-key-generator'

/**
 * @description 幂等功能默认配置常量
 */
export const DEFAULT_IDEMPOTENT_CONFIG = {
  TTL: 30000, // 默认30秒幂等保护
  MAX_ENTRIES: 5000, // 最大缓存条目数
  DEFAULT_INCLUDE_HEADERS: ['content-type', 'authorization'] as string[],
} as const

/**
 * @description 默认缓存键生成配置
 */
export const DEFAULT_CACHE_KEY_CONFIG: CacheKeyConfig = {
  includeHeaders: true,
  headersWhitelist: ['content-type', 'authorization', 'x-api-key'],
  maxKeyLength: 512,
  enableHashCache: true,
  hashAlgorithm: 'fnv1a',
} as const
