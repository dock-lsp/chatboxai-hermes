/**
 * FileTreeItem - 文件树列表项组件
 * 显示单个文件或目录的缩进、图标、名称、大小和修改时间
 */

import { Group, Text, ActionIcon, Box, Tooltip } from '@mantine/core'
import {
  IconChevronRight,
  IconChevronDown,
  IconFolder,
  IconFolderOpen,
  IconFile,
  IconFileText,
  IconFileCode,
  IconFileTypePdf,
  IconPhoto,
  IconVideo,
  IconMusic,
  IconZip,
  IconBrandJavascript,
  IconBrandTypescript,
  IconBrandPython,
  IconBrandHtml5,
  IconBrandCss3,
  IconJson,
  IconMarkdown,
} from '@tabler/icons-react'
import { memo, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import type { FlattenedFileItem } from '@/packages/file-tree'
import { formatFileSize, formatTimestamp, getFileIconType } from '@/packages/file-tree'

/**
 * 文件树列表项组件 Props
 */
interface FileTreeItemProps {
  /** 展平列表项数据 */
  item: FlattenedFileItem
  /** 点击切换展开状态的回调 */
  onToggle: () => void
}

/**
 * 缩进宽度（像素）
 */
const INDENT_WIDTH = 20

/**
 * 根据文件类型获取对应的图标组件
 * @param extension 文件扩展名
 * @param isOpen 文件夹是否展开（仅用于文件夹图标）
 * @returns 图标组件
 */
function getFileIcon(extension: string | undefined, isOpen: boolean = false) {
  if (!extension) {
    return isOpen ? <IconFolderOpen size={18} /> : <IconFolder size={18} />
  }

  const ext = extension.toLowerCase()
  const iconType = getFileIconType(ext)

  const iconProps = { size: 18 }

  switch (iconType) {
    case 'image':
      return <IconPhoto {...iconProps} color="#228be6" />
    case 'pdf':
      return <IconFileTypePdf {...iconProps} color="#fa5252" />
    case 'document':
      return <IconFileText {...iconProps} color="#339af0" />
    case 'markdown':
      return <IconMarkdown {...iconProps} color="#868e96" />
    case 'code':
      // 根据具体代码类型返回不同图标
      if (ext === 'js' || ext === 'jsx' || ext === 'mjs') {
        return <IconBrandJavascript {...iconProps} color="#fcc419" />
      }
      if (ext === 'ts' || ext === 'tsx') {
        return <IconBrandTypescript {...iconProps} color="#228be6" />
      }
      if (ext === 'py') {
        return <IconBrandPython {...iconProps} color="#fab005" />
      }
      if (ext === 'html' || ext === 'htm') {
        return <IconBrandHtml5 {...iconProps} color="#fd7e14" />
      }
      if (ext === 'css' || ext === 'scss' || ext === 'sass' || ext === 'less') {
        return <IconBrandCss3 {...iconProps} color="#228be6" />
      }
      if (ext === 'json') {
        return <IconJson {...iconProps} color="#fab005" />
      }
      return <IconFileCode {...iconProps} color="#40c057" />
    case 'video':
      return <IconVideo {...iconProps} color="#be4bdb" />
    case 'audio':
      return <IconMusic {...iconProps} color="#7950f2" />
    case 'archive':
      return <IconZip {...iconProps} color="#fab005" />
    case 'text':
      return <IconFileText {...iconProps} color="#868e96" />
    default:
      return <IconFile {...iconProps} color="#adb5bd" />
  }
}

/**
 * 文件树列表项组件
 * 显示文件/目录的缩进、展开图标、文件图标、名称、大小和修改时间
 */
const FileTreeItem = memo<FileTreeItemProps>(({ item, onToggle }) => {
  const { t } = useTranslation()

  // 计算左边距（缩进）
  const indentStyle = useMemo(
    () => ({
      paddingLeft: item.depth * INDENT_WIDTH,
    }),
    [item.depth]
  )

  // 判断是否为目录
  const isDirectory = item.type === 'directory'

  // 判断是否有子节点
  const hasChildren = item.hasChildren ?? false

  // 获取文件图标
  const fileIcon = useMemo(
    () => getFileIcon(item.extension, isDirectory && item.expanded),
    [item.extension, isDirectory, item.expanded]
  )

  // 格式化文件大小
  const formattedSize = useMemo(() => {
    if (item.size === undefined) return ''
    return formatFileSize(item.size)
  }, [item.size])

  // 格式化修改时间
  const formattedTime = useMemo(() => {
    if (item.modifiedAt === undefined) return ''
    return formatTimestamp(item.modifiedAt)
  }, [item.modifiedAt])

  /**
   * 处理点击事件
   * 目录类型点击切换展开/收起
   */
  const handleClick = () => {
    if (isDirectory) {
      onToggle()
    }
  }

  return (
    <Box
      style={indentStyle}
      className="file-tree-item"
      onClick={handleClick}
      sx={(theme) => ({
        cursor: isDirectory ? 'pointer' : 'default',
        borderRadius: theme.radius.sm,
        '&:hover': {
          backgroundColor: theme.colorScheme === 'dark' ? theme.colors.dark[6] : theme.colors.gray[0],
        },
        padding: '4px 8px',
        transition: 'background-color 150ms ease',
      })}
    >
      <Group gap="xs" wrap="nowrap">
        {/* 展开/收起图标（仅目录显示） */}
        <Box w={20} h={20} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          {isDirectory && hasChildren && (
            <ActionIcon
              size="xs"
              variant="subtle"
              onClick={(e) => {
                e.stopPropagation()
                onToggle()
              }}
            >
              {item.expanded ? (
                <IconChevronDown size={16} />
              ) : (
                <IconChevronRight size={16} />
              )}
            </ActionIcon>
          )}
        </Box>

        {/* 文件/目录图标 */}
        <Box style={{ display: 'flex', alignItems: 'center' }}>{fileIcon}</Box>

        {/* 文件/目录名称 */}
        <Tooltip label={item.path} position="top-start" withArrow>
          <Text
            size="sm"
            lineClamp={1}
            style={{ flex: 1, minWidth: 0 }}
            fw={isDirectory ? 500 : 400}
          >
            {item.name}
          </Text>
        </Tooltip>

        {/* 文件大小（仅文件显示） */}
        {!isDirectory && formattedSize && (
          <Text size="xs" c="dimmed" w={80} ta="right">
            {formattedSize}
          </Text>
        )}

        {/* 修改时间 */}
        {formattedTime && (
          <Text size="xs" c="dimmed" w={120} ta="right" visibleFrom="sm">
            {formattedTime}
          </Text>
        )}
      </Group>
    </Box>
  )
})

FileTreeItem.displayName = 'FileTreeItem'

export default FileTreeItem
