import type { Memory, MemoryType } from './types'

/** 记忆提示词最大字符长度 */
const MAX_MEMORY_PROMPT_LENGTH = 2000

/** 记忆类型标签映射 */
const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  preference: '用户偏好',
  fact: '已知事实',
  context: '上下文信息',
}

/** 记忆类型优先级排序（偏好 > 事实 > 上下文） */
const MEMORY_TYPE_PRIORITY: Record<MemoryType, number> = {
  preference: 0,
  fact: 1,
  context: 2,
}

/**
 * 将记忆列表格式化为系统提示词
 * 按类型分组，优先保留最近访问和高访问次数的记忆
 * @param memories 记忆列表
 * @returns 格式化后的提示词字符串
 */
export function buildMemoryPrompt(memories: Memory[]): string {
  if (memories.length === 0) {
    return ''
  }

  // 按优先级排序：类型优先级 > 访问次数 > 最后访问时间
  const sorted = [...memories].sort((a, b) => {
    const typeDiff = MEMORY_TYPE_PRIORITY[a.type] - MEMORY_TYPE_PRIORITY[b.type]
    if (typeDiff !== 0) return typeDiff
    if (b.accessCount !== a.accessCount) return b.accessCount - a.accessCount
    return b.lastAccessedAt - a.lastAccessedAt
  })

  // 按类型分组
  const grouped: Record<MemoryType, Memory[]> = {
    preference: [],
    fact: [],
    context: [],
  }

  let currentLength = 0
  const header = '以下是关于用户的重要记忆信息，请在回复时参考：\n\n'

  for (const memory of sorted) {
    const entry = `- ${memory.content}`
    const entryLength = entry.length + 1 // 加上换行符

    if (currentLength + entryLength > MAX_MEMORY_PROMPT_LENGTH - header.length) {
      break
    }

    grouped[memory.type].push(memory)
    currentLength += entryLength
  }

  // 构建提示词
  const sections: string[] = []

  for (const type of Object.keys(MEMORY_TYPE_LABELS) as MemoryType[]) {
    const items = grouped[type]
    if (items.length === 0) continue

    const sectionHeader = `### ${MEMORY_TYPE_LABELS[type]}`
    const sectionContent = items.map((m) => `- ${m.content}`).join('\n')
    sections.push(`${sectionHeader}\n${sectionContent}`)
  }

  if (sections.length === 0) {
    return ''
  }

  return `${header}${sections.join('\n\n')}`
}

/**
 * 根据用户消息选择相关的记忆
 * 使用简单的关键词匹配策略
 * @param memories 所有记忆列表
 * @param userMessage 用户消息文本
 * @param maxCount 最大返回数量，默认 10
 * @returns 相关记忆列表
 */
export function selectRelevantMemories(memories: Memory[], userMessage: string, maxCount: number = 10): Memory[] {
  if (memories.length === 0 || !userMessage.trim()) {
    return []
  }

  const lowerMessage = userMessage.toLowerCase()
  // 将用户消息拆分为关键词（简单按空格和标点分割）
  const keywords = lowerMessage
    .split(/[\s,，。.!！?？;；:：、\n\r\t]+/)
    .filter((word) => word.length > 1) // 过滤掉单字符

  if (keywords.length === 0) {
    return []
  }

  // 计算每条记忆的相关度分数
  const scored = memories.map((memory) => {
    let score = 0
    const lowerContent = memory.content.toLowerCase()

    // 关键词匹配得分
    for (const keyword of keywords) {
      if (lowerContent.includes(keyword)) {
        score += 2
      }
    }

    // 标签匹配得分
    for (const tag of memory.tags) {
      const lowerTag = tag.toLowerCase()
      for (const keyword of keywords) {
        if (lowerTag.includes(keyword) || keyword.includes(lowerTag)) {
          score += 3
          break
        }
      }
    }

    // 访问频率加权（高访问次数的记忆可能更重要）
    score += memory.accessCount * 0.1

    return { memory, score }
  })

  // 过滤掉零分记忆，按分数降序排列
  return scored
    .filter((item) => item.score > 0)
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score
      return b.memory.lastAccessedAt - a.memory.lastAccessedAt
    })
    .slice(0, maxCount)
    .map((item) => item.memory)
}
