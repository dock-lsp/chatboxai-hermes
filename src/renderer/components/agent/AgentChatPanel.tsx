/**
 * AgentChatPanel.tsx
 * 智能体聊天面板组件
 *
 * 提供类似聊天界面的交互体验，支持：
 * - 消息输入和发送
 * - AI 回复显示
 * - 工具调用过程可视化
 * - 思考步骤展开查看
 * - 工具启用/禁用控制
 */

import React, { useState, useRef, useCallback, useEffect } from 'react'
import {
  Stack,
  Group,
  TextInput,
  Button,
  Paper,
  Collapse,
  Badge,
  Timeline,
  Accordion,
  ScrollArea,
  ActionIcon,
  Tooltip,
  Text,
  Box,
  Divider,
  Loader,
  ThemeIcon,
  Flex,
} from '@mantine/core'
import {
  IconSend,
  IconRobot,
  IconUser,
  IconTool,
  IconBrain,
  IconChevronDown,
  IconChevronUp,
  IconRefresh,
  IconSettings,
  IconSearch,
  IconBrandGithub,
  IconCode,
  IconCheck,
  IconX,
} from '@tabler/icons-react'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import type {
  AgentMessage,
  ThoughtStep,
  ToolCall,
  StreamChunk,
} from '@/packages/agent'
import {
  useAgentStore,
  useCurrentSession,
  useCurrentMessages,
  useCurrentThoughtSteps,
} from '@/packages/agent'
import { ThoughtProcess } from './ThoughtProcess'
import { ToolSelector } from './ToolSelector'

/**
 * 消息气泡组件属性
 */
interface MessageBubbleProps {
  message: AgentMessage
  isLast?: boolean
}

/**
 * 消息气泡组件
 * 显示单条聊天消息，根据角色显示不同样式
 */
function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isTool = message.role === 'tool'

  // 系统消息不显示
  if (isSystem) return null

  return (
    <Flex
      direction="column"
      align={isUser ? 'flex-end' : 'flex-start'}
      gap="xs"
      w="100%"
    >
      <Group gap="xs" align="flex-start">
        {!isUser && (
          <ThemeIcon
            size="md"
            radius="xl"
            color={isTool ? 'gray' : 'blue'}
            variant="light"
          >
            {isTool ? <IconTool size={16} /> : <IconRobot size={16} />}
          </ThemeIcon>
        )}

        <Paper
          p="md"
          radius="lg"
          bg={isUser ? 'blue.6' : isTool ? 'gray.1' : 'gray.0'}
          c={isUser ? 'white' : 'dark'}
          maw="80%"
          style={{
            borderBottomRightRadius: isUser ? 4 : undefined,
            borderBottomLeftRadius: !isUser ? 4 : undefined,
          }}
        >
          <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
            {message.content}
          </Text>

          {/* 显示工具调用信息 */}
          {message.toolCalls && message.toolCalls.length > 0 && (
            <Stack gap="xs" mt="sm">
              {message.toolCalls.map((toolCall, index) => (
                <ToolCallBadge key={index} toolCall={toolCall} />
              ))}
            </Stack>
          )}
        </Paper>

        {isUser && (
          <ThemeIcon size="md" radius="xl" color="blue" variant="filled">
            <IconUser size={16} />
          </ThemeIcon>
        )}
      </Group>

      <Text size="xs" c="dimmed" px="sm">
        {new Date(message.timestamp).toLocaleTimeString()}
      </Text>
    </Flex>
  )
}

/**
 * 工具调用徽章组件属性
 */
interface ToolCallBadgeProps {
  toolCall: ToolCall
}

/**
 * 工具调用徽章组件
 * 显示工具调用的简要信息和状态
 */
function ToolCallBadge({ toolCall }: ToolCallBadgeProps) {
  const [opened, { toggle }] = useDisclosure(false)
  const hasError = !!toolCall.error
  const hasResult = !!toolCall.result

  // 获取工具图标
  const getToolIcon = () => {
    if (toolCall.tool.includes('search')) return <IconSearch size={14} />
    if (toolCall.tool.includes('github')) return <IconBrandGithub size={14} />
    if (toolCall.tool.includes('project') || toolCall.tool.includes('code')) {
      return <IconCode size={14} />
    }
    return <IconTool size={14} />
  }

  return (
    <Box>
      <Group gap="xs">
        <Badge
          size="sm"
          color={hasError ? 'red' : hasResult ? 'green' : 'blue'}
          leftSection={getToolIcon()}
          style={{ cursor: 'pointer' }}
          onClick={toggle}
        >
          {toolCall.tool}
        </Badge>

        {hasError && (
          <Tooltip label={toolCall.error}>
            <ThemeIcon size="sm" color="red" variant="light">
              <IconX size={12} />
            </ThemeIcon>
          </Tooltip>
        )}

        {hasResult && !hasError && (
          <ThemeIcon size="sm" color="green" variant="light">
            <IconCheck size={12} />
          </ThemeIcon>
        )}

        <ActionIcon size="sm" variant="subtle" onClick={toggle}>
          {opened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
        </ActionIcon>
      </Group>

      <Collapse in={opened}>
        <Paper p="sm" mt="xs" bg="gray.1" radius="sm">
          <Stack gap="xs">
            <Text size="xs" fw={500}>
              参数:
            </Text>
            <CodeBlock code={JSON.stringify(toolCall.parameters, null, 2)} />

            {toolCall.result && (
              <>
                <Text size="xs" fw={500}>
                  结果:
                </Text>
                <CodeBlock
                  code={
                    typeof toolCall.result === 'string'
                      ? toolCall.result
                      : JSON.stringify(toolCall.result, null, 2)
                  }
                  maxHeight={200}
                />
              </>
            )}

            {toolCall.error && (
              <Text size="xs" c="red">
                错误: {toolCall.error}
              </Text>
            )}
          </Stack>
        </Paper>
      </Collapse>
    </Box>
  )
}

/**
 * 代码块组件属性
 */
interface CodeBlockProps {
  code: string
  maxHeight?: number
}

/**
 * 代码块组件
 * 显示格式化的代码内容
 */
function CodeBlock({ code, maxHeight = 150 }: CodeBlockProps) {
  return (
    <Paper
      p="xs"
      bg="dark.9"
      c="gray.0"
      style={{
        fontFamily: 'monospace',
        fontSize: '12px',
        overflow: 'auto',
        maxHeight,
        whiteSpace: 'pre-wrap',
        wordBreak: 'break-word',
      }}
    >
      {code}
    </Paper>
  )
}

/**
 * 输入框组件属性
 */
interface ChatInputProps {
  onSend: (message: string) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * 聊天输入框组件
 * 支持多行输入和发送
 */
function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    if (value.trim() && !disabled) {
      onSend(value.trim())
      setValue('')
    }
  }, [value, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <Group gap="xs" align="flex-end">
      <TextInput
        ref={inputRef}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder || '输入消息...'}
        disabled={disabled}
        style={{ flex: 1 }}
        size="md"
        rightSection={
          <ActionIcon
            variant="filled"
            color="blue"
            disabled={!value.trim() || disabled}
            onClick={handleSend}
          >
            <IconSend size={16} />
          </ActionIcon>
        }
      />
    </Group>
  )
}

/**
 * 智能体聊天面板组件属性
 */
interface AgentChatPanelProps {
  /** 会话 ID，不传则使用当前会话 */
  sessionId?: string
  /** 是否显示工具选择器 */
  showToolSelector?: boolean
  /** 是否显示思考过程 */
  showThoughtProcess?: boolean
  /** 输入框占位符 */
  placeholder?: string
  /** 高度 */
  height?: number | string
  /** 自定义样式 */
  className?: string
}

/**
 * 智能体聊天面板组件
 *
 * 主聊天界面组件，整合消息显示、输入、工具调用展示等功能
 */
export function AgentChatPanel({
  sessionId,
  showToolSelector = true,
  showThoughtProcess = true,
  placeholder,
  height = '100%',
  className,
}: AgentChatPanelProps) {
  // 状态管理
  const session = useCurrentSession()
  const messages = useCurrentMessages()
  const thoughtSteps = useCurrentThoughtSteps()
  const isLoading = useAgentStore((state) => state.isLoading)
  const error = useAgentStore((state) => state.error)
  const sendMessage = useAgentStore((state) => state.sendMessage)
  const createSession = useAgentStore((state) => state.createSession)
  const clearMessages = useAgentStore((state) => state.clearMessages)

  // UI 状态
  const [toolSelectorOpened, { toggle: toggleToolSelector }] = useDisclosure(false)
  const [thoughtPanelOpened, { toggle: toggleThoughtPanel }] = useDisclosure(true)
  const scrollViewportRef = useRef<HTMLDivElement>(null)
  const isMobile = useMediaQuery('(max-width: 768px)')

  // 自动滚动到底部
  useEffect(() => {
    if (scrollViewportRef.current) {
      scrollViewportRef.current.scrollTo({
        top: scrollViewportRef.current.scrollHeight,
        behavior: 'smooth',
      })
    }
  }, [messages])

  // 发送消息处理
  const handleSendMessage = useCallback(
    async (content: string) => {
      // 确保有会话
      if (!session) {
        createSession()
      }
      await sendMessage(content)
    },
    [session, createSession, sendMessage]
  )

  // 清空对话
  const handleClear = useCallback(() => {
    if (session) {
      clearMessages(session.id)
    }
  }, [session, clearMessages])

  // 过滤掉系统消息
  const displayMessages = messages.filter((m) => m.role !== 'system')

  return (
    <Paper
      className={className}
      h={height}
      style={{ display: 'flex', flexDirection: 'column' }}
    >
      {/* 头部工具栏 */}
      <Group p="md" justify="space-between" style={{ borderBottom: '1px solid #eee' }}>
        <Group gap="xs">
          <ThemeIcon size="lg" radius="md" color="blue" variant="light">
            <IconRobot size={20} />
          </ThemeIcon>
          <Text fw={500}>AI 智能体助手</Text>
          {isLoading && <Loader size="sm" />}
        </Group>

        <Group gap="xs">
          {showToolSelector && (
            <Tooltip label="工具设置">
              <ActionIcon
                variant={toolSelectorOpened ? 'filled' : 'light'}
                color="blue"
                onClick={toggleToolSelector}
              >
                <IconSettings size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          {showThoughtProcess && (
            <Tooltip label="思考过程">
              <ActionIcon
                variant={thoughtPanelOpened ? 'filled' : 'light'}
                color="grape"
                onClick={toggleThoughtPanel}
              >
                <IconBrain size={18} />
              </ActionIcon>
            </Tooltip>
          )}

          <Tooltip label="清空对话">
            <ActionIcon variant="light" color="red" onClick={handleClear}>
              <IconRefresh size={18} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* 工具选择器面板 */}
      {showToolSelector && (
        <Collapse in={toolSelectorOpened}>
          <Paper p="md" bg="gray.0">
            <ToolSelector />
          </Paper>
        </Collapse>
      )}

      {/* 主内容区域 */}
      <Group
        style={{ flex: 1, overflow: 'hidden' }}
        align="stretch"
        wrap="nowrap"
        gap={0}
      >
        {/* 聊天消息区域 */}
        <Stack style={{ flex: 1, minWidth: 0 }} gap={0}>
          <ScrollArea
            style={{ flex: 1 }}
            viewportRef={scrollViewportRef}
            p="md"
          >
            <Stack gap="md">
              {displayMessages.length === 0 ? (
                <Paper p="xl" bg="gray.0" radius="md" ta="center">
                  <ThemeIcon size="xl" radius="xl" color="blue" variant="light" mb="md">
                    <IconRobot size={32} />
                  </ThemeIcon>
                  <Text fw={500} mb="xs">
                    开始与 AI 助手对话
                  </Text>
                  <Text size="sm" c="dimmed">
                    我可以帮你搜索信息、查找 GitHub 项目、生成项目代码等
                  </Text>
                </Paper>
              ) : (
                displayMessages.map((message, index) => (
                  <MessageBubble
                    key={index}
                    message={message}
                    isLast={index === displayMessages.length - 1}
                  />
                ))
              )}

              {/* 错误提示 */}
              {error && (
                <Paper p="sm" bg="red.0" c="red.7" radius="md">
                  <Text size="sm">{error}</Text>
                </Paper>
              )}
            </Stack>
          </ScrollArea>

          {/* 输入区域 */}
          <Box p="md" style={{ borderTop: '1px solid #eee' }}>
            <ChatInput
              onSend={handleSendMessage}
              disabled={isLoading}
              placeholder={placeholder}
            />
          </Box>
        </Stack>

        {/* 思考过程侧边栏 */}
        {showThoughtProcess && !isMobile && (
          <Collapse in={thoughtPanelOpened} direction="horizontal">
            <Box
              w={300}
              h="100%"
              style={{ borderLeft: '1px solid #eee' }}
            >
              <ThoughtProcess steps={thoughtSteps} />
            </Box>
          </Collapse>
        )}
      </Group>

      {/* 移动端思考过程面板 */}
      {showThoughtProcess && isMobile && thoughtPanelOpened && (
        <Paper p="md" style={{ borderTop: '1px solid #eee' }}>
          <ThoughtProcess steps={thoughtSteps} />
        </Paper>
      )}
    </Paper>
  )
}

export default AgentChatPanel
