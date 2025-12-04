/**
 * @description LocalStorage 存储适配器
 * 基于浏览器 LocalStorage 的存储实现
 */

import { StorageAdapter, StorageItem, StorageType } from '../storage-adapter'

export class LocalStorageAdapter<T = unknown> implements StorageAdapter<T> {
  private static readonly PREFIX = 'request_cache_'
  private static readonly META_KEY = 'request_cache_meta'
  
  private meta: {
    keys: string[]
  } = {
    keys: []
  }
  
  constructor() {
    this.loadMeta()
  }

  getType(): StorageType {
    return StorageType.LOCAL_STORAGE
  }

  isAvailable(): boolean {
    try {
      const testKey = '__request_cache_test__'
      localStorage.setItem(testKey, testKey)
      localStorage.removeItem(testKey)
      return true
    } catch (e) {
      return false
    }
  }

  async getItem(key: string): Promise<StorageItem<T> | null> {
    if (!this.isAvailable()) {
      throw new Error('LocalStorage is not available')
    }

    try {
      const itemStr = localStorage.getItem(this.getKey(key))
      if (!itemStr) {
        return null
      }
      
      const item: StorageItem<T> = JSON.parse(itemStr)
      return item
    } catch (error) {
      console.error('Failed to get item from LocalStorage:', error)
      return null
    }
  }

  async setItem(item: StorageItem<T>): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('LocalStorage is not available')
    }

    try {
      const key = item.key
      localStorage.setItem(this.getKey(key), JSON.stringify(item))
      
      // 更新元数据
      if (!this.meta.keys.includes(key)) {
        this.meta.keys.push(key)
        this.saveMeta()
      }
    } catch (error) {
      console.error('Failed to set item in LocalStorage:', error)
      throw error
    }
  }

  async removeItem(key: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('LocalStorage is not available')
    }

    try {
      localStorage.removeItem(this.getKey(key))
      
      // 更新元数据
      const index = this.meta.keys.indexOf(key)
      if (index > -1) {
        this.meta.keys.splice(index, 1)
        this.saveMeta()
      }
    } catch (error) {
      console.error('Failed to remove item from LocalStorage:', error)
      throw error
    }
  }

  async clear(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('LocalStorage is not available')
    }

    try {
      // 删除所有缓存项
      for (const key of this.meta.keys) {
        localStorage.removeItem(this.getKey(key))
      }
      
      // 清空元数据
      this.meta.keys = []
      this.saveMeta()
    } catch (error) {
      console.error('Failed to clear LocalStorage:', error)
      throw error
    }
  }

  async getKeys(): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('LocalStorage is not available')
    }

    return [...this.meta.keys]
  }

  async destroy(): Promise<void> {
    if (!this.isAvailable()) {
      return
    }

    try {
      await this.clear()
    } catch (error) {
      console.error('Failed to destroy LocalStorage adapter:', error)
    }
  }

  private getKey(key: string): string {
    return `${LocalStorageAdapter.PREFIX}${key}`
  }

  private loadMeta(): void {
    if (!this.isAvailable()) {
      return
    }

    try {
      const metaStr = localStorage.getItem(LocalStorageAdapter.META_KEY)
      if (metaStr) {
        this.meta = JSON.parse(metaStr)
      }
    } catch (error) {
      console.warn('Failed to load LocalStorage meta data:', error)
      this.meta = { keys: [] }
    }
  }

  private saveMeta(): void {
    if (!this.isAvailable()) {
      return
    }

    try {
      localStorage.setItem(LocalStorageAdapter.META_KEY, JSON.stringify(this.meta))
    } catch (error) {
      console.warn('Failed to save LocalStorage meta data:', error)
    }
  }
}