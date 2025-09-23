import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { safeStringify, simpleHash, safeCloneData, createDeferred } from '../../src/features/idempotent/utils'

describe('IdempotentFeature Utils', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('safeStringify', () => {
    it('应该正确序列化普通对象', () => {
      const obj = { name: 'John', age: 30, active: true }
      const result = safeStringify(obj)
      expect(result).toBe(JSON.stringify(obj))
    })

    it('应该正确序列化数组', () => {
      const arr = [1, 2, 'three', { four: 4 }]
      const result = safeStringify(arr)
      expect(result).toBe(JSON.stringify(arr))
    })

    it('应该正确序列化基础类型', () => {
      expect(safeStringify('string')).toBe('"string"')
      expect(safeStringify(123)).toBe('123')
      expect(safeStringify(true)).toBe('true')
      expect(safeStringify(null)).toBe('null')
    })

    it('应该处理undefined', () => {
      const result = safeStringify(undefined)
      expect(result).toBe('[undefined]')
    })

    it('应该处理循环引用', () => {
      const obj: any = { name: 'test' }
      obj.circular = obj // 创建循环引用
      
      const result = safeStringify(obj)
      expect(result).toBe('[object]')
    })

    it('should handle BigInt values', () => {
      const bigIntValue = BigInt(123456789012345678901234567890n)
      const result = safeStringify(bigIntValue)
      expect(result).toBe('[bigint]')
    })

    it('应该处理函数', () => {
      const func = () => 'test'
      const result = safeStringify(func)
      expect(result).toBe('[function]')
    })

    it('应该处理Symbol', () => {
      const symbol = Symbol('test')
      const result = safeStringify(symbol)
      expect(result).toBe('[symbol]')
    })

    it('应该处理Date对象', () => {
      const date = new Date('2023-01-01T00:00:00.000Z')
      const result = safeStringify(date)
      expect(result).toBe(JSON.stringify(date))
    })

    it('应该处理包含不可序列化值的对象', () => {
      const obj = {
        name: 'test',
        func: () => 'function',
        symbol: Symbol('symbol'),
        nested: {
          date: new Date(),
          undefined: undefined
        }
      }
      
      // 应该不抛出错误
      const result = safeStringify(obj)
      expect(typeof result).toBe('string')
    })
  })

  describe('simpleHash', () => {
    it('应该为相同字符串生成相同哈希', () => {
      const input = 'test string'
      const hash1 = simpleHash(input)
      const hash2 = simpleHash(input)
      expect(hash1).toBe(hash2)
    })

    it('应该为不同字符串生成不同哈希', () => {
      const hash1 = simpleHash('test string 1')
      const hash2 = simpleHash('test string 2')
      expect(hash1).not.toBe(hash2)
    })

    it('应该处理空字符串', () => {
      const result = simpleHash('')
      expect(result).toBe('0')
    })

    it('应该处理Unicode字符', () => {
      const unicodeInputs = [
        '中文测试',
        '🚀🔥💯',
        'Тест на русском',
        'العربية',
        '日本語テスト'
      ]
      
      unicodeInputs.forEach(input => {
        const result = simpleHash(input)
        expect(typeof result).toBe('string')
        expect(result.length).toBeGreaterThan(0)
        
        // 相同输入应该产生相同哈希
        expect(simpleHash(input)).toBe(result)
      })
    })

    it('应该为长字符串生成合理的哈希', () => {
      const longString = 'a'.repeat(10000)
      const result = simpleHash(longString)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('应该处理特殊字符', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?`~'
      const result = simpleHash(specialChars)
      expect(typeof result).toBe('string')
      expect(result.length).toBeGreaterThan(0)
    })

    it('应该产生合理分布的哈希值', () => {
      const inputs = Array.from({ length: 100 }, (_, i) => `test-${i}`)
      const hashes = inputs.map(simpleHash)
      const uniqueHashes = new Set(hashes)
      
      // 大部分应该是唯一的（允许一些碰撞）
      expect(uniqueHashes.size).toBeGreaterThan(90)
    })

    it('应该返回基于36进制的字符串', () => {
      const result = simpleHash('test')
      // 应该只包含0-9和a-z字符
      expect(result).toMatch(/^[0-9a-z]+$/)
    })
  })

  describe('safeCloneData', () => {
    describe('deep cloning', () => {
      it('应该深度克隆对象', () => {
        const original = {
          name: 'John',
          details: {
            age: 30,
            address: {
              city: 'New York',
              zip: '10001'
            }
          },
          hobbies: ['reading', 'coding']
        }
        
        const cloned = safeCloneData(original, 'deep')
        
        // 验证深度克隆
        expect(cloned).toEqual(original)
        expect(cloned).not.toBe(original)
        expect(cloned.details).not.toBe(original.details)
        expect(cloned.details.address).not.toBe(original.details.address)
        expect(cloned.hobbies).not.toBe(original.hobbies)
        
        // 修改原对象不应该影响克隆对象
        original.details.age = 31
        original.hobbies.push('swimming')
        expect(cloned.details.age).toBe(30)
        expect(cloned.hobbies).toHaveLength(2)
      })

      it('应该深度克隆数组', () => {
        const original = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2', nested: { value: 'test' } }
        ]
        
        const cloned = safeCloneData(original, 'deep')
        
        expect(cloned).toEqual(original)
        expect(cloned).not.toBe(original)
        expect(cloned[0]).not.toBe(original[0])
        expect(cloned[1].nested).not.toBe(original[1].nested)
      })

      it('应该处理包含null和undefined的对象', () => {
        const original = {
          nullValue: null,
          undefinedValue: undefined,
          emptyString: '',
          zero: 0,
          falseBool: false
        }
        
        const cloned = safeCloneData(original, 'deep')
        
        expect(cloned).toEqual({
          nullValue: null,
          emptyString: '',
          zero: 0,
          falseBool: false
        })
        expect('undefinedValue' in cloned).toBe(false) // JSON.stringify移除undefined
      })

      it('应该处理Date对象', () => {
        const original = {
          createdAt: new Date('2023-01-01T00:00:00.000Z'),
          updatedAt: new Date('2023-12-31T23:59:59.999Z')
        }
        
        const cloned = safeCloneData(original, 'deep')
        
        expect(cloned.createdAt).toEqual(original.createdAt.toISOString())
        expect(cloned.updatedAt).toEqual(original.updatedAt.toISOString())
      })

      it('应该处理不可序列化的值', () => {
        const original = {
          name: 'test',
          func: () => 'function',
          symbol: Symbol('test'),
          bigint: BigInt(123)
        }
        
        const cloned = safeCloneData(original, 'deep')
        
        // 不可序列化的属性应该被过滤掉
        expect(cloned).toEqual({ name: 'test' })
      })

      it('应该处理循环引用', () => {
        const original: any = { name: 'test' }
        original.circular = original
        
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        
        const cloned = safeCloneData(original, 'deep')
        
        // 循环引用无法克隆，应该返回原对象并记录警告
        expect(cloned).toBe(original)
        expect(consoleSpy).toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })
    })

    describe('shallow cloning', () => {
      it('应该浅克隆对象', () => {
        const original = {
          name: 'John',
          details: { age: 30 },
          hobbies: ['reading']
        }
        
        const cloned = safeCloneData(original, 'shallow')
        
        expect(cloned).toEqual(original)
        expect(cloned).not.toBe(original)
        expect(cloned.details).toBe(original.details) // 浅克隆，引用相同
        expect(cloned.hobbies).toBe(original.hobbies) // 浅克隆，引用相同
      })

      it('应该浅克隆数组', () => {
        const original = [
          { id: 1, name: 'Item 1' },
          { id: 2, name: 'Item 2' }
        ]
        
        const cloned = safeCloneData(original, 'shallow')
        
        expect(cloned).toEqual(original)
        expect(cloned).not.toBe(original)
        expect(cloned[0]).toBe(original[0]) // 浅克隆，元素引用相同
      })

      it('应该处理基础类型', () => {
        expect(safeCloneData('string', 'shallow')).toBe('string')
        expect(safeCloneData(123, 'shallow')).toBe(123)
        expect(safeCloneData(true, 'shallow')).toBe(true)
        expect(safeCloneData(null, 'shallow')).toBe(null)
        expect(safeCloneData(undefined, 'shallow')).toBe(undefined)
      })
    })

    describe('no cloning', () => {
      it('应该返回原始值不进行克隆', () => {
        const original = { name: 'test', details: { age: 30 } }
        const result = safeCloneData(original, 'none')
        expect(result).toBe(original)
      })

      it('应该默认不进行克隆', () => {
        const original = { name: 'test' }
        const result = safeCloneData(original)
        expect(result).toBe(original)
      })
    })

    describe('error handling', () => {
      it('应该在深度克隆失败时返回原对象', () => {
        const problematic: any = {}
        // 创建一个会导致JSON.stringify失败的对象
        Object.defineProperty(problematic, 'toJSON', {
          value: () => { throw new Error('JSON error') },
          configurable: true
        })
        
        const consoleSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
        
        const result = safeCloneData(problematic, 'deep')
        expect(result).toBe(problematic)
        expect(consoleSpy).toHaveBeenCalled()
        
        consoleSpy.mockRestore()
      })

      it('应该在浅克隆失败时返回原对象', () => {
        // 创建一个无法展开的对象
        const nonEnumerable = Object.create(null)
        Object.defineProperty(nonEnumerable, 'prop', {
          value: 'value',
          enumerable: false,
          configurable: false
        })
        
        const result = safeCloneData(nonEnumerable, 'shallow')
        expect(result).toBe(nonEnumerable)
      })
    })
  })

  describe('createDeferred', () => {
    it('应该创建具有resolve和reject方法的deferred对象', () => {
      const deferred = createDeferred<string>()
      
      expect(deferred).toHaveProperty('promise')
      expect(deferred).toHaveProperty('resolve')
      expect(deferred).toHaveProperty('reject')
      
      expect(deferred.promise).toBeInstanceOf(Promise)
      expect(typeof deferred.resolve).toBe('function')
      expect(typeof deferred.reject).toBe('function')
    })

    it('应该通过resolve方法解决promise', async () => {
      const deferred = createDeferred<string>()
      const testValue = 'test value'
      
      const promiseResult = deferred.promise
      deferred.resolve(testValue)
      
      const result = await promiseResult
      expect(result).toBe(testValue)
    })

    it('应该通过reject方法拒绝promise', async () => {
      const deferred = createDeferred<string>()
      const testError = new Error('test error')
      
      const promiseResult = deferred.promise
      deferred.reject(testError)
      
      await expect(promiseResult).rejects.toThrow('test error')
    })

    it('应该支持不同类型的值', async () => {
      // 测试数字类型
      const numberDeferred = createDeferred<number>()
      numberDeferred.resolve(42)
      expect(await numberDeferred.promise).toBe(42)
      
      // 测试对象类型
      const objectDeferred = createDeferred<{ name: string }>()
      const testObj = { name: 'test' }
      objectDeferred.resolve(testObj)
      expect(await objectDeferred.promise).toBe(testObj)
      
      // 测试数组类型
      const arrayDeferred = createDeferred<number[]>()
      const testArray = [1, 2, 3]
      arrayDeferred.resolve(testArray)
      expect(await arrayDeferred.promise).toEqual(testArray)
    })

    it('应该只能resolve一次', async () => {
      const deferred = createDeferred<string>()
      
      deferred.resolve('first')
      deferred.resolve('second') // 这个应该被忽略
      
      const result = await deferred.promise
      expect(result).toBe('first')
    })

    it('应该只能reject一次', async () => {
      const deferred = createDeferred<string>()
      
      const firstError = new Error('first error')
      const secondError = new Error('second error')
      
      deferred.reject(firstError)
      deferred.reject(secondError) // 这个应该被忽略
      
      await expect(deferred.promise).rejects.toThrow('first error')
    })

    it('应该支持链式操作', async () => {
      const deferred = createDeferred<number>()
      
      const chainedPromise = deferred.promise
        .then(value => value * 2)
        .then(value => value.toString())
      
      deferred.resolve(21)
      
      const result = await chainedPromise
      expect(result).toBe('42')
    })

    it('应该支持Promise.all', async () => {
      const deferred1 = createDeferred<number>()
      const deferred2 = createDeferred<string>()
      const deferred3 = createDeferred<boolean>()
      
      const allPromise = Promise.all([
        deferred1.promise,
        deferred2.promise,
        deferred3.promise
      ])
      
      deferred1.resolve(1)
      deferred2.resolve('two')
      deferred3.resolve(true)
      
      const result = await allPromise
      expect(result).toEqual([1, 'two', true])
    })

    it('应该支持Promise.race', async () => {
      const deferred1 = createDeferred<string>()
      const deferred2 = createDeferred<string>()
      
      const racePromise = Promise.race([
        deferred1.promise,
        deferred2.promise
      ])
      
      deferred1.resolve('winner')
      deferred2.resolve('loser')
      
      const result = await racePromise
      expect(result).toBe('winner')
    })

    it('应该正确处理异步错误', async () => {
      const deferred = createDeferred<string>()
      
      setTimeout(() => {
        deferred.reject(new Error('async error'))
      }, 0)
      
      await expect(deferred.promise).rejects.toThrow('async error')
    })
  })
})
