import { describe, it, expect } from 'vitest'

describe('Index exports', () => {
  it('should export all required types and functions', async () => {
    const module = await import('../src/index')

    // 检查工厂函数导出
    expect(typeof module.createRequestCore).toBe('function')
    expect(typeof module.createApiClient).toBe('function')

    // 检查错误类型导出
    expect(module.RequestError).toBeDefined()
    expect(module.RequestErrorType).toBeDefined()
  })

  it('should export RequestError with correct functionality', async () => {
    const { RequestError, RequestErrorType } = await import('../src/index')
    
    // 测试RequestError实例化
    const error = new RequestError('Test error message', { type: RequestErrorType.NETWORK_ERROR })
    
    expect(error).toBeInstanceOf(RequestError)
    expect(error).toBeInstanceOf(Error)
    expect(error.message).toBe('Test error message')
    expect(error.type).toBe(RequestErrorType.NETWORK_ERROR)
    expect(error.name).toBe('RequestError')
  })

  it('should export RequestErrorType with all error types', async () => {
    const { RequestErrorType } = await import('../src/index')
    
    // 验证错误类型枚举包含预期的值
    expect(RequestErrorType).toBeDefined()
    expect(typeof RequestErrorType).toBe('object')
    
    // 检查常见的错误类型（根据实际的RequestErrorType定义调整）
    const errorTypes = Object.values(RequestErrorType)
    expect(errorTypes.length).toBeGreaterThan(0)
    expect(errorTypes).toContain(RequestErrorType.NETWORK_ERROR)
  })

  it('should export factory functions with correct signatures', async () => {
    const { createRequestCore, createApiClient } = await import('../src/index')
    
    expect(typeof createRequestCore).toBe('function')
    expect(createRequestCore.length).toBeGreaterThanOrEqual(1) // 至少需要requestor参数
    
    expect(typeof createApiClient).toBe('function')
    expect(createApiClient.length).toBe(2) // apis和options参数
  })

  it('should have consistent export structure', async () => {
    const module = await import('../src/index')
    const exportedKeys = Object.keys(module)
    
    // 验证导出的关键项目
    const expectedExports = [
      'createRequestCore',
      'createApiClient', 
      'RequestError',
      'RequestErrorType'
    ]
    
    expectedExports.forEach(exportName => {
      expect(exportedKeys).toContain(exportName)
    })
  })
})