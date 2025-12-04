/**
 * @description 内存存储适配器
 * 基于 Map 的内存存储实现
 */

import { StorageAdapter, StorageItem, StorageType } from '../storage-adapter'

export class MemoryStorageAdapter<T = unknown> implements StorageAdapter<T> {
  private storage: Map<string, StorageItem<T>> = new Map()
  
  getType(): StorageType {
    return StorageType.MEMORY
  }

  isAvailable(): boolean {
    return true
  }

  async getItem(key: string): Promise<StorageItem<T> | null> {
    const item = this.storage.get(key)
    return item || null
  }

  async setItem(item: StorageItem<T>): Promise<void> {
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

  async destroy(): Promise<void> {
    this.storage.clear()
  }
}