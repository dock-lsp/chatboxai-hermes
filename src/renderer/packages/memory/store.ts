import { v4 as uuidv4 } from 'uuid'
import { createStore, useStore } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'
import { immer } from 'zustand/middleware/immer'
import { getLogger } from '@/lib/utils'
import storage from '@/storage'
import type { Memory, MemorySearchResult, MemoryStore } from './types'

const log = getLogger('memory-store')

/** 记忆存储状态 */
interface MemoryState extends MemoryStore {
  /** 添加一条记忆 */
  addMemory: (memory: Omit<Memory, 'id' | 'createdAt' | 'updatedAt' | 'accessCount' | 'lastAccessedAt'>) => string
  /** 更新一条记忆 */
  updateMemory: (id: string, updates: Partial<Pick<Memory, 'type' | 'content' | 'tags'>>) => void
  /** 删除一条记忆 */
  deleteMemory: (id: string) => void
  /** 搜索记忆（基于内容和标签的简单匹配） */
  searchMemories: (query: string) => MemorySearchResult[]
  /** 增加记忆的访问计数 */
  incrementAccessCount: (id: string) => void
  /** 清空所有记忆 */
  clearAllMemories: () => void
  /** 导入记忆列表 */
  importMemories: (memories: Memory[]) => void
  /** 导出所有记忆 */
  exportMemories: () => Memory[]
}

/** 计算搜索相关度分数 */
function computeRelevanceScore(memory: Memory, query: string): number {
  const lowerQuery = query.toLowerCase()
  let score = 0

  // 内容匹配得分（权重更高）
  if (memory.content.toLowerCase().includes(lowerQuery)) {
    score += 10
  }

  // 标签匹配得分
  for (const tag of memory.tags) {
    if (tag.toLowerCase().includes(lowerQuery)) {
      score += 5
    }
  }

  // 访问频率加权
  score += memory.accessCount * 0.1

  // 时间衰减加权（最近访问的得分更高）
  const now = Date.now()
  const timeSinceLastAccess = now - memory.lastAccessedAt
  const decayFactor = Math.max(0, 1 - timeSinceLastAccess / (30 * 24 * 60 * 60 * 1000)) // 30天衰减周期
  score += decayFactor * 2

  return score
}

export const memoryStore = createStore<MemoryState>()(
  persist(
    immer((set, get) => ({
      memories: [],
      version: 1,

      addMemory: (memoryData) => {
        const id = uuidv4()
        const now = Date.now()
        set((state) => {
          state.memories.push({
            ...memoryData,
            id,
            createdAt: now,
            updatedAt: now,
            accessCount: 0,
            lastAccessedAt: now,
          })
        })
        log.info(`添加记忆: ${id}`)
        return id
      },

      updateMemory: (id, updates) => {
        set((state) => {
          const index = state.memories.findIndex((m) => m.id === id)
          if (index !== -1) {
            const memory = state.memories[index]
            if (updates.type !== undefined) memory.type = updates.type
            if (updates.content !== undefined) memory.content = updates.content
            if (updates.tags !== undefined) memory.tags = updates.tags
            memory.updatedAt = Date.now()
            log.info(`更新记忆: ${id}`)
          }
        })
      },

      deleteMemory: (id) => {
        set((state) => {
          const index = state.memories.findIndex((m) => m.id === id)
          if (index !== -1) {
            state.memories.splice(index, 1)
            log.info(`删除记忆: ${id}`)
          }
        })
      },

      searchMemories: (query) => {
        const { memories } = get()
        if (!query.trim()) {
          return []
        }

        const results: MemorySearchResult[] = memories
          .map((memory) => ({
            memory,
            relevanceScore: computeRelevanceScore(memory, query),
          }))
          .filter((result) => result.relevanceScore > 0)

        // 按相关度分数降序排列，分数相同时按访问次数和最后访问时间排序
        results.sort((a, b) => {
          if (b.relevanceScore !== a.relevanceScore) {
            return b.relevanceScore - a.relevanceScore
          }
          if (b.memory.accessCount !== a.memory.accessCount) {
            return b.memory.accessCount - a.memory.accessCount
          }
          return b.memory.lastAccessedAt - a.memory.lastAccessedAt
        })

        return results
      },

      incrementAccessCount: (id) => {
        set((state) => {
          const memory = state.memories.find((m) => m.id === id)
          if (memory) {
            memory.accessCount += 1
            memory.lastAccessedAt = Date.now()
          }
        })
      },

      clearAllMemories: () => {
        set((state) => {
          state.memories = []
          log.info('已清空所有记忆')
        })
      },

      importMemories: (importedMemories) => {
        set((state) => {
          // 使用 id 去重，已有则更新，没有则添加
          const existingIds = new Set(state.memories.map((m) => m.id))
          for (const memory of importedMemories) {
            const existingIndex = state.memories.findIndex((m) => m.id === memory.id)
            if (existingIndex !== -1) {
              // 更新已有记忆
              state.memories[existingIndex] = memory
            } else if (!existingIds.has(memory.id)) {
              // 添加新记忆
              state.memories.push(memory)
            }
          }
          log.info(`导入记忆: ${importedMemories.length} 条`)
        })
      },

      exportMemories: () => {
        const { memories } = get()
        log.info(`导出记忆: ${memories.length} 条`)
        return [...memories]
      },
    })),
    {
      name: 'hermes-memory',
      storage: createJSONStorage(() => ({
        getItem: async (key) => {
          const res = await storage.getItem<MemoryStore | null>(key, null)
          if (res) {
            return JSON.stringify({
              state: res,
              version: res.version,
            })
          }
          return null
        },
        setItem: async (name, value) => {
          const parsed = JSON.parse(value) as { state: MemoryStore; version?: number }
          await storage.setItem(name, parsed.state)
        },
        removeItem: async (name) => await storage.removeItem(name),
      })),
      version: 1,
      skipHydration: true,
    }
  )
)

/** 初始化记忆存储 */
let _initMemoryStorePromise: Promise<MemoryStore> | undefined
export const initMemoryStore = async () => {
  if (!_initMemoryStorePromise) {
    _initMemoryStorePromise = new Promise<MemoryStore>((resolve) => {
      const unsub = memoryStore.persist.onFinishHydration((val) => {
        unsub()
        resolve(val)
      })
      memoryStore.persist.rehydrate()
    })
  }
  return await _initMemoryStorePromise
}

/** React hook：使用记忆存储 */
export function useMemoryStore<U>(selector: Parameters<typeof useStore<typeof memoryStore, U>>[1]) {
  return useStore<typeof memoryStore, U>(memoryStore, selector)
}
