/**
 * 树展平器模块
 * 将树形结构转换为一维列表，支持虚拟滚动和动态展开/收起
 */

import type { FileTreeNode, FlattenedFileItem } from './types'

/**
 * 将单个节点转换为展平列表项
 * @param node 文件树节点
 * @returns 展平列表项
 */
function nodeToFlattenedItem(node: FileTreeNode): FlattenedFileItem {
  return {
    id: node.id,
    type: node.type,
    name: node.name,
    path: node.path,
    depth: node.depth,
    expanded: node.expanded,
    hasChildren: node.type === 'directory' && (node.children?.length ?? 0) > 0,
    size: node.size,
    modifiedAt: node.modifiedAt,
    extension: node.extension
  }
}

/**
 * 递归展平树形结构
 * @param node 当前节点
 * @param result 结果数组（引用传递）
 * @param parentExpanded 父节点是否展开
 */
function flattenNode(
  node: FileTreeNode,
  result: FlattenedFileItem[],
  parentExpanded: boolean = true
): void {
  // 根节点不加入列表（从子节点开始）
  if (node.depth > 0 || parentExpanded === false) {
    result.push(nodeToFlattenedItem(node))
  }

  // 如果当前节点是目录且已展开，递归处理子节点
  if (node.type === 'directory' && node.expanded && node.children) {
    for (const child of node.children) {
      flattenNode(child, result, node.expanded)
    }
  }
}

/**
 * 将文件树展平为一维列表
 * @param root 根节点
 * @returns 展平后的列表
 */
export function flattenTree(root: FileTreeNode | null): FlattenedFileItem[] {
  if (!root) return []

  const result: FlattenedFileItem[] = []

  // 添加根节点
  result.push(nodeToFlattenedItem(root))

  // 如果根节点展开，递归处理子节点
  if (root.expanded && root.children) {
    for (const child of root.children) {
      flattenNode(child, result, true)
    }
  }

  return result
}

/**
 * 增量更新展平列表（性能优化版）
 * 当只有部分节点状态改变时，避免全量重新展平
 * @param root 根节点
 * @param changedNodeId 改变的节点ID
 * @param currentList 当前展平列表
 * @returns 更新后的列表
 */
export function incrementalFlatten(
  root: FileTreeNode | null,
  changedNodeId: string,
  currentList: FlattenedFileItem[]
): FlattenedFileItem[] {
  if (!root) return []

  // 查找改变的节点
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

  const changedNode = findNode(root, changedNodeId)
  if (!changedNode) return currentList

  // 找到改变节点在列表中的索引
  const changedIndex = currentList.findIndex(item => item.id === changedNodeId)
  if (changedIndex === -1) return flattenTree(root)

  // 计算需要移除或插入的子节点数量
  const changedDepth = changedNode.depth
  let removeCount = 0

  // 查找当前显示的所有子节点
  for (let i = changedIndex + 1; i < currentList.length; i++) {
    if (currentList[i].depth <= changedDepth) break
    removeCount++
  }

  // 构建新列表
  const newList = [...currentList]

  // 更新节点自身的展开状态
  newList[changedIndex] = {
    ...newList[changedIndex],
    expanded: changedNode.expanded
  }

  // 如果节点展开，插入子节点
  if (changedNode.expanded && changedNode.children) {
    const childrenToInsert: FlattenedFileItem[] = []
    for (const child of changedNode.children) {
      flattenNode(child, childrenToInsert, true)
    }
    newList.splice(changedIndex + 1, removeCount, ...childrenToInsert)
  } else {
    // 如果节点收起，移除子节点
    newList.splice(changedIndex + 1, removeCount)
  }

  return newList
}

/**
 * 切换节点展开状态并更新展平列表
 * @param root 根节点（将被修改）
 * @param nodeId 目标节点ID
 * @param currentList 当前展平列表
 * @returns 更新后的列表和是否找到节点
 */
export function toggleNodeExpanded(
  root: FileTreeNode,
  nodeId: string,
  currentList: FlattenedFileItem[]
): { list: FlattenedFileItem[]; found: boolean } {
  // 查找并切换节点状态
  const toggleNode = (node: FileTreeNode): boolean => {
    if (node.id === nodeId) {
      if (node.type === 'directory') {
        node.expanded = !node.expanded
      }
      return true
    }
    if (node.children) {
      for (const child of node.children) {
        if (toggleNode(child)) return true
      }
    }
    return false
  }

  const found = toggleNode(root)
  if (!found) return { list: currentList, found: false }

  // 使用增量更新
  const newList = incrementalFlatten(root, nodeId, currentList)
  return { list: newList, found: true }
}

/**
 * 展开所有节点
 * @param root 根节点（将被修改）
 */
export function expandAll(root: FileTreeNode): void {
  const expand = (node: FileTreeNode) => {
    if (node.type === 'directory') {
      node.expanded = true
      node.children?.forEach(expand)
    }
  }
  expand(root)
}

/**
 * 收起所有节点
 * @param root 根节点（将被修改）
 * @param keepRootExpanded 是否保持根节点展开（默认true）
 */
export function collapseAll(root: FileTreeNode, keepRootExpanded: boolean = true): void {
  const collapse = (node: FileTreeNode, isRoot: boolean = false) => {
    if (node.type === 'directory') {
      if (!isRoot || !keepRootExpanded) {
        node.expanded = false
      }
      node.children?.forEach(child => collapse(child))
    }
  }
  collapse(root, true)
}

/**
 * 展开到指定深度
 * @param root 根节点（将被修改）
 * @param targetDepth 目标深度
 */
export function expandToDepth(root: FileTreeNode, targetDepth: number): void {
  const expand = (node: FileTreeNode) => {
    if (node.type === 'directory') {
      node.expanded = node.depth < targetDepth
      node.children?.forEach(expand)
    }
  }
  expand(root)
}

/**
 * 查找指定路径的节点
 * @param root 根节点
 * @param targetPath 目标路径
 * @returns 找到的节点或null
 */
export function findNodeByPath(root: FileTreeNode, targetPath: string): FileTreeNode | null {
  if (root.path === targetPath) return root
  if (root.children) {
    for (const child of root.children) {
      const found = findNodeByPath(child, targetPath)
      if (found) return found
    }
  }
  return null
}

/**
 * 获取节点的所有祖先路径
 * @param root 根节点
 * @param targetPath 目标路径
 * @returns 祖先路径数组（从根到父节点）
 */
export function getAncestorPaths(root: FileTreeNode, targetPath: string): string[] {
  const paths: string[] = []

  const findAncestors = (node: FileTreeNode, ancestors: string[]): boolean => {
    if (node.path === targetPath) {
      paths.push(...ancestors)
      return true
    }
    if (node.children) {
      for (const child of node.children) {
        if (findAncestors(child, [...ancestors, node.path])) {
          return true
        }
      }
    }
    return false
  }

  findAncestors(root, [])
  return paths
}

/**
 * 为虚拟滚动计算可见范围
 * @param list 展平列表
 * @param startIndex 起始索引
 * @param visibleCount 可见数量
 * @param bufferSize 缓冲区大小（上下额外渲染的项数）
 * @returns 可见范围
 */
export function getVisibleRange(
  list: FlattenedFileItem[],
  startIndex: number,
  visibleCount: number,
  bufferSize: number = 5
): { start: number; end: number; visibleItems: FlattenedFileItem[] } {
  const total = list.length
  const start = Math.max(0, startIndex - bufferSize)
  const end = Math.min(total, startIndex + visibleCount + bufferSize)

  return {
    start,
    end,
    visibleItems: list.slice(start, end)
  }
}

/**
 * 根据索引获取节点在树中的路径
 * @param list 展平列表
 * @param index 索引
 * @returns 路径数组
 */
export function getPathAtIndex(
  list: FlattenedFileItem[],
  index: number
): FlattenedFileItem[] {
  if (index < 0 || index >= list.length) return []

  const target = list[index]
  const path: FlattenedFileItem[] = [target]

  // 向上查找所有祖先
  for (let i = index - 1; i >= 0; i--) {
    if (list[i].depth < target.depth) {
      path.unshift(list[i])
      if (list[i].depth === 0) break
    }
  }

  return path
}
