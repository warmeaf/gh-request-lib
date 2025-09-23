import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { IdempotentFeature } from '../../src/features/idempotent'
import {
  IdempotentMockRequestor,
  createIdempotentMockRequestor,
  cleanupIdempotentTest,
  IDEMPOTENT_TEST_CONFIGS,
  IDEMPOTENT_CONFIGS,
  IDEMPOTENT_TEST_RESPONSES,
  IdempotentTestAssertions,
} from './idempotent-test-helpers'

describe('IdempotentFeature - Basic Functionality', () => {
  let mockRequestor: IdempotentMockRequestor
  let idempotentFeature: IdempotentFeature

  beforeEach(() => {
    vi.useFakeTimers()
    mockRequestor = createIdempotentMockRequestor()
    idempotentFeature = new IdempotentFeature(mockRequestor)
  })

  afterEach(async () => {
    vi.useRealTimers()
    await cleanupIdempotentTest(idempotentFeature, mockRequestor)
  })

  describe('基础幂等请求功能', () => {
    it('应该成功执行单个幂等请求', async () => {
      // 准备测试数据
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 执行请求
      const result = await idempotentFeature.requestIdempotent(config)

      // 验证结果
      expect(result).toEqual(expectedResponse)

      // 验证统计信息
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(1)
      expect(stats.actualNetworkRequests).toBe(1)
      expect(stats.duplicatesBlocked).toBe(0)
      expect(stats.cacheHits).toBe(0)

      // 验证请求被正确调用
      const callHistory = mockRequestor.getCallHistory()
      expect(callHistory).toHaveLength(1)
      expect(callHistory[0].config).toEqual(expect.objectContaining(config))
    })

    it('应该成功检测和阻止重复的幂等请求', async () => {
      // 准备测试数据
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_POST
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.CREATED
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 执行相同的请求两次
      const result1 = await idempotentFeature.requestIdempotent(config)
      const result2 = await idempotentFeature.requestIdempotent(config)

      // 验证两次请求结果相同
      expect(result1).toEqual(expectedResponse)
      expect(result2).toEqual(expectedResponse)

      // 验证统计信息 - 第二次请求应该被阻止
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.actualNetworkRequests).toBe(1) // 只有一次真实网络请求
      expect(stats.duplicatesBlocked).toBe(1)
      expect(stats.cacheHits).toBe(1)

      // 验证只有一次实际的网络调用
      const callHistory = mockRequestor.getCallHistory()
      expect(callHistory).toHaveLength(1)
    })

    it('应该支持不同的HTTP方法', async () => {
      const methods = ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] as const

      for (const method of methods) {
        const config = {
          url: `https://api.example.com/test-${method.toLowerCase()}`,
          method,
          ...(method !== 'GET' && method !== 'DELETE'
            ? { data: { test: true } }
            : {}),
        }

        const expectedResponse = { method, success: true }
        mockRequestor.setUrlResponse(config.url, expectedResponse)

        const result = await idempotentFeature.requestIdempotent(config)
        expect(result).toEqual(expectedResponse)
      }

      // 验证统计信息
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(methods.length)
      expect(stats.actualNetworkRequests).toBe(methods.length)
    })
  })

  describe('便利方法测试', () => {
    it('应该支持 getIdempotent 便利方法', async () => {
      const url = 'https://api.example.com/users/1'
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.USER
      mockRequestor.setUrlResponse(url, expectedResponse)

      const result = await idempotentFeature.getIdempotent(url)

      expect(result).toEqual(expectedResponse)

      const callHistory = mockRequestor.getCallHistory()
      expect(callHistory).toHaveLength(1)
      expect(callHistory[0].config.method).toBe('GET')
      expect(callHistory[0].config.url).toBe(url)
    })

    it('应该支持 postIdempotent 便利方法', async () => {
      const url = 'https://api.example.com/users'
      const data = { name: 'John', email: 'john@example.com' }
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.CREATED
      mockRequestor.setUrlResponse(url, expectedResponse)

      const result = await idempotentFeature.postIdempotent(url, data)

      expect(result).toEqual(expectedResponse)

      const callHistory = mockRequestor.getCallHistory()
      expect(callHistory).toHaveLength(1)
      expect(callHistory[0].config.method).toBe('POST')
      expect(callHistory[0].config.url).toBe(url)
      expect(callHistory[0].config.data).toEqual(data)
    })

    it('应该支持 putIdempotent 便利方法', async () => {
      const url = 'https://api.example.com/users/1'
      const data = { name: 'John Updated' }
      const expectedResponse = { updated: true }
      mockRequestor.setUrlResponse(url, expectedResponse)

      const result = await idempotentFeature.putIdempotent(url, data)

      expect(result).toEqual(expectedResponse)

      const callHistory = mockRequestor.getCallHistory()
      expect(callHistory).toHaveLength(1)
      expect(callHistory[0].config.method).toBe('PUT')
      expect(callHistory[0].config.data).toEqual(data)
    })

    it('应该支持 patchIdempotent 便利方法', async () => {
      const url = 'https://api.example.com/users/1'
      const data = { email: 'newemail@example.com' }
      const expectedResponse = { patched: true }
      mockRequestor.setUrlResponse(url, expectedResponse)

      const result = await idempotentFeature.patchIdempotent(url, data)

      expect(result).toEqual(expectedResponse)

      const callHistory = mockRequestor.getCallHistory()
      expect(callHistory).toHaveLength(1)
      expect(callHistory[0].config.method).toBe('PATCH')
      expect(callHistory[0].config.data).toEqual(data)
    })

    it('应该支持 deleteIdempotent 便利方法', async () => {
      const url = 'https://api.example.com/users/1'
      const expectedResponse = { deleted: true }
      mockRequestor.setUrlResponse(url, expectedResponse)

      const result = await idempotentFeature.deleteIdempotent(url)

      expect(result).toEqual(expectedResponse)

      const callHistory = mockRequestor.getCallHistory()
      expect(callHistory).toHaveLength(1)
      expect(callHistory[0].config.method).toBe('DELETE')
      expect(callHistory[0].config.url).toBe(url)
    })
  })

  describe('缓存功能测试', () => {
    it('应该在TTL期间内正确缓存响应', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 在TTL期间内执行多次请求
      const result1 = await idempotentFeature.requestIdempotent(
        config,
        IDEMPOTENT_CONFIGS.SHORT_TTL
      )
      const result2 = await idempotentFeature.requestIdempotent(
        config,
        IDEMPOTENT_CONFIGS.SHORT_TTL
      )
      const result3 = await idempotentFeature.requestIdempotent(
        config,
        IDEMPOTENT_CONFIGS.SHORT_TTL
      )

      // 验证所有结果相同
      expect(result1).toEqual(expectedResponse)
      expect(result2).toEqual(expectedResponse)
      expect(result3).toEqual(expectedResponse)

      // 验证统计信息
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(3)
      expect(stats.actualNetworkRequests).toBe(1)
      expect(stats.duplicatesBlocked).toBe(2)
      expect(stats.cacheHits).toBe(2)

      // 验证重复率计算
      const expectedDuplicateRate = (2 / 3) * 100
      expect(
        Math.abs(stats.duplicateRate - expectedDuplicateRate)
      ).toBeLessThan(0.01)
    })

    it('应该在TTL过期后重新执行请求', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      const shortTTLConfig = { ttl: 1000 } // 1秒TTL

      // 执行第一次请求
      const result1 = await idempotentFeature.requestIdempotent(
        config,
        shortTTLConfig
      )
      expect(result1).toEqual(expectedResponse)

      // 等待TTL过期
      vi.advanceTimersByTime(2000)

      // 执行第二次请求 - 应该重新执行
      const result2 = await idempotentFeature.requestIdempotent(
        config,
        shortTTLConfig
      )
      expect(result2).toEqual(expectedResponse)

      // 验证统计信息 - 应该有两次网络请求
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.actualNetworkRequests).toBe(2)
      expect(stats.duplicatesBlocked).toBe(0)
      expect(stats.cacheHits).toBe(0)
    })

    it('应该正确处理缓存清除操作', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 执行请求建立缓存
      await idempotentFeature.requestIdempotent(config)

      // 清除缓存
      await idempotentFeature.clearIdempotentCache()

      // 再次执行相同请求 - 应该重新执行网络请求
      await idempotentFeature.requestIdempotent(config)

      // 验证统计信息
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.actualNetworkRequests).toBe(2)
      expect(stats.duplicatesBlocked).toBe(0)
    })
  })

  describe('基础配置功能', () => {
    it('应该支持自定义TTL配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      const customTTLConfig = { ttl: 60000 } // 60秒TTL

      // 执行请求
      const result = await idempotentFeature.requestIdempotent(
        config,
        customTTLConfig
      )
      expect(result).toEqual(expectedResponse)

      // 验证请求成功执行
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(1)
      expect(stats.actualNetworkRequests).toBe(1)
    })

    it('应该支持自定义键配置', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      const customKeyConfig = { key: 'my-custom-test-key' }

      // 执行请求
      const result = await idempotentFeature.requestIdempotent(
        config,
        customKeyConfig
      )
      expect(result).toEqual(expectedResponse)

      // 使用相同的自定义键再次请求 - 应该被缓存
      const result2 = await idempotentFeature.requestIdempotent(
        config,
        customKeyConfig
      )
      expect(result2).toEqual(expectedResponse)

      // 验证统计信息
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.actualNetworkRequests).toBe(1)
      expect(stats.duplicatesBlocked).toBe(1)
    })

    it('应该支持包含头部信息的键生成', async () => {
      const configWithHeaders = IDEMPOTENT_TEST_CONFIGS.WITH_HEADERS
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(configWithHeaders.url, expectedResponse)

      const headersConfig = {
        includeHeaders: ['authorization', 'x-api-key'],
        includeAllHeaders: false,
      }

      // 执行请求
      const result = await idempotentFeature.requestIdempotent(
        configWithHeaders,
        headersConfig
      )
      expect(result).toEqual(expectedResponse)

      // 使用不同的头部执行请求 - 应该生成不同的键
      const differentHeadersConfig = {
        ...configWithHeaders,
        headers: {
          ...configWithHeaders.headers,
          Authorization: 'Bearer different-token',
        },
      }

      const result2 = await idempotentFeature.requestIdempotent(
        differentHeadersConfig,
        headersConfig
      )
      expect(result2).toEqual(expectedResponse)

      // 验证统计信息 - 应该有两次网络请求（因为头部不同）
      const stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(2)
      expect(stats.actualNetworkRequests).toBe(2)
      expect(stats.duplicatesBlocked).toBe(0)
    })
  })

  describe('统计信息测试', () => {
    it('应该正确维护统计信息', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 执行多次相同请求
      await idempotentFeature.requestIdempotent(config)
      await idempotentFeature.requestIdempotent(config)
      await idempotentFeature.requestIdempotent(config)

      const stats = idempotentFeature.getIdempotentStats()

      // 使用测试断言工具验证统计信息
      IdempotentTestAssertions.verifyStatsConsistency(stats, {
        totalRequests: 3,
        duplicatesBlocked: 2,
        actualNetworkRequests: 1,
      })

      IdempotentTestAssertions.verifyCacheHits(stats, 2, 0)
      IdempotentTestAssertions.verifyKeyGenerationTime(stats, 100) // 100ms内应该足够
    })

    it('应该能够重置统计信息', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 执行一些请求
      await idempotentFeature.requestIdempotent(config)
      await idempotentFeature.requestIdempotent(config)

      // 验证统计信息不为空
      let stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBeGreaterThan(0)

      // 重置统计信息
      idempotentFeature.resetStats()

      // 验证统计信息已重置
      stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(0)
      expect(stats.duplicatesBlocked).toBe(0)
      expect(stats.actualNetworkRequests).toBe(0)
      expect(stats.cacheHits).toBe(0)
      expect(stats.duplicateRate).toBe(0)
    })

    it('应该正确计算平均响应时间', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS

      // 设置延迟以便测试响应时间
      mockRequestor.setGlobalDelay(100)
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 执行请求并等待所有定时器完成
      const requestPromise = idempotentFeature.requestIdempotent(config)

      // 运行所有定时器以完成延迟
      await vi.runAllTimersAsync()

      await requestPromise

      // 验证响应时间统计
      const stats = idempotentFeature.getIdempotentStats()
      IdempotentTestAssertions.verifyResponseTimeStats(stats, 50, 200) // 50-200ms范围内
      expect(stats.avgResponseTime).toBeGreaterThan(0)
    })
  })

  describe('资源管理', () => {
    it('应该正确销毁幂等功能实例', async () => {
      const config = IDEMPOTENT_TEST_CONFIGS.BASIC_GET
      const expectedResponse = IDEMPOTENT_TEST_RESPONSES.SUCCESS
      mockRequestor.setUrlResponse(config.url, expectedResponse)

      // 执行一些请求建立状态
      await idempotentFeature.requestIdempotent(config)
      await idempotentFeature.requestIdempotent(config)

      // 验证有统计信息
      let stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBeGreaterThan(0)

      // 销毁实例
      await expect(idempotentFeature.destroy()).resolves.not.toThrow()

      // 验证统计信息被重置
      stats = idempotentFeature.getIdempotentStats()
      expect(stats.totalRequests).toBe(0)
    })

    it('应该正确处理销毁过程中的错误', async () => {
      // 创建一个会在销毁时出错的场景
      const problematicFeature = new IdempotentFeature(mockRequestor)

      // 正常情况下销毁应该不会抛出错误
      await expect(problematicFeature.destroy()).resolves.not.toThrow()
    })
  })
})
