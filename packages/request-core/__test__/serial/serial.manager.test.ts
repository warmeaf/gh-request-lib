import { describe, test, expect, beforeEach, afterEach } from 'vitest'
import { SerialRequestManager } from '../../src/features/serial/manager'
import { RequestConfig } from '../../src/interface'
import { SerialMockRequestor } from './serial-test-helpers'

describe('串行请求管理器详细功能测试', () => {
    let mockRequestor: SerialMockRequestor

    beforeEach(() => {
        mockRequestor = new SerialMockRequestor()
    })

    afterEach(() => {
        mockRequestor.reset()
    })

    test('应该正确创建和初始化管理器', () => {
        const manager = new SerialRequestManager(mockRequestor, {
            maxQueues: 10,
            cleanupInterval: 5000,
            autoCleanup: true,
            debug: true,
            defaultQueueConfig: {
                maxQueueSize: 5,
                timeout: 10000
            }
        })

        const stats = manager.getStats()
        expect(stats.totalQueues).toBe(0)
        expect(stats.totalTasks).toBe(0)
        expect(manager.getQueueKeys()).toEqual([])

        manager.destroy()
    })

    test('应该正确创建和管理多个队列', async () => {
        const manager = new SerialRequestManager(mockRequestor, { debug: true })

        const config1: RequestConfig = { url: '/api/q1', method: 'GET' }
        const config2: RequestConfig = { url: '/api/q2', method: 'GET' }
        const config3: RequestConfig = { url: '/api/q1-2', method: 'POST' }

        // 创建不同队列的请求
        await Promise.all([
            manager.enqueueRequest('queue1', config1),
            manager.enqueueRequest('queue2', config2),
            manager.enqueueRequest('queue1', config3) // 同一队列的第二个请求
        ])

        // 验证队列创建
        expect(manager.hasQueue('queue1')).toBe(true)
        expect(manager.hasQueue('queue2')).toBe(true)
        expect(manager.hasQueue('non-existent')).toBe(false)

        // 验证队列键
        const queueKeys = manager.getQueueKeys()
        expect(queueKeys).toContain('queue1')
        expect(queueKeys).toContain('queue2')
        expect(queueKeys).toHaveLength(2)

        // 验证统计信息
        const stats = manager.getStats()
        expect(stats.totalQueues).toBe(2)
        expect(stats.totalCompletedTasks).toBe(3)
        expect(stats.queues['queue1'].completedTasks).toBe(2)
        expect(stats.queues['queue2'].completedTasks).toBe(1)

        manager.destroy()
    })

    test('应该正确处理队列数量限制', async () => {
        const manager = new SerialRequestManager(mockRequestor, {
            maxQueues: 2,
            debug: true
        })

        // 创建两个队列 - 应该成功
        await manager.enqueueRequest('queue1', { url: '/api/1', method: 'GET' })
        await manager.enqueueRequest('queue2', { url: '/api/2', method: 'GET' })

        expect(manager.getQueueKeys()).toHaveLength(2)

        // 尝试创建第三个队列 - 应该失败
        await expect(
            manager.enqueueRequest('queue3', { url: '/api/3', method: 'GET' })
        ).rejects.toThrow('Maximum number of serial queues (2) reached')

        // 验证第三个队列没有被创建
        expect(manager.hasQueue('queue3')).toBe(false)
        expect(manager.getQueueKeys()).toHaveLength(2)

        manager.destroy()
    })

    test('应该正确处理默认队列配置', async () => {
        const defaultConfig = {
            maxQueueSize: 3,
            timeout: 5000,
            debug: true
        }

        const manager = new SerialRequestManager(mockRequestor, {
            defaultQueueConfig: defaultConfig,
            debug: true
        })

        // 创建队列时不提供配置，应该使用默认配置
        await manager.enqueueRequest('default-config-test', {
            url: '/api/default',
            method: 'GET'
        })

        // 验证队列被创建
        expect(manager.hasQueue('default-config-test')).toBe(true)

        const stats = manager.getStats()
        expect(stats.queues['default-config-test']).toBeDefined()

        manager.destroy()
    })

    test('应该正确处理队列配置覆盖', async () => {
        const manager = new SerialRequestManager(mockRequestor, {
            defaultQueueConfig: {
                maxQueueSize: 10,
                timeout: 10000
            },
            debug: true
        })

        const customConfig = {
            maxQueueSize: 2,
            timeout: 2000,
            debug: false
        }

        // 使用自定义配置创建队列
        await manager.enqueueRequest('custom-config-test', {
            url: '/api/custom',
            method: 'GET'
        }, customConfig)

        expect(manager.hasQueue('custom-config-test')).toBe(true)

        manager.destroy()
    })

    test('应该正确处理队列清理操作', async () => {
        const manager = new SerialRequestManager(mockRequestor, { debug: true })

        // 创建一些队列和任务
        await Promise.all([
            manager.enqueueRequest('clear-test-1', { url: '/api/clear1', method: 'GET' }),
            manager.enqueueRequest('clear-test-2', { url: '/api/clear2', method: 'GET' }),
            manager.enqueueRequest('clear-test-1', { url: '/api/clear1-2', method: 'GET' })
        ])

        let stats = manager.getStats()
        expect(stats.totalQueues).toBe(2)
        expect(stats.totalCompletedTasks).toBe(3)

        // 清空特定队列
        const cleared1 = manager.clearQueue('clear-test-1')
        expect(cleared1).toBe(true)

        // 清空不存在的队列
        const clearedNonExistent = manager.clearQueue('non-existent')
        expect(clearedNonExistent).toBe(false)

        // 清空所有队列
        manager.clearAllQueues()

        // 验证队列仍然存在但被清空
        expect(manager.hasQueue('clear-test-1')).toBe(true)
        expect(manager.hasQueue('clear-test-2')).toBe(true)

        manager.destroy()
    })

    test('应该正确处理队列移除操作', async () => {
        const manager = new SerialRequestManager(mockRequestor, { debug: true })

        // 创建队列
        await manager.enqueueRequest('remove-test-1', { url: '/api/remove1', method: 'GET' })
        await manager.enqueueRequest('remove-test-2', { url: '/api/remove2', method: 'GET' })

        expect(manager.getQueueKeys()).toHaveLength(2)

        // 移除特定队列
        const removed1 = manager.removeQueue('remove-test-1')
        expect(removed1).toBe(true)
        expect(manager.hasQueue('remove-test-1')).toBe(false)
        expect(manager.getQueueKeys()).toHaveLength(1)

        // 移除不存在的队列
        const removedNonExistent = manager.removeQueue('non-existent')
        expect(removedNonExistent).toBe(false)

        // 移除所有队列
        manager.removeAllQueues()
        expect(manager.getQueueKeys()).toHaveLength(0)
        expect(manager.hasQueue('remove-test-2')).toBe(false)

        manager.destroy()
    })

    test('应该正确计算统计信息', async () => {
        const manager = new SerialRequestManager(mockRequestor, { debug: true })

        // 创建多个队列和任务
        const promises = [
            manager.enqueueRequest('stats-queue-1', { url: '/api/stats1', method: 'GET' }),
            manager.enqueueRequest('stats-queue-1', { url: '/api/stats2', method: 'GET' }),
            manager.enqueueRequest('stats-queue-2', { url: '/api/stats3', method: 'GET' }),
        ]

        // 设置一个请求失败
        mockRequestor.setFailForUrls(['/api/stats2'])

        const results = await Promise.all(promises.map(p => p.catch(e => ({ error: e.message }))))

        const stats = manager.getStats()

        // 验证总体统计
        expect(stats.totalQueues).toBe(2)
        expect(stats.totalTasks).toBe(3)
        expect(stats.totalCompletedTasks).toBe(2) // 成功的任务
        expect(stats.totalFailedTasks).toBe(1) // 失败的任务
        expect(stats.totalPendingTasks).toBe(0) // 所有任务都已完成
        expect(stats.avgProcessingTime).toBeGreaterThan(0)

        // 验证队列级别统计
        expect(stats.queues['stats-queue-1']).toBeDefined()
        expect(stats.queues['stats-queue-2']).toBeDefined()
        expect(stats.queues['stats-queue-1'].totalTasks).toBe(2)
        expect(stats.queues['stats-queue-2'].totalTasks).toBe(1)

        manager.destroy()
    })

    test('应该正确处理活跃队列统计', async () => {
        const manager = new SerialRequestManager(mockRequestor, { debug: true })

        // 暂停处理器创建等待中的任务
        // 暂停处理器创建等待中的任务
        mockRequestor.pause()

        const promises = [
            manager.enqueueRequest('active-queue-1', { url: '/api/active1', method: 'GET' }),
            manager.enqueueRequest('active-queue-2', { url: '/api/active2', method: 'GET' })
        ]

        // 等待任务入队并确保它们被暂停
        await new Promise(resolve => setTimeout(resolve, 50))

        let stats = manager.getStats()
        expect(stats.totalQueues).toBe(2)
        expect(stats.activeQueues).toBe(2) // 两个队列都有等待中的任务
        expect(stats.totalPendingTasks).toBe(2)

        // 恢复处理器完成任务
        mockRequestor.resume()
        await Promise.all(promises)

        stats = manager.getStats()
        expect(stats.totalPendingTasks).toBe(0)
        expect(stats.totalCompletedTasks).toBe(2)

        manager.destroy()
    })

    test('应该正确处理自动清理功能', async () => {
        const manager = new SerialRequestManager(mockRequestor, {
            autoCleanup: true,
            cleanupInterval: 100, // 100ms间隔用于测试
            debug: true
        })

        // 创建并完成一些任务
        await manager.enqueueRequest('cleanup-test', { url: '/api/cleanup', method: 'GET' })

        expect(manager.hasQueue('cleanup-test')).toBe(true)

        // 手动触发清理
        manager.cleanup()

        // 验证清理后的状态
        const stats = manager.getStats()
        expect(stats).toBeDefined()

        manager.destroy()
    })

    test('应该正确处理禁用自动清理', () => {
        const manager = new SerialRequestManager(mockRequestor, {
            autoCleanup: false,
            debug: true
        })

        // 验证管理器正常工作
        const stats = manager.getStats()
        expect(stats.totalQueues).toBe(0)

        manager.destroy()
    })

    test('应该正确处理队列统计信息获取', async () => {
        const manager = new SerialRequestManager(mockRequestor, { debug: true })

        // 创建队列
        await manager.enqueueRequest('queue-stats-test', { url: '/api/queue-stats', method: 'GET' })

        // 获取存在的队列统计
        const queueStats = manager.getQueueStats('queue-stats-test')
        expect(queueStats).not.toBeNull()
        expect(queueStats!.completedTasks).toBe(1)
        expect(queueStats!.totalTasks).toBe(1)

        // 获取不存在的队列统计
        const nonExistentStats = manager.getQueueStats('non-existent')
        expect(nonExistentStats).toBeNull()

        manager.destroy()
    })

    test('应该正确处理并发队列创建', async () => {
        const manager = new SerialRequestManager(mockRequestor, { debug: true })

        // 同时创建多个队列
        const promises = Array.from({ length: 5 }, (_, i) =>
            manager.enqueueRequest(`concurrent-queue-${i}`, {
                url: `/api/concurrent-${i}`,
                method: 'GET'
            })
        )

        await Promise.all(promises)

        // 验证所有队列都被创建
        expect(manager.getQueueKeys()).toHaveLength(5)

        const stats = manager.getStats()
        expect(stats.totalQueues).toBe(5)
        expect(stats.totalCompletedTasks).toBe(5)

        manager.destroy()
    })

    test('应该正确处理管理器销毁', async () => {
        const manager = new SerialRequestManager(mockRequestor, {
            autoCleanup: true,
            cleanupInterval: 1000,
            debug: true
        })

        // 创建一些队列
        await Promise.all([
            manager.enqueueRequest('destroy-queue-1', { url: '/api/destroy1', method: 'GET' }),
            manager.enqueueRequest('destroy-queue-2', { url: '/api/destroy2', method: 'GET' })
        ])

        expect(manager.getQueueKeys()).toHaveLength(2)

        // 销毁管理器
        manager.destroy()

        // 销毁后调用方法不应该抛出异常
        expect(() => manager.getStats()).not.toThrow()
        expect(() => manager.getQueueKeys()).not.toThrow()
        expect(() => manager.hasQueue('destroy-queue-1')).not.toThrow()
    })

    test('应该正确处理队列配置合并', async () => {
        const manager = new SerialRequestManager(mockRequestor, {
            defaultQueueConfig: {
                maxQueueSize: 10,
                timeout: 5000,
                debug: false
            },
            debug: true
        })

        // 第一次创建队列时提供部分配置
        const partialConfig = {
            maxQueueSize: 5,
            // timeout 使用默认值
            debug: true // 覆盖默认值
        }

        await manager.enqueueRequest('config-merge-test', {
            url: '/api/merge',
            method: 'GET'
        }, partialConfig)

        expect(manager.hasQueue('config-merge-test')).toBe(true)

        // 第二次使用同一队列，配置应该被忽略
        await manager.enqueueRequest('config-merge-test', {
            url: '/api/merge2',
            method: 'GET'
        }, {
            maxQueueSize: 20, // 这个应该被忽略
            timeout: 1000     // 这个也应该被忽略
        })

        const stats = manager.getStats()
        expect(stats.queues['config-merge-test'].totalTasks).toBe(2)

        manager.destroy()
    })
})