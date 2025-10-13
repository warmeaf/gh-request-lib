/**
 * @description 超时控制器
 * 通过 AbortController 统一处理超时与取消
 */

export interface TimeoutControllerResult {
  controller: AbortController
  timeoutId: ReturnType<typeof setTimeout>
  isTimedOut: () => boolean
  cleanup: () => void
}

/**
 * 创建超时控制器
 * @param timeout 超时时间（毫秒）
 * @param externalSignal 外部 AbortSignal
 * @returns 超时控制器结果
 */
export function createTimeoutController(
  timeout: number,
  externalSignal?: AbortSignal
): TimeoutControllerResult {
  let timedOut = false
  const controller = new AbortController()

  // 设置超时定时器
  const timeoutId = setTimeout(() => {
    timedOut = true
    controller.abort()
  }, timeout)

  // 合并外部 signal
  if (externalSignal) {
    if (externalSignal.aborted) {
      controller.abort()
    } else {
      try {
        externalSignal.addEventListener('abort', () => {
          controller.abort()
        })
      } catch (error) {
        // 如果无法添加监听器，记录警告但继续执行
        console.warn('[TimeoutController] Failed to add abort listener:', error)
      }
    }
  }

  return {
    controller,
    timeoutId,
    isTimedOut: () => timedOut,
    cleanup: () => {
      clearTimeout(timeoutId)
    }
  }
}

