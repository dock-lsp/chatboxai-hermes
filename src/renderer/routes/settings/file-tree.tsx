/**
 * File Manager 设置路由
 * 作为文件路由占位，实际内容由 SettingsRoot 组件内嵌渲染
 */
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/settings/file-tree')({
  component: FileTreeRouteComponent,
})

function FileTreeRouteComponent() {
  // 内容由父路由 SettingsRoot 的 SettingsRoot 组件内嵌渲染
  // 此文件仅用于生成 TanStack Router 路由树
  return null
}
