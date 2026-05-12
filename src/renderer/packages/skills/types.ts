/**
 * 技能系统类型定义
 * 定义技能（Skill）的数据结构及相关操作结果类型
 */

/** 技能：从对话中提取的可复用模式 */
export interface Skill {
  /** 技能唯一标识 */
  id: string
  /** 技能名称 */
  name: string
  /** 技能描述 */
  description: string
  /** 触发条件关键词列表 */
  triggerConditions: string[]
  /** 提示词模板 */
  promptTemplate: string
  /** 需要的工具列表 */
  toolSequence: string[]
  /** 成功使用次数 */
  successCount: number
  /** 失败使用次数 */
  failureCount: number
  /** 来源会话 ID */
  sourceSessionId?: string
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
  /** 最后使用时间戳 */
  lastUsedAt?: number
  /** 技能版本，每次改进递增 */
  version: number
}

/** 技能持久化存储结构 */
export interface SkillStore {
  /** 技能列表 */
  skills: Skill[]
  /** 存储版本号 */
  version: number
}

/** 技能创建结果 */
export interface SkillCreationResult {
  /** 创建的技能 */
  skill: Skill
  /** AI 对此技能可复用性的信心分数（0-1） */
  confidence: number
}

/** 技能匹配结果 */
export interface SkillMatchResult {
  /** 匹配的技能 */
  skill: Skill
  /** 匹配分数 */
  matchScore: number
  /** 命中的触发条件列表 */
  matchedConditions: string[]
}
