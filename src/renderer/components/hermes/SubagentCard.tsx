/**
 * SubagentCard - 子代理任务卡片
 * 在消息流中嵌入的子代理执行状态卡片，展示子任务的名称、状态、结果等信息
 */

import { Badge, Card, Collapse, Group, Loader, Stack, Text } from '@mantine/core'
import { IconChevronDown, IconChevronUp, IconCircleCheck, IconCircleX, IconClock } from '@tabler/icons-react'
import { memo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import type { SubagentStatus } from '@/packages/hermes'

/** 子代理任务摘要类型（从 integration 层获取） */
export interface SubagentTaskSummary {
  /** 任务唯一标识 */
  id: string
  /** 任务名称 */
  name: string
  /** 任务描述 */
  description: string
  /** 当前任务状态 */
  status: SubagentStatus
  /** 最终结果文本 */
  result?: string
  /** 错误信息 */
  error?: string
  /** 创建时间戳 */
  createdAt: number
  /** 完成时间戳 */
  completedAt?: number
  /** token 使用量 */
  tokensUsed: number
}

/** 状态对应的配置 */
const STATUS_CONFIG: Record<
  SubagentStatus,
  { color: string; label: string; icon: typeof Loader }
> = {
  pending: {
    color: 'gray',
    label: 'Pending',
    icon: IconClock,
  },
  running: {
    color: 'blue',
    label: 'Running',
    icon: Loader,
  },
  completed: {
    color: 'green',
    label: 'Completed',
    icon: IconCircleCheck,
  },
  failed: {
    color: 'red',
    label: 'Failed',
    icon: IconCircleX,
  },
  cancelled: {
    color: 'gray',
    label: 'Cancelled',
    icon: IconCircleX,
  },
}

/** 计算任务耗时（毫秒） */
function getDuration(createdAt: number, completedAt?: number): number {
  const end = completedAt ?? Date.now()
  return end - createdAt
}

/** 格式化耗时显示 */
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`
  const minutes = Math.floor(ms / 60000)
  const seconds = Math.round((ms % 60000) / 1000)
  return `${minutes}m ${seconds}s`
}

/** 子代理任务卡片组件 */
const SubagentCard = memo<{ task: SubagentTaskSummary }>(({ task }) => {
  const { t } = useTranslation()
  const [expanded, setExpanded] = useState(false)

  const config = STATUS_CONFIG[task.status]
  const isRunning = task.status === 'running'
  const isCompleted = task.status === 'completed'
  const isFailed = task.status === 'failed'
  const hasResult = isCompleted && task.result
  const hasError = isFailed && task.error

  /** 状态图标 */
  const StatusIcon = config.icon

  return (
    <Card withBorder radius="md" p="sm" className="dark:bg-gray-800/50">
      <Stack gap="xs">
        {/* 顶部：任务名称 + 状态标签 */}
        <Group justify="space-between" align="center">
          <Group gap="xs" align="center">
            {isRunning ? (
              <Loader size={16} type="dots" color="var(--mantine-color-blue-5)" />
            ) : (
              <StatusIcon size={16} className={isCompleted ? 'text-green-500' : isFailed ? 'text-red-500' : 'text-gray-400'} />
            )}
            <Text fw={600} size="sm">
              {task.name}
            </Text>
          </Group>
          <Badge color={config.color} size="sm" variant="light">
            {t(config.label)}
          </Badge>
        </Group>

        {/* 任务描述 */}
        <Text size="xs" c="dimmed" lineClamp={2}>
          {task.description}
        </Text>

        {/* 结果摘要（completed 状态可展开/折叠） */}
        {hasResult && (
          <Stack gap={4}>
            <Group gap={4} align="center">
              <Text
                size="xs"
                c="blue"
                className="cursor-pointer hover:underline"
                onClick={() => setExpanded(!expanded)}
              >
                {expanded ? t('Collapse result') : t('Expand result')}
              </Text>
              {expanded ? <IconChevronUp size={12} /> : <IconChevronDown size={12} />}
            </Group>
            <Collapse in={expanded}>
              <Text size="xs" className="whitespace-pre-wrap rounded bg-gray-100 p-2 dark:bg-gray-700/50">
                {task.result}
              </Text>
            </Collapse>
          </Stack>
        )}

        {/* 错误信息（failed 状态） */}
        {hasError && (
          <Text size="xs" c="red" className="rounded bg-red-50 p-2 dark:bg-red-900/20">
            {task.error}
          </Text>
        )}

        {/* 底部：token 使用量 + 耗时 */}
        <Group justify="flex-end" gap="md" align="center">
          <Text size="xs" c="dimmed">
            {t('Tokens')}: {task.tokensUsed.toLocaleString()}
          </Text>
          <Text size="xs" c="dimmed">
            {formatDuration(getDuration(task.createdAt, task.completedAt))}
          </Text>
        </Group>
      </Stack>
    </Card>
  )
})

SubagentCard.displayName = 'SubagentCard'

export default SubagentCard
