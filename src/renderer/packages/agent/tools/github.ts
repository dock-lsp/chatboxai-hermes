import type { Tool, GitHubRepo, GitHubFile } from '../types'

const GITHUB_API_BASE = 'https://api.github.com'

/**
 * 获取 GitHub API Token
 */
function getGitHubToken(): string {
  return process.env.GITHUB_TOKEN || ''
}

/**
 * 构建请求头
 */
function buildHeaders(): HeadersInit {
  const headers: HeadersInit = {
    Accept: 'application/vnd.github.v3+json',
    'User-Agent': 'ChatboxAI-Agent',
  }

  const token = getGitHubToken()
  if (token) {
    headers['Authorization'] = `token ${token}`
  }

  return headers
}

/**
 * 搜索 GitHub 仓库
 */
async function searchRepositories(
  query: string,
  sort: 'stars' | 'forks' | 'updated' = 'stars',
  order: 'asc' | 'desc' = 'desc',
  perPage: number = 10
): Promise<GitHubRepo[]> {
  const params = new URLSearchParams({
    q: query,
    sort,
    order,
    per_page: perPage.toString(),
  })

  const response = await fetch(`${GITHUB_API_BASE}/search/repositories?${params}`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `GitHub API error: ${response.status} ${error.message || response.statusText}`
    )
  }

  const data = await response.json()

  return data.items.map((item: any) => ({
    id: item.id,
    name: item.name,
    fullName: item.full_name,
    description: item.description || '',
    url: item.html_url,
    stars: item.stargazers_count,
    language: item.language || 'Unknown',
    updatedAt: item.updated_at,
  }))
}

/**
 * 获取仓库文件内容
 */
async function getFileContent(
  owner: string,
  repo: string,
  path: string,
  ref?: string
): Promise<GitHubFile> {
  const params = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}${params}`

  const response = await fetch(url, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`文件不存在: ${owner}/${repo}/${path}`)
    }
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `GitHub API error: ${response.status} ${error.message || response.statusText}`
    )
  }

  const data = await response.json()

  // 处理目录
  if (Array.isArray(data)) {
    return {
      path,
      content: JSON.stringify(
        data.map((item) => ({
          name: item.name,
          type: item.type,
          path: item.path,
          size: item.size,
        })),
        null,
        2
      ),
      encoding: 'json',
      size: data.length,
    }
  }

  // 解码 base64 内容
  let content = ''
  if (data.content && data.encoding === 'base64') {
    content = atob(data.content.replace(/\n/g, ''))
  }

  return {
    path: data.path,
    content,
    encoding: data.encoding || 'utf-8',
    size: data.size,
  }
}

/**
 * 获取仓库信息
 */
async function getRepository(owner: string, repo: string): Promise<any> {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`仓库不存在: ${owner}/${repo}`)
    }
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `GitHub API error: ${response.status} ${error.message || response.statusText}`
    )
  }

  const data = await response.json()

  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    url: data.html_url,
    stars: data.stargazers_count,
    forks: data.forks_count,
    openIssues: data.open_issues_count,
    language: data.language,
    topics: data.topics || [],
    license: data.license?.name || null,
    defaultBranch: data.default_branch,
    createdAt: data.created_at,
    updatedAt: data.updated_at,
    pushedAt: data.pushed_at,
    homepage: data.homepage,
    size: data.size,
    archived: data.archived,
    fork: data.fork,
  }
}

/**
 * 列出目录内容
 */
async function listDirectory(
  owner: string,
  repo: string,
  path: string = '',
  ref?: string
): Promise<
  Array<{
    name: string
    type: 'file' | 'dir'
    path: string
    size: number
    sha: string
  }>
> {
  const params = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}${params}`

  const response = await fetch(url, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`路径不存在: ${owner}/${repo}/${path}`)
    }
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `GitHub API error: ${response.status} ${error.message || response.statusText}`
    )
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    throw new Error('指定路径是一个文件，不是目录')
  }

  return data.map((item) => ({
    name: item.name,
    type: item.type,
    path: item.path,
    size: item.size,
    sha: item.sha,
  }))
}

/**
 * 获取 README 内容
 */
async function getReadme(owner: string, repo: string, ref?: string): Promise<GitHubFile> {
  const params = ref ? `?ref=${encodeURIComponent(ref)}` : ''
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/readme${params}`

  const response = await fetch(url, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`README 不存在: ${owner}/${repo}`)
    }
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `GitHub API error: ${response.status} ${error.message || response.statusText}`
    )
  }

  const data = await response.json()

  // 解码 base64 内容
  let content = ''
  if (data.content && data.encoding === 'base64') {
    content = atob(data.content.replace(/\n/g, ''))
  }

  return {
    path: data.path,
    content,
    encoding: data.encoding || 'utf-8',
    size: data.size,
  }
}

/**
 * 创建 Issue
 */
async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body?: string,
  labels?: string[],
  assignees?: string[]
): Promise<any> {
  const token = getGitHubToken()
  if (!token) {
    throw new Error('需要 GitHub Token 才能创建 Issue')
  }

  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/issues`, {
    method: 'POST',
    headers: {
      ...buildHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      title,
      body,
      labels,
      assignees,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `GitHub API error: ${response.status} ${error.message || response.statusText}`
    )
  }

  const data = await response.json()

  return {
    number: data.number,
    title: data.title,
    url: data.html_url,
    state: data.state,
    createdAt: data.created_at,
    labels: data.labels.map((l: any) => l.name),
  }
}

/**
 * 搜索代码
 */
async function searchCode(
  query: string,
  language?: string,
  perPage: number = 10
): Promise<
  Array<{
    name: string
    path: string
    repository: string
    url: string
  }>
> {
  let q = query
  if (language) {
    q += ` language:${language}`
  }

  const params = new URLSearchParams({
    q,
    per_page: perPage.toString(),
  })

  const response = await fetch(`${GITHUB_API_BASE}/search/code?${params}`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `GitHub API error: ${response.status} ${error.message || response.statusText}`
    )
  }

  const data = await response.json()

  return data.items.map((item: any) => ({
    name: item.name,
    path: item.path,
    repository: item.repository.full_name,
    url: item.html_url,
  }))
}

// ==================== 工具定义 ====================

/**
 * 搜索 GitHub 仓库工具
 */
export const searchGitHubReposTool: Tool = {
  name: 'github_search_repos',
  description:
    '在 GitHub 上搜索仓库。用于查找开源项目、库或示例代码。支持按星标数、更新时间等排序。',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '搜索关键词，可以使用 GitHub 搜索语法',
      required: true,
    },
    {
      name: 'sort',
      type: 'string',
      description: '排序方式: stars, forks, updated',
      required: false,
      enum: ['stars', 'forks', 'updated'],
    },
    {
      name: 'order',
      type: 'string',
      description: '排序顺序: asc, desc',
      required: false,
      enum: ['asc', 'desc'],
    },
    {
      name: 'perPage',
      type: 'number',
      description: '每页结果数 (1-100)',
      required: false,
    },
  ],
  execute: async (args: {
    query: string
    sort?: 'stars' | 'forks' | 'updated'
    order?: 'asc' | 'desc'
    perPage?: number
  }) => {
    const repos = await searchRepositories(
      args.query,
      args.sort || 'stars',
      args.order || 'desc',
      Math.min(args.perPage || 10, 100)
    )

    return {
      query: args.query,
      totalCount: repos.length,
      repositories: repos,
    }
  },
}

/**
 * 获取仓库文件内容工具
 */
export const getGitHubFileTool: Tool = {
  name: 'github_get_file',
  description:
    '获取 GitHub 仓库中特定文件或目录的内容。可以读取代码文件、配置文件或查看目录结构。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者用户名',
      required: true,
    },
    {
      name: 'repo',
      type: 'string',
      description: '仓库名称',
      required: true,
    },
    {
      name: 'path',
      type: 'string',
      description: '文件或目录路径',
      required: true,
    },
    {
      name: 'ref',
      type: 'string',
      description: '分支、标签或 commit SHA',
      required: false,
    },
  ],
  execute: async (args: { owner: string; repo: string; path: string; ref?: string }) => {
    const file = await getFileContent(args.owner, args.repo, args.path, args.ref)

    return {
      owner: args.owner,
      repo: args.repo,
      path: file.path,
      content: file.content.substring(0, 10000), // 限制返回大小
      size: file.size,
      encoding: file.encoding,
      truncated: file.content.length > 10000,
    }
  },
}

/**
 * 获取仓库信息工具
 */
export const getGitHubRepoTool: Tool = {
  name: 'github_get_repo',
  description: '获取 GitHub 仓库的详细信息，包括星标数、语言、描述等。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者用户名',
      required: true,
    },
    {
      name: 'repo',
      type: 'string',
      description: '仓库名称',
      required: true,
    },
  ],
  execute: async (args: { owner: string; repo: string }) => {
    const repoInfo = await getRepository(args.owner, args.repo)
    return repoInfo
  },
}

/**
 * 列出目录内容工具
 */
export const listGitHubDirTool: Tool = {
  name: 'github_list_dir',
  description: '列出 GitHub 仓库中某个目录的内容。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者用户名',
      required: true,
    },
    {
      name: 'repo',
      type: 'string',
      description: '仓库名称',
      required: true,
    },
    {
      name: 'path',
      type: 'string',
      description: '目录路径 (默认为根目录)',
      required: false,
    },
    {
      name: 'ref',
      type: 'string',
      description: '分支、标签或 commit SHA',
      required: false,
    },
  ],
  execute: async (args: { owner: string; repo: string; path?: string; ref?: string }) => {
    const items = await listDirectory(args.owner, args.repo, args.path || '', args.ref)

    return {
      owner: args.owner,
      repo: args.repo,
      path: args.path || '',
      items,
      itemCount: items.length,
    }
  },
}

/**
 * 获取 README 工具
 */
export const getGitHubReadmeTool: Tool = {
  name: 'github_get_readme',
  description: '获取 GitHub 仓库的 README 文件内容。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者用户名',
      required: true,
    },
    {
      name: 'repo',
      type: 'string',
      description: '仓库名称',
      required: true,
    },
    {
      name: 'ref',
      type: 'string',
      description: '分支、标签或 commit SHA',
      required: false,
    },
  ],
  execute: async (args: { owner: string; repo: string; ref?: string }) => {
    const readme = await getReadme(args.owner, args.repo, args.ref)

    return {
      owner: args.owner,
      repo: args.repo,
      path: readme.path,
      content: readme.content.substring(0, 15000), // 限制返回大小
      size: readme.size,
      truncated: readme.content.length > 15000,
    }
  },
}

/**
 * 创建 Issue 工具
 */
export const createGitHubIssueTool: Tool = {
  name: 'github_create_issue',
  description: '在 GitHub 仓库中创建一个新的 Issue。需要配置 GitHub Token。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者用户名',
      required: true,
    },
    {
      name: 'repo',
      type: 'string',
      description: '仓库名称',
      required: true,
    },
    {
      name: 'title',
      type: 'string',
      description: 'Issue 标题',
      required: true,
    },
    {
      name: 'body',
      type: 'string',
      description: 'Issue 内容',
      required: false,
    },
    {
      name: 'labels',
      type: 'array',
      description: '标签列表',
      required: false,
    },
    {
      name: 'assignees',
      type: 'array',
      description: '指派给的用户列表',
      required: false,
    },
  ],
  execute: async (args: {
    owner: string
    repo: string
    title: string
    body?: string
    labels?: string[]
    assignees?: string[]
  }) => {
    const issue = await createIssue(
      args.owner,
      args.repo,
      args.title,
      args.body,
      args.labels,
      args.assignees
    )

    return {
      success: true,
      issue,
    }
  },
}

/**
 * 搜索代码工具
 */
export const searchGitHubCodeTool: Tool = {
  name: 'github_search_code',
  description: '在 GitHub 上搜索代码。可以搜索特定的代码片段、函数名等。',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '搜索关键词',
      required: true,
    },
    {
      name: 'language',
      type: 'string',
      description: '编程语言过滤',
      required: false,
    },
    {
      name: 'perPage',
      type: 'number',
      description: '每页结果数',
      required: false,
    },
  ],
  execute: async (args: { query: string; language?: string; perPage?: number }) => {
    const results = await searchCode(
      args.query,
      args.language,
      Math.min(args.perPage || 10, 100)
    )

    return {
      query: args.query,
      language: args.language,
      totalCount: results.length,
      results,
    }
  },
}

// 导出所有 GitHub 工具
export const githubTools = [
  searchGitHubReposTool,
  getGitHubFileTool,
  getGitHubRepoTool,
  listGitHubDirTool,
  getGitHubReadmeTool,
  createGitHubIssueTool,
  searchGitHubCodeTool,
]

// 导出底层 API 函数
export {
  searchRepositories,
  getFileContent,
  getRepository,
  listDirectory,
  getReadme,
  createIssue,
  searchCode,
}
