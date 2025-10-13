/**
 * @description 响应解析器
 * 根据指定的响应类型解析 Response 对象
 */

export type ResponseType = 'json' | 'text' | 'blob' | 'arraybuffer'

/**
 * 解析响应数据
 * @param response Fetch Response 对象
 * @param responseType 期望的响应类型
 * @returns 解析后的数据
 */
export async function parseResponse<T>(
  response: Response,
  responseType: ResponseType = 'json'
): Promise<T> {
  switch (responseType) {
    case 'text':
      return await response.text() as unknown as T

    case 'blob':
      return await response.blob() as unknown as T

    case 'arraybuffer':
      return await response.arrayBuffer() as unknown as T

    case 'json':
    default:
      // 默认 json，若失败则退回 text
      try {
        return await response.json()
      } catch {
        const text = await response.text()
        return text as unknown as T
      }
  }
}

