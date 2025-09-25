import { RequestConfig, RequestInterceptor, Requestor } from '../../interface'
import { SerialRequestManager } from './manager'
import { SerialConfig, SerialManagerConfig } from './types'

/**
 * @description 串行请求拦截器 - 拦截带有 serialKey 的请求并加入对应的串行队列
 */
export class SerialRequestInterceptor implements RequestInterceptor {
  private serialManager: SerialRequestManager
  private readonly config: {
    enabled: boolean
    debug: boolean
  }

  constructor(
    requestor: Requestor,
    managerConfig?: SerialManagerConfig,
    options: {
      enabled?: boolean
      debug?: boolean
    } = {}
  ) {
    this.serialManager = new SerialRequestManager(requestor, managerConfig)
    this.config = {
      enabled: options.enabled !== false, // 默认启用
      debug: options.debug || false
    }

    if (this.config.debug) {
      console.log('[SerialRequestInterceptor] Interceptor initialized')
    }
  }

  /**
   * 请求拦截逻辑
   */
  async onRequest(config: RequestConfig): Promise<RequestConfig> {
    // 如果串行功能未启用，直接返回原配置
    if (!this.config.enabled) {
      return config
    }

    // 如果请求没有 serialKey，直接返回原配置
    if (!config.serialKey) {
      return config
    }

    if (this.config.debug) {
      console.log(`[SerialRequestInterceptor] Intercepted request with serialKey: ${config.serialKey}`)
    }

    // 从 metadata 中提取串行队列配置（如果有的话）
    const queueConfig = this.extractSerialConfig(config)

    // 这里我们需要"劫持"请求执行流程
    // 我们不能简单地返回修改后的配置，因为需要将请求放入队列
    // 我们需要抛出一个特殊的"拦截"标记，让后续处理知道这个请求已被串行化处理
    throw new SerialInterceptedException(config, queueConfig, this.serialManager)
  }

  /**
   * 从请求配置中提取串行配置
   */
  private extractSerialConfig(config: RequestConfig): SerialConfig | undefined {
    const metadata = config.metadata
    if (!metadata) {
      return undefined
    }

    // 从 metadata 中提取串行相关配置
    const serialConfig = metadata.serialConfig as SerialConfig
    return serialConfig
  }

  /**
   * 启用串行功能
   */
  enable(): void {
    this.config.enabled = true
    if (this.config.debug) {
      console.log('[SerialRequestInterceptor] Serial feature enabled')
    }
  }

  /**
   * 禁用串行功能
   */
  disable(): void {
    this.config.enabled = false
    if (this.config.debug) {
      console.log('[SerialRequestInterceptor] Serial feature disabled')
    }
  }

  /**
   * 检查是否启用
   */
  isEnabled(): boolean {
    return this.config.enabled
  }

  /**
   * 获取串行管理器
   */
  getManager(): SerialRequestManager {
    return this.serialManager
  }

  /**
   * 获取管理器统计信息
   */
  getStats() {
    return this.serialManager.getStats()
  }

  /**
   * 清空指定队列
   */
  clearQueue(serialKey: string): boolean {
    return this.serialManager.clearQueue(serialKey)
  }

  /**
   * 清空所有队列
   */
  clearAllQueues(): void {
    this.serialManager.clearAllQueues()
  }

  /**
   * 销毁拦截器
   */
  destroy(): void {
    this.serialManager.destroy()
    if (this.config.debug) {
      console.log('[SerialRequestInterceptor] Interceptor destroyed')
    }
  }
}

/**
 * @description 串行拦截异常类 - 用于标记请求已被串行化处理
 * 这是一个特殊的异常，用于中断正常的请求流程并转入串行队列处理
 */
export class SerialInterceptedException extends Error {
  public readonly isSerialIntercepted = true
  public readonly config: RequestConfig
  public readonly queueConfig?: SerialConfig
  public readonly serialManager: SerialRequestManager

  constructor(config: RequestConfig, queueConfig: SerialConfig | undefined, serialManager: SerialRequestManager) {
    super('Request intercepted for serial processing')
    this.name = 'SerialInterceptedException'
    this.config = config
    this.queueConfig = queueConfig
    this.serialManager = serialManager
  }
}

/**
 * @description 检查是否为串行拦截异常
 */
export function isSerialInterceptedException(error: any): error is SerialInterceptedException {
  return !!(error && error.isSerialIntercepted === true)
}
