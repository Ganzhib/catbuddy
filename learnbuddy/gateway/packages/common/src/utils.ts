/** 指数退避延迟计算 */
export function backoffDelay(retryCount: number, baseMs: number = 5000): number {
  return baseMs * Math.pow(2, retryCount);
}

/** 防抖 */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  delay: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

/** 时间戳格式化 */
export function ts(): string {
  return new Date().toISOString();
}

/** 安全 JSON 解析 */
export function safeJsonParse<T>(str: string, fallback: T): T {
  try {
    return JSON.parse(str) as T;
  } catch {
    return fallback;
  }
}
