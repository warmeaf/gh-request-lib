import { 
  RequestConfig, 
  RequestData, 
  FileUploadOptions, 
  PaginationParams, 
  PaginatedResponse 
} from '../interface'

/**
 * @description 便利方法执行器接口
 */
export interface ConvenienceExecutor {
  execute<T>(config: RequestConfig): Promise<T>
}

/**
 * @description 便利方法管理器
 * 
 * 提供常用的HTTP方法包装和特殊用途的便利方法。
 * 所有方法都是对核心execute方法的包装。
 */
export class ConvenienceMethods {
  constructor(private executor: ConvenienceExecutor) {
    if (!executor || typeof executor.execute !== 'function') {
      throw new Error('ConvenienceMethods requires an executor with execute method')
    }
  }

  // ==================== 基础HTTP方法 ====================

  /**
   * GET 请求
   */
  async get<T>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.executor.execute<T>({ 
      url, 
      method: 'GET', 
      ...config 
    })
  }

  /**
   * POST 请求
   */
  async post<T>(url: string, data?: RequestData, config?: Partial<RequestConfig>): Promise<T> {
    return this.executor.execute<T>({ 
      url, 
      method: 'POST', 
      data, 
      ...config 
    })
  }

  /**
   * PUT 请求
   */
  async put<T>(url: string, data?: RequestData, config?: Partial<RequestConfig>): Promise<T> {
    return this.executor.execute<T>({ 
      url, 
      method: 'PUT', 
      data, 
      ...config 
    })
  }

  /**
   * DELETE 请求
   */
  async delete<T>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.executor.execute<T>({ 
      url, 
      method: 'DELETE', 
      ...config 
    })
  }

  /**
   * PATCH 请求
   */
  async patch<T>(url: string, data?: RequestData, config?: Partial<RequestConfig>): Promise<T> {
    return this.executor.execute<T>({ 
      url, 
      method: 'PATCH', 
      data, 
      ...config 
    })
  }

  /**
   * HEAD 请求
   */
  async head(url: string, config?: Partial<RequestConfig>): Promise<void> {
    return this.executor.execute<void>({ 
      url, 
      method: 'HEAD', 
      ...config 
    })
  }

  /**
   * OPTIONS 请求
   */
  async options<T = any>(url: string, config?: Partial<RequestConfig>): Promise<T> {
    return this.executor.execute<T>({ 
      url, 
      method: 'OPTIONS', 
      ...config 
    })
  }

  // ==================== 内容类型特定方法 ====================

  /**
   * JSON POST 请求
   */
  async postJson<T>(url: string, data: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.executor.execute<T>({
      ...config,
      url,
      method: 'POST',
      data,
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers
      }
    })
  }

  /**
   * JSON PUT 请求
   */
  async putJson<T>(url: string, data: any, config?: Partial<RequestConfig>): Promise<T> {
    return this.executor.execute<T>({
      ...config,
      url,
      method: 'PUT',
      data,
      headers: {
        'Content-Type': 'application/json',
        ...config?.headers
      }
    })
  }

  /**
   * 表单数据 POST 请求
   */
  async postForm<T>(
    url: string, 
    data: Record<string, string | number | boolean>, 
    config?: Partial<RequestConfig>
  ): Promise<T> {
    const formData = new URLSearchParams()
    Object.entries(data).forEach(([key, value]) => {
      formData.append(key, String(value))
    })

    return this.executor.execute<T>({
      ...config,
      url,
      method: 'POST',
      data: formData,
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        ...config?.headers
      }
    })
  }

  // ==================== 文件操作方法 ====================

  /**
   * 文件上传
   */
  async uploadFile<T = any>(
    url: string, 
    options: FileUploadOptions, 
    config?: Partial<RequestConfig>
  ): Promise<T> {
    const formData = new FormData()
    
    // 添加主文件
    const fieldName = options.name || 'file'
    if (options.filename) {
      formData.append(fieldName, options.file, options.filename)
    } else {
      formData.append(fieldName, options.file)
    }

    // 添加额外数据
    if (options.additionalData) {
      Object.entries(options.additionalData).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
    }

    return this.executor.execute<T>({
      url,
      method: 'POST',
      data: formData,
      ...config
    })
  }

  /**
   * 多文件上传
   */
  async uploadMultipleFiles<T = any>(
    url: string,
    files: Array<{ file: File | Blob; name?: string; filename?: string }>,
    additionalData?: Record<string, string | number | boolean>,
    config?: Partial<RequestConfig>
  ): Promise<T> {
    const formData = new FormData()

    // 添加所有文件
    files.forEach((fileInfo, index) => {
      const fieldName = fileInfo.name || `file${index}`
      if (fileInfo.filename) {
        formData.append(fieldName, fileInfo.file, fileInfo.filename)
      } else {
        formData.append(fieldName, fileInfo.file)
      }
    })

    // 添加额外数据
    if (additionalData) {
      Object.entries(additionalData).forEach(([key, value]) => {
        formData.append(key, String(value))
      })
    }

    return this.executor.execute<T>({
      url,
      method: 'POST',
      data: formData,
      ...config
    })
  }

  /**
   * 下载文件
   */
  async downloadFile(
    url: string, 
    filename?: string, 
    config?: Partial<RequestConfig>
  ): Promise<Blob> {
    const blob = await this.executor.execute<Blob>({
      url,
      method: 'GET',
      responseType: 'blob',
      ...config
    })

    // 如果是浏览器环境且提供了文件名，自动触发下载
    if (typeof window !== 'undefined' && filename) {
      this.triggerBrowserDownload(blob, filename)
    }

    return blob
  }

  /**
   * 触发浏览器下载
   */
  private triggerBrowserDownload(blob: Blob, filename: string): void {
    const downloadUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = downloadUrl
    link.download = filename
    link.style.display = 'none'
    
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    
    // 清理对象URL
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 100)
  }

  // ==================== 分页和批量方法 ====================

  /**
   * 分页请求
   */
  async getPaginated<T>(
    url: string,
    pagination: PaginationParams = {},
    config?: Partial<RequestConfig>
  ): Promise<PaginatedResponse<T>> {
    const params = {
      page: pagination.page || 1,
      limit: pagination.limit || pagination.size || 20,
      ...pagination,
      ...config?.params
    }

    return this.executor.execute<PaginatedResponse<T>>({
      ...config,
      url,
      method: 'GET',
      params
    })
  }

  /**
   * 获取所有分页数据
   */
  async getAllPaginated<T>(
    url: string,
    options: {
      maxPages?: number
      pageSize?: number
      onProgress?: (page: number, totalPages: number, data: T[]) => void
    } = {},
    config?: Partial<RequestConfig>
  ): Promise<T[]> {
    const { maxPages = 100, pageSize = 20, onProgress } = options
    const allData: T[] = []
    let currentPage = 1
    let hasMore = true

    while (hasMore && currentPage <= maxPages) {
      const result = await this.getPaginated<T>(url, { 
        page: currentPage, 
        limit: pageSize 
      }, config)

      allData.push(...result.data)
      hasMore = result.hasNext
      currentPage++

      // 调用进度回调
      if (onProgress) {
        const estimatedTotalPages = Math.ceil(result.total / pageSize)
        onProgress(currentPage - 1, estimatedTotalPages, allData)
      }
    }

    return allData
  }

  // ==================== 工具方法 ====================

  /**
   * 并行请求多个URL
   */
  async getMultiple<T>(urls: string[], config?: Partial<RequestConfig>): Promise<T[]> {
    const requests = urls.map(url => this.get<T>(url, config))
    return Promise.all(requests)
  }

  /**
   * 顺序执行多个请求
   */
  async getSequential<T>(urls: string[], config?: Partial<RequestConfig>): Promise<T[]> {
    const results: T[] = []
    for (const url of urls) {
      const result = await this.get<T>(url, config)
      results.push(result)
    }
    return results
  }

  /**
   * 健康检查
   */
  async healthCheck(url: string, config?: Partial<RequestConfig>): Promise<boolean> {
    try {
      await this.get(url, { 
        ...config, 
        timeout: config?.timeout || 5000 
      })
      return true
    } catch {
      return false
    }
  }

  /**
   * 获取支持的方法统计
   */
  getSupportedMethods(): {
    basic: string[]
    convenience: string[]
    file: string[]
    pagination: string[]
    utility: string[]
  } {
    return {
      basic: ['get', 'post', 'put', 'delete', 'patch', 'head', 'options'],
      convenience: ['postJson', 'putJson', 'postForm'],
      file: ['uploadFile', 'uploadMultipleFiles', 'downloadFile'],
      pagination: ['getPaginated', 'getAllPaginated'],
      utility: ['getMultiple', 'getSequential', 'healthCheck']
    }
  }
}
