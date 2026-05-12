/**
 * Hermes 扩展模块入口
 * 统一导出记忆系统、技能系统和子代理系统的公共 API
 */

// 记忆系统
export type { Memory, MemoryType, MemoryStore, MemorySearchResult, MemoryExtractionResult } from '../memory/types'
export { memoryStore, useMemoryStore } from '../memory/store'
export { extractMemoriesFromConversation } from '../memory/extractor'
export { buildMemoryPrompt, selectRelevantMemories } from '../memory/injector'

// 技能系统
export type { Skill, SkillStore, SkillCreationResult, SkillMatchResult } from '../skills/types'
export { skillsStore } from '../skills/store'
export { createSkillFromConversation } from '../skills/creator'
export { improveSkill } from '../skills/improver'

// 子代理系统
export type { SubagentTask, SubagentStatus, SubagentConfig, SubagentExecutionParams } from '../subagent/types'
export { subagentManager } from '../subagent/manager'
export { planSubtasks } from '../subagent/planner'

// 集成层
export {
  buildHermesEnhancedPrompt,
  maybePlanSubtasks,
  collectSubagentResults,
  getSubagentTasksSummary,
} from './integration'
