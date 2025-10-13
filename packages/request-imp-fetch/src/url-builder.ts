/**
 * @description URL 参数构建工具
 * 用于将参数对象转换为查询字符串并附加到 URL
 */

/**
 * 构建带查询参数的 URL
 * @param url 基础 URL
 * @param params 查询参数对象
 * @returns 完整的 URL 字符串
 */
export function buildUrlWithParams(
  url: string,
  params?: Record<string, any>
): string {
  if (!params) {
    return url
  }

  // 尝试获取基础 URL（浏览器环境）
  const base = typeof window !== 'undefined' ? window.location.origin : undefined
  const urlObj = new URL(url, base)

  // 添加查询参数，过滤 null 和 undefined
  Object.keys(params).forEach(key => {
    const value = params[key]
    if (value !== null && value !== undefined) {
      urlObj.searchParams.set(key, String(value))
    }
  })

  return urlObj.toString()
}

