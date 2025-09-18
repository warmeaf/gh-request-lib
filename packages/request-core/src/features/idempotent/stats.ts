import { IdempotentStats } from '../../interface'

/**
 * @description 创建初始统计数据
 */
export function createInitialStats(): IdempotentStats {
  return {
    totalRequests: 0,
    duplicatesBlocked: 0,
    pendingRequestsReused: 0,
    cacheHits: 0,
    actualNetworkRequests: 0,
    duplicateRate: 0,
    avgResponseTime: 0,
    keyGenerationTime: 0,
  }
}

/**
 * @description 根据总请求数动态计算重复率
 */
export function withDuplicateRate(stats: IdempotentStats): IdempotentStats {
  const duplicateRate =
    stats.totalRequests > 0
      ? (stats.duplicatesBlocked / stats.totalRequests) * 100
      : 0
  return { ...stats, duplicateRate }
}

/**
 * @description 更新平均响应时间
 */
export function updateAvgResponseTime(
  stats: IdempotentStats,
  responseTime: number
): void {
  const totalResponseTime = stats.avgResponseTime * (stats.totalRequests - 1)
  stats.avgResponseTime =
    (totalResponseTime + responseTime) / stats.totalRequests
}

/**
 * @description 更新平均键生成时间
 */
export function updateAvgKeyGenTime(
  stats: IdempotentStats,
  keyGenTime: number
): void {
  const totalKeyTime = stats.keyGenerationTime * (stats.totalRequests - 1)
  stats.keyGenerationTime = (totalKeyTime + keyGenTime) / stats.totalRequests
}
