import { describe, it, expect } from 'vitest'

describe('Index exports', () => {
  it('should export all required types and functions', async () => {
    const module = await import('../src/index')

    // 检查类型导出（运行时不存在，但可以检查函数）
    expect(typeof module.createRequestCore).toBe('function')
    expect(typeof module.createApiClient).toBe('function')

    // 检查错误类型导出
    expect(module.RequestError).toBeDefined()
    expect(module.RequestErrorType).toBeDefined()
  })

  it('should re-export RequestError correctly', async () => {
    const { RequestError, RequestErrorType } = await import('../src/index')
    
    // 这些应该是从request-core重导出的
    expect(RequestError).toBeDefined()
    expect(RequestErrorType).toBeDefined()
  })

  it('should export factory functions', async () => {
    const { createRequestCore, createApiClient } = await import('../src/index')
    
    expect(typeof createRequestCore).toBe('function')
    expect(typeof createApiClient).toBe('function')
  })
})