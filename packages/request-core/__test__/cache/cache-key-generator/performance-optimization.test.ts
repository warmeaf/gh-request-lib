import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'
import {
    CACHE_REQUEST_CONFIGS
} from '../cache-test-helpers'

describe('Cache Key Generation - Performance Optimization', () => {
    let keyGenerator: CacheKeyGenerator

    beforeEach(() => {
        keyGenerator = new CacheKeyGenerator()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('性能和内存管理', () => {
        it('should handle cache overflow correctly', () => {
            const keyGenWithCache = new CacheKeyGenerator({
                enableHashCache: true
            })

            // 生成大量不同的键以测试缓存溢出
            const configs = Array.from({ length: 1500 }, (_, i) => ({
                url: `https://api.example.com/item/${i}`,
                method: 'GET' as const,
                data: { id: i, value: `item-${i}` }
            }))

            // 生成所有键
            configs.forEach(config => {
                keyGenWithCache.generateCacheKey(config)
            })
        })
    })

    describe('性能优化路径', () => {
        it('should use fast path for simple params', () => {
            const simpleParams = {
                page: 1,
                limit: 10,
                sort: 'name',
                active: true,
                search: 'test'
            }

            const config = {
                url: 'https://api.example.com/data',
                method: 'GET' as const,
                params: simpleParams
            }

            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)

            // 相同简单参数应该产生相同键
            const key2 = keyGenerator.generateCacheKey(config)
            expect(key).toBe(key2)
        })

        it('should use fast path for simple arrays', () => {
            const simpleArray = [1, 2, 3, 'test', true, null]

            const config = {
                url: 'https://api.example.com/data',
                method: 'POST' as const,
                data: { items: simpleArray }
            }

            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)
        })

        it('should use fast path for simple objects', () => {
            const simpleObject = {
                id: 1,
                name: 'test',
                active: true,
                score: 95.5,
                tag: null
            }

            const config = {
                url: 'https://api.example.com/data',
                method: 'POST' as const,
                data: simpleObject
            }

            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)
        })
    })

    describe('内存泄漏防护', () => {
        it('should prevent memory leaks with large cache', () => {
            const keyGenWithCache = new CacheKeyGenerator({
                enableHashCache: true
            })

            const initialMemory = process.memoryUsage().heapUsed

            // 生成大量键
            for (let i = 0; i < 2000; i++) {
                keyGenWithCache.generateCacheKey({
                    url: `https://api.example.com/item/${i}`,
                    method: 'POST' as const,
                    data: { id: i, data: `data-${i}`.repeat(10) }
                })
            }

            const finalMemory = process.memoryUsage().heapUsed
            const memoryIncrease = finalMemory - initialMemory

            // 内存增长应该是合理的（小于10MB）
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
        })
    })

    describe('边界条件和错误处理', () => {
        it('should handle extremely long URLs', () => {
            const longUrl = 'https://api.example.com/' + 'a'.repeat(1000)
            const config = {
                url: longUrl,
                method: 'GET' as const
            }

            const keyGenWithLimit = new CacheKeyGenerator({ maxKeyLength: 100 })
            const key = keyGenWithLimit.generateCacheKey(config)

            expect(key.length).toBeLessThanOrEqual(100)
            expect(key).toBeTypeOf('string')
        })

        it('should handle very small key length limits', () => {
            const keyGenWithTinyLimit = new CacheKeyGenerator({ maxKeyLength: 5 })
            const config = CACHE_REQUEST_CONFIGS.GET_USERS

            const key = keyGenWithTinyLimit.generateCacheKey(config)
            expect(key.length).toBeLessThanOrEqual(5)
            expect(key.length).toBeGreaterThan(0)
        })

        it('should handle params with complex nested structures', () => {
            // 将复杂结构序列化为字符串，这是实际使用中的常见做法
            const complexParams = {
                filter: JSON.stringify({
                    user: { id: [1, 2, 3], status: 'active' },
                    date: { from: '2024-01-01', to: '2024-12-31' }
                }),
                sort: JSON.stringify([{ field: 'name', order: 'asc' }, { field: 'date', order: 'desc' }])
            }

            const config = {
                url: 'https://api.example.com/data',
                method: 'GET' as const,
                params: complexParams
            }

            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)

            // 相同复杂参数应该产生相同键
            const key2 = keyGenerator.generateCacheKey(config)
            expect(key).toBe(key2)
        })

        it('should handle mixed data types in arrays', () => {
            const mixedArray = [
                'string',
                42,
                true,
                null,
                undefined,
                { nested: 'object' },
                [1, 2, 3],
                new Date('2024-01-01')
            ]

            const config = {
                url: 'https://api.example.com/data',
                method: 'POST' as const,
                data: { mixed: mixedArray }
            }

            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)
        })

        it('should handle headers with special characters', () => {
            const keyGenWithHeaders = new CacheKeyGenerator({
                includeHeaders: true,
                headersWhitelist: ['x-custom']
            })

            const config = {
                url: 'https://api.example.com/data',
                method: 'GET' as const,
                headers: {
                    'x-custom': 'value with spaces & special chars: 中文'
                }
            }

            const key = keyGenWithHeaders.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)
        })
    })
})