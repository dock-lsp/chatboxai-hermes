/**
 * SkillsPanel - 技能管理面板
 * 展示和管理所有技能卡片，支持搜索过滤、导入导出、查看详情和删除
 */

import { ActionIcon, Badge, Button, Card, FileButton, Group, Stack, Text, TextInput, Title } from '@mantine/core'
import { IconDownload, IconEye, IconSearch, IconTrash, IconUpload } from '@tabler/icons-react'
import dayjs from 'dayjs'
import { memo, useCallback, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { skillsStore } from '@/packages/hermes'
import type { Skill } from '@/packages/hermes'

/** 单个技能卡片组件 */
const SkillCard = memo<{
  skill: Skill
  onViewDetail: (skill: Skill) => void
  onDelete: (id: string) => void
}>(({ skill, onViewDetail, onDelete }) => {
  const { t } = useTranslation()

  return (
    <Card withBorder radius="md" p="sm" className="dark:bg-gray-800/50">
      <Stack gap="xs">
        {/* 顶部：名称 + 操作按钮 */}
        <Group justify="space-between" align="center">
          <Group gap="xs" align="center">
            <Text fw={600} size="sm">
              {skill.name}
            </Text>
            <Badge size="xs" variant="light" color="violet">
              v{skill.version}
            </Badge>
          </Group>
          <Group gap={4}>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="gray"
              onClick={() => onViewDetail(skill)}
              aria-label={t('View Detail')}
            >
              <IconEye size={14} />
            </ActionIcon>
            <ActionIcon
              variant="subtle"
              size="sm"
              color="red"
              onClick={() => onDelete(skill.id)}
              aria-label={t('Delete')}
            >
              <IconTrash size={14} />
            </ActionIcon>
          </Group>
        </Group>

        {/* 技能描述 */}
        <Text size="xs" c="dimmed" lineClamp={2}>
          {skill.description}
        </Text>

        {/* 触发条件标签 */}
        {skill.triggerConditions.length > 0 && (
          <Group gap={4} wrap="wrap">
            {skill.triggerConditions.slice(0, 4).map((condition) => (
              <Badge key={condition} size="xs" variant="dot" color="teal">
                {condition}
              </Badge>
            ))}
            {skill.triggerConditions.length > 4 && (
              <Text size="xs" c="dimmed">
                +{skill.triggerConditions.length - 4}
              </Text>
            )}
          </Group>
        )}

        {/* 底部：成功/失败次数 + 最后使用时间 */}
        <Group justify="space-between" align="center">
          <Group gap="xs">
            <Badge size="xs" variant="light" color="green">
              {t('Success')}: {skill.successCount}
            </Badge>
            <Badge size="xs" variant="light" color="red">
              {t('Failed')}: {skill.failureCount}
            </Badge>
          </Group>
          {skill.lastUsedAt ? (
            <Text size="xs" c="dimmed">
              {dayjs(skill.lastUsedAt).format('YYYY-MM-DD HH:mm')}
            </Text>
          ) : (
            <Text size="xs" c="dimmed">
              {t('Never used')}
            </Text>
          )}
        </Group>
      </Stack>
    </Card>
  )
})

SkillCard.displayName = 'SkillCard'

/** 技能管理面板 */
const SkillsPanel = memo(() => {
  const { t } = useTranslation()
  const [searchQuery, setSearchQuery] = useState('')

  // 从 store 获取技能数据和操作方法
  const skills = skillsStore((state) => state.skills)
  const deleteSkill = skillsStore((state) => state.deleteSkill)
  const importSkills = skillsStore((state) => state.importSkills)
  const exportSkills = skillsStore((state) => state.exportSkills)

  // 根据搜索关键词过滤技能列表
  const filteredSkills = useMemo(() => {
    if (!searchQuery.trim()) return skills
    const query = searchQuery.toLowerCase()
    return skills.filter(
      (skill) =>
        skill.name.toLowerCase().includes(query) ||
        skill.description.toLowerCase().includes(query) ||
        skill.triggerConditions.some((condition) => condition.toLowerCase().includes(query)),
    )
  }, [skills, searchQuery])

  /** 处理查看技能详情 */
  const handleViewDetail = useCallback((skill: Skill) => {
    // TODO: 打开详情弹窗
    console.log('查看技能详情:', skill.id)
  }, [])

  /** 处理删除技能 */
  const handleDelete = useCallback(
    (id: string) => {
      deleteSkill(id)
    },
    [deleteSkill],
  )

  /** 处理导入技能 */
  const handleImport = useCallback(
    (file: File | null) => {
      if (!file) return
      const reader = new FileReader()
      reader.onload = (e) => {
        try {
          const data = JSON.parse(e.target?.result as string)
          if (Array.isArray(data)) {
            importSkills(data)
          }
        } catch (err) {
          console.error('导入技能失败:', err)
        }
      }
      reader.readAsText(file)
    },
    [importSkills],
  )

  /** 处理导出技能 */
  const handleExport = useCallback(() => {
    const data = exportSkills()
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `hermes-skills-${dayjs().format('YYYY-MM-DD')}.json`
    a.click()
    URL.revokeObjectURL(url)
  }, [exportSkills])

  return (
    <Stack gap="md" p="md">
      {/* 顶部：标题 + 搜索框 + 导入/导出按钮 */}
      <Group justify="space-between" align="center">
        <Title order={5}>{t('Skill Management')}</Title>
        <Group gap="xs">
          <FileButton onChange={handleImport} accept=".json">
            {(props) => (
              <Button variant="outline" size="xs" leftSection={<IconUpload size={14} />} {...props}>
                {t('Import')}
              </Button>
            )}
          </FileButton>
          <Button
            variant="outline"
            size="xs"
            leftSection={<IconDownload size={14} />}
            onClick={handleExport}
            disabled={skills.length === 0}
          >
            {t('Export')}
          </Button>
        </Group>
      </Group>

      <TextInput
        placeholder={t('Search skills...')}
        leftSection={<IconSearch size={16} />}
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.currentTarget.value)}
      />

      {/* 技能卡片列表 */}
      {filteredSkills.length === 0 ? (
        /* 空状态 */
        <Stack align="center" py="xl" gap="md">
          <Text size="sm" c="dimmed" ta="center">
            {t('No skills yet. AI will automatically create reusable skills after complex tasks.')}
          </Text>
        </Stack>
      ) : (
        <Stack gap="sm">
          {filteredSkills.map((skill) => (
            <SkillCard
              key={skill.id}
              skill={skill}
              onViewDetail={handleViewDetail}
              onDelete={handleDelete}
            />
          ))}
        </Stack>
      )}
    </Stack>
  )
})

SkillsPanel.displayName = 'SkillsPanel'

export default SkillsPanel
