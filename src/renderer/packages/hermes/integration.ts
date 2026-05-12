/**
 * Hermes 集成层
 * 将记忆系统、技能系统和子代理系统连接到现有的 AI 对话流程中
 */

import type { Message } from '@shared/types'
import { buildMemoryPrompt, selectRelevantMemories } from '../memory/injector'
import { memoryStore } from '../memory/store'
import { skillsStore } from '../skills/store'
import { planSubtasks } from '../subagent/planner'
import { subagentManager } from '../subagent/manager'

/**
 * 构建包含记忆和技能信息的增强系统提示词
 * 在 stream-text 的 injectModelSystemPrompt 之前或之后调用
 * @param userMessage 用户最新消息文本
 * @param existingPrompt 已有的额外提示词（如工具说明）
 * @returns 增强后的提示词片段
 */
export function buildHermesEnhancedPrompt(userMessage: string, existingPrompt: string = ''): string {
  let enhanced = existingPrompt

  // 1. 注入相关记忆
  const allMemories = memoryStore.getState().memories
  const relevantMemories = selectRelevantMemories(allMemories, userMessage)
  const memoryPrompt = buildMemoryPrompt(relevantMemories)
  if (memoryPrompt) {
    enhanced += '\n\n' + memoryPrompt
  }

  // 2. 注入匹配的技能提示
  const matchedSkills = skillsStore.getState().matchSkills(userMessage)
  if (matchedSkills.length > 0) {
    const topSkill = matchedSkills[0]
    enhanced += `\n\n### 可用技能提示\n`
    enhanced += `检测到匹配的技能「${topSkill.skill.name}」(匹配度: ${Math.round(topSkill.matchScore * 100)}%)。\n`
    enhanced += `技能描述: ${topSkill.skill.description}\n`
    enhanced += `建议参考此技能的提示词模板来优化回复质量。`
  }

  return enhanced
}

/**
 * 分析是否需要使用子代理处理用户请求
 * 如果需要，创建并启动子任务
 * @param userMessage 用户消息
 * @param model AI 模型实例
 * @param parentId 父消息 ID
 * @param callbacks 回调函数
 * @returns 子任务列表（如果创建了的话），否则返回 null
 */
export async function maybePlanSubtasks(
  userMessage: string,
  model: { modelId: string; chat: Function },
  parentId: string,
  callbacks: {
    onStatusChange: (taskId: string, status: string, result?: string) => void
    onPartialResult: (taskId: string, text: string) => void
    signal?: AbortSignal
  }
): Promise<Array<{ id: string; name: string; description: string }> | null> {
  try {
    const subtaskPlans = await planSubtasks(userMessage, model as any)

    if (!subtaskPlans || subtaskPlans.length === 0) {
      return null
    }

    // 创建子任务
    const tasks = subtaskPlans.map((plan) => {
      const task = subagentManager.createTask({
        parentId,
        name: plan.name,
        description: plan.description,
        systemPrompt: plan.systemPrompt,
      })
      return { id: task.id, name: task.name, description: task.description }
    })

    // 异步启动所有子任务（不等待完成）
    for (const plan of subtaskPlans) {
      const task = subagentManager.getTask(tasks.find(t => t.name === plan.name)!.id)
      if (task) {
        subagentManager.startTask(task.id, {
          model: model as any,
          onStatusChange: callbacks.onStatusChange,
          onPartialResult: callbacks.onPartialResult,
          signal: callbacks.signal,
        }).catch((err) => {
          console.error('子任务启动失败:', err)
        })
      }
    }

    return tasks
  } catch (err) {
    console.error('子任务规划失败:', err)
    return null
  }
}

/**
 * 等待所有子任务完成并汇总结果
 * @param parentId 父消息 ID
 * @returns 汇总后的结果文本
 */
export async function collectSubagentResults(parentId: string): Promise<string> {
  const completedTasks = await subagentManager.waitForAllCompletion(parentId)

  if (completedTasks.length === 0) {
    return ''
  }

  const results = completedTasks
    .filter((task) => task.status === 'completed' && task.result)
    .map((task) => `## ${task.name}\n${task.result}`)

  if (results.length === 0) {
    return ''
  }

  return `以下是子任务执行结果：\n\n${results.join('\n\n')}`
}

/**
 * 获取指定父消息的子任务状态摘要（用于 UI 展示）
 */
export function getSubagentTasksSummary(parentId: string) {
  const tasks = subagentManager.getTasksByParentId(parentId)
  return tasks.map((task) => ({
    id: task.id,
    name: task.name,
    description: task.description,
    status: task.status,
    result: task.result,
    error: task.error,
    createdAt: task.createdAt,
    completedAt: task.completedAt,
    tokensUsed: task.tokensUsed,
  }))
}
