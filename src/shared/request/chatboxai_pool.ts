/**
 * 万象Chat — API 后端配置
 * 支持自定义后端，默认离线模式（无需服务器）
 */

// 默认 API 地址（可被 settings 覆盖）
let CUSTOM_API_ORIGIN = ''

// 设置自定义 API 地址
export function setCustomApiOrigin(origin: string) {
  CUSTOM_API_ORIGIN = origin.replace(/\/+$/, '')
}

// 获取当前 API 地址
export function getCustomApiOrigin(): string {
  return CUSTOM_API_ORIGIN
}

// 获取 API 地址（优先使用自定义地址）
export function getAPIOrigin(): string {
  if (process.env.USE_LOCAL_API) {
    return 'http://localhost:8002'
  }
  return CUSTOM_API_ORIGIN || ''
}

// 是否是 ChatboxAI 的请求（兼容旧逻辑，现在全部走自定义后端）
export function isChatboxAPI(_input: RequestInfo | URL): boolean {
  const origin = getAPIOrigin()
  if (!origin) return false
  const url = typeof _input === 'string' ? _input : (_input as Request).url ?? _input.toString()
  return url.startsWith(origin)
}

// 原 getChatboxAPIOrigin 改为 getAPIOrigin
export const getChatboxAPIOrigin = getAPIOrigin

// 不再需要探测定制 API 池
export async function testApiOrigins() {
  return [getAPIOrigin()].filter(Boolean)
}

// 不需要 API 后端的功能列表
export const OFFLINE_FEATURES = [
  'chat',           // 聊天（用第三方 API key）
  'image-gen',      // 图片生成（用第三方 API key）
] as const

// 需要自定义后端的功能
export const ONLINE_FEATURES = [
  'email-login',    // 邮箱验证码登录
  'web-search',     // 联网搜索（代理）
  'file-parse',     // 文件解析
  'mcp-builtin',    // 内置 MCP 服务
  'copilots',       // 系统助手市场
] as const

// 检查是否需要后端
export function needsApiBackend(feature: string): boolean {
  return (ONLINE_FEATURES as readonly string[]).includes(feature)
}
