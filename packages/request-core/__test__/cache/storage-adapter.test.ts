import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
    StorageType,
    StorageItem,
    StorageAdapter,
    CacheInvalidationStrategy,
    UrlPathKeyStrategy,
    FullUrlKeyStrategy,
    ParameterizedKeyStrategy,
    CustomKeyStrategy,
    LRUInvalidationPolicy,
    FIFOInvalidationPolicy,
    TimeBasedInvalidationPolicy,
    CustomInvalidationPolicy
} from '../../src/cache/storage-adapter'

describe('StorageType', () => {
    it('should have correct enum values', () => {
        expect(StorageType.MEMORY).toBe('memory')
        expect(StorageType.LOCAL_STORAGE).toBe('localStorage')
        expect(StorageType.INDEXED_DB).toBe('indexedDB')
        expect(StorageType.WEB_SQL).toBe('webSQL')
    })
})

describe('CacheInvalidationStrategy', () => {
    it('should have correct enum values', () => {
        expect(CacheInvalidationStrategy.LRU).toBe('lru')
        expect(CacheInvalidationStrategy.FIFO).toBe('fifo')
        expect(CacheInvalidationStrategy.TIME_BASED).toBe('timeBased')
    })
})

describe('UrlPathKeyStrategy', () => {
    let strategy: UrlPathKeyStrategy

    beforeEach(() => {
        strategy = new UrlPathKeyStrategy()
    })

    describe('generateKey', () => {
        it('should generate key from URL path', () => {
            const config = { url: 'https://api.example.com/users/123' }
            const key = strategy.generateKey(config)
            expect(key).toBe('path:/users/123')
        })

        it('should handle URL with query parameters', () => {
            const config = { url: 'https://api.example.com/users?page=1&limit=10' }
            const key = strategy.generateKey(config)
            expect(key).toBe('path:/users')
        })

        it('should handle URL with hash', () => {
            const config = { url: 'https://api.example.com/users#section1' }
            const key = strategy.generateKey(config)
            expect(key).toBe('path:/users')
        })

        it('should handle relative URL', () => {
            const config = { url: '/api/users/123' }
            const key = strategy.generateKey(config)
            expect(key).toBe('path:/api/users/123')
        })

        it('should throw error when URL is missing', () => {
            const config = {}
            expect(() => strategy.generateKey(config)).toThrow('URL is required for UrlPathKeyStrategy')
        })

        it('should throw error when config is null', () => {
            expect(() => strategy.generateKey(null)).toThrow('URL is required for UrlPathKeyStrategy')
        })

        it('should handle invalid URL gracefully', () => {
            const config = { url: 'invalid-url?param=value' }
            const key = strategy.generateKey(config)
            expect(key).toBe('path:invalid-url')
        })
    })

    describe('validateKey', () => {
        it('should validate correct path key', () => {
            expect(strategy.validateKey('path:/users/123')).toBe(true)
        })

        it('should reject non-path key', () => {
            expect(strategy.validateKey('url:https://example.com')).toBe(false)
        })

        it('should reject empty key', () => {
            expect(strategy.validateKey('')).toBe(false)
        })
    })
})

describe('FullUrlKeyStrategy', () => {
    let strategy: FullUrlKeyStrategy

    beforeEach(() => {
        strategy = new FullUrlKeyStrategy()
    })

    describe('generateKey', () => {
        it('should generate key from full URL', () => {
            const config = { url: 'https://api.example.com/users/123' }
            const key = strategy.generateKey(config)
            expect(key).toBe('url:https://api.example.com/users/123')
        })

        it('should preserve query parameters', () => {
            const config = { url: 'https://api.example.com/users?page=1&limit=10' }
            const key = strategy.generateKey(config)
            expect(key).toBe('url:https://api.example.com/users?page=1&limit=10')
        })

        it('should throw error when URL is missing', () => {
            const config = {}
            expect(() => strategy.generateKey(config)).toThrow('URL is required for FullUrlKeyStrategy')
        })

        it('should throw error when config is null', () => {
            expect(() => strategy.generateKey(null)).toThrow('URL is required for FullUrlKeyStrategy')
        })
    })

    describe('validateKey', () => {
        it('should validate correct URL key', () => {
            expect(strategy.validateKey('url:https://example.com')).toBe(true)
        })

        it('should reject non-URL key', () => {
            expect(strategy.validateKey('path:/users')).toBe(false)
        })

        it('should reject empty key', () => {
            expect(strategy.validateKey('')).toBe(false)
        })
    })
})

describe('ParameterizedKeyStrategy', () => {
    let strategy: ParameterizedKeyStrategy

    beforeEach(() => {
        strategy = new ParameterizedKeyStrategy()
    })

    describe('generateKey', () => {
        it('should generate key from URL without parameters', () => {
            const config = { url: 'https://api.example.com/users' }
            const key = strategy.generateKey(config)
            expect(key).toBe('param:https://api.example.com/users')
        })

        it('should generate key with sorted parameters', () => {
            const config = {
                url: 'https://api.example.com/users',
                params: { page: 1, limit: 10, sort: 'name' }
            }
            const key = strategy.generateKey(config)
            expect(key).toBe('param:https://api.example.com/users?limit=10&page=1&sort=name')
        })

        it('should handle empty parameters object', () => {
            const config = {
                url: 'https://api.example.com/users',
                params: {}
            }
            const key = strategy.generateKey(config)
            expect(key).toBe('param:https://api.example.com/users')
        })

        it('should handle null parameters', () => {
            const config = {
                url: 'https://api.example.com/users',
                params: null
            }
            const key = strategy.generateKey(config)
            expect(key).toBe('param:https://api.example.com/users')
        })

        it('should throw error when URL is missing', () => {
            const config = { params: { page: 1 } }
            expect(() => strategy.generateKey(config)).toThrow('URL is required for ParameterizedKeyStrategy')
        })

        it('should throw error when config is null', () => {
            expect(() => strategy.generateKey(null)).toThrow('URL is required for ParameterizedKeyStrategy')
        })
    })

    describe('validateKey', () => {
        it('should validate correct param key', () => {
            expect(strategy.validateKey('param:https://example.com')).toBe(true)
        })

        it('should reject non-param key', () => {
            expect(strategy.validateKey('url:https://example.com')).toBe(false)
        })

        it('should reject empty key', () => {
            expect(strategy.validateKey('')).toBe(false)
        })
    })
})

describe('CustomKeyStrategy', () => {
    describe('constructor', () => {
        it('should create instance with valid key generator', () => {
            const keyGenerator = (config: any) => `custom:${config.id}`
            const strategy = new CustomKeyStrategy(keyGenerator)
            expect(strategy).toBeInstanceOf(CustomKeyStrategy)
        })

        it('should throw error with invalid key generator', () => {
            expect(() => new CustomKeyStrategy('not a function' as any)).toThrow('keyGenerator must be a function')
        })

        it('should throw error with null key generator', () => {
            expect(() => new CustomKeyStrategy(null as any)).toThrow('keyGenerator must be a function')
        })
    })

    describe('generateKey', () => {
        it('should use custom key generator', () => {
            const keyGenerator = vi.fn((config: any) => `custom:${config.id}`)
            const strategy = new CustomKeyStrategy(keyGenerator)
            const config = { id: '123' }

            const key = strategy.generateKey(config)

            expect(key).toBe('custom:123')
            expect(keyGenerator).toHaveBeenCalledWith(config)
        })

        it('should handle complex key generation logic', () => {
            const keyGenerator = (config: any) => {
                const { method, url, params } = config
                return `${method}:${url}:${JSON.stringify(params || {})}`
            }
            const strategy = new CustomKeyStrategy(keyGenerator)
            const config = {
                method: 'POST',
                url: '/api/users',
                params: { name: 'John' }
            }

            const key = strategy.generateKey(config)

            expect(key).toBe('POST:/api/users:{"name":"John"}')
        })
    })

    describe('validateKey', () => {
        let strategy: CustomKeyStrategy

        beforeEach(() => {
            const keyGenerator = (config: any) => `custom:${config.id}`
            strategy = new CustomKeyStrategy(keyGenerator)
        })

        it('should validate non-empty string key', () => {
            expect(strategy.validateKey('any-valid-key')).toBe(true)
        })

        it('should reject empty string', () => {
            expect(strategy.validateKey('')).toBe(false)
        })

        it('should reject non-string values', () => {
            expect(strategy.validateKey(null as any)).toBe(false)
            expect(strategy.validateKey(undefined as any)).toBe(false)
            expect(strategy.validateKey(123 as any)).toBe(false)
        })
    })
})

describe('LRUInvalidationPolicy', () => {
    let policy: LRUInvalidationPolicy
    let now: number

    beforeEach(() => {
        policy = new LRUInvalidationPolicy()
        now = Date.now()
    })

    describe('shouldInvalidate', () => {
        it('should invalidate null item', () => {
            expect(policy.shouldInvalidate(null, now)).toBe(true)
        })

        it('should invalidate undefined item', () => {
            expect(policy.shouldInvalidate(undefined, now)).toBe(true)
        })

        it('should invalidate item without timestamp', () => {
            const item = { ttl: 1000 }
            expect(policy.shouldInvalidate(item, now)).toBe(true)
        })

        it('should invalidate item without ttl', () => {
            const item = { timestamp: now - 500 }
            expect(policy.shouldInvalidate(item, now)).toBe(true)
        })

        it('should invalidate expired item', () => {
            const item = {
                timestamp: now - 2000,
                ttl: 1000
            }
            expect(policy.shouldInvalidate(item, now)).toBe(true)
        })

        it('should not invalidate valid item', () => {
            const item = {
                timestamp: now - 500,
                ttl: 1000
            }
            expect(policy.shouldInvalidate(item, now)).toBe(false)
        })

        it('should handle edge case when item is exactly at TTL', () => {
            const item = {
                timestamp: now - 1000,
                ttl: 1000
            }
            expect(policy.shouldInvalidate(item, now)).toBe(true)
        })
    })

    describe('updateItemOnAccess', () => {
        it('should update access time and count', () => {
            const item = {
                timestamp: now - 500,
                ttl: 1000,
                accessTime: now - 300,
                accessCount: 5
            }

            policy.updateItemOnAccess(item, now)

            expect(item.accessTime).toBe(now)
            expect(item.accessCount).toBe(6)
        })

        it('should initialize access count if not present', () => {
            const item: any = {
                timestamp: now - 500,
                ttl: 1000,
                accessTime: now - 300
            }

            policy.updateItemOnAccess(item, now)

            expect(item.accessTime).toBe(now)
            expect(item.accessCount).toBe(1)
        })

        it('should handle null item gracefully', () => {
            expect(() => policy.updateItemOnAccess(null, now)).not.toThrow()
        })

        it('should handle undefined item gracefully', () => {
            expect(() => policy.updateItemOnAccess(undefined, now)).not.toThrow()
        })
    })
})

describe('FIFOInvalidationPolicy', () => {
    let policy: FIFOInvalidationPolicy
    let now: number

    beforeEach(() => {
        policy = new FIFOInvalidationPolicy()
        now = Date.now()
    })

    describe('shouldInvalidate', () => {
        it('should invalidate expired item', () => {
            const item = {
                timestamp: now - 2000,
                ttl: 1000
            }
            expect(policy.shouldInvalidate(item, now)).toBe(true)
        })

        it('should not invalidate valid item', () => {
            const item = {
                timestamp: now - 500,
                ttl: 1000
            }
            expect(policy.shouldInvalidate(item, now)).toBe(false)
        })

        it('should handle edge case when item is exactly at TTL', () => {
            const item = {
                timestamp: now - 1000,
                ttl: 1000
            }
            expect(policy.shouldInvalidate(item, now)).toBe(true)
        })
    })

    describe('updateItemOnAccess', () => {
        it('should not modify item on access', () => {
            const originalItem = {
                timestamp: now - 500,
                ttl: 1000,
                accessTime: now - 300,
                accessCount: 5
            }
            const item = { ...originalItem }

            policy.updateItemOnAccess(item, now)

            expect(item).toEqual(originalItem)
        })
    })
})

describe('TimeBasedInvalidationPolicy', () => {
    let policy: TimeBasedInvalidationPolicy
    let now: number

    beforeEach(() => {
        policy = new TimeBasedInvalidationPolicy()
        now = Date.now()
    })

    describe('shouldInvalidate', () => {
        it('should invalidate expired item', () => {
            const item = {
                timestamp: now - 2000,
                ttl: 1000
            }
            expect(policy.shouldInvalidate(item, now)).toBe(true)
        })

        it('should not invalidate valid item', () => {
            const item = {
                timestamp: now - 500,
                ttl: 1000
            }
            expect(policy.shouldInvalidate(item, now)).toBe(false)
        })

        it('should handle edge case when item is exactly at TTL', () => {
            const item = {
                timestamp: now - 1000,
                ttl: 1000
            }
            expect(policy.shouldInvalidate(item, now)).toBe(true)
        })
    })

    describe('updateItemOnAccess', () => {
        it('should not modify item on access', () => {
            const originalItem = {
                timestamp: now - 500,
                ttl: 1000,
                accessTime: now - 300,
                accessCount: 5
            }
            const item = { ...originalItem }

            policy.updateItemOnAccess(item, now)

            expect(item).toEqual(originalItem)
        })
    })
})

describe('CustomInvalidationPolicy', () => {
    describe('constructor', () => {
        it('should create instance with valid invalidation checker', () => {
            const invalidationChecker = (item: any, now: number) => false
            const policy = new CustomInvalidationPolicy(invalidationChecker)
            expect(policy).toBeInstanceOf(CustomInvalidationPolicy)
        })

        it('should create instance with invalidation checker and access updater', () => {
            const invalidationChecker = (item: any, now: number) => false
            const accessUpdater = (item: any, now: number) => { }
            const policy = new CustomInvalidationPolicy(invalidationChecker, accessUpdater)
            expect(policy).toBeInstanceOf(CustomInvalidationPolicy)
        })

        it('should throw error with invalid invalidation checker', () => {
            expect(() => new CustomInvalidationPolicy('not a function' as any))
                .toThrow('invalidationChecker must be a function')
        })

        it('should throw error with null invalidation checker', () => {
            expect(() => new CustomInvalidationPolicy(null as any))
                .toThrow('invalidationChecker must be a function')
        })
    })

    describe('shouldInvalidate', () => {
        it('should use custom invalidation checker', () => {
            const invalidationChecker = vi.fn((item: any, now: number) => item.priority < 5)
            const policy = new CustomInvalidationPolicy(invalidationChecker)
            const item = { priority: 3 }
            const now = Date.now()

            const result = policy.shouldInvalidate(item, now)

            expect(result).toBe(true)
            expect(invalidationChecker).toHaveBeenCalledWith(item, now)
        })

        it('should handle complex invalidation logic', () => {
            const invalidationChecker = (item: any, now: number) => {
                return item.expired || (now - item.timestamp > item.ttl)
            }
            const policy = new CustomInvalidationPolicy(invalidationChecker)
            const now = Date.now()

            const expiredItem = { expired: true, timestamp: now - 500, ttl: 1000 }
            const ttlExpiredItem = { expired: false, timestamp: now - 2000, ttl: 1000 }
            const validItem = { expired: false, timestamp: now - 500, ttl: 1000 }

            expect(policy.shouldInvalidate(expiredItem, now)).toBe(true)
            expect(policy.shouldInvalidate(ttlExpiredItem, now)).toBe(true)
            expect(policy.shouldInvalidate(validItem, now)).toBe(false)
        })
    })

    describe('updateItemOnAccess', () => {
        it('should use custom access updater when provided', () => {
            const invalidationChecker = (item: any, now: number) => false
            const accessUpdater = vi.fn((item: any, now: number) => {
                item.lastAccessed = now
            })
            const policy = new CustomInvalidationPolicy(invalidationChecker, accessUpdater)
            const item: any = { data: 'test' }
            const now = Date.now()

            policy.updateItemOnAccess(item, now)

            expect(accessUpdater).toHaveBeenCalledWith(item, now)
            expect(item.lastAccessed).toBe(now)
        })

        it('should not call access updater when not provided', () => {
            const invalidationChecker = (item: any, now: number) => false
            const policy = new CustomInvalidationPolicy(invalidationChecker)
            const item = { data: 'test' }
            const now = Date.now()

            expect(() => policy.updateItemOnAccess(item, now)).not.toThrow()
        })

        it('should handle complex access update logic', () => {
            const invalidationChecker = (item: any, now: number) => false
            const accessUpdater = (item: any, now: number) => {
                item.accessCount = (item.accessCount || 0) + 1
                item.lastAccessed = now
                item.accessHistory = item.accessHistory || []
                item.accessHistory.push(now)
            }
            const policy = new CustomInvalidationPolicy(invalidationChecker, accessUpdater)
            const item: any = { data: 'test', accessCount: 2, accessHistory: [123456] }
            const now = Date.now()

            policy.updateItemOnAccess(item, now)

            expect(item.accessCount).toBe(3)
            expect(item.lastAccessed).toBe(now)
            expect(item.accessHistory).toEqual([123456, now])
        })
    })
})

// 测试 StorageItem 接口的类型定义
describe('StorageItem Interface', () => {
    it('should have correct structure', () => {
        const item: StorageItem<string> = {
            key: 'test-key',
            data: 'test-data',
            timestamp: Date.now(),
            ttl: 1000,
            accessTime: Date.now(),
            accessCount: 1
        }

        expect(typeof item.key).toBe('string')
        expect(typeof item.data).toBe('string')
        expect(typeof item.timestamp).toBe('number')
        expect(typeof item.ttl).toBe('number')
        expect(typeof item.accessTime).toBe('number')
        expect(typeof item.accessCount).toBe('number')
    })

    it('should support generic data types', () => {
        const stringItem: StorageItem<string> = {
            key: 'string-key',
            data: 'string-data',
            timestamp: Date.now(),
            ttl: 1000,
            accessTime: Date.now(),
            accessCount: 1
        }

        const objectItem: StorageItem<{ id: number; name: string }> = {
            key: 'object-key',
            data: { id: 1, name: 'test' },
            timestamp: Date.now(),
            ttl: 1000,
            accessTime: Date.now(),
            accessCount: 1
        }

        const arrayItem: StorageItem<number[]> = {
            key: 'array-key',
            data: [1, 2, 3],
            timestamp: Date.now(),
            ttl: 1000,
            accessTime: Date.now(),
            accessCount: 1
        }

        expect(stringItem.data).toBe('string-data')
        expect(objectItem.data.id).toBe(1)
        expect(arrayItem.data).toEqual([1, 2, 3])
    })
})

// 模拟 StorageAdapter 实现用于接口测试
class MockStorageAdapter implements StorageAdapter<any> {
    private storage = new Map<string, StorageItem<any>>()

    getType(): StorageType {
        return StorageType.MEMORY
    }

    isAvailable(): boolean {
        return true
    }

    async getItem(key: string): Promise<StorageItem<any> | null> {
        return this.storage.get(key) || null
    }

    async setItem(item: StorageItem<any>): Promise<void> {
        this.storage.set(item.key, item)
    }

    async removeItem(key: string): Promise<void> {
        this.storage.delete(key)
    }

    async clear(): Promise<void> {
        this.storage.clear()
    }

    async getKeys(): Promise<string[]> {
        return Array.from(this.storage.keys())
    }

    async getStats(): Promise<{ size: number; maxSize?: number }> {
        return { size: this.storage.size }
    }

    async destroy(): Promise<void> {
        this.storage.clear()
    }
}

describe('StorageAdapter Interface', () => {
    let adapter: MockStorageAdapter

    beforeEach(() => {
        adapter = new MockStorageAdapter()
    })

    it('should implement all required methods', () => {
        expect(typeof adapter.getType).toBe('function')
        expect(typeof adapter.isAvailable).toBe('function')
        expect(typeof adapter.getItem).toBe('function')
        expect(typeof adapter.setItem).toBe('function')
        expect(typeof adapter.removeItem).toBe('function')
        expect(typeof adapter.clear).toBe('function')
        expect(typeof adapter.getKeys).toBe('function')
        expect(typeof adapter.getStats).toBe('function')
        expect(typeof adapter.destroy).toBe('function')
    })

    it('should handle basic storage operations', async () => {
        const item: StorageItem<string> = {
            key: 'test-key',
            data: 'test-data',
            timestamp: Date.now(),
            ttl: 1000,
            accessTime: Date.now(),
            accessCount: 1
        }

        // 设置项目
        await adapter.setItem(item)

        // 获取项目
        const retrieved = await adapter.getItem('test-key')
        expect(retrieved).toEqual(item)

        // 获取所有键
        const keys = await adapter.getKeys()
        expect(keys).toContain('test-key')

        // 获取统计信息
        const stats = await adapter.getStats()
        expect(stats.size).toBe(1)

        // 删除项目
        await adapter.removeItem('test-key')
        const afterRemove = await adapter.getItem('test-key')
        expect(afterRemove).toBeNull()
    })

    it('should handle clear operation', async () => {
        const item1: StorageItem<string> = {
            key: 'key1',
            data: 'data1',
            timestamp: Date.now(),
            ttl: 1000,
            accessTime: Date.now(),
            accessCount: 1
        }

        const item2: StorageItem<string> = {
            key: 'key2',
            data: 'data2',
            timestamp: Date.now(),
            ttl: 1000,
            accessTime: Date.now(),
            accessCount: 1
        }

        await adapter.setItem(item1)
        await adapter.setItem(item2)

        let stats = await adapter.getStats()
        expect(stats.size).toBe(2)

        await adapter.clear()

        stats = await adapter.getStats()
        expect(stats.size).toBe(0)

        const keys = await adapter.getKeys()
        expect(keys).toHaveLength(0)
    })

    it('should handle destroy operation', async () => {
        const item: StorageItem<string> = {
            key: 'test-key',
            data: 'test-data',
            timestamp: Date.now(),
            ttl: 1000,
            accessTime: Date.now(),
            accessCount: 1
        }

        await adapter.setItem(item)
        await adapter.destroy()

        const stats = await adapter.getStats()
        expect(stats.size).toBe(0)
    })
})