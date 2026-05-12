// 记忆类型：fact（事实）、preference（偏好）、context（上下文）
export type MemoryType = 'fact' | 'preference' | 'context'

export interface Memory {
  /** 唯一标识 */
  id: string
  /** 记忆类型 */
  type: MemoryType
  /** 记忆内容 */
  content: string
  /** 标签列表 */
  tags: string[]
  /** 来源会话 ID */
  sourceSessionId?: string
  /** 创建时间戳 */
  createdAt: number
  /** 更新时间戳 */
  updatedAt: number
  /** 访问次数 */
  accessCount: number
  /** 最后访问时间戳 */
  lastAccessedAt: number
}

export interface MemoryStore {
  memories: Memory[]
  version: number
}

export interface MemorySearchResult {
  memory: Memory
  relevanceScore: number
}

export interface MemoryExtractionResult {
  memories: Array<{
    type: MemoryType
    content: string
    tags: string[]
  }>
}
