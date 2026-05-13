/**
 * AI 文件生成器模块
 * 监听 AI 对话中的代码块，自动识别文件路径并生成对应文件
 */

import { getLogger } from '@/lib/utils'
import platform from '@/platform'

const logger = getLogger('file-generator')

/**
 * 代码块信息接口
 */
export interface CodeBlockInfo {
  /** 语言标识 */
  language: string
  /** 代码内容 */
  code: string
  /** 文件名（从代码块或上下文提取） */
  filename?: string
  /** 文件路径 */
  filepath?: string
}

/**
 * 文件生成结果
 */
export interface FileGenerationResult {
  /** 是否成功 */
  success: boolean
  /** 文件路径 */
  filepath: string
  /** 错误信息 */
  error?: string
}

/**
 * 代码块解析器
 * 从 AI 响应的 Markdown 中提取代码块和文件路径
 */
export function parseCodeBlocks(content: string): CodeBlockInfo[] {
  const blocks: CodeBlockInfo[] = []

  // 匹配 ```language:filepath 或 ```language filepath 格式的代码块
  const codeBlockRegex = /```(\w+)(?::\s*|\s+)([\w\-./\\]+)\s*\n([\s\S]*?)```/g

  let match
  while ((match = codeBlockRegex.exec(content)) !== null) {
    const [, language, filepath, code] = match
    blocks.push({
      language: language.toLowerCase(),
      code: code.trim(),
      filepath,
      filename: filepath.split(/[/\\]/).pop(),
    })
  }

  // 匹配普通 ```language 格式，尝试从上下文推断文件名
  const simpleCodeBlockRegex = /```(\w+)\s*\n([\s\S]*?)```/g
  while ((match = simpleCodeBlockRegex.exec(content)) !== null) {
    const [, language, code] = match

    // 检查是否已解析过（避免重复）
    const alreadyParsed = blocks.some((b) => b.code === code.trim())
    if (alreadyParsed) continue

    // 尝试从代码内容中的注释提取文件名
    const filenameFromComment = extractFilenameFromComment(code, language)

    blocks.push({
      language: language.toLowerCase(),
      code: code.trim(),
      filepath: filenameFromComment,
      filename: filenameFromComment?.split(/[/\\]/).pop(),
    })
  }

  return blocks
}

/**
 * 从代码注释中提取文件名
 */
function extractFilenameFromComment(code: string, language: string): string | undefined {
  const patterns: Record<string, RegExp[]> = {
    javascript: [/\/\/\s*([\w\-./\\]+\.(js|ts|jsx|tsx))/, /\/\*\s*([\w\-./\\]+\.(js|ts|jsx|tsx))/],
    typescript: [/\/\/\s*([\w\-./\\]+\.(ts|tsx))/, /\/\*\s*([\w\-./\\]+\.(ts|tsx))/],
    python: [/#\s*([\w\-./\\]+\.(py))/, /"""\s*([\w\-./\\]+\.(py))/],
    java: [/\/\/\s*([\w\-./\\]+\.(java))/],
    kotlin: [/\/\/\s*([\w\-./\\]+\.(kt|kts))/],
    swift: [/\/\/\s*([\w\-./\\]+\.(swift))/],
    dart: [/\/\/\s*([\w\-./\\]+\.(dart))/],
    go: [/\/\/\s*([\w\-./\\]+\.(go))/],
    rust: [/\/\/\s*([\w\-./\\]+\.(rs))/],
    cpp: [/\/\/\s*([\w\-./\\]+\.(cpp|c|h|hpp))/],
  }

  const languagePatterns = patterns[language] || []
  for (const pattern of languagePatterns) {
    const match = code.match(pattern)
    if (match) {
      return match[1]
    }
  }

  return undefined
}

/**
 * 生成文件
 * @param filepath 文件路径
 * @param content 文件内容
 * @param basePath 基础保存路径
 */
export async function generateFile(
  filepath: string,
  content: string,
  basePath: string
): Promise<FileGenerationResult> {
  try {
    // 清理文件路径
    const cleanPath = filepath.replace(/^[./\\]+/, '')
    const fullPath = `${basePath}/${cleanPath}`

    logger.info('生成文件:', fullPath)

    // 使用平台 API 写入文件
    await platform.writeFile(fullPath, content)

    return {
      success: true,
      filepath: fullPath,
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error('生成文件失败:', errorMsg)

    return {
      success: false,
      filepath,
      error: errorMsg,
    }
  }
}

/**
 * 批量生成文件
 * @param blocks 代码块列表
 * @param basePath 基础保存路径
 */
export async function generateFiles(
  blocks: CodeBlockInfo[],
  basePath: string
): Promise<FileGenerationResult[]> {
  const results: FileGenerationResult[] = []

  for (const block of blocks) {
    if (!block.filepath) {
      results.push({
        success: false,
        filepath: '',
        error: '无法确定文件路径',
      })
      continue
    }

    const result = await generateFile(block.filepath, block.code, basePath)
    results.push(result)
  }

  return results
}

/**
 * 检测项目类型
 * 根据文件列表推断项目类型和推荐的项目结构
 */
export function detectProjectType(files: string[]): {
  type: string
  framework?: string
  language: string
} {
  const fileSet = new Set(files.map((f) => f.toLowerCase()))

  // Android 项目
  if (fileSet.has('androidmanifest.xml') || files.some((f) => f.includes('build.gradle'))) {
    return { type: 'android', language: 'kotlin/java' }
  }

  // Flutter 项目
  if (fileSet.has('pubspec.yaml')) {
    return { type: 'flutter', framework: 'flutter', language: 'dart' }
  }

  // React/Vue/Angular 项目
  if (fileSet.has('package.json')) {
    if (files.some((f) => f.includes('vue.config.') || f.endsWith('.vue'))) {
      return { type: 'frontend', framework: 'vue', language: 'javascript/typescript' }
    }
    if (files.some((f) => f.includes('angular.json'))) {
      return { type: 'frontend', framework: 'angular', language: 'typescript' }
    }
    return { type: 'frontend', framework: 'react', language: 'javascript/typescript' }
  }

  // Python 项目
  if (fileSet.has('requirements.txt') || fileSet.has('pyproject.toml') || fileSet.has('setup.py')) {
    return { type: 'python', language: 'python' }
  }

  // Go 项目
  if (fileSet.has('go.mod')) {
    return { type: 'go', language: 'go' }
  }

  // Rust 项目
  if (fileSet.has('cargo.toml')) {
    return { type: 'rust', language: 'rust' }
  }

  // 默认
  return { type: 'unknown', language: 'unknown' }
}

/**
 * 生成项目脚手架
 * @param projectType 项目类型
 * @param projectName 项目名称
 * @param basePath 基础路径
 */
export async function generateProjectScaffold(
  projectType: string,
  projectName: string,
  basePath: string
): Promise<FileGenerationResult[]> {
  const results: FileGenerationResult[] = []
  const projectPath = `${basePath}/${projectName}`

  const scaffolds: Record<string, Array<{ path: string; content: string }>> = {
    flutter: [
      { path: 'pubspec.yaml', content: `name: ${projectName}\ndescription: A new Flutter project.\n\nversion: 1.0.0+1\n\nenvironment:\n  sdk: '>=3.0.0 <4.0.0'\n\ndependencies:\n  flutter:\n    sdk: flutter\n\ndev_dependencies:\n  flutter_test:\n    sdk: flutter\n\nflutter:\n  uses-material-design: true\n` },
      { path: 'lib/main.dart', content: `import 'package:flutter/material.dart';\n\nvoid main() {\n  runApp(const MyApp());\n}\n\nclass MyApp extends StatelessWidget {\n  const MyApp({super.key});\n\n  @override\n  Widget build(BuildContext context) {\n    return MaterialApp(\n      title: '${projectName}',\n      theme: ThemeData(\n        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),\n        useMaterial3: true,\n      ),\n      home: const MyHomePage(title: '${projectName}'),\n    );\n  }\n}\n\nclass MyHomePage extends StatefulWidget {\n  const MyHomePage({super.key, required this.title});\n\n  final String title;\n\n  @override\n  State<MyHomePage> createState() => _MyHomePageState();\n}\n\nclass _MyHomePageState extends State<MyHomePage> {\n  @override\n  Widget build(BuildContext context) {\n    return Scaffold(\n      appBar: AppBar(\n        backgroundColor: Theme.of(context).colorScheme.inversePrimary,\n        title: Text(widget.title),\n      ),\n      body: const Center(\n        child: Text('Hello, Flutter!'),\n      ),\n    );\n  }\n}\n` },
    ],
    android: [
      { path: 'build.gradle', content: '// Top-level build file\nplugins {\n    id 'com.android.application' version '8.1.0' apply false\n    id 'org.jetbrains.kotlin.android' version '1.9.0' apply false\n}\n' },
      { path: 'app/build.gradle', content: `plugins {\n    id 'com.android.application'\n    id 'org.jetbrains.kotlin.android'\n}\n\nandroid {\n    namespace 'com.example.${projectName.toLowerCase()}'\n    compileSdk 34\n\n    defaultConfig {\n        applicationId 'com.example.${projectName.toLowerCase()}'\n        minSdk 24\n        targetSdk 34\n        versionCode 1\n        versionName '1.0'\n    }\n}\n\ndependencies {\n    implementation 'androidx.core:core-ktx:1.12.0'\n    implementation 'androidx.appcompat:appcompat:1.6.1'\n    implementation 'com.google.android.material:material:1.11.0'\n}\n` },
    ],
  }

  const scaffold = scaffolds[projectType]
  if (scaffold) {
    for (const file of scaffold) {
      const result = await generateFile(file.path, file.content, projectPath)
      results.push(result)
    }
  }

  return results
}

// 扩展 platform 接口声明
declare module '@/platform' {
  interface PlatformInterface {
    /** 写入文件 */
    writeFile(path: string, content: string): Promise<void>
    /** 创建目录 */
    createDirectory(path: string): Promise<void>
    /** 检查路径是否存在 */
    pathExists(path: string): Promise<boolean>
  }
}
