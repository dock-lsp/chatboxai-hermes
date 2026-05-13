/**
 * FileTreePanel - 文件树面板组件
 * 显示文件树结构、支持路径输入、扫描按钮和云端同步配置
 */

import {
  Stack,
  Group,
  TextInput,
  Button,
  Checkbox,
  Collapse,
  Text,
  ActionIcon,
  Paper,
  Divider,
  Progress,
  Box,
  ScrollArea,
  Title,
  Tooltip,
} from '@mantine/core'
import {
  IconFolder,
  IconRefresh,
  IconChevronDown,
  IconChevronRight,
  IconCloud,
  IconSettings,
  IconSearch,
  IconX,
} from '@tabler/icons-react'
import { memo, useState, useCallback, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import {
  useFileTreeStore,
  useFlattenedList,
  useScanStatus,
  useScanConfig,
  useCloudConfig,
  useFileStats,
  formatFileSize,
} from '@/packages/file-tree'
import FileTreeItem from './FileTreeItem'

/**
 * 文件树面板组件
 * 提供文件浏览、扫描和云端同步功能
 */
const FileTreePanel = memo(() => {
  const { t } = useTranslation()

  // 本地状态
  const [pathInput, setPathInput] = useState('')
  const [cloudConfigOpen, setCloudConfigOpen] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')

  // 从 zustand store 获取状态
  const flattenedList = useFlattenedList()
  const { isScanning, scanProgress, currentScanPath } = useScanStatus()
  const scanConfig = useScanConfig()
  const cloudConfig = useCloudConfig()
  const fileStats = useFileStats()
  const toggleExpanded = useFileTreeStore((state) => state.toggleExpanded)
  const scanDirectory = useFileTreeStore((state) => state.scanDirectory)
  const setScanConfig = useFileTreeStore((state) => state.setScanConfig)
  const updateCloudConfig = useFileTreeStore((state) => state.updateCloudConfig)
  const expandAllNodes = useFileTreeStore((state) => state.expandAllNodes)
  const collapseAllNodes = useFileTreeStore((state) => state.collapseAllNodes)

  // 根据搜索关键词过滤文件列表
  const filteredList = useMemo(() => {
    if (!searchQuery.trim()) return flattenedList
    const query = searchQuery.toLowerCase()
    return flattenedList.filter((item) => item.name.toLowerCase().includes(query))
  }, [flattenedList, searchQuery])

  /**
   * 处理扫描按钮点击
   */
  const handleScan = useCallback(async () => {
    const targetPath = pathInput.trim() || scanConfig.rootPath
    if (!targetPath) {
      return
    }
    await scanDirectory(targetPath)
  }, [pathInput, scanConfig.rootPath, scanDirectory])

  /**
   * 处理路径输入框回车
   */
  const handlePathKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === 'Enter') {
        handleScan()
      }
    },
    [handleScan]
  )

  /**
   * 处理云端配置开关
   */
  const handleCloudEnabledChange = useCallback(
    (checked: boolean) => {
      updateCloudConfig({ enabled: checked })
    },
    [updateCloudConfig]
  )

  /**
   * 处理服务器地址变更
   */
  const handleServerUrlChange = useCallback(
    (value: string) => {
      updateCloudConfig({ serverUrl: value })
    },
    [updateCloudConfig]
  )

  /**
   * 处理 API Key 变更
   */
  const handleApiKeyChange = useCallback(
    (value: string) => {
      updateCloudConfig({ apiKey: value })
    },
    [updateCloudConfig]
  )

  /**
   * 处理存储桶 ID 变更
   */
  const handleBucketIdChange = useCallback(
    (value: string) => {
      updateCloudConfig({ bucketId: value })
    },
    [updateCloudConfig]
  )

  /**
   * 处理同步间隔变更
   */
  const handleSyncIntervalChange = useCallback(
    (value: string) => {
      const num = parseInt(value, 10)
      if (!isNaN(num) && num > 0) {
        updateCloudConfig({ syncInterval: num })
      }
    },
    [updateCloudConfig]
  )

  /**
   * 处理包含隐藏文件选项变更
   */
  const handleIncludeHiddenChange = useCallback(
    (checked: boolean) => {
      setScanConfig({ includeHidden: checked })
    },
    [setScanConfig]
  )

  return (
    <Stack gap="md" p="md" h="100%">
      {/* 标题 */}
      <Group justify="space-between" align="center">
        <Title order={5}>{t('File Tree')}</Title>
        <Group gap="xs">
          <Tooltip label={t('Expand All')}>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={expandAllNodes}
              disabled={flattenedList.length === 0}
            >
              <IconChevronDown size={16} />
            </ActionIcon>
          </Tooltip>
          <Tooltip label={t('Collapse All')}>
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={collapseAllNodes}
              disabled={flattenedList.length === 0}
            >
              <IconChevronRight size={16} />
            </ActionIcon>
          </Tooltip>
        </Group>
      </Group>

      {/* 路径输入和扫描按钮 */}
      <Group gap="xs">
        <TextInput
          placeholder={t('Enter directory path...')}
          value={pathInput}
          onChange={(e) => setPathInput(e.currentTarget.value)}
          onKeyDown={handlePathKeyDown}
          leftSection={<IconFolder size={16} />}
          style={{ flex: 1 }}
          size="sm"
        />
        <Button
          leftSection={<IconRefresh size={16} />}
          onClick={handleScan}
          loading={isScanning}
          size="sm"
        >
          {t('Scan')}
        </Button>
      </Group>

      {/* 扫描选项 */}
      <Group gap="md">
        <Checkbox
          label={t('Include hidden files')}
          checked={scanConfig.includeHidden}
          onChange={(e) => handleIncludeHiddenChange(e.currentTarget.checked)}
          size="xs"
        />
      </Group>

      {/* 扫描进度 */}
      {isScanning && (
        <Stack gap="xs">
          <Progress value={scanProgress} size="sm" radius="xs" />
          <Text size="xs" c="dimmed" lineClamp={1}>
            {currentScanPath || t('Scanning...')}
          </Text>
        </Stack>
      )}

      {/* 搜索框 */}
      <TextInput
        placeholder={t('Search files...')}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.currentTarget.value)}
        leftSection={<IconSearch size={16} />}
        rightSection={
          searchQuery ? (
            <ActionIcon size="xs" variant="subtle" onClick={() => setSearchQuery('')}>
              <IconX size={14} />
            </ActionIcon>
          ) : null
        }
        size="sm"
      />

      {/* 文件统计信息 */}
      {fileStats.totalFiles > 0 && (
        <Group gap="xs" wrap="wrap">
          <Text size="xs" c="dimmed">
            {t('Files')}: {fileStats.totalFiles}
          </Text>
          <Text size="xs" c="dimmed">
            |
          </Text>
          <Text size="xs" c="dimmed">
            {t('Directories')}: {fileStats.totalDirectories}
          </Text>
          <Text size="xs" c="dimmed">
            |
          </Text>
          <Text size="xs" c="dimmed">
            {t('Size')}: {formatFileSize(fileStats.totalSize)}
          </Text>
        </Group>
      )}

      <Divider />

      {/* 文件树列表 */}
      <Box style={{ flex: 1, minHeight: 0 }}>
        <ScrollArea h="100%" offsetScrollbars>
          <Stack gap={0}>
            {filteredList.length === 0 ? (
              <Paper p="xl" withBorder radius="md" bg="gray.0">
                <Stack align="center" gap="sm">
                  <IconFolder size={48} color="gray" />
                  <Text size="sm" c="dimmed" ta="center">
                    {isScanning
                      ? t('Scanning directory...')
                      : t('No files scanned yet. Enter a path and click Scan.')}
                  </Text>
                </Stack>
              </Paper>
            ) : (
              filteredList.map((item) => (
                <FileTreeItem
                  key={item.id}
                  item={item}
                  onToggle={() => toggleExpanded(item.id)}
                />
              ))
            )}
          </Stack>
        </ScrollArea>
      </Box>

      <Divider />

      {/* 云端同步配置面板 */}
      <Stack gap="xs">
        <Group
          justify="space-between"
          align="center"
          style={{ cursor: 'pointer' }}
          onClick={() => setCloudConfigOpen(!cloudConfigOpen)}
        >
          <Group gap="xs">
            <IconCloud size={18} />
            <Text fw={500} size="sm">
              {t('Cloud Sync')}
            </Text>
          </Group>
          <Group gap="xs">
            <Checkbox
              checked={cloudConfig.enabled}
              onChange={(e) => handleCloudEnabledChange(e.currentTarget.checked)}
              onClick={(e) => e.stopPropagation()}
              size="xs"
            />
            <ActionIcon
              variant="subtle"
              size="sm"
              onClick={(e) => {
                e.stopPropagation()
                setCloudConfigOpen(!cloudConfigOpen)
              }}
            >
              {cloudConfigOpen ? (
                <IconChevronDown size={16} />
              ) : (
                <IconChevronRight size={16} />
              )}
            </ActionIcon>
          </Group>
        </Group>

        <Collapse in={cloudConfigOpen}>
          <Paper p="sm" withBorder radius="md" bg="gray.0">
            <Stack gap="sm">
              <Group gap="xs" align="center">
                <IconSettings size={14} />
                <Text size="xs" fw={500}>
                  {t('Cloud Storage Configuration')}
                </Text>
              </Group>

              <TextInput
                label={t('Server URL')}
                placeholder="https://api.example.com"
                value={cloudConfig.serverUrl}
                onChange={(e) => handleServerUrlChange(e.currentTarget.value)}
                size="xs"
              />

              <TextInput
                label={t('API Key')}
                placeholder={t('Enter your API key')}
                value={cloudConfig.apiKey || ''}
                onChange={(e) => handleApiKeyChange(e.currentTarget.value)}
                type="password"
                size="xs"
              />

              <TextInput
                label={t('Bucket ID')}
                placeholder={t('Enter bucket or project ID')}
                value={cloudConfig.bucketId || ''}
                onChange={(e) => handleBucketIdChange(e.currentTarget.value)}
                size="xs"
              />

              <TextInput
                label={t('Sync Interval (minutes)')}
                placeholder="60"
                value={cloudConfig.syncInterval?.toString() || '60'}
                onChange={(e) => handleSyncIntervalChange(e.currentTarget.value)}
                type="number"
                min={1}
                size="xs"
              />

              <Text size="xs" c="dimmed">
                {t('Configure cloud storage to sync file tree across devices.')}
              </Text>
            </Stack>
          </Paper>
        </Collapse>
      </Stack>
    </Stack>
  )
})

FileTreePanel.displayName = 'FileTreePanel'

export default FileTreePanel
