/**
 * ToolSelector.tsx
 * 工具选择器组件
 *
 * 提供工具启用/禁用的管理界面，支持：
 * - 按类别分组显示工具（搜索类、GitHub类、生成类）
 * - 复选框选择启用的工具
 * - 显示工具描述
 * - 全选/取消全选功能
 * - 按类别批量选择
 */

import React, { useMemo, useCallback } from 'react'
import {
  Stack,
  Group,
  Checkbox,
  Paper,
  Text,
  Badge,
  Accordion,
  Button,
  Tooltip,
  ThemeIcon,
  Divider,
  Box,
  ScrollArea,
  ActionIcon,
  Collapse,
} from '@mantine/core'
import {
  IconSearch,
  IconBrandGithub,
  IconCode,
  IconCheck,
  IconX,
  IconRefresh,
  IconInfoCircle,
  IconSettings,
  IconTool,
} from '@tabler/icons-react'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import {
  useAgentStore,
  useEnabledTools,
  allTools,
  toolsByCategory,
  getToolByName,
  type Tool,
} from '@/packages/agent'

/**
 * 工具类别配置
 * 定义不同类别的显示名称、图标和颜色
 */
const CATEGORY_CONFIG = {
  search: {
    label: '搜索类工具',
    description: '网络搜索和信息获取',
    icon: IconSearch,
    color: 'blue',
  },
  github: {
    label: 'GitHub 工具',
    description: 'GitHub 仓库和代码操作',
    icon: IconBrandGithub,
    color: 'gray',
  },
  projectGenerator: {
    label: '项目生成器',
    description: '项目脚手架生成',
    icon: IconCode,
    color: 'green',
  },
} as const

/**
 * 工具项组件属性
 */
interface ToolItemProps {
  tool: Tool
  isEnabled: boolean
  onToggle: (toolName: string) => void
}

/**
 * 工具项组件
 * 显示单个工具的复选框和描述
 */
function ToolItem({ tool, isEnabled, onToggle }: ToolItemProps) {
  const [infoOpened, { toggle: toggleInfo }] = useDisclosure(false)

  // 获取参数显示文本
  const getParamsText = () => {
    const required = tool.parameters.filter((p) => p.required)
    const optional = tool.parameters.filter((p) => !p.required)

    const parts: string[] = []
    if (required.length > 0) {
      parts.push(`必需: ${required.map((p) => p.name).join(', ')}`)
    }
    if (optional.length > 0) {
      parts.push(`可选: ${optional.map((p) => p.name).join(', ')}`)
    }

    return parts.join(' | ') || '无参数'
  }

  return (
    <Paper p="sm" radius="sm" withBorder={isEnabled} bg={isEnabled ? 'blue.0' : undefined}>
      <Stack gap="xs">
        <Group justify="space-between" wrap="nowrap">
          <Group gap="sm" style={{ flex: 1 }}>
            <Checkbox
              checked={isEnabled}
              onChange={() => onToggle(tool.name)}
              label={
                <Text fw={500} size="sm">
                  {tool.name}
                </Text>
              }
            />
          </Group>

          <Tooltip label="查看详情">
            <ActionIcon size="sm" variant="subtle" onClick={toggleInfo}>
              <IconInfoCircle size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>

        <Text size="xs" c="dimmed" pl={32}>
          {tool.description}
        </Text>

        <Collapse in={infoOpened}>
          <Box pl={32} pt="xs">
            <Paper p="xs" bg="gray.0" radius="xs">
              <Text size="xs" fw={500} mb="xs">
                参数:
              </Text>
              <Text size="xs" c="dimmed">
                {getParamsText()}
              </Text>

              {tool.parameters.length > 0 && (
                <Stack gap="xs" mt="xs">
                  {tool.parameters.map((param) => (
                    <Group key={param.name} gap="xs">
                      <Badge size="xs" variant={param.required ? 'filled' : 'light'}>
                        {param.name}
                      </Badge>
                      <Text size="xs" c="dimmed">
                        {param.type}
                        {param.required && ' (必需)'}
                      </Text>
                      <Text size="xs">{param.description}</Text>
                      {param.enum && (
                        <Text size="xs" c="blue">
                          可选值: {param.enum.join(', ')}
                        </Text>
                      )}
                    </Group>
                  ))}
                </Stack>
              )}
            </Paper>
          </Box>
        </Collapse>
      </Stack>
    </Paper>
  )
}

/**
 * 工具类别组组件属性
 */
interface ToolCategoryGroupProps {
  category: keyof typeof CATEGORY_CONFIG
  tools: Tool[]
  enabledTools: string[]
  onToggle: (toolName: string) => void
  onSelectAll: (category: keyof typeof CATEGORY_CONFIG) => void
  onDeselectAll: (category: keyof typeof CATEGORY_CONFIG) => void
}

/**
 * 工具类别组组件
 * 显示某一类别的所有工具
 */
function ToolCategoryGroup({
  category,
  tools,
  enabledTools,
  onToggle,
  onSelectAll,
  onDeselectAll,
}: ToolCategoryGroupProps) {
  const config = CATEGORY_CONFIG[category]
  const Icon = config.icon

  // 计算该类别中启用的工具数量
  const enabledCount = tools.filter((t) => enabledTools.includes(t.name)).length
  const allEnabled = enabledCount === tools.length
  const someEnabled = enabledCount > 0 && enabledCount < tools.length

  return (
    <Accordion.Item value={category}>
      <Accordion.Control>
        <Group gap="sm">
          <ThemeIcon size="sm" color={config.color} variant="light">
            <Icon size={16} />
          </ThemeIcon>
          <Text fw={500}>{config.label}</Text>
          <Badge size="sm" variant="light" color={config.color}>
            {enabledCount}/{tools.length}
          </Badge>
        </Group>
      </Accordion.Control>

      <Accordion.Panel>
        <Stack gap="md">
          {/* 类别描述 */}
          <Text size="sm" c="dimmed">
            {config.description}
          </Text>

          {/* 批量操作按钮 */}
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconCheck size={14} />}
              onClick={() => onSelectAll(category)}
              disabled={allEnabled}
            >
              全选
            </Button>
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconX size={14} />}
              onClick={() => onDeselectAll(category)}
              disabled={enabledCount === 0}
            >
              取消全选
            </Button>
          </Group>

          <Divider />

          {/* 工具列表 */}
          <Stack gap="xs">
            {tools.map((tool) => (
              <ToolItem
                key={tool.name}
                tool={tool}
                isEnabled={enabledTools.includes(tool.name)}
                onToggle={onToggle}
              />
            ))}
          </Stack>
        </Stack>
      </Accordion.Panel>
    </Accordion.Item>
  )
}

/**
 * 工具选择器组件属性
 */
interface ToolSelectorProps {
  /** 是否显示标题 */
  showHeader?: boolean
  /** 最大高度 */
  maxHeight?: number
  /** 自定义样式 */
  className?: string
}

/**
 * 工具选择器组件
 *
 * 主组件，提供完整的工具管理界面
 */
export function ToolSelector({
  showHeader = true,
  maxHeight = 400,
  className,
}: ToolSelectorProps) {
  // 从 store 获取状态
  const enabledTools = useEnabledTools()
  const toggleTool = useAgentStore((state) => state.toggleTool)
  const enableTool = useAgentStore((state) => state.enableTool)
  const disableTool = useAgentStore((state) => state.disableTool)

  // 计算统计信息
  const stats = useMemo(() => {
    return {
      total: allTools.length,
      enabled: enabledTools.length,
      search: toolsByCategory.search.filter((t) => enabledTools.includes(t.name)).length,
      github: toolsByCategory.github.filter((t) => enabledTools.includes(t.name)).length,
      project: toolsByCategory.projectGenerator.filter((t) =>
        enabledTools.includes(t.name)
      ).length,
    }
  }, [enabledTools])

  // 切换单个工具
  const handleToggle = useCallback(
    (toolName: string) => {
      toggleTool(toolName)
    },
    [toggleTool]
  )

  // 全选某类别
  const handleSelectAll = useCallback(
    (category: keyof typeof CATEGORY_CONFIG) => {
      const tools = toolsByCategory[category]
      tools.forEach((tool) => {
        if (!enabledTools.includes(tool.name)) {
          enableTool(tool.name)
        }
      })
    },
    [enabledTools, enableTool]
  )

  // 取消全选某类别
  const handleDeselectAll = useCallback(
    (category: keyof typeof CATEGORY_CONFIG) => {
      const tools = toolsByCategory[category]
      tools.forEach((tool) => {
        if (enabledTools.includes(tool.name)) {
          disableTool(tool.name)
        }
      })
    },
    [enabledTools, disableTool]
  )

  // 全选所有工具
  const handleSelectAllTools = useCallback(() => {
    allTools.forEach((tool) => {
      if (!enabledTools.includes(tool.name)) {
        enableTool(tool.name)
      }
    })
  }, [enabledTools, enableTool])

  // 取消全选所有工具
  const handleDeselectAllTools = useCallback(() => {
    enabledTools.forEach((toolName) => {
      disableTool(toolName)
    })
  }, [enabledTools, disableTool])

  // 重置为默认
  const handleReset = useCallback(() => {
    const defaultTools = [
      'web_search',
      'fetch_webpage',
      'search_and_summarize',
      'github_search_repos',
      'github_get_file',
      'github_get_repo',
      'generate_project',
      'analyze_project_requirements',
    ]

    // 先禁用所有
    enabledTools.forEach((toolName) => {
      disableTool(toolName)
    })

    // 再启用默认工具
    defaultTools.forEach((toolName) => {
      enableTool(toolName)
    })
  }, [enabledTools, enableTool, disableTool])

  return (
    <Stack gap="md" className={className}>
      {/* 头部 */}
      {showHeader && (
        <>
          <Group justify="space-between">
            <Group gap="sm">
              <ThemeIcon size="md" color="blue" variant="light">
                <IconTool size={20} />
              </ThemeIcon>
              <Text fw={500}>工具设置</Text>
            </Group>

            <Badge size="sm" variant="light">
              {stats.enabled}/{stats.total} 已启用
            </Badge>
          </Group>

          {/* 统计信息 */}
          <Group gap="xs">
            <Badge size="sm" color="blue" variant="light" leftSection={<IconSearch size={12} />}>
              搜索: {stats.search}/{toolsByCategory.search.length}
            </Badge>
            <Badge size="sm" color="gray" variant="light" leftSection={<IconBrandGithub size={12} />}>
              GitHub: {stats.github}/{toolsByCategory.github.length}
            </Badge>
            <Badge size="sm" color="green" variant="light" leftSection={<IconCode size={12} />}>
              生成: {stats.project}/{toolsByCategory.projectGenerator.length}
            </Badge>
          </Group>

          {/* 全局操作按钮 */}
          <Group gap="xs">
            <Button
              size="xs"
              variant="light"
              leftSection={<IconCheck size={14} />}
              onClick={handleSelectAllTools}
              disabled={stats.enabled === stats.total}
            >
              全选所有
            </Button>
            <Button
              size="xs"
              variant="light"
              color="red"
              leftSection={<IconX size={14} />}
              onClick={handleDeselectAllTools}
              disabled={stats.enabled === 0}
            >
              取消全选
            </Button>
            <Button
              size="xs"
              variant="light"
              color="gray"
              leftSection={<IconRefresh size={14} />}
              onClick={handleReset}
            >
              重置默认
            </Button>
          </Group>

          <Divider />
        </>
      )}

      {/* 工具类别手风琴 */}
      <ScrollArea.Autosize mah={maxHeight}>
        <Accordion variant="contained" radius="md" defaultValue={['search']}>
          <ToolCategoryGroup
            category="search"
            tools={toolsByCategory.search}
            enabledTools={enabledTools}
            onToggle={handleToggle}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
          />
          <ToolCategoryGroup
            category="github"
            tools={toolsByCategory.github}
            enabledTools={enabledTools}
            onToggle={handleToggle}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
          />
          <ToolCategoryGroup
            category="projectGenerator"
            tools={toolsByCategory.projectGenerator}
            enabledTools={enabledTools}
            onToggle={handleToggle}
            onSelectAll={handleSelectAll}
            onDeselectAll={handleDeselectAll}
          />
        </Accordion>
      </ScrollArea.Autosize>
    </Stack>
  )
}

/**
 * 紧凑版工具选择器组件属性
 */
interface CompactToolSelectorProps {
  maxHeight?: number
}

/**
 * 紧凑版工具选择器组件
 * 用于在空间有限的地方展示
 */
export function CompactToolSelector({ maxHeight = 300 }: CompactToolSelectorProps) {
  const enabledTools = useEnabledTools()
  const toggleTool = useAgentStore((state) => state.toggleTool)

  return (
    <Stack gap="xs">
      {allTools.map((tool) => (
        <Checkbox
          key={tool.name}
          checked={enabledTools.includes(tool.name)}
          onChange={() => toggleTool(tool.name)}
          label={
            <Group gap="xs">
              <Text size="sm">{tool.name}</Text>
              <Tooltip label={tool.description}>
                <IconInfoCircle size={14} style={{ color: 'var(--mantine-color-gray-5)' }} />
              </Tooltip>
            </Group>
          }
        />
      ))}
    </Stack>
  )
}

/**
 * 工具标签组件属性
 */
interface ToolBadgeProps {
  toolName: string
  showDescription?: boolean
}

/**
 * 工具标签组件
 * 显示单个工具的标签
 */
export function ToolBadge({ toolName, showDescription = false }: ToolBadgeProps) {
  const tool = getToolByName(toolName)
  const isEnabled = useAgentStore((state) =>
    state.config.enabledTools.includes(toolName)
  )

  if (!tool) return null

  // 获取类别颜色
  let color = 'gray'
  if (toolsByCategory.search.find((t) => t.name === toolName)) color = 'blue'
  else if (toolsByCategory.github.find((t) => t.name === toolName)) color = 'gray'
  else if (toolsByCategory.projectGenerator.find((t) => t.name === toolName))
    color = 'green'

  return (
    <Tooltip label={tool.description} disabled={!showDescription}>
      <Badge
        size="sm"
        color={color}
        variant={isEnabled ? 'filled' : 'light'}
        opacity={isEnabled ? 1 : 0.5}
      >
        {tool.name}
      </Badge>
    </Tooltip>
  )
}

/**
 * 已启用工具列表组件
 * 显示当前启用的所有工具
 */
export function EnabledToolsList() {
  const enabledTools = useEnabledTools()

  if (enabledTools.length === 0) {
    return (
      <Text size="sm" c="dimmed" ta="center" py="md">
        未启用任何工具
      </Text>
    )
  }

  return (
    <Group gap="xs" wrap="wrap">
      {enabledTools.map((toolName) => (
        <ToolBadge key={toolName} toolName={toolName} showDescription />
      ))}
    </Group>
  )
}

export default ToolSelector
