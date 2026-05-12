import { getLogger } from '@/lib/utils'
import type { SubagentConfig, SubagentExecutionParams, SubagentStatus, SubagentTask } from './types'
import { executeSubagentTask } from './executor'

/** 默认配置 */
const DEFAULT_CONFIG: SubagentConfig = {
  maxConcurrent: 3,
  timeout: 120000,
  maxTokens: 4096,
}

/** 生成唯一 ID */
function generateTaskId(): string {
  return `subagent_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

/**
 * 子代理管理器（单例模式）
 * 负责子代理任务的创建、调度、执行和生命周期管理
 */
export class SubagentManager {
  private static instance: SubagentManager | null = null

  /** 所有子任务映射 */
  private tasks: Map<string, SubagentTask> = new Map()

  /** 子代理配置 */
  private config: SubagentConfig

  /** 当前活跃任务数 */
  private activeCount: number = 0

  /** 任务完成回调映射（用于 waitForCompletion） */
  private completionResolvers: Map<string, Array<(task: SubagentTask) => void>> = new Map()

  /** AbortController 映射（用于取消任务） */
  private abortControllers: Map<string, AbortController> = new Map()

  private constructor(config?: Partial<SubagentConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  /** 获取单例实例 */
  static getInstance(config?: Partial<SubagentConfig>): SubagentManager {
    if (!SubagentManager.instance) {
      SubagentManager.instance = new SubagentManager(config)
    }
    return SubagentManager.instance
  }

  /** 重置单例（仅用于测试） */
  static resetInstance(): void {
    SubagentManager.instance = null
  }

  /**
   * 创建子任务
   * @param params 任务创建参数
   * @returns 创建的子任务
   */
  createTask(params: {
    parentId: string
    name: string
    description: string
    systemPrompt: string
    messages?: SubagentTask['messages']
  }): SubagentTask {
    const task: SubagentTask = {
      id: generateTaskId(),
      parentId: params.parentId,
      name: params.name,
      description: params.description,
      systemPrompt: params.systemPrompt,
      messages: params.messages ?? [],
      status: 'pending',
      createdAt: Date.now(),
      toolCalls: 0,
      tokensUsed: 0,
    }

    this.tasks.set(task.id, task)
    getLogger('SubagentManager').debug(`任务已创建: ${task.id} (${task.name})`)
    return task
  }

  /**
   * 执行子任务
   * @param taskId 任务 ID
   * @param params 执行参数
   */
  async startTask(taskId: string, params: SubagentExecutionParams): Promise<void> {
    const task = this.tasks.get(taskId)
    if (!task) {
      throw new Error(`任务不存在: ${taskId}`)
    }

    if (task.status === 'running') {
      throw new Error(`任务已在运行中: ${taskId}`)
    }

    if (task.status === 'completed') {
      throw new Error(`任务已完成: ${taskId}`)
    }

    // 等待并发槽位可用
    await this.waitForSlot()

    // 创建 AbortController 用于取消
    const abortController = new AbortController()
    this.abortControllers.set(taskId, abortController)

    // 如果外部提供了 signal，监听其 abort 事件
    if (params.signal) {
      params.signal.addEventListener('abort', () => {
        abortController.abort()
      }, { once: true })
    }

    // 更新任务状态为运行中
    task.status = 'running'
    task.startedAt = Date.now()
    this.activeCount++

    params.onStatusChange(taskId, 'running')

    const logger = getLogger('SubagentManager')

    try {
      // 执行子代理任务
      const { result, tokensUsed } = await executeSubagentTask(task, params.model, {
        onPartialResult: (text: string) => {
          params.onPartialResult(taskId, text)
        },
        signal: abortController.signal,
      })

      // 检查是否被取消
      if (abortController.signal.aborted) {
        task.status = 'cancelled'
        task.completedAt = Date.now()
        params.onStatusChange(taskId, 'cancelled')
        logger.debug(`任务已取消: ${taskId}`)
      } else {
        // 任务成功完成
        task.status = 'completed'
        task.result = result
        task.tokensUsed = tokensUsed
        task.completedAt = Date.now()
        params.onStatusChange(taskId, 'completed', result)
        logger.debug(`任务已完成: ${taskId}, tokens: ${tokensUsed}`)
      }
    } catch (err) {
      // 检查是否被取消
      if (abortController.signal.aborted) {
        task.status = 'cancelled'
        task.completedAt = Date.now()
        params.onStatusChange(taskId, 'cancelled')
        logger.debug(`任务已取消: ${taskId}`)
      } else {
        task.status = 'failed'
        task.error = err instanceof Error ? err.message : String(err)
        task.completedAt = Date.now()
        params.onStatusChange(taskId, 'failed')
        logger.error(`任务执行失败: ${taskId}`, err)
      }
    } finally {
      // 清理资源
      this.activeCount--
      this.abortControllers.delete(taskId)

      // 通知等待者
      this.notifyCompletionWaiters(task)
    }
  }

  /**
   * 取消子任务
   * @param taskId 任务 ID
   */
  cancelTask(taskId: string): void {
    const task = this.tasks.get(taskId)
    if (!task) {
      return
    }

    // 如果任务正在运行，通过 AbortController 中断
    const controller = this.abortControllers.get(taskId)
    if (controller) {
      controller.abort()
    }

    // 如果任务还在等待中（pending），直接标记为取消
    if (task.status === 'pending') {
      task.status = 'cancelled'
      task.completedAt = Date.now()
      this.notifyCompletionWaiters(task)
    }

    getLogger('SubagentManager').debug(`任务取消请求已发送: ${taskId}`)
  }

  /**
   * 获取指定任务
   * @param taskId 任务 ID
   * @returns 任务对象或 undefined
   */
  getTask(taskId: string): SubagentTask | undefined {
    return this.tasks.get(taskId)
  }

  /**
   * 获取所有任务
   * @returns 所有任务列表
   */
  getAllTasks(): SubagentTask[] {
    return Array.from(this.tasks.values())
  }

  /**
   * 获取指定父消息的所有子任务
   * @param parentId 父消息 ID
   * @returns 子任务列表
   */
  getTasksByParentId(parentId: string): SubagentTask[] {
    return Array.from(this.tasks.values()).filter((task) => task.parentId === parentId)
  }

  /**
   * 移除指定任务
   * @param taskId 任务 ID
   */
  removeTask(taskId: string): void {
    // 如果任务正在运行，先取消
    this.cancelTask(taskId)
    this.tasks.delete(taskId)
    this.completionResolvers.delete(taskId)
  }

  /**
   * 等待指定任务完成
   * @param taskId 任务 ID
   * @returns 完成后的任务对象
   */
  waitForCompletion(taskId: string): Promise<SubagentTask> {
    const task = this.tasks.get(taskId)
    if (!task) {
      return Promise.reject(new Error(`任务不存在: ${taskId}`))
    }

    // 如果任务已经处于终态，直接返回
    if (this.isTerminalStatus(task.status)) {
      return Promise.resolve(task)
    }

    // 否则注册等待回调
    return new Promise<SubagentTask>((resolve) => {
      const resolvers = this.completionResolvers.get(taskId) ?? []
      resolvers.push(resolve)
      this.completionResolvers.set(taskId, resolvers)
    })
  }

  /**
   * 等待指定父消息的所有子任务完成
   * @param parentId 父消息 ID
   * @returns 所有完成的子任务列表
   */
  async waitForAllCompletion(parentId: string): Promise<SubagentTask[]> {
    const tasks = this.getTasksByParentId(parentId)
    if (tasks.length === 0) {
      return []
    }

    // 并行等待所有任务完成
    const results = await Promise.all(
      tasks.map((task) => this.waitForCompletion(task.id))
    )

    return results
  }

  /**
   * 检查是否可以启动新任务（并发控制）
   */
  private canStart(): boolean {
    return this.activeCount < this.config.maxConcurrent
  }

  /**
   * 等待并发槽位可用
   */
  private waitForSlot(): Promise<void> {
    if (this.canStart()) {
      return Promise.resolve()
    }

    // 每 100ms 检查一次并发槽位
    return new Promise<void>((resolve) => {
      const check = () => {
        if (this.canStart()) {
          resolve()
        } else {
          setTimeout(check, 100)
        }
      }
      setTimeout(check, 100)
    })
  }

  /**
   * 判断状态是否为终态
   */
  private isTerminalStatus(status: SubagentStatus): boolean {
    return status === 'completed' || status === 'failed' || status === 'cancelled'
  }

  /**
   * 通知所有等待任务完成的回调
   */
  private notifyCompletionWaiters(task: SubagentTask): void {
    const resolvers = this.completionResolvers.get(task.id)
    if (resolvers) {
      resolvers.forEach((resolve) => resolve(task))
      this.completionResolvers.delete(task.id)
    }
  }
}

/** 导出单例实例 */
export const subagentManager = SubagentManager.getInstance()
