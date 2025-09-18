/**
 * @description 高效信号量实现 - 带超时和清理机制
 */
export class Semaphore {
  private permits: number
  private waitingQueue: Array<{
    resolve: () => void
    reject: (error: Error) => void
    timeout: NodeJS.Timeout | null
    timestamp: number
  }> = []
  private cleanupInterval: NodeJS.Timeout | null = null
  private readonly maxWaitTime = 30000

  constructor(permits: number) {
    this.permits = permits
    this.startPeriodicCleanup()
  }

  async acquire(): Promise<void> {
    if (this.permits > 0) {
      this.permits--
      return Promise.resolve()
    }

    return new Promise<void>((resolve, reject) => {
      const timestamp = Date.now()

      const timeout = setTimeout(() => {
        this.removeFromQueue(item)
        reject(new Error(`Semaphore acquire timeout after ${this.maxWaitTime}ms`))
      }, this.maxWaitTime)

      const item = { resolve, reject, timeout, timestamp }
      this.waitingQueue.push(item)
    })
  }

  release(): void {
    this.permits++
    const nextItem = this.waitingQueue.shift()
    if (nextItem) {
      this.permits--
      if (nextItem.timeout) {
        clearTimeout(nextItem.timeout)
      }
      nextItem.resolve()
    }
  }

  private removeFromQueue(targetItem: (typeof this.waitingQueue)[0]): void {
    const index = this.waitingQueue.indexOf(targetItem)
    if (index > -1) {
      this.waitingQueue.splice(index, 1)
    }
  }

  private startPeriodicCleanup(): void {
    this.cleanupInterval = setInterval(() => {
      this.cleanupExpiredWaiters()
    }, 5 * 60 * 1000)
  }

  private cleanupExpiredWaiters(): void {
    const now = Date.now()
    const expiredItems = this.waitingQueue.filter(
      (item) => now - item.timestamp > this.maxWaitTime
    )

    expiredItems.forEach((item) => {
      this.removeFromQueue(item)
      if (item.timeout) {
        clearTimeout(item.timeout)
      }
      item.reject(new Error('Semaphore acquire expired during cleanup'))
    })

    if (expiredItems.length > 0) {
      console.warn(`[Semaphore] Cleaned up ${expiredItems.length} expired waiters`)
    }
  }

  available(): number {
    return this.permits
  }

  waitingCount(): number {
    return this.waitingQueue.length
  }

  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }

    this.waitingQueue.forEach((item) => {
      if (item.timeout) {
        clearTimeout(item.timeout)
      }
      item.reject(new Error('Semaphore destroyed'))
    })

    this.waitingQueue = []
    this.permits = 0
  }
}
