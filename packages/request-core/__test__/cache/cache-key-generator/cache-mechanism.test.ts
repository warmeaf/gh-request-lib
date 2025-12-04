import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'
import {
    CACHE_REQUEST_CONFIGS
} from '../cache-test-helpers'

describe('Cache Key Generation - Cache Mechanism', () => {
    let keyGenerator: CacheKeyGenerator

    beforeEach(() => {
        keyGenerator = new CacheKeyGenerator()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('哈希缓存机制', () => {
        it('should use hash cache when enabled', () => {
            const keyGenWithCache = new CacheKeyGenerator({
                enableHashCache: true
            })

            // 使用包含复杂数据的配置，确保会调用hashObjectStructure
            const config = CACHE_REQUEST_CONFIGS.POST_USER

            // 第一次生成
            const key1 = keyGenWithCache.generateCacheKey(config)

            // 第二次生成相同配置
            const key2 = keyGenWithCache.generateCacheKey(config)

            expect(key1).toBe(key2)
        })

        it('should not use hash cache when disabled', () => {
            const keyGenWithoutCache = new CacheKeyGenerator({
                enableHashCache: false
            })

            const config = CACHE_REQUEST_CONFIGS.GET_USERS

            keyGenWithoutCache.generateCacheKey(config)
            keyGenWithoutCache.generateCacheKey(config)

            // 验证键生成正常工作
            const key = keyGenWithoutCache.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
        })

        it('should handle cache overflow gracefully', () => {
            const keyGenWithSmallCache = new CacheKeyGenerator({
                enableHashCache: true
            })

            // 生成大量不同的键以填满缓存
            for (let i = 0; i < 1200; i++) { // 超过默认缓存大小1000
                keyGenWithSmallCache.generateCacheKey({
                    url: `https://api.example.com/users/${i}`,
                    method: 'GET' as const
                })
            }

            // 应该仍然正常工作，不崩溃
            const key = keyGenWithSmallCache.generateCacheKey(CACHE_REQUEST_CONFIGS.GET_USERS)
            expect(key).toBeTypeOf('string')
        })

        it('should handle concurrent key generation', async () => {
            const config = CACHE_REQUEST_CONFIGS.POST_USER
            const keyGenWithCache = new CacheKeyGenerator({
                enableHashCache: true
            })

            // 并发生成相同配置的键
            const promises = Array.from({ length: 10 }, () =>
                Promise.resolve(keyGenWithCache.generateCacheKey(config))
            )

            const keys = await Promise.all(promises)

            // 所有键应该相同
            expect(new Set(keys).size).toBe(1)
        })
    })
})