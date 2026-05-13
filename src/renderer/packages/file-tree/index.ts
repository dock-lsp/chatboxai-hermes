/**
 * 本地文件目录树扫描工具
 * 适用于 Android/Flutter 跨平台项目
 * 
 * 功能特性：
 * - 递归扫描本地文件目录
 * - 生成树形数据结构
 * - 支持展开/收起状态管理
 * - 输出展平列表（适配 RecyclerView/ListView）
 * - 支持云端存储同步
 * 
 * @module file-tree
 */

// ==================== 类型定义 ====================
export type {
  FileNodeType,
  FileTreeNode,
  FlattenedFileItem,
  ScanConfig,
  ScanResult,
  CloudStorageConfig,
  SyncStatus,
  FileTreeState,
  ScanProgressCallback,
  FileStats
} from './types'

// ==================== 扫描器 ====================
export {
  startScan,
  refreshNode,
  getFileInfo,
  pathExists
} from './scanner'

// ==================== 展平器 ====================
export {
  flattenTree,
  incrementalFlatten,
  toggleNodeExpanded,
  expandAll,
  collapseAll,
  expandToDepth,
  findNodeByPath,
  getAncestorPaths,
  getVisibleRange,
  getPathAtIndex
} from './flattener'

// ==================== 状态管理 ====================
export {
  useFileTreeStore,
  useRootNode,
  useFlattenedList,
  useScanStatus,
  useScanConfig,
  useCloudConfig,
  useSyncStatus,
  useError,
  useFileStats
} from './store'

// ==================== 云端同步 ====================
export {
  uploadFileTree,
  downloadFileTree,
  deleteCloudFileTree,
  listCloudFileTrees,
  mergeFileTrees,
  CloudSyncManager,
  checkCloudConnection
} from './cloud-sync'

export type { SyncResult } from './cloud-sync'

// ==================== 工具函数 ====================

/**
 * 格式化文件大小
 * @param bytes 字节数
 * @returns 格式化后的字符串
 */
export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'

  const units = ['B', 'KB', 'MB', 'GB', 'TB', 'PB']
  const k = 1024
  const i = Math.floor(Math.log(bytes) / Math.log(k))

  return `${(bytes / Math.pow(k, i)).toFixed(2)} ${units[i]}`
}

/**
 * 格式化时间戳
 * @param timestamp 时间戳（毫秒）
 * @returns 格式化后的字符串
 */
export function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp)
  return date.toLocaleString('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  })
}

/**
 * 获取文件图标类型
 * @param extension 文件扩展名
 * @returns 图标类型标识
 */
export function getFileIconType(extension: string): string {
  const iconMap: Record<string, string> = {
    // 图片
    jpg: 'image',
    jpeg: 'image',
    png: 'image',
    gif: 'image',
    bmp: 'image',
    svg: 'image',
    webp: 'image',
    // 文档
    pdf: 'pdf',
    doc: 'document',
    docx: 'document',
    txt: 'text',
    md: 'markdown',
    // 代码
    js: 'code',
    ts: 'code',
    jsx: 'code',
    tsx: 'code',
    py: 'code',
    java: 'code',
    cpp: 'code',
    c: 'code',
    go: 'code',
    rs: 'code',
    html: 'code',
    css: 'code',
    json: 'code',
    xml: 'code',
    yaml: 'code',
    yml: 'code',
    // 视频
    mp4: 'video',
    avi: 'video',
    mkv: 'video',
    mov: 'video',
    // 音频
    mp3: 'audio',
    wav: 'audio',
    flac: 'audio',
    aac: 'audio',
    // 压缩包
    zip: 'archive',
    rar: 'archive',
    tar: 'archive',
    gz: 'archive',
    '7z': 'archive',
    // 可执行文件
    exe: 'executable',
    dmg: 'executable',
    app: 'executable',
    sh: 'executable',
    bat: 'executable'
  }

  return iconMap[extension.toLowerCase()] || 'file'
}

/**
 * 深度克隆文件树节点
 * @param node 源节点
 * @returns 克隆后的节点
 */
export function cloneFileTreeNode(node: import('./types').FileTreeNode): import('./types').FileTreeNode {
  return {
    ...node,
    children: node.children?.map(cloneFileTreeNode)
  }
}

/**
 * 遍历文件树
 * @param node 根节点
 * @param callback 回调函数
 */
export function traverseFileTree(
  node: import('./types').FileTreeNode,
  callback: (node: import('./types').FileTreeNode) => void
): void {
  callback(node)
  node.children?.forEach(child => traverseFileTree(child, callback))
}

/**
 * 过滤文件树
 * @param node 根节点
 * @param predicate 过滤条件
 * @returns 过滤后的节点（如果根节点不满足条件则返回null）
 */
export function filterFileTree(
  node: import('./types').FileTreeNode,
  predicate: (node: import('./types').FileTreeNode) => boolean
): import('./types').FileTreeNode | null {
  if (!predicate(node)) {
    return null
  }

  const filtered: import('./types').FileTreeNode = { ...node }

  if (node.children) {
    filtered.children = node.children
      .map(child => filterFileTree(child, predicate))
      .filter((child): child is import('./types').FileTreeNode => child !== null)
  }

  return filtered
}

/**
 * 搜索文件树
 * @param node 根节点
 * @param keyword 搜索关键词
 * @returns 匹配的节点数组
 */
export function searchFileTree(
  node: import('./types').FileTreeNode,
  keyword: string
): import('./types').FileTreeNode[] {
  const results: import('./types').FileTreeNode[] = []
  const lowerKeyword = keyword.toLowerCase()

  traverseFileTree(node, (n) => {
    if (n.name.toLowerCase().includes(lowerKeyword)) {
      results.push(n)
    }
  })

  return results
}

/**
 * 获取节点在树中的层级路径
 * @param root 根节点
 * @param targetId 目标节点ID
 * @returns 从根到目标节点的路径数组
 */
export function getNodePath(
  root: import('./types').FileTreeNode,
  targetId: string
): import('./types').FileTreeNode[] {
  const path: import('./types').FileTreeNode[] = []

  const findPath = (node: import('./types').FileTreeNode): boolean => {
    path.push(node)

    if (node.id === targetId) {
      return true
    }

    if (node.children) {
      for (const child of node.children) {
        if (findPath(child)) {
          return true
        }
      }
    }

    path.pop()
    return false
  }

  findPath(root)
  return path
}

/**
 * 模块版本
 */
export const VERSION = '1.0.0'

/**
 * 默认导出
 */
export default {
  VERSION,
  formatFileSize,
  formatTimestamp,
  getFileIconType,
  cloneFileTreeNode,
  traverseFileTree,
  filterFileTree,
  searchFileTree,
  getNodePath
}
