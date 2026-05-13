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

import { searchTools } from './tools/web-search'
import { githubTools } from './tools/github'
import { projectGeneratorTools } from './tools/project-generator'

/**
 * 默认智能体配置
 */
const DEFAULT_CONFIG: AgentConfig = {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4000,
  systemPrompt: `你是一个智能 AI 助手，可以帮助用户完成各种任务。你可以使用多种工具来获取信息、执行操作和生成内容。

当你需要获取最新信息时，使用网络搜索工具。
当你需要查看代码示例或开源项目时，使用 GitHub 工具。
当你需要创建新项目时，使用项目生成器工具。

请遵循以下思考模式：
1. 观察：理解用户的需求和问题
2. 思考：分析如何最好地解决问题
3. 行动：选择合适的工具执行
4. 结果：根据工具返回的结果给出最终回答

始终保持友好、专业的态度，并提供准确、有用的信息。`,
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
 * 工具注册表
 */
class ToolRegistry {
  private tools: Map<string, Tool> = new Map()

  constructor() {
    // 注册所有工具
    this.registerTools([...searchTools, ...githubTools, ...projectGeneratorTools])
  }

  register(tool: Tool): void {
    this.tools.set(tool.name, tool)
  }

  registerTools(tools: Tool[]): void {
    tools.forEach((tool) => this.register(tool))
  }

  get(name: string): Tool | undefined {
    return this.tools.get(name)
  }

  getAll(): Tool[] {
    return Array.from(this.tools.values())
  }

  getEnabled(enabledTools: string[]): Tool[] {
    return enabledTools
      .map((name) => this.tools.get(name))
      .filter((tool): tool is Tool => tool !== undefined)
  }
}

/**
 * 工具执行器
 */
class ToolExecutor {
  private registry: ToolRegistry

  constructor(registry: ToolRegistry) {
    this.registry = registry
  }

  async execute(
    toolName: string,
    parameters: Record<string, any>,
    context: ToolContext
  ): Promise<any> {
    const tool = this.registry.get(toolName)

    if (!tool) {
      throw new Error(`工具不存在: ${toolName}`)
    }

    // 验证必需参数
    const missingParams = tool.parameters
      .filter((p) => p.required && !(p.name in parameters))
      .map((p) => p.name)

    if (missingParams.length > 0) {
      throw new Error(`缺少必需参数: ${missingParams.join(', ')}`)
    }

    // 执行工具
    try {
      const result = await tool.execute(parameters)
      return result
    } catch (error) {
      throw new Error(
        `工具执行失败 (${toolName}): ${error instanceof Error ? error.message : '未知错误'}`
      )
    }
  }

  async executeMultiple(
    toolCalls: ToolCall[],
    context: ToolContext
  ): Promise<ToolCall[]> {
    const results: ToolCall[] = []

    for (const toolCall of toolCalls) {
      try {
        const result = await this.execute(toolCall.tool, toolCall.parameters, context)
        results.push({
          ...toolCall,
          result,
        })
      } catch (error) {
        results.push({
          ...toolCall,
          error: error instanceof Error ? error.message : '执行失败',
        })
      }
    }

    return results
  }
}

/**
 * 思考流程管理器
 */
class ThoughtProcessManager {
  private steps: ThoughtStep[] = []
  private sessionId: string

  constructor(sessionId: string) {
    this.sessionId = sessionId
  }

  addObservation(content: string): ThoughtStep {
    const step: ThoughtStep = {
      id: this.generateId(),
      type: 'observation',
      content,
      timestamp: Date.now(),
    }
    this.steps.push(step)
    return step
  }

  addThought(content: string): ThoughtStep {
    const step: ThoughtStep = {
      id: this.generateId(),
      type: 'thought',
      content,
      timestamp: Date.now(),
    }
    this.steps.push(step)
    return step
  }

  addAction(content: string, toolCall: ToolCall): ThoughtStep {
    const step: ThoughtStep = {
      id: this.generateId(),
      type: 'action',
      content,
      timestamp: Date.now(),
      toolCall,
    }
    this.steps.push(step)
    return step
  }

  addResult(content: string, toolCall?: ToolCall): ThoughtStep {
    const step: ThoughtStep = {
      id: this.generateId(),
      type: 'result',
      content,
      timestamp: Date.now(),
      toolCall,
    }
    this.steps.push(step)
    return step
  }

  getSteps(): ThoughtStep[] {
    return [...this.steps]
  }

  clear(): void {
    this.steps = []
  }

  private generateId(): string {
    return `step_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  }
}

/**
 * AI 智能体核心类
 */
export class Agent {
  private config: AgentConfig
  private registry: ToolRegistry
  private executor: ToolExecutor
  private sessions: Map<string, AgentSession> = new Map()

  constructor(config: Partial<AgentConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
    this.registry = new ToolRegistry()
    this.executor = new ToolExecutor(this.registry)
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
   * 发送消息并获取响应
   */
  async sendMessage(
    sessionId: string,
    content: string,
    options: {
      enableTools?: boolean
      stream?: boolean
    } = {}
  ): Promise<AgentResponse> {
    const session = this.getOrCreateSession(sessionId)
    const thoughtManager = new ThoughtProcessManager(sessionId)

    // 添加用户消息
    const userMessage: AgentMessage = {
      role: 'user',
      content,
      timestamp: Date.now(),
    }
    session.messages.push(userMessage)

    // 记录观察
    thoughtManager.addObservation(`用户输入: ${content}`)

    // 分析是否需要使用工具
    const toolCalls = options.enableTools !== false
      ? await this.analyzeToolNeeds(content, session)
      : []

    // 执行工具调用
    let toolResults: ToolCall[] = []
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        thoughtManager.addAction(
          `调用工具: ${toolCall.tool}`,
          toolCall
        )
      }

      const context: ToolContext = {
        sessionId,
        messageHistory: session.messages,
      }

      toolResults = await this.executor.executeMultiple(toolCalls, context)

      // 记录工具结果
      for (const result of toolResults) {
        if (result.error) {
          thoughtManager.addResult(
            `工具执行失败: ${result.error}`,
            result
          )
        } else {
          thoughtManager.addResult(
            `工具执行成功: ${JSON.stringify(result.result).substring(0, 200)}...`,
            result
          )
        }
      }
    }

    // 生成响应
    const response = await this.generateResponse(
      session,
      toolResults,
      thoughtManager
    )

    // 更新会话
    session.messages.push({
      role: 'assistant',
      content: response.content,
      toolCalls: toolResults,
      timestamp: Date.now(),
    })
    session.thoughtSteps = thoughtManager.getSteps()
    session.updatedAt = Date.now()

    return {
      content: response.content,
      toolCalls: toolResults,
      thoughtSteps: thoughtManager.getSteps(),
    }
  }

  /**
   * 流式发送消息
   */
  async *sendMessageStream(
    sessionId: string,
    content: string,
    options: {
      enableTools?: boolean
    } = {}
  ): AsyncGenerator<StreamChunk> {
    const session = this.getOrCreateSession(sessionId)
    const thoughtManager = new ThoughtProcessManager(sessionId)

    // 添加用户消息
    session.messages.push({
      role: 'user',
      content,
      timestamp: Date.now(),
    })

    // 发送思考步骤
    yield {
      type: 'thought',
      thoughtStep: thoughtManager.addObservation(`用户输入: ${content}`),
    }

    // 分析工具需求
    const toolCalls = options.enableTools !== false
      ? await this.analyzeToolNeeds(content, session)
      : []

    // 执行工具
    let toolResults: ToolCall[] = []
    if (toolCalls.length > 0) {
      for (const toolCall of toolCalls) {
        yield {
          type: 'thought',
          thoughtStep: thoughtManager.addAction(
            `调用工具: ${toolCall.tool}`,
            toolCall
          ),
        }
      }

      const context: ToolContext = {
        sessionId,
        messageHistory: session.messages,
      }

      toolResults = await this.executor.executeMultiple(toolCalls, context)

      for (const result of toolResults) {
        yield {
          type: 'tool_call',
          toolCall: result,
          thoughtStep: thoughtManager.addResult(
            result.error
              ? `工具执行失败: ${result.error}`
              : `工具执行成功`,
            result
          ),
        }
      }
    }

    // 生成流式响应
    const response = await this.generateResponse(
      session,
      toolResults,
      thoughtManager
    )

    // 模拟流式输出
    const words = response.content.split(' ')
    let currentContent = ''

    for (const word of words) {
      currentContent += word + ' '
      yield {
        type: 'text',
        content: word + ' ',
      }
      // 模拟延迟
      await new Promise((resolve) => setTimeout(resolve, 10))
    }

    // 更新会话
    session.messages.push({
      role: 'assistant',
      content: response.content,
      toolCalls: toolResults,
      timestamp: Date.now(),
    })
    session.thoughtSteps = thoughtManager.getSteps()
    session.updatedAt = Date.now()

    yield { type: 'done' }
  }

  /**
   * 分析是否需要使用工具
   */
  private async analyzeToolNeeds(
    content: string,
    session: AgentSession
  ): Promise<ToolCall[]> {
    const toolCalls: ToolCall[] = []
    const lowerContent = content.toLowerCase()

    // 简单的关键词匹配来决定使用哪些工具
    // 实际应用中应该使用 LLM 来判断

    // 搜索相关
    if (
      lowerContent.includes('搜索') ||
      lowerContent.includes('查找') ||
      lowerContent.includes('最新') ||
      lowerContent.includes('新闻') ||
      lowerContent.includes('查询')
    ) {
      // 提取搜索关键词
      const keywords = this.extractKeywords(content)
      if (keywords) {
        toolCalls.push({
          tool: 'web_search',
          parameters: { query: keywords, numResults: 5 },
        })
      }
    }

    // GitHub 相关
    if (
      lowerContent.includes('github') ||
      lowerContent.includes('开源') ||
      lowerContent.includes('代码库') ||
      lowerContent.includes('仓库')
    ) {
      // 尝试提取仓库信息
      const repoMatch = content.match(/([\w-]+)\/([\w-]+)/)
      if (repoMatch) {
        const [, owner, repo] = repoMatch
        toolCalls.push({
          tool: 'github_get_repo',
          parameters: { owner, repo },
        })
      } else {
        // 搜索仓库
        const keywords = this.extractKeywords(content)
        if (keywords) {
          toolCalls.push({
            tool: 'github_search_repos',
            parameters: { query: keywords, perPage: 5 },
          })
        }
      }
    }

    // 项目生成相关
    if (
      lowerContent.includes('创建项目') ||
      lowerContent.includes('生成项目') ||
      lowerContent.includes('新建项目') ||
      lowerContent.includes('脚手架')
    ) {
      // 分析项目需求
      toolCalls.push({
        tool: 'analyze_project_requirements',
        parameters: { description: content },
      })
    }

    return toolCalls
  }

  /**
   * 生成响应
   */
  private async generateResponse(
    session: AgentSession,
    toolResults: ToolCall[],
    thoughtManager: ThoughtProcessManager
  ): Promise<{ content: string }> {
    // 构建上下文
    const context = this.buildContext(session, toolResults)

    // 添加思考步骤
    thoughtManager.addThought('分析工具结果并生成响应')

    // 这里应该调用实际的 LLM API
    // 简化实现：根据工具结果生成响应
    let response = ''

    if (toolResults.length === 0) {
      // 没有工具调用，直接回答
      response = `我理解了你的问题。${session.messages[session.messages.length - 1]?.content}

作为 AI 助手，我可以帮助你：
- 搜索网络获取最新信息
- 查找 GitHub 上的开源项目
- 生成各种类型的项目脚手架

请问有什么具体需要我帮忙的吗？`
    } else {
      // 根据工具结果生成响应
      const successfulResults = toolResults.filter((r) => !r.error)
      const failedResults = toolResults.filter((r) => r.error)

      if (successfulResults.length > 0) {
        response = '根据查询结果，我为你找到了以下信息：\n\n'

        for (const result of successfulResults) {
          if (result.tool === 'web_search' && result.result) {
            const searchResults = result.result.results || []
            response += '**搜索结果：**\n'
            for (const item of searchResults.slice(0, 3)) {
              response += `- ${item.title}: ${item.snippet}\n`
            }
            response += '\n'
          } else if (result.tool.startsWith('github_') && result.result) {
            if (result.result.repositories) {
              response += '**GitHub 仓库：**\n'
              for (const repo of result.result.repositories.slice(0, 3)) {
                response += `- ${repo.fullName}: ${repo.description} (⭐ ${repo.stars})\n`
              }
            } else if (result.result.fullName) {
              response += `**仓库信息：**\n- ${result.result.fullName}: ${result.result.description}\n- ⭐ ${result.result.stars} | 🍴 ${result.result.forks}\n`
            }
            response += '\n'
          } else if (result.tool === 'analyze_project_requirements' && result.result) {
            const analysis = result.result.analysis
            response += `**项目分析：**\n- 推荐类型: ${analysis.recommendedType}\n- 推荐特性: ${analysis.recommendedFeatures.join(', ') || '基础功能'}\n- 置信度: ${analysis.confidence}\n\n${result.result.suggestion}\n\n`
          }
        }
      }

      if (failedResults.length > 0) {
        response += '\n**注意：** 部分工具执行失败，可能会影响回答的完整性。\n'
      }
    }

    return { content: response }
  }

  /**
   * 构建上下文
   */
  private buildContext(
    session: AgentSession,
    toolResults: ToolCall[]
  ): string {
    const recentMessages = session.messages.slice(-5)
    let context = '最近对话:\n'

    for (const msg of recentMessages) {
      context += `${msg.role}: ${msg.content}\n`
    }

    if (toolResults.length > 0) {
      context += '\n工具执行结果:\n'
      for (const result of toolResults) {
        if (result.result) {
          context += `${result.tool}: ${JSON.stringify(result.result).substring(0, 500)}\n`
        }
      }
    }

    return context
  }

  /**
   * 提取关键词
   */
  private extractKeywords(content: string): string {
    // 简单的关键词提取
    // 移除常见的疑问词和助词
    const stopWords = [
      '请', '帮我', '给我', '我想', '需要', '想要', '知道', '了解',
      '搜索', '查找', '查询', '最新', '关于', '一下', '什么', '怎么',
      '如何', '为什么', '吗', '呢', '吧', '啊',
    ]

    let keywords = content
    for (const word of stopWords) {
      keywords = keywords.replace(new RegExp(word, 'g'), '')
    }

    return keywords.trim() || content
  }

  /**
   * 获取可用工具列表
   */
  getAvailableTools(): Tool[] {
    return this.registry.getEnabled(this.config.enabledTools)
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
