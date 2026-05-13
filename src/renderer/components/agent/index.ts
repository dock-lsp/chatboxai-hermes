/**
 * Agent Components Index
 * 智能体组件入口文件
 *
 * 导出所有智能体相关的 UI 组件，包括：
 * - AgentChatPanel: 智能体聊天面板
 * - ThoughtProcess: 思考过程可视化
 * - ToolSelector: 工具选择器
 * - ProjectGeneratorPanel: 项目生成器面板
 */

// ==================== 主组件导出 ====================

/**
 * 智能体聊天面板
 * 提供类似聊天界面的交互体验，支持消息输入、AI 回复显示、工具调用可视化等
 */
export { AgentChatPanel } from './AgentChatPanel'
export type { AgentChatPanelProps } from './AgentChatPanel'

/**
 * 思考过程组件
 * 可视化展示 AI 的思考步骤（观察 -> 思考 -> 行动 -> 结果）
 */
export { ThoughtProcess, CompactThoughtProcess, ThoughtStepCard } from './ThoughtProcess'
export type { ThoughtProcessProps, CompactThoughtProcessProps, ThoughtStepCardProps } from './ThoughtProcess'

/**
 * 工具选择器组件
 * 提供工具启用/禁用的管理界面，支持按类别分组显示
 */
export { ToolSelector, CompactToolSelector, ToolBadge, EnabledToolsList } from './ToolSelector'
export type { ToolSelectorProps, CompactToolSelectorProps, ToolBadgeProps } from './ToolSelector'

/**
 * 项目生成器面板
 * 提供项目生成功能的完整界面，支持多种项目类型
 */
export { ProjectGeneratorPanel, CompactProjectGenerator } from './ProjectGeneratorPanel'
export type { ProjectGeneratorPanelProps } from './ProjectGeneratorPanel'

// ==================== 默认导出 ====================

/**
 * 默认导出所有组件
 */
export { default } from './AgentChatPanel'

// ==================== 类型重新导出 ====================

/**
 * 从 @/packages/agent 重新导出相关类型
 * 方便使用者统一从这里导入
 */
export type {
  // 核心类型
  Tool,
  ToolParameter,
  ToolCall,
  ThoughtStep,
  AgentSession,
  AgentMessage,
  AgentConfig,
  AgentResponse,
  StreamChunk,

  // 项目生成类型
  ProjectGenerationConfig,
  GeneratedFile,
  GeneratedProject,

  // 搜索类型
  SearchResult,

  // GitHub 类型
  GitHubRepo,
  GitHubFile,
} from '@/packages/agent'

/**
 * 从 @/packages/agent 重新导出 hooks
 */
export {
  // Store hooks
  useAgentStore,
  useCurrentSession,
  useCurrentMessages,
  useCurrentThoughtSteps,
  useEnabledTools,
  useIsToolEnabled,

  // Agent 实例
  Agent,
  createAgent,
  defaultAgent,

  // 工具
  allTools,
  toolsByCategory,
  getToolByName,
  getToolDescriptions,
  validateToolParameters,

  // 项目生成
  generateProject,
  analyzeProjectRequirements,
  PROJECT_TYPES,

  // 常量
  DEFAULT_SYSTEM_PROMPT,
  SUPPORTED_MODELS,
  VERSION,
  AGENT_NAME,
} from '@/packages/agent'
