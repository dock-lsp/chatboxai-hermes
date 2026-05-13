/**
 * File Tree 组件模块入口
 * 统一导出所有文件树相关 UI 组件
 */

// ==================== 组件导出 ====================

/**
 * 文件树面板组件
 * 提供完整的文件浏览、扫描和云端同步功能
 */
export { default as FileTreePanel } from './FileTreePanel'

/**
 * 文件树列表项组件
 * 显示单个文件或目录的详细信息
 */
export { default as FileTreeItem } from './FileTreeItem'

/**
 * AI 文件生成器组件
 * 监听 AI 对话中的代码块，提供一键生成文件功能
 */
export { default as AIFileGenerator } from './AIFileGenerator'

// ==================== 类型导出（从 packages/file-tree 重新导出） ====================

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
  FileStats,
} from '@/packages/file-tree'

// ==================== Hooks 导出（从 packages/file-tree 重新导出） ====================

export {
  useFileTreeStore,
  useRootNode,
  useFlattenedList,
  useScanStatus,
  useScanConfig,
  useCloudConfig,
  useSyncStatus,
  useError,
  useFileStats,
} from '@/packages/file-tree'

// ==================== 工具函数导出（从 packages/file-tree 重新导出） ====================

export {
  formatFileSize,
  formatTimestamp,
  getFileIconType,
  cloneFileTreeNode,
  traverseFileTree,
  filterFileTree,
  searchFileTree,
  getNodePath,
} from '@/packages/file-tree'

// ==================== 扫描器导出（从 packages/file-tree 重新导出） ====================

export {
  startScan,
  refreshNode,
  getFileInfo,
  pathExists,
} from '@/packages/file-tree'

// ==================== 展平器导出（从 packages/file-tree 重新导出） ====================

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
  getPathAtIndex,
} from '@/packages/file-tree'

// ==================== 云端同步导出（从 packages/file-tree 重新导出） ====================

export {
  uploadFileTree,
  downloadFileTree,
  deleteCloudFileTree,
  listCloudFileTrees,
  mergeFileTrees,
  CloudSyncManager,
  checkCloudConnection,
} from '@/packages/file-tree'

export type { SyncResult } from '@/packages/file-tree'

// ==================== 模块信息 ====================

/**
 * 模块版本号
 */
export const VERSION = '1.0.0'

/**
 * 默认导出
 */
export default {
  VERSION,
}
