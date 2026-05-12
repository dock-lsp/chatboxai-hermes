/**
 * 技能改进器
 * 根据技能的实际执行结果，使用 AI 模型改进技能的提示词模板和工具序列
 */

import type { ModelInterface } from '@shared/models/types'
import type { Message } from '@shared/types'
import { generateText } from '../model-calls'
import { getLogger } from '@/lib/utils'
import type { Skill } from './types'

const log = getLogger('skills-improver')

/** AI 改进结果的结构化输出 */
interface SkillImprovementOutput {
  /** 改进后的提示词模板 */
  promptTemplate: string
  /** 改进后的工具列表 */
  toolSequence: string[]
  /** 改进说明 */
  improvementNote: string
}

/** 技能改进的系统提示词 */
const SKILL_IMPROVEMENT_SYSTEM_PROMPT = `你是一个技能优化专家。你的任务是根据技能的实际执行结果，改进技能的提示词模板和工具序列。

你会收到以下信息：
1. 技能的当前配置（名称、描述、提示词模板、工具序列）
2. 技能的最近执行结果（成功或失败的描述）

请根据执行结果分析技能的不足之处，并给出改进建议。具体来说：
- 如果执行成功但结果不理想，优化提示词模板使其更精确
- 如果执行失败，分析失败原因并调整提示词或工具序列
- 如果工具序列不够完善，添加或移除必要的工具

请以 JSON 格式返回改进结果，格式如下：
{
  "promptTemplate": "改进后的提示词模板，保持 {input} 占位符",
  "toolSequence": ["改进后的工具列表"],
  "improvementNote": "改进说明，描述做了哪些改动以及为什么"
}

注意：
1. promptTemplate 必须保留 {input} 占位符
2. toolSequence 应该只包含实际需要的工具
3. 只返回 JSON，不要返回其他内容
4. 如果不需要改进，返回与原始内容相同的结果`

/**
 * 根据执行结果改进技能
 * 使用 AI 模型分析执行结果，优化技能的提示词模板和工具序列
 *
 * @param skill - 需要改进的技能
 * @param executionResult - 技能的执行结果描述
 * @param model - AI 模型接口
 * @returns 改进后的技能（version 递增），如果改进失败则返回 null
 */
export async function improveSkill(
  skill: Skill,
  executionResult: string,
  model: ModelInterface,
): Promise<Skill | null> {
  try {
    log.info('开始改进技能:', skill.name, '当前版本:', skill.version)

    // 构建改进请求
    const improvementRequest = `## 技能当前配置

**名称**: ${skill.name}
**描述**: ${skill.description}
**提示词模板**: ${skill.promptTemplate}
**工具序列**: ${JSON.stringify(skill.toolSequence)}
**使用统计**: 成功 ${skill.successCount} 次，失败 ${skill.failureCount} 次

## 最近执行结果

${executionResult}

请分析以上信息，改进这个技能的提示词模板和工具序列。`

    // 调用 AI 模型进行改进分析
    const response = await generateText(model, [
      { role: 'system', content: SKILL_IMPROVEMENT_SYSTEM_PROMPT } as Message,
      { role: 'user', content: improvementRequest } as Message,
    ])

    const responseText = typeof response === 'string' ? response : JSON.stringify(response)

    // 解析改进结果
    const improvementResult = parseImprovementResult(responseText)
    if (!improvementResult) {
      log.warn('无法解析技能改进结果')
      return null
    }

    // 验证改进结果
    if (!improvementResult.promptTemplate.includes('{input}')) {
      log.warn('改进后的提示词模板缺少 {input} 占位符')
      return null
    }

    // 检查是否有实质性改进
    const hasPromptChange = improvementResult.promptTemplate !== skill.promptTemplate
    const hasToolChange = JSON.stringify(improvementResult.toolSequence) !== JSON.stringify(skill.toolSequence)

    if (!hasPromptChange && !hasToolChange) {
      log.info('技能无需改进')
      return null
    }

    // 构建改进后的技能对象
    const improvedSkill: Skill = {
      ...skill,
      promptTemplate: improvementResult.promptTemplate,
      toolSequence: improvementResult.toolSequence,
      version: skill.version + 1,
      updatedAt: Date.now(),
    }

    log.info(
      '技能改进完成:',
      skill.name,
      `v${skill.version} -> v${improvedSkill.version}`,
      '说明:',
      improvementResult.improvementNote,
    )

    return improvedSkill
  } catch (error) {
    log.error('改进技能失败:', error)
    return null
  }
}

/**
 * 解析 AI 返回的改进结果
 * 尝试从文本中提取 JSON 数据
 */
function parseImprovementResult(text: string): SkillImprovementOutput | null {
  try {
    // 尝试直接解析
    return JSON.parse(text) as SkillImprovementOutput
  } catch {
    // 尝试从文本中提取 JSON 块
    const jsonMatch = text.match(/```json\s*([\s\S]*?)\s*```/)
    if (jsonMatch) {
      try {
        return JSON.parse(jsonMatch[1]) as SkillImprovementOutput
      } catch {
        // 解析失败
      }
    }

    // 尝试匹配花括号包裹的 JSON
    const braceMatch = text.match(/\{[\s\S]*\}/)
    if (braceMatch) {
      try {
        return JSON.parse(braceMatch[0]) as SkillImprovementOutput
      } catch {
        // 解析失败
      }
    }

    log.warn('无法解析 AI 返回的改进结果')
    return null
  }
}
