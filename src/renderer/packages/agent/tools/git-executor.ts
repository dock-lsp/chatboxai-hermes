/**
 * Git 执行器 (Renderer 进程版本)
 * 通过 IPC 调用 Main 进程执行 git 命令
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

const { ipcRenderer } = window.require('electron')

export interface CloneResult {
  success: boolean
  output: string
  error?: string
  clonePath?: string
}

export interface CloneOptions {
  repoUrl: string
  targetDir?: string
  branch?: string
  depth?: number
  onProgress?: (progress: string) => void
}

/**
 * 执行 git clone 命令 (通过 IPC)
 */
export async function executeGitClone(options: CloneOptions): Promise<CloneResult> {
  const { repoUrl, targetDir, branch, depth } = options

  try {
    const result = await ipcRenderer.invoke('git:clone', {
      repoUrl,
      targetDir,
      branch,
      depth,
    })

    if (result.success) {
      return {
        success: true,
        output: result.output,
        clonePath: targetDir || extractRepoName(repoUrl),
      }
    } else {
      return {
        success: false,
        output: result.output,
        error: result.error,
      }
    }
  } catch (error) {
    return {
      success: false,
      output: '',
      error: error instanceof Error ? error.message : '未知错误',
    }
  }
}

/**
 * 从仓库 URL 提取仓库名称
 */
function extractRepoName(url: string): string {
  // 处理 https://github.com/owner/repo.git 格式
  const httpsMatch = url.match(/\/([^\/]+?)(?:\.git)?$/)
  if (httpsMatch) {
    return httpsMatch[1]
  }

  // 处理 git@github.com:owner/repo.git 格式
  const sshMatch = url.match(/:([^\/]+?)(?:\.git)?$/)
  if (sshMatch) {
    return sshMatch[1]
  }

  return 'repo'
}

/**
 * 检查是否安装了 git (通过 IPC)
 */
export async function checkGitInstalled(): Promise<boolean> {
  try {
    return await ipcRenderer.invoke('git:check')
  } catch {
    return false
  }
}

/**
 * 获取默认克隆目录
 */
export function getDefaultCloneDir(): string {
  // 使用用户的 home 目录下的 Projects 文件夹
  const homeDir = os.homedir() || process.cwd()
  return path.join(homeDir, 'Projects')
}

/**
 * 确保目录存在
 */
export function ensureDir(dir: string): void {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true })
  }
}
