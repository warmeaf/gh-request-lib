/**
 * @description IndexedDB 存储适配器
 * 基于浏览器 IndexedDB 的存储实现
 */

import { StorageAdapter, StorageItem, StorageType } from '../storage-adapter'

export class IndexedDBAdapter<T = unknown> implements StorageAdapter<T> {
  private static readonly DB_NAME = 'RequestCache'
  private static readonly STORE_NAME = 'cache'
  private static readonly VERSION = 1
  
  private db: IDBDatabase | null = null
  private initPromise: Promise<void> | null = null

  getType(): StorageType {
    return StorageType.INDEXED_DB
  }

  isAvailable(): boolean {
    return typeof indexedDB !== 'undefined'
  }

  async getItem(key: string): Promise<StorageItem<T> | null> {
    if (!this.isAvailable()) {
      throw new Error('IndexedDB is not available')
    }

    await this.init()
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction([IndexedDBAdapter.STORE_NAME], 'readonly')
      const store = transaction.objectStore(IndexedDBAdapter.STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => {
        resolve(request.result || null)
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async setItem(item: StorageItem<T>): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('IndexedDB is not available')
    }

    await this.init()
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction([IndexedDBAdapter.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(IndexedDBAdapter.STORE_NAME)
      const request = store.put(item)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async removeItem(key: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('IndexedDB is not available')
    }

    await this.init()
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction([IndexedDBAdapter.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(IndexedDBAdapter.STORE_NAME)
      const request = store.delete(key)

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async clear(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('IndexedDB is not available')
    }

    await this.init()
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction([IndexedDBAdapter.STORE_NAME], 'readwrite')
      const store = transaction.objectStore(IndexedDBAdapter.STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => {
        resolve()
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async getKeys(): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('IndexedDB is not available')
    }

    await this.init()
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      const transaction = this.db.transaction([IndexedDBAdapter.STORE_NAME], 'readonly')
      const store = transaction.objectStore(IndexedDBAdapter.STORE_NAME)
      const request = store.getAllKeys()

      request.onsuccess = () => {
        resolve(request.result as string[])
      }

      request.onerror = () => {
        reject(request.error)
      }
    })
  }

  async getStats(): Promise<{
    size: number
    maxSize?: number
    [key: string]: unknown
  }> {
    if (!this.isAvailable()) {
      throw new Error('IndexedDB is not available')
    }

    // 获取键列表来估算大小
    const keys = await this.getKeys()
    
    return {
      size: keys.length
    }
  }

  async destroy(): Promise<void> {
    if (!this.isAvailable()) {
      return
    }

    if (this.db) {
      this.db.close()
      this.db = null
    }
    
    this.initPromise = null
  }

  private async init(): Promise<void> {
    if (!this.initPromise) {
      this.initPromise = this.initDB()
    }
    return this.initPromise
  }

  private async initDB(): Promise<void> {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(IndexedDBAdapter.DB_NAME, IndexedDBAdapter.VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        
        // 创建对象存储
        if (!db.objectStoreNames.contains(IndexedDBAdapter.STORE_NAME)) {
          const store = db.createObjectStore(IndexedDBAdapter.STORE_NAME, { keyPath: 'key' })
          store.createIndex('timestamp', 'timestamp', { unique: false })
          store.createIndex('accessTime', 'accessTime', { unique: false })
        }
      }

      request.onsuccess = (event) => {
        this.db = (event.target as IDBOpenDBRequest).result
        resolve()
      }

      request.onerror = (event) => {
        reject((event.target as IDBOpenDBRequest).error)
      }
    })
  }
}