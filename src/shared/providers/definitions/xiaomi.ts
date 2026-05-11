import { ModelProviderEnum, ModelProviderType } from '../../types'
import { defineProvider } from '../registry'
import Xiaomi from './models/xiaomi'

export const xiaomiProvider = defineProvider({
  id: ModelProviderEnum.Xiaomi as any, // 临时使用，已在 types.ts 中预留
  name: 'Xiaomi MiLM',
  type: ModelProviderType.OpenAI,
  modelsDevProviderId: 'xiaomi',
  defaultSettings: {
    apiHost: 'https://api.xiaomimlm.com/v1',
    models: [
      {
        modelId: 'mixtral-8x7b',
        capabilities: ['reasoning', 'tool_use'],
        contextWindow: 32_000,
      },
      {
        modelId: 'llama-3-8b',
        capabilities: ['reasoning', 'tool_use'],
        contextWindow: 8_192,
      },
      {
        modelId: 'qwen-7b',
        capabilities: ['reasoning'],
        contextWindow: 8_192,
      },
    ],
    defaultModelId: 'mixtral-8x7b',
  },
  links: {
    apiKey: 'https://xiaomi.mi.com/milm',
    models: 'https://xiaomi.mi.com/milm/models',
  },
  createModel: (options, dependencies) => new Xiaomi(options, dependencies),
})
