import type { Tool, GitHubRepo, GitHubFile } from '../types'
import { executeGitClone, checkGitInstalled, getDefaultCloneDir, ensureDir } from './git-executor'

const GITHUB_API_BASE = 'https://api.github.com'

// GitHub Token 存储（内存中）
let githubToken = ''

export function setGitHubToken(token: string): void {
  githubToken = token
}

export function getGitHubToken(): string {
  return githubToken
}

export function hasGitHubToken(): boolean {
  return githubToken.length > 0
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
    throw new Error(error.message || `搜索失败: ${response.status}`)
  }

  const data = await response.json()
  return data.items.map((item: any) => ({
    id: item.id,
    name: item.name,
    fullName: item.full_name,
    description: item.description || '',
    url: item.html_url,
    stars: item.stargazers_count,
    forks: item.forks_count,
    language: item.language || 'Unknown',
    updatedAt: item.updated_at,
  }))
}

/**
 * 获取文件内容
 */
async function getFileContent(owner: string, repo: string, path: string, ref?: string): Promise<GitHubFile> {
  const params = ref ? `?ref=${ref}` : ''
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}${params}`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    throw new Error(`获取文件失败: ${response.status}`)
  }

  const data = await response.json()

  // GitHub API 返回 base64 编码的内容
  const content = data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : ''

  return {
    name: data.name,
    path: data.path,
    content,
    size: data.size,
    url: data.html_url,
  }
}

/**
 * 获取仓库信息
 */
async function getRepository(owner: string, repo: string): Promise<GitHubRepo> {
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    throw new Error(`获取仓库失败: ${response.status}`)
  }

  const data = await response.json()
  return {
    id: data.id,
    name: data.name,
    fullName: data.full_name,
    description: data.description || '',
    url: data.html_url,
    stars: data.stargazers_count,
    forks: data.forks_count,
    language: data.language || 'Unknown',
    updatedAt: data.updated_at,
  }
}

/**
 * 列出目录内容
 */
async function listDirectory(owner: string, repo: string, path: string = '', ref?: string): Promise<GitHubFile[]> {
  const params = ref ? `?ref=${ref}` : ''
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/contents/${path}${params}`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    throw new Error(`获取目录失败: ${response.status}`)
  }

  const data = await response.json()

  if (!Array.isArray(data)) {
    throw new Error('路径不是目录')
  }

  return data.map((item: any) => ({
    name: item.name,
    path: item.path,
    content: '',
    size: item.size || 0,
    url: item.html_url,
    type: item.type,
  }))
}

/**
 * 获取 README 内容
 */
async function getReadme(owner: string, repo: string, ref?: string): Promise<GitHubFile> {
  const params = ref ? `?ref=${ref}` : ''
  const response = await fetch(`${GITHUB_API_BASE}/repos/${owner}/${repo}/readme${params}`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    throw new Error(`获取 README 失败: ${response.status}`)
  }

  const data = await response.json()
  const content = data.content ? Buffer.from(data.content, 'base64').toString('utf-8') : ''

  return {
    name: data.name,
    path: data.path,
    content,
    size: data.size,
    url: data.html_url,
  }
}

/**
 * 创建 Issue
 */
async function createIssue(
  owner: string,
  repo: string,
  title: string,
  body: string,
  labels?: string[]
): Promise<{ number: number; url: string }> {
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
    }),
  })

  if (!response.ok) {
    throw new Error(`创建 Issue 失败: ${response.status}`)
  }

  const data = await response.json()
  return {
    number: data.number,
    url: data.html_url,
  }
}

/**
 * 搜索代码
 */
async function searchCode(query: string, language?: string, perPage: number = 10): Promise<any[]> {
  const q = language ? `${query} language:${language}` : query
  const params = new URLSearchParams({
    q,
    per_page: perPage.toString(),
  })

  const response = await fetch(`${GITHUB_API_BASE}/search/code?${params}`, {
    headers: buildHeaders(),
  })

  if (!response.ok) {
    throw new Error(`搜索代码失败: ${response.status}`)
  }

  const data = await response.json()
  return data.items
}

// ==================== 工具定义 ====================

/**
 * 搜索 GitHub 仓库工具
 */
export const searchGitHubReposTool: Tool = {
  name: 'github_search_repos',
  description: '在 GitHub 上搜索仓库。当用户想要查找开源项目、代码示例或特定功能的实现时使用此工具。',
  parameters: [
    {
      name: 'query',
      type: 'string',
      description: '搜索关键词，支持 GitHub 搜索语法（如 "react stars:>1000"）',
      required: true,
    },
    {
      name: 'sort',
      type: 'string',
      description: '排序方式：stars（默认）、forks、updated',
      required: false,
    },
    {
      name: 'order',
      type: 'string',
      description: '排序顺序：desc（默认降序）、asc（升序）',
      required: false,
    },
    {
      name: 'perPage',
      type: 'number',
      description: '每页结果数量（默认 10，最大 100）',
      required: false,
    },
  ],
  execute: async (args: {
    query: string
    sort?: 'stars' | 'forks' | 'updated'
    order?: 'asc' | 'desc'
    perPage?: number
  }) => {
    try {
      const results = await searchRepositories(
        args.query,
        args.sort || 'stars',
        args.order || 'desc',
        args.perPage || 10
      )

      if (results.length === 0) {
        return {
          success: true,
          message: '未找到匹配的仓库',
          query: args.query,
          results: [],
        }
      }

      return {
        success: true,
        message: `找到 ${results.length} 个仓库`,
        query: args.query,
        results,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索失败',
        query: args.query,
      }
    }
  },
}

/**
 * 获取 GitHub 文件内容工具
 */
export const getGitHubFileTool: Tool = {
  name: 'github_get_file',
  description: '获取 GitHub 仓库中特定文件的内容。当用户想要查看某个文件的代码或内容时使用此工具。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者（用户名或组织名）',
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
      description: '文件路径（如 "src/index.js" 或 "README.md"）',
      required: true,
    },
    {
      name: 'ref',
      type: 'string',
      description: '分支或标签名（可选，默认为默认分支）',
      required: false,
    },
  ],
  execute: async (args: { owner: string; repo: string; path: string; ref?: string }) => {
    try {
      const file = await getFileContent(args.owner, args.repo, args.path, args.ref)

      return {
        success: true,
        file,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取文件失败',
        owner: args.owner,
        repo: args.repo,
        path: args.path,
      }
    }
  },
}

/**
 * 获取 GitHub 仓库信息工具
 */
export const getGitHubRepoTool: Tool = {
  name: 'github_get_repo',
  description: '获取 GitHub 仓库的详细信息。当用户想要了解某个仓库的基本信息、星标数、语言等时使用此工具。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者',
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
    try {
      const repository = await getRepository(args.owner, args.repo)

      return {
        success: true,
        repository,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取仓库失败',
        owner: args.owner,
        repo: args.repo,
      }
    }
  },
}

/**
 * 列出 GitHub 目录内容工具
 */
export const listGitHubDirTool: Tool = {
  name: 'github_list_dir',
  description: '列出 GitHub 仓库中某个目录的内容。当用户想要查看项目结构或浏览文件列表时使用此工具。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者',
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
      description: '目录路径（可选，默认为根目录）',
      required: false,
    },
    {
      name: 'ref',
      type: 'string',
      description: '分支或标签名（可选）',
      required: false,
    },
  ],
  execute: async (args: { owner: string; repo: string; path?: string; ref?: string }) => {
    try {
      const files = await listDirectory(args.owner, args.repo, args.path || '', args.ref)

      return {
        success: true,
        files,
        owner: args.owner,
        repo: args.repo,
        path: args.path || '/',
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取目录失败',
        owner: args.owner,
        repo: args.repo,
        path: args.path,
      }
    }
  },
}

/**
 * 获取 GitHub README 工具
 */
export const getGitHubReadmeTool: Tool = {
  name: 'github_get_readme',
  description: '获取 GitHub 仓库的 README 文件内容。当用户想要了解项目说明、使用方法或文档时使用此工具。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者',
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
      description: '分支或标签名（可选）',
      required: false,
    },
  ],
  execute: async (args: { owner: string; repo: string; ref?: string }) => {
    try {
      const readme = await getReadme(args.owner, args.repo, args.ref)

      return {
        success: true,
        readme,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '获取 README 失败',
        owner: args.owner,
        repo: args.repo,
      }
    }
  },
}

/**
 * 创建 GitHub Issue 工具
 */
export const createGitHubIssueTool: Tool = {
  name: 'github_create_issue',
  description: '在 GitHub 仓库中创建 Issue。当用户想要报告 bug、提出功能请求或创建任务时使用此工具。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者',
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
      required: true,
    },
    {
      name: 'labels',
      type: 'array',
      description: '标签列表（可选）',
      required: false,
    },
  ],
  execute: async (args: {
    owner: string
    repo: string
    title: string
    body: string
    labels?: string[]
  }) => {
    try {
      const issue = await createIssue(args.owner, args.repo, args.title, args.body, args.labels)

      return {
        success: true,
        issue,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '创建 Issue 失败',
        owner: args.owner,
        repo: args.repo,
      }
    }
  },
}

/**
 * 搜索 GitHub 代码工具
 */
export const searchGitHubCodeTool: Tool = {
  name: 'github_search_code',
  description: '在 GitHub 上搜索代码。当用户想要查找特定代码片段、函数实现或使用示例时使用此工具。',
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
      description: '编程语言过滤（可选，如 "javascript", "python"）',
      required: false,
    },
    {
      name: 'perPage',
      type: 'number',
      description: '每页结果数量（默认 10）',
      required: false,
    },
  ],
  execute: async (args: { query: string; language?: string; perPage?: number }) => {
    try {
      const results = await searchCode(args.query, args.language, args.perPage || 10)

      return {
        success: true,
        query: args.query,
        language: args.language,
        totalCount: results.length,
        results,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '搜索失败',
        query: args.query,
      }
    }
  },
}

/**
 * 克隆 GitHub 仓库工具
 * 真实执行 git clone 命令并克隆仓库到本地
 */
export const cloneGitHubRepoTool: Tool = {
  name: 'clone_github_repo',
  description:
    '克隆 GitHub 仓库到本地指定目录。会真实执行 git clone 命令，不是只生成命令。当用户想要下载或使用某个 GitHub 项目时使用此工具。',
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
      description: '本地克隆路径（可选，默认为 ~/Projects/）',
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

    // 检查是否安装了 git
    const hasGit = await checkGitInstalled()
    if (!hasGit) {
      return {
        success: false,
        error: '未检测到 Git，请先安装 Git',
        instructions: [
          'Windows: 下载安装 https://git-scm.com/download/win',
          'macOS: 运行 brew install git',
          'Linux: 运行 sudo apt-get install git',
        ],
      }
    }

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

    // 确定克隆路径
    let targetDir = localPath
    if (!targetDir) {
      const defaultDir = getDefaultCloneDir()
      ensureDir(defaultDir)
      targetDir = `${defaultDir}/${repo}`
    }

    // 检查目标目录是否已存在
    try {
      const fs = await import('fs')
      if (fs.existsSync(targetDir)) {
        return {
          success: false,
          error: `目标目录已存在: ${targetDir}`,
          suggestion: '请指定其他路径或删除现有目录',
        }
      }
    } catch {
      // 如果无法检查，继续尝试克隆
    }

    // 执行克隆
    const result = await executeGitClone({
      repoUrl: normalizedUrl,
      targetDir,
      branch,
      depth,
    })

    if (result.success) {
      return {
        success: true,
        message: `✅ 克隆成功！`,
        clonePath: targetDir,
        fullPath: targetDir,
        repoUrl: normalizedUrl,
        repository: { owner, repo },
        output: result.output,
        nextSteps: [
          `📁 项目位置: ${targetDir}`,
          ``,
          `后续操作:`,
          `cd "${targetDir}"`,
          `ls -la  # 查看文件`,
          `git log --oneline -5  # 查看提交历史`,
        ],
      }
    } else {
      return {
        success: false,
        message: '❌ 克隆失败',
        error: result.error,
        suggestion: '请检查网络连接、仓库 URL 是否正确，或尝试使用 SSH 方式',
      }
    }
  },
}

// ==================== GitHub Token 管理工具 ====================

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
      message: 'GitHub Token 已设置（仅当前会话有效）',
    }
  },
}

export const getGitHubTokenStatusTool: Tool = {
  name: 'github_token_status',
  description: '检查 GitHub Token 是否已设置',
  parameters: [],
  execute: async () => {
    const hasToken = hasGitHubToken()

    return {
      success: true,
      hasToken,
      message: hasToken ? 'Token 已设置' : 'Token 未设置',
    }
  },
}

// ==================== 创建仓库工具 ====================

export const createGitHubRepoTool: Tool = {
  name: 'github_create_repo',
  description: '在 GitHub 上创建新仓库。需要设置 GitHub Token 才能使用。',
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
      name: 'isPrivate',
      type: 'boolean',
      description: '是否私有仓库（默认 false）',
      required: false,
    },
    {
      name: 'autoInit',
      type: 'boolean',
      description: '是否自动初始化 README（默认 true）',
      required: false,
    },
  ],
  execute: async (args: {
    name: string
    description?: string
    isPrivate?: boolean
    autoInit?: boolean
  }) => {
    if (!hasGitHubToken()) {
      return {
        success: false,
        error: '请先设置 GitHub Token',
        message: '使用 github_set_token 工具设置 Token',
      }
    }

    try {
      const response = await fetch(`${GITHUB_API_BASE}/user/repos`, {
        method: 'POST',
        headers: {
          ...buildHeaders(),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: args.name,
          description: args.description,
          private: args.isPrivate ?? false,
          auto_init: args.autoInit ?? true,
        }),
      })

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || `创建失败: ${response.status}`)
      }

      const data = await response.json()

      return {
        success: true,
        repository: {
          name: data.name,
          fullName: data.full_name,
          url: data.html_url,
          cloneUrl: data.clone_url,
        },
        message: `仓库 ${data.full_name} 创建成功`,
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

export const pushToGitHubTool: Tool = {
  name: 'github_push_files',
  description: '推送文件到 GitHub 仓库。需要设置 GitHub Token。',
  parameters: [
    {
      name: 'owner',
      type: 'string',
      description: '仓库所有者',
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
      description: '文件路径',
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
    if (!hasGitHubToken()) {
      return {
        success: false,
        error: '请先设置 GitHub Token',
      }
    }

    try {
      // 先获取文件 SHA（如果存在）
      let sha: string | undefined
      try {
        const getResponse = await fetch(
          `${GITHUB_API_BASE}/repos/${args.owner}/${args.repo}/contents/${args.path}?ref=${args.branch || 'main'}`,
          { headers: buildHeaders() }
        )
        if (getResponse.ok) {
          const data = await getResponse.json()
          sha = data.sha
        }
      } catch {
        // 文件不存在，忽略错误
      }

      // 创建或更新文件
      const response = await fetch(
        `${GITHUB_API_BASE}/repos/${args.owner}/${args.repo}/contents/${args.path}`,
        {
          method: 'PUT',
          headers: {
            ...buildHeaders(),
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            message: args.message,
            content: Buffer.from(args.content).toString('base64'),
            branch: args.branch || 'main',
            sha,
          }),
        }
      )

      if (!response.ok) {
        const error = await response.json().catch(() => ({}))
        throw new Error(error.message || `推送失败: ${response.status}`)
      }

      return {
        success: true,
        message: `文件 ${args.path} 推送成功`,
      }
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : '推送失败',
      }
    }
  },
}

// ==================== Git 命令生成器工具 ====================

export const generateGitCommandsTool: Tool = {
  name: 'github_generate_commands',
  description: '生成 Git 操作命令（init、add、commit、push、pull、branch、merge、clone）',
  parameters: [
    {
      name: 'operation',
      type: 'string',
      description: '操作类型: init|add|commit|push|pull|branch|merge|clone|status|log',
      required: true,
    },
    {
      name: 'repoUrl',
      type: 'string',
      description: '仓库 URL（clone/push 时需要）',
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
      description: '提交消息（commit 时需要）',
      required: false,
    },
    {
      name: 'files',
      type: 'string',
      description: '文件路径，逗号分隔（add 时需要）',
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
    const commands: string[] = []
    const explanations: string[] = []

    switch (args.operation) {
      case 'init':
        commands.push('git init')
        explanations.push('初始化一个新的 Git 仓库')
        break

      case 'clone':
        if (args.repoUrl) {
          commands.push(`git clone ${args.repoUrl}`)
          explanations.push('克隆远程仓库到本地')
        } else {
          return { success: false, error: 'clone 操作需要提供 repoUrl' }
        }
        break

      case 'add':
        if (args.files) {
          commands.push(`git add ${args.files}`)
          explanations.push('将指定文件添加到暂存区')
        } else {
          commands.push('git add .')
          explanations.push('将所有修改添加到暂存区')
        }
        break

      case 'commit':
        if (args.message) {
          commands.push(`git commit -m "${args.message}"`)
          explanations.push('提交暂存区的修改')
        } else {
          return { success: false, error: 'commit 操作需要提供 message' }
        }
        break

      case 'push':
        commands.push(`git push origin ${args.branch || 'main'}`)
        explanations.push('推送本地提交到远程仓库')
        break

      case 'pull':
        commands.push(`git pull origin ${args.branch || 'main'}`)
        explanations.push('拉取远程仓库的最新修改')
        break

      case 'branch':
        if (args.branch) {
          commands.push(`git checkout -b ${args.branch}`)
          explanations.push(`创建并切换到新分支 ${args.branch}`)
        } else {
          commands.push('git branch -a')
          explanations.push('列出所有分支')
        }
        break

      case 'merge':
        if (args.branch) {
          commands.push(`git merge ${args.branch}`)
          explanations.push(`合并 ${args.branch} 分支到当前分支`)
        } else {
          return { success: false, error: 'merge 操作需要提供 branch' }
        }
        break

      case 'status':
        commands.push('git status')
        explanations.push('查看当前仓库状态')
        break

      case 'log':
        commands.push('git log --oneline -10')
        explanations.push('查看最近 10 条提交记录')
        break

      default:
        return { success: false, error: `不支持的操作: ${args.operation}` }
    }

    return {
      success: true,
      operation: args.operation,
      commands,
      explanations,
      fullCommand: commands.join(' && '),
    }
  },
}

// ==================== 导出所有工具 ====================

export const githubTools = [
  searchGitHubReposTool,
  getGitHubFileTool,
  getGitHubRepoTool,
  listGitHubDirTool,
  getGitHubReadmeTool,
  createGitHubIssueTool,
  searchGitHubCodeTool,
  cloneGitHubRepoTool,
  setGitHubTokenTool,
  getGitHubTokenStatusTool,
  createGitHubRepoTool,
  pushToGitHubTool,
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
