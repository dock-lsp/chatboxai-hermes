/**
 * AgentChatPanel.tsx
 * 智能体聊天面板组件
 *
 * 接入万象Chat的 AI 模型系统，提供真实的流式 AI 对话体验。
 * 支持：
 * - 真实 AI 流式回复（通过 streamText）
 * - AI 思考过程可视化（reasoningContent）- 折叠显示在消息中
 * - 工具调用过程和结果展示
 * - 中断生成
 * - Markdown 渲染
 * - 顶部模型选择按钮
 */

import React, { useState, useRef, useCallback, useEffect, useMemo } from 'react'
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
  Modal,
  Tabs,
  Textarea,
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
  IconCpu,
  IconPaperclip,
  IconFileZip,
  IconPhoto,
  IconFile,
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
import { processUploadedFile, formatFileSize, UploadedFile, getFileIconType } from '@/packages/agent/tools/file-uploader'
import { ToolSelector } from './ToolSelector'
import Markdown from '@/components/Markdown'
import { useSettingsStore } from '@/stores/settingsStore'
import { useProviders } from '@/hooks/useProviders'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'

/**
 * 思考过程折叠组件属性
 */
interface ReasoningCollapseProps {
  reasoning: string
}

/**
 * 思考过程折叠组件
 * 显示在 AI 消息中的可折叠思考过程
 */
function ReasoningCollapse({ reasoning }: ReasoningCollapseProps) {
  const [opened, { toggle }] = useDisclosure(false)

  if (!reasoning || reasoning.trim() === '') {
    return null
  }

  return (
    <Box mt="sm">
      <Paper
        p="xs"
        bg="gray.1"
        radius="sm"
        style={{ cursor: 'pointer' }}
        onClick={toggle}
      >
        <Group gap="xs" justify="space-between">
          <Group gap="xs">
            <ThemeIcon size="sm" color="grape" variant="light">
              <IconBrain size={14} />
            </ThemeIcon>
            <Text size="xs" c="grape" fw={500}>
              思考过程
            </Text>
          </Group>
          <ActionIcon size="sm" variant="subtle" color="gray">
            {opened ? <IconChevronUp size={14} /> : <IconChevronDown size={14} />}
          </ActionIcon>
        </Group>
      </Paper>

      <Collapse in={opened}>
        <Paper
          p="sm"
          mt="xs"
          bg="gray.0"
          radius="sm"
          style={{
            borderLeft: '3px solid var(--mantine-color-grape-6)',
          }}
        >
          <Text
            size="xs"
            c="dimmed"
            style={{
              whiteSpace: 'pre-wrap',
              fontFamily: 'monospace',
              lineHeight: 1.5,
            }}
          >
            {reasoning}
          </Text>
        </Paper>
      </Collapse>
    </Box>
  )
}

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
 * 支持 Markdown 渲染和思考过程显示
 */
function MessageBubble({ message, isLast }: MessageBubbleProps) {
  const isUser = message.role === 'user'
  const isSystem = message.role === 'system'
  const isTool = message.role === 'tool'

  // 系统消息不显示
  if (isSystem) return null

  // 从消息中提取思考过程（如果有的话）
  // 注意：这里假设 reasoningContent 可能存储在消息的某个字段中
  // 实际项目中可能需要根据实际数据结构调整
  const reasoningContent = (message as any).reasoningContent || ''

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

          {/* 显示思考过程（仅 AI 消息） */}
          {!isUser && !isTool && reasoningContent && (
            <ReasoningCollapse reasoning={reasoningContent} />
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
 * 流式消息气泡组件属性
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
          {/* 思考过程折叠显示 */}
          {reasoning && <ReasoningCollapse reasoning={reasoning} />}

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
  onSend: (message: string, files?: UploadedFile[]) => void
  disabled?: boolean
  placeholder?: string
}

/**
 * 文件附件预览组件
 */
function FileAttachmentPreview({
  file,
  onRemove,
}: {
  file: UploadedFile
  onRemove: (id: string) => void
}) {
  const iconType = getFileIconType(file.name)

  const getIcon = () => {
    switch (iconType) {
      case 'image':
        return <IconPhoto size={16} />
      case 'zip':
        return <IconFileZip size={16} />
      default:
        return <IconFile size={16} />
    }
  }

  return (
    <Paper
      p="xs"
      radius="sm"
      bg="gray.1"
      style={{ display: 'flex', alignItems: 'center', gap: '8px' }}
    >
      <ThemeIcon size="sm" variant="light" color="blue">
        {getIcon()}
      </ThemeIcon>
      <Stack gap={0} style={{ flex: 1, minWidth: 0 }}>
        <Text size="xs" truncate style={{ maxWidth: 150 }}>
          {file.name}
        </Text>
        <Text size="xs" c="dimmed">
          {formatFileSize(file.size)}
        </Text>
      </Stack>
      <ActionIcon
        size="sm"
        variant="subtle"
        color="red"
        onClick={() => onRemove(file.id)}
      >
        <IconX size={14} />
      </ActionIcon>
    </Paper>
  )
}

/**
 * 聊天输入框组件
 * 支持多行输入、文件上传和发送
 */
function ChatInput({ onSend, disabled, placeholder }: ChatInputProps) {
  const [value, setValue] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleSend = useCallback(() => {
    if ((value.trim() || attachedFiles.length > 0) && !disabled) {
      onSend(value.trim(), attachedFiles.length > 0 ? attachedFiles : undefined)
      setValue('')
      setAttachedFiles([])
    }
  }, [value, attachedFiles, disabled, onSend])

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files
    if (!files || files.length === 0) return

    setIsUploading(true)
    try {
      for (const file of Array.from(files)) {
        // 使用 Electron 的 webUtils.getPathForFile 获取文件路径
        const filePath = (file as any).path || (window as any).electron?.webUtils?.getPathForFile?.(file)
        if (!filePath) {
          console.error('无法获取文件路径')
          continue
        }
        const uploadedFile = await processUploadedFile(filePath)
        setAttachedFiles((prev) => [...prev, uploadedFile])
      }
    } catch (error) {
      console.error('文件上传失败:', error)
    } finally {
      setIsUploading(false)
      // 重置 input
      if (fileInputRef.current) {
        fileInputRef.current.value = ''
      }
    }
  }

  const handleRemoveFile = (fileId: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== fileId))
  }

  const handleUploadClick = () => {
    fileInputRef.current?.click()
  }

  return (
    <Stack gap="xs">
      {/* 文件附件预览 */}
      {attachedFiles.length > 0 && (
        <Group gap="xs" wrap="wrap">
          {attachedFiles.map((file) => (
            <FileAttachmentPreview
              key={file.id}
              file={file}
              onRemove={handleRemoveFile}
            />
          ))}
        </Group>
      )}

      <Group gap="xs" align="flex-end">
        {/* 文件上传按钮 */}
        <Tooltip label="上传文件">
          <ActionIcon
            variant="light"
            color="gray"
            size="lg"
            onClick={handleUploadClick}
            disabled={disabled || isUploading}
            loading={isUploading}
          >
            <IconPaperclip size={20} />
          </ActionIcon>
        </Tooltip>

        {/* 隐藏的文件输入 */}
        <input
          ref={fileInputRef}
          type="file"
          style={{ display: 'none' }}
          onChange={handleFileSelect}
          multiple
          accept="image/*,.zip,.txt,.md,.json,.js,.ts,.jsx,.tsx,.vue,.html,.css,.scss,.less,.py,.java,.c,.cpp,.h,.hpp,.cs,.go,.rs,.rb,.php,.sh,.sql,.pdf,.doc,.docx,.xml,.yaml,.yml"
        />

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
              disabled={(!value.trim() && attachedFiles.length === 0) || disabled}
              onClick={handleSend}
            >
              <IconSend size={16} />
            </ActionIcon>
          }
        />
      </Group>
    </Stack>
  )
}

/**
 * 模型选择弹窗组件属性
 */
interface ModelSelectorModalProps {
  opened: boolean
  onClose: () => void
  providers: any[]
  selectedModel: { provider: string; modelId: string }
  onSelect: (provider: string, modelId: string) => void
}

/**
 * 模型选择弹窗组件
 * 显示按 provider 分组的模型列表
 */
function ModelSelectorModal({
  opened,
  onClose,
  providers,
  selectedModel,
  onSelect,
}: ModelSelectorModalProps) {
  const [searchQuery, setSearchQuery] = useState('')

  // 过滤模型
  const filteredProviders = useMemo(() => {
    if (!searchQuery.trim()) return providers

    const query = searchQuery.toLowerCase()
    return providers
      .map((provider) => ({
        ...provider,
        models: provider.models?.filter(
          (model: any) =>
            model.name?.toLowerCase().includes(query) ||
            model.modelId?.toLowerCase().includes(query) ||
            model.nickname?.toLowerCase().includes(query)
        ),
      }))
      .filter((provider) => provider.models?.length > 0)
  }, [providers, searchQuery])

  const handleSelect = (providerId: string, modelId: string) => {
    onSelect(providerId, modelId)
    onClose()
  }

  // 获取当前选中模型的显示名称
  const getCurrentModelName = () => {
    if (!selectedModel.provider || !selectedModel.modelId) return '选择模型'
    const provider = providers.find((p) => p.id === selectedModel.provider)
    const model = provider?.models?.find((m: any) => m.modelId === selectedModel.modelId)
    return model?.name || model?.nickname || selectedModel.modelId
  }

  return (
    <Modal
      opened={opened}
      onClose={onClose}
      title="选择 AI 模型"
      size="lg"
      centered
    >
      <Stack gap="md">
        {/* 搜索框 */}
        <TextInput
          placeholder="搜索模型..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.currentTarget.value)}
          leftSection={<IconSearch size={16} />}
        />

        {/* 当前选中模型 */}
        {selectedModel.provider && selectedModel.modelId && (
          <Paper p="sm" bg="blue.0" radius="sm">
            <Group gap="xs">
              <Text size="sm" fw={500}>
                当前模型:
              </Text>
              <Badge color="blue" variant="light">
                {getCurrentModelName()}
              </Badge>
            </Group>
          </Paper>
        )}

        {/* 模型列表 - 按 provider 分组 */}
        <ScrollArea h={400}>
          <Stack gap="md">
            {filteredProviders.map((provider) => (
              <Box key={provider.id}>
                <Group gap="xs" mb="xs">
                  <ThemeIcon size="sm" color="gray" variant="light">
                    <IconCpu size={14} />
                  </ThemeIcon>
                  <Text fw={500} size="sm">
                    {provider.name}
                  </Text>
                  <Badge size="xs" variant="light" color="gray">
                    {provider.models?.length || 0}
                  </Badge>
                </Group>

                <Stack gap="xs" pl="md">
                  {provider.models?.map((model: any) => {
                    const isSelected =
                      selectedModel.provider === provider.id &&
                      selectedModel.modelId === model.modelId
                    return (
                      <Paper
                        key={`${provider.id}/${model.modelId}`}
                        p="sm"
                        radius="sm"
                        bg={isSelected ? 'blue.0' : 'gray.0'}
                        style={{ cursor: 'pointer' }}
                        onClick={() => handleSelect(provider.id, model.modelId)}
                      >
                        <Group justify="space-between">
                          <Stack gap={0}>
                            <Text size="sm" fw={isSelected ? 500 : 400}>
                              {model.name || model.nickname || model.modelId}
                            </Text>
                            {model.modelId !== model.name && model.name && (
                              <Text size="xs" c="dimmed">
                                {model.modelId}
                              </Text>
                            )}
                          </Stack>
                          {isSelected && (
                            <ThemeIcon size="sm" color="blue" variant="light">
                              <IconCheck size={14} />
                            </ThemeIcon>
                          )}
                        </Group>
                      </Paper>
                    )
                  })}
                </Stack>
              </Box>
            ))}

            {filteredProviders.length === 0 && (
              <Paper p="xl" bg="gray.0" radius="md" ta="center">
                <Text c="dimmed">未找到匹配的模型</Text>
              </Paper>
            )}
          </Stack>
        </ScrollArea>
      </Stack>
    </Modal>
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
 * 思考过程展示（折叠在消息中）、工具调用可视化等功能。
 * 接入万象Chat的模型系统，使用 streamText 进行流式生成。
 */
export function AgentChatPanel({
  sessionId,
  showToolSelector = true,
  placeholder,
  height = '100%',
  className,
}: AgentChatPanelProps) {
  // 状态管理
  const session = useCurrentSession()
  const messages = useCurrentMessages()
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
  const { providers } = useProviders()
  const [selectedModel, setSelectedModel] = useState<{ provider: string; modelId: string }>(() => {
    const lastUsed = lastUsedModelStore.getState().chat
    return lastUsed || { provider: '', modelId: '' }
  })

  // UI 状态
  const [toolSelectorOpened, { toggle: toggleToolSelector }] = useDisclosure(false)
  const [modelModalOpened, { open: openModelModal, close: closeModelModal }] = useDisclosure(false)
  const scrollViewportRef = useRef<HTMLDivElement>(null)

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
   * 获取当前模型的显示名称
   */
  const currentModelDisplayName = useMemo(() => {
    if (!selectedModel.provider || !selectedModel.modelId) {
      return '选择模型'
    }
    const provider = providers.find((p) => p.id === selectedModel.provider)
    const model = provider?.models?.find((m: any) => m.modelId === selectedModel.modelId)
    // 修复：如果 modelId 是 undefined，显示友好的提示
    if (!model || selectedModel.modelId === 'undefined') {
      return '选择模型'
    }
    return model.name || model.nickname || selectedModel.modelId
  }, [selectedModel, providers])

  /**
   * 发送消息处理
   * 使用 Agent 的 sendMessageStream 进行流式生成
   */
  const handleSendMessage = useCallback(
    async (content: string, files?: UploadedFile[]) => {
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
        // 使用 Agent 的流式发送方法，传入模型配置和附件
        const stream = agent.sendMessageStream(currentSessionId, content, {
          signal: abortController.signal,
          modelConfig: selectedModel.provider && selectedModel.modelId ? selectedModel : undefined,
          attachments: files,
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

  // 处理模型选择
  const handleModelSelect = (provider: string, modelId: string) => {
    setSelectedModel({ provider, modelId })
    // 更新 lastUsedModelStore
    lastUsedModelStore.getState().setChatModel(provider, modelId)
  }

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
          {/* 模型选择按钮 */}
          <Button
            variant="light"
            size="sm"
            leftSection={<IconCpu size={16} />}
            onClick={openModelModal}
            disabled={isGenerating}
          >
            {currentModelDisplayName}
          </Button>

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

      {/* 模型选择弹窗 */}
      <ModelSelectorModal
        opened={modelModalOpened}
        onClose={closeModelModal}
        providers={providers}
        selectedModel={selectedModel}
        onSelect={handleModelSelect}
      />

      {/* 主内容区域 - 聊天消息 */}
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
    </Paper>
  )
}

export default AgentChatPanel
