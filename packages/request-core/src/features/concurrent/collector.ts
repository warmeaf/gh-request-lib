import type { ConcurrentResult } from './types'

/**
 * @description 高效结果收集器 - 使用紧凑数据结构
 */
export class ResultCollector<T> {
  private results: Array<ConcurrentResult<T> | undefined>
  private completedCount = 0
  private readonly totalCount: number

  constructor(totalCount: number) {
    this.totalCount = totalCount
    this.results = new Array(totalCount)
  }

  setResult(index: number, result: ConcurrentResult<T>): void {
    if (this.results[index] === undefined) {
      this.completedCount++
    }
    this.results[index] = result
  }

  getCompletedCount(): number {
    return this.completedCount
  }

  isComplete(): boolean {
    return this.completedCount >= this.totalCount
  }

  getResults(): ConcurrentResult<T>[] {
    return this.results.filter((r): r is ConcurrentResult<T> => Boolean(r))
  }
}
