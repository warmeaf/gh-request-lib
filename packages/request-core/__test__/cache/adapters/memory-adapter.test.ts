import { describe, it, expect, beforeEach } from 'vitest'
import { MemoryStorageAdapter } from '../../../src/cache/adapters/memory-adapter'
import { StorageType, StorageItem } from '../../../src/cache/storage-adapter'

describe('MemoryStorageAdapter', () => {
    let adapter: MemoryStorageAdapter<any>

    beforeEach(() => {
        adapter = new MemoryStorageAdapter()
    })

    describe('基本功能测试', () => {
        it('应该返回正确的存储类型', () => {
            expect(adapter.getType()).toBe(StorageType.MEMORY)
        })

        it('应该始终可用', () => {
            expect(adapter.isAvailable()).toBe(true)
        })
    })

    describe('存储项操作', () => {
        const mockItem: StorageItem<string> = {
            key: 'test-key',
            data: 'test-data',
            timestamp: Date.now(),
            ttl: 60000,
            accessTime: Date.now(),
            accessCount: 1
        }

        it('应该能够设置和获取存储项', async () => {
            await adapter.setItem(mockItem)
            const result = await adapter.getItem('test-key')

            expect(result).toEqual(mockItem)
        })

        it('获取不存在的项应该返回null', async () => {
            const result = await adapter.getItem('non-existent-key')
            expect(result).toBeNull()
        })

        it('应该能够删除存储项', async () => {
            await adapter.setItem(mockItem)
            await adapter.removeItem('test-key')

            const result = await adapter.getItem('test-key')
            expect(result).toBeNull()
        })

        it('删除不存在的项不应该抛出错误', async () => {
            await expect(adapter.removeItem('non-existent-key')).resolves.toBeUndefined()
        })
    })

    describe('批量操作', () => {
        const mockItems: StorageItem<string>[] = [
            {
                key: 'key1',
                data: 'data1',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            },
            {
                key: 'key2',
                data: 'data2',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            },
            {
                key: 'key3',
                data: 'data3',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }
        ]

        beforeEach(async () => {
            for (const item of mockItems) {
                await adapter.setItem(item)
            }
        })

        it('应该能够获取所有键', async () => {
            const keys = await adapter.getKeys()
            expect(keys).toHaveLength(3)
            expect(keys).toContain('key1')
            expect(keys).toContain('key2')
            expect(keys).toContain('key3')
        })

        it('应该能够清空所有存储项', async () => {
            await adapter.clear()

            const keys = await adapter.getKeys()
            expect(keys).toHaveLength(0)

            const result = await adapter.getItem('key1')
            expect(result).toBeNull()
        })
    })

    describe('统计信息', () => {
        it('空存储应该返回正确的统计信息', async () => {
            const stats = await adapter.getStats()
            expect(stats.size).toBe(0)
            expect(stats.maxSize).toBeUndefined()
        })

        it('有数据时应该返回正确的统计信息', async () => {
            const mockItem: StorageItem<string> = {
                key: 'test-key',
                data: 'test-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(mockItem)
            const stats = await adapter.getStats()

            expect(stats.size).toBe(1)
        })
    })

    describe('销毁操作', () => {
        it('应该能够销毁适配器并清理所有数据', async () => {
            const mockItem: StorageItem<string> = {
                key: 'test-key',
                data: 'test-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(mockItem)
            await adapter.destroy()

            const result = await adapter.getItem('test-key')
            expect(result).toBeNull()

            const keys = await adapter.getKeys()
            expect(keys).toHaveLength(0)
        })
    })

    describe('数据类型支持', () => {
        it('应该支持字符串类型', async () => {
            const stringAdapter = new MemoryStorageAdapter<string>()
            const item: StorageItem<string> = {
                key: 'string-key',
                data: 'string-value',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await stringAdapter.setItem(item)
            const result = await stringAdapter.getItem('string-key')

            expect(result?.data).toBe('string-value')
        })

        it('应该支持对象类型', async () => {
            interface TestObject {
                id: number
                name: string
            }

            const objectAdapter = new MemoryStorageAdapter<TestObject>()
            const testObject: TestObject = { id: 1, name: 'test' }
            const item: StorageItem<TestObject> = {
                key: 'object-key',
                data: testObject,
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await objectAdapter.setItem(item)
            const result = await objectAdapter.getItem('object-key')

            expect(result?.data).toEqual(testObject)
        })

        it('应该支持数组类型', async () => {
            const arrayAdapter = new MemoryStorageAdapter<number[]>()
            const testArray = [1, 2, 3, 4, 5]
            const item: StorageItem<number[]> = {
                key: 'array-key',
                data: testArray,
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await arrayAdapter.setItem(item)
            const result = await arrayAdapter.getItem('array-key')

            expect(result?.data).toEqual(testArray)
        })
    })

    describe('边界情况', () => {
        it('应该能够处理空字符串键', async () => {
            const item: StorageItem<string> = {
                key: '',
                data: 'empty-key-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(item)
            const result = await adapter.getItem('')

            expect(result?.data).toBe('empty-key-data')
        })

        it('应该能够处理特殊字符键', async () => {
            const specialKey = 'key-with-!@#$%^&*()_+-=[]{}|;:,.<>?'
            const item: StorageItem<string> = {
                key: specialKey,
                data: 'special-key-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(item)
            const result = await adapter.getItem(specialKey)

            expect(result?.data).toBe('special-key-data')
        })

        it('应该能够覆盖已存在的键', async () => {
            const key = 'duplicate-key'
            const item1: StorageItem<string> = {
                key,
                data: 'first-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }
            const item2: StorageItem<string> = {
                key,
                data: 'second-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(item1)
            await adapter.setItem(item2)

            const result = await adapter.getItem(key)
            expect(result?.data).toBe('second-data')
        })
    })

    describe('并发操作', () => {
        it('应该能够处理并发的设置操作', async () => {
            const promises: Promise<void>[] = []
            for (let i = 0; i < 100; i++) {
                const item: StorageItem<number> = {
                    key: `concurrent-key-${i}`,
                    data: i,
                    timestamp: Date.now(),
                    ttl: 60000,
                    accessTime: Date.now(),
                    accessCount: 1
                }
                promises.push(adapter.setItem(item))
            }

            await Promise.all(promises)

            const keys = await adapter.getKeys()
            expect(keys).toHaveLength(100)
        })

        it('应该能够处理并发的获取操作', async () => {
            // 先设置一些数据
            for (let i = 0; i < 10; i++) {
                const item: StorageItem<number> = {
                    key: `get-key-${i}`,
                    data: i,
                    timestamp: Date.now(),
                    ttl: 60000,
                    accessTime: Date.now(),
                    accessCount: 1
                }
                await adapter.setItem(item)
            }

            // 并发获取
            const promises: Promise<StorageItem<number> | null>[] = []
            for (let i = 0; i < 10; i++) {
                promises.push(adapter.getItem(`get-key-${i}`))
            }

            const results = await Promise.all(promises)

            results.forEach((result, index) => {
                expect(result?.data).toBe(index)
            })
        })
    })
})