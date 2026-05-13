/**
 * Git 执行器
 * 使用 Node.js child_process 执行真实的 git 命令
 */

import { spawn } from 'child_process'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'

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
 * 执行 git clone 命令
 */
export async function executeGitClone(options: CloneOptions): Promise<CloneResult> {
  const { repoUrl, targetDir, branch, depth, onProgress } = options

  // 构建 git clone 参数
  const args: string[] = ['clone']

  if (branch) {
    args.push('-b', branch)
  }

  if (depth && depth > 0) {
    args.push('--depth', String(depth))
  }

  args.push(repoUrl)

  if (targetDir) {
    args.push(targetDir)
  }

  try {
    // 使用 spawn 获取实时输出
    return new Promise((resolve) => {
      const gitProcess = spawn('git', args, {
        cwd: process.cwd(),
        env: process.env,
        shell: true,
      })

      let output = ''
      let errorOutput = ''

      gitProcess.stdout?.on('data', (data) => {
        const chunk = data.toString()
        output += chunk
        onProgress?.(chunk)
      })

      gitProcess.stderr?.on('data', (data) => {
        const chunk = data.toString()
        // git clone 的输出通常在 stderr
        output += chunk
        errorOutput += chunk
        onProgress?.(chunk)
      })

      gitProcess.on('close', (code) => {
        if (code === 0) {
          resolve({
            success: true,
            output: output || '克隆完成',
            clonePath: targetDir || extractRepoName(repoUrl),
          })
        } else {
          resolve({
            success: false,
            output,
            error: errorOutput || `克隆失败，退出码: ${code}`,
          })
        }
      })

      gitProcess.on('error', (err) => {
        resolve({
          success: false,
          output,
          error: err.message,
        })
      })
    })
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
 * 检查是否安装了 git
 */
export async function checkGitInstalled(): Promise<boolean> {
  return new Promise((resolve) => {
    const process = spawn('git', ['--version'], { shell: true })

    process.on('close', (code) => {
      resolve(code === 0)
    })

    process.on('error', () => {
      resolve(false)
    })

    // 超时处理
    setTimeout(() => {
      resolve(false)
    }, 5000)
  })
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

/**
 * 执行 git init
 */
export async function executeGitInit(targetDir: string): Promise<CloneResult> {
  return new Promise((resolve) => {
    const process = spawn('git', ['init'], {
      cwd: targetDir,
      shell: true,
    })

    let output = ''
    let errorOutput = ''

    process.stdout?.on('data', (data) => {
      output += data.toString()
    })

    process.stderr?.on('data', (data) => {
      errorOutput += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          output: output || 'Git 仓库初始化成功',
          clonePath: targetDir,
        })
      } else {
        resolve({
          success: false,
          output,
          error: errorOutput || `初始化失败，退出码: ${code}`,
        })
      }
    })

    process.on('error', (err) => {
      resolve({
        success: false,
        output,
        error: err.message,
      })
    })
  })
}

/**
 * 执行 git add
 */
export async function executeGitAdd(targetDir: string, files: string = '.'): Promise<CloneResult> {
  return new Promise((resolve) => {
    const process = spawn('git', ['add', files], {
      cwd: targetDir,
      shell: true,
    })

    let output = ''
    let errorOutput = ''

    process.stdout?.on('data', (data) => {
      output += data.toString()
    })

    process.stderr?.on('data', (data) => {
      errorOutput += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          output: output || '文件已添加到暂存区',
          clonePath: targetDir,
        })
      } else {
        resolve({
          success: false,
          output,
          error: errorOutput || `添加失败，退出码: ${code}`,
        })
      }
    })

    process.on('error', (err) => {
      resolve({
        success: false,
        output,
        error: err.message,
      })
    })
  })
}

/**
 * 执行 git commit
 */
export async function executeGitCommit(targetDir: string, message: string): Promise<CloneResult> {
  return new Promise((resolve) => {
    const process = spawn('git', ['commit', '-m', message], {
      cwd: targetDir,
      shell: true,
    })

    let output = ''
    let errorOutput = ''

    process.stdout?.on('data', (data) => {
      output += data.toString()
    })

    process.stderr?.on('data', (data) => {
      errorOutput += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          output: output || '提交成功',
          clonePath: targetDir,
        })
      } else {
        resolve({
          success: false,
          output,
          error: errorOutput || `提交失败，退出码: ${code}`,
        })
      }
    })

    process.on('error', (err) => {
      resolve({
        success: false,
        output,
        error: err.message,
      })
    })
  })
}

/**
 * 执行 git push
 */
export async function executeGitPush(targetDir: string, remote: string = 'origin', branch: string = 'main'): Promise<CloneResult> {
  return new Promise((resolve) => {
    const process = spawn('git', ['push', remote, branch], {
      cwd: targetDir,
      shell: true,
    })

    let output = ''
    let errorOutput = ''

    process.stdout?.on('data', (data) => {
      output += data.toString()
    })

    process.stderr?.on('data', (data) => {
      errorOutput += data.toString()
    })

    process.on('close', (code) => {
      if (code === 0) {
        resolve({
          success: true,
          output: output || '推送成功',
          clonePath: targetDir,
        })
      } else {
        resolve({
          success: false,
          output,
          error: errorOutput || `推送失败，退出码: ${code}`,
        })
      }
    })

    process.on('error', (err) => {
      resolve({
        success: false,
        output,
        error: err.message,
      })
    })
  })
}

/**
 * 执行完整的 git 工作流：add -> commit -> push
 */
export async function executeGitWorkflow(
  targetDir: string,
  message: string,
  files: string = '.',
  branch: string = 'main'
): Promise<CloneResult> {
  // 1. git add
  const addResult = await executeGitAdd(targetDir, files)
  if (!addResult.success) {
    return addResult
  }

  // 2. git commit
  const commitResult = await executeGitCommit(targetDir, message)
  if (!commitResult.success) {
    // 可能是没有变更需要提交
    if (commitResult.error?.includes('nothing to commit')) {
      return {
        success: true,
        output: '没有需要提交的变更',
        clonePath: targetDir,
      }
    }
    return commitResult
  }

  // 3. git push
  const pushResult = await executeGitPush(targetDir, 'origin', branch)
  return pushResult
}
