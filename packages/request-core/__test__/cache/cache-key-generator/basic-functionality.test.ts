import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'
import {
    CACHE_REQUEST_CONFIGS
} from '../cache-test-helpers'

describe('Cache Key Generation - Basic Functionality', () => {
    let keyGenerator: CacheKeyGenerator

    beforeEach(() => {
        keyGenerator = new CacheKeyGenerator()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('基本键生成功能', () => {
        it('should generate consistent keys for same request config', () => {
            const config = CACHE_REQUEST_CONFIGS.GET_USERS

            const key1 = keyGenerator.generateCacheKey(config)
            const key2 = keyGenerator.generateCacheKey(config)

            expect(key1).toBe(key2)
            expect(key1).toBeTypeOf('string')
            expect(key1.length).toBeGreaterThan(0)
        })

        it('should generate different keys for different URLs', () => {
            const config1 = CACHE_REQUEST_CONFIGS.GET_USERS
            const config2 = CACHE_REQUEST_CONFIGS.GET_USER_BY_ID

            const key1 = keyGenerator.generateCacheKey(config1)
            const key2 = keyGenerator.generateCacheKey(config2)

            expect(key1).not.toBe(key2)
        })

        it('should generate different keys for different HTTP methods', () => {
            const getConfig = CACHE_REQUEST_CONFIGS.GET_USERS
            const postConfig = CACHE_REQUEST_CONFIGS.POST_USER

            const getKey = keyGenerator.generateCacheKey(getConfig)
            const postKey = keyGenerator.generateCacheKey(postConfig)

            expect(getKey).not.toBe(postKey)
        })

        it('should generate different keys for requests with different data', () => {
            const config1 = {
                url: 'https://api.example.com/users',
                method: 'POST' as const,
                data: { name: 'John', age: 25 }
            }

            const config2 = {
                url: 'https://api.example.com/users',
                method: 'POST' as const,
                data: { name: 'Jane', age: 30 }
            }

            const key1 = keyGenerator.generateCacheKey(config1)
            const key2 = keyGenerator.generateCacheKey(config2)

            expect(key1).not.toBe(key2)
        })

        it('should handle requests with query parameters', () => {
            const config = CACHE_REQUEST_CONFIGS.GET_WITH_PARAMS

            const key = keyGenerator.generateCacheKey(config)

            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)

            // 相同参数应该生成相同的键
            const key2 = keyGenerator.generateCacheKey(config)
            expect(key).toBe(key2)
        })
    })
})