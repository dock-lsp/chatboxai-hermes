/**
 * ProjectGeneratorPanel.tsx
 * 项目生成器面板组件
 *
 * 提供项目生成功能的完整界面，支持：
 * - 输入项目描述
 * - 选择项目类型（Flutter/React/Vue/Android/Python/Node.js）
 * - 显示生成的项目结构（树形）
 * - 显示生成的文件列表
 * - 一键保存到指定目录
 * - 进度显示
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
  Tree,
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
  FileInput,
  Loader,
  Alert,
  SegmentedControl,
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
  IconInfoCircle,
  IconSparkles,
  IconSettings,
} from '@tabler/icons-react'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import type {
  ProjectGenerationConfig,
  GeneratedFile,
  GeneratedProject,
} from '@/packages/agent'
import {
  generateProject,
  analyzeProjectRequirements,
  PROJECT_TYPES,
} from '@/packages/agent'

/**
 * 项目类型配置
 * 定义不同项目类型的图标、颜色和描述
 */
const PROJECT_TYPE_CONFIG: Record<
  string,
  {
    icon: React.ElementType
    color: string
    description: string
    features: string[]
  }
> = {
  react: {
    icon: IconBrandReact,
    color: 'blue',
    description: 'React 前端应用',
    features: ['Vite', 'TypeScript', 'ESLint', 'Prettier'],
  },
  vue: {
    icon: IconBrandVue,
    color: 'green',
    description: 'Vue 前端应用',
    features: ['Vite', 'TypeScript', 'Vue Router', 'Pinia'],
  },
  python: {
    icon: IconBrandPython,
    color: 'yellow',
    description: 'Python 项目',
    features: ['pyproject.toml', 'Ruff', 'MyPy', 'pytest'],
  },
  nodejs: {
    icon: IconBrandNodejs,
    color: 'green',
    description: 'Node.js 后端项目',
    features: ['TypeScript', 'Express/Fastify', 'Jest', 'ESLint'],
  },
  flutter: {
    icon: IconDeviceMobile,
    color: 'cyan',
    description: 'Flutter 移动应用',
    features: ['Material Design', '状态管理', '路由导航'],
  },
  android: {
    icon: IconBrandAndroid,
    color: 'green',
    description: 'Android 原生应用',
    features: ['Kotlin', 'Jetpack Compose', 'MVVM'],
  },
  generic: {
    icon: IconFolder,
    color: 'gray',
    description: '通用项目结构',
    features: ['README', '.gitignore'],
  },
}

/**
 * 项目特性选项
 */
const PROJECT_FEATURES: Record<string, { label: string; description: string }[]> = {
  react: [
    { label: 'router', description: 'React Router 路由' },
    { label: 'state-management', description: 'Zustand + React Query 状态管理' },
    { label: 'ui-library', description: 'Radix UI 组件库' },
    { label: 'styling', description: 'Tailwind CSS 样式' },
  ],
  vue: [
    { label: 'router', description: 'Vue Router 路由' },
    { label: 'state-management', description: 'Pinia 状态管理' },
  ],
  python: [
    { label: 'web-framework', description: 'FastAPI Web 框架' },
    { label: 'data-processing', description: 'Pandas + NumPy 数据处理' },
    { label: 'testing', description: 'pytest 测试框架' },
    { label: 'cli', description: 'Click CLI 工具' },
    { label: 'http-client', description: 'HTTPX 客户端' },
  ],
  nodejs: [
    { label: 'express', description: 'Express Web 框架' },
    { label: 'fastify', description: 'Fastify Web 框架' },
    { label: 'database', description: 'Prisma ORM + 数据库' },
    { label: 'testing', description: 'Jest 测试框架' },
    { label: 'http-client', description: 'Axios HTTP 客户端' },
  ],
  flutter: [
    { label: 'state-management', description: 'Provider/Riverpod 状态管理' },
    { label: 'routing', description: 'GoRouter 路由' },
    { label: 'local-storage', description: 'SharedPreferences 本地存储' },
    { label: 'http-client', description: 'Dio HTTP 客户端' },
  ],
  android: [
    { label: 'compose', description: 'Jetpack Compose UI' },
    { label: 'room', description: 'Room 数据库' },
    { label: 'retrofit', description: 'Retrofit 网络' },
    { label: 'hilt', description: 'Hilt 依赖注入' },
  ],
  generic: [],
}

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
 * 构建文件树
 * 从生成的文件列表构建树形结构
 */
function buildFileTree(files: GeneratedFile[]): FileTreeNode[] {
  const root: FileTreeNode[] = []
  const nodeMap = new Map<string, FileTreeNode>()

  files.forEach((file) => {
    const parts = file.path.split('/')
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

  return root
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
 * 递归渲染文件树
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
 * 文件树节点组件属性
 */
interface FileTreeNodeComponentProps {
  node: FileTreeNode
  onSelectFile?: (file: GeneratedFile) => void
  selectedFile?: string
  level: number
}

/**
 * 文件树节点组件
 */
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
        <Collapse in={opened}>
          {node.children.map((child) => (
            <FileTreeNodeComponent
              key={child.id}
              node={child}
              onSelectFile={onSelectFile}
              selectedFile={selectedFile}
              level={level + 1}
            />
          ))}
        </Collapse>
      )}
    </Box>
  )
}

/**
 * 项目类型卡片组件属性
 */
interface ProjectTypeCardProps {
  type: string
  isSelected: boolean
  onClick: () => void
}

/**
 * 项目类型卡片组件
 */
function ProjectTypeCard({ type, isSelected, onClick }: ProjectTypeCardProps) {
  const config = PROJECT_TYPE_CONFIG[type]
  const Icon = config.icon

  return (
    <Paper
      p="md"
      radius="md"
      withBorder
      style={{
        cursor: 'pointer',
        borderColor: isSelected ? `var(--mantine-color-${config.color}-6)` : undefined,
        backgroundColor: isSelected ? `var(--mantine-color-${config.color}-0)` : undefined,
      }}
      onClick={onClick}
    >
      <Stack align="center" gap="xs">
        <ThemeIcon size="xl" radius="md" color={config.color} variant={isSelected ? 'filled' : 'light'}>
          <Icon size={28} />
        </ThemeIcon>
        <Text fw={500} size="sm" tt="capitalize">
          {type}
        </Text>
        <Text size="xs" c="dimmed" ta="center">
          {config.description}
        </Text>
      </Stack>
    </Paper>
  )
}

/**
 * 项目生成器面板组件属性
 */
interface ProjectGeneratorPanelProps {
  /** 自定义样式 */
  className?: string
}

/**
 * 项目生成器面板组件
 *
 * 主组件，提供完整的项目生成界面
 */
export function ProjectGeneratorPanel({ className }: ProjectGeneratorPanelProps) {
  // 表单状态
  const [projectName, setProjectName] = useState('')
  const [projectDescription, setProjectDescription] = useState('')
  const [projectType, setProjectType] = useState<string>('react')
  const [selectedFeatures, setSelectedFeatures] = useState<string[]>([])
  const [outputPath, setOutputPath] = useState('')

  // 生成状态
  const [isGenerating, setIsGenerating] = useState(false)
  const [progress, setProgress] = useState(0)
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null)
  const [selectedFile, setSelectedFile] = useState<GeneratedFile | null>(null)
  const [error, setError] = useState<string | null>(null)

  // UI 状态
  const [previewModalOpened, { open: openPreviewModal, close: closePreviewModal }] = useDisclosure(false)
  const isMobile = useMediaQuery('(max-width: 768px)')

  // 获取当前项目类型的特性选项
  const availableFeatures = useMemo(() => {
    return PROJECT_FEATURES[projectType] || []
  }, [projectType])

  // 生成项目
  const handleGenerate = useCallback(async () => {
    if (!projectName.trim() || !projectDescription.trim()) {
      setError('请填写项目名称和描述')
      return
    }

    setIsGenerating(true)
    setProgress(0)
    setError(null)

    try {
      // 模拟进度
      const progressInterval = setInterval(() => {
        setProgress((p) => Math.min(p + 10, 90))
      }, 200)

      const config: ProjectGenerationConfig = {
        name: projectName,
        type: projectType as ProjectGenerationConfig['type'],
        description: projectDescription,
        features: selectedFeatures,
        outputPath: outputPath || `./${projectName}`,
      }

      const project = generateProject(config)

      clearInterval(progressInterval)
      setProgress(100)
      setGeneratedProject(project)
    } catch (err) {
      setError(err instanceof Error ? err.message : '生成失败')
    } finally {
      setIsGenerating(false)
    }
  }, [projectName, projectDescription, projectType, selectedFeatures, outputPath])

  // 保存项目
  const handleSave = useCallback(async () => {
    if (!generatedProject) return

    // 这里应该调用 Electron 的 IPC 或文件系统 API 保存文件
    console.log('保存项目到:', outputPath || `./${projectName}`)
    console.log('文件列表:', generatedProject.files.map((f) => f.path))

    // 模拟保存成功
    alert('项目保存功能需要集成文件系统 API')
  }, [generatedProject, outputPath, projectName])

  // 分析需求
  const handleAnalyze = useCallback(async () => {
    if (!projectDescription.trim()) {
      setError('请先输入项目描述')
      return
    }

    setIsGenerating(true)
    try {
      const analysis = await analyzeProjectRequirements({ description: projectDescription })
      if (analysis.analysis) {
        setProjectType(analysis.analysis.recommendedType)
        setSelectedFeatures(analysis.analysis.recommendedFeatures)
      }
    } catch (err) {
      setError('分析失败')
    } finally {
      setIsGenerating(false)
    }
  }, [projectDescription])

  // 切换特性选择
  const toggleFeature = (feature: string) => {
    setSelectedFeatures((prev) =>
      prev.includes(feature) ? prev.filter((f) => f !== feature) : [...prev, feature]
    )
  }

  // 构建文件树
  const fileTree = useMemo(() => {
    if (!generatedProject) return []
    return buildFileTree(generatedProject.files)
  }, [generatedProject])

  return (
    <Stack gap="lg" className={className}>
      {/* 头部 */}
      <Group justify="space-between">
        <Group gap="sm">
          <ThemeIcon size="lg" color="blue" variant="light">
            <IconSparkles size={24} />
          </ThemeIcon>
          <Text fw={500} size="lg">
            项目生成器
          </Text>
        </Group>

        {generatedProject && (
          <Badge size="lg" color="green" leftSection={<IconCheck size={14} />}>
            已生成
          </Badge>
        )}
      </Group>

      {/* 错误提示 */}
      {error && (
        <Alert color="red" icon={<IconX size={16} />} withCloseButton onClose={() => setError(null)}>
          {error}
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

          {/* 智能分析按钮 */}
          <Button
            variant="light"
            leftSection={<IconSparkles size={16} />}
            onClick={handleAnalyze}
            loading={isGenerating}
            disabled={!projectDescription.trim()}
          >
            智能分析推荐
          </Button>

          <Divider />

          {/* 项目类型选择 */}
          <Text size="sm" fw={500}>
            项目类型
          </Text>
          <Group gap="md">
            {PROJECT_TYPES.map((type) => (
              <ProjectTypeCard
                key={type.id}
                type={type.id}
                isSelected={projectType === type.id}
                onClick={() => setProjectType(type.id)}
              />
            ))}
          </Group>

          {/* 特性选择 */}
          {availableFeatures.length > 0 && (
            <>
              <Text size="sm" fw={500}>
                功能特性
              </Text>
              <Group gap="sm">
                {availableFeatures.map((feature) => (
                  <Checkbox
                    key={feature.label}
                    label={feature.description}
                    checked={selectedFeatures.includes(feature.label)}
                    onChange={() => toggleFeature(feature.label)}
                  />
                ))}
              </Group>
            </>
          )}

          {/* 输出路径 */}
          <TextInput
            label="输出路径"
            placeholder={`./${projectName || 'my-project'}`}
            value={outputPath}
            onChange={(e) => setOutputPath(e.currentTarget.value)}
            description="留空将使用默认路径"
          />

          {/* 生成按钮 */}
          <Button
            size="lg"
            leftSection={<IconCode size={20} />}
            onClick={handleGenerate}
            loading={isGenerating}
            disabled={!projectName.trim() || !projectDescription.trim()}
          >
            生成项目
          </Button>

          {/* 进度条 */}
          {isGenerating && (
            <Box>
              <Text size="sm" c="dimmed" mb="xs">
                正在生成项目...
              </Text>
              <Progress value={progress} animated />
            </Box>
          )}
        </Stack>
      </Paper>

      {/* 生成结果展示 */}
      {generatedProject && (
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
                {generatedProject.files.length} 个文件
              </Badge>
              <Badge size="sm" variant="light" color="blue">
                {PROJECT_TYPE_CONFIG[generatedProject.config.type].description}
              </Badge>
            </Group>

            {/* 项目结构 */}
            <Box>
              <Text size="sm" fw={500} mb="xs">
                项目结构
              </Text>
              <Paper p="sm" bg="gray.0" radius="sm">
                <Code block style={{ fontSize: '12px' }}>
                  {generatedProject.structure}
                </Code>
              </Paper>
            </Box>

            {/* 文件列表 */}
            <Box>
              <Text size="sm" fw={500} mb="xs">
                文件列表
              </Text>
              <ScrollArea h={200}>
                <FileTree
                  nodes={fileTree}
                  onSelectFile={setSelectedFile}
                  selectedFile={selectedFile?.path}
                />
              </ScrollArea>
            </Box>

            {/* 选中的文件预览 */}
            {selectedFile && (
              <Box>
                <Group justify="space-between" mb="xs">
                  <Text size="sm" fw={500}>
                    {selectedFile.path}
                  </Text>
                  <Badge size="sm" variant="light">
                    {selectedFile.language}
                  </Badge>
                </Group>
                <Paper p="sm" bg="dark.9" radius="sm">
                  <Code
                    block
                    style={{
                      fontSize: '12px',
                      maxHeight: 300,
                      overflow: 'auto',
                    }}
                  >
                    {selectedFile.content}
                  </Code>
                </Paper>
              </Box>
            )}
          </Stack>
        </Paper>
      )}

      {/* 文件预览模态框 */}
      <Modal
        opened={previewModalOpened}
        onClose={closePreviewModal}
        title="项目文件预览"
        size="xl"
        fullScreen={isMobile}
      >
        {generatedProject && (
          <Group align="stretch" gap="md" style={{ height: isMobile ? 'calc(100vh - 150px)' : 500 }}>
            {/* 文件树 */}
            <Paper p="sm" style={{ width: 250, overflow: 'auto' }}>
              <FileTree
                nodes={fileTree}
                onSelectFile={setSelectedFile}
                selectedFile={selectedFile?.path}
              />
            </Paper>

            {/* 文件内容 */}
            <Paper p="sm" style={{ flex: 1, overflow: 'auto' }}>
              {selectedFile ? (
                <Stack gap="xs">
                  <Group justify="space-between">
                    <Text fw={500}>{selectedFile.path}</Text>
                    <Badge>{selectedFile.language}</Badge>
                  </Group>
                  <Code
                    block
                    style={{
                      fontSize: '13px',
                      whiteSpace: 'pre-wrap',
                    }}
                  >
                    {selectedFile.content}
                  </Code>
                </Stack>
              ) : (
                <Text c="dimmed" ta="center" style={{ marginTop: 100 }}>
                  选择左侧文件查看内容
                </Text>
              )}
            </Paper>
          </Group>
        )}
      </Modal>
    </Stack>
  )
}

/**
 * 项目生成器紧凑版组件
 * 用于在空间有限的地方展示
 */
export function CompactProjectGenerator() {
  const [projectName, setProjectName] = useState('')
  const [projectType, setProjectType] = useState<string>('react')
  const [isGenerating, setIsGenerating] = useState(false)
  const [generatedProject, setGeneratedProject] = useState<GeneratedProject | null>(null)

  const handleQuickGenerate = async () => {
    if (!projectName.trim()) return

    setIsGenerating(true)
    try {
      const config: ProjectGenerationConfig = {
        name: projectName,
        type: projectType as ProjectGenerationConfig['type'],
        description: `Quick generated ${projectType} project`,
        features: [],
        outputPath: `./${projectName}`,
      }

      const project = generateProject(config)
      setGeneratedProject(project)
    } finally {
      setIsGenerating(false)
    }
  }

  return (
    <Stack gap="md">
      <Group gap="xs">
        <TextInput
          placeholder="项目名称"
          value={projectName}
          onChange={(e) => setProjectName(e.currentTarget.value)}
          style={{ flex: 1 }}
        />
        <Select
          value={projectType}
          onChange={(value) => value && setProjectType(value)}
          data={PROJECT_TYPES.map((t) => ({ value: t.id, label: t.name }))}
          style={{ width: 120 }}
        />
        <Button
          loading={isGenerating}
          disabled={!projectName.trim()}
          onClick={handleQuickGenerate}
        >
          生成
        </Button>
      </Group>

      {generatedProject && (
        <Alert color="green" icon={<IconCheck size={16} />}>
          已生成 {generatedProject.files.length} 个文件
        </Alert>
      )}
    </Stack>
  )
}

export default ProjectGeneratorPanel
