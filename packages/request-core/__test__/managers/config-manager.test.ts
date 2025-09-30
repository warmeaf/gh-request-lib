import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ConfigManager } from '../../src/managers/config-manager'
import { RequestError, RequestErrorType, GlobalConfig, RequestConfig } from '../../src/interface'

describe('ConfigManager', () => {
  let configManager: ConfigManager

  beforeEach(() => {
    configManager = new ConfigManager()
  })

  describe('全局配置管理', () => {
    it('should set valid global config', () => {
      const globalConfig: GlobalConfig = {
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: {
          'Authorization': 'Bearer token'
        },
        debug: true
      }

      configManager.setGlobalConfig(globalConfig)
      const retrieved = configManager.getGlobalConfig()

      expect(retrieved.baseURL).toBe(globalConfig.baseURL)
      expect(retrieved.timeout).toBe(globalConfig.timeout)
      expect(retrieved.headers).toEqual(globalConfig.headers)
      expect(retrieved.debug).toBe(globalConfig.debug)
    })

    it('should throw error for invalid baseURL', () => {
      const invalidConfig = {
        baseURL: 'not-a-valid-url'
      }

      expect(() => {
        configManager.setGlobalConfig(invalidConfig)
      }).toThrow(RequestError)
      
      try {
        configManager.setGlobalConfig(invalidConfig)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        expect((error as RequestError).type).toBe(RequestErrorType.VALIDATION_ERROR)
      }
    })

    it('should throw error for invalid timeout', () => {
      const invalidConfig = {
        timeout: -1
      }

      expect(() => {
        configManager.setGlobalConfig(invalidConfig)
      }).toThrow('Global timeout must be a positive number')
    })

    it('should throw error for invalid headers', () => {
      const invalidConfig = {
        headers: [] as any
      }

      expect(() => {
        configManager.setGlobalConfig(invalidConfig)
      }).toThrow('Global headers must be a plain object')
    })

    it('should throw error for invalid interceptors', () => {
      const invalidConfig = {
        interceptors: {} as any
      }

      expect(() => {
        configManager.setGlobalConfig(invalidConfig)
      }).toThrow('Interceptors must be an array')
    })

    it('should warn for very long timeout', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
      
      configManager.setGlobalConfig({
        timeout: 400000 // 大于5分钟
      })

      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should return a copy of global config', () => {
      const globalConfig = {
        baseURL: 'https://api.example.com',
        timeout: 5000
      }

      configManager.setGlobalConfig(globalConfig)
      const retrieved = configManager.getGlobalConfig()
      
      // 修改返回的配置不应影响内部配置
      retrieved.timeout = 10000
      
      const retrievedAgain = configManager.getGlobalConfig()
      expect(retrievedAgain.timeout).toBe(5000)
    })

    it('should reset global config', () => {
      configManager.setGlobalConfig({
        baseURL: 'https://api.example.com',
        timeout: 5000
      })

      configManager.reset()
      const config = configManager.getGlobalConfig()

      expect(Object.keys(config).length).toBe(0)
    })
  })

  describe('请求配置验证', () => {
    it('should validate correct request config', () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      expect(() => {
        configManager.validateRequestConfig(config)
      }).not.toThrow()
    })

    it('should throw error for missing config', () => {
      expect(() => {
        configManager.validateRequestConfig(null as any)
      }).toThrow('Request config is required')
    })

    it('should throw error for missing URL', () => {
      const config = {
        method: 'GET'
      } as RequestConfig

      expect(() => {
        configManager.validateRequestConfig(config)
      }).toThrow('URL is required and must be a string')
    })

    it('should throw error for invalid URL type', () => {
      const config = {
        url: 123,
        method: 'GET'
      } as any

      expect(() => {
        configManager.validateRequestConfig(config)
      }).toThrow('URL is required and must be a string')
    })

    it('should throw error for missing method', () => {
      const config = {
        url: 'https://api.example.com/users'
      } as RequestConfig

      expect(() => {
        configManager.validateRequestConfig(config)
      }).toThrow('HTTP method is required')
    })

    it('should throw error for invalid HTTP method', () => {
      const config = {
        url: 'https://api.example.com/users',
        method: 'INVALID'
      } as any

      expect(() => {
        configManager.validateRequestConfig(config)
      }).toThrow('Invalid HTTP method: INVALID')
    })

    it('should accept all valid HTTP methods', () => {
      const methods = ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'HEAD', 'OPTIONS']

      methods.forEach(method => {
        const config: RequestConfig = {
          url: 'https://api.example.com/users',
          method: method as any
        }

        expect(() => {
          configManager.validateRequestConfig(config)
        }).not.toThrow()
      })
    })

    it('should throw error for invalid timeout', () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        timeout: -100
      }

      expect(() => {
        configManager.validateRequestConfig(config)
      }).toThrow('Timeout must be a positive number')
    })

    it('should warn for very long timeout', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        timeout: 400000
      }

      configManager.validateRequestConfig(config)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should warn for URL with whitespace', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const config: RequestConfig = {
        url: ' https://api.example.com/users ',
        method: 'GET'
      }

      configManager.validateRequestConfig(config)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should warn for very long URL', () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})

      const longUrl = 'https://api.example.com/' + 'a'.repeat(2050)
      const config: RequestConfig = {
        url: longUrl,
        method: 'GET'
      }

      configManager.validateRequestConfig(config)
      expect(warnSpy).toHaveBeenCalled()
      warnSpy.mockRestore()
    })

    it('should throw error for invalid headers', () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: [] as any
      }

      expect(() => {
        configManager.validateRequestConfig(config)
      }).toThrow('Headers must be a plain object')
    })

    it('should throw error for invalid header values', () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {
          'Content-Type': 123 as any
        }
      }

      expect(() => {
        configManager.validateRequestConfig(config)
      }).toThrow(/Invalid header/)
    })

    it('should throw error for invalid response type', () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        responseType: 'invalid' as any
      }

      expect(() => {
        configManager.validateRequestConfig(config)
      }).toThrow('Invalid response type: invalid')
    })

    it('should accept valid response types', () => {
      const types = ['json', 'text', 'blob', 'arraybuffer']

      types.forEach(type => {
        const config: RequestConfig = {
          url: 'https://api.example.com/users',
          method: 'GET',
          responseType: type as any
        }

        expect(() => {
          configManager.validateRequestConfig(config)
        }).not.toThrow()
      })
    })

    it('should provide helpful suggestions in validation errors', () => {
      const config = {
        url: '',
        method: 'INVALID'
      } as any

      try {
        configManager.validateRequestConfig(config)
      } catch (error) {
        expect(error).toBeInstanceOf(RequestError)
        const requestError = error as RequestError
        expect(requestError.suggestion).toBeTruthy()
        expect(requestError.code).toBeTruthy()
      }
    })
  })

  describe('配置合并', () => {
    it('should merge global and request configs', () => {
      configManager.setGlobalConfig({
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: {
          'Authorization': 'Bearer token'
        }
      })

      const requestConfig: RequestConfig = {
        url: '/users',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const merged = configManager.mergeConfigs(requestConfig)

      expect(merged.url).toBe('https://api.example.com/users')
      expect(merged.timeout).toBe(5000)
      expect(merged.headers?.['Authorization']).toBe('Bearer token')
      expect(merged.headers?.['Content-Type']).toBe('application/json')
    })

    it('should prioritize request config over global config', () => {
      configManager.setGlobalConfig({
        timeout: 5000,
        debug: false
      })

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        timeout: 10000,
        debug: true
      }

      const merged = configManager.mergeConfigs(requestConfig)

      expect(merged.timeout).toBe(10000)
      expect(merged.debug).toBe(true)
    })

    it('should not modify absolute URLs with baseURL', () => {
      configManager.setGlobalConfig({
        baseURL: 'https://api.example.com'
      })

      const requestConfig: RequestConfig = {
        url: 'https://other-api.example.com/users',
        method: 'GET'
      }

      const merged = configManager.mergeConfigs(requestConfig)

      expect(merged.url).toBe('https://other-api.example.com/users')
    })

    it('should handle URLs starting with //', () => {
      configManager.setGlobalConfig({
        baseURL: 'https://api.example.com'
      })

      const requestConfig: RequestConfig = {
        url: '//cdn.example.com/file.js',
        method: 'GET'
      }

      const merged = configManager.mergeConfigs(requestConfig)

      expect(merged.url).toBe('//cdn.example.com/file.js')
    })

    it('should build URL correctly with trailing slash', () => {
      configManager.setGlobalConfig({
        baseURL: 'https://api.example.com/'
      })

      const requestConfig: RequestConfig = {
        url: '/users',
        method: 'GET'
      }

      const merged = configManager.mergeConfigs(requestConfig)

      expect(merged.url).toBe('https://api.example.com/users')
    })

    it('should build URL correctly without leading slash', () => {
      configManager.setGlobalConfig({
        baseURL: 'https://api.example.com'
      })

      const requestConfig: RequestConfig = {
        url: 'users',
        method: 'GET'
      }

      const merged = configManager.mergeConfigs(requestConfig)

      expect(merged.url).toBe('https://api.example.com/users')
    })

    it('should merge headers correctly', () => {
      configManager.setGlobalConfig({
        headers: {
          'Authorization': 'Bearer token',
          'X-Custom': 'global'
        }
      })

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'X-Custom': 'request'
        }
      }

      const merged = configManager.mergeConfigs(requestConfig)

      expect(merged.headers?.['Authorization']).toBe('Bearer token')
      expect(merged.headers?.['Content-Type']).toBe('application/json')
      expect(merged.headers?.['X-Custom']).toBe('request')
    })

    it('should include global interceptors in metadata', () => {
      const interceptor = {
        onRequest: (config: RequestConfig) => config
      }

      configManager.setGlobalConfig({
        interceptors: [interceptor]
      })

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const merged = configManager.mergeConfigs(requestConfig)

      expect(merged.metadata?.globalInterceptors).toEqual([interceptor])
    })

    it('should preserve existing metadata when merging', () => {
      const interceptor = {
        onRequest: (config: RequestConfig) => config
      }

      configManager.setGlobalConfig({
        interceptors: [interceptor]
      })

      const requestConfig: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        metadata: {
          customData: 'test'
        }
      }

      const merged = configManager.mergeConfigs(requestConfig)

      expect(merged.metadata?.customData).toBe('test')
      expect(merged.metadata?.globalInterceptors).toEqual([interceptor])
    })
  })

  describe('配置统计', () => {
    it('should return correct stats for empty config', () => {
      const stats = configManager.getStats()

      expect(stats.hasGlobalConfig).toBe(false)
      expect(stats.globalConfigKeys).toEqual([])
      expect(stats.hasBaseURL).toBe(false)
      expect(stats.hasGlobalTimeout).toBe(false)
      expect(stats.hasGlobalHeaders).toBe(false)
      expect(stats.globalHeadersCount).toBe(0)
    })

    it('should return correct stats with global config', () => {
      configManager.setGlobalConfig({
        baseURL: 'https://api.example.com',
        timeout: 5000,
        headers: {
          'Authorization': 'Bearer token',
          'Content-Type': 'application/json'
        }
      })

      const stats = configManager.getStats()

      expect(stats.hasGlobalConfig).toBe(true)
      expect(stats.globalConfigKeys.length).toBeGreaterThan(0)
      expect(stats.hasBaseURL).toBe(true)
      expect(stats.hasGlobalTimeout).toBe(true)
      expect(stats.hasGlobalHeaders).toBe(true)
      expect(stats.globalHeadersCount).toBe(2)
    })

    it('should track config keys correctly', () => {
      configManager.setGlobalConfig({
        baseURL: 'https://api.example.com',
        debug: true
      })

      const stats = configManager.getStats()

      expect(stats.globalConfigKeys).toContain('baseURL')
      expect(stats.globalConfigKeys).toContain('debug')
    })
  })

  describe('边界情况', () => {
    it('should handle empty global config', () => {
      configManager.setGlobalConfig({})
      
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const merged = configManager.mergeConfigs(config)
      expect(merged.url).toBe('https://api.example.com/users')
    })

    it('should handle config without headers', () => {
      configManager.setGlobalConfig({
        baseURL: 'https://api.example.com'
      })

      const config: RequestConfig = {
        url: '/users',
        method: 'GET'
      }

      const merged = configManager.mergeConfigs(config)
      expect(merged.headers).toBeUndefined()
    })

    it('should handle very large header count', () => {
      const headers: Record<string, string> = {}
      for (let i = 0; i < 100; i++) {
        headers[`Header-${i}`] = `Value-${i}`
      }

      configManager.setGlobalConfig({ headers })
      const stats = configManager.getStats()

      expect(stats.globalHeadersCount).toBe(100)
    })

    it('should handle config with only global headers', () => {
      configManager.setGlobalConfig({
        headers: {
          'Authorization': 'Bearer token'
        }
      })

      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET'
      }

      const merged = configManager.mergeConfigs(config)
      expect(merged.headers).toEqual({ 'Authorization': 'Bearer token' })
    })

    it('should handle config with only request headers', () => {
      const config: RequestConfig = {
        url: 'https://api.example.com/users',
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }

      const merged = configManager.mergeConfigs(config)
      expect(merged.headers).toEqual({ 'Content-Type': 'application/json' })
    })
  })
})
