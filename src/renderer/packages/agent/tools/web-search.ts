import type { Tool, SearchResult } from '../types'

const SERPAPI_BASE_URL = 'https://serpapi.com/search'
const BING_SEARCH_URL = 'https://api.bing.microsoft.com/v7.0/search'

interface SearchOptions {
  query: string
  numResults?: number
  language?: string
  region?: string
}

/**
 * 使用 SerpAPI 进行 Google 搜索
 */
async function searchWithSerpAPI(
  query: string,
  apiKey: string,
  numResults: number = 10
): Promise<SearchResult[]> {
  const params = new URLSearchParams({
    q: query,
    api_key: apiKey,
    engine: 'google',
    num: numResults.toString(),
    hl: 'zh-CN',
  })

  const response = await fetch(`${SERPAPI_BASE_URL}?${params}`)

  if (!response.ok) {
    throw new Error(`SerpAPI search failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()

  if (data.error) {
    throw new Error(`SerpAPI error: ${data.error}`)
  }

  const results: SearchResult[] = []

  // 提取有机搜索结果
  if (data.organic_results) {
    for (const result of data.organic_results.slice(0, numResults)) {
      results.push({
        title: result.title || '',
        link: result.link || '',
        snippet: result.snippet || result.description || '',
        source: 'google',
      })
    }
  }

  // 提取知识图谱信息
  if (data.knowledge_graph && data.knowledge_graph.description) {
    results.unshift({
      title: data.knowledge_graph.title || '知识图谱',
      link: data.knowledge_graph.website || '',
      snippet: data.knowledge_graph.description,
      source: 'knowledge_graph',
    })
  }

  return results
}

/**
 * 使用 Bing API 进行搜索
 */
async function searchWithBing(
  query: string,
  apiKey: string,
  numResults: number = 10
): Promise<SearchResult[]> {
  const response = await fetch(
    `${BING_SEARCH_URL}?q=${encodeURIComponent(query)}&count=${numResults}`,
    {
      headers: {
        'Ocp-Apim-Subscription-Key': apiKey,
      },
    }
  )

  if (!response.ok) {
    throw new Error(`Bing search failed: ${response.status} ${response.statusText}`)
  }

  const data = await response.json()
  const results: SearchResult[] = []

  if (data.webPages && data.webPages.value) {
    for (const page of data.webPages.value.slice(0, numResults)) {
      results.push({
        title: page.name || '',
        link: page.url || '',
        snippet: page.snippet || '',
        source: 'bing',
      })
    }
  }

  return results
}

/**
 * 使用 DuckDuckGo 进行搜索 (无需 API Key)
 */
async function searchWithDuckDuckGo(
  query: string,
  numResults: number = 10
): Promise<SearchResult[]> {
  // 使用 DuckDuckGo 的 HTML 版本进行搜索
  const response = await fetch(
    `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`,
    {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
    }
  )

  if (!response.ok) {
    throw new Error(`DuckDuckGo search failed: ${response.status}`)
  }

  const html = await response.text()
  const results: SearchResult[] = []

  // 简单的 HTML 解析
  const resultRegex =
    /<a[^>]*class="result__a"[^>]*href="([^"]*)"[^>]*>(.*?)<\/a>.*?<a[^>]*class="result__snippet"[^>]*>(.*?)<\/a>/gs
  let match
  let count = 0

  while ((match = resultRegex.exec(html)) !== null && count < numResults) {
    const link = match[1].replace(/^\/\/duckduckgo.com\/l\/\?uddg=/, '')
    const decodedLink = decodeURIComponent(link)
    const title = match[2].replace(/<[^>]*>/g, '')
    const snippet = match[3].replace(/<[^>]*>/g, '')

    results.push({
      title,
      link: decodedLink,
      snippet,
      source: 'duckduckgo',
    })
    count++
  }

  return results
}

/**
 * 执行网络搜索
 */
async function executeSearch(args: SearchOptions): Promise<{
  results: SearchResult[]
  query: string
  totalResults: number
}> {
  const { query, numResults = 10 } = args

  // 获取 API 配置
  const serpApiKey = process.env.SERPAPI_KEY || ''
  const bingApiKey = process.env.BING_API_KEY || ''

  let results: SearchResult[] = []

  // 优先使用 SerpAPI
  if (serpApiKey) {
    try {
      results = await searchWithSerpAPI(query, serpApiKey, numResults)
    } catch (error) {
      console.warn('SerpAPI search failed, trying fallback:', error)
    }
  }

  // 如果 SerpAPI 失败或不可用，尝试 Bing
  if (results.length === 0 && bingApiKey) {
    try {
      results = await searchWithBing(query, bingApiKey, numResults)
    } catch (error) {
      console.warn('Bing search failed, trying fallback:', error)
    }
  }

  // 最后的回退选项
  if (results.length === 0) {
    try {
      results = await searchWithDuckDuckGo(query, numResults)
    } catch (error) {
      console.error('All search methods failed:', error)
      throw new Error('搜索服务暂时不可用，请稍后重试')
    }
  }

  return {
    results,
    query,
    totalResults: results.length,
  }
}

/**
 * 网页搜索工具
 */
export const webSearchTool: Tool = {
  name: 'web_search',
  description:
    '使用此工具在互联网上搜索最新信息。当你需要获取实时数据、新闻、技术文档或任何可能随时间变化的信息时，请使用此工具。',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '搜索查询语句，应该清晰、具体，包含关键词',
      required: true,
    },
    {
      name: 'numResults',
      type: 'number',
      description: '返回的搜索结果数量 (1-20，默认 10)',
      required: false,
    },
    {
      name: 'language',
      type: 'string',
      description: '搜索结果的语言偏好',
      required: false,
    },
  ],
  execute: executeSearch,
}

/**
 * 获取网页内容工具
 */
export const fetchWebPageTool: Tool = {
  name: 'fetch_webpage',
  description:
    '获取指定 URL 的网页内容。用于获取搜索结果的详细内容或特定网页的信息。',
  parameters: [
    {
      name: 'url',
      type: 'string',
      description: '要获取的网页 URL',
      required: true,
    },
    {
      name: 'maxLength',
      type: 'number',
      description: '返回内容的最大字符数 (默认 5000)',
      required: false,
    },
  ],
  execute: async (args: { url: string; maxLength?: number }) => {
    const { url, maxLength = 5000 } = args

    try {
      const response = await fetch(url, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        },
      })

      if (!response.ok) {
        throw new Error(`Failed to fetch: ${response.status} ${response.statusText}`)
      }

      const html = await response.text()

      // 简单的 HTML 标签移除
      let text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]*>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()

      // 截取指定长度
      if (text.length > maxLength) {
        text = text.substring(0, maxLength) + '...'
      }

      return {
        url,
        title: html.match(/<title[^>]*>(.*?)<\/title>/i)?.[1] || '',
        content: text,
        length: text.length,
      }
    } catch (error) {
      throw new Error(`获取网页失败: ${error instanceof Error ? error.message : '未知错误'}`)
    }
  },
}

/**
 * 搜索并获取摘要工具
 */
export const searchAndSummarizeTool: Tool = {
  name: 'search_and_summarize',
  description:
    '搜索网络并返回摘要信息。适合快速获取某个主题的概览信息。',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '搜索查询',
      required: true,
    },
    {
      name: 'context',
      type: 'string',
      description: '额外的上下文信息，帮助生成更相关的摘要',
      required: false,
    },
  ],
  execute: async (args: { query: string; context?: string }) => {
    const searchResult = await executeSearch({
      query: args.query,
      numResults: 5,
    })

    // 构建摘要
    const summary = searchResult.results
      .map(
        (result, index) =>
          `${index + 1}. ${result.title}\n   ${result.snippet}\n   来源: ${result.link}`
      )
      .join('\n\n')

    return {
      query: args.query,
      summary,
      sources: searchResult.results.map((r) => ({
        title: r.title,
        link: r.link,
        source: r.source,
      })),
      totalSources: searchResult.totalResults,
    }
  },
}

// 导出所有搜索工具
export const searchTools = [webSearchTool, fetchWebPageTool, searchAndSummarizeTool]
