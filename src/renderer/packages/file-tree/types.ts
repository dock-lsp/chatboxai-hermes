/**
 * 本地文件目录树扫描工具 - 类型定义
 * 适用于 Android/Flutter 跨平台项目
 */

/** 文件树节点类型 */
export type FileNodeType = 'file' | 'directory'

/** 文件树节点接口 */
export interface FileTreeNode {
  /** 唯一标识 */
  id: string
  /** 节点类型 */
  type: FileNodeType
  /** 文件/目录名称 */
  name: string
  /** 完整路径 */
  path: string
  /** 相对于根目录的路径 */
  relativePath: string
  /** 深度层级 */
  depth: number
  /** 子节点（仅目录类型） */
  children?: FileTreeNode[]
  /** 是否展开（仅目录类型） */
  expanded?: boolean
  /** 文件大小（仅文件类型，单位字节） */
  size?: number
  /** 最后修改时间 */
  modifiedAt?: number
  /** 文件扩展名（仅文件类型） */
  extension?: string
}

/** 展平列表项接口（用于 RecyclerView/ListView） */
export interface FlattenedFileItem {
  /** 唯一标识 */
  id: string
  /** 节点类型 */
  type: FileNodeType
  /** 名称 */
  name: string
  /** 完整路径 */
  path: string
  /** 深度层级（用于缩进） */
  depth: number
  /** 是否展开（仅目录类型） */
  expanded?: boolean
  /** 是否有子节点（仅目录类型） */
  hasChildren?: boolean
  /** 文件大小 */
  size?: number
  /** 最后修改时间 */
  modifiedAt?: number
  /** 扩展名 */
  extension?: string
}

/** 扫描配置 */
export interface ScanConfig {
  /** 根目录路径 */
  rootPath: string
  /** 最大扫描深度（默认无限） */
  maxDepth?: number
  /** 忽略的文件/目录模式（glob） */
  ignorePatterns?: string[]
  /** 是否包含隐藏文件 */
  includeHidden?: boolean
  /** 文件大小限制（字节，默认无限制） */
  maxFileSize?: number
}

/** 扫描结果 */
export interface ScanResult {
  /** 根节点 */
  root: FileTreeNode
  /** 文件总数 */
  totalFiles: number
  /** 目录总数 */
  totalDirectories: number
  /** 总大小（字节） */
  totalSize: number
  /** 扫描耗时（毫秒） */
  scanTime: number
}

/** 云端存储配置 */
export interface CloudStorageConfig {
  /** 是否启用云端存储 */
  enabled: boolean
  /** 云端服务器地址 */
  serverUrl: string
  /** API 密钥 */
  apiKey?: string
  /** 存储桶/项目ID */
  bucketId?: string
  /** 同步间隔（分钟，默认60） */
  syncInterval?: number
}

/** 同步状态 */
export type SyncStatus = 'idle' | 'syncing' | 'success' | 'error'

/** 文件树状态 */
export interface FileTreeState {
  /** 根节点 */
  root: FileTreeNode | null
  /** 展平后的列表 */
  flattenedList: FlattenedFileItem[]
  /** 是否正在扫描 */
  isScanning: boolean
  /** 扫描进度（0-100） */
  scanProgress: number
  /** 扫描配置 */
  scanConfig: ScanConfig
  /** 云端配置 */
  cloudConfig: CloudStorageConfig
  /** 同步状态 */
  syncStatus: SyncStatus
  /** 错误信息 */
  error: string | null
}

/** 扫描进度回调 */
export type ScanProgressCallback = (progress: number, currentPath: string) => void

/** 文件统计信息 */
export interface FileStats {
  /** 文件总数 */
  fileCount: number
  /** 目录总数 */
  directoryCount: number
  /** 总大小（字节） */
  totalSize: number
}
