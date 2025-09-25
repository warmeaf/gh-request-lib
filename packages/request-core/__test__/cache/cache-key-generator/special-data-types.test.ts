import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { CacheKeyGenerator } from '../../../src/cache/cache-key-generator'

describe('Cache Key Generation - Special Data Types', () => {
    let keyGenerator: CacheKeyGenerator

    beforeEach(() => {
        keyGenerator = new CacheKeyGenerator()
    })

    afterEach(() => {
        vi.restoreAllMocks()
    })

    describe('特殊数据类型处理', () => {
        it('should handle FormData', () => {
            const formData = new FormData()
            formData.append('name', 'John')
            formData.append('age', '25')

            const config = {
                url: 'https://api.example.com/upload',
                method: 'POST' as const,
                data: formData
            }

            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)
        })

        it('should handle URLSearchParams', () => {
            const urlParams = new URLSearchParams()
            urlParams.append('page', '1')
            urlParams.append('limit', '10')

            const config = {
                url: 'https://api.example.com/data',
                method: 'POST' as const,
                data: urlParams
            }

            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)

            // 相同URLSearchParams应该产生相同键
            const urlParams2 = new URLSearchParams()
            urlParams2.append('page', '1')
            urlParams2.append('limit', '10')

            const config2 = { ...config, data: urlParams2 }
            const key2 = keyGenerator.generateCacheKey(config2)
            expect(key).toBe(key2)
        })

        it('should handle Blob data', () => {
            const blob = new Blob(['test content'], { type: 'text/plain' })

            const config = {
                url: 'https://api.example.com/upload',
                method: 'POST' as const,
                data: blob
            }

            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)
        })

        it('should handle ArrayBuffer and TypedArrays', () => {
            const buffer = new ArrayBuffer(16)
            const uint8Array = new Uint8Array(buffer)
            uint8Array[0] = 42

            const config1 = {
                url: 'https://api.example.com/binary',
                method: 'POST' as const,
                data: buffer
            }

            // 使用buffer属性获取ArrayBuffer，因为RequestData类型不直接支持TypedArray
            const config2 = {
                url: 'https://api.example.com/binary',
                method: 'POST' as const,
                data: uint8Array.buffer // 使用底层ArrayBuffer
            }

            const key1 = keyGenerator.generateCacheKey(config1)
            const key2 = keyGenerator.generateCacheKey(config2)

            expect(key1).toBeTypeOf('string')
            expect(key2).toBeTypeOf('string')
            expect(key1.length).toBeGreaterThan(0)
            expect(key2.length).toBeGreaterThan(0)
        })

        it('should handle File objects in FormData', () => {
            const file = new File(['file content'], 'test.txt', { type: 'text/plain' })
            const formData = new FormData()
            formData.append('file', file)
            formData.append('description', 'Test file')

            const config = {
                url: 'https://api.example.com/upload',
                method: 'POST' as const,
                data: formData
            }

            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)
        })
    })

    describe('FormData边界情况', () => {
        it('should handle FormData.entries() not available', () => {
            const formData = new FormData()
            formData.append('name', 'test')

            // 模拟entries方法不可用
            const originalEntries = formData.entries
            delete (formData as any).entries

            const config = {
                url: 'https://api.example.com/upload',
                method: 'POST' as const,
                data: formData
            }

            // 应该使用回退方案而不崩溃
            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)

            // 恢复原始方法
            formData.entries = originalEntries
        })

        it('should handle FormData with mixed content types', () => {
            const formData = new FormData()
            formData.append('text', 'simple text')
            formData.append('number', '123')

            // 创建一个File对象
            const file = new File(['file content'], 'test.txt', { type: 'text/plain' })
            formData.append('file', file)

            const config = {
                url: 'https://api.example.com/upload',
                method: 'POST' as const,
                data: formData
            }

            const key = keyGenerator.generateCacheKey(config)
            expect(key).toBeTypeOf('string')
            expect(key.length).toBeGreaterThan(0)
        })
    })
})