import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { RequestCore } from '../../src/core'
import { RequestConfig } from '../../src/interface'
import {
    SerialRequestInterceptor,
    SerialInterceptedException,
    isSerialInterceptedException
} from '../../src/features/serial/interceptor'
import { SerialRequestManager } from '../../src/features/serial/manager'
import { SerialMockRequestor, cleanupSerialTest } from './serial-test-helpers'

describe('串行请求拦截器功能测试', () => {
    let mockRequestor: SerialMockRequestor
    let requestCore: RequestCore

    beforeEach(() => {
        mockRequestor = new SerialMockRequestor()
        requestCore = new RequestCore(mockRequestor)
    })

    afterEach(async () => {
        await cleanupSerialTest(mockRequestor, requestCore)
    })

    test('应该正确创建和初始化拦截器', () => {
        const interceptor = new SerialRequestInterceptor(mockRequestor, {
            debug: true,
            maxQueues: 5
        }, {
            enabled: true,
            debug: true
        })

        expect(interceptor.isEnabled()).toBe(true)

        interceptor.destroy()
    })

    test('应该正确处理启用和禁用状态', async () => {
        const interceptor = new SerialRequestInterceptor(mockRequestor)

        // 默认应该是启用状态
        expect(interceptor.isEnabled()).toBe(true)

        // 禁用拦截器
        interceptor.disable()
        expect(interceptor.isEnabled()).toBe(false)

        // 禁用状态下，带有serialKey的请求应该直接通过
        const config: RequestConfig = {
            url: '/api/test',
            method: 'GET',
            serialKey: 'test-key'
        }

        const result = await interceptor.onRequest(config)
        expect(result).toBe(config) // 应该返回原配置

        // 重新启用
        interceptor.enable()
        expect(interceptor.isEnabled()).toBe(true)

        interceptor.destroy()
    })

    test('应该正确拦截带有serialKey的请求', async () => {
        const interceptor = new SerialRequestInterceptor(mockRequestor, {}, { debug: true })

        const config: RequestConfig = {
            url: '/api/serial',
            method: 'POST',
            data: { test: true },
            serialKey: 'test-serial'
        }

        let interceptedException: SerialInterceptedException | null = null

        try {
            await interceptor.onRequest(config)
        } catch (error) {
            if (isSerialInterceptedException(error)) {
                interceptedException = error
            }
        }

        // 验证拦截异常
        expect(interceptedException).not.toBeNull()
        expect(interceptedException!.config).toBe(config)
        expect(interceptedException!.isSerialIntercepted).toBe(true)
        expect(interceptedException!.name).toBe('SerialInterceptedException')
        expect(interceptedException!.message).toContain('intercepted for serial processing')

        interceptor.destroy()
    })

    test('应该正确处理不带serialKey的请求', async () => {
        const interceptor = new SerialRequestInterceptor(mockRequestor)

        const config: RequestConfig = {
            url: '/api/normal',
            method: 'GET'
            // 没有 serialKey
        }

        const result = await interceptor.onRequest(config)
        expect(result).toBe(config) // 应该直接返回原配置

        interceptor.destroy()
    })

    test('应该正确提取metadata中的串行配置', async () => {
        const interceptor = new SerialRequestInterceptor(mockRequestor)

        const config: RequestConfig = {
            url: '/api/with-metadata',
            method: 'POST',
            serialKey: 'metadata-test',
            metadata: {
                serialConfig: {
                    maxQueueSize: 10,
                    timeout: 5000,
                    debug: true
                },
                otherData: 'should be ignored'
            }
        }

        let interceptedException: SerialInterceptedException | null = null

        try {
            await interceptor.onRequest(config)
        } catch (error) {
            if (isSerialInterceptedException(error)) {
                interceptedException = error
            }
        }

        expect(interceptedException).not.toBeNull()
        expect(interceptedException!.queueConfig).toBeDefined()
        expect(interceptedException!.queueConfig!.maxQueueSize).toBe(10)
        expect(interceptedException!.queueConfig!.timeout).toBe(5000)
        expect(interceptedException!.queueConfig!.debug).toBe(true)

        interceptor.destroy()
    })

    test('应该正确处理空metadata的情况', async () => {
        const interceptor = new SerialRequestInterceptor(mockRequestor)

        const config: RequestConfig = {
            url: '/api/no-metadata',
            method: 'GET',
            serialKey: 'no-metadata-test'
            // 没有 metadata
        }

        let interceptedException: SerialInterceptedException | null = null

        try {
            await interceptor.onRequest(config)
        } catch (error) {
            if (isSerialInterceptedException(error)) {
                interceptedException = error
            }
        }

        expect(interceptedException).not.toBeNull()
        expect(interceptedException!.queueConfig).toBeUndefined()

        interceptor.destroy()
    })

    test('应该正确处理metadata中没有serialConfig的情况', async () => {
        const interceptor = new SerialRequestInterceptor(mockRequestor)

        const config: RequestConfig = {
            url: '/api/metadata-no-serial-config',
            method: 'GET',
            serialKey: 'metadata-no-serial-test',
            metadata: {
                otherData: 'some data',
                requestId: '12345'
            }
        }

        let interceptedException: SerialInterceptedException | null = null

        try {
            await interceptor.onRequest(config)
        } catch (error) {
            if (isSerialInterceptedException(error)) {
                interceptedException = error
            }
        }

        expect(interceptedException).not.toBeNull()
        expect(interceptedException!.queueConfig).toBeUndefined()

        interceptor.destroy()
    })

    test('isSerialInterceptedException 函数应该正确识别异常类型', () => {
        const config: RequestConfig = { url: '/test', method: 'GET', serialKey: 'test' }
        const manager = new SerialRequestManager(mockRequestor)

        // 创建串行拦截异常
        const serialException = new SerialInterceptedException(config, undefined, manager)
        expect(isSerialInterceptedException(serialException)).toBe(true)

        // 普通错误
        const normalError = new Error('normal error')
        expect(isSerialInterceptedException(normalError)).toBe(false)

        // null/undefined
        expect(isSerialInterceptedException(null)).toBe(false)
        expect(isSerialInterceptedException(undefined)).toBe(false)

        // 伪造的对象
        const fakeError = { isSerialIntercepted: false }
        expect(isSerialInterceptedException(fakeError)).toBe(false)

        const anotherFakeError = { isSerialIntercepted: true }
        expect(isSerialInterceptedException(anotherFakeError)).toBe(true)

        manager.destroy()
    })

    test('应该正确管理拦截器的队列操作', async () => {
        const interceptor = new SerialRequestInterceptor(mockRequestor, {}, { debug: true })

        // 通过拦截器的管理器添加一些任务
        const manager = interceptor.getManager()

        const promise1 = manager.enqueueRequest('test-queue', {
            url: '/api/1',
            method: 'GET'
        })

        const promise2 = manager.enqueueRequest('test-queue', {
            url: '/api/2',
            method: 'GET'
        })

        await Promise.all([promise1, promise2])

        // 测试清空队列
        const cleared = interceptor.clearQueue('test-queue')
        expect(cleared).toBe(true)

        // 测试清空所有队列
        interceptor.clearAllQueues()

        interceptor.destroy()
    })

    test('应该正确处理拦截器销毁', () => {
        const interceptor = new SerialRequestInterceptor(mockRequestor, {}, { debug: true })

        // 验证拦截器正常工作
        expect(interceptor.isEnabled()).toBe(true)

        // 销毁拦截器
        interceptor.destroy()

        // 销毁后应该仍能调用基本方法（不应该抛出异常）
        expect(() => interceptor.isEnabled()).not.toThrow()
    })
})