// ==================== 类型导出 ====================
export type {
  // 核心类型
  Tool,
  ToolParameter,
  ToolCall,
  ThoughtStep,
  AgentSession,
  AgentMessage,
  AgentConfig,
  ToolContext,
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

  // 文件上传类型
  UploadedFile,
  ZipContent,
} from './types'

// ==================== 智能体核心导出 ====================
export {
  Agent,
  createAgent,
  defaultAgent,
} from './agent'

export type { AgentConfig as AgentConfiguration, AgentResponse as AgentResult } from './agent'

// ==================== 状态管理导出 ====================
export {
  useAgentStore,
  useCurrentSession,
  useCurrentMessages,
  useCurrentThoughtSteps,
  useEnabledTools,
  useIsToolEnabled,
} from './store'

export type { AgentState, SessionState } from './store'

// ==================== 工具导出 ====================

// 网络搜索工具
export {
  webSearchTool,
  fetchWebPageTool,
  searchAndSummarizeTool,
  searchTools,
} from './tools/web-search'

// GitHub 工具
export {
  searchGitHubReposTool,
  getGitHubFileTool,
  getGitHubRepoTool,
  listGitHubDirTool,
  getGitHubReadmeTool,
  createGitHubIssueTool,
  searchGitHubCodeTool,
  cloneGitHubRepoTool,
  githubTools,
  // 新增 GitHub 工具
  setGitHubTokenTool,
  getGitHubTokenStatusTool,
  createGitHubRepoTool,
  pushToGitHubTool,
  generateGitCommandsTool,
  // Token 管理函数
  setGitHubToken,
  getGitHubToken,
  hasGitHubToken,
  // 底层 API
  searchRepositories,
  getFileContent,
  getRepository,
  listDirectory,
  getReadme,
  createIssue,
  searchCode,
} from './tools/github'

// Git 执行器
export {
  executeGitClone,
  checkGitInstalled,
  getDefaultCloneDir,
  ensureDir,
} from './tools/git-executor'

// 项目生成器工具
export {
  projectGeneratorTool,
  getProjectFileTool,
  analyzeProjectRequirementsTool,
  projectGeneratorTools,
  // 模板生成函数
  createReactTemplate,
  createVueTemplate,
  createPythonTemplate,
  createNodeJSTemplate,
  createGenericTemplate,
  generateProject,
  generateASCIITree,
  // 分析函数
  analyzeProjectRequirements,
} from './tools/project-generator'

// CI/CD Builder 工具
export {
  generateGitHubActionsTool,
  generateDockerfileTool,
  generateDockerComposeTool,
  generateDockerignoreTool,
  generateGitignoreTool,
  cicdBuilderTools,
} from './tools/cicd-builder'

// 文件上传工具
export {
  processUploadedFile,
  readFileAsBase64,
  readTextFile,
  isImageFile,
  isZipFile,
  formatFileSize,
  analyzeFileForAI,
  getFileIconType,
  validateFileSize,
  type UploadedFile as FileUploaderUploadedFile,
  type ZipContent as FileUploaderZipContent,
} from './tools/file-uploader'

// ==================== 工具集合 ====================
import { searchTools } from './tools/web-search'
import { githubTools } from './tools/github'
import { projectGeneratorTools } from './tools/project-generator'
import { cicdBuilderTools } from './tools/cicd-builder'
import type { Tool } from './types'

/**
 * 所有可用工具
 */
export const allTools: Tool[] = [
  ...searchTools,
  ...githubTools,
  ...projectGeneratorTools,
  ...cicdBuilderTools,
]

/**
 * 工具名称到工具的映射
 */
export const toolMap: Record<string, Tool> = allTools.reduce((map, tool) => {
  map[tool.name] = tool
  return map
}, {} as Record<string, Tool>)

/**
 * 按类别分组的工具
 */
export const toolsByCategory = {
  search: searchTools,
  github: githubTools,
  projectGenerator: projectGeneratorTools,
  cicdBuilder: cicdBuilderTools,
} as const

// ==================== 工具函数 ====================

/**
 * 根据名称获取工具
 */
export function getToolByName(name: string): Tool | undefined {
  return toolMap[name]
}

/**
 * 获取工具的描述信息
 */
export function getToolDescriptions(): Array<{
  name: string
  description: string
  parameters: string[]
}> {
  return allTools.map((tool) => ({
    name: tool.name,
    description: tool.description,
    parameters: tool.parameters.map((p) => `${p.name}${p.required ? '*' : ''}`),
  }))
}

/**
 * 验证工具参数
 */
export function validateToolParameters(
  toolName: string,
  parameters: Record<string, any>
): { valid: boolean; missing: string[] } {
  const tool = getToolByName(toolName)

  if (!tool) {
    return { valid: false, missing: ['工具不存在'] }
  }

  const missing = tool.parameters
    .filter((p) => p.required && !(p.name in parameters))
    .map((p) => p.name)

  return {
    valid: missing.length === 0,
    missing,
  }
}

// ==================== 常量 ====================

/**
 * 默认系统提示词
 */
export const DEFAULT_SYSTEM_PROMPT = `你是一个智能 AI 助手，可以帮助用户完成各种任务。

你可以使用以下工具：

## 网络搜索
- web_search: 搜索互联网获取最新信息
- fetch_webpage: 获取特定网页的内容

## GitHub 工具
- github_set_token: 设置 GitHub Token
- github_token_status: 检查 Token 状态
- github_search_repos: 搜索 GitHub 仓库
- github_get_file: 获取仓库文件内容
- github_create_repo: 创建新仓库
- github_push_files: 推送文件到仓库
- github_push_multiple_files: 批量推送文件
- github_generate_commands: 生成 Git 命令

## 项目生成
- generate_project: 根据配置生成项目脚手架
- analyze_project_requirements: 分析项目需求

## CI/CD Builder
- cicd_github_actions: 生成 GitHub Actions 工作流
- cicd_dockerfile: 生成 Dockerfile
- cicd_docker_compose: 生成 docker-compose.yml
- cicd_dockerignore: 生成 .dockerignore
- cicd_gitignore: 生成 .gitignore

请遵循以下原则：
1. 理解用户需求，选择最合适的工具
2. 使用工具获取信息后，给出清晰、准确的回答
3. 如果工具执行失败，告知用户并提供替代方案
4. 保持友好、专业的态度`

/**
 * 支持的模型列表
 */
export const SUPPORTED_MODELS = [
  { id: 'gpt-4', name: 'GPT-4', provider: 'openai' },
  { id: 'gpt-4-turbo', name: 'GPT-4 Turbo', provider: 'openai' },
  { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo', provider: 'openai' },
  { id: 'claude-3-opus', name: 'Claude 3 Opus', provider: 'anthropic' },
  { id: 'claude-3-sonnet', name: 'Claude 3 Sonnet', provider: 'anthropic' },
  { id: 'claude-3-haiku', name: 'Claude 3 Haiku', provider: 'anthropic' },
] as const

/**
 * 项目类型列表
 */
export const PROJECT_TYPES = [
  { id: 'react', name: 'React', icon: 'react' },
  { id: 'vue', name: 'Vue', icon: 'vue' },
  { id: 'python', name: 'Python', icon: 'python' },
  { id: 'nodejs', name: 'Node.js', icon: 'nodejs' },
  { id: 'flutter', name: 'Flutter', icon: 'flutter' },
  { id: 'android', name: 'Android', icon: 'android' },
  { id: 'generic', name: 'Generic', icon: 'folder' },
] as const

// ==================== 版本信息 ====================
export const VERSION = '1.0.0'
export const AGENT_NAME = 'ChatboxAI Agent'

// ==================== 默认导出 ====================
export { Agent as default } from './agent'
