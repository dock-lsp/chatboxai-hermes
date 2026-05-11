/**
 * 万象Chat — 已移除付费系统。所有功能永久免费开放。
 */

/**
 * 始终返回 true（已移除 license 验证）
 */
export function useAutoValidate(): boolean {
  return true
}

/**
 * 注销（空实现 — 已移除付费）
 */
export async function deactivate(_clearLoginState = true) {
  // 万象Chat 无付费系统
}

/**
 * 激活（空实现 — 已移除付费）
 */
export async function activate(
  _licenseKey: string,
  _method: 'login' | 'manual' = 'manual',
  _options?: { pageName?: string }
) {
  return { valid: false, error: '万象Chat 完全免费，无需激活' }
}
