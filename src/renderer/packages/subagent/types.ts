import type { Message } from '@shared/types'
import type { ModelInterface } from '@shared/models/types'

/** 子代理任务状态 */
export type SubagentStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled'

/** 子代理任务定义 */
export interface SubagentTask {
  /** 任务唯一标识 */
  id: string
  /** 父消息 ID */
  parentId: string
  /** 任务名称 */
  name: string
  /** 任务描述 */
  description: string
  /** 子代理系统提示词 */
  systemPrompt: string
  /** 子代理的独立消息序列 */
  messages: Message[]
  /** 当前任务状态 */
  status: SubagentStatus
  /** 最终结果文本 */
  result?: string
  /** 错误信息 */
  error?: string
  /** 创建时间戳 */
  createdAt: number
  /** 开始执行时间戳 */
  startedAt?: number
  /** 完成时间戳 */
  completedAt?: number
  /** 工具调用次数 */
  toolCalls: number
  /** token 使用量 */
  tokensUsed: number
}

/** 子代理配置 */
export interface SubagentConfig {
  /** 最大并行数，默认 3 */
  maxConcurrent: number
  /** 超时时间（毫秒），默认 120000 */
  timeout: number
  /** 最大 token 数，默认 4096 */
  maxTokens: number
}

/** 子代理执行参数 */
export interface SubagentExecutionParams {
  /** 使用的模型实例 */
  model: ModelInterface
  /** 会话 ID */
  sessionId?: string
  /** 状态变更回调 */
  onStatusChange: (taskId: string, status: SubagentStatus, result?: string) => void
  /** 部分结果回调（流式） */
  onPartialResult: (taskId: string, text: string) => void
  /** 取消信号 */
  signal?: AbortSignal
}
