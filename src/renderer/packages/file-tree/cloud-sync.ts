/**
 * 云端同步模块
 * 支持上传/下载文件树数据到配置的云端服务器
 */

import type {
  FileTreeNode,
  CloudStorageConfig,
  SyncStatus
} from './types'

/**
 * 同步结果
 */
export interface SyncResult {
  success: boolean
  message: string
  timestamp?: number
  data?: unknown
}

/**
 * 云端文件树数据格式
 */
interface CloudFileTreeData {
  version: string
  timestamp: number
  deviceId: string
  root: FileTreeNode
  metadata: {
    totalFiles: number
    totalDirectories: number
    totalSize: number
  }
}

/**
 * 生成设备ID（用于区分不同设备的同步数据）
 * @returns 设备ID
 */
function generateDeviceId(): string {
  const stored = localStorage.getItem('file_tree_device_id')
  if (stored) return stored

  const newId = `device_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
  localStorage.setItem('file_tree_device_id', newId)
  return newId
}

/**
 * 获取请求头
 * @param config 云端配置
 * @returns 请求头对象
 */
function getHeaders(config: CloudStorageConfig): Record<string, string> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json'
  }

  if (config.apiKey) {
    headers['Authorization'] = `Bearer ${config.apiKey}`
  }

  return headers
}

/**
 * 构建完整URL
 * @param config 云端配置
 * @param endpoint API端点
 * @returns 完整URL
 */
function buildUrl(config: CloudStorageConfig, endpoint: string): string {
  const baseUrl = config.serverUrl.replace(/\/$/, '')
  const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`
  return `${baseUrl}${path}`
}

/**
 * 上传文件树到云端
 * @param root 根节点
 * @param config 云端配置
 * @returns 同步结果
 */
export async function uploadFileTree(
  root: FileTreeNode,
  config: CloudStorageConfig
): Promise<SyncResult> {
  if (!config.enabled) {
    return { success: false, message: '云端存储未启用' }
  }

  if (!config.serverUrl) {
    return { success: false, message: '未配置云端服务器地址' }
  }

  try {
    // 计算统计数据
    let totalFiles = 0
    let totalDirectories = 0
    let totalSize = 0

    const calculateStats = (node: FileTreeNode) => {
      if (node.type === 'file') {
        totalFiles++
        totalSize += node.size || 0
      } else {
        totalDirectories++
        node.children?.forEach(calculateStats)
      }
    }
    calculateStats(root)

    // 构建云端数据
    const cloudData: CloudFileTreeData = {
      version: '1.0.0',
      timestamp: Date.now(),
      deviceId: generateDeviceId(),
      root,
      metadata: {
        totalFiles,
        totalDirectories,
        totalSize
      }
    }

    // 构建URL
    const url = buildUrl(config, `/api/v1/filetree/${config.bucketId || 'default'}`)

    // 发送请求
    const response = await fetch(url, {
      method: 'POST',
      headers: getHeaders(config),
      body: JSON.stringify(cloudData)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`上传失败: ${response.status} - ${error}`)
    }

    const result = await response.json()

    return {
      success: true,
      message: '上传成功',
      timestamp: Date.now(),
      data: result
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '上传失败'
    return { success: false, message }
  }
}

/**
 * 从云端下载文件树
 * @param config 云端配置
 * @returns 同步结果（包含下载的数据）
 */
export async function downloadFileTree(
  config: CloudStorageConfig
): Promise<SyncResult & { root?: FileTreeNode }> {
  if (!config.enabled) {
    return { success: false, message: '云端存储未启用' }
  }

  if (!config.serverUrl) {
    return { success: false, message: '未配置云端服务器地址' }
  }

  try {
    // 构建URL
    const url = buildUrl(config, `/api/v1/filetree/${config.bucketId || 'default'}`)

    // 发送请求
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(config)
    })

    if (!response.ok) {
      if (response.status === 404) {
        return { success: false, message: '云端暂无数据' }
      }
      const error = await response.text()
      throw new Error(`下载失败: ${response.status} - ${error}`)
    }

    const cloudData: CloudFileTreeData = await response.json()

    return {
      success: true,
      message: '下载成功',
      timestamp: cloudData.timestamp,
      root: cloudData.root,
      data: cloudData
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '下载失败'
    return { success: false, message }
  }
}

/**
 * 删除云端文件树数据
 * @param config 云端配置
 * @returns 同步结果
 */
export async function deleteCloudFileTree(
  config: CloudStorageConfig
): Promise<SyncResult> {
  if (!config.enabled) {
    return { success: false, message: '云端存储未启用' }
  }

  try {
    const url = buildUrl(config, `/api/v1/filetree/${config.bucketId || 'default'}`)

    const response = await fetch(url, {
      method: 'DELETE',
      headers: getHeaders(config)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`删除失败: ${response.status} - ${error}`)
    }

    return {
      success: true,
      message: '云端数据已删除',
      timestamp: Date.now()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '删除失败'
    return { success: false, message }
  }
}

/**
 * 获取云端文件树列表（多设备同步场景）
 * @param config 云端配置
 * @returns 同步结果
 */
export async function listCloudFileTrees(
  config: CloudStorageConfig
): Promise<SyncResult> {
  if (!config.enabled) {
    return { success: false, message: '云端存储未启用' }
  }

  try {
    const url = buildUrl(config, '/api/v1/filetree/list')

    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(config)
    })

    if (!response.ok) {
      const error = await response.text()
      throw new Error(`获取列表失败: ${response.status} - ${error}`)
    }

    const data = await response.json()

    return {
      success: true,
      message: '获取成功',
      data
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : '获取失败'
    return { success: false, message }
  }
}

/**
 * 合并本地和云端文件树（简单合并策略）
 * @param localRoot 本地根节点
 * @param cloudRoot 云端根节点
 * @returns 合并后的根节点
 */
export function mergeFileTrees(
  localRoot: FileTreeNode,
  cloudRoot: FileTreeNode
): FileTreeNode {
  /**
   * 递归合并节点
   */
  const mergeNodes = (local: FileTreeNode, cloud: FileTreeNode): FileTreeNode => {
    // 如果类型不同，以本地为准
    if (local.type !== cloud.type) {
      return { ...local }
    }

    // 如果是文件，比较修改时间
    if (local.type === 'file') {
      const localTime = local.modifiedAt || 0
      const cloudTime = cloud.modifiedAt || 0
      // 保留较新的版本
      return localTime >= cloudTime ? { ...local } : { ...cloud }
    }

    // 如果是目录，合并子节点
    const mergedChildren: FileTreeNode[] = []
    const localChildrenMap = new Map(local.children?.map(c => [c.name, c]))
    const cloudChildrenMap = new Map(cloud.children?.map(c => [c.name, c]))

    // 收集所有子节点名称
    const allNames = new Set([
      ...Array.from(localChildrenMap.keys()),
      ...Array.from(cloudChildrenMap.keys())
    ])

    for (const name of allNames) {
      const localChild = localChildrenMap.get(name)
      const cloudChild = cloudChildrenMap.get(name)

      if (localChild && cloudChild) {
        // 两边都有，递归合并
        mergedChildren.push(mergeNodes(localChild, cloudChild))
      } else if (localChild) {
        // 只有本地有
        mergedChildren.push({ ...localChild })
      } else if (cloudChild) {
        // 只有云端有
        mergedChildren.push({ ...cloudChild })
      }
    }

    // 排序
    mergedChildren.sort((a, b) => {
      if (a.type === b.type) {
        return a.name.localeCompare(b.name)
      }
      return a.type === 'directory' ? -1 : 1
    })

    return {
      ...local,
      children: mergedChildren,
      // 如果任一边展开，则保持展开
      expanded: local.expanded || cloud.expanded
    }
  }

  return mergeNodes(localRoot, cloudRoot)
}

/**
 * 自动同步管理器
 */
export class CloudSyncManager {
  private config: CloudStorageConfig
  private syncIntervalId: number | null = null
  private onStatusChange?: (status: SyncStatus) => void

  constructor(
    config: CloudStorageConfig,
    onStatusChange?: (status: SyncStatus) => void
  ) {
    this.config = config
    this.onStatusChange = onStatusChange
  }

  /**
   * 更新配置
   */
  updateConfig(config: CloudStorageConfig) {
    this.config = config
    // 如果正在自动同步，重启定时器
    if (this.syncIntervalId !== null) {
      this.stopAutoSync()
      if (config.enabled && config.syncInterval) {
        this.startAutoSync()
      }
    }
  }

  /**
   * 开始自动同步
   * @param syncCallback 同步回调函数
   */
  startAutoSync(syncCallback?: () => Promise<void>) {
    if (!this.config.enabled || !this.config.syncInterval) {
      return
    }

    // 清除现有定时器
    this.stopAutoSync()

    // 转换为毫秒
    const intervalMs = this.config.syncInterval * 60 * 1000

    this.syncIntervalId = window.setInterval(async () => {
      this.onStatusChange?.('syncing')
      try {
        await syncCallback?.()
        this.onStatusChange?.('success')
      } catch {
        this.onStatusChange?.('error')
      }
    }, intervalMs)
  }

  /**
   * 停止自动同步
   */
  stopAutoSync() {
    if (this.syncIntervalId !== null) {
      clearInterval(this.syncIntervalId)
      this.syncIntervalId = null
    }
  }

  /**
   * 立即执行同步
   * @param root 本地文件树根节点
   * @returns 同步结果
   */
  async syncNow(root: FileTreeNode): Promise<SyncResult> {
    this.onStatusChange?.('syncing')

    try {
      // 先尝试下载云端数据
      const downloadResult = await downloadFileTree(this.config)

      if (downloadResult.success && downloadResult.root) {
        // 合并数据
        const mergedRoot = mergeFileTrees(root, downloadResult.root)
        // 上传合并后的数据
        const uploadResult = await uploadFileTree(mergedRoot, this.config)

        if (uploadResult.success) {
          this.onStatusChange?.('success')
          return {
            ...uploadResult,
            data: { merged: true, root: mergedRoot }
          }
        }
      } else {
        // 云端没有数据，直接上传本地数据
        const uploadResult = await uploadFileTree(root, this.config)
        this.onStatusChange?.(uploadResult.success ? 'success' : 'error')
        return uploadResult
      }

      return { success: false, message: '同步失败' }
    } catch (error) {
      this.onStatusChange?.('error')
      const message = error instanceof Error ? error.message : '同步失败'
      return { success: false, message }
    }
  }

  /**
   * 销毁管理器
   */
  destroy() {
    this.stopAutoSync()
  }
}

/**
 * 检查云端连接
 * @param config 云端配置
 * @returns 是否连接成功
 */
export async function checkCloudConnection(
  config: CloudStorageConfig
): Promise<boolean> {
  if (!config.enabled || !config.serverUrl) {
    return false
  }

  try {
    const url = buildUrl(config, '/api/v1/health')
    const response = await fetch(url, {
      method: 'GET',
      headers: getHeaders(config)
    })
    return response.ok
  } catch {
    return false
  }
}
