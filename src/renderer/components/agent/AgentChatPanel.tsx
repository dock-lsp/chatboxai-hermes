/**
 * AgentChatPanel.tsx
 * 智能体聊天面板组件
 *
 * 接入万象Chat的 AI 模型系统，提供真实的流式 AI 对话体验。
 * 支持：
 * - 真实 AI 流式回复（通过 streamText）
 * - AI 思考过程可视化（reasoningContent）
 * - 工具调用过程和结果展示
 * - 中断生成
 * - Markdown 渲染
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
  Select,
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
  IconSquare,
  IconSparkles,
} from '@tabler/icons-react'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import type {
  AgentMessage,
  ThoughtStep,
  ToolCall,
} from '@/packages/agent'
import {
  useAgentStore,
  useCurrentSession,
  useCurrentMessages,
  useCurrentThoughtSteps,
} from '@/packages/agent'
import { ThoughtProcess } from './ThoughtProcess'
import { ToolSelector } from './ToolSelector'
import Markdown from '@/components/Markdown'
import { useSettingsStore } from '@/stores/settingsStore'
import { useProviders } from '@/hooks/useProviders'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'

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
 * 支持 Markdown 渲染
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
          {isUser ? (
            <Text size="sm" style={{ whiteSpace: 'pre-wrap' }}>
              {message.content}
            </Text>
          ) : (
            <Box style={{ fontSize: '14px' }}>
              <Markdown>{message.content || ''}</Markdown>
            </Box>
          )}

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
 * 流式消息气泡组件
 * 显示正在流式生成的 AI 回复
 */
interface StreamingMessageProps {
  content: string
  reasoning: string
  toolCalls: ToolCall[]
}

/**
 * 流式消息气泡组件
 */
function StreamingMessage({ content, reasoning, toolCalls }: StreamingMessageProps) {
  const [showReasoning, { toggle: toggleReasoning }] = useDisclosure(false)

  if (!content && !reasoning && toolCalls.length === 0) {
    return null
  }

  return (
    <Flex direction="column" align="flex-start" gap="xs" w="100%">
      <Group gap="xs" align="flex-start">
        <ThemeIcon size="md" radius="xl" color="blue" variant="light">
          <IconRobot size={16} />
        </ThemeIcon>

        <Paper
          p="md"
          radius="lg"
          bg="gray.0"
          c="dark"
          maw="80%"
          style={{ borderBottomLeftRadius: 4 }}
        >
          {/* 推理内容折叠 */}
          {reasoning && (
            <Box mb="sm">
              <Group gap="xs" mb={4}>
                <ActionIcon
                  size="xs"
                  variant="subtle"
                  color="grape"
                  onClick={toggleReasoning}
                >
                  <IconBrain size={14} />
                </ActionIcon>
                <Text size="xs" c="grape" fw={500} style={{ cursor: 'pointer' }} onClick={toggleReasoning}>
                  思考过程
                </Text>
              </Group>
              <Collapse in={showReasoning}>
                <Paper p="xs" bg="grape.0" radius="sm">
                  <Text size="xs" c="grape" style={{ whiteSpace: 'pre-wrap', fontStyle: 'italic' }}>
                    {reasoning}
                  </Text>
                </Paper>
              </Collapse>
            </Box>
          )}

          {/* 工具调用 */}
          {toolCalls.length > 0 && (
            <Stack gap="xs" mb="sm">
              {toolCalls.map((toolCall, index) => (
                <ToolCallBadge key={index} toolCall={toolCall} />
              ))}
            </Stack>
          )}

          {/* 流式文本内容 */}
          {content && (
            <Box style={{ fontSize: '14px' }}>
              <Markdown>{content || ''}</Markdown>
            </Box>
          )}

          {/* 加载指示器 */}
          {!content && (
            <Group gap="xs">
              <Loader size="xs" />
              <Text size="xs" c="dimmed">正在思考...</Text>
            </Group>
          )}
        </Paper>
      </Group>
    </Flex>
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
 * 主聊天界面组件，整合真实 AI 流式回复、消息显示、
 * 思考过程展示、工具调用可视化等功能。
 * 接入万象Chat的模型系统，使用 streamText 进行流式生成。
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
  const isStreaming = useAgentStore((state) => state.isStreaming)
  const error = useAgentStore((state) => state.error)
  const streamingContent = useAgentStore((state) => state.streamingContent)
  const streamingReasoning = useAgentStore((state) => state.streamingReasoning)
  const streamingToolCalls = useAgentStore((state) => state.streamingToolCalls)
  const createSession = useAgentStore((state) => state.createSession)
  const clearMessages = useAgentStore((state) => state.clearMessages)
  const stopGeneration = useAgentStore((state) => state.stopGeneration)
  const agent = useAgentStore((state) => state.agent)

  // 模型选择状态
  const { getSettings } = useSettingsStore()
  const { providers } = useProviders()
  const [selectedModel, setSelectedModel] = useState<{provider: string, modelId: string}>(() => {
    const lastUsed = lastUsedModelStore.getState().chat
    return lastUsed || { provider: '', modelId: '' }
  })

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
  }, [messages, streamingContent])

  /**
   * 发送消息处理
   * 使用 Agent 的 sendMessageStream 进行流式生成
   */
  const handleSendMessage = useCallback(
    async (content: string) => {
      // 确保有会话
      let currentSessionId = session?.id
      if (!currentSessionId) {
        currentSessionId = createSession()
      }

      // 创建 AbortController 用于中断
      const abortController = new AbortController()
      useAgentStore.setState({
        isStreaming: true,
        isLoading: true,
        error: null,
        abortController,
        streamingContent: '',
        streamingReasoning: '',
        streamingToolCalls: [],
      })

      try {
        // 使用 Agent 的流式发送方法，传入模型配置
        const stream = agent.sendMessageStream(currentSessionId, content, {
          signal: abortController.signal,
          modelConfig: selectedModel.provider && selectedModel.modelId ? selectedModel : undefined,
        })

        for await (const chunk of stream) {
          // 检查是否已中断
          if (abortController.signal.aborted) {
            break
          }

          switch (chunk.type) {
            case 'text':
              useAgentStore.getState().appendStreamingContent(chunk.content || '')
              break

            case 'thought':
              // 思考步骤已在 Agent 内部管理
              break

            case 'reasoning':
              useAgentStore.getState().appendStreamingReasoning(chunk.content || '')
              break

            case 'tool_call':
              if (chunk.toolCall) {
                useAgentStore.getState().addStreamingToolCall(chunk.toolCall)
              }
              break

            case 'error':
              useAgentStore.setState({
                error: chunk.error || '未知错误',
              })
              break

            case 'done':
              // 流式完成，更新会话状态
              const updatedSession = agent.getSession(currentSessionId!)
              if (updatedSession) {
                useAgentStore.setState((state) => ({
                  sessions: state.sessions.map((s) =>
                    s.id === currentSessionId ? updatedSession : s
                  ),
                }))
              }
              break
          }
        }
      } catch (err) {
        // 检查是否是取消操作
        if (abortController.signal.aborted) {
          // 用户主动取消，不显示错误
        } else {
          useAgentStore.setState({
            error: err instanceof Error ? err.message : '发送消息失败',
          })
        }
      } finally {
        useAgentStore.setState({
          isStreaming: false,
          isLoading: false,
          abortController: null,
        })
      }
    },
    [session, createSession, agent, selectedModel]
  )

  // 清空对话
  const handleClear = useCallback(() => {
    if (session) {
      clearMessages(session.id)
    }
  }, [session, clearMessages])

  // 停止生成
  const handleStop = useCallback(() => {
    stopGeneration()
  }, [stopGeneration])

  // 过滤掉系统消息
  const displayMessages = messages.filter((m) => m.role !== 'system')

  // 是否正在生成中
  const isGenerating = isLoading || isStreaming

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
            <IconSparkles size={20} />
          </ThemeIcon>
          <Text fw={500}>AI 智能体助手</Text>
          {isGenerating && <Loader size="sm" />}
          {isStreaming && (
            <Badge size="sm" color="blue" variant="light">
              流式生成中
            </Badge>
          )}
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
              {displayMessages.length === 0 && !isGenerating ? (
                <Paper p="xl" bg="gray.0" radius="md" ta="center">
                  <ThemeIcon size="xl" radius="xl" color="blue" variant="light" mb="md">
                    <IconSparkles size={32} />
                  </ThemeIcon>
                  <Text fw={500} mb="xs">
                    开始与 AI 助手对话
                  </Text>
                  <Text size="sm" c="dimmed">
                    我可以帮你搜索信息、查找 GitHub 项目、生成项目代码等。
                    回复将使用万象Chat配置的 AI 模型生成。
                  </Text>
                </Paper>
              ) : (
                <>
                  {displayMessages.map((message, index) => (
                    <MessageBubble
                      key={index}
                      message={message}
                      isLast={index === displayMessages.length - 1}
                    />
                  ))}

                  {/* 流式消息气泡 */}
                  {isGenerating && (
                    <StreamingMessage
                      content={streamingContent}
                      reasoning={streamingReasoning}
                      toolCalls={streamingToolCalls}
                    />
                  )}
                </>
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
            {/* 模型选择器 */}
            <Group gap="xs" mb="xs">
              <Select
                size="xs"
                placeholder="选择模型"
                value={selectedModel.provider && selectedModel.modelId ? `${selectedModel.provider}/${selectedModel.modelId}` : ''}
                onChange={(value) => {
                  if (value) {
                    const [provider, ...modelParts] = value.split('/')
                    const modelId = modelParts.join('/')
                    setSelectedModel({ provider, modelId })
                    // 更新 lastUsedModelStore
                    lastUsedModelStore.getState().setChatModel(provider, modelId)
                  } else {
                    setSelectedModel({ provider: '', modelId: '' })
                  }
                }}
                data={providers.flatMap((provider) =>
                  (provider.models || []).map((model) => ({
                    value: `${provider.id}/${model.modelId}`,
                    label: `${provider.name}/${model.name}`,
                  }))
                )}
                style={{ flex: 1, maxWidth: 300 }}
                disabled={isGenerating}
              />
            </Group>
            <Group gap="xs">
              <ChatInput
                onSend={handleSendMessage}
                disabled={isGenerating}
                placeholder={placeholder}
              />
              {/* 中断生成按钮 */}
              {isGenerating && (
                <Tooltip label="停止生成">
                  <ActionIcon
                    variant="filled"
                    color="red"
                    size="lg"
                    onClick={handleStop}
                  >
                    <IconSquare size={20} />
                  </ActionIcon>
                </Tooltip>
              )}
            </Group>
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
