/**
 * ProjectGeneratorPanel.tsx
 * 项目生成器面板组件
 *
 * 接入万象Chat的 AI 模型系统，通过真实 AI 生成项目代码。
 * 支持：
 * - 用户输入描述后，发送给 AI（带系统提示要求输出项目文件）
 * - AI 回复后解析代码块，提取文件路径和内容
 * - 生成的项目展示：目录树支持折叠/展开
 * - 文件查看器支持全屏显示
 * - 使用 Mantine 的 Accordion 实现目录折叠
 * - 编辑器区域添加全屏按钮
 * - 支持中断生成
 */

import React, { useState, useCallback, useMemo } from 'react'
import {
  Stack,
  Group,
  TextInput,
  Button,
  Paper,
  Text,
  Badge,
  Select,
  Textarea,
  Checkbox,
  Progress,
  Accordion,
  ThemeIcon,
  ActionIcon,
  Tooltip,
  Box,
  Divider,
  ScrollArea,
  Code,
  Modal,
  Loader,
  Alert,
  Flex,
} from '@mantine/core'
import {
  IconCode,
  IconBrandReact,
  IconBrandVue,
  IconBrandPython,
  IconBrandNodejs,
  IconDeviceMobile,
  IconBrandAndroid,
  IconFolder,
  IconFile,
  IconDownload,
  IconRefresh,
  IconCheck,
  IconX,
  IconFolderOpen,
  IconChevronRight,
  IconChevronDown,
  IconChevronLeft,
  IconSparkles,
  IconMaximize,
  IconMinimize,
  IconSquare,
  IconHistory,
  IconTrash,
} from '@tabler/icons-react'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { getModel } from '@shared/models'
import { getModelSettings } from '@shared/utils/model_settings'
import type { ModelInterface } from '@shared/models/types'
import type { Message, StreamTextResult } from '@shared/types'
import { createModelDependencies } from '@/adapters'
import { streamText } from '@/packages/model-calls'
import { settingsStore } from '@/stores/settingsStore'
import { lastUsedModelStore } from '@/stores/lastUsedModelStore'
import Markdown from '@/components/Markdown'

/**
 * 项目类型配置
 */
const PROJECT_TYPE_CONFIG: Record<
  string,
  {
    icon: React.ElementType
    color: string
    description: string
  }
> = {
  react: {
    icon: IconBrandReact,
    color: 'blue',
    description: 'React 前端应用',
  },
  vue: {
    icon: IconBrandVue,
    color: 'green',
    description: 'Vue 前端应用',
  },
  python: {
    icon: IconBrandPython,
    color: 'yellow',
    description: 'Python 项目',
  },
  nodejs: {
    icon: IconBrandNodejs,
    color: 'green',
    description: 'Node.js 后端项目',
  },
  flutter: {
    icon: IconDeviceMobile,
    color: 'cyan',
    description: 'Flutter 移动应用',
  },
  android: {
    icon: IconBrandAndroid,
    color: 'green',
    description: 'Android 原生应用',
  },
  generic: {
    icon: IconFolder,
    color: 'gray',
    description: '通用项目结构',
  },
}

/**
 * 项目类型列表
 */
const PROJECT_TYPES = [
  { id: 'react', name: 'React' },
  { id: 'vue', name: 'Vue' },
  { id: 'python', name: 'Python' },
  { id: 'nodejs', name: 'Node.js' },
  { id: 'flutter', name: 'Flutter' },
  { id: 'android', name: 'Android' },
  { id: 'generic', name: 'Generic' },
]

/**
 * 生成的文件
 */
interface GeneratedFile {
  path: string
  content: string
  language: string
}

/**
 * 项目生成历史记录
 */
interface ProjectHistoryItem {
  id: string
  name: string
  type: string
  description: string
  fileCount: number
  createdAt: number
  files: GeneratedFile[]
}

/** localStorage 存储键 */
const PROJECT_HISTORY_KEY = 'chatbox_project_generator_history'

/**
 * 文件树节点类型
 */
interface FileTreeNode {
  id: string
  label: string
  type: 'file' | 'directory'
  children?: FileTreeNode[]
  file?: GeneratedFile
}

/**
 * 获取 Electron API
 */
function getElectronAPI(): any {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI
  }
  return null
}

/**
 * 从 localStorage 加载项目历史记录
 */
function loadProjectHistory(): ProjectHistoryItem[] {
  try {
    if (typeof localStorage === 'undefined') return []
    const data = localStorage.getItem(PROJECT_HISTORY_KEY)
    if (!data) return []
    return JSON.parse(data) as ProjectHistoryItem[]
  } catch {
    return []
  }
}

/**
 * 保存项目历史记录到 localStorage
 */
function saveProjectHistory(history: ProjectHistoryItem[]): void {
  try {
    if (typeof localStorage === 'undefined') return
    localStorage.setItem(PROJECT_HISTORY_KEY, JSON.stringify(history))
  } catch {
    // localStorage 可能已满或不可用
  }
}

/**
 * 生成唯一 ID
 */
function generateId(): string {
  return `proj_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
}

/**
 * 格式化时间戳
 */
function formatTimestamp(ts: number): string {
  const date = new Date(ts)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMinutes = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMinutes < 1) return '刚刚'
  if (diffMinutes < 60) return `${diffMinutes} 分钟前`
  if (diffHours < 24) return `${diffHours} 小时前`
  if (diffDays < 7) return `${diffDays} 天前`

  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/**
 * 构建项目生成的系统提示
 */
function buildProjectSystemPrompt(projectType: string, projectName: string): string {
  return `你是一个专业的项目生成助手。用户会描述他们想要的项目，你需要生成完整的项目文件。

项目类型: ${projectType}
项目名称: ${projectName}

请严格按照以下格式输出每个文件，每个文件用代码块包裹，代码块的语言标注为文件路径：

\`\`\`filepath:src/index.tsx
// 文件内容
\`\`\`

\`\`\`filepath:package.json
{
  "name": "${projectName}",
  ...
}
\`\`\`

要求：
1. 生成完整可运行的项目代码
2. 每个文件必须使用 \`\`\`filepath:路径 格式标注
3. 包含 package.json / pyproject.toml / pubspec.yaml 等项目配置文件
4. 包含 README.md 文件
5. 代码要符合最佳实践
6. 只输出代码块，不要输出多余的解释文字`
}

/**
 * 从 AI 回复中解析文件
 * 支持格式: ```filepath:path\ncontent\n```
 */
function parseFilesFromResponse(text: string): GeneratedFile[] {
  const files: GeneratedFile[] = []

  // 匹配 ```filepath:path 或 ```language:path 格式
  const regex = /```(?:filepath|[\w]+):([^\n]+)\n([\s\S]*?)```/g
  let match

  while ((match = regex.exec(text)) !== null) {
    const filePath = match[1].trim()
    const content = match[2].trim()

    // 推断语言
    const ext = filePath.split('.').pop() || ''
    const languageMap: Record<string, string> = {
      ts: 'typescript',
      tsx: 'typescript',
      js: 'javascript',
      jsx: 'javascript',
      py: 'python',
      rs: 'rust',
      go: 'go',
      java: 'java',
      kt: 'kotlin',
      dart: 'dart',
      json: 'json',
      yaml: 'yaml',
      yml: 'yaml',
      toml: 'toml',
      md: 'markdown',
      css: 'css',
      scss: 'scss',
      html: 'html',
      xml: 'xml',
      sh: 'bash',
      bash: 'bash',
      sql: 'sql',
      graphql: 'graphql',
      vue: 'vue',
      svelte: 'svelte',
    }

    files.push({
      path: filePath,
      content,
      language: languageMap[ext] || ext || 'text',
    })
  }

  return files
}

/**
 * 构建文件树
 */
function buildFileTree(files: GeneratedFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  const nodeMap = new Map<string, FileTreeNode>()

  files.forEach((file) => {
    const parts = file.path.split('/').filter(Boolean)
    let currentPath = ''

    parts.forEach((part, index) => {
      const isLast = index === parts.length - 1
      const parentPath = currentPath
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (!nodeMap.has(currentPath)) {
        const node: FileTreeNode = {
          id: currentPath,
          label: part,
          type: isLast ? 'file' : 'directory',
          ...(isLast && { file }),
          ...(!isLast && { children: [] }),
        }

        nodeMap.set(currentPath, node)

        if (parentPath) {
          const parent = nodeMap.get(parentPath)
          if (parent && parent.children) {
            parent.children.push(node)
          }
        } else {
          root.push(node)
        }
      }
    })
  })

  // 排序：目录在前，文件在后
  const sortNodes = (nodes: FileTreeNode[]): FileTreeNode[] => {
    return nodes.sort((a, b) => {
      if (a.type === 'directory' && b.type === 'file') return -1
      if (a.type === 'file' && b.type === 'directory') return 1
      return a.label.localeCompare(b.label)
    }).map((node) => {
      if (node.children) {
        return { ...node, children: sortNodes(node.children) }
      }
      return node
    })
  }

  return sortNodes(root)
}

/**
 * 文件树组件属性
 */
interface FileTreeProps {
  nodes: FileTreeNode[]
  onSelectFile?: (file: GeneratedFile) => void
  selectedFile?: string
}

/**
 * 文件树组件
 * 使用 Accordion 实现目录折叠/展开
 */
function FileTree({ nodes, onSelectFile, selectedFile }: FileTreeProps) {
  return (
    <Stack gap={2}>
      {nodes.map((node) => (
        <FileTreeNodeComponent
          key={node.id}
          node={node}
          onSelectFile={onSelectFile}
          selectedFile={selectedFile}
          level={0}
        />
      ))}
    </Stack>
  )
}

/**
 * 文件树节点组件
 */
interface FileTreeNodeComponentProps {
  node: FileTreeNode
  onSelectFile?: (file: GeneratedFile) => void
  selectedFile?: string
  level: number
}

function FileTreeNodeComponent({
  node,
  onSelectFile,
  selectedFile,
  level,
}: FileTreeNodeComponentProps) {
  const [opened, { toggle }] = useDisclosure(true)
  const isSelected = selectedFile === node.id

  const handleClick = () => {
    if (node.type === 'directory') {
      toggle()
    } else if (node.file && onSelectFile) {
      onSelectFile(node.file)
    }
  }

  const Icon = node.type === 'directory' ? IconFolder : IconFile
  const color = node.type === 'directory' ? 'yellow' : 'blue'

  return (
    <Box>
      <Group
        gap="xs"
        pl={level * 16}
        py={4}
        style={{
          cursor: 'pointer',
          borderRadius: 4,
          backgroundColor: isSelected ? 'var(--mantine-color-blue-0)' : undefined,
        }}
        onClick={handleClick}
      >
        {node.type === 'directory' && (
          <ThemeIcon size="xs" variant="transparent">
            {opened ? <IconChevronDown size={14} /> : <IconChevronRight size={14} />}
          </ThemeIcon>
        )}
        <ThemeIcon size="sm" color={color} variant="light">
          <Icon size={14} />
        </ThemeIcon>
        <Text size="sm" fw={node.type === 'directory' ? 500 : 400}>
          {node.label}
        </Text>
      </Group>

      {node.type === 'directory' && node.children && (
        <Box
          style={{
            maxHeight: opened ? '2000px' : '0',
            overflow: 'hidden',
            transition: 'max-height 0.3s ease',
          }}
        >
          {node.children.map((child) => (
            <FileTreeNodeComponent
              key={child.id}
              node={child}
              onSelectFile={onSelectFile}
              selectedFile={selectedFile}
              level={level + 1}
            />
          ))}
        </Box>
      )}
    </Box>
  )
}

/**
 * 文件查看器组件属性
 */
interface FileViewerProps {
  file: GeneratedFile | null
  isFullscreen?: boolean
  onToggleFullscreen?: () => void
}

/**
 * 文件查看器组件
 * 支持全屏显示
 */
function FileViewer({ file, isFullscreen, onToggleFullscreen }: FileViewerProps) {
  if (!file) {
    return (
      <Flex justify="center" align="center" h="100%">
        <Text c="dimmed">选择左侧文件查看内容</Text>
      </Flex>
    )
  }

  return (
    <Stack gap="xs" h="100%">
      {/* 文件头部 */}
      <Group justify="space-between">
        <Group gap="xs">
          <ThemeIcon size="sm" color="blue" variant="light">
            <IconFile size={14} />
          </ThemeIcon>
          <Text fw={500} size="sm">
            {file.path}
          </Text>
          <Badge size="sm" variant="light">
            {file.language}
          </Badge>
        </Group>
        {onToggleFullscreen && (
          <Tooltip label={isFullscreen ? '退出全屏' : '全屏查看'}>
            <ActionIcon variant="subtle" onClick={onToggleFullscreen}>
              {isFullscreen ? <IconMinimize size={16} /> : <IconMaximize size={16} />}
            </ActionIcon>
          </Tooltip>
        )}
      </Group>

      {/* 文件内容 */}
      <Paper
        p="sm"
        bg="dark.9"
        radius="sm"
        style={{
          flex: 1,
          overflow: 'auto',
          minHeight: 0, // 关键：允许 flex 子项收缩
          fontFamily: 'monospace',
          fontSize: isFullscreen ? '14px' : '12px',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
          color: 'var(--mantine-color-gray-0)',
          lineHeight: 1.6,
        }}
      >
        <Box style={{ minWidth: '100%' }}>
          {file.content}
        </Box>
      </Paper>
    </Stack>
  )
}

/**
 * 项目生成器面板组件属性
 */
interface ProjectGeneratorPanelProps {
  className?: string
}

/**
 * 项目生成器面板组件
 *
 * 通过 AI 模型生成项目代码，解析 AI 回复中的代码块提取文件。
 */
export function ProjectGeneratorPanel({ className }: ProjectGeneratorPanelProps) {
  // 表单状态
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectType, setProjectType] = useState<string>('react')

  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedFiles, setGeneratedFiles] = useState<GeneratedFile[]>([])
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [streamingText, setStreamingText] = useState('')

  // 项目历史记录
  const [projectHistory, setProjectHistory] = useState<ProjectHistoryItem[]>(() => loadProjectHistory())

  // UI 状态
  const [previewModalOpened, { open: openPreviewModal, close: closePreviewModal }] = useDisclosure()
  const [isViewerFullscreen, { toggle: toggleViewerFullscreen }] = useDisclosure(false)
  const isMobile = useMediaQuery('(max-width: 768px)')
  const [treeCollapsed, setTreeCollapsed] = useState(false)
  const [modalTreeCollapsed, setModalTreeCollapsed] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState<string | null>(null)

  // AbortController 引用
  const abortControllerRef = React.useRef<AbortController | null>(null)

  // 构建文件树
  const fileTree = useMemo(() => {
    if (generatedFiles.length === 0) return []
    return buildFileTree(generatedFiles)
  }, [generatedFiles])

  /**
   * 通过 AI 生成项目
   */
  const handleGenerate = useCallback(async () => {
    if (!projectName.trim() || !projectDescription.trim()) {
      setError('请填写项目名称和描述')
      return
    }

    setIsGenerating(true)
    setGeneratedFiles([])
    setSelectedFile(null)
    setError(null)
    setStreamingText('')

    // 创建 AbortController
    const abortController = new AbortController()
    abortControllerRef.current = abortController

    try {
      // 获取模型实例
      const globalSettings = settingsStore.getState().getSettings()
      const lastUsedChatModel = lastUsedModelStore.getState().chat

      const provider = lastUsedChatModel?.provider
      const modelId = lastUsedChatModel?.modelId

      if (!provider || !modelId) {
        throw new Error('未配置模型，请先在设置中选择一个聊天模型')
      }

      const sessionSettings = getModelSettings(globalSettings, provider, modelId)
      const { default: platform } = await import('@/platform')
      const configs = await platform.getConfig()
      const dependencies = await createModelDependencies()
      const model = getModel(sessionSettings, globalSettings, configs, dependencies)

      // 构造消息
      const systemPrompt = buildProjectSystemPrompt(
        PROJECT_TYPE_CONFIG[projectType]?.description || projectType,
        projectName
      )

      const messages: Message[] = [
        {
          id: 'system',
          role: 'system',
          contentParts: [{ type: 'text', text: systemPrompt }],
          tokenCalculatedAt: {},
        },
        {
          id: 'user',
          role: 'user',
          contentParts: [{ type: 'text', text: projectDescription }],
          tokenCalculatedAt: {},
        },
      ]

      // 调用 streamText 流式生成
      const { result } = await streamText(model, {
        messages,
        onResultChangeWithCancel: (data) => {
          if (data.cancel) {
            abortControllerRef.current = {
              abort: data.cancel,
            } as AbortController
          }
          // 更新流式文本
          const text = data.contentParts
            ?.filter((p) => p.type === 'text')
            .map((p) => p.text)
            .join('') || ''
          setStreamingText(text)
        },
      }, abortController.signal)

      // 获取最终文本
      const finalText = result.contentParts
        ?.filter((p) => p.type === 'text')
        .map((p) => p.text)
        .join('') || ''

      setStreamingText(finalText)

      // 解析文件
      const files = parseFilesFromResponse(finalText)
      if (files.length === 0) {
        setError('AI 未返回有效的项目文件，请尝试更详细的描述')
      } else {
        setGeneratedFiles(files)
        // 自动选择第一个文件
        setSelectedFile(files[0])

        // 保存到历史记录
        const historyItem: ProjectHistoryItem = {
          id: generateId(),
          name: projectName,
          type: projectType,
          description: projectDescription,
          fileCount: files.length,
          createdAt: Date.now(),
          files: files,
        }
        const updatedHistory = [historyItem, ...projectHistory].slice(0, 50) // 最多保留 50 条记录
        setProjectHistory(updatedHistory)
        saveProjectHistory(updatedHistory)
      }
    } catch (err) {
      if (abortController.signal.aborted) {
        // 用户取消，不显示错误
      } else {
        setError(err instanceof Error ? err.message : '生成失败')
      }
    } finally {
      setIsGenerating(false)
      abortControllerRef.current = null
    }
  }, [projectName, projectDescription, projectType])

  /**
   * 停止生成
   */
  const handleStop = useCallback(() => {
    abortControllerRef.current?.abort()
    setIsGenerating(false)
  }, [])

  /**
   * 保存项目到本地
   */
  const handleSave = useCallback(async () => {
    if (generatedFiles.length === 0) return

    try {
      const api = getElectronAPI()
      if (!api) {
        setError('当前环境不支持保存文件')
        return
      }

      // 默认保存到 ~/Projects/项目名/
      const homeDir = await api.invoke('file:get-home-dir') || process.cwd()
      const outputDir = `${homeDir}/Projects/${projectName}`

      // 创建目录
      await api.invoke('file:create-directory', outputDir)

      // 保存所有文件
      let savedCount = 0
      for (const file of generatedFiles) {
        const filePath = `${outputDir}/${file.path}`
        // 确保父目录存在
        const dir = filePath.substring(0, filePath.lastIndexOf('/'))
        if (dir && dir !== outputDir) {
          try {
            await api.invoke('file:create-directory', dir)
          } catch {
            // 目录可能已存在
          }
        }
        // 写入文件
        await api.invoke('file:write', filePath, file.content)
        savedCount++
      }

      // 显示成功提示（使用状态而不是弹窗）
      setSaveSuccess(`项目已保存到: ${outputDir}`)
      setTimeout(() => setSaveSuccess(null), 5000)
    } catch (err) {
      setError(`保存失败: ${err instanceof Error ? err.message : '未知错误'}`)
    }
  }, [generatedFiles, projectName])

  /**
   * 从历史记录加载项目
   */
  const handleLoadFromHistory = useCallback((item: ProjectHistoryItem) => {
    setProjectName(item.name)
    setProjectDescription(item.description)
    setProjectType(item.type)
    setGeneratedFiles(item.files)
    setSelectedFile(item.files[0] || null)
    setError(null)
    setStreamingText('')
  }, [])

  /**
   * 删除历史记录
   */
  const handleDeleteHistory = useCallback((id: string) => {
    const updatedHistory = projectHistory.filter((item) => item.id !== id)
    setProjectHistory(updatedHistory)
    saveProjectHistory(updatedHistory)
  }, [projectHistory])

  /**
   * 清空所有历史记录
   */
  const handleClearHistory = useCallback(() => {
    setProjectHistory([])
    saveProjectHistory([])
  }, [])

  return (
    <Stack gap="lg" className={className}>
      {/* 头部 */}
      <Group justify="space-between">
        <Group gap="sm">
          <ThemeIcon size="lg" color="blue" variant="light">
            <IconSparkles size={24} />
          </ThemeIcon>
          <Text fw={500} size="lg">
            AI 项目生成器
          </Text>
        </Group>

        {generatedFiles.length > 0 && (
          <Badge size="lg" color="green" leftSection={<IconCheck size={14} />}>
            已生成 {generatedFiles.length} 个文件
          </Badge>
        )}
      </Group>

      {/* 错误提示 */}
      {error && (
        <Alert color="red" icon={<IconX size={16} />} withCloseButton onClose={() => setError(null)}>
          {error}
        </Alert>
      )}

      {/* 成功提示 */}
      {saveSuccess && (
        <Alert color="green" icon={<IconCheck size={16} />} withCloseButton onClose={() => setSaveSuccess(null)}>
          {saveSuccess}
        </Alert>
      )}

      {/* 项目配置表单 */}
      <Paper p="md" radius="md" withBorder>
        <Stack gap="md">
          <Text fw={500}>项目配置</Text>

          {/* 项目名称 */}
          <TextInput
            label="项目名称"
            placeholder="my-awesome-project"
            value={projectName}
            onChange={(e) => setProjectName(e.currentTarget.value)}
            required
          />

          {/* 项目描述 */}
          <Textarea
            label="项目描述"
            placeholder="描述你的项目需求，例如：创建一个 React 电商网站，包含商品列表、购物车和支付功能..."
            value={projectDescription}
            onChange={(e) => setProjectDescription(e.currentTarget.value)}
            minRows={3}
            required
          />

          <Divider />

          {/* 项目类型选择 */}
          <Text size="sm" fw={500}>
            项目类型
          </Text>
          <Group gap="md">
            {PROJECT_TYPES.map((type) => {
              const config = PROJECT_TYPE_CONFIG[type.id]
              const Icon = config.icon
              const isSelected = projectType === type.id

              return (
                <Paper
                  key={type.id}
                  p="md"
                  radius="md"
                  withBorder
                  style={{
                    cursor: 'pointer',
                    borderColor: isSelected ? `var(--mantine-color-${config.color}-6)` : undefined,
                    backgroundColor: isSelected ? `var(--mantine-color-${config.color}-0)` : undefined,
                    minWidth: 80,
                  }}
                  onClick={() => setProjectType(type.id)}
                >
                  <Stack align="center" gap="xs">
                    <ThemeIcon size="xl" radius="md" color={config.color} variant={isSelected ? 'filled' : 'light'}>
                      <Icon size={28} />
                    </ThemeIcon>
                    <Text fw={500} size="sm">
                      {type.name}
                    </Text>
                  </Stack>
                </Paper>
              )
            })}
          </Group>

          {/* 生成按钮 */}
          <Group gap="xs">
            <Button
              size="lg"
              leftSection={<IconCode size={20} />}
              onClick={handleGenerate}
              loading={isGenerating}
              disabled={!projectName.trim() || !projectDescription.trim()}
              style={{ flex: 1 }}
            >
              AI 生成项目
            </Button>

            {isGenerating && (
              <Button
                size="lg"
                color="red"
                variant="light"
                leftSection={<IconSquare size={20} />}
                onClick={handleStop}
              >
                停止
              </Button>
            )}
          </Group>

          {/* 生成进度 */}
          {isGenerating && (
            <Box>
              <Group justify="space-between" mb="xs">
                <Text size="sm" c="dimmed">
                  AI 正在生成项目代码...
                </Text>
                <Loader size="xs" />
              </Group>
              <Progress animated value={33} />
            </Box>
          )}
        </Stack>
      </Paper>

      {/* AI 流式输出预览（生成中） */}
      {isGenerating && streamingText && (
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" mb="xs">
            <Text size="sm" fw={500}>AI 生成中...</Text>
            <Badge size="sm" color="blue" variant="light">流式输出</Badge>
          </Group>
          <ScrollArea h={200}>
            <Paper p="sm" bg="gray.0" radius="sm">
              <Box style={{ fontSize: '13px' }}>
                <Markdown>{streamingText || ''}</Markdown>
              </Box>
            </Paper>
          </ScrollArea>
        </Paper>
      )}

      {/* 生成结果展示 */}
      {generatedFiles.length > 0 && (
        <Paper p="md" radius="md" withBorder>
          <Stack gap="md">
            <Group justify="space-between">
              <Text fw={500}>生成结果</Text>
              <Group gap="xs">
                <Button
                  variant="light"
                  size="sm"
                  leftSection={<IconFolderOpen size={16} />}
                  onClick={openPreviewModal}
                >
                  预览文件
                </Button>
                <Button
                  size="sm"
                  leftSection={<IconDownload size={16} />}
                  onClick={handleSave}
                >
                  保存项目
                </Button>
              </Group>
            </Group>

            {/* 项目统计 */}
            <Group gap="md">
              <Badge size="sm" variant="light">
                {generatedFiles.length} 个文件
              </Badge>
              <Badge size="sm" variant="light" color="blue">
                {PROJECT_TYPE_CONFIG[projectType]?.description}
              </Badge>
            </Group>

            {/* 文件树 + 文件查看器 */}
            <Flex gap="md" style={{ minHeight: 400 }} align="stretch">
              {/* 文件树 - 可收起 */}
              <Paper p="sm" style={{ width: treeCollapsed ? 40 : 250, minWidth: treeCollapsed ? 40 : 200, overflow: 'auto', transition: 'width 0.3s' }}>
                <Group justify="space-between" mb="xs">
                  {!treeCollapsed && <Text size="sm" fw={500}>文件列表</Text>}
                  <ActionIcon size="sm" variant="subtle" onClick={() => setTreeCollapsed(!treeCollapsed)}>
                    {treeCollapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
                  </ActionIcon>
                </Group>
                {!treeCollapsed && (
                  <ScrollArea h={350}>
                    <FileTree
                      nodes={fileTree}
                      onSelectFile={setSelectedFile}
                      selectedFile={selectedFile?.path}
                    />
                  </ScrollArea>
                )}
              </Paper>

              {/* 文件查看器 */}
              <Paper p="sm" style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                <FileViewer
                  file={selectedFile}
                  isFullscreen={isViewerFullscreen}
                  onToggleFullscreen={toggleViewerFullscreen}
                />
              </Paper>
            </Flex>
          </Stack>
        </Paper>
      )}

      {/* 项目生成历史记录 */}
      {projectHistory.length > 0 && (
        <Paper p="md" radius="md" withBorder>
          <Group justify="space-between" mb="sm">
            <Group gap="xs">
              <ThemeIcon size="sm" color="violet" variant="light">
                <IconHistory size={14} />
              </ThemeIcon>
              <Text fw={500} size="sm">
                生成记录
              </Text>
              <Badge size="sm" variant="light" color="violet">
                {projectHistory.length}
              </Badge>
            </Group>
            <Button
              variant="subtle"
              size="xs"
              color="red"
              leftSection={<IconTrash size={12} />}
              onClick={handleClearHistory}
            >
              清空记录
            </Button>
          </Group>

          <ScrollArea h={Math.min(projectHistory.length * 60, 300)}>
            <Stack gap="xs">
              {projectHistory.map((item) => {
                const typeConfig = PROJECT_TYPE_CONFIG[item.type]
                const TypeIcon = typeConfig?.icon || IconFolder

                return (
                  <Paper
                    key={item.id}
                    p="xs"
                    radius="sm"
                    withBorder
                    style={{
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                    }}
                    onClick={() => handleLoadFromHistory(item)}
                  >
                    <Group justify="space-between" wrap="nowrap">
                      <Group gap="xs" wrap="nowrap" style={{ overflow: 'hidden' }}>
                        <ThemeIcon size="sm" color={typeConfig?.color || 'gray'} variant="light">
                          <TypeIcon size={14} />
                        </ThemeIcon>
                        <div style={{ overflow: 'hidden' }}>
                          <Text size="sm" fw={500} lineClamp={1}>
                            {item.name}
                          </Text>
                          <Text size="xs" c="dimmed" lineClamp={1}>
                            {item.fileCount} 个文件 - {formatTimestamp(item.createdAt)}
                          </Text>
                        </div>
                      </Group>
                      <Group gap="xs" wrap="nowrap">
                        <Badge size="xs" variant="light" color={typeConfig?.color || 'gray'}>
                          {item.type}
                        </Badge>
                        <Tooltip label="删除记录">
                          <ActionIcon
                            size="xs"
                            variant="subtle"
                            color="red"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDeleteHistory(item.id)
                            }}
                          >
                            <IconTrash size={12} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Group>
                  </Paper>
                )
              })}
            </Stack>
          </ScrollArea>
        </Paper>
      )}

      {/* 文件预览模态框（全屏） */}
      <Modal
        opened={previewModalOpened}
        onClose={closePreviewModal}
        title="项目文件预览"
        size="xl"
        fullScreen={isMobile}
      >
        {/* 移动端：上下布局；PC端：左右布局 */}
        <Flex
          gap="md"
          direction={isMobile ? 'column' : 'row'}
          style={{ height: isMobile ? 'calc(100vh - 150px)' : 500 }}
          align="stretch"
        >
          {/* 文件树 - 可收起 */}
          <Paper
            p="sm"
            style={{
              width: isMobile
                ? '100%'
                : modalTreeCollapsed ? 40 : 250,
              minWidth: isMobile ? '100%' : modalTreeCollapsed ? 40 : 200,
              maxWidth: isMobile ? '100%' : '45%',
              height: isMobile ? '40%' : '100%',
              overflow: 'auto',
              transition: 'width 0.3s',
              flexShrink: 0,
            }}
          >
            <Group justify="space-between" mb="xs">
              {!modalTreeCollapsed && <Text size="sm" fw={500}>文件列表</Text>}
              <ActionIcon size="sm" variant="subtle" onClick={() => setModalTreeCollapsed(!modalTreeCollapsed)}>
                {modalTreeCollapsed ? <IconChevronRight size={16} /> : <IconChevronLeft size={16} />}
              </ActionIcon>
            </Group>
            {!modalTreeCollapsed && (
              <ScrollArea h={isMobile ? '100%' : 450}>
                <FileTree
                  nodes={fileTree}
                  onSelectFile={setSelectedFile}
                  selectedFile={selectedFile?.path}
                />
              </ScrollArea>
            )}
          </Paper>

          {/* 文件内容 */}
          <Paper
            p="sm"
            style={{
              flex: 1,
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              minWidth: 0,
            }}
          >
            <FileViewer file={selectedFile} />
          </Paper>
        </Flex>
      </Modal>
    </Stack>
  )
}

export default ProjectGeneratorPanel
