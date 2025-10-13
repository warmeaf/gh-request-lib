import { setHeaderIfAbsent } from './headers-utils'

/**
 * @description 请求体构建器
 * 处理不同类型的请求体并设置相应的 Content-Type
 */

/**
 * 检查数据类型
 */
interface TypeChecks {
  isFormLike: boolean
  isBlob: boolean
  isArrayBuffer: boolean
  isURLSearchParams: boolean
  isReadableStream: boolean
}

/**
 * 检查数据的类型
 * @param data 要检查的数据
 * @returns 类型检查结果
 */
function checkDataType(data: any): TypeChecks {
  return {
    isFormLike: typeof FormData !== 'undefined' && data instanceof FormData,
    isBlob: typeof Blob !== 'undefined' && data instanceof Blob,
    isArrayBuffer: typeof ArrayBuffer !== 'undefined' && data instanceof ArrayBuffer,
    isURLSearchParams: typeof URLSearchParams !== 'undefined' && data instanceof URLSearchParams,
    isReadableStream: typeof ReadableStream !== 'undefined' && data instanceof ReadableStream
  }
}

/**
 * 构建请求体并设置相应的请求头
 * @param data 请求数据
 * @param method 请求方法
 * @param headers 请求头对象（会被修改）
 * @returns 处理后的请求体
 */
export function buildRequestBody(
  data: any,
  method: string,
  headers: Record<string, string>
): BodyInit | undefined {
  // 只有特定方法才允许请求体
  if (!data || !['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
    return undefined
  }

  const typeChecks = checkDataType(data)

  // 原生类型直接使用
  if (typeChecks.isFormLike || typeChecks.isBlob || typeChecks.isArrayBuffer) {
    return data as BodyInit
  }

  // URLSearchParams 直接使用（浏览器会自动设置 Content-Type）
  if (typeChecks.isURLSearchParams) {
    return data as unknown as BodyInit
  }

  // ReadableStream 直接使用
  if (typeChecks.isReadableStream) {
    return data as unknown as BodyInit
  }

  // 字符串直接使用，但需要设置 Content-Type
  if (typeof data === 'string') {
    setHeaderIfAbsent(headers, 'Content-Type', 'application/json')
    return data
  }

  // 其他类型（对象等）转换为 JSON
  setHeaderIfAbsent(headers, 'Content-Type', 'application/json')
  return JSON.stringify(data)
}

