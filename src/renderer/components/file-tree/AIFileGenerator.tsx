/**
 * AIFileGenerator - AI 文件生成器组件
 * 监听 AI 对话中的代码块，自动识别文件路径和代码内容，提供一键生成文件功能
 */

import {
  Stack,
  Group,
  Text,
  Button,
  Card,
  Badge,
  Progress,
  Alert,
  TextInput,
  Select,
  ActionIcon,
  Tooltip,
  Collapse,
  List,
  ThemeIcon,
} from '@mantine/core'
import {
  IconFilePlus,
  IconCheck,
  IconX,
  IconFolder,
  IconCode,
  IconRefresh,
  IconChevronDown,
  IconChevronRight,
  IconDownload,
  IconTrash,
  IconAlertCircle,
} from '@tabler/icons-react'
import { memo, useState, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'

/**
 * 代码块信息接口
 */
interface CodeBlock {
  /** 唯一标识 */
  id: string
  /** 检测到的文件路径 */
  filePath: string
  /** 编程语言 */
  language: string
  /** 代码内容 */
  content: string
  /** 代码行数 */
  lineCount: number
  /** 是否已生成 */
  generated: boolean
  /** 生成时间 */
  generatedAt?: number
  /** 生成错误信息 */
  error?: string
}

/**
 * 生成进度状态
 */
interface GenerationProgress {
  /** 当前进度（0-100） */
  progress: number
  /** 当前处理的文件索引 */
  currentIndex: number
  /** 总文件数 */
  total: number
  /** 当前文件名 */
  currentFile: string
  /** 是否正在生成 */
  isGenerating: boolean
}

/**
 * AI 文件生成器组件 Props
 */
interface AIFileGeneratorProps {
  /** 可选的初始代码块列表 */
  initialCodeBlocks?: CodeBlock[]
  /** 默认保存路径 */
  defaultSavePath?: string
  /** 生成完成回调 */
  onGenerationComplete?: (blocks: CodeBlock[]) => void
}

/**
 * 从代码块内容中提取文件路径
 * 支持多种格式：注释、markdown 代码块标记等
 * @param content 代码内容
 * @param language 编程语言
 * @returns 提取的文件路径或 null
 */
function extractFilePath(content: string, language: string): string | null {
  // 尝试从第一行注释中提取路径
  const lines = content.split('\n')
  if (lines.length === 0) return null

  const firstLine = lines[0].trim()

  // 匹配常见注释格式中的文件路径
  const patterns = [
    // // path/to/file.js 或 # path/to/file.py
    /^[#/]{2,}\s*(.+)$/,
    // /* path/to/file.js */
    /^\/\*\s*(.+?)\s*\*\$/,
    // <!-- path/to/file.html -->
    /^<!--\s*(.+?)\s*-->$/,
    // 文件路径直接作为开头（相对路径或绝对路径）
    /^(?:\.\/|\/|\w:\\\\|\\w+\/)[\w\-./\\]+\.\w+$/,
  ]

  for (const pattern of patterns) {
    const match = firstLine.match(pattern)
    if (match) {
      const potentialPath = match[1] || match[0]
      // 验证路径格式
      if (isValidFilePath(potentialPath)) {
        return potentialPath
      }
    }
  }

  return null
}

/**
 * 验证是否为有效的文件路径
 * @param path 路径字符串
 * @returns 是否有效
 */
function isValidFilePath(path: string): boolean {
  // 简单的路径验证：包含文件名和扩展名
  return /[\w\-]+\.\w{1,10}$/.test(path) && !path.includes(' ')
}

/**
 * 根据语言推断文件扩展名
 * @param language 编程语言
 * @returns 文件扩展名
 */
function getExtensionFromLanguage(language: string): string {
  const extensionMap: Record<string, string> = {
    javascript: 'js',
    typescript: 'ts',
    python: 'py',
    java: 'java',
    cpp: 'cpp',
    c: 'c',
    go: 'go',
    rust: 'rs',
    html: 'html',
    css: 'css',
    json: 'json',
    yaml: 'yaml',
    yml: 'yml',
    markdown: 'md',
    sql: 'sql',
    shell: 'sh',
    bash: 'sh',
    powershell: 'ps1',
    xml: 'xml',
    php: 'php',
    ruby: 'rb',
    swift: 'swift',
    kotlin: 'kt',
    dart: 'dart',
  }

  return extensionMap[language.toLowerCase()] || 'txt'
}

/**
 * 模拟从 AI 消息中提取代码块
 * 实际项目中应该监听消息流
 * @returns 代码块数组
 */
function extractCodeBlocksFromMessages(): CodeBlock[] {
  // 这里模拟从消息中提取的代码块
  // 实际实现中应该监听 AI 消息流并实时提取
  return []
}

/**
 * AI 文件生成器组件
 * 监听 AI 对话中的代码块，提供一键生成文件功能
 */
const AIFileGenerator = memo<AIFileGeneratorProps>(
  ({ initialCodeBlocks = [], defaultSavePath = '', onGenerationComplete }) => {
    const { t } = useTranslation()

    // 本地状态
    const [codeBlocks, setCodeBlocks] = useState<CodeBlock[]>(initialCodeBlocks)
    const [savePath, setSavePath] = useState(defaultSavePath)
    const [selectedBlocks, setSelectedBlocks] = useState<Set<string>>(new Set())
    const [progress, setProgress] = useState<GenerationProgress>({
      progress: 0,
      currentIndex: 0,
      total: 0,
      currentFile: '',
      isGenerating: false,
    })
    const [detailsOpen, setDetailsOpen] = useState(true)
    const [generationResults, setGenerationResults] = useState<{
      success: string[]
      failed: { path: string; error: string }[]
    }>({ success: [], failed: [] })

    // 计算统计数据
    const stats = useMemo(() => {
      const total = codeBlocks.length
      const generated = codeBlocks.filter((b) => b.generated).length
      const pending = total - generated
      const hasErrors = codeBlocks.some((b) => b.error)
      return { total, generated, pending, hasErrors }
    }, [codeBlocks])

    /**
     * 切换代码块选择状态
     */
    const toggleBlockSelection = useCallback((blockId: string) => {
      setSelectedBlocks((prev) => {
        const newSet = new Set(prev)
        if (newSet.has(blockId)) {
          newSet.delete(blockId)
        } else {
          newSet.add(blockId)
        }
        return newSet
      })
    }, [])

    /**
     * 选择所有代码块
     */
    const selectAllBlocks = useCallback(() => {
      setSelectedBlocks(new Set(codeBlocks.map((b) => b.id)))
    }, [codeBlocks])

    /**
     * 取消选择所有代码块
     */
    const deselectAllBlocks = useCallback(() => {
      setSelectedBlocks(new Set())
    }, [])

    /**
     * 移除代码块
     */
    const removeBlock = useCallback((blockId: string) => {
      setCodeBlocks((prev) => prev.filter((b) => b.id !== blockId))
      setSelectedBlocks((prev) => {
        const newSet = new Set(prev)
        newSet.delete(blockId)
        return newSet
      })
    }, [])

    /**
     * 更新代码块的文件路径
     */
    const updateBlockPath = useCallback((blockId: string, newPath: string) => {
      setCodeBlocks((prev) =>
        prev.map((b) => (b.id === blockId ? { ...b, filePath: newPath } : b))
      )
    }, [])

    /**
     * 模拟生成单个文件
     * 实际项目中应该调用文件系统 API
     */
    const generateFile = useCallback(async (block: CodeBlock): Promise<boolean> => {
      // 模拟文件生成延迟
      await new Promise((resolve) => setTimeout(resolve, 500))

      // 这里应该调用实际的文件系统写入 API
      // 例如：await window.electronAPI.writeFile(fullPath, block.content)

      // 模拟随机失败（实际项目中根据实际写入结果）
      if (Math.random() > 0.95) {
        throw new Error('Permission denied')
      }

      return true
    }, [])

    /**
     * 批量生成选中的文件
     */
    const generateSelectedFiles = useCallback(async () => {
      const blocksToGenerate = codeBlocks.filter(
        (b) => selectedBlocks.has(b.id) && !b.generated
      )

      if (blocksToGenerate.length === 0) return

      setProgress({
        progress: 0,
        currentIndex: 0,
        total: blocksToGenerate.length,
        currentFile: '',
        isGenerating: true,
      })

      const success: string[] = []
      const failed: { path: string; error: string }[] = []

      for (let i = 0; i < blocksToGenerate.length; i++) {
        const block = blocksToGenerate[i]
        const fullPath = savePath ? `${savePath}/${block.filePath}` : block.filePath

        setProgress((prev) => ({
          ...prev,
          currentIndex: i + 1,
          currentFile: block.filePath,
          progress: ((i + 1) / blocksToGenerate.length) * 100,
        }))

        try {
          await generateFile(block)
          success.push(block.filePath)
          setCodeBlocks((prev) =>
            prev.map((b) =>
              b.id === block.id
                ? { ...b, generated: true, generatedAt: Date.now(), error: undefined }
                : b
            )
          )
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          failed.push({ path: block.filePath, error: errorMsg })
          setCodeBlocks((prev) =>
            prev.map((b) =>
              b.id === block.id ? { ...b, error: errorMsg } : b
            )
          )
        }
      }

      setGenerationResults({ success, failed })
      setProgress((prev) => ({ ...prev, isGenerating: false }))
      onGenerationComplete?.(codeBlocks)
    }, [codeBlocks, selectedBlocks, savePath, generateFile, onGenerationComplete])

    /**
     * 刷新代码块列表（从 AI 消息中重新提取）
     */
    const refreshCodeBlocks = useCallback(() => {
      const newBlocks = extractCodeBlocksFromMessages()
      setCodeBlocks(newBlocks)
      setSelectedBlocks(new Set(newBlocks.map((b) => b.id)))
    }, [])

    // 如果没有代码块，显示空状态
    if (codeBlocks.length === 0) {
      return (
        <Card withBorder radius="md" p="xl">
          <Stack align="center" gap="md">
            <ThemeIcon size={64} radius="xl" color="gray" variant="light">
              <IconCode size={32} />
            </ThemeIcon>
            <Text size="lg" fw={500} ta="center">
              {t('No Code Blocks Detected')}
            </Text>
            <Text size="sm" c="dimmed" ta="center" maw={400}>
              {t(
                'AI File Generator monitors AI conversations for code blocks with file paths. When detected, you can generate files with one click.'
              )}
            </Text>
            <Button
              variant="light"
              leftSection={<IconRefresh size={16} />}
              onClick={refreshCodeBlocks}
            >
              {t('Refresh')}
            </Button>
          </Stack>
        </Card>
      )
    }

    return (
      <Stack gap="md">
        {/* 标题和统计 */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <IconFilePlus size={20} />
            <Text fw={600}>{t('AI File Generator')}</Text>
            <Badge size="sm" variant="light" color="blue">
              {stats.generated}/{stats.total}
            </Badge>
          </Group>
          <Group gap="xs">
            <Button
              variant="subtle"
              size="xs"
              leftSection={<IconRefresh size={14} />}
              onClick={refreshCodeBlocks}
            >
              {t('Refresh')}
            </Button>
            <ActionIcon
              variant="subtle"
              onClick={() => setDetailsOpen(!detailsOpen)}
            >
              {detailsOpen ? (
                <IconChevronDown size={18} />
              ) : (
                <IconChevronRight size={18} />
              )}
            </ActionIcon>
          </Group>
        </Group>

        {/* 保存路径设置 */}
        <TextInput
          label={t('Save Location')}
          placeholder={t('Enter directory path...')}
          value={savePath}
          onChange={(e) => setSavePath(e.currentTarget.value)}
          leftSection={<IconFolder size={16} />}
          size="sm"
        />

        {/* 批量操作按钮 */}
        <Group gap="xs">
          <Button variant="subtle" size="xs" onClick={selectAllBlocks}>
            {t('Select All')}
          </Button>
          <Button variant="subtle" size="xs" onClick={deselectAllBlocks}>
            {t('Deselect All')}
          </Button>
          <Button
            variant="filled"
            size="sm"
            leftSection={<IconDownload size={16} />}
            onClick={generateSelectedFiles}
            disabled={selectedBlocks.size === 0 || progress.isGenerating}
            loading={progress.isGenerating}
            ml="auto"
          >
            {t('Generate {{count}} Files', { count: selectedBlocks.size })}
          </Button>
        </Group>

        {/* 生成进度 */}
        {progress.isGenerating && (
          <Stack gap="xs">
            <Progress value={progress.progress} size="sm" radius="xs" />
            <Text size="xs" c="dimmed">
              {t('Generating {{current}}/{{total}}: {{file}}', {
                current: progress.currentIndex,
                total: progress.total,
                file: progress.currentFile,
              })}
            </Text>
          </Stack>
        )}

        {/* 生成结果 */}
        {generationResults.success.length > 0 && !progress.isGenerating && (
          <Alert
            icon={<IconCheck size={16} />}
            color="green"
            variant="light"
            withCloseButton
            onClose={() => setGenerationResults({ success: [], failed: [] })}
          >
            {t('Successfully generated {{count}} files', {
              count: generationResults.success.length,
            })}
          </Alert>
        )}

        {generationResults.failed.length > 0 && !progress.isGenerating && (
          <Alert
            icon={<IconAlertCircle size={16} />}
            color="red"
            variant="light"
            withCloseButton
            onClose={() => setGenerationResults({ success: [], failed: [] })}
          >
            <Text size="sm" fw={500}>
              {t('Failed to generate {{count}} files', {
                count: generationResults.failed.length,
              })}
            </Text>
            <List size="xs" mt="xs">
              {generationResults.failed.map((item) => (
                <List.Item key={item.path} c="red">
                  {item.path}: {item.error}
                </List.Item>
              ))}
            </List>
          </Alert>
        )}

        {/* 代码块列表 */}
        <Collapse in={detailsOpen}>
          <Stack gap="xs">
            {codeBlocks.map((block) => (
              <Card
                key={block.id}
                withBorder
                radius="sm"
                p="sm"
                style={{
                  opacity: block.generated ? 0.7 : 1,
                  borderColor: block.error ? 'var(--mantine-color-red-5)' : undefined,
                }}
              >
                <Stack gap="xs">
                  <Group justify="space-between" align="flex-start">
                    <Group gap="xs" align="center">
                      <input
                        type="checkbox"
                        checked={selectedBlocks.has(block.id)}
                        onChange={() => toggleBlockSelection(block.id)}
                        disabled={block.generated}
                      />
                      <TextInput
                        value={block.filePath}
                        onChange={(e) => updateBlockPath(block.id, e.currentTarget.value)}
                        size="xs"
                        style={{ width: 200 }}
                        disabled={block.generated}
                      />
                      <Badge size="xs" variant="light">
                        {block.language}
                      </Badge>
                      <Badge size="xs" variant="light" color="gray">
                        {block.lineCount} {t('lines')}
                      </Badge>
                    </Group>
                    <Group gap={4}>
                      {block.generated && (
                        <Tooltip label={t('Generated')}>
                          <ThemeIcon size="sm" color="green" variant="light">
                            <IconCheck size={14} />
                          </ThemeIcon>
                        </Tooltip>
                      )}
                      {block.error && (
                        <Tooltip label={block.error}>
                          <ThemeIcon size="sm" color="red" variant="light">
                            <IconX size={14} />
                          </ThemeIcon>
                        </Tooltip>
                      )}
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={() => removeBlock(block.id)}
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Group>
                  </Group>

                  {/* 代码预览 */}
                  <Card
                    withBorder
                    radius="xs"
                    p="xs"
                    bg="gray.0"
                    style={{ maxHeight: 100, overflow: 'auto' }}
                  >
                    <Text
                      size="xs"
                      component="pre"
                      style={{
                        margin: 0,
                        fontFamily: 'monospace',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all',
                      }}
                    >
                      {block.content.slice(0, 500)}
                      {block.content.length > 500 && '...'}
                    </Text>
                  </Card>
                </Stack>
              </Card>
            ))}
          </Stack>
        </Collapse>
      </Stack>
    )
  }
)

AIFileGenerator.displayName = 'AIFileGenerator'

export default AIFileGenerator
