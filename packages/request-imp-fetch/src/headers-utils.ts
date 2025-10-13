/**
 * @description 请求头工具函数
 * 提供大小写无关的请求头操作
 */

/**
 * 检查请求头是否存在（大小写无关）
 * @param headers 请求头对象
 * @param key 要检查的键
 * @returns 是否存在
 */
export function hasHeaderIgnoreCase(
  headers: Record<string, string>,
  key: string
): boolean {
  const lower = key.toLowerCase()
  return Object.keys(headers).some(k => k.toLowerCase() === lower)
}

/**
 * 如果请求头不存在则设置（大小写无关）
 * @param headers 请求头对象
 * @param key 要设置的键
 * @param value 要设置的值
 */
export function setHeaderIfAbsent(
  headers: Record<string, string>,
  key: string,
  value: string
): void {
  if (!hasHeaderIgnoreCase(headers, key)) {
    headers[key] = value
  }
}

