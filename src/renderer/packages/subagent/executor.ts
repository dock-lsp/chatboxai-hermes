import type { ModelInterface } from '@shared/models/types'
import { getLogger } from '@/lib/utils'
import { convertToModelMessages } from '../model-calls/message-utils'
import type { SubagentTask } from './types'

/** 执行结果 */
export interface SubagentExecutionResult {
  /** 最终结果文本 */
  result: string
  /** token 使用量 */
  tokensUsed: number
}

/**
 * 执行子代理任务
 * 使用 model.chat() 执行子代理对话，收集流式结果
 *
 * @param task 子代理任务
 * @param model 模型实例
 * @param params 执行参数
 * @returns 执行结果
 */
export async function executeSubagentTask(
  task: SubagentTask,
  model: ModelInterface,
  params: {
    onPartialResult: (text: string) => void
    signal: AbortSignal
  }
): Promise<SubagentExecutionResult> {
  const logger = getLogger('SubagentExecutor')
  const { onPartialResult, signal } = params

  // 构建子代理的消息序列：系统提示 + 任务消息
  const systemMessage = {
    role: 'system' as const,
    content: task.systemPrompt,
  }

  const allMessages = [systemMessage, ...task.messages]

  // 转换为模型消息格式
  const modelMessages = await convertToModelMessages(allMessages, {
    modelSupportVision: model.isSupportVision(),
  })

  // 如果模型不支持系统消息，将系统提示转为用户消息
  const finalMessages = model.isSupportSystemMessage()
    ? modelMessages
    : modelMessages.map((m) =>
        m.role === 'system' ? { ...m, role: 'user' as const } : m
      )

  let resultText = ''
  let tokensUsed = 0

  // 设置超时定时器
  const timeoutMs = 120000 // 默认超时 120 秒
  const timeoutId = setTimeout(() => {
    logger.warn(`子代理任务超时: ${task.id}`)
    // 通过 AbortController 触发取消
    const error = new Error(`子代理任务超时 (${timeoutMs}ms)`)
    error.name = 'TimeoutError'
    throw error
  }, timeoutMs)

  // 监听外部取消信号
  if (signal.aborted) {
    clearTimeout(timeoutId)
    throw new DOMException('子代理任务已取消', 'AbortError')
  }

  try {
    // 调用模型 chat 接口
    const chatResult = await model.chat(finalMessages, {
      signal,
      onResultChange: (data) => {
        // 从 contentParts 中提取文本内容
        if (data.contentParts) {
          for (const part of data.contentParts) {
            if (part.type === 'text') {
              resultText = part.text
              onPartialResult(part.text)
            }
          }
        }

        // 累计 token 使用量
        if (data.tokensUsed) {
          tokensUsed = data.tokensUsed
        }
      },
    })

    // 如果 onResultChange 没有被调用或结果为空，尝试从最终结果中提取
    if (!resultText && chatResult.contentParts) {
      for (const part of chatResult.contentParts) {
        if (part.type === 'text') {
          resultText = part.text
        }
      }
    }

    // 从 usage 中获取 token 使用量
    if (chatResult.usage) {
      tokensUsed = chatResult.usage.totalTokens ?? tokensUsed
    }

    logger.debug(`子代理任务执行完成: ${task.id}, tokens: ${tokensUsed}`)

    return { result: resultText, tokensUsed }
  } finally {
    clearTimeout(timeoutId)
  }
}
