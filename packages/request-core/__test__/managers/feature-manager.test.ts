import { describe, it, expect, beforeEach, vi } from 'vitest'
import { FeatureManager } from '../../src/managers/feature-manager'
import { RequestConfig, RequestError } from '../../src/interface'
import { createMockRequestor } from '../test-helpers'

describe('FeatureManager', () => {
  let mockRequestor: ReturnType<typeof createMockRequestor>
  let manager: FeatureManager

  beforeEach(() => {
    mockRequestor = createMockRequestor()
    manager = new FeatureManager(mockRequestor)
  })

  describe('构造函数', () => {
    it('should create manager with all features', () => {
      expect(manager).toBeDefined()
      expect(manager).toBeInstanceOf(FeatureManager)
    })
  })

  describe('重试功能', () => {
    it('should execute request with retry', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await manager.requestWithRetry(config)

      expect(result).toEqual({ data: 'test' })
    })

    it('should execute GET with retry', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const result = await manager.getWithRetry('https://api.example.com/users')

      expect(mockRequestor.getMock()).toHaveBeenCalled()
      expect(result).toEqual({ data: 'test' })
    })

    it('should execute POST with retry', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const data = { name: 'John' }
      const result = await manager.postWithRetry('https://api.example.com/users', data)

      expect(result).toEqual({ success: true })
    })

    it('should use custom retry config', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      await manager.getWithRetry('https://api.example.com/users', { retries: 5 })

      expect(mockRequestor.getMock()).toHaveBeenCalled()
    })
  })

  describe('缓存功能', () => {
    it('should execute request with cache', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await manager.requestWithCache(config)

      expect(result).toEqual({ data: 'test' })
    })

    it('should execute GET with cache', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const result = await manager.getWithCache('https://api.example.com/users')

      expect(result).toEqual({ data: 'test' })
    })

    it('should clear cache', () => {
      expect(() => {
        manager.clearCache()
      }).not.toThrow()
    })

    it('should clear cache with specific key', () => {
      expect(() => {
        manager.clearCache('specific-key')
      }).not.toThrow()
    })

    it('should get cache stats', async () => {
      const stats = await manager.getCacheStats()

      expect(stats).toBeDefined()
      expect(typeof stats.size).toBe('number')
    })
  })

  describe('并发功能', () => {
    it('should execute concurrent requests', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })
        .mockResolvedValueOnce({ id: 3 })

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' },
        { url: 'https://api.example.com/users/3', method: 'GET' }
      ]

      const results = await manager.requestConcurrent(configs)

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[0].data).toEqual({ id: 1 })
    })

    it('should execute multiple same requests', async () => {
      mockRequestor.getMock()
        .mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const results = await manager.requestMultiple(config, 3)

      expect(results).toHaveLength(3)
      expect(mockRequestor.getMock()).toHaveBeenCalledTimes(3)
    })

    it('should execute concurrent GET requests', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })

      const urls = [
        'https://api.example.com/users/1',
        'https://api.example.com/users/2'
      ]

      const results = await manager.getConcurrent(urls)

      expect(results).toHaveLength(2)
    })

    it('should execute concurrent POST requests', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ success: true })

      const requests = [
        { url: 'https://api.example.com/users', data: { name: 'John' } },
        { url: 'https://api.example.com/users', data: { name: 'Jane' } }
      ]

      const results = await manager.postConcurrent(requests)

      expect(results).toHaveLength(2)
    })

    it('should execute batch requests and return successful results', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' }
      ]

      const results = await manager.batchRequests(configs)

      expect(results).toHaveLength(2)
      expect(results[0]).toEqual({ id: 1 })
      expect(results[1]).toEqual({ id: 2 })
    })

    it('should get successful results from concurrent results', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('Failed'))

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' }
      ]

      const results = await manager.requestConcurrent(configs, { failFast: false })
      const successful = manager.getSuccessfulResults(results)

      expect(successful).toHaveLength(1)
      expect(successful[0]).toEqual({ id: 1 })
    })

    it('should get failed results from concurrent results', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('Failed'))

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' }
      ]

      const results = await manager.requestConcurrent(configs, { failFast: false })
      const failed = manager.getFailedResults(results)

      expect(failed).toHaveLength(1)
      expect(failed[0].success).toBe(false)
    })

    it('should check if has concurrent failures', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('Failed'))

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' }
      ]

      const results = await manager.requestConcurrent(configs, { failFast: false })
      const hasFailures = manager.hasConcurrentFailures(results)

      expect(hasFailures).toBe(true)
    })

    it('should get concurrent stats', () => {
      const stats = manager.getConcurrentStats()

      expect(stats).toBeDefined()
    })

    it('should get results stats', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' }
      ]

      const results = await manager.requestConcurrent(configs)
      const stats = manager.getResultsStats(results)

      expect(stats).toBeDefined()
      expect(stats.total).toBe(2)
    })
  })

  describe('幂等功能', () => {
    it('should execute idempotent request', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST'
      }

      const result = await manager.requestIdempotent(config)

      expect(result).toEqual({ data: 'test' })
    })

    it('should execute idempotent GET', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const result = await manager.getIdempotent('https://api.example.com/users')

      expect(result).toEqual({ data: 'test' })
    })

    it('should execute idempotent POST', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const result = await manager.postIdempotent('https://api.example.com/users', { name: 'John' })

      expect(result).toEqual({ success: true })
    })

    it('should execute idempotent PUT', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const result = await manager.putIdempotent('https://api.example.com/users/1', { name: 'John' })

      expect(result).toEqual({ success: true })
    })

    it('should execute idempotent PATCH', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const result = await manager.patchIdempotent('https://api.example.com/users/1', { status: 'active' })

      expect(result).toEqual({ success: true })
    })

    it('should execute idempotent DELETE', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const result = await manager.deleteIdempotent('https://api.example.com/users/1')

      expect(result).toEqual({ success: true })
    })

    it('should clear idempotent cache', async () => {
      await expect(manager.clearIdempotentCache()).resolves.toBeUndefined()
    })

    it('should get idempotent stats', () => {
      const stats = manager.getIdempotentStats()

      expect(stats).toBeDefined()
      expect(typeof stats.totalRequests).toBe('number')
    })
  })

  describe('串行功能', () => {
    it('should execute serial request', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        serialKey: 'test-queue'
      }

      const result = await manager.requestSerial(config)

      expect(result).toEqual({ data: 'test' })
    })

    it('should execute serial GET', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const result = await manager.getSerial('https://api.example.com/users', 'queue-1')

      expect(result).toEqual({ data: 'test' })
    })

    it('should execute serial POST', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const result = await manager.postSerial('https://api.example.com/users', 'queue-1', { name: 'John' })

      expect(result).toEqual({ success: true })
    })

    it('should execute serial PUT', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const result = await manager.putSerial('https://api.example.com/users/1', 'queue-1', { name: 'John' })

      expect(result).toEqual({ success: true })
    })

    it('should execute serial DELETE', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const result = await manager.deleteSerial('https://api.example.com/users/1', 'queue-1')

      expect(result).toEqual({ success: true })
    })

    it('should execute serial PATCH', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const result = await manager.patchSerial('https://api.example.com/users/1', 'queue-1', { status: 'active' })

      expect(result).toEqual({ success: true })
    })

    it('should get serial stats', () => {
      const stats = manager.getSerialStats()

      expect(stats).toBeDefined()
      expect(typeof stats.totalQueues).toBe('number')
    })

    it('should get queue stats', () => {
      const stats = manager.getSerialQueueStats('queue-1')

      expect(stats).toBeDefined()
    })

    it('should clear serial queue', () => {
      const result = manager.clearSerialQueue('queue-1')

      expect(typeof result).toBe('boolean')
    })

    it('should clear all serial queues', () => {
      expect(() => {
        manager.clearAllSerialQueues()
      }).not.toThrow()
    })

    it('should get serial feature instance', () => {
      const feature = manager.getSerialFeature()

      expect(feature).toBeDefined()
    })
  })

  describe('组合功能', () => {
    it('should execute request with cache and retry', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await manager.requestWithCacheAndRetry(config, {
        cacheConfig: { ttl: 5000 },
        retryConfig: { retries: 3 }
      })

      expect(result).toEqual({ data: 'test' })
    })

    it('should fall back to retry if cache fails', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      mockRequestor.getMock()
        .mockRejectedValueOnce(new Error('Cache failed'))
        .mockResolvedValueOnce({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await manager.requestWithCacheAndRetry(config, {
        cacheConfig: { ttl: 5000 },
        retryConfig: { retries: 3 }
      })

      expect(result).toEqual({ data: 'test' })
      warnSpy.mockRestore()
    })

    it('should execute concurrent requests with cache', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ id: 2 })

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' }
      ]

      const results = await manager.concurrentWithCache(configs, {
        cacheConfig: { ttl: 5000 }
      })

      expect(results).toHaveLength(2)
    })
  })

  describe('管理方法', () => {
    it('should get all stats', async () => {
      const stats = await manager.getAllStats()

      expect(stats).toBeDefined()
      expect(stats.cache).toBeDefined()
      expect(stats.concurrent).toBeDefined()
      expect(stats.idempotent).toBeDefined()
      expect(stats.serial).toBeDefined()
    })

    it('should reset all features', () => {
      expect(() => {
        manager.resetAll()
      }).not.toThrow()
    })

    it('should destroy all features', async () => {
      await expect(manager.destroy()).resolves.toBeUndefined()
    })

    it('should get feature status', async () => {
      const status = await manager.getFeatureStatus()

      expect(status).toBeDefined()
      expect(status.hasRetry).toBe(true)
      expect(status.hasCache).toBe(true)
      expect(status.hasConcurrent).toBe(true)
      expect(status.hasIdempotent).toBe(true)
      expect(status.hasSerial).toBe(true)
      expect(typeof status.cacheSize).toBe('number')
      expect(typeof status.serialQueues).toBe('number')
    })
  })

  describe('边界情况', () => {
    it('should handle empty concurrent configs array', async () => {
      const results = await manager.requestConcurrent([])

      expect(results).toEqual([])
    })

    it('should handle request with no retry config', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await manager.requestWithRetry(config)

      expect(result).toEqual({ data: 'test' })
    })

    it('should handle request with no cache config', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await manager.requestWithCache(config)

      expect(result).toEqual({ data: 'test' })
    })

    it('should handle serial request without queue config', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        serialKey: 'test-queue'
      }

      const result = await manager.requestSerial(config)

      expect(result).toEqual({ data: 'test' })
    })

    it('should handle idempotent request without config', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'POST'
      }

      const result = await manager.requestIdempotent(config)

      expect(result).toEqual({ data: 'test' })
    })

    it('should handle concurrent POST with empty config', async () => {
      mockRequestor.getMock().mockResolvedValue({ success: true })

      const requests = [
        { url: 'https://api.example.com/users', data: { name: 'John' }, config: {} }
      ]

      const results = await manager.postConcurrent(requests)

      expect(results).toHaveLength(1)
    })

    it('should handle batch requests with ignoreErrors option', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('Failed'))

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' }
      ]

      const results = await manager.batchRequests(configs, { ignoreErrors: true })

      // 只返回成功的结果
      expect(results).toHaveLength(1)
      expect(results[0]).toEqual({ id: 1 })
    })

    it('should handle batch requests with custom concurrency', async () => {
      mockRequestor.getMock()
        .mockResolvedValue({ data: 'test' })

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' },
        { url: 'https://api.example.com/users/3', method: 'GET' }
      ]

      const results = await manager.batchRequests(configs, { concurrency: 2 })

      expect(results).toHaveLength(3)
    })

    it('should handle concurrent with cache without cache config', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' }
      ]

      const results = await manager.concurrentWithCache(configs)

      expect(results).toHaveLength(1)
    })

    it('should handle cache and retry without options', async () => {
      mockRequestor.getMock().mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const result = await manager.requestWithCacheAndRetry(config)

      expect(result).toEqual({ data: 'test' })
    })

    it('should handle clearIdempotentCache with key', async () => {
      await expect(manager.clearIdempotentCache('specific-key')).resolves.toBeUndefined()
    })

    it('should handle getSerialQueueStats for non-existent queue', () => {
      const stats = manager.getSerialQueueStats('non-existent-queue')

      expect(stats).toBeDefined()
    })

    it('should handle clearSerialQueue for non-existent queue', () => {
      const result = manager.clearSerialQueue('non-existent-queue')

      expect(typeof result).toBe('boolean')
    })
  })

  describe('复杂场景', () => {
    it('should handle multiple feature operations in sequence', async () => {
      mockRequestor.getMock()
        .mockResolvedValue({ data: 'test' })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      // 串行执行多种功能
      await manager.requestWithRetry(config)
      await manager.requestWithCache(config)
      await manager.requestIdempotent(config)

      expect(mockRequestor.getMock()).toHaveBeenCalledTimes(3)
    })

    it('should handle concurrent requests with different methods', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockResolvedValueOnce({ success: true })
        .mockResolvedValueOnce({ deleted: true })

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users', method: 'POST', data: { name: 'John' } },
        { url: 'https://api.example.com/users/1', method: 'DELETE' }
      ]

      const results = await manager.requestConcurrent(configs)

      expect(results).toHaveLength(3)
      expect(results.every(r => r.success)).toBe(true)
    })

    it('should handle mixed success and failure in concurrent requests', async () => {
      mockRequestor.getMock()
        .mockResolvedValueOnce({ id: 1 })
        .mockRejectedValueOnce(new Error('Failed'))
        .mockResolvedValueOnce({ id: 3 })

      const configs: RequestConfig[] = [
        { url: 'https://api.example.com/users/1', method: 'GET' },
        { url: 'https://api.example.com/users/2', method: 'GET' },
        { url: 'https://api.example.com/users/3', method: 'GET' }
      ]

      const results = await manager.requestConcurrent(configs, { failFast: false })

      expect(results).toHaveLength(3)
      expect(results[0].success).toBe(true)
      expect(results[1].success).toBe(false)
      expect(results[2].success).toBe(true)
    })
  })
})
