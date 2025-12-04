import { RequestConfig, Requestor } from '../../interface'
import { SerialRequestManager } from './manager'
import { SerialRequestInterceptor } from './interceptor'
import { SerialConfig, SerialManagerConfig } from './types'

/**
 * @description 串行请求功能类 - 对外提供串行请求的完整功能
 */
export class SerialFeature {
  private readonly manager: SerialRequestManager
  private readonly interceptor: SerialRequestInterceptor
  private readonly requestor: Requestor

  constructor(
    requestor: Requestor,
    managerConfig?: SerialManagerConfig,
    options: {
      debug?: boolean
    } = {}
  ) {
    this.requestor = requestor

    // 合并 debug 配置到 managerConfig
    const finalManagerConfig: SerialManagerConfig = {
      ...managerConfig,
      debug: options.debug ?? managerConfig?.debug ?? false
    }

    // 先创建管理器实例
    this.manager = new SerialRequestManager(requestor, finalManagerConfig)
    
    // 将 manager 实例传递给 interceptor，实现共享
    this.interceptor = new SerialRequestInterceptor(requestor, managerConfig, {
      ...options,
      serialManager: this.manager
    })

    if (this.manager.isDebug()) {
      console.log('[SerialFeature] Serial feature initialized')
    }
  }

  /**
   * 处理串行请求 - 主要的处理逻辑
   * 这个方法应该在拦截器链中被调用
   */
  async handleSerialRequest<T = any>(config: RequestConfig): Promise<T> {
    // 如果串行功能未启用，直接执行请求
    if (!this.interceptor.isEnabled()) {
      return this.requestor.request<T>(config)
    }

    // 如果请求没有 serialKey，直接执行请求
    if (!config.serialKey) {
      return this.requestor.request<T>(config)
    }

    // 从 metadata 中提取串行队列配置（如果有的话）
    const queueConfig = this.extractSerialConfig(config)
    const serialKey = config.serialKey

    if (this.manager.isDebug()) {
      console.log(`[SerialFeature] Processing serial request for key: ${serialKey}`)
    }

    // 将请求加入串行队列
    return this.manager.enqueueRequest<T>(serialKey, config, queueConfig)
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
   * 直接发起串行请求 - 便利方法
   */
  async requestSerial<T = any>(config: RequestConfig, queueConfig?: SerialConfig): Promise<T> {
    if (!config.serialKey) {
      throw new Error('serialKey is required for serial requests')
    }

    return this.manager.enqueueRequest<T>(config.serialKey, config, queueConfig)
  }

  /**
   * 串行 GET 请求
   */
  async getSerial<T = any>(
    url: string,
    serialKey: string,
    config?: Partial<RequestConfig>,
    queueConfig?: SerialConfig
  ): Promise<T> {
    const requestConfig: RequestConfig = {
      url,
      method: 'GET',
      serialKey,
      ...config
    }

    return this.requestSerial<T>(requestConfig, queueConfig)
  }

  /**
   * 串行 POST 请求
   */
  async postSerial<T = any>(
    url: string,
    serialKey: string,
    data?: any,
    config?: Partial<RequestConfig>,
    queueConfig?: SerialConfig
  ): Promise<T> {
    const requestConfig: RequestConfig = {
      url,
      method: 'POST',
      data,
      serialKey,
      ...config
    }

    return this.requestSerial<T>(requestConfig, queueConfig)
  }

  /**
   * 串行 PUT 请求
   */
  async putSerial<T = any>(
    url: string,
    serialKey: string,
    data?: any,
    config?: Partial<RequestConfig>,
    queueConfig?: SerialConfig
  ): Promise<T> {
    const requestConfig: RequestConfig = {
      url,
      method: 'PUT',
      data,
      serialKey,
      ...config
    }

    return this.requestSerial<T>(requestConfig, queueConfig)
  }

  /**
   * 串行 DELETE 请求
   */
  async deleteSerial<T = any>(
    url: string,
    serialKey: string,
    config?: Partial<RequestConfig>,
    queueConfig?: SerialConfig
  ): Promise<T> {
    const requestConfig: RequestConfig = {
      url,
      method: 'DELETE',
      serialKey,
      ...config
    }

    return this.requestSerial<T>(requestConfig, queueConfig)
  }

  /**
   * 串行 PATCH 请求
   */
  async patchSerial<T = any>(
    url: string,
    serialKey: string,
    data?: any,
    config?: Partial<RequestConfig>,
    queueConfig?: SerialConfig
  ): Promise<T> {
    const requestConfig: RequestConfig = {
      url,
      method: 'PATCH',
      data,
      serialKey,
      ...config
    }

    return this.requestSerial<T>(requestConfig, queueConfig)
  }

  /**
   * 获取拦截器实例 - 用于集成到拦截器链
   */
  getInterceptor(): SerialRequestInterceptor {
    return this.interceptor
  }

  /**
   * 获取管理器实例
   */
  getManager(): SerialRequestManager {
    return this.manager
  }

  /**
   * 获取所有队列的标识
   */
  getQueueKeys(): string[] {
    return this.manager.getQueueKeys()
  }

  /**
   * 清空指定队列
   */
  clearQueue(serialKey: string): boolean {
    return this.manager.clearQueue(serialKey)
  }

  /**
   * 清空所有队列
   */
  clearAllQueues(): void {
    this.manager.clearAllQueues()
  }

  /**
   * 移除指定队列
   */
  removeQueue(serialKey: string): boolean {
    return this.manager.removeQueue(serialKey)
  }

  /**
   * 移除所有队列
   */
  removeAllQueues(): void {
    this.manager.removeAllQueues()
  }

  /**
   * 检查队列是否存在
   */
  hasQueue(serialKey: string): boolean {
    return this.manager.hasQueue(serialKey)
  }

  /**
   * 启用串行功能
   */
  enable(): void {
    this.interceptor.enable()
  }

  /**
   * 禁用串行功能
   */
  disable(): void {
    this.interceptor.disable()
  }

  /**
   * 检查功能是否启用
   */
  isEnabled(): boolean {
    return this.interceptor.isEnabled()
  }

  /**
   * 手动清理空队列
   */
  cleanup(): void {
    this.manager.cleanup()
  }

  /**
   * 销毁功能实例
   */
  destroy(): void {
    // interceptor 使用的是共享的 manager，所以只销毁 interceptor（不会销毁 manager）
    this.interceptor.destroy()
    // 销毁 manager
    this.manager.destroy()
    
    if (this.manager.isDebug()) {
      console.log('[SerialFeature] Serial feature destroyed')
    }
  }
}
