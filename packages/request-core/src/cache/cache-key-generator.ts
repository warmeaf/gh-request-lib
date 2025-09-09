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
  stats: {
    cacheHits: number
    cacheMisses: number
    totalGenerations: number
  }
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
      seed: Math.random() * 0x7fffffff | 0,
      cache: new Map(),
      stats: {
        cacheHits: 0,
        cacheMisses: 0,
        totalGenerations: 0
      }
    }
  }

  /**
   * 生成缓存键
   */
  generateCacheKey(config: RequestConfig, customKey?: string): string {
    this.context.stats.totalGenerations++

    // 使用自定义键
    if (customKey !== undefined) {
      return this.validateAndNormalizeKey(customKey)
    }

    // 构建键组件
    const components = this.buildKeyComponents(config)
    
    // 生成最终键
    const key = this.combineComponents(components)
    
    // 长度检查和哈希缩短
    if (key.length > this.config.maxKeyLength) {
      return this.hashLongKey(key, config)
    }

    return key
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

    // 对象和数组
    if (dataType === 'object') {
      return this.hashObjectStructure(data, 'data')
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
      if (whitelist.includes(lowerKey)) {
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
      this.context.stats.cacheHits++
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
      this.context.stats.cacheMisses++
      
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
      return `arr:${obj.length}:${typeof obj[0]}`
    }
    
    if (typeof obj === 'object') {
      const keys = Object.keys(obj as object)
      return `obj:${keys.length}:${keys.slice(0, 3).join(',')}`
    }
    
    return `${typeof obj}:${String(obj).length}`
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
    const shortUrl = config.url.substring(0, 50)
    return `${config.method}:${shortUrl}:${hash}`
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
   * 获取统计信息
   */
  getStats() {
    return {
      ...this.context.stats,
      cacheSize: this.context.cache.size,
      hitRate: this.context.stats.totalGenerations > 0 
        ? (this.context.stats.cacheHits / this.context.stats.totalGenerations * 100).toFixed(2)
        : '0.00'
    }
  }

  /**
   * 重置统计信息
   */
  resetStats(): void {
    this.context.stats = {
      cacheHits: 0,
      cacheMisses: 0,
      totalGenerations: 0
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
