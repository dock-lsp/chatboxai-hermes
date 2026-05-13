/**
 * agent.ts
 * AI 智能体核心模块
 *
 * 接入万象Chat已有的模型系统，使用 getModel() + model.chat() 调用真实 AI。
 * 保留思考步骤可视化（从 AI 回复中提取 reasoningContent）。
 * 支持工具调用的结果展示。
 */

import { getModel } from '@shared/models'
import { getModelSettings } from '@shared/utils/model_settings'
import type { ModelInterface, OnResultChange } from '@shared/models/types'
import type { Message, SessionSettings, Settings, StreamTextResult } from '@shared/types'
import { createModelDependencies } from '@/adapters'
import { settingsStore } from '@/stores/settingsStore'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import { tool, type ToolSet } from 'ai'
import { z } from 'zod'
import type {
  Tool,
  ToolCall,
  ThoughtStep,
  AgentMessage,
  AgentSession,
  AgentConfig,
  AgentResponse,
  StreamChunk,
} from './types'
import {
  searchGitHubReposTool,
  getGitHubFileTool,
  getGitHubRepoTool,
  listGitHubDirTool,
  getGitHubReadmeTool,
  searchGitHubCodeTool,
  cloneGitHubRepoTool,
} from './tools/github'
import {
  projectGeneratorTool,
  analyzeProjectRequirementsTool,
} from './tools/project-generator'
import {
  webSearchTool,
  fetchWebPageTool,
  searchAndSummarizeTool,
} from './tools/web-search'

/**
 * 默认智能体系统提示
 */
const DEFAULT_SYSTEM_PROMPT = `你是一个智能 AI 助手，可以帮助用户完成各种任务。你可以使用多种工具来获取信息、执行操作和生成内容。

## 可用工具

### 网络搜索工具
- **web_search**: 搜索互联网获取最新信息。当你需要获取实时数据、新闻、技术文档或任何可能随时间变化的信息时使用。
- **fetch_webpage**: 获取指定 URL 的网页内容。用于获取搜索结果的详细内容或特定网页的信息。
- **search_and_summarize**: 搜索网络并返回摘要信息。适合快速获取某个主题的概览信息。

### GitHub 工具
- **github_search_repos**: 在 GitHub 上搜索仓库。用于查找开源项目、库或示例代码。
- **github_get_repo**: 获取 GitHub 仓库的详细信息，包括星标数、语言、描述等。
- **github_get_file**: 获取 GitHub 仓库中特定文件或目录的内容。
- **github_list_dir**: 列出 GitHub 仓库中某个目录的内容。
- **github_get_readme**: 获取 GitHub 仓库的 README 文件内容。
- **github_search_code**: 在 GitHub 上搜索代码。可以搜索特定的代码片段、函数名等。
- **clone_github_repo**: 克隆 GitHub 仓库到本地指定目录。当用户想要下载或使用某个 GitHub 项目时使用。

### 项目生成器工具
- **generate_project**: 根据配置生成完整的项目结构和文件。支持 React、Vue、Python、Node.js 等多种项目类型。
- **analyze_project_requirements**: 分析项目需求并推荐最佳的项目类型和技术栈。

## 使用指南

1. **观察**：理解用户的需求和问题
2. **思考**：分析如何最好地解决问题，判断是否需要使用工具
3. **行动**：选择合适的工具执行，传入正确的参数
4. **结果**：根据工具返回的结果给出最终回答

## 工具使用场景

- 当用户询问最新信息、新闻、技术文档时，使用 **web_search** 或 **search_and_summarize**
- 当用户想要查找开源项目、代码示例时，使用 **github_search_repos** 或 **github_search_code**
- 当用户想要查看某个 GitHub 仓库的详情时，使用 **github_get_repo**、**github_get_readme** 或 **github_list_dir**
- 当用户想要下载/克隆 GitHub 仓库时，使用 **clone_github_repo** 工具生成克隆命令
- 当用户想要创建新项目时，先使用 **analyze_project_requirements** 分析需求，然后使用 **generate_project** 生成项目

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
    'clone_github_repo',
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
   * 构建 AI SDK 格式的工具集
   * 将自定义工具转换为 AI SDK 的 tool 格式
   */
  private buildToolSet(): ToolSet {
    const tools: ToolSet = {}

    // 网络搜索工具
    if (this.config.enabledTools.includes('web_search')) {
      tools.web_search = tool({
        description: webSearchTool.description,
        inputSchema: z.object({
          query: z.string().describe('搜索查询语句，应该清晰、具体，包含关键词'),
          numResults: z.number().optional().describe('返回的搜索结果数量 (1-20，默认 10)'),
          language: z.string().optional().describe('搜索结果的语言偏好'),
        }),
        execute: async (args) => {
          return await webSearchTool.execute(args)
        },
      })
    }

    if (this.config.enabledTools.includes('fetch_webpage')) {
      tools.fetch_webpage = tool({
        description: fetchWebPageTool.description,
        inputSchema: z.object({
          url: z.string().describe('要获取的网页 URL'),
          maxLength: z.number().optional().describe('返回内容的最大字符数 (默认 5000)'),
        }),
        execute: async (args) => {
          return await fetchWebPageTool.execute(args)
        },
      })
    }

    if (this.config.enabledTools.includes('search_and_summarize')) {
      tools.search_and_summarize = tool({
        description: searchAndSummarizeTool.description,
        inputSchema: z.object({
          query: z.string().describe('搜索查询'),
          context: z.string().optional().describe('额外的上下文信息，帮助生成更相关的摘要'),
        }),
        execute: async (args) => {
          return await searchAndSummarizeTool.execute(args)
        },
      })
    }

    // GitHub 工具
    if (this.config.enabledTools.includes('github_search_repos')) {
      tools.github_search_repos = tool({
        description: searchGitHubReposTool.description,
        inputSchema: z.object({
          query: z.string().describe('搜索关键词，可以使用 GitHub 搜索语法'),
          sort: z.enum(['stars', 'forks', 'updated']).optional().describe('排序方式'),
          order: z.enum(['asc', 'desc']).optional().describe('排序顺序'),
          perPage: z.number().optional().describe('每页结果数 (1-100)'),
        }),
        execute: async (args) => {
          return await searchGitHubReposTool.execute(args)
        },
      })
    }

    if (this.config.enabledTools.includes('github_get_file')) {
      tools.github_get_file = tool({
        description: getGitHubFileTool.description,
        inputSchema: z.object({
          owner: z.string().describe('仓库所有者用户名'),
          repo: z.string().describe('仓库名称'),
          path: z.string().describe('文件或目录路径'),
          ref: z.string().optional().describe('分支、标签或 commit SHA'),
        }),
        execute: async (args) => {
          return await getGitHubFileTool.execute(args)
        },
      })
    }

    if (this.config.enabledTools.includes('github_get_repo')) {
      tools.github_get_repo = tool({
        description: getGitHubRepoTool.description,
        inputSchema: z.object({
          owner: z.string().describe('仓库所有者用户名'),
          repo: z.string().describe('仓库名称'),
        }),
        execute: async (args) => {
          return await getGitHubRepoTool.execute(args)
        },
      })
    }

    if (this.config.enabledTools.includes('github_list_dir')) {
      tools.github_list_dir = tool({
        description: listGitHubDirTool.description,
        inputSchema: z.object({
          owner: z.string().describe('仓库所有者用户名'),
          repo: z.string().describe('仓库名称'),
          path: z.string().optional().describe('目录路径 (默认为根目录)'),
          ref: z.string().optional().describe('分支、标签或 commit SHA'),
        }),
        execute: async (args) => {
          return await listGitHubDirTool.execute(args)
        },
      })
    }

    if (this.config.enabledTools.includes('github_get_readme')) {
      tools.github_get_readme = tool({
        description: getGitHubReadmeTool.description,
        inputSchema: z.object({
          owner: z.string().describe('仓库所有者用户名'),
          repo: z.string().describe('仓库名称'),
          ref: z.string().optional().describe('分支、标签或 commit SHA'),
        }),
        execute: async (args) => {
          return await getGitHubReadmeTool.execute(args)
        },
      })
    }

    if (this.config.enabledTools.includes('github_search_code')) {
      tools.github_search_code = tool({
        description: searchGitHubCodeTool.description,
        inputSchema: z.object({
          query: z.string().describe('搜索关键词'),
          language: z.string().optional().describe('编程语言过滤'),
          perPage: z.number().optional().describe('每页结果数'),
        }),
        execute: async (args) => {
          return await searchGitHubCodeTool.execute(args)
        },
      })
    }

    if (this.config.enabledTools.includes('clone_github_repo')) {
      tools.clone_github_repo = tool({
        description: cloneGitHubRepoTool.description,
        inputSchema: z.object({
          repoUrl: z.string().describe('GitHub 仓库 URL'),
          localPath: z.string().optional().describe('本地克隆路径（可选，默认为当前目录）'),
          branch: z.string().optional().describe('分支名（可选）'),
        }),
        execute: async (args) => {
          return await cloneGitHubRepoTool.execute(args)
        },
      })
    }

    // 项目生成器工具
    if (this.config.enabledTools.includes('generate_project')) {
      tools.generate_project = tool({
        description: projectGeneratorTool.description,
        inputSchema: z.object({
          name: z.string().describe('项目名称'),
          type: z.enum(['flutter', 'react', 'vue', 'android', 'python', 'nodejs', 'generic']).describe('项目类型'),
          description: z.string().describe('项目描述'),
          features: z.array(z.string()).optional().describe('项目功能特性列表'),
          outputPath: z.string().optional().describe('项目输出路径'),
        }),
        execute: async (args) => {
          return await projectGeneratorTool.execute(args)
        },
      })
    }

    if (this.config.enabledTools.includes('analyze_project_requirements')) {
      tools.analyze_project_requirements = tool({
        description: analyzeProjectRequirementsTool.description,
        inputSchema: z.object({
          description: z.string().describe('项目需求描述'),
        }),
        execute: async (args) => {
          return await analyzeProjectRequirementsTool.execute(args)
        },
      })
    }

    return tools
  }

  /**
   * 发送消息并获取响应（非流式）
   */
  async sendMessage(
    sessionId: string,
    content: string,
    options: {
      signal?: AbortSignal
      modelConfig?: { provider: string; modelId: string }
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

      // 构造消息列表
      const chatMessages = this.convertToMessages(session.messages)

      // 构建工具集
      const tools = this.buildToolSet()

      // 调用 model.chat() 进行生成，传入 tools 参数
      const result = await model.chat(chatMessages, {
        signal: options.signal,
        tools,
      })

      // 提取回复文本
      const responseContent = result.contentParts
        ?.filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('') || ''

      // 提取思考步骤
      const extractedSteps = this.extractThoughtSteps(result)
      thoughtSteps.push(...extractedSteps)

      // 提取工具调用
      const toolCalls: ToolCall[] = []
      if (result.contentParts) {
        for (const part of result.contentParts) {
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

      // 构建工具集
      const tools = options.enableTools !== false ? this.buildToolSet() : undefined

      // 用于收集完整回复
      let fullContent = ''
      const toolCalls: ToolCall[] = []

      // 调用 model.chat() 进行流式生成，传入 tools 参数
      const result = await model.chat(chatMessages, {
        signal: options.signal,
        tools,
        onResultChange: (data) => {
          // 提取文本增量
          if (data.contentParts) {
            const textParts = data.contentParts.filter((p) => p.type === 'text')
            const newText = textParts.map((p) => p.text).join('')
            if (newText.length > fullContent.length) {
              fullContent = newText
            }
          }
        },
      })

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
      clone_github_repo: 'GitHub 克隆仓库：克隆 GitHub 仓库到本地指定目录',
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
