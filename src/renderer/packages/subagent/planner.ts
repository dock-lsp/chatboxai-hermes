import type { Message } from '@shared/types'
import type { ModelInterface } from '@shared/models/types'
import { getLogger } from '@/lib/utils'
import { generateText } from '../model-calls'

/** 规划出的子任务定义 */
export interface PlannedSubtask {
  /** 子任务名称 */
  name: string
  /** 子任务描述 */
  description: string
  /** 子代理系统提示词 */
  systemPrompt: string
}

/** 规划结果结构 */
interface PlanningResult {
  /** 是否需要拆分为子任务 */
  needsSubtasks: boolean
  /** 子任务列表 */
  subtasks: Array<{
    name: string
    description: string
    systemPrompt: string
  }>
}

/**
 * 子代理规划器的系统提示词
 * 指导 AI 模型分析用户请求并决定是否需要拆分为子任务
 */
const PLANNER_SYSTEM_PROMPT = `你是一个任务规划专家。你的职责是分析用户的请求，判断是否需要将其拆分为多个独立的子任务。

判断标准：
1. 如果用户的请求涉及多个独立的、可以并行执行的操作，则应拆分为子任务
2. 如果用户的请求是单一、简单的操作，则不需要拆分
3. 每个子任务应该有明确的目标和边界
4. 子任务之间不应有强依赖关系（应可并行执行）

输出格式要求（严格 JSON）：
- 如果不需要拆分：{"needsSubtasks": false, "subtasks": []}
- 如果需要拆分：{"needsSubtasks": true, "subtasks": [{"name": "子任务名称", "description": "子任务描述", "systemPrompt": "子代理的系统提示词"}]}

注意事项：
- name 应简洁明了，不超过 20 个字符
- description 应清晰描述子任务的目标和范围
- systemPrompt 应为子代理提供足够的上下文和指令，使其能独立完成任务
- 子任务数量建议不超过 5 个
- 只输出 JSON，不要输出其他内容`

/**
 * 使用 AI 模型分析用户请求，判断是否需要拆分为子任务
 *
 * @param userMessage 用户消息文本
 * @param model 模型实例
 * @returns 子任务列表，如果不需要拆分则返回空数组
 */
export async function planSubtasks(
  userMessage: string,
  model: ModelInterface
): Promise<PlannedSubtask[]> {
  const logger = getLogger('SubagentPlanner')

  // 构建规划请求消息
  const messages: Message[] = [
    {
      role: 'system',
      content: PLANNER_SYSTEM_PROMPT,
      contentParts: [{ type: 'text', text: PLANNER_SYSTEM_PROMPT }],
    } as Message,
    {
      role: 'user',
      content: userMessage,
      contentParts: [{ type: 'text', text: userMessage }],
    } as Message,
  ]

  try {
    // 调用 AI 模型进行规划分析
    const result = await generateText(model, messages)

    // 提取响应文本
    const responseText = extractTextFromResult(result)

    // 解析 JSON 响应
    const planningResult = parsePlanningResponse(responseText)

    if (!planningResult.needsSubtasks || planningResult.subtasks.length === 0) {
      logger.debug('规划结果: 不需要拆分子任务')
      return []
    }

    logger.debug(`规划结果: 需要拆分为 ${planningResult.subtasks.length} 个子任务`)
    return planningResult.subtasks
  } catch (err) {
    logger.error('子任务规划失败', err)
    // 规划失败时返回空数组，不影响主流程
    return []
  }
}

/**
 * 从模型结果中提取文本内容
 */
function extractTextFromResult(result: Awaited<ReturnType<typeof generateText>>): string {
  // StreamTextResult 包含 contentParts
  if (result && 'contentParts' in result) {
    const streamResult = result as { contentParts: Array<{ type: string; text?: string }> }
    const textParts = streamResult.contentParts
      .filter((part) => part.type === 'text' && part.text)
      .map((part) => part.text as string)
    return textParts.join('')
  }

  return ''
}

/**
 * 解析规划响应 JSON
 * 支持从可能包含 markdown 代码块的响应中提取 JSON
 */
function parsePlanningResponse(responseText: string): PlanningResult {
  let jsonStr = responseText.trim()

  // 尝试从 markdown 代码块中提取 JSON
  const codeBlockMatch = jsonStr.match(/```(?:json)?\s*([\s\S]*?)```/)
  if (codeBlockMatch) {
    jsonStr = codeBlockMatch[1].trim()
  }

  // 尝试找到 JSON 对象的边界
  const firstBrace = jsonStr.indexOf('{')
  const lastBrace = jsonStr.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    jsonStr = jsonStr.slice(firstBrace, lastBrace + 1)
  }

  const parsed: PlanningResult = JSON.parse(jsonStr)

  // 验证基本结构
  if (typeof parsed.needsSubtasks !== 'boolean') {
    throw new Error('规划结果缺少 needsSubtasks 字段')
  }

  if (!Array.isArray(parsed.subtasks)) {
    throw new Error('规划结果缺少 subtasks 字段')
  }

  // 验证每个子任务的结构
  for (const subtask of parsed.subtasks) {
    if (!subtask.name || typeof subtask.name !== 'string') {
      throw new Error('子任务缺少有效的 name 字段')
    }
    if (!subtask.description || typeof subtask.description !== 'string') {
      throw new Error('子任务缺少有效的 description 字段')
    }
    if (!subtask.systemPrompt || typeof subtask.systemPrompt !== 'string') {
      throw new Error('子任务缺少有效的 systemPrompt 字段')
    }
  }

  return parsed
}
