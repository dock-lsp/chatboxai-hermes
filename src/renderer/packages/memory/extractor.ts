import type { Message } from '@shared/types'
import type { ModelInterface } from '@shared/models/types'
import { generateText } from '../model-calls'
import { getLogger } from '@/lib/utils'
import type { MemoryExtractionResult, MemoryType } from './types'

const log = getLogger('memory-extractor')

/** 构造记忆提取的系统提示词 */
function buildExtractionSystemPrompt(): string {
  return `你是一个记忆提取助手。你的任务是从对话中提取值得长期记住的关键信息。

请从对话中提取以下类型的信息：

1. **偏好（preference）**：用户明确表达的喜好、习惯、偏好设置等。例如：
   - "我喜欢用 TypeScript"
   - "请用中文回复我"
   - "我偏好简洁的代码风格"

2. **事实（fact）**：关于用户或项目的事实信息。例如：
   - 用户的名字、职业、所在地
   - 项目名称、技术栈、框架版本
   - 重要的技术决策和原因

3. **上下文（context）**：当前工作背景和进展。例如：
   - 正在开发的功能模块
   - 当前遇到的问题和解决方案
   - 项目的整体架构和设计思路

请以 JSON 格式返回提取的记忆列表，格式如下：
{
  "memories": [
    {
      "type": "preference" | "fact" | "context",
      "content": "具体的记忆内容，简洁明了",
      "tags": ["相关标签1", "相关标签2"]
    }
  ]
}

注意事项：
- 只提取确实有价值的信息，不要提取临时性或无关紧要的内容
- 每条记忆的内容应该简洁、具体、独立
- 标签用于分类和检索，应该选择有意义的关键词
- 如果对话中没有值得记住的信息，返回空数组 {"memories": []}
- 只返回 JSON，不要包含其他文字`
}

/** 从对话消息中提取文本内容 */
function extractMessageText(messages: Message[]): string {
  return messages
    .map((msg) => {
      const role = msg.role === 'user' ? '用户' : msg.role === 'assistant' ? '助手' : '系统'
      const textParts = msg.contentParts
        ?.filter((part): part is { type: 'text'; text: string } => part.type === 'text')
        .map((part) => part.text)
        .join('\n') ?? ''
      return `[${role}]: ${textParts}`
    })
    .join('\n\n')
}

/** 解析 AI 返回的 JSON 结果 */
function parseExtractionResult(rawText: string): MemoryExtractionResult {
  // 清理可能的 markdown 代码块标记
  let cleaned = rawText.trim()
  if (cleaned.startsWith('```json')) {
    cleaned = cleaned.slice(7)
  } else if (cleaned.startsWith('```')) {
    cleaned = cleaned.slice(3)
  }
  if (cleaned.endsWith('```')) {
    cleaned = cleaned.slice(0, -3)
  }
  cleaned = cleaned.trim()

  try {
    const parsed = JSON.parse(cleaned) as { memories?: Array<{ type: string; content: string; tags: string[] }> }
    const validTypes: MemoryType[] = ['fact', 'preference', 'context']

    const memories = (parsed.memories ?? []).filter(
      (m): m is { type: MemoryType; content: string; tags: string[] } =>
        typeof m.type === 'string' &&
        validTypes.includes(m.type as MemoryType) &&
        typeof m.content === 'string' &&
        m.content.trim().length > 0 &&
        Array.isArray(m.tags)
    )

    return { memories }
  } catch {
    log.warn('解析记忆提取结果失败，返回空结果', rawText.slice(0, 200))
    return { memories: [] }
  }
}

/**
 * 从对话中提取记忆
 * @param messages 对话消息列表
 * @param model AI 模型接口
 * @returns 提取的记忆结果
 */
export async function extractMemoriesFromConversation(
  messages: Message[],
  model: ModelInterface
): Promise<MemoryExtractionResult> {
  if (messages.length === 0) {
    return { memories: [] }
  }

  const systemPrompt = buildExtractionSystemPrompt()
  const conversationText = extractMessageText(messages)

  // 限制对话文本长度，避免消耗过多 tokens
  const maxConversationLength = 4000
  const truncatedText =
    conversationText.length > maxConversationLength
      ? conversationText.slice(-maxConversationLength)
      : conversationText

  const promptMessages: Message[] = [
    {
      id: 'memory-extraction-system',
      role: 'user',
      contentParts: [
        {
          type: 'text',
          text: `${systemPrompt}\n\n以下是需要分析的对话内容：\n\n${truncatedText}`,
        },
      ],
    },
  ]

  try {
    const result = await generateText(model, promptMessages)

    const responseText =
      result.contentParts
        ?.filter((c): c is { type: 'text'; text: string } => c.type === 'text')
        .map((c) => c.text)
        .join('') ?? ''

    const extractionResult = parseExtractionResult(responseText)
    log.info(`从对话中提取了 ${extractionResult.memories.length} 条记忆`)

    return extractionResult
  } catch (error) {
    log.error('记忆提取失败:', error)
    return { memories: [] }
  }
}
