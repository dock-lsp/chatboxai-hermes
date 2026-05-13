/**
 * 技能系统持久化存储
 * 使用 zustand + persist + immer 实现技能的持久化管理
 */

import type { Skill, SkillMatchResult, SkillStore } from './types'
import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getLogger } from '@/lib/utils'
import storage from '@/storage'

const log = getLogger('skills-store')

/** Store 状态类型 */
type SkillsState = SkillStore

/** Store 操作类型 */
type SkillsAction = {
  /** 添加新技能 */
  addSkill: (skill: Skill) => void
  /** 更新技能（全量替换） */
  updateSkill: (id: string, updates: Partial<Skill>) => void
  /** 删除技能 */
  deleteSkill: (id: string) => void
  /** 递增使用计数（成功或失败） */
  incrementUsage: (id: string, success: boolean) => void
  /** 根据 ID 获取技能 */
  getSkillById: (id: string) => Skill | undefined
  /** 搜索技能（按名称或描述模糊匹配） */
  searchSkills: (query: string) => Skill[]
  /** 根据用户输入匹配触发条件，返回按匹配分数排序的结果 */
  matchSkills: (input: string) => SkillMatchResult[]
  /** 批量导入技能 */
  importSkills: (skills: Skill[]) => void
  /** 导出所有技能 */
  exportSkills: () => Skill[]
}

export type SkillsStore = SkillsState & SkillsAction

/**
 * 计算用户输入与触发条件的匹配分数
 * 使用简单的关键词匹配算法，返回匹配分数和命中的条件列表
 */
function calculateMatchScore(input: string, triggerConditions: string[]): { score: number; matched: string[] } {
  const normalizedInput = input.toLowerCase()
  const matched: string[] = []

  for (const condition of triggerConditions) {
    const normalizedCondition = condition.toLowerCase()
    if (normalizedInput.includes(normalizedCondition)) {
      matched.push(condition)
    }
  }

  // 匹配分数 = 命中条件数 / 总条件数，加权命中条件的长度占比
  if (matched.length === 0) {
    return { score: 0, matched: [] }
  }

  const conditionCoverage = matched.length / triggerConditions.length
  const totalMatchedLength = matched.reduce((sum, c) => sum + c.length, 0)
  const totalConditionLength = triggerConditions.reduce((sum, c) => sum + c.length, 0)
  const lengthCoverage = totalMatchedLength / totalConditionLength

  // 综合分数：条件覆盖率占 60%，长度覆盖率占 40%
  const score = conditionCoverage * 0.6 + lengthCoverage * 0.4

  return { score, matched }
}

export const skillsStore = create<SkillsStore>(
  persist(
    immer((set, get) => ({
      skills: [],
      version: 1,

      addSkill: (skill: Skill) => {
        set((state) => {
          state.skills.push(skill)
        })
        log.info('添加技能:', skill.name)
      },

      updateSkill: (id: string, updates: Partial<Skill>) => {
        set((state) => {
          const index = state.skills.findIndex((s) => s.id === id)
          if (index !== -1) {
            Object.assign(state.skills[index], updates, { updatedAt: Date.now() })
          }
        })
        log.info('更新技能:', id)
      },

      deleteSkill: (id: string) => {
        set((state) => {
          state.skills = state.skills.filter((s) => s.id !== id)
        })
        log.info('删除技能:', id)
      },

      incrementUsage: (id: string, success: boolean) => {
        set((state) => {
          const skill = state.skills.find((s) => s.id === id)
          if (skill) {
            if (success) {
              skill.successCount += 1
            } else {
              skill.failureCount += 1
            }
            skill.lastUsedAt = Date.now()
            skill.updatedAt = Date.now()
          }
        })
        log.info('递增技能使用计数:', id, success ? '成功' : '失败')
      },

      getSkillById: (id: string) => {
        return get().skills.find((s) => s.id === id)
      },

      searchSkills: (query: string) => {
        const normalizedQuery = query.toLowerCase()
        return get().skills.filter(
          (skill) =>
            skill.name.toLowerCase().includes(normalizedQuery) ||
            skill.description.toLowerCase().includes(normalizedQuery),
        )
      },

      matchSkills: (input: string) => {
        const results: SkillMatchResult[] = []

        for (const skill of get().skills) {
          const { score, matched } = calculateMatchScore(input, skill.triggerConditions)
          if (score > 0) {
            results.push({
              skill,
              matchScore: score,
              matchedConditions: matched,
            })
          }
        }

        // 按匹配分数降序排序
        results.sort((a, b) => b.matchScore - a.matchScore)
        return results
      },

      importSkills: (skills: Skill[]) => {
        set((state) => {
          // 使用 ID 去重，已存在的技能跳过
          const existingIds = new Set(state.skills.map((s) => s.id))
          for (const skill of skills) {
            if (!existingIds.has(skill.id)) {
              state.skills.push(skill)
              existingIds.add(skill.id)
            }
          }
        })
        log.info('导入技能:', skills.length, '个')
      },

      exportSkills: () => {
        return get().skills
      },
    })),
    {
      name: 'hermes-skills',
      storage: createJSONStorage(() => ({
        getItem: async (key) => {
          const res = await storage.getItem<SkillStore | null>(key, null)
          if (res) {
            return JSON.stringify({
              state: res,
              version: res.version,
            })
          }
          return null
        },
        setItem: async (name, value) => {
          const parsed = JSON.parse(value) as { state: SkillStore; version?: number }
          await storage.setItem(name, parsed.state)
        },
        removeItem: async (name) => await storage.removeItem(name),
      })),
      version: 1,
      partialize: (state) => {
        return {
          skills: state.skills,
          version: state.version,
        }
      },
    },
  ),
)
