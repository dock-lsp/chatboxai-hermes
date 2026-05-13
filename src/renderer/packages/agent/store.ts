import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type {
  AgentSession,
  AgentMessage,
  ThoughtStep,
  AgentConfig,
  ToolCall,
} from './types'
import { Agent, createAgent } from './agent'

/**
 * 会话状态
 */
interface SessionState {
  sessions: AgentSession[]
  currentSessionId: string | null
  isLoading: boolean
  error: string | null
}

/**
 * 智能体状态
 */
interface AgentState extends SessionState {
  // 配置
  config: AgentConfig

  // Agent 实例
  agent: Agent

  // 会话操作
  createSession: () => string
  selectSession: (sessionId: string) => void
  deleteSession: (sessionId: string) => void
  clearAllSessions: () => void

  // 消息操作
  sendMessage: (content: string) => Promise<void>
  sendMessageStream: (content: string) => AsyncGenerator<
    { type: 'text'; content: string } |
    { type: 'thought'; step: ThoughtStep } |
    { type: 'tool'; call: ToolCall } |
    { type: 'error'; error: string } |
    { type: 'done' }
  >
  clearMessages: (sessionId?: string) => void

  // 思考步骤操作
  getThoughtSteps: (sessionId?: string) => ThoughtStep[]

  // 配置操作
  updateConfig: (config: Partial<AgentConfig>) => void
  resetConfig: () => void

  // 工具操作
  toggleTool: (toolName: string) => void
  enableTool: (toolName: string) => void
  disableTool: (toolName: string) => void

  // 加载状态
  setLoading: (loading: boolean) => void
  setError: (error: string | null) => void
}

/**
 * 默认配置
 */
const DEFAULT_AGENT_CONFIG: AgentConfig = {
  model: 'gpt-4',
  temperature: 0.7,
  maxTokens: 4000,
  systemPrompt: `你是一个智能 AI 助手，可以帮助用户完成各种任务。

你可以使用以下工具：
- 网络搜索：获取最新信息
- GitHub：查找开源项目和代码
- 项目生成器：创建项目脚手架

请保持友好、专业的态度，提供准确、有用的信息。`,
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
 * 创建 Zustand Store
 */
export const useAgentStore = create<AgentState>()(
  persist(
    (set, get, api) => ({
      // 初始状态
      sessions: [],
      currentSessionId: null,
      isLoading: false,
      error: null,
      config: DEFAULT_AGENT_CONFIG,
      agent: createAgent(DEFAULT_AGENT_CONFIG),

      // ========== 会话操作 ==========

      /**
       * 创建新会话
       */
      createSession: () => {
        const state = get()
        const session = state.agent.createSession()

        set((state) => ({
          sessions: [...state.sessions, session],
          currentSessionId: session.id,
        }))

        return session.id
      },

      /**
       * 选择会话
       */
      selectSession: (sessionId: string) => {
        const state = get()
        const session = state.agent.getSession(sessionId)

        if (session) {
          set({ currentSessionId: sessionId })
        } else {
          // 如果会话不存在，创建新会话
          const newSession = state.agent.createSession(sessionId)
          set((state) => ({
            sessions: [...state.sessions, newSession],
            currentSessionId: sessionId,
          }))
        }
      },

      /**
       * 删除会话
       */
      deleteSession: (sessionId: string) => {
        const state = get()
        state.agent.deleteSession(sessionId)

        set((state) => {
          const newSessions = state.sessions.filter((s) => s.id !== sessionId)
          const newCurrentId =
            state.currentSessionId === sessionId
              ? newSessions[0]?.id || null
              : state.currentSessionId

          return {
            sessions: newSessions,
            currentSessionId: newCurrentId,
          }
        })
      },

      /**
       * 清除所有会话
       */
      clearAllSessions: () => {
        const state = get()
        // 删除所有会话
        for (const session of state.sessions) {
          state.agent.deleteSession(session.id)
        }

        set({
          sessions: [],
          currentSessionId: null,
        })
      },

      // ========== 消息操作 ==========

      /**
       * 发送消息
       */
      sendMessage: async (content: string) => {
        const state = get()

        // 确保有当前会话
        let sessionId = state.currentSessionId
        if (!sessionId) {
          sessionId = get().createSession()
        }

        set({ isLoading: true, error: null })

        try {
          const response = await state.agent.sendMessage(sessionId, content, {
            enableTools: true,
          })

          // 更新会话状态
          const updatedSession = state.agent.getSession(sessionId)
          if (updatedSession) {
            set((state) => ({
              sessions: state.sessions.map((s) =>
                s.id === sessionId ? updatedSession : s
              ),
            }))
          }
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : '发送消息失败',
          })
        } finally {
          set({ isLoading: false })
        }
      },

      /**
       * 流式发送消息
       */
      sendMessageStream: async function* (content: string) {
        const state = get()

        // 确保有当前会话
        let sessionId = state.currentSessionId
        if (!sessionId) {
          sessionId = get().createSession()
        }

        set({ isLoading: true, error: null })

        try {
          const stream = state.agent.sendMessageStream(sessionId, content, {
            enableTools: true,
          })

          let fullContent = ''

          for await (const chunk of stream) {
            switch (chunk.type) {
              case 'text':
                fullContent += chunk.content || ''
                yield { type: 'text' as const, content: chunk.content || '' }
                break

              case 'thought':
                if (chunk.thoughtStep) {
                  yield { type: 'thought' as const, step: chunk.thoughtStep }
                }
                break

              case 'tool_call':
                if (chunk.toolCall) {
                  yield { type: 'tool' as const, call: chunk.toolCall }
                }
                break

              case 'error':
                yield { type: 'error' as const, error: chunk.error || '未知错误' }
                break

              case 'done':
                // 更新会话状态
                const updatedSession = state.agent.getSession(sessionId!)
                if (updatedSession) {
                  set((state) => ({
                    sessions: state.sessions.map((s) =>
                      s.id === sessionId ? updatedSession : s
                    ),
                  }))
                }
                yield { type: 'done' as const }
                break
            }
          }
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : '流式发送失败'
          set({ error: errorMsg })
          yield { type: 'error' as const, error: errorMsg }
        } finally {
          set({ isLoading: false })
        }
      },

      /**
       * 清除消息
       */
      clearMessages: (sessionId?: string) => {
        const state = get()
        const targetId = sessionId || state.currentSessionId

        if (!targetId) return

        // 删除并重新创建会话
        state.agent.deleteSession(targetId)
        const newSession = state.agent.createSession(targetId)

        set((state) => ({
          sessions: state.sessions.map((s) =>
            s.id === targetId ? newSession : s
          ),
        }))
      },

      // ========== 思考步骤操作 ==========

      /**
       * 获取思考步骤
       */
      getThoughtSteps: (sessionId?: string) => {
        const state = get()
        const targetId = sessionId || state.currentSessionId

        if (!targetId) return []

        const session = state.agent.getSession(targetId)
        return session?.thoughtSteps || []
      },

      // ========== 配置操作 ==========

      /**
       * 更新配置
       */
      updateConfig: (config: Partial<AgentConfig>) => {
        set((state) => {
          const newConfig = { ...state.config, ...config }
          // 更新 Agent 实例的配置
          state.agent.updateConfig(newConfig)
          return { config: newConfig }
        })
      },

      /**
       * 重置配置
       */
      resetConfig: () => {
        set((state) => {
          state.agent.updateConfig(DEFAULT_AGENT_CONFIG)
          return { config: DEFAULT_AGENT_CONFIG }
        })
      },

      // ========== 工具操作 ==========

      /**
       * 切换工具启用状态
       */
      toggleTool: (toolName: string) => {
        set((state) => {
          const enabledTools = state.config.enabledTools
          const newEnabledTools = enabledTools.includes(toolName)
            ? enabledTools.filter((t) => t !== toolName)
            : [...enabledTools, toolName]

          const newConfig = { ...state.config, enabledTools: newEnabledTools }
          state.agent.updateConfig(newConfig)

          return { config: newConfig }
        })
      },

      /**
       * 启用工具
       */
      enableTool: (toolName: string) => {
        set((state) => {
          if (state.config.enabledTools.includes(toolName)) {
            return state
          }

          const newConfig = {
            ...state.config,
            enabledTools: [...state.config.enabledTools, toolName],
          }
          state.agent.updateConfig(newConfig)

          return { config: newConfig }
        })
      },

      /**
       * 禁用工具
       */
      disableTool: (toolName: string) => {
        set((state) => {
          const newConfig = {
            ...state.config,
            enabledTools: state.config.enabledTools.filter((t) => t !== toolName),
          }
          state.agent.updateConfig(newConfig)

          return { config: newConfig }
        })
      },

      // ========== 加载状态 ==========

      setLoading: (loading: boolean) => set({ isLoading: loading }),
      setError: (error: string | null) => set({ error }),
    }),
    {
      name: 'agent-store',
      storage: createJSONStorage(() => localStorage),
      // 只持久化配置和会话列表，不持久化 Agent 实例
      partialize: (state) => ({
        config: state.config,
        sessions: state.sessions.map((s) => ({
          ...s,
          // 不存储过长的消息历史
          messages: s.messages.slice(-50),
        })),
        currentSessionId: state.currentSessionId,
      }),
      // 恢复时重新创建 Agent 实例
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.agent = createAgent(state.config)
        }
      },
    }
  )
)

/**
 * 选择器 Hook - 获取当前会话
 */
export function useCurrentSession(): AgentSession | null {
  const currentSessionId = useAgentStore((state) => state.currentSessionId)
  const sessions = useAgentStore((state) => state.sessions)

  return sessions.find((s) => s.id === currentSessionId) || null
}

/**
 * 选择器 Hook - 获取当前会话的消息
 */
export function useCurrentMessages(): AgentMessage[] {
  const session = useCurrentSession()
  return session?.messages || []
}

/**
 * 选择器 Hook - 获取当前会话的思考步骤
 */
export function useCurrentThoughtSteps(): ThoughtStep[] {
  const session = useCurrentSession()
  return session?.thoughtSteps || []
}

/**
 * 选择器 Hook - 获取启用的工具列表
 */
export function useEnabledTools(): string[] {
  return useAgentStore((state) => state.config.enabledTools)
}

/**
 * 选择器 Hook - 检查工具是否启用
 */
export function useIsToolEnabled(toolName: string): boolean {
  return useAgentStore((state) => state.config.enabledTools.includes(toolName))
}

// 导出类型
export type { AgentState, SessionState }
