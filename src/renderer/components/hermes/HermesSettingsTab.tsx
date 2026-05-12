/**
 * HermesSettingsTab - Hermes 设置标签页
 * 设置页面中的标签页，管理记忆系统、技能系统和子代理系统的开关与参数
 */

import { Button, Group, NumberInput, Slider, Stack, Switch, Text, Title } from '@mantine/core'
import { IconBrain, IconListDetails, IconRobot } from '@tabler/icons-react'
import { createStore } from 'zustand'
import { memo, useCallback } from 'react'
import { useTranslation } from 'react-i18next'

/** Hermes 设置状态接口 */
export interface HermesSettingsState {
  /** 是否启用记忆系统（自动提取记忆） */
  memoryEnabled: boolean
  /** 是否启用技能系统（自动创建技能） */
  skillsEnabled: boolean
  /** 是否启用子代理系统（自动子任务拆分） */
  subagentEnabled: boolean
  /** 子代理最大并行数（1-5） */
  subagentMaxConcurrent: number
  /** 子代理超时时间（秒） */
  subagentTimeout: number
}

/** Hermes 设置操作接口 */
export interface HermesSettingsActions {
  /** 设置记忆系统开关 */
  setMemoryEnabled: (enabled: boolean) => void
  /** 设置技能系统开关 */
  setSkillsEnabled: (enabled: boolean) => void
  /** 设置子代理开关 */
  setSubagentEnabled: (enabled: boolean) => void
  /** 设置子代理最大并行数 */
  setSubagentMaxConcurrent: (value: number) => void
  /** 设置子代理超时时间 */
  setSubagentTimeout: (value: number) => void
}

/** Hermes 设置 Store 类型 */
export type HermesSettingsStore = HermesSettingsState & HermesSettingsActions

/**
 * Hermes 设置 Store
 * 使用 zustand 管理设置状态
 */
export const useHermesSettingsStore = createStore<HermesSettingsStore>()((set) => ({
  // 默认值
  memoryEnabled: true,
  skillsEnabled: true,
  subagentEnabled: false,
  subagentMaxConcurrent: 3,
  subagentTimeout: 120,

  // 操作方法
  setMemoryEnabled: (enabled) => set({ memoryEnabled: enabled }),
  setSkillsEnabled: (enabled) => set({ skillsEnabled: enabled }),
  setSubagentEnabled: (enabled) => set({ subagentEnabled: enabled }),
  setSubagentMaxConcurrent: (value) => set({ subagentMaxConcurrent: value }),
  setSubagentTimeout: (value) => set({ subagentTimeout: value }),
}))

/** Hermes 设置标签页组件 */
const HermesSettingsTab = memo<{
  /** 点击"查看记忆"按钮的回调 */
  onViewMemories?: () => void
  /** 点击"查看技能"按钮的回调 */
  onViewSkills?: () => void
}>(({ onViewMemories, onViewSkills }) => {
  const { t } = useTranslation()

  // 从 store 获取设置状态和操作方法
  const memoryEnabled = useHermesSettingsStore((s) => s.memoryEnabled)
  const skillsEnabled = useHermesSettingsStore((s) => s.skillsEnabled)
  const subagentEnabled = useHermesSettingsStore((s) => s.subagentEnabled)
  const subagentMaxConcurrent = useHermesSettingsStore((s) => s.subagentMaxConcurrent)
  const subagentTimeout = useHermesSettingsStore((s) => s.subagentTimeout)
  const setMemoryEnabled = useHermesSettingsStore((s) => s.setMemoryEnabled)
  const setSkillsEnabled = useHermesSettingsStore((s) => s.setSkillsEnabled)
  const setSubagentEnabled = useHermesSettingsStore((s) => s.setSubagentEnabled)
  const setSubagentMaxConcurrent = useHermesSettingsStore((s) => s.setSubagentMaxConcurrent)
  const setSubagentTimeout = useHermesSettingsStore((s) => s.setSubagentTimeout)

  /** 处理查看记忆 */
  const handleViewMemories = useCallback(() => {
    onViewMemories?.()
  }, [onViewMemories])

  /** 处理查看技能 */
  const handleViewSkills = useCallback(() => {
    onViewSkills?.()
  }, [onViewSkills])

  return (
    <Stack gap="xl" p="md">
      <Title order={5}>{t('Hermes Settings')}</Title>

      {/* 记忆系统设置 */}
      <Stack gap="md">
        <Text fw="600">{t('Memory System')}</Text>
        <Stack gap="xxs">
          <Group justify="space-between" align="center">
            <Text size="sm">{t('Auto-extract memories')}</Text>
            <Switch
              checked={memoryEnabled}
              onChange={(e) => setMemoryEnabled(e.currentTarget.checked)}
            />
          </Group>
          <Text size="xs" c="chatbox-tertiary">
            {t('Automatically extract key information from conversations as memories for future reference.')}
          </Text>
        </Stack>
        <Button
          variant="outline"
          size="xs"
          leftSection={<IconBrain size={14} />}
          onClick={handleViewMemories}
        >
          {t('View Memories')}
        </Button>
      </Stack>

      {/* 技能系统设置 */}
      <Stack gap="md">
        <Text fw="600">{t('Skill System')}</Text>
        <Stack gap="xxs">
          <Group justify="space-between" align="center">
            <Text size="sm">{t('Auto-create skills')}</Text>
            <Switch
              checked={skillsEnabled}
              onChange={(e) => setSkillsEnabled(e.currentTarget.checked)}
            />
          </Group>
          <Text size="xs" c="chatbox-tertiary">
            {t('Automatically create reusable skills from complex task patterns.')}
          </Text>
        </Stack>
        <Button
          variant="outline"
          size="xs"
          leftSection={<IconListDetails size={14} />}
          onClick={handleViewSkills}
        >
          {t('View Skills')}
        </Button>
      </Stack>

      {/* 子代理系统设置 */}
      <Stack gap="md">
        <Text fw="600">{t('Subagent System')}</Text>
        <Stack gap="xxs">
          <Group justify="space-between" align="center">
            <Text size="sm">{t('Auto-split subtasks')}</Text>
            <Switch
              checked={subagentEnabled}
              onChange={(e) => setSubagentEnabled(e.currentTarget.checked)}
            />
          </Group>
          <Text size="xs" c="chatbox-tertiary">
            {t('Automatically decompose complex tasks into parallel subtasks for faster execution.')}
          </Text>
        </Stack>

        {/* 子代理最大并行数滑块 */}
        <Stack gap="xxs">
          <Text size="sm">{t('Max concurrent subagents')}</Text>
          <Slider
            min={1}
            max={5}
            step={1}
            value={subagentMaxConcurrent}
            onChange={setSubagentMaxConcurrent}
            disabled={!subagentEnabled}
            marks={[
              { value: 1, label: '1' },
              { value: 2, label: '2' },
              { value: 3, label: '3' },
              { value: 4, label: '4' },
              { value: 5, label: '5' },
            ]}
          />
        </Stack>

        {/* 子代理超时时间输入 */}
        <Stack gap="xxs">
          <Text size="sm">{t('Subagent timeout (seconds)')}</Text>
          <NumberInput
            min={10}
            max={600}
            step={10}
            value={subagentTimeout}
            onChange={(val) => {
              if (typeof val === 'number') setSubagentTimeout(val)
            }}
            disabled={!subagentEnabled}
            suffix="s"
          />
        </Stack>
      </Stack>
    </Stack>
  )
})

HermesSettingsTab.displayName = 'HermesSettingsTab'

export default HermesSettingsTab
