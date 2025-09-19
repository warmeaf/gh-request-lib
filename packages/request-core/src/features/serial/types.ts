import { RequestConfig } from '../../interface'

/**
 * @description 串行请求任务
 */
export interface SerialTask {
  id: string // 任务唯一标识
  config: RequestConfig // 请求配置
  resolve: (value: any) => void // Promise resolve 函数
  reject: (reason?: any) => void // Promise reject 函数
  createdAt: number // 创建时间戳
}

/**
 * @description 串行队列统计信息
 */
export interface SerialQueueStats {
  totalTasks: number // 总任务数
  pendingTasks: number // 等待中的任务数
  completedTasks: number // 已完成的任务数
  failedTasks: number // 失败的任务数
  processingTime: number // 平均处理时间
  isProcessing: boolean // 是否正在处理
  lastProcessedAt?: number // 最后处理时间
}

/**
 * @description 串行请求配置
 */
export interface SerialConfig {
  maxQueueSize?: number // 最大队列大小，默认无限制
  timeout?: number // 队列超时时间(毫秒)，默认无超时
  onQueueFull?: (serialKey: string) => void // 队列满时回调
  onTaskTimeout?: (task: SerialTask) => void // 任务超时回调
  debug?: boolean // 调试模式
}

/**
 * @description 串行请求管理器配置
 */
export interface SerialManagerConfig {
  defaultQueueConfig?: SerialConfig // 默认队列配置
  maxQueues?: number // 最大队列数量，默认无限制
  cleanupInterval?: number // 清理间隔(毫秒)，默认30秒
  autoCleanup?: boolean // 是否自动清理空队列，默认true
  debug?: boolean // 调试模式
}

/**
 * @description 串行请求管理器统计信息
 */
export interface SerialManagerStats {
  totalQueues: number // 总队列数
  activeQueues: number // 活跃队列数(有任务或正在处理的队列)
  totalTasks: number // 总任务数
  totalPendingTasks: number // 总等待中任务数
  totalCompletedTasks: number // 总完成任务数
  totalFailedTasks: number // 总失败任务数
  avgProcessingTime: number // 平均处理时间
  queues: Record<string, SerialQueueStats> // 各队列的统计信息
}

/**
 * @description 任务执行结果
 */
export interface TaskResult<T = any> {
  success: boolean
  data?: T
  error?: Error
  executionTime: number
  taskId: string
}
