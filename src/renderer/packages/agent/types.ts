/** 工具定义接口 */
export interface Tool {
  name: string
  description: string
  parameters: ToolParameter[]
  execute: (args: any) => Promise<any>
}

/** 工具参数 */
export interface ToolParameter {
  name: string
  type: 'string' | 'number' | 'boolean' | 'array' | 'object'
  description: string
  required: boolean
  enum?: string[]
}

/** 思考步骤 */
export interface ThoughtStep {
  id: string
  type: 'observation' | 'thought' | 'action' | 'result'
  content: string
  timestamp: number
  toolCall?: ToolCall
}

/** 工具调用 */
export interface ToolCall {
  tool: string
  parameters: Record<string, any>
  result?: any
  error?: string
}

/** 智能体会话 */
export interface AgentSession {
  id: string
  messages: AgentMessage[]
  thoughtSteps: ThoughtStep[]
  tools: string[]
  createdAt: number
  updatedAt: number
}

/** 智能体消息 */
export interface AgentMessage {
  role: 'system' | 'user' | 'assistant' | 'tool'
  content: string
  toolCalls?: ToolCall[]
  timestamp: number
}

/** 项目生成配置 */
export interface ProjectGenerationConfig {
  name: string
  type: 'flutter' | 'react' | 'vue' | 'android' | 'python' | 'nodejs' | 'generic'
  description: string
  features: string[]
  outputPath: string
}

/** 生成的文件 */
export interface GeneratedFile {
  path: string
  content: string
  language: string
}

/** 生成的项目 */
export interface GeneratedProject {
  config: ProjectGenerationConfig
  files: GeneratedFile[]
  structure: string // ASCII tree
}

/** 搜索结果 */
export interface SearchResult {
  title: string
  link: string
  snippet: string
  source: string
}

/** GitHub 仓库信息 */
export interface GitHubRepo {
  id: number
  name: string
  fullName: string
  description: string
  url: string
  stars: number
  language: string
  updatedAt: string
}

/** GitHub 文件内容 */
export interface GitHubFile {
  path: string
  content: string
  encoding: string
  size: number
}

/** 智能体配置 */
export interface AgentConfig {
  model: string
  temperature: number
  maxTokens: number
  systemPrompt: string
  enabledTools: string[]
}

/** 工具执行上下文 */
export interface ToolContext {
  sessionId: string
  messageHistory: AgentMessage[]
  abortSignal?: AbortSignal
}

/** 智能体响应 */
export interface AgentResponse {
  content: string
  toolCalls?: ToolCall[]
  thoughtSteps?: ThoughtStep[]
  error?: string
}

/** 流式响应块 */
export interface StreamChunk {
  type: 'text' | 'tool_call' | 'thought' | 'reasoning' | 'error' | 'done'
  content?: string
  toolCall?: ToolCall
  thoughtStep?: ThoughtStep
  error?: string
}
