import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { WebSQLAdapter } from '../../../src/cache/adapters/websql-adapter'
import { StorageType, StorageItem } from '../../../src/cache/storage-adapter'

// WebSQL 接口定义（用于测试）
interface SQLError {
    code: number
    message: string
}

interface SQLResultSetRowList {
    length: number
    item(index: number): any
}

interface SQLResultSet {
    rows: SQLResultSetRowList
    rowsAffected: number
    insertId: number
}

interface SQLTransaction {
    executeSql(
        sql: string,
        args?: any[],
        successCallback?: (tx: SQLTransaction, results: SQLResultSet) => void,
        errorCallback?: (tx: SQLTransaction, error: SQLError) => void
    ): void
}

interface Database {
    transaction(callback: (tx: SQLTransaction) => void): void
}

// Mock WebSQL - 全局数据存储来模拟数据库持久化
const globalWebSQLData = new Map<string, string>()

// Mock SQLError
class MockSQLError implements SQLError {
    constructor(public code: number, public message: string) { }
}

// Mock SQLResultSetRowList
class MockSQLResultSetRowList {
    constructor(private data: any[] = []) { }

    get length(): number {
        return this.data.length
    }

    item(index: number): any {
        return this.data[index] || null
    }
}

// Mock SQLResultSet
class MockSQLResultSet implements SQLResultSet {
    rows: MockSQLResultSetRowList
    rowsAffected: number = 0
    insertId: number = 0

    constructor(data: any[] = [], rowsAffected: number = 0) {
        this.rows = new MockSQLResultSetRowList(data)
        this.rowsAffected = rowsAffected
    }
}

// Mock SQLTransaction
class MockSQLTransaction implements SQLTransaction {
    private shouldError = false
    private errorToThrow: MockSQLError | null = null

    executeSql(
        sql: string,
        args: any[] = [],
        successCallback?: (tx: SQLTransaction, results: SQLResultSet) => void,
        errorCallback?: (tx: SQLTransaction, error: SQLError) => void
    ): void {
        setTimeout(() => {
            if (this.shouldError && errorCallback) {
                errorCallback(this, this.errorToThrow || new MockSQLError(1, 'SQL Error'))
                return
            }

            try {
                let results: MockSQLResultSet

                if (sql.includes('CREATE TABLE')) {
                    // 创建表操作
                    results = new MockSQLResultSet([], 0)
                } else if (sql.includes('SELECT data FROM cache WHERE key = ?')) {
                    // 获取单个项
                    const key = args[0]
                    const data = globalWebSQLData.get(key)
                    if (data) {
                        results = new MockSQLResultSet([{ data }], 0)
                    } else {
                        results = new MockSQLResultSet([], 0)
                    }
                } else if (sql.includes('INSERT OR REPLACE INTO cache')) {
                    // 插入或替换项
                    const [key, data] = args
                    globalWebSQLData.set(key, data)
                    results = new MockSQLResultSet([], 1)
                } else if (sql.includes('DELETE FROM cache WHERE key = ?')) {
                    // 删除单个项
                    const key = args[0]
                    const existed = globalWebSQLData.has(key)
                    globalWebSQLData.delete(key)
                    results = new MockSQLResultSet([], existed ? 1 : 0)
                } else if (sql.includes('DELETE FROM cache')) {
                    // 清空所有项
                    const count = globalWebSQLData.size
                    globalWebSQLData.clear()
                    results = new MockSQLResultSet([], count)
                } else if (sql.includes('SELECT key FROM cache')) {
                    // 获取所有键
                    const keys = Array.from(globalWebSQLData.keys()).map(key => ({ key }))
                    results = new MockSQLResultSet(keys, 0)
                } else {
                    results = new MockSQLResultSet([], 0)
                }

                if (successCallback) {
                    successCallback(this, results)
                }
            } catch (error) {
                if (errorCallback) {
                    errorCallback(this, new MockSQLError(1, error instanceof Error ? error.message : 'Unknown error'))
                }
            }
        }, 0)
    }

    // 用于测试错误情况
    simulateError(error?: MockSQLError) {
        this.shouldError = true
        this.errorToThrow = error || new MockSQLError(1, 'Simulated SQL Error')
    }

    resetError() {
        this.shouldError = false
        this.errorToThrow = null
    }
}

// Mock Database
class MockDatabase implements Database {
    private mockTransaction = new MockSQLTransaction()

    transaction(callback: (tx: SQLTransaction) => void): void {
        setTimeout(() => {
            callback(this.mockTransaction)
        }, 0)
    }

    // 用于测试
    simulateError(error?: MockSQLError) {
        this.mockTransaction.simulateError(error)
    }

    resetError() {
        this.mockTransaction.resetError()
    }
}

describe('WebSQLAdapter', () => {
    let adapter: WebSQLAdapter<any>
    let mockDatabase: MockDatabase
    let originalOpenDatabase: any

    beforeEach(() => {
        // 清理全局数据
        globalWebSQLData.clear()

        // 创建新的 mock database
        mockDatabase = new MockDatabase()

        // 保存原始的 openDatabase
        originalOpenDatabase = (global as any).openDatabase

            // 设置 mock openDatabase
            ; (global as any).openDatabase = vi.fn().mockReturnValue(mockDatabase)

        adapter = new WebSQLAdapter()
    })

    afterEach(() => {
        // 恢复原始的 openDatabase
        ; (global as any).openDatabase = originalOpenDatabase
    })

    describe('基本功能测试', () => {
        it('应该返回正确的存储类型', () => {
            expect(adapter.getType()).toBe(StorageType.WEB_SQL)
        })

        it('当 WebSQL 可用时应该返回 true', () => {
            expect(adapter.isAvailable()).toBe(true)
        })

        it('当 WebSQL 不可用时应该返回 false', () => {
            ; (global as any).openDatabase = undefined
            expect(adapter.isAvailable()).toBe(false)
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
            // 直接在 mock 数据中设置无效的 JSON
            globalWebSQLData.set('invalid-json', 'invalid json')

            await expect(adapter.getItem('invalid-json')).rejects.toThrow()
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
                key: 'stats-test-key',
                data: 'stats-test-data',
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

        it('当 WebSQL 不可用时销毁应该正常返回', async () => {
            ; (global as any).openDatabase = undefined
            await expect(adapter.destroy()).resolves.toBeUndefined()
        })

        it('销毁时清理失败应该正常处理', async () => {
            const mockItem: StorageItem<string> = {
                key: 'destroy-error-key',
                data: 'destroy-error-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(mockItem)

            // 模拟清理时的错误
            mockDatabase.simulateError(new MockSQLError(1, 'Clear failed'))

            // 销毁应该不抛出错误，只是警告
            await expect(adapter.destroy()).resolves.toBeUndefined()

            mockDatabase.resetError()
        })
    })

    describe('错误处理', () => {
        it('当 WebSQL 不可用时操作应该抛出错误', async () => {
            ; (global as any).openDatabase = undefined

            const mockItem: StorageItem<string> = {
                key: 'error-test-key',
                data: 'error-test-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await expect(adapter.getItem('test-key')).rejects.toThrow('WebSQL is not available')
            await expect(adapter.setItem(mockItem)).rejects.toThrow('WebSQL is not available')
            await expect(adapter.removeItem('test-key')).rejects.toThrow('WebSQL is not available')
            await expect(adapter.clear()).rejects.toThrow('WebSQL is not available')
            await expect(adapter.getKeys()).rejects.toThrow('WebSQL is not available')
            await expect(adapter.getStats()).rejects.toThrow('WebSQL is not available')
        })

        it('当 openDatabase 返回 undefined 时应该抛出错误', async () => {
            ; (global as any).openDatabase = vi.fn().mockReturnValue(undefined)

            const newAdapter = new WebSQLAdapter()
            const mockItem: StorageItem<string> = {
                key: 'undefined-db-key',
                data: 'undefined-db-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await expect(newAdapter.setItem(mockItem)).rejects.toThrow('Failed to open WebSQL database')
        })

        it('应该处理 SQL 执行错误', async () => {
            mockDatabase.simulateError(new MockSQLError(1, 'SQL execution failed'))

            const mockItem: StorageItem<string> = {
                key: 'sql-error-key',
                data: 'sql-error-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await expect(adapter.setItem(mockItem)).rejects.toThrow()

            mockDatabase.resetError()
        })

        it('应该处理数据库初始化错误', async () => {
            ; (global as any).openDatabase = vi.fn().mockImplementation(() => {
                throw new Error('Database initialization failed')
            })

            const errorAdapter = new WebSQLAdapter()
            const mockItem: StorageItem<string> = {
                key: 'init-error-key',
                data: 'init-error-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await expect(errorAdapter.setItem(mockItem)).rejects.toThrow('Database initialization failed')
        })
    })

    describe('数据类型支持', () => {
        it('应该支持字符串类型', async () => {
            const stringAdapter = new WebSQLAdapter<string>()
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

            const objectAdapter = new WebSQLAdapter<TestObject>()
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
            const arrayAdapter = new WebSQLAdapter<number[]>()
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

    describe('数据库初始化', () => {
        it('应该正确初始化数据库和表', async () => {
            // 通过执行一个操作来触发初始化
            const mockItem: StorageItem<string> = {
                key: 'init-test-key',
                data: 'init-test-data',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await adapter.setItem(mockItem)

            // 验证 openDatabase 被调用
            expect((global as any).openDatabase).toHaveBeenCalledWith(
                'request_cache',
                '1.0',
                'Request cache database',
                5 * 1024 * 1024
            )
        })

        it('应该只初始化一次数据库', async () => {
            const mockItem1: StorageItem<string> = {
                key: 'init-once-key1',
                data: 'init-once-data1',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            const mockItem2: StorageItem<string> = {
                key: 'init-once-key2',
                data: 'init-once-data2',
                timestamp: Date.now(),
                ttl: 60000,
                accessTime: Date.now(),
                accessCount: 1
            }

            await Promise.all([
                adapter.setItem(mockItem1),
                adapter.setItem(mockItem2)
            ])

            // openDatabase 应该只被调用一次
            expect((global as any).openDatabase).toHaveBeenCalledTimes(1)
        })
    })
})