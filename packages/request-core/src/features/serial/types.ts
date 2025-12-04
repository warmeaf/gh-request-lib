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
 * @description 任务执行结果
 */
export interface TaskResult<T = any> {
  success: boolean
  data?: T
  error?: Error
  executionTime: number
  taskId: string
}
