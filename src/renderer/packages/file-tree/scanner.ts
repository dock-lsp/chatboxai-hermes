/**
 * 目录扫描器核心模块
 * 使用 Electron IPC 调用主进程文件系统 API 进行递归扫描
 */

import type {
  FileTreeNode,
  FileNodeType,
  ScanConfig,
  ScanResult,
  ScanProgressCallback,
  FileStats
} from './types'

/**
 * 生成唯一ID
 * @param path 文件路径
 * @returns 唯一标识符
 */
function generateId(path: string): string {
  // 使用路径的哈希值作为ID
  let hash = 0
  for (let i = 0; i < path.length; i++) {
    const char = path.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return `node_${Math.abs(hash)}_${Date.now()}`
}

/**
 * 获取文件扩展名
 * @param filename 文件名
 * @returns 扩展名（不含点号）
 */
function getExtension(filename: string): string {
  const lastDot = filename.lastIndexOf('.')
  return lastDot > 0 ? filename.slice(lastDot + 1).toLowerCase() : ''
}

/**
 * 检查是否为隐藏文件/目录
 * @param name 文件/目录名
 * @returns 是否隐藏
 */
function isHidden(name: string): boolean {
  return name.startsWith('.')
}

/**
 * 检查路径是否匹配忽略模式
 * @param path 路径
 * @param patterns 忽略模式数组
 * @returns 是否匹配
 */
function matchesIgnorePattern(path: string, patterns: string[]): boolean {
  return patterns.some(pattern => {
    // 简单的 glob 匹配实现
    const regex = new RegExp(
      pattern
        .replace(/\*\*/g, '<<<DOUBLESTAR>>>')
        .replace(/\*/g, '[^/]*')
        .replace(/<<<DOUBLESTAR>>>/g, '.*')
        .replace(/\?/g, '.')
    )
    return regex.test(path)
  })
}

/**
 * 扫描单个目录
 * @param dirPath 目录路径
 * @param relativePath 相对路径
 * @param depth 当前深度
 * @param config 扫描配置
 * @param stats 统计信息（引用传递）
 * @param progressCallback 进度回调
 * @returns 目录节点
 */
async function scanDirectory(
  dirPath: string,
  relativePath: string,
  depth: number,
  config: ScanConfig,
  stats: FileStats,
  progressCallback?: ScanProgressCallback
): Promise<FileTreeNode> {
  const node: FileTreeNode = {
    id: generateId(dirPath),
    type: 'directory',
    name: dirPath.split('/').pop() || dirPath,
    path: dirPath,
    relativePath,
    depth,
    expanded: false,
    children: []
  }

  // 检查最大深度限制
  if (config.maxDepth !== undefined && depth >= config.maxDepth) {
    return node
  }

  try {
    // 通过 Electron IPC 调用主进程读取目录
    // 注：实际使用时需要根据 Electron 版本调整 IPC 调用方式
    const entries: Array<{
      name: string
      isDirectory: boolean
      size: number
      modifiedAt: number
    }> = await window.electronAPI?.readDirectory(dirPath) || []

    for (const entry of entries) {
      const entryPath = `${dirPath}/${entry.name}`
      const entryRelativePath = relativePath ? `${relativePath}/${entry.name}` : entry.name

      // 检查隐藏文件
      if (!config.includeHidden && isHidden(entry.name)) {
        continue
      }

      // 检查忽略模式
      if (config.ignorePatterns && matchesIgnorePattern(entryRelativePath, config.ignorePatterns)) {
        continue
      }

      if (entry.isDirectory) {
        // 递归扫描子目录
        const childNode = await scanDirectory(
          entryPath,
          entryRelativePath,
          depth + 1,
          config,
          stats,
          progressCallback
        )
        node.children!.push(childNode)
        stats.directoryCount++
      } else {
        // 检查文件大小限制
        if (config.maxFileSize !== undefined && entry.size > config.maxFileSize) {
          continue
        }

        // 创建文件节点
        const fileNode: FileTreeNode = {
          id: generateId(entryPath),
          type: 'file',
          name: entry.name,
          path: entryPath,
          relativePath: entryRelativePath,
          depth: depth + 1,
          size: entry.size,
          modifiedAt: entry.modifiedAt,
          extension: getExtension(entry.name)
        }
        node.children!.push(fileNode)
        stats.fileCount++
        stats.totalSize += entry.size
      }

      // 触发进度回调
      if (progressCallback) {
        const progress = Math.min(100, Math.round((stats.fileCount + stats.directoryCount) / 100 * 100))
        progressCallback(progress, entryPath)
      }
    }

    // 按名称排序：目录在前，文件在后
    node.children!.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name)
      }
      return a.type === 'directory' ? -1 : 1
    })
  } catch (error) {
    console.error(`扫描目录失败: ${dirPath}`, error)
  }

  return node
}

/**
 * 开始扫描根目录
 * @param config 扫描配置
 * @param progressCallback 进度回调（可选）
 * @returns 扫描结果
 */
export async function startScan(
  config: ScanConfig,
  progressCallback?: ScanProgressCallback
): Promise<ScanResult> {
  const startTime = Date.now()
  const stats: FileStats = {
    fileCount: 0,
    directoryCount: 0,
    totalSize: 0
  }

  // 初始化进度
  progressCallback?.(0, config.rootPath)

  // 扫描根目录
  const root = await scanDirectory(
    config.rootPath,
    '',
    0,
    config,
    stats,
    progressCallback
  )

  // 根目录也算一个目录
  stats.directoryCount++

  const scanTime = Date.now() - startTime

  // 完成进度
  progressCallback?.(100, config.rootPath)

  return {
    root,
    totalFiles: stats.fileCount,
    totalDirectories: stats.directoryCount,
    totalSize: stats.totalSize,
    scanTime
  }
}

/**
 * 刷新指定节点（重新扫描）
 * @param nodePath 节点路径
 * @param config 扫描配置
 * @returns 新的节点数据
 */
export async function refreshNode(
  nodePath: string,
  config: ScanConfig
): Promise<FileTreeNode | null> {
  const stats: FileStats = {
    fileCount: 0,
    directoryCount: 0,
    totalSize: 0
  }

  try {
    const relativePath = nodePath.replace(config.rootPath, '').replace(/^\//, '')
    const depth = relativePath.split('/').filter(Boolean).length
    return await scanDirectory(nodePath, relativePath, depth, config, stats)
  } catch (error) {
    console.error(`刷新节点失败: ${nodePath}`, error)
    return null
  }
}

/**
 * 获取文件/目录信息
 * @param filePath 文件路径
 * @returns 节点信息
 */
export async function getFileInfo(filePath: string): Promise<Partial<FileTreeNode> | null> {
  try {
    const info = await window.electronAPI?.getFileInfo(filePath)
    if (!info) return null

    return {
      id: generateId(filePath),
      type: info.isDirectory ? 'directory' : 'file',
      name: filePath.split('/').pop() || filePath,
      path: filePath,
      size: info.size,
      modifiedAt: info.modifiedAt,
      extension: info.isDirectory ? undefined : getExtension(filePath)
    }
  } catch (error) {
    console.error(`获取文件信息失败: ${filePath}`, error)
    return null
  }
}

/**
 * 检查路径是否存在
 * @param path 路径
 * @returns 是否存在
 */
export async function pathExists(path: string): Promise<boolean> {
  try {
    return await window.electronAPI?.pathExists(path) || false
  } catch {
    return false
  }
}

// 声明 Electron API 类型（实际项目中应在全局类型文件中定义）
declare global {
  interface Window {
    electronAPI?: {
      readDirectory: (path: string) => Promise<Array<{
        name: string
        isDirectory: boolean
        size: number
        modifiedAt: number
      }>>
      getFileInfo: (path: string) => Promise<{
        isDirectory: boolean
        size: number
        modifiedAt: number
      } | null>
      pathExists: (path: string) => Promise<boolean>
    }
  }
}
