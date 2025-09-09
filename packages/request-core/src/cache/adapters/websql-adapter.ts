/**
 * @description WebSQL 存储适配器
 * 基于浏览器 WebSQL 的存储实现（已废弃，但为了兼容性保留）
 */

import { StorageAdapter, StorageItem, StorageType } from '../storage-adapter'

// WebSQL 相关的类型声明
interface Database {
  transaction(callback: (tx: SQLTransaction) => void): void;
}

interface SQLTransaction {
  executeSql(
    sql: string,
    args?: any[],
    successCallback?: (tx: SQLTransaction, results: SQLResultSet) => void,
    errorCallback?: (tx: SQLTransaction, error: SQLError) => void
  ): void;
}

interface SQLResultSet {
  rows: SQLResultSetRowList;
  rowsAffected: number;
  insertId: number;
}

interface SQLResultSetRowList {
  length: number;
  item(index: number): any;
}

interface SQLError {
  code: number;
  message: string;
}

// 声明全局的 openDatabase 函数
declare const openDatabase: (
  name: string,
  version: string,
  displayName: string,
  estimatedSize: number
) => Database | undefined;

export class WebSQLAdapter<T = unknown> implements StorageAdapter<T> {
  private static readonly DB_NAME = 'request_cache'
  private static readonly DB_VERSION = '1.0'
  private static readonly DB_DESCRIPTION = 'Request cache database'
  private static readonly DB_SIZE = 5 * 1024 * 1024 // 5MB
  
  private db: Database | null = null
  private initPromise: Promise<void> | null = null

  getType(): StorageType {
    return StorageType.WEB_SQL
  }

  isAvailable(): boolean {
    // 检查 WebSQL 是否可用（注意：WebSQL 已被废弃）
    return typeof openDatabase !== 'undefined' && openDatabase !== undefined;
  }

  async getItem(key: string): Promise<StorageItem<T> | null> {
    if (!this.isAvailable()) {
      throw new Error('WebSQL is not available')
    }

    await this.init()
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          'SELECT data FROM cache WHERE key = ?',
          [key],
          (tx, results) => {
            if (results.rows.length > 0) {
              try {
                const item: StorageItem<T> = JSON.parse(results.rows.item(0).data)
                resolve(item)
              } catch (error) {
                reject(error)
              }
            } else {
              resolve(null)
            }
          },
          (tx, error) => {
            reject(error)
            return false
          }
        )
      })
    })
  }

  async setItem(item: StorageItem<T>): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('WebSQL is not available')
    }

    await this.init()
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          'INSERT OR REPLACE INTO cache (key, data) VALUES (?, ?)',
          [item.key, JSON.stringify(item)],
          () => {
            resolve()
          },
          (tx, error) => {
            reject(error)
            return false
          }
        )
      })
    })
  }

  async removeItem(key: string): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('WebSQL is not available')
    }

    await this.init()
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          'DELETE FROM cache WHERE key = ?',
          [key],
          () => {
            resolve()
          },
          (tx, error) => {
            reject(error)
            return false
          }
        )
      })
    })
  }

  async clear(): Promise<void> {
    if (!this.isAvailable()) {
      throw new Error('WebSQL is not available')
    }

    await this.init()
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          'DELETE FROM cache',
          [],
          () => {
            resolve()
          },
          (tx, error) => {
            reject(error)
            return false
          }
        )
      })
    })
  }

  async getKeys(): Promise<string[]> {
    if (!this.isAvailable()) {
      throw new Error('WebSQL is not available')
    }

    await this.init()
    
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error('Database not initialized'))
        return
      }

      this.db.transaction((tx) => {
        tx.executeSql(
          'SELECT key FROM cache',
          [],
          (tx, results) => {
            const keys: string[] = []
            for (let i = 0; i < results.rows.length; i++) {
              keys.push(results.rows.item(i).key)
            }
            resolve(keys)
          },
          (tx, error) => {
            reject(error)
            return false
          }
        )
      })
    })
  }

  async getStats(): Promise<{
    size: number
    maxSize?: number
    [key: string]: unknown
  }> {
    if (!this.isAvailable()) {
      throw new Error('WebSQL is not available')
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

    // WebSQL 没有直接的销毁方法，我们只能清空数据
    if (this.db) {
      try {
        await this.clear()
      } catch (error) {
        console.warn('Failed to clear WebSQL database:', error)
      }
    }
    
    this.db = null
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
      try {
        // 检查 openDatabase 是否可用
        if (typeof openDatabase === 'undefined' || openDatabase === undefined) {
          reject(new Error('WebSQL is not supported in this environment'));
          return;
        }
        
        const db = openDatabase(
          WebSQLAdapter.DB_NAME,
          WebSQLAdapter.DB_VERSION,
          WebSQLAdapter.DB_DESCRIPTION,
          WebSQLAdapter.DB_SIZE
        )
        
        // 检查 db 是否为 undefined
        if (db === undefined) {
          reject(new Error('Failed to open WebSQL database'));
          return;
        }
        
        this.db = db;

        this.db.transaction((tx) => {
          tx.executeSql(
            'CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, data TEXT)',
            [],
            () => {
              resolve()
            },
            (tx, error) => {
              reject(error)
              return false
            }
          )
        })
      } catch (error) {
        reject(error)
      }
    })
  }
}