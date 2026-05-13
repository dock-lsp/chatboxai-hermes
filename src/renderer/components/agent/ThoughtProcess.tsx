/**
 * ThoughtProcess.tsx
 * 思考过程组件
 *
 * 可视化展示 AI 的思考步骤，包括：
 * - 观察（Observation）: 理解用户需求
 * - 思考（Thought）: 分析解决问题的方法
 * - 行动（Action）: 执行工具调用
 * - 结果（Result）: 展示工具执行结果
 */

import React from 'react'
import {
  Timeline,
  Paper,
  Text,
  Badge,
  Stack,
  Group,
  ThemeIcon,
  Collapse,
  Code,
  Box,
  ScrollArea,
  Tooltip,
  Accordion,
} from '@mantine/core'
import {
  IconEye,
  IconBrain,
  IconTool,
  IconCheck,
  IconX,
  IconChevronRight,
  IconChevronDown,
  IconClock,
} from '@tabler/icons-react'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import type { ThoughtStep, ToolCall } from '@/packages/agent'

/**
 * 步骤类型配置
 * 定义不同类型步骤的图标、颜色和标签
 */
const STEP_TYPE_CONFIG = {
  observation: {
    icon: IconEye,
    color: 'blue',
    label: '观察',
    description: '理解用户需求',
  },
  thought: {
    icon: IconBrain,
    color: 'grape',
    label: '思考',
    description: '分析解决方案',
  },
  action: {
    icon: IconTool,
    color: 'orange',
    label: '行动',
    description: '执行工具调用',
  },
  result: {
    icon: IconCheck,
    color: 'green',
    label: '结果',
    description: '工具执行结果',
  },
} as const

/**
 * 思考步骤项组件属性
 */
interface ThoughtStepItemProps {
  step: ThoughtStep
  isLast?: boolean
}

/**
 * 思考步骤项组件
 * 显示单个思考步骤的详细信息
 */
function ThoughtStepItem({ step, isLast }: ThoughtStepItemProps) {
  const config = STEP_TYPE_CONFIG[step.type]
  const Icon = config.icon
  const [opened, { toggle }] = useDisclosure(true)

  // 格式化时间戳
  const formatTime = (timestamp: number) => {
    return new Date(timestamp).toLocaleTimeString('zh-CN', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    })
  }

  // 获取步骤状态
  const getStepStatus = () => {
    if (step.type === 'result' && step.toolCall) {
      return step.toolCall.error ? 'error' : 'success'
    }
    return 'pending'
  }

  const status = getStepStatus()

  return (
    <Timeline.Item
      bullet={
        <ThemeIcon
          size="sm"
          radius="xl"
          color={status === 'error' ? 'red' : config.color}
          variant="light"
        >
          {status === 'error' ? <IconX size={12} /> : <Icon size={12} />}
        </ThemeIcon>
      }
      title={
        <Group gap="xs" onClick={toggle} style={{ cursor: 'pointer' }}>
          <Badge
            size="sm"
            color={status === 'error' ? 'red' : config.color}
            variant="light"
          >
            {config.label}
          </Badge>
          <Text size="xs" c="dimmed">
            {formatTime(step.timestamp)}
          </Text>
          <ThemeIcon size="xs" variant="transparent" c="gray">
            {opened ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ThemeIcon>
        </Group>
      }
    >
      <Collapse in={opened}>
        <Paper
          p="sm"
          mt="xs"
          bg="gray.0"
          radius="sm"
          style={{ borderLeft: `3px solid var(--mantine-color-${config.color}-6)` }}
        >
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {step.content}
          </Text>

          {/* 工具调用详情 */}
          {step.toolCall && (
            <ToolCallDetails toolCall={step.toolCall} />
          )}
        </Paper>
      </Collapse>
    </Timeline.Item>
  )
}

/**
 * 工具调用详情组件属性
 */
interface ToolCallDetailsProps {
  toolCall: ToolCall
}

/**
 * 工具调用详情组件
 * 展示工具调用的参数和结果
 */
function ToolCallDetails({ toolCall }: ToolCallDetailsProps) {
  const [paramsOpened, { toggle: toggleParams }] = useDisclosure(false)
  const [resultOpened, { toggle: toggleResult }] = useDisclosure(true)

  const hasError = !!toolCall.error
  const hasResult = !!toolCall.result

  return (
    <Stack gap="xs" mt="sm">
      {/* 工具名称 */}
      <Group gap="xs">
        <Badge
          size="sm"
          color={hasError ? 'red' : 'blue'}
          leftSection={<IconTool size={12} />}
        >
          {toolCall.tool}
        </Badge>
        {hasError && (
          <Badge size="sm" color="red" variant="light">
            失败
          </Badge>
        )}
        {hasResult && !hasError && (
          <Badge size="sm" color="green" variant="light">
            成功
          </Badge>
        )}
      </Group>

      {/* 参数折叠面板 */}
      <Accordion variant="contained" radius="xs" chevronPosition="left">
        <Accordion.Item value="params">
          <Accordion.Control py="xs">
            <Text size="xs" fw={500}>
              参数
            </Text>
          </Accordion.Control>
          <Accordion.Panel>
            <Code block style={{ fontSize: '11px' }}>
              {JSON.stringify(toolCall.parameters, null, 2)}
            </Code>
          </Accordion.Panel>
        </Accordion.Item>

        {/* 结果折叠面板 */}
        {(hasResult || hasError) && (
          <Accordion.Item value="result">
            <Accordion.Control py="xs">
              <Text size="xs" fw={500}>
                {hasError ? '错误' : '结果'}
              </Text>
            </Accordion.Control>
            <Accordion.Panel>
              {hasError ? (
                <Text size="xs" c="red">
                  {toolCall.error}
                </Text>
              ) : (
                <Code
                  block
                  style={{
                    fontSize: '11px',
                    maxHeight: 200,
                    overflow: 'auto',
                  }}
                >
                  {typeof toolCall.result === 'string'
                    ? toolCall.result
                    : JSON.stringify(toolCall.result, null, 2)}
                </Code>
              )}
            </Accordion.Panel>
          </Accordion.Item>
        )}
      </Accordion>
    </Stack>
  )
}

/**
 * 思考过程统计组件属性
 */
interface ThoughtStatsProps {
  steps: ThoughtStep[]
}

/**
 * 思考过程统计组件
 * 显示思考步骤的统计信息
 */
function ThoughtStats({ steps }: ThoughtStatsProps) {
  const stats = {
    observation: steps.filter((s) => s.type === 'observation').length,
    thought: steps.filter((s) => s.type === 'thought').length,
    action: steps.filter((s) => s.type === 'action').length,
    result: steps.filter((s) => s.type === 'result').length,
  }

  const toolCalls = steps.filter((s) => s.toolCall).length
  const errors = steps.filter((s) => s.toolCall?.error).length

  return (
    <Group gap="xs" wrap="wrap">
      <Tooltip label="观察">
        <Badge size="sm" color="blue" variant="light" leftSection={<IconEye size={12} />}>
          {stats.observation}
        </Badge>
      </Tooltip>
      <Tooltip label="思考">
        <Badge size="sm" color="grape" variant="light" leftSection={<IconBrain size={12} />}>
          {stats.thought}
        </Badge>
      </Tooltip>
      <Tooltip label="行动">
        <Badge size="sm" color="orange" variant="light" leftSection={<IconTool size={12} />}>
          {stats.action}
        </Badge>
      </Tooltip>
      <Tooltip label="结果">
        <Badge size="sm" color="green" variant="light" leftSection={<IconCheck size={12} />}>
          {stats.result}
        </Badge>
      </Tooltip>
      {toolCalls > 0 && (
        <Badge size="sm" color="cyan" variant="light">
          {toolCalls} 次工具调用
        </Badge>
      )}
      {errors > 0 && (
        <Badge size="sm" color="red" variant="light">
          {errors} 个错误
        </Badge>
      )}
    </Group>
  )
}

/**
 * 思考过程组件属性
 */
interface ThoughtProcessProps {
  /** 思考步骤列表 */
  steps: ThoughtStep[]
  /** 是否显示统计信息 */
  showStats?: boolean
  /** 高度 */
  height?: number | string
  /** 自定义样式 */
  className?: string
}

/**
 * 思考过程组件
 *
 * 主组件，展示完整的思考流程时间线
 */
export function ThoughtProcess({
  steps,
  showStats = true,
  height = '100%',
  className,
}: ThoughtProcessProps) {
  const isMobile = useMediaQuery('(max-width: 768px)')

  if (steps.length === 0) {
    return (
      <Paper p="md" h={height} className={className}>
        <Stack h="100%" justify="center" align="center" gap="md">
          <ThemeIcon size="xl" radius="xl" color="gray" variant="light">
            <IconBrain size={32} />
          </ThemeIcon>
          <Text c="dimmed" ta="center" size="sm">
            暂无思考过程
            <br />
            发送消息后将显示 AI 的推理步骤
          </Text>
        </Stack>
      </Paper>
    )
  }

  return (
    <Paper p="md" h={height} className={className} style={{ display: 'flex', flexDirection: 'column' }}>
      {/* 头部 */}
      <Group justify="space-between" mb="md">
        <Group gap="xs">
          <ThemeIcon size="sm" color="grape" variant="light">
            <IconBrain size={16} />
          </ThemeIcon>
          <Text fw={500} size="sm">
            思考过程
          </Text>
          <Badge size="sm" variant="light">
            {steps.length} 步
          </Badge>
        </Group>
      </Group>

      {/* 统计信息 */}
      {showStats && (
        <Box mb="md">
          <ThoughtStats steps={steps} />
        </Box>
      )}

      {/* 时间线 */}
      <ScrollArea style={{ flex: 1 }}>
        <Timeline
          active={steps.length - 1}
          bulletSize={24}
          lineWidth={2}
          color="gray"
        >
          {steps.map((step, index) => (
            <ThoughtStepItem
              key={step.id}
              step={step}
              isLast={index === steps.length - 1}
            />
          ))}
        </Timeline>
      </ScrollArea>
    </Paper>
  )
}

/**
 * 简化版思考过程组件属性
 */
interface CompactThoughtProcessProps {
  steps: ThoughtStep[]
  maxHeight?: number
}

/**
 * 简化版思考过程组件
 * 用于在空间有限的地方展示
 */
export function CompactThoughtProcess({
  steps,
  maxHeight = 200,
}: CompactThoughtProcessProps) {
  if (steps.length === 0) {
    return (
      <Text size="xs" c="dimmed" ta="center" py="md">
        暂无思考过程
      </Text>
    )
  }

  const latestSteps = steps.slice(-3) // 只显示最近3步

  return (
    <Paper p="xs" bg="gray.0" radius="sm">
      <Stack gap="xs">
        {latestSteps.map((step) => {
          const config = STEP_TYPE_CONFIG[step.type]
          const Icon = config.icon

          return (
            <Group key={step.id} gap="xs" wrap="nowrap">
              <ThemeIcon size="xs" color={config.color} variant="light">
                <Icon size={10} />
              </ThemeIcon>
              <Text size="xs" lineClamp={1} style={{ flex: 1 }}>
                {step.content}
              </Text>
            </Group>
          )
        })}

        {steps.length > 3 && (
          <Text size="xs" c="dimmed" ta="center">
            +{steps.length - 3} 更多步骤
          </Text>
        )}
      </Stack>
    </Paper>
  )
}

/**
 * 思考步骤卡片组件属性
 */
interface ThoughtStepCardProps {
  step: ThoughtStep
}

/**
 * 思考步骤卡片组件
 * 独立的步骤展示卡片
 */
export function ThoughtStepCard({ step }: ThoughtStepCardProps) {
  const config = STEP_TYPE_CONFIG[step.type]
  const Icon = config.icon

  return (
    <Paper
      p="md"
      radius="md"
      withBorder
      style={{
        borderLeft: `4px solid var(--mantine-color-${config.color}-6)`,
      }}
    >
      <Group gap="xs" mb="xs">
        <ThemeIcon size="sm" color={config.color} variant="light">
          <Icon size={14} />
        </ThemeIcon>
        <Badge size="sm" color={config.color} variant="light">
          {config.label}
        </Badge>
        <Text size="xs" c="dimmed">
          {new Date(step.timestamp).toLocaleTimeString()}
        </Text>
      </Group>

      <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
        {step.content}
      </Text>

      {step.toolCall && (
        <Box mt="sm">
          <ToolCallDetails toolCall={step.toolCall} />
        </Box>
      )}
    </Paper>
  )
}

export default ThoughtProcess
