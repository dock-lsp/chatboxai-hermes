/**
 * 技能创建器
 * 从对话历史中分析并提取可复用的技能模式
 */

import type { Message } from '@shared/types'
import type { ModelInterface } from '@shared/models/types'
import { generateText } from '../model-calls'
import { getLogger } from '@/lib/utils'
import type { Skill, SkillCreationResult } from './types'

const log = getLogger('skills-creator')

/** AI 分析结果的结构化输出 */
interface SkillAnalysisOutput {
  /** 是否包含可复用模式 */
  isReusable: boolean
  /** 信心分数（0-1） */
  confidence: number
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description: string
  /** 触发条件关键词列表 */
  triggerConditions: string[]
  /** 提示词模板 */
  promptTemplate: string
  /** 需要的工具列表 */
  toolSequence: string[]
}

/** 技能创建的系统提示词 */
const SKILL_CREATION_SYSTEM_PROMPT = `你是一个技能分析专家。你的任务是分析一段对话，判断其中是否包含可复用的操作模式（即"技能"）。

技能是指：用户在特定场景下，通过一系列步骤完成某个目标的可复用模式。例如：
- "帮我翻译这段文字为英文" -> 翻译技能
- "帮我总结这篇文章" -> 总结技能
- "帮我写一个 Python 排序算法" -> 编程技能

请分析对话内容，判断是否包含可复用的模式。如果是，请提取以下信息：
- name: 技能名称（简短、清晰）
- description: 技能描述（详细说明技能的用途）
- triggerConditions: 触发条件关键词列表（用户可能会用什么词来触发这个技能）
- promptTemplate: 提示词模板（包含 {input} 占位符，表示用户输入）
- toolSequence: 需要的工具列表（如 web_search, file_read, code_execute 等，如果没有则为空数组）

请以 JSON 格式返回结果，格式如下：
{
  "isReusable": true/false,
  "confidence": 0.0-1.0,
  "name": "技能名称",
  "description": "技能描述",
  "triggerConditions": ["关键词1", "关键词2"],
  "promptTemplate": "提示词模板，包含 {input} 占位符",
  "toolSequence": ["工具1", "工具2"]
}

注意：
1. confidence 表示你对这个技能可复用性的信心，0 表示完全不确定，1 表示非常确定
2. triggerConditions 应该包含用户可能使用的各种表述方式
3. promptTemplate 应该是一个通用的模板，{input} 会被替换为用户的实际输入
4. 如果对话不包含可复用模式，请设置 isReusable 为 false
5. 只返回 JSON，不要返回其他内容`

/**
 * 从对话历史中创建技能
 * 使用 AI 模型分析对话，判断是否包含可复用模式，如果是则提取技能信息
 *
 * @param messages - 对话消息列表
 * @param model - AI 模型接口
 * @param sessionId - 来源会话 ID
 * @returns 技能创建结果，如果不包含可复用模式则返回 null
 */
export async function createSkillFromConversation(
  messages: Message[],
  model: ModelInterface,
  sessionId: string,
): Promise<SkillCreationResult | null> {
  try {
    log.info('开始分析对话，提取技能模式，消息数量:', messages.length)

    // 构建对话内容文本
    const conversationText = messages
      .map((msg) => {
        const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统'
        const content = typeof msg.content === 'string'
          ? msg.content
          : Array.isArray(msg.content)
            ? msg.content
                .filter((part): part is { type: 'text'; text: string } => part.type === 'text')
                .map((part) => part.text)
                .join('\n')
            : String(msg.content)
        return `${role}: ${content}`
      })
      .join('\n\n')

    // 构建分析请求消息
    const analysisMessages: Message[] = [
      {
        role: 'user',
        content: `请分析以下对话，判断是否包含可复用的操作模式：

${conversationText}`,
      } as Message,
    ]

    // 调用 AI 模型进行分析
    const response = await generateText(model, [
      { role: 'system', content: SKILL_CREATION_SYSTEM_PROMPT } as Message,
      ...analysisMessages,
    ])

    const responseText = typeof response === 'string' ? response : JSON.stringify(response)

    // 解析 AI 返回的 JSON 结果
    const analysisResult = parseAnalysisResult(responseText)
    if (!analysisResult || !analysisResult.isReusable) {
      log.info('对话不包含可复用模式')
      return null
    }

    // 验证必要字段
    if (!analysisResult.name || !analysisResult.promptTemplate) {
      log.warn('技能分析结果缺少必要字段')
      return null
    }

    // 生成唯一 ID
    const skillId = `skill_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const now = Date.now()

    // 构建技能对象
    const skill: Skill = {
      id: skillId,
      name: analysisResult.name,
      description: analysisResult.description || '',
      triggerConditions: analysisResult.triggerConditions || [],
      promptTemplate: analysisResult.promptTemplate,
      toolSequence: analysisResult.toolSequence || [],
      successCount: 0,
      failureCount: 0,
      sourceSessionId: sessionId,
      createdAt: now,
      updatedAt: now,
      version: 1,
    }

    log.info('成功创建技能:', skill.name, '信心分数:', analysisResult.confidence)

    return {
      skill,
      confidence: Math.min(1, Math.max(0, analysisResult.confidence)),
    }
  } catch (error) {
    log.error('创建技能失败:', error)
    return null
  }
}

/**
 * 解析 AI 返回的分析结果
 * 尝试从文本中提取 JSON 数据
 */
function parseAnalysisResult(text: string): SkillAnalysisOutput | null {
  try {
    // 尝试直接解析
    return JSON.parse(text) as SkillAnalysisOutput
  } catch {
    // 尝试从文本中提取 JSON 块
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as SkillAnalysisOutput
      } catch {
        // 解析失败
      }
    }

    // 尝试匹配花括号包裹的 JSON
    const braceMatch = text.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]) as SkillAnalysisOutput
      } catch {
        // 解析失败
      }
    }

    log.warn('无法解析 AI 返回的分析结果')
    return null
  }
}
