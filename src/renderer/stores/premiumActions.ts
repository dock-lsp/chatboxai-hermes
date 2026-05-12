/**
 * 万象Chat — 已移除付费系统。所有功能永久免费开放。
 */

import { settingsStore } from './settingsStore'

const FREE_LICENSE_KEY = 'free'
const FREE_INSTANCE_ID = 'free-instance'

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
  // 万象Chat 无付费系统，注销不影响使用
}

/**
 * 激活（免费模式 — 自动激活）
 */
export async function activate(
  _licenseKey: string,
  _method: 'login' | 'manual' = 'manual',
  _options?: { pageName?: string }
) {
  settingsStore.setState({
    licenseKey: FREE_LICENSE_KEY,
    licenseInstances: { [FREE_LICENSE_KEY]: FREE_INSTANCE_ID },
    licenseActivationMethod: 'manual',
    memorizedManualLicenseKey: FREE_LICENSE_KEY,
    licenseDetail: {
      type: 'chatboxai-4' as const,
      name: '万象Chat 免费版',
      status: 'active',
      defaultModel: 'chatboxai-4' as const,
      remaining_quota_35: 999999,
      remaining_quota_4: 999999,
      remaining_quota_image: 999999,
      image_used_count: 0,
      image_total_quota: 999999,
      plan_image_limit: 999999,
      token_refreshed_time: new Date().toISOString(),
      token_next_refresh_time: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      token_expire_time: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      remaining_quota_unified: 0.99,
      expansion_pack_limit: 0,
      expansion_pack_usage: 0,
      unified_token_usage: 0,
      unified_token_limit: 999999,
      unified_token_usage_details: [{ type: 'plan', token_usage: 0, token_limit: 999999 }],
    },
  })
  return { valid: true }
}
