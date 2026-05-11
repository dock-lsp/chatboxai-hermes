/**
 * 万象Chat - 翻译服务存根
 * 完整翻译功能需要自定义后端支持
 */

interface TranslateOptions {
  sourceLang?: string
  targetLang?: string
}

export async function translateTexts(
  texts: string[],
  _targetLang?: string,
  _options?: TranslateOptions
): Promise<string[]> {
  // 离线模式：返回原文
  return texts
}
