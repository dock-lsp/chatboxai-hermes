/**
 * 子代理委派系统模块
 *
 * 提供子代理任务的创建、规划、执行和管理功能。
 * 支持并行执行多个子任务，带有并发控制和取消机制。
 */

// 类型导出
export type {
  SubagentStatus,
  SubagentTask,
  SubagentConfig,
  SubagentExecutionParams,
} from './types'

// 管理器导出
export { SubagentManager, subagentManager } from './manager'

// 执行器导出
export { executeSubagentTask } from './executor'
export type { SubagentExecutionResult } from './executor'

// 规划器导出
export { planSubtasks } from './planner'
export type { PlannedSubtask } from './planner'
