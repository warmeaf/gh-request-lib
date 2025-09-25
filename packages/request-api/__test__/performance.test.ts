import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createApiClient } from '../src/index'
import type { ApiInstance, Requestor } from '../src/index'
import { RequestCore } from 'request-core'

// 模拟request-core
vi.mock('request-core', () => ({
    RequestCore: vi.fn().mockImplementation(() => ({
        setGlobalConfig: vi.fn(),
        addInterceptor: vi.fn(),
        clearCache: vi.fn(),
        getCacheStats: vi.fn().mockReturnValue({ hits: 0, misses: 0 }),
        clearInterceptors: vi.fn(),
        destroy: vi.fn(),
        getAllStats: vi.fn().mockReturnValue({ requests: 0 }),
    })),
}))

describe('Performance Tests', () => {
    let mockRequestor: Requestor
    let mockRequestCore: RequestCore

    beforeEach(() => {
        vi.clearAllMocks()

        mockRequestor = {
            request: vi.fn()
        } as any
        mockRequestCore = {
            setGlobalConfig: vi.fn(),
            addInterceptor: vi.fn(),
            clearCache: vi.fn(),
            getCacheStats: vi.fn().mockReturnValue({ hits: 0, misses: 0 }),
            clearInterceptors: vi.fn(),
            destroy: vi.fn(),
            getAllStats: vi.fn().mockReturnValue({ requests: 0 }),
        } as any

        vi.mocked(RequestCore).mockReturnValue(mockRequestCore)
    })

    describe('Client creation performance', () => {
        it('should create client with many APIs efficiently', () => {
            // 创建大量API类
            const manyApis: Record<string, any> = {}
            for (let i = 0; i < 1000; i++) {
                manyApis[`api${i}`] = class implements ApiInstance {
                    requestCore: RequestCore
                    constructor(requestCore: RequestCore) {
                        this.requestCore = requestCore
                    }
                    method() { return `api${i}` }
                }
            }

            const startTime = performance.now()
            const client = createApiClient(manyApis, { requestCore: mockRequestCore })
            const endTime = performance.now()

            const creationTime = endTime - startTime
            console.log(`Created client with 1000 APIs in ${creationTime.toFixed(2)}ms`)

            // 验证所有API都被正确创建
            expect(Object.keys(client)).toHaveLength(1000 + 7) // +7 for management methods
            expect(client.api0.method()).toBe('api0')
            expect(client.api999.method()).toBe('api999')

            // 性能断言 - 创建1000个API应该在合理时间内完成
            expect(creationTime).toBeLessThan(100) // 应该在100ms内完成
        })

        it('should handle rapid client creation and destruction', () => {
            class TestApi implements ApiInstance {
                requestCore: RequestCore
                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }
            }

            const startTime = performance.now()
            const clients: any[] = []

            // 快速创建100个客户端
            for (let i = 0; i < 100; i++) {
                const client = createApiClient({ test: TestApi }, { requestCore: mockRequestCore })
                clients.push(client)
            }

            // 快速销毁所有客户端
            clients.forEach(client => client.destroy())

            const endTime = performance.now()
            const totalTime = endTime - startTime

            console.log(`Created and destroyed 100 clients in ${totalTime.toFixed(2)}ms`)
            expect(totalTime).toBeLessThan(50) // 应该在50ms内完成
        })
    })

    describe('Method call performance', () => {
        it('should handle high-frequency method calls efficiently', async () => {
            class HighFrequencyApi implements ApiInstance {
                requestCore: RequestCore
                private counter = 0

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                fastMethod(): number {
                    return ++this.counter
                }

                async asyncMethod(): Promise<number> {
                    return ++this.counter
                }
            }

            const client = createApiClient({ hf: HighFrequencyApi }, { requestCore: mockRequestCore })

            // 测试同步方法性能
            const syncStartTime = performance.now()
            for (let i = 0; i < 10000; i++) {
                client.hf.fastMethod()
            }
            const syncEndTime = performance.now()
            const syncTime = syncEndTime - syncStartTime

            console.log(`10000 sync method calls took ${syncTime.toFixed(2)}ms`)
            expect(syncTime).toBeLessThan(10) // 应该在10ms内完成

            // 测试异步方法性能
            const asyncStartTime = performance.now()
            const asyncPromises: Promise<number>[] = []
            for (let i = 0; i < 1000; i++) {
                asyncPromises.push(client.hf.asyncMethod())
            }
            await Promise.all(asyncPromises)
            const asyncEndTime = performance.now()
            const asyncTime = asyncEndTime - asyncStartTime

            console.log(`1000 async method calls took ${asyncTime.toFixed(2)}ms`)
            expect(asyncTime).toBeLessThan(100) // 应该在100ms内完成
        })

        it('should handle concurrent API access efficiently', async () => {
            class ConcurrentApi implements ApiInstance {
                requestCore: RequestCore
                private data = new Map<string, any>()

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                async setData(key: string, value: any): Promise<void> {
                    // 模拟一些处理时间
                    await new Promise(resolve => setTimeout(resolve, 1))
                    this.data.set(key, value)
                }

                async getData(key: string): Promise<any> {
                    await new Promise(resolve => setTimeout(resolve, 1))
                    return this.data.get(key)
                }

                getDataSize(): number {
                    return this.data.size
                }
            }

            const client = createApiClient({ concurrent: ConcurrentApi }, { requestCore: mockRequestCore })

            const startTime = performance.now()

            // 并发执行大量操作
            const operations: Promise<any>[] = []
            for (let i = 0; i < 100; i++) {
                operations.push(client.concurrent.setData(`key${i}`, `value${i}`))
            }
            for (let i = 0; i < 100; i++) {
                operations.push(client.concurrent.getData(`key${i}`))
            }

            await Promise.all(operations)

            const endTime = performance.now()
            const totalTime = endTime - startTime

            console.log(`200 concurrent operations took ${totalTime.toFixed(2)}ms`)
            expect(client.concurrent.getDataSize()).toBe(100)
            expect(totalTime).toBeLessThan(500) // 应该在500ms内完成
        })
    })

    describe('Memory usage optimization', () => {
        it('should not leak memory with repeated client creation', () => {
            class MemoryTestApi implements ApiInstance {
                requestCore: RequestCore
                private largeData: number[]

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                    // 创建一些数据来测试内存使用
                    this.largeData = new Array(1000).fill(0).map((_, i) => i)
                }

                getData(): number[] {
                    return this.largeData
                }
            }

            // 记录初始内存使用（如果可用）
            const initialMemory = process.memoryUsage?.()?.heapUsed || 0

            // 创建和销毁大量客户端
            for (let i = 0; i < 100; i++) {
                const client = createApiClient({ memory: MemoryTestApi }, { requestCore: mockRequestCore })

                // 使用API确保它被实例化
                expect(client.memory.getData()).toHaveLength(1000)

                // 销毁客户端
                client.destroy()
            }

            // 强制垃圾回收（如果可用）
            if (global.gc) {
                global.gc()
            }

            const finalMemory = process.memoryUsage?.()?.heapUsed || 0
            const memoryIncrease = finalMemory - initialMemory

            console.log(`Memory increase after 100 client cycles: ${(memoryIncrease / 1024 / 1024).toFixed(2)}MB`)

            // 内存增长应该是合理的（小于10MB）
            expect(memoryIncrease).toBeLessThan(10 * 1024 * 1024)
        })

        it('should handle large API responses efficiently', async () => {
            class LargeResponseApi implements ApiInstance {
                requestCore: RequestCore

                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }

                async getLargeData(size: number): Promise<{ data: number[]; metadata: any }> {
                    console.log(`Generating large response with ${size} items`)
                    const data = new Array(size).fill(0).map((_, i) => i)
                    const metadata = {
                        size,
                        generated: new Date().toISOString(),
                        checksum: data.reduce((sum, val) => sum + val, 0)
                    }
                    return { data, metadata }
                }

                async processLargeData(data: number[]): Promise<{ processed: number; sum: number }> {
                    console.log(`Processing ${data.length} items`)
                    const sum = data.reduce((acc, val) => acc + val, 0)
                    return { processed: data.length, sum }
                }
            }

            const client = createApiClient({ large: LargeResponseApi }, { requestCore: mockRequestCore })

            const startTime = performance.now()

            // 处理大量数据
            const largeResponse = await client.large.getLargeData(100000)
            expect(largeResponse.data).toHaveLength(100000)
            expect(largeResponse.metadata.size).toBe(100000)

            const processResult = await client.large.processLargeData(largeResponse.data)
            expect(processResult.processed).toBe(100000)

            const endTime = performance.now()
            const processingTime = endTime - startTime

            console.log(`Large data processing took ${processingTime.toFixed(2)}ms`)
            expect(processingTime).toBeLessThan(1000) // 应该在1秒内完成
        })
    })

    describe('Scalability tests', () => {
        it('should scale with increasing number of interceptors', () => {
            class ScalableApi implements ApiInstance {
                requestCore: RequestCore
                constructor(requestCore: RequestCore) {
                    this.requestCore = requestCore
                }
            }

            // 测试不同数量的拦截器对性能的影响
            const interceptorCounts = [1, 10, 50, 100]
            const results: Array<{ count: number; time: number }> = []

            interceptorCounts.forEach(count => {
                const interceptors = Array.from({ length: count }, (_, i) => ({
                    onRequest: vi.fn(),
                    onResponse: vi.fn()
                }))

                const startTime = performance.now()
                const client = createApiClient(
                    { scalable: ScalableApi },
                    {
                        requestor: mockRequestor,
                        interceptors
                    }
                )
                const endTime = performance.now()

                const creationTime = endTime - startTime
                results.push({ count, time: creationTime })

                console.log(`Client with ${count} interceptors created in ${creationTime.toFixed(2)}ms`)

                // 验证所有拦截器都被添加
                expect(mockRequestCore.addInterceptor).toHaveBeenCalledTimes(count)

                vi.clearAllMocks()
            })

            // 验证性能随拦截器数量线性增长（而不是指数增长）
            const timeIncrease = results[results.length - 1].time - results[0].time
            expect(timeIncrease).toBeLessThan(50) // 100个拦截器的额外开销应该小于50ms
        })

        it('should handle mixed API complexity efficiently', async () => {
            // 创建不同复杂度的API
            class SimpleApi implements ApiInstance {
                requestCore: RequestCore
                constructor(requestCore: RequestCore) { this.requestCore = requestCore }
                simple() { return 'simple' }
            }

            class MediumApi implements ApiInstance {
                requestCore: RequestCore
                private cache = new Map()
                constructor(requestCore: RequestCore) { this.requestCore = requestCore }

                async medium(key: string): Promise<string> {
                    if (this.cache.has(key)) return this.cache.get(key)
                    await new Promise(resolve => setTimeout(resolve, 1))
                    const result = `medium-${key}`
                    this.cache.set(key, result)
                    return result
                }
            }

            class ComplexApi implements ApiInstance {
                requestCore: RequestCore
                private state = { counter: 0, data: new Map() }

                constructor(requestCore: RequestCore) { this.requestCore = requestCore }

                async complex(operations: Array<{ type: 'set' | 'get'; key: string; value?: any }>): Promise<any[]> {
                    const results: any[] = []
                    for (const op of operations) {
                        this.state.counter++
                        if (op.type === 'set') {
                            this.state.data.set(op.key, op.value)
                            results.push({ success: true, counter: this.state.counter })
                        } else {
                            results.push({ value: this.state.data.get(op.key), counter: this.state.counter })
                        }
                        await new Promise(resolve => setTimeout(resolve, 1))
                    }
                    return results
                }
            }

            const startTime = performance.now()

            const client = createApiClient(
                {
                    simple: SimpleApi,
                    medium: MediumApi,
                    complex: ComplexApi
                },
                { requestor: mockRequestor }
            )

            // 并发执行不同复杂度的操作
            const operations = [
                ...Array.from({ length: 100 }, () => client.simple.simple()),
                ...Array.from({ length: 50 }, (_, i) => client.medium.medium(`key${i}`)),
                ...Array.from({ length: 10 }, (_, i) => client.complex.complex([
                    { type: 'set', key: `complex${i}`, value: i },
                    { type: 'get', key: `complex${i}` }
                ]))
            ]

            const results = await Promise.all(operations)

            const endTime = performance.now()
            const totalTime = endTime - startTime

            console.log(`Mixed complexity operations (160 total) took ${totalTime.toFixed(2)}ms`)

            expect(results).toHaveLength(160)
            expect(totalTime).toBeLessThan(200) // 应该在200ms内完成
        })
    })
})