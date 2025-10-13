/**
 * @description 参数过滤工具
 * 用于过滤请求参数中的 null 和 undefined 值
 */

/**
 * 过滤对象中的 null 和 undefined 值
 * @param params 原始参数对象
 * @returns 过滤后的参数对象
 */
export function filterParams(
  params?: Record<string, any>
): Record<string, string | number | boolean> | undefined {
  if (!params) {
    return undefined
  }

  return Object.keys(params).reduce((acc, key) => {
    const value = params[key]
    if (value !== null && value !== undefined) {
      acc[key] = value
    }
    return acc
  }, {} as Record<string, string | number | boolean>)
}

