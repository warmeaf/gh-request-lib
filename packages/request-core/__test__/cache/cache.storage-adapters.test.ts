import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import {
  StorageAdapter,
  MemoryStorageAdapter,
  LocalStorageAdapter,
  IndexedDBAdapter,
  WebSQLAdapter,
  StorageType
} from '../../src/cache'
import { MockStorageAdapter } from './cache-test-helpers'

describe('Storage Adapters Tests', () => {
  describe('StorageAdapter Interface', () => {
    let mockAdapter: MockStorageAdapter

    beforeEach(() => {
      mockAdapter = new MockStorageAdapter()
    })

    afterEach(() => {
      mockAdapter.reset()
    })

    it('should implement all required StorageAdapter methods', () => {
      expect(typeof mockAdapter.getItem).toBe('function')
      expect(typeof mockAdapter.setItem).toBe('function')
      expect(typeof mockAdapter.removeItem).toBe('function')
      expect(typeof mockAdapter.clear).toBe('function')
      expect(typeof mockAdapter.getKeys).toBe('function')
      expect(typeof mockAdapter.getStats).toBe('function')
      expect(typeof mockAdapter.destroy).toBe('function')
      expect(typeof mockAdapter.getType).toBe('function')
    })

    it('should handle basic storage operations', async () => {
      const testItem = {
        key: 'test-key',
        data: { message: 'test data' },
        timestamp: Date.now(),
        ttl: 300000,
        accessTime: Date.now(),
        accessCount: 1
      }

      // Set item
      await mockAdapter.setItem(testItem)
      
      // Get item
      const retrieved = await mockAdapter.getItem('test-key')
      expect(retrieved).toEqual(testItem)

      // Get keys
      const keys = await mockAdapter.getKeys()
      expect(keys).toContain('test-key')

      // Get stats
      const stats = await mockAdapter.getStats()
      expect(stats.size).toBe(1)

      // Remove item
      await mockAdapter.removeItem('test-key')
      
      const retrievedAfterRemoval = await mockAdapter.getItem('test-key')
      expect(retrievedAfterRemoval).toBeNull()
    })

    it('should handle clear operation', async () => {
      // Add multiple items
      const items = [
        { key: 'key1', data: 'data1', timestamp: Date.now(), ttl: 300000, accessTime: Date.now(), accessCount: 1 },
        { key: 'key2', data: 'data2', timestamp: Date.now(), ttl: 300000, accessTime: Date.now(), accessCount: 1 }
      ]

      for (const item of items) {
        await mockAdapter.setItem(item)
      }

      let stats = await mockAdapter.getStats()
      expect(stats.size).toBe(2)

      // Clear all
      await mockAdapter.clear()

      stats = await mockAdapter.getStats()
      expect(stats.size).toBe(0)

      const keys = await mockAdapter.getKeys()
      expect(keys).toHaveLength(0)
    })

    it('should handle destroy operation', async () => {
      const testItem = {
        key: 'test-key',
        data: 'test-data',
        timestamp: Date.now(),
        ttl: 300000,
        accessTime: Date.now(),
        accessCount: 1
      }

      await mockAdapter.setItem(testItem)
      
      // Destroy should clear all data
      await mockAdapter.destroy()

      const keys = await mockAdapter.getKeys()
      expect(keys).toHaveLength(0)
    })
  })

  describe('MemoryStorageAdapter', () => {
    let memoryAdapter: MemoryStorageAdapter

    beforeEach(() => {
      memoryAdapter = new MemoryStorageAdapter()
    })

    it('should return correct storage type', () => {
      expect(memoryAdapter.getType()).toBe(StorageType.MEMORY)
    })

    it('should store and retrieve items correctly', async () => {
      const testItem = {
        key: 'memory-test',
        data: { value: 42, text: 'memory test' },
        timestamp: Date.now(),
        ttl: 300000,
        accessTime: Date.now(),
        accessCount: 1
      }

      await memoryAdapter.setItem(testItem)

      const retrieved = await memoryAdapter.getItem('memory-test')
      expect(retrieved).toEqual(testItem)

      // Test non-existent item
      const nonExistent = await memoryAdapter.getItem('non-existent')
      expect(nonExistent).toBeNull()
    })

    it('should handle concurrent operations correctly', async () => {
      const items = Array.from({ length: 10 }, (_, i) => ({
        key: `concurrent-${i}`,
        data: `data-${i}`,
        timestamp: Date.now(),
        ttl: 300000,
        accessTime: Date.now(),
        accessCount: 1
      }))

      // Concurrent writes
      const writePromises = items.map(item => memoryAdapter.setItem(item))
      await Promise.all(writePromises)

      // Concurrent reads
      const readPromises = items.map(item => memoryAdapter.getItem(item.key))
      const results = await Promise.all(readPromises)

      // Verify all items were stored and retrieved correctly
      results.forEach((result, index) => {
        expect(result).toEqual(items[index])
      })

      const stats = await memoryAdapter.getStats()
      expect(stats.size).toBe(items.length)
    })

    it('should handle large data correctly', async () => {
      const largeData = {
        key: 'large-data',
        data: Array.from({ length: 10000 }, (_, i) => ({ id: i, value: `item-${i}` })),
        timestamp: Date.now(),
        ttl: 300000,
        accessTime: Date.now(),
        accessCount: 1
      }

      await memoryAdapter.setItem(largeData)

      const retrieved = await memoryAdapter.getItem('large-data')
      expect(retrieved).toEqual(largeData)
      expect(retrieved!.data).toHaveLength(10000)
    })

    it('should update existing items correctly', async () => {
      const initialItem = {
        key: 'update-test',
        data: 'initial data',
        timestamp: Date.now(),
        ttl: 300000,
        accessTime: Date.now(),
        accessCount: 1
      }

      await memoryAdapter.setItem(initialItem)

      const updatedItem = {
        ...initialItem,
        data: 'updated data',
        accessCount: 2
      }

      await memoryAdapter.setItem(updatedItem)

      const retrieved = await memoryAdapter.getItem('update-test')
      expect(retrieved!.data).toBe('updated data')
      expect(retrieved!.accessCount).toBe(2)
    })
  })

  describe('LocalStorageAdapter', () => {
    let localStorageAdapter: LocalStorageAdapter

    beforeEach(() => {
      // Mock localStorage for testing
      const mockStorage: Record<string, string> = {}
      global.localStorage = {
        getItem: vi.fn((key: string) => mockStorage[key] || null),
        setItem: vi.fn((key: string, value: string) => {
          mockStorage[key] = value
        }),
        removeItem: vi.fn((key: string) => {
          delete mockStorage[key]
        }),
        clear: vi.fn(() => {
          Object.keys(mockStorage).forEach(key => delete mockStorage[key])
        }),
        key: vi.fn((index: number) => {
          const keys = Object.keys(mockStorage)
          return keys[index] || null
        }),
        length: 0
      }
      
      // Update length property
      Object.defineProperty(global.localStorage, 'length', {
        get: () => Object.keys(mockStorage).length,
        configurable: true
      })

      localStorageAdapter = new LocalStorageAdapter()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return correct storage type', () => {
      expect(localStorageAdapter.getType()).toBe(StorageType.LOCAL_STORAGE)
    })

    it('should serialize and deserialize data correctly', async () => {
      const testItem = {
        key: 'local-test',
        data: { 
          number: 42, 
          string: 'test', 
          boolean: true, 
          array: [1, 2, 3],
          nested: { a: 1, b: 2 }
        },
        timestamp: Date.now(),
        ttl: 300000,
        accessTime: Date.now(),
        accessCount: 1
      }

      await localStorageAdapter.setItem(testItem)

      // Verify localStorage.setItem was called
      expect(localStorage.setItem).toHaveBeenCalledWith(
        'local-test',
        JSON.stringify(testItem)
      )

      const retrieved = await localStorageAdapter.getItem('local-test')
      expect(retrieved).toEqual(testItem)

      // Verify localStorage.getItem was called
      expect(localStorage.getItem).toHaveBeenCalledWith('local-test')
    })

    it('should handle JSON serialization errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Create an object that can't be JSON serialized
      const unserializableItem: any = {
        key: 'unserializable',
        data: {},
        timestamp: Date.now(),
        ttl: 300000,
        accessTime: Date.now(),
        accessCount: 1
      }
      // Add circular reference
      unserializableItem.data.self = unserializableItem.data

      await localStorageAdapter.setItem(unserializableItem)

      // Should handle the error gracefully
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle JSON parsing errors', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Mock localStorage to return invalid JSON
      (localStorage.getItem as any).mockReturnValueOnce('invalid json{')

      const result = await localStorageAdapter.getItem('invalid-json')
      expect(result).toBeNull()
      expect(consoleSpy).toHaveBeenCalled()
    })

    it('should handle localStorage quota exceeded error', async () => {
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {})

      // Mock localStorage to throw QuotaExceededError
      (localStorage.setItem as any).mockImplementation(() => {
        const error = new Error('QuotaExceededError')
        error.name = 'QuotaExceededError'
        throw error
      })

      const testItem = {
        key: 'quota-test',
        data: 'test data',
        timestamp: Date.now(),
        ttl: 300000,
        accessTime: Date.now(),
        accessCount: 1
      }

      await localStorageAdapter.setItem(testItem)

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringMatching(/quota.*exceeded/i),
        expect.any(Error)
      )
    })
  })

  describe('IndexedDBAdapter', () => {
    let indexedDBAdapter: IndexedDBAdapter

    beforeEach(() => {
      // Mock IndexedDB for testing
      const mockDB = {
        transaction: vi.fn(() => ({
          objectStore: vi.fn(() => ({
            get: vi.fn(() => ({
              onsuccess: null,
              onerror: null
            })),
            put: vi.fn(() => ({
              onsuccess: null,
              onerror: null
            })),
            delete: vi.fn(() => ({
              onsuccess: null,
              onerror: null
            })),
            clear: vi.fn(() => ({
              onsuccess: null,
              onerror: null
            })),
            getAllKeys: vi.fn(() => ({
              onsuccess: null,
              onerror: null
            })),
            count: vi.fn(() => ({
              onsuccess: null,
              onerror: null
            }))
          })),
          oncomplete: null,
          onerror: null,
          onabort: null
        })),
        close: vi.fn(),
        deleteObjectStore: vi.fn(),
        createObjectStore: vi.fn()
      }

      global.indexedDB = {
        open: vi.fn(() => ({
          onsuccess: null,
          onerror: null,
          onupgradeneeded: null,
          result: mockDB
        })),
        deleteDatabase: vi.fn(() => ({
          onsuccess: null,
          onerror: null
        }))
      } as any

      indexedDBAdapter = new IndexedDBAdapter()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return correct storage type', () => {
      expect(indexedDBAdapter.getType()).toBe(StorageType.INDEXED_DB)
    })

    // Note: Full IndexedDB testing would require more complex mocking
    // These tests focus on the interface compliance
    it('should implement all storage adapter methods', () => {
      expect(typeof indexedDBAdapter.getItem).toBe('function')
      expect(typeof indexedDBAdapter.setItem).toBe('function')
      expect(typeof indexedDBAdapter.removeItem).toBe('function')
      expect(typeof indexedDBAdapter.clear).toBe('function')
      expect(typeof indexedDBAdapter.getKeys).toBe('function')
      expect(typeof indexedDBAdapter.getStats).toBe('function')
      expect(typeof indexedDBAdapter.destroy).toBe('function')
    })
  })

  describe('WebSQLAdapter', () => {
    let webSQLAdapter: WebSQLAdapter

    beforeEach(() => {
      // Mock WebSQL (openDatabase) for testing
      global.openDatabase = vi.fn(() => ({
        transaction: vi.fn((callback: Function) => {
          callback({
            executeSql: vi.fn((sql: string, params: any[], success?: Function, error?: Function) => {
              // Simple mock behavior
              if (success) {
                success({}, { rows: [], insertId: 1, rowsAffected: 1 })
              }
            })
          })
        }),
        readTransaction: vi.fn((callback: Function) => {
          callback({
            executeSql: vi.fn((sql: string, params: any[], success?: Function, error?: Function) => {
              if (success) {
                success({}, { rows: { length: 0, item: () => null }, insertId: 1, rowsAffected: 0 })
              }
            })
          })
        })
      })) as any

      webSQLAdapter = new WebSQLAdapter()
    })

    afterEach(() => {
      vi.restoreAllMocks()
    })

    it('should return correct storage type', () => {
      expect(webSQLAdapter.getType()).toBe(StorageType.WEB_SQL)
    })

    it('should implement all storage adapter methods', () => {
      expect(typeof webSQLAdapter.getItem).toBe('function')
      expect(typeof webSQLAdapter.setItem).toBe('function')
      expect(typeof webSQLAdapter.removeItem).toBe('function')
      expect(typeof webSQLAdapter.clear).toBe('function')
      expect(typeof webSQLAdapter.getKeys).toBe('function')
      expect(typeof webSQLAdapter.getStats).toBe('function')
      expect(typeof webSQLAdapter.destroy).toBe('function')
    })

    // Note: Full WebSQL testing would require more complex mocking
    // This tests basic functionality without full database simulation
  })

  describe('Storage Adapter Performance', () => {
    const testData = Array.from({ length: 1000 }, (_, i) => ({
      key: `perf-test-${i}`,
      data: { id: i, value: `data-${i}`, timestamp: Date.now() },
      timestamp: Date.now(),
      ttl: 300000,
      accessTime: Date.now(),
      accessCount: 1
    }))

    it('should handle large number of items efficiently (Memory)', async () => {
      const memoryAdapter = new MemoryStorageAdapter()

      const startTime = performance.now()

      // Bulk insert
      for (const item of testData) {
        await memoryAdapter.setItem(item)
      }

      const insertTime = performance.now() - startTime

      // Bulk read
      const readStartTime = performance.now()
      for (const item of testData) {
        await memoryAdapter.getItem(item.key)
      }
      const readTime = performance.now() - readStartTime

      console.log(`Memory adapter - Insert: ${insertTime}ms, Read: ${readTime}ms`)

      // Verify all items were stored
      const stats = await memoryAdapter.getStats()
      expect(stats.size).toBe(testData.length)

      // Performance should be reasonable (adjust thresholds as needed)
      expect(insertTime).toBeLessThan(1000) // Less than 1 second for 1000 items
      expect(readTime).toBeLessThan(1000)
    })

    it('should handle memory cleanup efficiently', async () => {
      const memoryAdapter = new MemoryStorageAdapter()

      // Add items
      for (const item of testData.slice(0, 100)) {
        await memoryAdapter.setItem(item)
      }

      const startTime = performance.now()
      
      // Clear all
      await memoryAdapter.clear()
      
      const clearTime = performance.now() - startTime

      console.log(`Memory adapter - Clear: ${clearTime}ms`)

      const stats = await memoryAdapter.getStats()
      expect(stats.size).toBe(0)

      // Clear should be fast
      expect(clearTime).toBeLessThan(100)
    })
  })

  describe('Storage Adapter Error Handling', () => {
    it('should handle storage adapter failures gracefully', async () => {
      const failingAdapter = new MockStorageAdapter(true) // Set to fail

      // All operations should handle errors gracefully
      await expect(failingAdapter.getItem('test')).rejects.toThrow()
      await expect(failingAdapter.setItem({ key: 'test', data: 'test', timestamp: Date.now(), ttl: 300000, accessTime: Date.now(), accessCount: 1 })).rejects.toThrow()
      await expect(failingAdapter.removeItem('test')).rejects.toThrow()
      await expect(failingAdapter.clear()).rejects.toThrow()
      await expect(failingAdapter.getKeys()).rejects.toThrow()
      await expect(failingAdapter.getStats()).rejects.toThrow()
      await expect(failingAdapter.destroy()).rejects.toThrow()
    })

    it('should handle partial failures in batch operations', async () => {
      const memoryAdapter = new MemoryStorageAdapter()
      const items = testData.slice(0, 10)

      // Add some items successfully
      for (let i = 0; i < 5; i++) {
        await memoryAdapter.setItem(items[i])
      }

      // Verify partial success
      const stats = await memoryAdapter.getStats()
      expect(stats.size).toBe(5)

      // Items that were added should be retrievable
      for (let i = 0; i < 5; i++) {
        const retrieved = await memoryAdapter.getItem(items[i].key)
        expect(retrieved).toEqual(items[i])
      }

      // Items that weren't added should return null
      for (let i = 5; i < 10; i++) {
        const retrieved = await memoryAdapter.getItem(items[i].key)
        expect(retrieved).toBeNull()
      }
    })
  })

  describe('Storage Type Compatibility', () => {
    it('should correctly identify storage types', () => {
      const memoryAdapter = new MemoryStorageAdapter()
      const localStorageAdapter = new LocalStorageAdapter()
      const indexedDBAdapter = new IndexedDBAdapter()
      const webSQLAdapter = new WebSQLAdapter()

      expect(memoryAdapter.getType()).toBe(StorageType.MEMORY)
      expect(localStorageAdapter.getType()).toBe(StorageType.LOCAL_STORAGE)
      expect(indexedDBAdapter.getType()).toBe(StorageType.INDEXED_DB)
      expect(webSQLAdapter.getType()).toBe(StorageType.WEB_SQL)
    })

    it('should maintain type consistency across operations', async () => {
      const adapters = [
        new MemoryStorageAdapter(),
        new LocalStorageAdapter()
      ]

      for (const adapter of adapters) {
        const initialType = adapter.getType()
        
        // Perform various operations
        const testItem = {
          key: 'type-test',
          data: 'test-data',
          timestamp: Date.now(),
          ttl: 300000,
          accessTime: Date.now(),
          accessCount: 1
        }

        await adapter.setItem(testItem)
        await adapter.getItem('type-test')
        await adapter.getKeys()
        await adapter.getStats()
        await adapter.removeItem('type-test')
        
        // Type should remain consistent
        expect(adapter.getType()).toBe(initialType)
      }
    })
  })
})
