/**
 * MemoryPanel - 记忆管理面板
 * 展示和管理所有记忆条目，支持搜索过滤、编辑和删除
 */

import { ActionIcon, Badge, Card, Group, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconEdit, IconSearch, IconTrash, IconTrashX } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { memo, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useMemoryStore } from '@/packages/hermes'
import type { Memory, MemoryType } from '@/packages/hermes'

/** 记忆类型对应的标签颜色映射 */
const MEMORY_TYPE_COLORS: Record<MemoryType, string> = {
  preference: 'blue',
  fact: 'green',
  context: 'gray',
}

/** 记忆类型对应的中文标签 */
const MEMORY_TYPE_LABELS: Record<MemoryType, string> = {
  preference: '偏好',
  fact: '事实',
  context: '上下文',
}

/** 单条记忆项组件 */
const MemoryItem = memo<{ memory: Memory; onEdit: (memory: Memory) => void; onDelete: (id: string) => void }>(
  ({ memory, onEdit, onDelete }) => {
    const { t } = useTranslation()

    return (
      <Card withBorder radius="md" p="sm" className="dark:bg-gray-800/50">
        <Stack gap="xs">
          {/* 顶部：类型标签 + 操作按钮 */}
          <Group justify="space-between" align="center">
            <Group gap="xs">
              <Badge color={MEMORY_TYPE_COLORS[memory.type]} size="sm" variant="light">
                {MEMORY_TYPE_LABELS[memory.type]}
              </Badge>
              {memory.tags.length > 0 && (
                <Group gap={4}>
                  {memory.tags.slice(0, 3).map((tag) => (
                    <Badge key={tag} size="xs" variant="outline" color="gray">
                      {tag}
                    </Badge>
                  ))}
                  {memory.tags.length > 3 && (
                    <Text size="xs" c="dimmed">
                      +{memory.tags.length - 3}
                    </Text>
                  )}
                </Group>
              )}
            </Group>
            <Group gap={4}>
              <ActionIcon
                variant="subtle"
                size="sm"
                color="gray"
                onClick={() => onEdit(memory)}
                aria-label={t('Edit')}
              >
                <IconEdit size={14} />
              </ActionIcon>
              <ActionIcon
                variant="subtle"
                size="sm"
                color="red"
                onClick={() => onDelete(memory.id)}
                aria-label={t('Delete')}
              >
                <IconTrash size={14} />
              </ActionIcon>
            </Group>
          </Group>

          {/* 记忆内容 */}
          <Text size="sm" lineClamp={3}>
            {memory.content}
          </Text>

          {/* 底部：访问次数 + 创建时间 */}
          <Group justify="space-between" align="center">
            <Text size="xs" c="dimmed">
              {t('Accessed {{count}} times', { count: memory.accessCount })}
            </Text>
            <Text size="xs" c="dimmed">
              {dayjs(memory.createdAt).format('YYYY-MM-DD HH:mm')}
            </Text>
          </Group>
        </Stack>
      </Card>
    )
  },
)

MemoryItem.displayName = 'MemoryItem'

/** 记忆管理面板 */
const MemoryPanel = memo(() => {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')

  // 从 store 获取记忆数据和操作方法
  const memories = useMemoryStore((state) => state.memories)
  const deleteMemory = useMemoryStore((state) => state.deleteMemory)
  const clearAllMemories = useMemoryStore((state) => state.clearAllMemories)
  const updateMemory = useMemoryStore((state) => state.updateMemory)

  // 根据搜索关键词过滤记忆列表
  const filteredMemories = useMemo(() => {
    if (!searchQuery.trim()) return memories
    const query = searchQuery.toLowerCase()
    return memories.filter(
      (memory) =>
        memory.content.toLowerCase().includes(query) ||
        memory.tags.some((tag) => tag.toLowerCase().includes(query)),
    )
  }, [memories, searchQuery])

  /** 处理编辑记忆 */
  const handleEdit = (memory: Memory) => {
    // TODO: 打开编辑弹窗
    console.log('编辑记忆:', memory.id)
  }

  /** 处理删除记忆 */
  const handleDelete = (id: string) => {
    deleteMemory(id)
  }

  /** 处理清空全部记忆 */
  const handleClearAll = () => {
    if (memories.length === 0) return
    clearAllMemories()
  }

  return (
    <Stack gap="md" p="md">
      {/* 顶部：标题 + 搜索框 + 清空按钮 */}
      <Group justify="space-between" align="center">
        <Title order={5}>{t('Memory Management')}</Title>
        <ActionIcon
          variant="subtle"
          color="red"
          onClick={handleClearAll}
          disabled={memories.length === 0}
          aria-label={t('Clear All')}
          title={t('Clear All')}
        >
          <IconTrashX size={18} />
        </ActionIcon>
      </Group>

      <TextInput
        placeholder={t('Search memories...')}
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.currentTarget.value)}
      />

      {/* 记忆列表 */}
      {filteredMemories.length === 0 ? (
        /* 空状态 */
        <Stack align="center" py="xl" gap="md">
          <Text size="sm" c="dimmed" ta="center">
            {t('No memories yet. AI will automatically extract key information during conversations.')}
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          {filteredMemories.map((memory) => (
            <MemoryItem
              key={memory.id}
              memory={memory}
              onEdit={handleEdit}
              onDelete={handleDelete}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
})

MemoryPanel.displayName = 'MemoryPanel'

export default MemoryPanel
