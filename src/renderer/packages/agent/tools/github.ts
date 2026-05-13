import type { Tool, GitHubRepo, GitHubFile } from '../types'

const GITHUB_API_BASE = 'https://api.github.com'

// ==================== GitHub Token 管理 ====================

/**
 * GitHub Token（内存中存储，不持久化）
 */
let githubToken: string = ''

/**
 * 设置 GitHub Token
 * @param token - GitHub Personal Access Token
 */
export function setGitHubToken(token: string): void {
  githubToken = token
}

/**
 * 获取 GitHub Token
 * 优先使用内存中的 Token，其次使用环境变量
 */
export function getGitHubToken(): string {
  return githubToken || process.env.GITHUB_TOKEN || ''
}

/**
 * 检查是否已配置 GitHub Token
 */
export function hasGitHubToken(): boolean {
  return !!getGitHubToken()
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

/**
 * 克隆 GitHub 仓库工具
 * 生成 git clone 命令并提供克隆指导
 */
export const cloneGitHubRepoTool: Tool = {
  name: 'clone_github_repo',
  description:
    '克隆 GitHub 仓库到本地指定目录。会生成 git clone 命令并提供克隆指导。当用户想要下载或使用某个 GitHub 项目时使用此工具。',
  parameters: [
    {
      name: 'repoUrl',
      type: 'string',
      description: 'GitHub 仓库 URL，支持 HTTPS 或 SSH 格式',
      required: true,
    },
    {
      name: 'localPath',
      type: 'string',
      description: '本地克隆路径（可选，默认为当前目录，仓库名将作为子目录）',
      required: false,
    },
    {
      name: 'branch',
      type: 'string',
      description: '分支名（可选，默认克隆默认分支）',
      required: false,
    },
    {
      name: 'depth',
      type: 'number',
      description: '克隆深度，用于浅克隆（可选，例如 1 表示只克隆最新提交）',
      required: false,
    },
  ],
  execute: async (args: {
    repoUrl: string
    localPath?: string
    branch?: string
    depth?: number
  }) => {
    const { repoUrl, localPath, branch, depth } = args

    // 验证 URL 格式
    const httpsPattern = /^https:\/\/github\.com\/[^/]+\/[^/]+(\/)?$/
    const sshPattern = /^git@github\.com:[^/]+\/[^/]+(\.git)?$/
    const shortPattern = /^[^/]+\/[^/]+$/

    let normalizedUrl = repoUrl.trim()

    // 处理 owner/repo 简写格式
    if (shortPattern.test(normalizedUrl) && !normalizedUrl.startsWith('http') && !normalizedUrl.startsWith('git@')) {
      normalizedUrl = `https://github.com/${normalizedUrl}`
    }

    // 验证 URL
    if (!httpsPattern.test(normalizedUrl) && !sshPattern.test(normalizedUrl)) {
      return {
        success: false,
        error: '无效的 GitHub 仓库 URL。请使用以下格式之一：\n' +
          '1. https://github.com/owner/repo\n' +
          '2. git@github.com:owner/repo.git\n' +
          '3. owner/repo（简写格式）',
        providedUrl: repoUrl,
      }
    }

    // 提取仓库信息
    let owner = ''
    let repo = ''

    if (normalizedUrl.startsWith('https://')) {
      const match = normalizedUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
      if (match) {
        owner = match[1]
        repo = match[2].replace(/\.git$/, '')
      }
    } else if (normalizedUrl.startsWith('git@')) {
      const match = normalizedUrl.match(/github\.com:([^/]+)\/([^/]+)/)
      if (match) {
        owner = match[1]
        repo = match[2].replace(/\.git$/, '')
      }
    }

    // 构建 git clone 命令
    const commandParts = ['git clone']

    // 添加分支参数
    if (branch) {
      commandParts.push(`--branch ${branch}`)
    }

    // 添加深度参数（浅克隆）
    if (depth && depth > 0) {
      commandParts.push(`--depth ${depth}`)
    }

    // 添加仓库 URL
    commandParts.push(normalizedUrl)

    // 添加本地路径
    if (localPath) {
      commandParts.push(localPath)
    }

    const command = commandParts.join(' ')

    // 构建克隆指导
    const guidance: string[] = [
      `## 克隆 GitHub 仓库: ${owner}/${repo}`,
      '',
      '### 克隆命令',
      '```bash',
      command,
      '```',
      '',
    ]

    // 添加分支信息
    if (branch) {
      guidance.push(
        `### 分支信息`,
        `- 指定分支: **${branch}**`,
        ''
      )
    }

    // 添加本地路径信息
    if (localPath) {
      guidance.push(
        `### 本地路径`,
        `- 克隆到: **${localPath}**`,
        ''
      )
    } else {
      guidance.push(
        `### 本地路径`,
        `- 克隆到: **./${repo}/** 目录`,
        ''
      )
    }

    // 添加浅克隆说明
    if (depth) {
      guidance.push(
        `### 克隆模式`,
        `- 浅克隆: 仅克隆最近 **${depth}** 个提交`,
        '- 这样可以节省时间和磁盘空间',
        ''
      )
    }

    // 添加后续步骤
    guidance.push(
      '### 后续步骤',
      '```bash',
      `# 进入项目目录`,
      localPath ? `cd ${localPath}` : `cd ${repo}`,
      '',
      `# 查看远程分支`,
      `git branch -r`,
      '',
      `# 安装依赖（根据项目类型）`,
      `# npm install    # Node.js 项目`,
      `# pip install -r requirements.txt  # Python 项目`,
      `# bundle install # Ruby 项目`,
      '```',
      '',
      '### 注意事项',
      '1. 确保已安装 Git：\`git --version\`',
      '2. 对于私有仓库，需要配置 SSH 密钥或使用个人访问令牌',
      '3. 如果遇到权限问题，请检查 GitHub 认证配置',
      ''
    )

    // 添加 SSH 密钥配置提示（如果是 HTTPS URL）
    if (normalizedUrl.startsWith('https://')) {
      guidance.push(
        '### 配置 SSH 密钥（推荐）',
        '为避免每次推送都需要输入密码，建议配置 SSH 密钥：',
        '```bash',
        '# 生成 SSH 密钥',
        'ssh-keygen -t ed25519 -C "your_email@example.com"',
        '',
        '# 添加密钥到 SSH 代理',
        'eval "$(ssh-agent -s)"',
        'ssh-add ~/.ssh/id_ed25519',
        '',
        '# 复制公钥到 GitHub',
        'cat ~/.ssh/id_ed25519.pub',
        '# 然后将输出内容添加到 GitHub Settings -> SSH and GPG keys',
        '',
        '# 更新远程 URL 为 SSH 格式',
        `git remote set-url origin git@github.com:${owner}/${repo}.git`,
        '```',
        ''
      )
    }

    return {
      success: true,
      command,
      guidance: guidance.join('\n'),
      repository: {
        owner,
        repo,
        url: normalizedUrl,
      },
      options: {
        branch,
        localPath,
        depth,
      },
    }
  },
}

// ==================== GitHub Token 管理工具 ====================

/**
 * 设置 GitHub Token 工具
 */
export const setGitHubTokenTool: Tool = {
  name: 'github_set_token',
  description: '设置 GitHub Personal Access Token，用于需要认证的操作（如创建仓库、推送文件等）。Token 仅存储在内存中，不会持久化。',
  parameters: [
    {
      name: 'token',
      type: 'string',
      description: 'GitHub Personal Access Token（需要 repo 权限）',
      required: true,
    },
  ],
  execute: async (args: { token: string }) => {
    if (!args.token || args.token.trim() === '') {
      return {
        success: false,
        error: 'Token 不能为空',
      }
    }

    setGitHubToken(args.token.trim())

    return {
      success: true,
      message: 'GitHub Token 已设置成功',
      note: 'Token 仅存储在内存中，应用重启后需要重新设置',
    }
  },
}

/**
 * 获取 GitHub Token 状态工具
 */
export const getGitHubTokenStatusTool: Tool = {
  name: 'github_token_status',
  description: '检查 GitHub Token 是否已配置',
  parameters: [],
  execute: async () => {
    const hasToken = hasGitHubToken()
    return {
      configured: hasToken,
      message: hasToken
        ? 'GitHub Token 已配置'
        : 'GitHub Token 未配置，请使用 github_set_token 设置',
    }
  },
}

// ==================== 创建仓库工具 ====================

/**
 * 创建 GitHub 仓库
 */
async function createRepository(options: {
  name: string
  description?: string
  private?: boolean
  autoInit?: boolean
}): Promise<any> {
  const token = getGitHubToken()
  if (!token) {
    throw new Error('需要 GitHub Token 才能创建仓库。请使用 github_set_token 工具设置 Token。')
  }

  const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
    method: 'POST',
    headers: {
      ...buildHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: options.name,
      description: options.description || '',
      private: options.private || false,
      auto_init: options.autoInit || false,
    }),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `创建仓库失败: ${response.status} ${error.message || response.statusText}`
    )
  }

  const data = await response.json()

  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name,
    description: data.description,
    url: data.html_url,
    cloneUrl: data.clone_url,
    sshUrl: data.ssh_url,
    private: data.private,
    createdAt: data.created_at,
  }
}

/**
 * 创建 GitHub 仓库工具
 */
export const createGitHubRepoTool: Tool = {
  name: 'github_create_repo',
  description: '在 GitHub 上创建新仓库。需要先使用 github_set_token 设置 GitHub Token。',
  parameters: [
    {
      name: 'name',
      type: 'string',
      description: '仓库名称',
      required: true,
    },
    {
      name: 'description',
      type: 'string',
      description: '仓库描述',
      required: false,
    },
    {
      name: 'private',
      type: 'boolean',
      description: '是否私有仓库（默认 false）',
      required: false,
    },
    {
      name: 'autoInit',
      type: 'boolean',
      description: '是否自动初始化 README（默认 false）',
      required: false,
    },
  ],
  execute: async (args: {
    name: string
    description?: string
    private?: boolean
    autoInit?: boolean
  }) => {
    try {
      const repo = await createRepository({
        name: args.name,
        description: args.description,
        private: args.private,
        autoInit: args.autoInit,
      })

      return {
        success: true,
        repository: repo,
        message: `仓库 ${repo.fullName} 创建成功`,
        nextSteps: [
          `克隆仓库: git clone ${repo.cloneUrl}`,
          `或使用 SSH: git clone ${repo.sshUrl}`,
        ],
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建仓库失败',
      }
    }
  },
}

// ==================== 推送文件工具 ====================

/**
 * 获取文件的 SHA（用于更新已存在的文件）
 */
async function getFileSha(
  owner: string,
  repo: string,
  path: string,
  branch?: string
): Promise<string | null> {
  const ref = branch ? `?ref=${encodeURIComponent(branch)}` : ''
  const url = `${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}${ref}`

  const response = await fetch(url, {
    headers: buildHeaders(),
  })

  if (response.status === 404) {
    return null
  }

  if (!response.ok) {
    return null
  }

  const data = await response.json()
  return data.sha
}

/**
 * 推送文件到 GitHub 仓库
 */
async function pushFile(options: {
  owner: string
  repo: string
  path: string
  content: string
  message: string
  branch?: string
}): Promise<any> {
  const token = getGitHubToken()
  if (!token) {
    throw new Error('需要 GitHub Token 才能推送文件。请使用 github_set_token 工具设置 Token。')
  }

  const branch = options.branch || 'main'

  // 检查文件是否已存在
  const existingSha = await getFileSha(options.owner, options.repo, options.path, branch)

  // Base64 编码内容
  const contentBase64 = btoa(unescape(encodeURIComponent(options.content)))

  const body: any = {
    message: options.message,
    content: contentBase64,
    branch: branch,
  }

  // 如果文件已存在，需要提供 SHA 进行更新
  if (existingSha) {
    body.sha = existingSha
  }

  const url = `${GITHUB_API_BASE}/repos/${options.owner}/${options.repo}/contents/${options.path}`

  const response = await fetch(url, {
    method: 'PUT',
    headers: {
      ...buildHeaders(),
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })

  if (!response.ok) {
    const error = await response.json().catch(() => ({}))
    throw new Error(
      `推送文件失败: ${response.status} ${error.message || response.statusText}`
    )
  }

  const data = await response.json()

  return {
    path: data.content.path,
    sha: data.content.sha,
    url: data.content.html_url,
    branch: branch,
    action: existingSha ? 'updated' : 'created',
  }
}

/**
 * 推送文件到 GitHub 仓库工具
 */
export const pushToGitHubTool: Tool = {
  name: 'github_push_files',
  description: '推送本地文件到 GitHub 仓库（创建或更新文件）。需要先使用 github_set_token 设置 GitHub Token。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者（用户名）',
      required: true,
    },
    {
      name: 'repo',
      type: 'string',
      description: '仓库名',
      required: true,
    },
    {
      name: 'path',
      type: 'string',
      description: '文件路径（如: src/index.ts）',
      required: true,
    },
    {
      name: 'content',
      type: 'string',
      description: '文件内容',
      required: true,
    },
    {
      name: 'message',
      type: 'string',
      description: '提交消息',
      required: true,
    },
    {
      name: 'branch',
      type: 'string',
      description: '分支名（默认 main）',
      required: false,
    },
  ],
  execute: async (args: {
    owner: string
    repo: string
    path: string
    content: string
    message: string
    branch?: string
  }) => {
    try {
      const result = await pushFile({
        owner: args.owner,
        repo: args.repo,
        path: args.path,
        content: args.content,
        message: args.message,
        branch: args.branch,
      })

      return {
        success: true,
        ...result,
        message: `文件 ${args.path} 已${result.action === 'created' ? '创建' : '更新'}`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '推送文件失败',
      }
    }
  },
}

/**
 * 批量推送多个文件工具
 */
export const pushMultipleFilesTool: Tool = {
  name: 'github_push_multiple_files',
  description: '批量推送多个文件到 GitHub 仓库。需要先使用 github_set_token 设置 GitHub Token。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者（用户名）',
      required: true,
    },
    {
      name: 'repo',
      type: 'string',
      description: '仓库名',
      required: true,
    },
    {
      name: 'files',
      type: 'array',
      description: '文件列表，格式: [{path: "文件路径", content: "文件内容"}]',
      required: true,
    },
    {
      name: 'message',
      type: 'string',
      description: '提交消息',
      required: true,
    },
    {
      name: 'branch',
      type: 'string',
      description: '分支名（默认 main）',
      required: false,
    },
  ],
  execute: async (args: {
    owner: string
    repo: string
    files: Array<{ path: string; content: string }>
    message: string
    branch?: string
  }) => {
    try {
      const results: Array<{
        path: string
        success: boolean
        action?: string
        url?: string
        error?: string
      }> = []

      for (const file of args.files) {
        try {
          const result = await pushFile({
            owner: args.owner,
            repo: args.repo,
            path: file.path,
            content: file.content,
            message: args.message,
            branch: args.branch,
          })

          results.push({
            path: file.path,
            success: true,
            action: result.action,
            url: result.url,
          })
        } catch (error) {
          results.push({
            path: file.path,
            success: false,
            error: error instanceof Error ? error.message : '推送失败',
          })
        }
      }

      const successCount = results.filter((r) => r.success).length
      const failCount = results.filter((r) => !r.success).length

      return {
        success: failCount === 0,
        totalFiles: args.files.length,
        successCount,
        failCount,
        results,
        message: `批量推送完成: ${successCount} 成功, ${failCount} 失败`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '批量推送失败',
      }
    }
  },
}

// ==================== Git 命令生成器工具 ====================

/**
 * 生成 Git 操作命令
 */
function generateGitCommands(options: {
  operation: string
  repoUrl?: string
  branch?: string
  message?: string
  files?: string
}): { commands: string[]; description: string[] } {
  const commands: string[] = []
  const description: string[] = []

  switch (options.operation) {
    case 'init':
      commands.push('git init')
      description.push('初始化 Git 仓库')
      if (options.repoUrl) {
        commands.push(`git remote add origin ${options.repoUrl}`)
        description.push('添加远程仓库')
      }
      break

    case 'add':
      if (options.files) {
        const fileList = options.files.split(',').map((f) => f.trim())
        commands.push(`git add ${fileList.join(' ')}`)
      } else {
        commands.push('git add .')
      }
      description.push('添加文件到暂存区')
      break

    case 'commit':
      const commitMsg = options.message || 'Update files'
      commands.push(`git commit -m "${commitMsg}"`)
      description.push('提交更改')
      break

    case 'push':
      const pushBranch = options.branch || 'main'
      commands.push(`git push -u origin ${pushBranch}`)
      description.push('推送到远程仓库')
      break

    case 'pull':
      const pullBranch = options.branch || 'main'
      commands.push(`git pull origin ${pullBranch}`)
      description.push('从远程仓库拉取更新')
      break

    case 'branch':
      if (options.branch) {
        commands.push(`git checkout -b ${options.branch}`)
        description.push(`创建并切换到新分支: ${options.branch}`)
      } else {
        commands.push('git branch')
        description.push('列出所有分支')
      }
      break

    case 'merge':
      if (options.branch) {
        commands.push(`git merge ${options.branch}`)
        description.push(`合并分支: ${options.branch}`)
      }
      break

    default:
      commands.push(`# 未知操作: ${options.operation}`)
      description.push('请指定有效的操作类型')
  }

  return { commands, description }
}

/**
 * Git 命令生成器工具
 */
export const generateGitCommandsTool: Tool = {
  name: 'github_generate_commands',
  description: '生成完整的 Git 操作命令（init、add、commit、push、pull、branch、merge 等）',
  parameters: [
    {
      name: 'operation',
      type: 'string',
      description: '操作类型: init|add|commit|push|pull|branch|merge',
      required: true,
      enum: ['init', 'add', 'commit', 'push', 'pull', 'branch', 'merge'],
    },
    {
      name: 'repoUrl',
      type: 'string',
      description: '仓库 URL（用于 init 操作）',
      required: false,
    },
    {
      name: 'branch',
      type: 'string',
      description: '分支名',
      required: false,
    },
    {
      name: 'message',
      type: 'string',
      description: '提交消息',
      required: false,
    },
    {
      name: 'files',
      type: 'string',
      description: '文件路径（逗号分隔，用于 add 操作）',
      required: false,
    },
  ],
  execute: async (args: {
    operation: string
    repoUrl?: string
    branch?: string
    message?: string
    files?: string
  }) => {
    const { commands, description } = generateGitCommands(args)

    // 生成完整的指导文档
    const guidance: string[] = [
      `## Git ${args.operation.toUpperCase()} 操作`,
      '',
      '### 命令',
      '```bash',
      ...commands,
      '```',
      '',
      '### 说明',
      ...description.map((d) => `- ${d}`),
    ]

    // 添加常用工作流示例
    if (args.operation === 'init') {
      guidance.push(
        '',
        '### 完整工作流示例',
        '```bash',
        '# 初始化仓库',
        'git init',
        '',
        '# 添加文件',
        'git add .',
        '',
        '# 提交',
        'git commit -m "Initial commit"',
        '',
        '# 添加远程仓库',
        'git remote add origin <repo-url>',
        '',
        '# 推送',
        'git push -u origin main',
        '```'
      )
    }

    return {
      success: true,
      operation: args.operation,
      commands,
      description,
      guidance: guidance.join('\n'),
    }
  },
}

// ==================== 导出 ====================

// 导出所有 GitHub 工具
export const githubTools = [
  searchGitHubReposTool,
  getGitHubFileTool,
  getGitHubRepoTool,
  listGitHubDirTool,
  getGitHubReadmeTool,
  createGitHubIssueTool,
  searchGitHubCodeTool,
  cloneGitHubRepoTool,
  // 新增工具
  setGitHubTokenTool,
  getGitHubTokenStatusTool,
  createGitHubRepoTool,
  pushToGitHubTool,
  pushMultipleFilesTool,
  generateGitCommandsTool,
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
