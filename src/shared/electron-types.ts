export interface ElectronIPC {
  invoke: (channel: string, ...args: any[]) => Promise<any>
  onSystemThemeChange: (callback: () => void) => () => void
  onWindowMaximizedChanged: (callback: (_: Electron.IpcRendererEvent, windowMaximized: boolean) => void) => () => void
  onWindowShow: (callback: () => void) => () => void
  onWindowFocused: (callback: () => void) => () => void
  onUpdateDownloaded: (callback: () => void) => () => void
  addMcpStdioTransportEventListener: (transportId: string, event: string, callback?: (...args: any[]) => void) => void
  onNavigate: (callback: (path: string) => void) => () => void
  /** 文件树扫描 - 读取目录 */
  readDirectory: (path: string) => Promise<{ name: string; isDirectory: boolean; size: number; modifiedAt: number }[]>
  /** 文件树扫描 - 获取文件信息 */
  getFileInfo: (path: string) => Promise<{ size: number; modifiedAt: number; isDirectory: boolean }>
  /** 文件树扫描 - 检查路径是否存在 */
  pathExists: (path: string) => Promise<boolean>
  /** 文件操作 - 写入文件 */
  writeFile: (path: string, content: string) => Promise<void>
  /** 文件操作 - 创建目录 */
  createDirectory: (path: string) => Promise<void>
}
