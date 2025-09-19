// 类型定义导出
export type {
  SerialTask,
  SerialQueueStats,
  SerialConfig,
  SerialManagerConfig,
  SerialManagerStats,
  TaskResult
} from './types'

// 核心类导出
export { SerialQueue } from './queue'
export { SerialRequestManager } from './manager'
export { SerialFeature } from './feature'
export { 
  SerialRequestInterceptor,
  SerialInterceptedException,
  isSerialInterceptedException
} from './interceptor'

// 默认导出主要功能类
export { SerialFeature as default } from './feature'
