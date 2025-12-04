import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { LocalStorageAdapter } from '../../../src/cache/adapters/local-storage-adapter'
import { StorageType, StorageItem } from '../../../src/cache/storage-adapter'

// Mock LocalStorage
class MockStorage implements Storage {
    private data = new Map<string, string>()

    get length(): number {
        return this.data.size
    }

    clear(): void {
        this.data.clear()
    }

    getItem(key: string): string | null {
        return this.data.get(key) || null
    }

    key(index: number): string | null {
        const keys = Array.from(this.data.keys())
        return keys[index] || null
    }

    removeItem(key: string): void {
        this.data.delete(key)
    }

    setItem(key: string, value: string): void {
        this.data.set(key, value)
    }

    // 添加一个方法来获取所有键（用于测试）
    getAllKeys(): string[] {
        return Array.from(this.data.keys())
    }

    // 添加一个方法来模拟存储异常
    simulateError = false

    setItemWithError(key: string, value: string): void {
        if (this.simulateError) {
            throw new Error('LocalStorage quota exceeded')
        }
        this.setItem(key, value)
    }
}

describe('LocalStorageAdapter', () => {
    let adapter: LocalStorageAdapter<any>
    let mockStorage: MockStorage
    let originalLocalStorage: Storage

    beforeEach(() => {
        // 创建新的 mock storage
        mockStorage = new MockStorage()

        // 保存原始的 localStorage
        originalLocalStorage = (global as any).localStorage

            // 设置 mock
            ; (global as any).localStorage = mockStorage

        adapter = new LocalStorageAdapter()
    })

    afterEach(() => {
        // 恢复原始的 localStorage
        ; (global as any).localStorage = originalLocalStorage
    })

    describe('基本功能测试', () => {
        it('应该返回正确的存储类型', () => {
            expect(adapter.getType()).toBe(StorageType.LOCAL_STORAGE)
        })

        it('当 LocalStorage 可用时应该返回 true', () => {
            expect(adapter.isAvailable()).toBe(true)
        })

        it('当 LocalStorage 不可用时应该返回 false', () => {
            // 模拟 localStorage 不可用
            ; (global as any).localStorage = {
                setItem: () => {
                    throw new Error('LocalStorage not available')
                },
                removeItem: () => { },
                getItem: () => null
            }

            const unavailableAdapter = new LocalStorageAdapter()
            expect(unavailableAdapter.isAvailable()).toBe(false)
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

        it('应该正确处理 JSON 解析错误', async () => {
            // 直接在 localStorage 中设置无效的 JSON
            mockStorage.setItem('request_cache_invalid-json', 'invalid json')

            const result = await adapter.getItem('invalid-json')
            expect(result).toBeNull()
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

    describe('元数据管理', () => {
        it('应该正确维护键的元数据', async () => {
            const mockItem: StorageItem<string> = {
                key: 'meta-test-key',
                data: 'meta-test-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(mockItem)

            // 检查元数据是否正确保存
            const metaStr = mockStorage.getItem('request_cache_meta')
            expect(metaStr).toBeTruthy()

            const meta = JSON.parse(metaStr!)
            expect(meta.keys).toContain('meta-test-key')
        })

        it('应该在删除项时更新元数据', async () => {
            const mockItem: StorageItem<string> = {
                key: 'delete-meta-key',
                data: 'delete-meta-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(mockItem)
            await adapter.removeItem('delete-meta-key')

            const keys = await adapter.getKeys()
            expect(keys).not.toContain('delete-meta-key')
        })

        it('应该能够从损坏的元数据中恢复', () => {
            // 设置无效的元数据
            mockStorage.setItem('request_cache_meta', 'invalid json')

            // 创建新的适配器实例应该能够处理损坏的元数据
            const newAdapter = new LocalStorageAdapter()
            expect(newAdapter.isAvailable()).toBe(true)
        })
    })


    describe('销毁操作', () => {
        it('应该能够销毁适配器并清理所有数据', async () => {
            const mockItem: StorageItem<string> = {
                key: 'destroy-test-key',
                data: 'destroy-test-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(mockItem)
            await adapter.destroy()

            const result = await adapter.getItem('destroy-test-key')
            expect(result).toBeNull()

            const keys = await adapter.getKeys()
            expect(keys).toHaveLength(0)
        })

        it('当 LocalStorage 不可用时销毁应该正常返回', async () => {
            ; (global as any).localStorage = undefined
            await expect(adapter.destroy()).resolves.toBeUndefined()
        })
    })

    describe('错误处理', () => {
        it('当 LocalStorage 不可用时操作应该抛出错误', async () => {
            ; (global as any).localStorage = undefined

            const mockItem: StorageItem<string> = {
                key: 'error-test-key',
                data: 'error-test-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await expect(adapter.getItem('test-key')).rejects.toThrow('LocalStorage is not available')
            await expect(adapter.setItem(mockItem)).rejects.toThrow('LocalStorage is not available')
            await expect(adapter.removeItem('test-key')).rejects.toThrow('LocalStorage is not available')
            await expect(adapter.clear()).rejects.toThrow('LocalStorage is not available')
            await expect(adapter.getKeys()).rejects.toThrow('LocalStorage is not available')
            // 统计功能已移除
        })

        it('应该处理 setItem 时的存储异常', async () => {
            // 创建一个特殊的 mock storage，它在 isAvailable 检查时正常工作，但在实际 setItem 时抛出错误
            const errorMockStorage = {
                ...mockStorage,
                setItem: vi.fn().mockImplementation((key: string, value: string) => {
                    if (key === '__request_cache_test__') {
                        // isAvailable 检查时正常工作
                        return
                    }
                    // 实际存储时抛出错误
                    throw new Error('LocalStorage quota exceeded')
                }),
                removeItem: mockStorage.removeItem.bind(mockStorage),
                getItem: mockStorage.getItem.bind(mockStorage)
            }

            // 临时替换 localStorage
            const tempOriginal = (global as any).localStorage
                ; (global as any).localStorage = errorMockStorage

            const errorAdapter = new LocalStorageAdapter()

            const mockItem: StorageItem<string> = {
                key: 'quota-test-key',
                data: 'quota-test-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await expect(errorAdapter.setItem(mockItem)).rejects.toThrow('LocalStorage quota exceeded')

                // 恢复原始 localStorage
                ; (global as any).localStorage = tempOriginal
        })
    })

    describe('数据类型支持', () => {
        it('应该支持字符串类型', async () => {
            const stringAdapter = new LocalStorageAdapter<string>()
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

            const objectAdapter = new LocalStorageAdapter<TestObject>()
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
            const arrayAdapter = new LocalStorageAdapter<number[]>()
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

            // 键应该只出现一次
            const keys = await adapter.getKeys()
            const keyCount = keys.filter(k => k === key).length
            expect(keyCount).toBe(1)
        })
    })

    describe('并发操作', () => {
        it('应该能够处理并发的设置操作', async () => {
            const promises: Promise<void>[] = []
            for (let i = 0; i < 10; i++) {
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
            expect(keys).toHaveLength(10)
        })

        it('应该能够处理并发的获取操作', async () => {
            // 先设置一些数据
            for (let i = 0; i < 5; i++) {
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
            for (let i = 0; i < 5; i++) {
                promises.push(adapter.getItem(`get-key-${i}`))
            }

            const results = await Promise.all(promises)

            results.forEach((result, index) => {
                expect(result?.data).toBe(index)
            })
        })
    })

    describe('键前缀处理', () => {
        it('应该正确添加和处理键前缀', async () => {
            const mockItem: StorageItem<string> = {
                key: 'prefix-test',
                data: 'prefix-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(mockItem)

            // 检查实际存储的键是否有前缀
            const allKeys = mockStorage.getAllKeys()
            const prefixedKey = allKeys.find(key => key.includes('prefix-test'))
            expect(prefixedKey).toBe('request_cache_prefix-test')
        })
    })
})