/**
 * Zustand 状态管理模块
 * 管理文件树状态、扫描配置和云端同步配置
 */

import { create } from 'zustand'
import { immer } from 'zustand/middleware/immer'
import type {
  FileTreeNode,
  FlattenedFileItem,
  ScanConfig,
  CloudStorageConfig,
  SyncStatus,
  ScanResult
} from './types'
import { flattenTree, toggleNodeExpanded, expandAll, collapseAll, expandToDepth } from './flattener'
import { startScan, refreshNode } from './scanner'

/**
 * 默认扫描配置
 */
const defaultScanConfig: ScanConfig = {
  rootPath: '',
  maxDepth: undefined,
  ignorePatterns: ['node_modules', '.git', 'dist', 'build', '*.tmp'],
  includeHidden: false,
  maxFileSize: undefined
}

/**
 * 默认云端配置
 */
const defaultCloudConfig: CloudStorageConfig = {
  enabled: false,
  serverUrl: '',
  apiKey: '',
  bucketId: '',
  syncInterval: 60
}

/**
 * 文件树状态接口
 */
interface FileTreeStoreState {
  // 状态数据
  root: FileTreeNode | null
  flattenedList: FlattenedFileItem[]
  isScanning: boolean
  scanProgress: number
  scanConfig: ScanConfig
  cloudConfig: CloudStorageConfig
  syncStatus: SyncStatus
  error: string | null
  currentScanPath: string

  // Actions
  setRoot: (root: FileTreeNode | null) => void
  setFlattenedList: (list: FlattenedFileItem[]) => void
  toggleExpanded: (nodeId: string) => void
  expandAllNodes: () => void
  collapseAllNodes: () => void
  expandToDepth: (depth: number) => void
  setScanning: (scanning: boolean) => void
  setScanProgress: (progress: number, currentPath: string) => void
  setScanConfig: (config: Partial<ScanConfig>) => void
  setCloudConfig: (config: Partial<CloudStorageConfig>) => void
  setSyncStatus: (status: SyncStatus) => void
  setError: (error: string | null) => void
  reset: () => void

  // 异步 Actions
  scanDirectory: (rootPath?: string) => Promise<ScanResult | null>
  refreshNode: (nodeId: string) => Promise<void>
  updateScanConfig: (config: Partial<ScanConfig>) => void
  updateCloudConfig: (config: Partial<CloudStorageConfig>) => void
}

/**
 * 创建文件树 Store
 */
export const useFileTreeStore = create<FileTreeStoreState>()(
  immer((set, get) => ({
    // 初始状态
    root: null,
    flattenedList: [],
    isScanning: false,
    scanProgress: 0,
    scanConfig: { ...defaultScanConfig },
    cloudConfig: { ...defaultCloudConfig },
    syncStatus: 'idle',
    error: null,
    currentScanPath: '',

    // Actions
    setRoot: (root) => {
      set((state) => {
        state.root = root
        state.flattenedList = flattenTree(root)
      })
    },

    setFlattenedList: (list) => {
      set((state) => {
        state.flattenedList = list
      })
    },

    /**
     * 切换节点展开/收起状态
     */
    toggleExpanded: (nodeId) => {
      const { root, flattenedList } = get()
      if (!root) return

      const result = toggleNodeExpanded(root, nodeId, flattenedList)
      if (result.found) {
        set((state) => {
          state.flattenedList = result.list
        })
      }
    },

    /**
     * 展开所有节点
     */
    expandAllNodes: () => {
      const { root } = get()
      if (!root) return

      expandAll(root)
      set((state) => {
        state.flattenedList = flattenTree(root)
      })
    },

    /**
     * 收起所有节点
     */
    collapseAllNodes: () => {
      const { root } = get()
      if (!root) return

      collapseAll(root)
      set((state) => {
        state.flattenedList = flattenTree(root)
      })
    },

    /**
     * 展开到指定深度
     */
    expandToDepth: (depth) => {
      const { root } = get()
      if (!root) return

      expandToDepth(root, depth)
      set((state) => {
        state.flattenedList = flattenTree(root)
      })
    },

    setScanning: (scanning) => {
      set((state) => {
        state.isScanning = scanning
        if (scanning) {
          state.scanProgress = 0
          state.error = null
        }
      })
    },

    setScanProgress: (progress, currentPath) => {
      set((state) => {
        state.scanProgress = progress
        state.currentScanPath = currentPath
      })
    },

    setScanConfig: (config) => {
      set((state) => {
        state.scanConfig = { ...state.scanConfig, ...config }
      })
    },

    setCloudConfig: (config) => {
      set((state) => {
        state.cloudConfig = { ...state.cloudConfig, ...config }
      })
    },

    setSyncStatus: (status) => {
      set((state) => {
        state.syncStatus = status
      })
    },

    setError: (error) => {
      set((state) => {
        state.error = error
      })
    },

    /**
     * 重置所有状态
     */
    reset: () => {
      set((state) => {
        state.root = null
        state.flattenedList = []
        state.isScanning = false
        state.scanProgress = 0
        state.scanConfig = { ...defaultScanConfig }
        state.syncStatus = 'idle'
        state.error = null
        state.currentScanPath = ''
      })
    },

    // 异步 Actions

    /**
     * 扫描目录
     * @param rootPath 可选的根目录路径，如果不传则使用配置中的路径
     */
    scanDirectory: async (rootPath) => {
      const { scanConfig, setScanning, setScanProgress, setRoot, setError } = get()

      const targetPath = rootPath || scanConfig.rootPath
      if (!targetPath) {
        setError('未指定扫描路径')
        return null
      }

      setScanning(true)

      try {
        const config: ScanConfig = {
          ...scanConfig,
          rootPath: targetPath
        }

        const result = await startScan(config, (progress, currentPath) => {
          setScanProgress(progress, currentPath)
        })

        setRoot(result.root)
        setScanning(false)
        return result
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '扫描失败'
        setError(errorMessage)
        setScanning(false)
        return null
      }
    },

    /**
     * 刷新指定节点
     * @param nodeId 节点ID
     */
    refreshNode: async (nodeId) => {
      const { root, flattenedList, scanConfig, setRoot, setError } = get()
      if (!root) return

      // 查找节点
      const findNode = (node: FileTreeNode, id: string): FileTreeNode | null => {
        if (node.id === id) return node
        if (node.children) {
          for (const child of node.children) {
            const found = findNode(child, id)
            if (found) return found
          }
        }
        return null
      }

      const node = findNode(root, nodeId)
      if (!node || node.type !== 'directory') return

      try {
        const newNode = await refreshNode(node.path, scanConfig)
        if (newNode) {
          // 替换节点
          const replaceNode = (n: FileTreeNode): FileTreeNode => {
            if (n.id === nodeId) return newNode
            if (n.children) {
              return {
                ...n,
                children: n.children.map(replaceNode)
              }
            }
            return n
          }

          const newRoot = replaceNode(root)
          set((state) => {
            state.root = newRoot
            state.flattenedList = flattenTree(newRoot)
          })
        }
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : '刷新失败'
        setError(errorMessage)
      }
    },

    /**
     * 更新扫描配置
     */
    updateScanConfig: (config) => {
      set((state) => {
        state.scanConfig = { ...state.scanConfig, ...config }
      })
    },

    /**
     * 更新云端配置
     */
    updateCloudConfig: (config) => {
      set((state) => {
        state.cloudConfig = { ...state.cloudConfig, ...config }
      })
    }
  }))
)

/**
 * 选择器 hooks - 用于性能优化
 */

/** 获取根节点 */
export const useRootNode = () => useFileTreeStore((state) => state.root)

/** 获取展平列表 */
export const useFlattenedList = () => useFileTreeStore((state) => state.flattenedList)

/** 获取扫描状态 */
export const useScanStatus = () =>
  useFileTreeStore(
    (state) => ({
      isScanning: state.isScanning,
      scanProgress: state.scanProgress,
      currentScanPath: state.currentScanPath
    }),
    // 自定义比较函数
    (a, b) =>
      a.isScanning === b.isScanning &&
      a.scanProgress === b.scanProgress &&
      a.currentScanPath === b.currentScanPath
  )

/** 获取扫描配置 */
export const useScanConfig = () =>
  useFileTreeStore(
    (state) => state.scanConfig,
    // 浅比较，immer 会保持未变更的字段引用
    (a, b) =>
      a.rootPath === b.rootPath &&
      a.includeHidden === b.includeHidden &&
      a.maxDepth === b.maxDepth
  )

/** 获取云端配置 */
export const useCloudConfig = () =>
  useFileTreeStore(
    (state) => state.cloudConfig,
    // 浅比较
    (a, b) =>
      a.enabled === b.enabled &&
      a.serverUrl === b.serverUrl &&
      a.apiKey === b.apiKey &&
      a.bucketId === b.bucketId &&
      a.syncInterval === b.syncInterval
  )

/** 获取同步状态 */
export const useSyncStatus = () => useFileTreeStore((state) => state.syncStatus)

/** 获取错误信息 */
export const useError = () => useFileTreeStore((state) => state.error)

/**
 * 计算统计信息
 * @returns 文件统计
 */
export function useFileStats() {
  return useFileTreeStore((state) => {
    const { root } = state
    if (!root) {
      return { totalFiles: 0, totalDirectories: 0, totalSize: 0 }
    }

    let totalFiles = 0
    let totalDirectories = 0
    let totalSize = 0

    const traverse = (node: FileTreeNode) => {
      if (node.type === 'file') {
        totalFiles++
        totalSize += node.size || 0
      } else {
        totalDirectories++
        node.children?.forEach(traverse)
      }
    }

    traverse(root)

    return { totalFiles, totalDirectories, totalSize }
  }, 
  // 自定义比较函数，避免对象引用变化导致的不必要重渲染
  (a, b) => {
    return a.totalFiles === b.totalFiles && 
           a.totalDirectories === b.totalDirectories && 
           a.totalSize === b.totalSize
  })
}
