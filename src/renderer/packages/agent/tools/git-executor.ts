/**
 * Git 执行器 (Renderer 进程版本)
 * 通过 IPC 调用 Main 进程执行 git 命令
 */

import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

export interface CloneResult {
  success: boolean
  output: string
  error?: string
  clonePath?: string
  progress?: string
  resumed?: boolean
}

export interface CloneOptions {
  repoUrl: string
  targetDir?: string
  branch?: string
  depth?: number
  onProgress?: (progress: string) => void
}

/**
 * 安全调用 electronAPI
 */
function getElectronAPI(): any {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI
  }
  return null
}

/**
 * 执行 git clone 命令 (通过 IPC)
 * 支持断点续传和进度显示
 */
export async function executeGitClone(options: CloneOptions): Promise<CloneResult> {
  const { repoUrl, targetDir, branch, depth, onProgress } = options

  try {
    const api = getElectronAPI()
    if (!api) {
      return {
        success: false,
        output: '',
        error: '当前环境不支持执行 Git 命令（非 Electron 桌面环境）',
      }
    }

    const result = await api.invoke('git:clone', {
      repoUrl,
      targetDir,
      branch,
      depth,
    })

    if (result.success) {
      // 回调进度信息
      if (onProgress && result.progress) {
        onProgress(result.progress)
      }
      return {
        success: true,
        output: result.output,
        clonePath: result.clonePath || targetDir || extractRepoName(repoUrl),
        progress: result.progress,
        resumed: result.resumed || false,
      }
    } else {
      return {
        success: false,
        output: result.output,
        error: result.error,
        progress: result.progress,
      }
    }
  } catch (error: any) {
    return {
      success: false,
      output: '',
      error: error?.message || String(error) || '未知错误',
    }
  }
}

/**
 * 下载文件
 * Electron 环境：通过 IPC 保存到本地
 * 浏览器/移动端：触发浏览器下载
 */
export async function downloadFile(url: string, savePath: string): Promise<{ success: boolean; savePath?: string; error?: string }> {
  try {
    const api = getElectronAPI()
    if (api) {
      // Electron 桌面端：通过 IPC 保存
      const result = await api.invoke('file:download', { url, savePath })
      return result
    }

    // 浏览器/移动端：使用 fetch + Blob 下载
    const response = await fetch(url)
    if (!response.ok) {
      return { success: false, error: `下载失败: HTTP ${response.status}` }
    }
    const blob = await response.blob()
    const blobUrl = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = blobUrl
    // 从 savePath 或 URL 中提取文件名
    const fileName = savePath?.split('/').pop() || url.split('/').pop() || 'download.zip'
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(blobUrl)

    return { success: true, savePath: fileName }
  } catch (error: any) {
    return {
      success: false,
      error: error?.message || String(error) || '下载失败',
    }
  }
}

/**
 * 从仓库 URL 提取仓库信息
 */
export function extractRepoInfo(repoUrl: string): { owner: string; repo: string } | null {
  const httpsMatch = repoUrl.match(/github\.com\/([^/]+)\/([^/]+)/)
  if (httpsMatch) {
    return {
      owner: httpsMatch[1],
      repo: httpsMatch[2].replace(/\.git$/, ''),
    }
  }

  const sshMatch = repoUrl.match(/github\.com:([^/]+)\/([^/]+)/)
  if (sshMatch) {
    return {
      owner: sshMatch[1],
      repo: sshMatch[2].replace(/\.git$/, ''),
    }
  }

  return null
}

/**
 * 从仓库 URL 提取仓库名称
 */
function extractRepoName(url: string): string {
  const httpsMatch = url.match(/\/([^\/]+?)(?:\.git)?$/)
  if (httpsMatch) {
    return httpsMatch[1]
  }

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
    const api = getElectronAPI()
    if (!api) return false
    return await api.invoke('git:check')
  } catch {
    return false
  }
}

/**
 * 获取默认克隆目录
 */
export function getDefaultCloneDir(): string {
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

/**
 * 检测当前设备类型
 */
export function detectDeviceType(): 'pc' | 'mobile' {
  if (typeof navigator !== 'undefined') {
    const userAgent = navigator.userAgent.toLowerCase()
    if (/android|iphone|ipad|ipod|mobile/i.test(userAgent)) {
      return 'mobile'
    }
  }
  return 'pc'
}
