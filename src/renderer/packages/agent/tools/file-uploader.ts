/**
 * 文件上传工具
 * 支持图片、文档文件上传和分析
 * 注意：ZIP 文件暂不支持解压（需要安装 jszip 依赖）
 */

import * as fs from 'fs'
import * as path from 'path'

export interface UploadedFile {
  id: string
  name: string
  path: string
  size: number
  type: string
  content?: string
  base64?: string
  isImage: boolean
  isZip: boolean
  zipContents?: ZipContent[]
}

export interface ZipContent {
  name: string
  path: string
  size: number
  content?: string
  isText: boolean
}

/**
 * 读取文件为 Base64
 */
export async function readFileAsBase64(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath)
  return buffer.toString('base64')
}

/**
 * 读取文本文件
 */
export async function readTextFile(filePath: string): Promise<string> {
  const buffer = await fs.promises.readFile(filePath)
  return buffer.toString('utf-8')
}

/**
 * 检测是否为图片
 */
export function isImageFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return ['.jpg', '.jpeg', '.png', '.gif', '.bmp', '.webp', '.svg'].includes(ext)
}

/**
 * 检测是否为 ZIP
 */
export function isZipFile(filename: string): boolean {
  const ext = path.extname(filename).toLowerCase()
  return ['.zip', '.jar', '.war', '.ear'].includes(ext)
}

/**
 * 检测是否为文本文件
 */
function isTextFile(filename: string): boolean {
  const textExts = [
    '.txt', '.md', '.json', '.xml', '.yaml', '.yml',
    '.js', '.ts', '.jsx', '.tsx', '.vue', '.html', '.css', '.scss', '.less',
    '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.php',
    '.sh', '.bash', '.zsh', '.fish', '.ps1',
    '.sql', '.graphql',
    '.dockerfile', '.gitignore', '.env',
  ]
  const ext = path.extname(filename).toLowerCase()
  return textExts.includes(ext) || !ext
}

/**
 * 处理上传的文件
 */
export async function processUploadedFile(filePath: string): Promise<UploadedFile> {
  const stats = await fs.promises.stat(filePath)
  const fileName = path.basename(filePath)
  const isImage = isImageFile(fileName)
  const isZip = isZipFile(fileName)

  const uploadedFile: UploadedFile = {
    id: generateFileId(),
    name: fileName,
    path: filePath,
    size: stats.size,
    type: getFileType(fileName),
    isImage,
    isZip,
  }

  if (isImage) {
    uploadedFile.base64 = await readFileAsBase64(filePath)
  } else if (isZip) {
    // ZIP 文件暂不支持解压，仅记录信息
    uploadedFile.zipContents = []
  } else if (isTextFile(fileName) && stats.size < 5 * 1024 * 1024) {
    uploadedFile.content = await readTextFile(filePath)
  }

  return uploadedFile
}

function generateFileId(): string {
  return `file_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function getFileType(filename: string): string {
  const ext = path.extname(filename).toLowerCase()
  const typeMap: Record<string, string> = {
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.png': 'image/png',
    '.gif': 'image/gif',
    '.bmp': 'image/bmp',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.zip': 'application/zip',
    '.json': 'application/json',
    '.txt': 'text/plain',
    '.md': 'text/markdown',
    '.pdf': 'application/pdf',
    '.doc': 'application/msword',
    '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  }
  return typeMap[ext] || 'application/octet-stream'
}

/**
 * 格式化文件大小
 */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

/**
 * 分析文件内容（用于 AI）
 */
export function analyzeFileForAI(file: UploadedFile): string {
  let analysis = `文件: ${file.name}\n`
  analysis += `大小: ${formatFileSize(file.size)}\n`
  analysis += `类型: ${file.type}\n`

  if (file.isImage) {
    analysis += `这是一个图片文件。\n`
  } else if (file.isZip) {
    analysis += `这是一个 ZIP 压缩文件（暂不支持解压预览）。\n`
  } else if (file.content) {
    analysis += `内容:\n${file.content.slice(0, 10000)}`
    if (file.content.length > 10000) {
      analysis += `\n... (内容已截断，共 ${file.content.length} 字符)`
    }
  } else {
    analysis += `文件内容无法直接读取，请告诉我你需要分析这个文件的哪些方面。`
  }

  return analysis
}

/**
 * 获取文件图标类型
 */
export function getFileIconType(filename: string): 'image' | 'zip' | 'code' | 'doc' | 'file' {
  if (isImageFile(filename)) return 'image'
  if (isZipFile(filename)) return 'zip'

  const ext = path.extname(filename).toLowerCase()
  const codeExts = ['.js', '.ts', '.jsx', '.tsx', '.vue', '.html', '.css', '.scss', '.less',
    '.py', '.java', '.c', '.cpp', '.h', '.hpp', '.cs', '.go', '.rs', '.rb', '.php',
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.sql', '.graphql', '.json', '.xml', '.yaml', '.yml']
  const docExts = ['.pdf', '.doc', '.docx', '.txt', '.md']

  if (codeExts.includes(ext)) return 'code'
  if (docExts.includes(ext)) return 'doc'
  return 'file'
}

/**
 * 验证文件大小（最大 50MB）
 */
export function validateFileSize(bytes: number, maxSizeMB: number = 50): boolean {
  return bytes <= maxSizeMB * 1024 * 1024
}
