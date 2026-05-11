import { Button, Input, Stack, Text, Title } from '@mantine/core'
import { type ModelProvider, ModelProviderEnum } from '@shared/types'
import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'
import useChatboxAIModels from '@/hooks/useChatboxAIModels'
import { useProviderSettings, useSettingsStore } from '@/stores/settingsStore'
import { setCustomApiOrigin } from '@shared/request/chatboxai_pool'
import { ModelManagement } from './provider/chatbox-ai/-components/ModelManagement'

export const Route = createFileRoute('/settings/chatbox-ai')({
  component: RouteComponent,
})

export function RouteComponent() {
  const providerId: ModelProvider = ModelProviderEnum.ChatboxAI
  const { providerSettings, setProviderSettings } = useProviderSettings(providerId)
  const customApiOrigin = useSettingsStore((state) => state.customApiOrigin)
  const setSettings = useSettingsStore((state) => state.setState)
  const [apiUrl, setApiUrl] = useState(customApiOrigin || '')
  const [saved, setSaved] = useState(false)

  const { allChatboxAIModels, chatboxAIModels, refetch: refetchChatboxAIModels } = useChatboxAIModels()

  const handleSaveApiUrl = () => {
    const trimmed = apiUrl.trim().replace(/\/+$/, '')
    setCustomApiOrigin(trimmed)
    setSettings({ customApiOrigin: trimmed })
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <Stack gap="xxl" p="md">
      {/* 自定义后端配置 */}
      <Stack gap="md">
        <Title order={4}>🌐 自定义后端（可选）</Title>
        <Text size="sm" c="dimmed">
          配置你自己的 API 后端地址，用于邮箱登录、联网搜索、文件解析等功能。
          留空则使用离线模式（不影响第三方模型 API Key 的聊天功能）。
        </Text>
        <Text size="xs" c="dimmed" fs="italic">
          后端需实现 API：POST /api/auth/send-code | POST /api/auth/login-code | POST /api/auth/refresh
        </Text>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end' }}>
          <Input
            placeholder="https://api.your-domain.com"
            value={apiUrl}
            onChange={(e) => setApiUrl(e.target.value)}
            style={{ flex: 1 }}
            size="md"
          />
          <Button
            onClick={handleSaveApiUrl}
            color={saved ? 'green' : undefined}
            size="md"
          >
            {saved ? '✅ 已保存' : '保存'}
          </Button>
        </div>
      </Stack>

      {/* ChatboxAI 模型管理 */}
      <ModelManagement
        chatboxAIModels={chatboxAIModels}
        allChatboxAIModels={allChatboxAIModels}
        onDeleteModel={(modelId) =>
          setProviderSettings({ excludedModels: [...(providerSettings?.excludedModels || []), modelId] })
        }
        onResetModels={() => setProviderSettings({ models: [], excludedModels: [] })}
        onFetchModels={refetchChatboxAIModels}
        onAddModel={(model) =>
          setProviderSettings({
            excludedModels: (providerSettings?.excludedModels || []).filter((m) => m !== model.modelId),
          })
        }
        onRemoveModel={(modelId) =>
          setProviderSettings({
            excludedModels: [...(providerSettings?.excludedModels || []), modelId],
          })
        }
      />
    </Stack>
  )
}
