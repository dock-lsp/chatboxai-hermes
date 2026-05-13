/**
 * agent.ts
 * AI 智能体核心模块
 *
 * 接入万象Chat已有的模型系统，使用 getModel() + streamText() 调用真实 AI。
 * 保留思考步骤可视化（从 AI 回复中提取 reasoningContent）。
 * 支持工具调用的结果展示。
 */

import { getModel } from '@shared/models'
import { getModelSettings } from '@shared/utils/model_settings'
import type { ModelInterface, OnResultChange } from '@shared/models/types'
import type { Message, SessionSettings, Settings, StreamTextResult } from '@shared/types'
import { createModelDependencies } from '@/adapters'
import { streamText } from '@/packages/model-calls'
import { settingsStore } from '@/stores/settingsStore'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import type {
  Tool,
  ToolCall,
  ThoughtStep,
  AgentMessage,
  AgentSession,
  AgentConfig,
  AgentResponse,
  StreamChunk,
  ToolContext,
} from './types'

/**
 * 默认智能体系统提示
 */
const DEFAULT_SYSTEM_PROMPT = `你是一个智能 AI 助手，可以帮助用户完成各种任务。你可以使用多种工具来获取信息、执行操作和生成内容。

当你需要获取最新信息时，使用网络搜索工具。
当你需要查看代码示例或开源项目时，使用 GitHub 工具。
当你需要创建新项目时，使用项目生成器工具。

请遵循以下思考模式：
1. 观察：理解用户的需求和问题
2. 思考：分析如何最好地解决问题
3. 行动：选择合适的工具执行
4. 结果：根据工具返回的结果给出最终回答

始终保持友好、专业的态度，并提供准确、有用的信息。`

/**
 * 默认智能体配置
 */
const DEFAULT_CONFIG: AgentConfig = {
  model: '',
  temperature: 0.7,
  maxTokens: 4000,
  systemPrompt: DEFAULT_SYSTEM_PROMPT,
  enabledTools: [
    'web_search',
    'fetch_webpage',
    'search_and_summarize',
    'github_search_repos',
    'github_get_file',
    'github_get_repo',
    'github_list_dir',
    'github_get_readme',
    'github_search_code',
    'generate_project',
    'analyze_project_requirements',
  ],
}

/**
 * 生成唯一 ID
 */
function generateId(prefix: string = 'id'): string {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

/**
 * AI 智能体核心类
 *
 * 使用万象Chat的模型系统进行真实的 AI 调用，
 * 支持流式输出、思考步骤提取和工具调用展示。
 */
export class Agent {
  private config: AgentConfig
  private sessions: Map<string, AgentSession> = new Map()

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /**
   * 创建新会话
   */
  createSession(sessionId?: string): AgentSession {
    const id = sessionId || this.generateSessionId()
    const now = Date.now()

    const session: AgentSession = {
      id,
      messages: [
        {
          role: 'system',
          content: this.config.systemPrompt,
          timestamp: now,
        },
      ],
      thoughtSteps: [],
      tools: this.config.enabledTools,
      createdAt: now,
      updatedAt: now,
    }

    this.sessions.set(id, session)
    return session
  }

  /**
   * 获取会话
   */
  getSession(sessionId: string): AgentSession | undefined {
    return this.sessions.get(sessionId)
  }

  /**
   * 获取或创建会话
   */
  getOrCreateSession(sessionId: string): AgentSession {
    return this.getSession(sessionId) || this.createSession(sessionId)
  }

  /**
   * 创建模型实例
   * 使用万象Chat的 getModel() + settingsStore + lastUsedModelStore
   * 优先使用传入的 modelConfig，否则使用 lastUsedModelStore
   */
  private async createModelInstance(
    modelConfig?: { provider: string; modelId: string }
  ): Promise<ModelInterface> {
    const globalSettings = settingsStore.getState().getSettings()
    const lastUsedChatModel = lastUsedModelStore.getState().chat

    // 确定使用的模型，优先使用传入的 modelConfig
    const provider = modelConfig?.provider
      || (this.config.model ? this.config.model.split('/')[0] : undefined)
      || lastUsedChatModel?.provider

    const modelId = modelConfig?.modelId
      || (this.config.model ? this.config.model.split('/').slice(1).join('/') : undefined)
      || lastUsedChatModel?.modelId

    if (!provider || !modelId) {
      console.error('未配置模型，请先在设置中选择一个聊天模型')
      throw new Error('未配置模型，请先在设置中选择一个聊天模型')
    }

    // 构建 SessionSettings
    const sessionSettings = getModelSettings(globalSettings, provider, modelId)

    // 获取平台配置
    const { default: platform } = await import('@/platform')
    const configs = await platform.getConfig()

    // 创建模型依赖
    const dependencies = await createModelDependencies()

    // 创建模型实例
    const model = getModel(sessionSettings, globalSettings, configs, dependencies)
    return model
  }

  /**
   * 将 AgentMessage 转换为万象Chat的 Message 格式
   */
  private convertToMessages(agentMessages: AgentMessage[]): Message[] {
    return agentMessages.map((msg) => ({
      id: generateId('msg'),
      role: msg.role as 'system' | 'user' | 'assistant' | 'tool',
      contentParts: [{ type: 'text' as const, text: msg.content }],
      tokenCalculatedAt: {},
    }))
  }

  /**
   * 从 StreamTextResult 中提取思考步骤
   */
  private extractThoughtSteps(result: StreamTextResult): ThoughtStep[] {
    const steps: ThoughtStep[] = []

    // 从 contentParts 中提取 reasoning 内容
    if (result.contentParts) {
      for (const part of result.contentParts) {
        if (part.type === 'reasoning') {
          steps.push({
            id: generateId('thought'),
            type: 'thought',
            content: part.text || '',
            timestamp: Date.now(),
          })
        }
        // 提取工具调用作为行动步骤
        if (part.type === 'tool-call') {
          steps.push({
            id: generateId('action'),
            type: 'action',
            content: `调用工具: ${part.toolName}`,
            timestamp: Date.now(),
            toolCall: {
              tool: part.toolName,
              parameters: (part.args as Record<string, any>) || {},
              result: part.state === 'result' ? part.result : undefined,
              error: part.state === 'error' ? String(part.result) : undefined,
            },
          })
        }
      }
    }

    return steps
  }

  /**
   * 发送消息并获取响应（非流式）
   */
  async sendMessage(
    sessionId: string,
    content: string,
    options: {
      signal?: AbortSignal
    } = {}
  ): Promise<AgentResponse> {
    const session = this.getOrCreateSession(sessionId)
    const thoughtSteps: ThoughtStep[] = []

    // 添加用户消息
    const userMessage: AgentMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    session.messages.push(userMessage)

    // 记录观察步骤
    thoughtSteps.push({
      id: generateId('thought'),
      type: 'observation',
      content: `用户输入: ${content}`,
      timestamp: Date.now(),
    })

    try {
      // 创建模型实例，传入 modelConfig
      const model = await this.createModelInstance(options.modelConfig)

      // 构造消息列表（排除 system 消息，streamText 会自行处理）
      const chatMessages = this.convertToMessages(session.messages)

      // 调用 streamText 进行流式生成
      let fullResult: StreamTextResult = { contentParts: [] }

      const { result } = await streamText(model, {
        messages: chatMessages,
        onResultChangeWithCancel: (data) => {
          // 收集完整结果
          if (data.contentParts) {
            fullResult = {
              ...fullResult,
              ...data,
              contentParts: data.contentParts,
            }
          }
        },
      }, options.signal)

      fullResult = result

      // 提取回复文本
      const responseContent = fullResult.contentParts
        ?.filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('') || ''

      // 提取思考步骤
      const extractedSteps = this.extractThoughtSteps(fullResult)
      thoughtSteps.push(...extractedSteps)

      // 提取工具调用
      const toolCalls: ToolCall[] = []
      if (fullResult.contentParts) {
        for (const part of fullResult.contentParts) {
          if (part.type === 'tool-call') {
            toolCalls.push({
              tool: part.toolName,
              parameters: (part.args as Record<string, any>) || {},
              result: part.state === 'result' ? part.result : undefined,
              error: part.state === 'error' ? String(part.result) : undefined,
            })
          }
        }
      }

      // 添加结果步骤
      if (toolCalls.length > 0) {
        thoughtSteps.push({
          id: generateId('thought'),
          type: 'result',
          content: `工具调用完成，共 ${toolCalls.length} 次调用`,
          timestamp: Date.now(),
        })
      }

      // 添加 AI 回复到会话
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: responseContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: Date.now(),
      }
      session.messages.push(assistantMessage)
      session.thoughtSteps = thoughtSteps
      session.updatedAt = Date.now()

      return {
        content: responseContent,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        thoughtSteps,
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误'

      // 添加错误步骤
      thoughtSteps.push({
        id: generateId('thought'),
        type: 'result',
        content: `执行失败: ${errorMsg}`,
        timestamp: Date.now(),
      })

      session.thoughtSteps = thoughtSteps
      session.updatedAt = Date.now()

      return {
        content: '',
        thoughtSteps,
        error: errorMsg,
      }
    }
  }

  /**
   * 流式发送消息
   *
   * 返回 AsyncGenerator，逐步产出：
   * - thought: 思考步骤
   * - text: 文本内容片段
   * - tool_call: 工具调用信息
   * - reasoning: 推理/思考内容
   * - error: 错误信息
   * - done: 完成
   */
  async *sendMessageStream(
    sessionId: string,
    content: string,
    options: {
      signal?: AbortSignal
      modelConfig?: { provider: string; modelId: string }
      enableTools?: boolean
    } = {}
  ): AsyncGenerator<StreamChunk> {
    const session = this.getOrCreateSession(sessionId)
    const thoughtSteps: ThoughtStep[] = []

    // 添加用户消息
    const userMessage: AgentMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    session.messages.push(userMessage)

    // 发送观察步骤
    const observationStep: ThoughtStep = {
      id: generateId('thought'),
      type: 'observation',
      content: `用户输入: ${content}`,
      timestamp: Date.now(),
    }
    thoughtSteps.push(observationStep)
    yield {
      type: 'thought',
      thoughtStep: observationStep,
    }

    try {
      // 创建模型实例，传入 modelConfig
      const model = await this.createModelInstance(options.modelConfig)

      // 发送思考步骤：正在分析
      const analyzingStep: ThoughtStep = {
        id: generateId('thought'),
        type: 'thought',
        content: '正在分析用户需求...',
        timestamp: Date.now(),
      }
      thoughtSteps.push(analyzingStep)
      yield {
        type: 'thought',
        thoughtStep: analyzingStep,
      }

      // 构造消息列表
      const chatMessages = this.convertToMessages(session.messages)

      // 用于收集完整回复
      let fullContent = ''
      const toolCalls: ToolCall[] = []
      let cancelFn: (() => void) | undefined

      // 调用 streamText 进行流式生成
      const { result } = await streamText(
        model,
        {
          messages: chatMessages,
          onResultChangeWithCancel: (data) => {
            // 保存取消函数
            if (data.cancel) {
              cancelFn = data.cancel
            }

            if (data.contentParts) {
              // 提取文本增量
              const textParts = data.contentParts.filter((p) => p.type === 'text')
              const newText = textParts.map((p) => p.text).join('')

              // 只发送新增的文本
              if (newText.length > fullContent.length) {
                const delta = newText.substring(fullContent.length)
                fullContent = newText
                // 注意：这里不能直接 yield，因为回调不是 generator
                // 我们会在下面的处理中通过 result 获取完整内容
              }

              // 提取推理内容
              const reasoningParts = data.contentParts.filter((p) => p.type === 'reasoning')
              for (const rp of reasoningParts) {
                if (rp.text) {
                  // 推理内容通过 thought 类型发送
                }
              }

              // 提取工具调用
              const toolCallParts = data.contentParts.filter((p) => p.type === 'tool-call')
              for (const tc of toolCallParts) {
                if (tc.state === 'call') {
                  // 新的工具调用
                }
              }
            }
          },
        },
        options.signal
      )

      // 从最终结果中提取内容并发送
      const finalText = result.contentParts
        ?.filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('') || ''

      // 发送推理/思考内容
      const reasoningParts = result.contentParts?.filter((p) => p.type === 'reasoning') || []
      for (const rp of reasoningParts) {
        if (rp.text) {
          const reasoningStep: ThoughtStep = {
            id: generateId('thought'),
            type: 'thought',
            content: rp.text,
            timestamp: Date.now(),
          }
          thoughtSteps.push(reasoningStep)
          yield {
            type: 'reasoning',
            content: rp.text,
            thoughtStep: reasoningStep,
          }
        }
      }

      // 发送工具调用信息
      const toolCallParts = result.contentParts?.filter((p) => p.type === 'tool-call') || []
      for (const tc of toolCallParts) {
        const toolCall: ToolCall = {
          tool: tc.toolName,
          parameters: (tc.args as Record<string, any>) || {},
          result: tc.state === 'result' ? tc.result : undefined,
          error: tc.state === 'error' ? String(tc.result) : undefined,
        }
        toolCalls.push(toolCall)

        const actionStep: ThoughtStep = {
          id: generateId('thought'),
          type: 'action',
          content: `调用工具: ${tc.toolName}`,
          timestamp: Date.now(),
          toolCall,
        }
        thoughtSteps.push(actionStep)
        yield {
          type: 'tool_call',
          toolCall,
          thoughtStep: actionStep,
        }

        // 如果有结果，也发送结果步骤
        if (tc.state === 'result' || tc.state === 'error') {
          const resultStep: ThoughtStep = {
            id: generateId('thought'),
            type: 'result',
            content: tc.state === 'error'
              ? `工具执行失败: ${String(tc.result)}`
              : `工具执行成功`,
            timestamp: Date.now(),
            toolCall,
          }
          thoughtSteps.push(resultStep)
        }
      }

      // 发送最终文本内容（模拟流式输出效果）
      if (finalText) {
        // 按段落分块发送
        const chunks = this.splitTextIntoChunks(finalText)
        for (const chunk of chunks) {
          yield {
            type: 'text',
            content: chunk,
          }
        }
      }

      // 添加结果步骤
      if (toolCalls.length > 0) {
        const resultStep: ThoughtStep = {
          id: generateId('thought'),
          type: 'result',
          content: `工具调用完成，共 ${toolCalls.length} 次调用`,
          timestamp: Date.now(),
        }
        thoughtSteps.push(resultStep)
      }

      // 更新会话
      const assistantMessage: AgentMessage = {
        role: 'assistant',
        content: finalText,
        toolCalls: toolCalls.length > 0 ? toolCalls : undefined,
        timestamp: Date.now(),
      }
      session.messages.push(assistantMessage)
      session.thoughtSteps = thoughtSteps
      session.updatedAt = Date.now()

      yield { type: 'done' }
    } catch (error) {
      // 检查是否是取消操作
      if (options.signal?.aborted) {
        yield { type: 'done' }
        return
      }

      const errorMsg = error instanceof Error ? error.message : '未知错误'

      const errorStep: ThoughtStep = {
        id: generateId('thought'),
        type: 'result',
        content: `执行失败: ${errorMsg}`,
        timestamp: Date.now(),
      }
      thoughtSteps.push(errorStep)

      session.thoughtSteps = thoughtSteps
      session.updatedAt = Date.now()

      yield {
        type: 'error',
        error: errorMsg,
      }
    }
  }

  /**
   * 将文本分割成适合流式输出的块
   */
  private splitTextIntoChunks(text: string, chunkSize: number = 20): string[] {
    const chunks: string[] = []
    for (let i = 0; i < text.length; i += chunkSize) {
      chunks.push(text.substring(i, i + chunkSize))
    }
    return chunks
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): Tool[] {
    // 工具列表由万象Chat的模型系统内部管理
    // 这里返回配置中启用的工具名称列表对应的描述
    return this.config.enabledTools.map((name) => ({
      name,
      description: this.getToolDescription(name),
      parameters: [],
      execute: async () => null,
    }))
  }

  /**
   * 获取工具描述
   */
  private getToolDescription(toolName: string): string {
    const descriptions: Record<string, string> = {
      web_search: '网络搜索：搜索互联网获取最新信息',
      fetch_webpage: '获取网页：获取特定网页的内容',
      search_and_summarize: '搜索并总结：搜索信息并生成摘要',
      github_search_repos: 'GitHub 搜索仓库：搜索 GitHub 上的开源仓库',
      github_get_file: 'GitHub 获取文件：获取 GitHub 仓库中的文件内容',
      github_get_repo: 'GitHub 获取仓库：获取 GitHub 仓库的详细信息',
      github_list_dir: 'GitHub 列出目录：列出 GitHub 仓库中的目录内容',
      github_get_readme: 'GitHub 获取 README：获取仓库的 README 文件',
      github_search_code: 'GitHub 搜索代码：在 GitHub 上搜索代码',
      generate_project: '生成项目：根据描述生成项目脚手架',
      analyze_project_requirements: '分析项目需求：分析项目需求并推荐技术方案',
    }
    return descriptions[toolName] || toolName
  }

  /**
   * 更新配置
   */
  updateConfig(config: Partial<AgentConfig>): void {
    this.config = { ...this.config, ...config }
  }

  /**
   * 获取配置
   */
  getConfig(): AgentConfig {
    return { ...this.config }
  }

  /**
   * 删除会话
   */
  deleteSession(sessionId: string): boolean {
    return this.sessions.delete(sessionId)
  }

  /**
   * 获取所有会话
   */
  getAllSessions(): AgentSession[] {
    return Array.from(this.sessions.values())
  }

  /**
   * 生成会话 ID
   */
  private generateSessionId(): string {
    return `session_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * 创建智能体实例
 */
export function createAgent(config?: Partial<AgentConfig>): Agent {
  return new Agent(config)
}

// 导出单例实例
export const defaultAgent = new Agent()

// 重新导出类型
export type { AgentConfig, AgentResponse, StreamChunk }
