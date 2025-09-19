import { RequestConfig, Requestor } from '../../interface'
import { SerialRequestManager } from './manager'
import { SerialRequestInterceptor, SerialInterceptedException, isSerialInterceptedException } from './interceptor'
import { SerialConfig, SerialManagerConfig, SerialManagerStats } from './types'

/**
 * @description 串行请求功能类 - 对外提供串行请求的完整功能
 */
export class SerialFeature {
  private readonly manager: SerialRequestManager
  private readonly interceptor: SerialRequestInterceptor
  private readonly requestor: Requestor
  private readonly config: {
    debug: boolean
  }

  constructor(
    requestor: Requestor,
    managerConfig?: SerialManagerConfig,
    options: {
      debug?: boolean
    } = {}
  ) {
    this.requestor = requestor
    this.config = {
      debug: options.debug || false
    }

    // 初始化管理器和拦截器
    this.manager = new SerialRequestManager(requestor, managerConfig)
    this.interceptor = new SerialRequestInterceptor(requestor, managerConfig, options)

    if (this.config.debug) {
      console.log('[SerialFeature] Serial feature initialized')
    }
  }

  /**
   * 处理串行请求 - 主要的处理逻辑
   * 这个方法应该在拦截器链中被调用
   */
  async handleSerialRequest<T = any>(config: RequestConfig): Promise<T> {
    try {
      // 尝试通过拦截器处理请求
      await this.interceptor.onRequest(config)
      
      // 如果执行到这里，说明请求没有被串行化，直接执行
      return this.requestor.request<T>(config)
    } catch (error) {
      // 检查是否为串行拦截异常
      if (isSerialInterceptedException(error)) {
        // 处理串行请求
        return this.processSerialRequest<T>(error)
      }
      
      // 其他异常直接抛出
      throw error
    }
  }

  /**
   * 处理被拦截的串行请求
   */
  private async processSerialRequest<T = any>(exception: SerialInterceptedException): Promise<T> {
    const { config, queueConfig } = exception
    const serialKey = config.serialKey!

    if (this.config.debug) {
      console.log(`[SerialFeature] Processing serial request for key: ${serialKey}`)
    }

    // 将请求加入串行队列
    return this.manager.enqueueRequest<T>(serialKey, config, queueConfig)
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
   * 获取统计信息
   */
  getStats(): SerialManagerStats {
    return this.manager.getStats()
  }

  /**
   * 获取指定队列的统计信息
   */
  getQueueStats(serialKey: string) {
    return this.manager.getQueueStats(serialKey)
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
    this.interceptor.destroy()
    this.manager.destroy()
    
    if (this.config.debug) {
      console.log('[SerialFeature] Serial feature destroyed')
    }
  }
}
