/**
 * @description 高性能缓存键生成器
 * 
 * 优化策略：
 * - 使用FNV-1a哈希算法，性能和冲突率都更好
 * - 分层哈希，避免不必要的序列化
 * - 快速路径处理常见情况
 * - 哈希结果缓存，避免重复计算
 * - 二进制哈希，直接处理对象结构
 */

import { RequestConfig } from '../interface'

/**
 * @description 缓存键配置
 */
export interface CacheKeyConfig {
  includeHeaders?: boolean        // 是否包含请求头
  headersWhitelist?: string[]    // 请求头白名单
  maxKeyLength?: number          // 最大键长度
  enableHashCache?: boolean      // 是否启用哈希缓存
  hashAlgorithm?: 'fnv1a' | 'xxhash' | 'simple'  // 哈希算法选择
}

/**
 * @description 哈希上下文
 */
interface HashContext {
  seed: number
  cache: Map<string, string>
}

/**
 * @description 高性能缓存键生成器
 */
export class CacheKeyGenerator {
  private context: HashContext
  private config: Required<CacheKeyConfig>

  // 预计算的素数和常量，用于FNV-1a算法
  private static readonly FNV_PRIME = 0x01000193
  private static readonly FNV_OFFSET_BASIS = 0x811c9dc5

  // 字符串缓存，避免重复创建
  private static readonly EMPTY_STRING = ''
  private static readonly NULL_STRING = 'null'
  private static readonly UNDEFINED_STRING = 'undefined'
  
  // 分隔符常量
  private static readonly SEPARATOR = '|'
  private static readonly PARAM_SEPARATOR = '&'
  private static readonly KV_SEPARATOR = '='

  constructor(config?: CacheKeyConfig) {
    this.config = {
      includeHeaders: false,
      headersWhitelist: ['content-type', 'authorization'],
      maxKeyLength: 512,
      enableHashCache: true,
      hashAlgorithm: 'fnv1a',
      ...config
    }

    this.context = {
      seed: 0x9e3779b1, // 固定种子（黄金分割比例），确保幂等键一致性
      cache: new Map()
    }
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(config: RequestConfig, customKey?: string): string {
    // 使用自定义键
    if (customKey !== undefined) {
      return this.validateAndNormalizeKey(customKey)
    }

    // 构建键组件
    const components = this.buildKeyComponents(config)

    // 生成最终键
    const key = this.combineComponents(components)

    // 长度检查和哈希缩短
    const finalKey = key.length > this.config.maxKeyLength ? this.hashLongKey(key, config) : key

    return finalKey
  }

  /**
   * 构建键组件
   */
  private buildKeyComponents(config: RequestConfig): {
    method: string
    url: string
    params: string
    data: string
    headers: string
  } {
    const { method, url, params, data, headers } = config

    return {
      method: method.toUpperCase(),
      url: this.normalizeUrl(url),
      params: this.hashParams(params),
      data: this.hashData(data),
      headers: this.config.includeHeaders ? this.hashHeaders(headers) : CacheKeyGenerator.EMPTY_STRING
    }
  }

  /**
   * 组合组件生成键
   */
  private combineComponents(components: {
    method: string
    url: string
    params: string
    data: string
    headers: string
  }): string {
    const parts = [
      components.method,
      components.url,
      components.params,
      components.data
    ]

    if (components.headers) {
      parts.push(components.headers)
    }

    return parts.join(CacheKeyGenerator.SEPARATOR)
  }

  /**
   * URL标准化
   */
  private normalizeUrl(url: string): string {
    if (!url || typeof url !== 'string') {
      throw new Error('Invalid URL for cache key generation')
    }

    // 移除查询参数（params会单独处理）
    const questionMarkIndex = url.indexOf('?')
    const cleanUrl = questionMarkIndex >= 0 ? url.substring(0, questionMarkIndex) : url
    
    // 移除尾部斜杠
    return cleanUrl.endsWith('/') ? cleanUrl.slice(0, -1) : cleanUrl
  }

  /**
   * 高效参数哈希
   */
  private hashParams(params: unknown): string {
    if (!params || typeof params !== 'object') {
      return CacheKeyGenerator.EMPTY_STRING
    }

    const paramObj = params as Record<string, unknown>
    const keys = Object.keys(paramObj).sort() // 排序保证一致性

    if (keys.length === 0) {
      return CacheKeyGenerator.EMPTY_STRING
    }

    // 快速路径：简单参数直接序列化
    if (keys.length <= 5 && this.isSimpleObject(paramObj)) {
      const paramStr = keys
        .map(key => `${key}${CacheKeyGenerator.KV_SEPARATOR}${paramObj[key]}`)
        .join(CacheKeyGenerator.PARAM_SEPARATOR)
      
      return this.quickHash(paramStr)
    }

    // 复杂参数使用结构化哈希
    return this.hashObjectStructure(paramObj, 'params')
  }

  /**
   * 深度克隆对象
   */
  private deepClone(obj: any): any {
    if (obj === null || typeof obj !== 'object') {
      return obj
    }
    
    if (obj instanceof Date) {
      return new Date(obj.getTime())
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.deepClone(item))
    }
    
    const cloned: any = {}
    for (const key in obj) {
      if (Object.prototype.hasOwnProperty.call(obj, key)) {
        cloned[key] = this.deepClone(obj[key])
      }
    }
    return cloned
  }

  /**
   * 高效数据哈希
   */
  private hashData(data: unknown): string {
    if (data === null || data === undefined) {
      return CacheKeyGenerator.EMPTY_STRING
    }

    const dataType = typeof data
    
    // 基础类型快速路径
    switch (dataType) {
      case 'string':
        return this.quickHash(`str:${data}`)
      case 'number':
        return this.quickHash(`num:${data}`)
      case 'boolean':
        return this.quickHash(`bool:${data}`)
    }

    // 特殊对象类型
    if (data instanceof FormData) {
      return this.hashFormData(data)
    }
    
    if (data instanceof URLSearchParams) {
      return this.quickHash(`urlparams:${data.toString()}`)
    }

    if (data instanceof Blob) {
      return this.quickHash(`blob:${data.size}:${data.type}`)
    }

    if (ArrayBuffer.isView(data) || data instanceof ArrayBuffer) {
      return this.quickHash(`buffer:${(data as ArrayBuffer).byteLength}`)
    }

    // 对象和数组 - 深度克隆以确保我们处理的是不同的对象
    if (dataType === 'object') {
      const clonedData = this.deepClone(data)
      return this.hashObjectStructure(clonedData, 'data')
    }

    return CacheKeyGenerator.EMPTY_STRING
  }

  /**
   * FormData哈希
   */
  private hashFormData(formData: FormData): string {
    const entries: string[] = []
    
    // 注意：FormData.entries() 在某些环境可能不可用
    try {
      for (const [key, value] of formData.entries()) {
        if (value instanceof File) {
          entries.push(`${key}:file:${value.name}:${value.size}`)
        } else {
          entries.push(`${key}:${value}`)
        }
      }
    } catch {
      // 回退方案：使用FormData的toString或者生成随机标识
      return this.quickHash(`formdata:${Date.now()}:${Math.random()}`)
    }

    entries.sort()
    return this.quickHash(`formdata:${entries.join('&')}`)
  }

  /**
   * 请求头哈希
   */
  private hashHeaders(headers?: Record<string, string>): string {
    if (!headers || typeof headers !== 'object') {
      return CacheKeyGenerator.EMPTY_STRING
    }

    const relevantHeaders: string[] = []
    const whitelist = this.config.headersWhitelist

    for (const key in headers) {
      const lowerKey = key.toLowerCase()
      // 如果没有白名单（includeAllHeaders=true），包含所有头部
      // 如果有白名单，只包含在白名单中的头部
      if (!whitelist || whitelist.includes(lowerKey)) {
        relevantHeaders.push(`${lowerKey}:${headers[key]}`)
      }
    }

    if (relevantHeaders.length === 0) {
      return CacheKeyGenerator.EMPTY_STRING
    }

    relevantHeaders.sort()
    return this.quickHash(relevantHeaders.join('&'))
  }

  /**
   * 对象结构哈希 - 高性能版本
   */
  private hashObjectStructure(obj: unknown, prefix: string): string {
    if (obj === null) return this.quickHash(`${prefix}:null`)
    if (obj === undefined) return this.quickHash(`${prefix}:undefined`)

    const cacheKey = `${prefix}:${this.getObjectSignature(obj)}`
    
    // 检查哈希缓存
    if (this.config.enableHashCache && this.context.cache.has(cacheKey)) {
      return this.context.cache.get(cacheKey)!
    }

    let hash: string

    if (Array.isArray(obj)) {
      hash = this.hashArray(obj, prefix)
    } else if (typeof obj === 'object') {
      hash = this.hashObject(obj as Record<string, unknown>, prefix)
    } else {
      hash = this.quickHash(`${prefix}:${typeof obj}:${String(obj)}`)
    }

    // 缓存结果
    if (this.config.enableHashCache) {
      this.context.cache.set(cacheKey, hash)
      
      // 防止缓存过大
      if (this.context.cache.size > 1000) {
        this.cleanupCache()
      }
    }

    return hash
  }

  /**
   * 数组哈希
   */
  private hashArray(arr: unknown[], prefix: string): string {
    if (arr.length === 0) return this.quickHash(`${prefix}:array:0`)
    
    // 小数组直接处理
    if (arr.length <= 10 && this.isSimpleArray(arr)) {
      const elements = arr.map((item, idx) => `${idx}:${this.getSimpleValue(item)}`).join(',')
      return this.quickHash(`${prefix}:array:${elements}`)
    }

    // 大数组使用采样哈希
    const samples = this.sampleArray(arr)
    const sampleHash = samples.map(s => this.getSimpleValue(s)).join(',')
    return this.quickHash(`${prefix}:array:${arr.length}:${sampleHash}`)
  }

  /**
   * 对象哈希
   */
  private hashObject(obj: Record<string, unknown>, prefix: string): string {
    const keys = Object.keys(obj).sort()
    
    if (keys.length === 0) return this.quickHash(`${prefix}:object:0`)
    
    // 小对象直接处理
    if (keys.length <= 10 && this.isSimpleObject(obj)) {
      const pairs = keys.map(key => `${key}:${this.getSimpleValue(obj[key])}`).join(',')
      return this.quickHash(`${prefix}:object:${pairs}`)
    }

    // 大对象使用键结构和采样值
    const keyStructure = keys.join(',')
    const sampleValues = keys.slice(0, 5).map(key => this.getSimpleValue(obj[key])).join(',')
    return this.quickHash(`${prefix}:object:${keys.length}:${keyStructure}:${sampleValues}`)
  }

  /**
   * 检查是否为简单对象
   */
  private isSimpleObject(obj: Record<string, unknown>): boolean {
    return Object.values(obj).every(value => {
      const type = typeof value
      return type === 'string' || type === 'number' || type === 'boolean' || 
             value === null || value === undefined
    })
  }

  /**
   * 检查是否为简单数组
   */
  private isSimpleArray(arr: unknown[]): boolean {
    return arr.every(item => {
      const type = typeof item
      return type === 'string' || type === 'number' || type === 'boolean' || 
             item === null || item === undefined
    })
  }

  /**
   * 获取简单值的字符串表示
   */
  private getSimpleValue(value: unknown): string {
    if (value === null) return CacheKeyGenerator.NULL_STRING
    if (value === undefined) return CacheKeyGenerator.UNDEFINED_STRING
    if (typeof value === 'string') return value
    if (typeof value === 'object') {
      // 对于复杂对象，使用递归签名而不是 String(value)
      return this.getObjectSignature(value)
    }
    return String(value)
  }

  /**
   * 数组采样
   */
  private sampleArray(arr: unknown[]): unknown[] {
    if (arr.length <= 20) return arr

    const samples: unknown[] = []
    const step = Math.ceil(arr.length / 10)
    
    for (let i = 0; i < arr.length; i += step) {
      samples.push(arr[i])
    }

    return samples
  }

  /**
   * 获取对象签名（用于缓存键）
   */
  private getObjectSignature(obj: unknown): string {
    if (obj === null || obj === undefined) return String(obj)
    
    if (Array.isArray(obj)) {
      // 对于数组，包含所有元素的特征信息
      const elementSignatures = obj.map((item, index) => {
        if (item === null) return `${index}:null`
        if (item === undefined) return `${index}:undefined`
        if (typeof item === 'object') {
          // 对于嵌套对象，递归获取签名
          return `${index}:${this.getObjectSignature(item)}`
        }
        return `${index}:${typeof item}:${String(item).substring(0, 30)}`
      })
      return `arr:${obj.length}:[${elementSignatures.join(',')}]`
    }
    
    if (typeof obj === 'object') {
      const keys = Object.keys(obj as object).sort() // 排序确保一致性
      if (keys.length === 0) return 'obj:0:{}'
      
      // 对于对象，包含所有键值对的特征信息
      const valueSignature = keys.map(key => {
        const value = (obj as any)[key]
        if (value === null) return `${key}:null`
        if (value === undefined) return `${key}:undefined`
        if (typeof value === 'object') {
          // 对于嵌套对象，递归获取签名
          return `${key}:${this.getObjectSignature(value)}`
        }
        return `${key}:${typeof value}:${String(value).substring(0, 30)}`
      }).join('|')
      return `obj:${keys.length}:{${valueSignature}}`
    }
    
    return `${typeof obj}:${String(obj).substring(0, 30)}`
  }

  /**
   * 快速哈希 - 使用FNV-1a算法
   */
  private quickHash(str: string): string {
    if (!str) return '0'

    switch (this.config.hashAlgorithm) {
      case 'fnv1a':
        return this.fnv1aHash(str)
      case 'xxhash':
        return this.xxHash(str)
      case 'simple':
      default:
        return this.simpleHash(str)
    }
  }

  /**
   * FNV-1a哈希算法 - 性能好，冲突率低
   */
  private fnv1aHash(str: string): string {
    let hash = CacheKeyGenerator.FNV_OFFSET_BASIS ^ this.context.seed

    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i)
      hash = Math.imul(hash, CacheKeyGenerator.FNV_PRIME)
    }

    return (hash >>> 0).toString(36)
  }

  /**
   * xxHash简化版本
   */
  private xxHash(str: string): string {
    const seed = this.context.seed
    let hash = seed + 374761393

    for (let i = 0; i < str.length; i++) {
      hash += str.charCodeAt(i) * 3266489917
      hash = Math.imul(hash, 668265263)
      hash ^= hash >>> 15
    }

    return (hash >>> 0).toString(36)
  }

  /**
   * 简单哈希算法（回退方案）
   */
  private simpleHash(str: string): string {
    let hash = 0
    for (let i = 0; i < str.length; i++) {
      const char = str.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash // 转为32位整数
    }
    return Math.abs(hash).toString(36)
  }

  /**
   * 处理过长的键
   */
  private hashLongKey(key: string, config: RequestConfig): string {
    const hash = this.quickHash(key)
    const method = config.method
    const maxKeyLength = this.config.maxKeyLength
    
    // 计算可用于URL的字符数：总长度 - 方法长度 - 分隔符长度 - 哈希长度 - 安全余量
    const methodLength = method.length
    const separators = 2 // 两个":"分隔符
    const hashLength = hash.length
    const safety = 2 // 安全余量
    const availableForUrl = Math.max(0, maxKeyLength - methodLength - separators - hashLength - safety)
    
    const shortUrl = availableForUrl > 0 ? config.url.substring(0, availableForUrl) : ''
    const result = shortUrl ? `${method}:${shortUrl}:${hash}` : `${method}:${hash}`
    
    // 如果结果仍然太长，进一步截断
    if (result.length > maxKeyLength) {
      return hash.substring(0, maxKeyLength)
    }
    
    return result
  }

  /**
   * 验证和标准化自定义键
   */
  private validateAndNormalizeKey(key: string): string {
    // 检查null、undefined等无效值
    if (key === null || key === undefined) {
      throw new Error('Custom cache key must be a non-empty string')
    }
    
    // 检查非字符串类型
    if (typeof key !== 'string') {
      throw new Error('Custom cache key must be a non-empty string')
    }
    
    // 检查空字符串
    if (key.length === 0) {
      throw new Error('Custom cache key must be a non-empty string')
    }
    
    // 检查过长键
    if (key.length > this.config.maxKeyLength) {
      return this.quickHash(key)
    }
    
    // 移除不安全字符
    return key.replace(/[\x00-\x1f\x7f-\x9f]/g, '_')
  }

  /**
   * 清理缓存
   */
  private cleanupCache(): void {
    const cache = this.context.cache
    const entries = Array.from(cache.entries())

    // 保留最近使用的一半
    cache.clear()
    const keepCount = Math.floor(entries.length / 2)

    for (let i = entries.length - keepCount; i < entries.length; i++) {
      cache.set(entries[i][0], entries[i][1])
    }
  }

  /**
   * 清空内部缓存
   */
  clearCache(): void {
    this.context.cache.clear()
  }

  /**
   * 预热缓存（用于性能测试）
   */
  warmupCache(configs: RequestConfig[]): void {
    for (const config of configs) {
      this.generateCacheKey(config)
    }
  }

  /**
   * 设置配置
   */
  updateConfig(config: Partial<CacheKeyConfig>): void {
    this.config = { ...this.config, ...config }
  }
}
