import type { Tool, ProjectGenerationConfig, GeneratedFile, GeneratedProject } from '../types'
import * as os from 'os'
import * as path from 'path'

/**
 * 安全调用 electronAPI
 */
function getElectronAPI(): any {
  if (typeof window !== 'undefined' && window.electronAPI) {
    return window.electronAPI
  }
  return null
}

/**
 * 获取默认项目输出目录
 */
function getDefaultProjectDir(projectName: string): string {
  const homeDir = os.homedir() || process.cwd()
  return path.join(homeDir, 'Projects', projectName)
}

/**
 * 项目模板定义
 */
interface ProjectTemplate {
  name: string
  description: string
  files: GeneratedFile[]
}

/**
 * 生成项目结构树
 */
function generateProjectTree(files: GeneratedFile[]): string {
  const paths = files.map((f) => f.path)
  const tree: string[] = []

  // 简单的树形结构生成
  const buildTree = (prefix: string = '') => {
    const dirs = new Map<string, string[]>()

    for (const path of paths) {
      const parts = path.split('/')
      if (parts.length === 1) {
        tree.push(`${prefix}${parts[0]}`)
      } else {
        const dir = parts[0]
        const rest = parts.slice(1).join('/')
        if (!dirs.has(dir)) {
          dirs.set(dir, [])
        }
        dirs.get(dir)!.push(rest)
      }
    }

    for (const [dir, children] of dirs) {
      tree.push(`${prefix}${dir}/`)
      // 递归处理子目录
      const childPaths = children.map((c) => `${dir}/${c}`)
      const childFiles: GeneratedFile[] = childPaths.map((p) => ({
        path: p,
        content: '',
        language: '',
      }))
      // 简化处理，实际应该递归
    }
  }

  buildTree()
  return tree.join('\n') || 'project/'
}

/**
 * 生成 ASCII 树形结构
 */
function generateASCIITree(files: GeneratedFile[]): string {
  const paths = files.map((f) => f.path).sort()
  const lines: string[] = ['.']
  const addedDirs = new Set<string>()

  for (const path of paths) {
    const parts = path.split('/')
    let currentPath = ''

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i]
      const isLast = i === parts.length - 1
      const parentPath = currentPath
      currentPath = currentPath ? `${currentPath}/${part}` : part

      if (i < parts.length - 1) {
        // 是目录
        if (!addedDirs.has(currentPath)) {
          const indent = '│   '.repeat(i)
          lines.push(`${indent}├── ${part}/`)
          addedDirs.add(currentPath)
        }
      } else {
        // 是文件
        const indent = '│   '.repeat(i)
        lines.push(`${indent}${isLast ? '└──' : '├──'} ${part}`)
      }
    }
  }

  return lines.join('\n')
}

/**
 * 创建 React 项目模板
 */
function createReactTemplate(config: ProjectGenerationConfig): GeneratedFile[] {
  const { name, description, features } = config

  return [
    {
      path: 'package.json',
      language: 'json',
      content: JSON.stringify(
        {
          name,
          version: '0.1.0',
          description,
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'tsc && vite build',
            preview: 'vite preview',
            lint: 'eslint . --ext ts,tsx --report-unused-disable-directives --max-warnings 0',
          },
          dependencies: {
            react: '^18.2.0',
            'react-dom': '^18.2.0',
            ...(features.includes('router') ? { 'react-router-dom': '^6.20.0' } : {}),
            ...(features.includes('state-management')
              ? { zustand: '^4.4.7', '@tanstack/react-query': '^5.8.0' }
              : {}),
            ...(features.includes('ui-library')
              ? { '@radix-ui/react-dialog': '^1.0.5', 'class-variance-authority': '^0.7.0' }
              : {}),
            ...(features.includes('styling') ? { tailwindcss: '^3.3.0' } : {}),
          },
          devDependencies: {
            '@types/react': '^18.2.43',
            '@types/react-dom': '^18.2.17',
            '@typescript-eslint/eslint-plugin': '^6.14.0',
            '@typescript-eslint/parser': '^6.14.0',
            '@vitejs/plugin-react': '^4.2.1',
            eslint: '^8.55.0',
            'eslint-plugin-react-hooks': '^4.6.0',
            'eslint-plugin-react-refresh': '^0.4.5',
            typescript: '^5.2.2',
            vite: '^5.0.8',
          },
        },
        null,
        2
      ),
    },
    {
      path: 'tsconfig.json',
      language: 'json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            module: 'ESNext',
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'react-jsx',
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
          },
          include: ['src'],
          references: [{ path: './tsconfig.node.json' }],
        },
        null,
        2
      ),
    },
    {
      path: 'vite.config.ts',
      language: 'typescript',
      content: `import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
})
`,
    },
    {
      path: 'index.html',
      language: 'html',
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
`,
    },
    {
      path: 'src/main.tsx',
      language: 'tsx',
      content: `import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
${features.includes('styling') ? "import './index.css'" : ''}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
`,
    },
    {
      path: 'src/App.tsx',
      language: 'tsx',
      content: `import { useState } from 'react'
${features.includes('router') ? "import { BrowserRouter, Routes, Route } from 'react-router-dom'" : ''}

function App() {
  const [count, setCount] = useState(0)

  return (
    ${features.includes('router') ? '<BrowserRouter>' : '<>'}
      <div className="app">
        <h1>${name}</h1>
        <p>${description}</p>
        <div className="card">
          <button onClick={() => setCount((count) => count + 1)}>
            count is {count}
          </button>
        </div>
        ${features.includes('router') ? `
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/about" element={<About />} />
        </Routes>
        ` : ''}
      </div>
    ${features.includes('router') ? '</BrowserRouter>' : '</>'}
  )
}

${features.includes('router') ? `
function Home() {
  return <div>Home Page</div>
}

function About() {
  return <div>About Page</div>
}
` : ''}

export default App
`,
    },
    {
      path: 'src/vite-env.d.ts',
      language: 'typescript',
      content: `/// <reference types="vite/client" />
`,
    },
    ...(features.includes('styling')
      ? [
          {
            path: 'src/index.css',
            language: 'css',
            content: `:root {
  font-family: Inter, system-ui, Avenir, Helvetica, Arial, sans-serif;
  line-height: 1.5;
  font-weight: 400;
  color-scheme: light dark;
}

body {
  margin: 0;
  display: flex;
  place-items: center;
  min-width: 320px;
  min-height: 100vh;
}

#root {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}

.app {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}
`,
          },
        ]
      : []),
    {
      path: 'README.md',
      language: 'markdown',
      content: `# ${name}

${description}

## 功能特性

${features.map((f) => `- ${f}`).join('\n')}

## 开始使用

\`\`\`bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
\`\`\`

## 项目结构

\`\`\`
src/
├── main.tsx      # 应用入口
├── App.tsx       # 根组件
└── vite-env.d.ts # Vite 类型声明
\`\`\`
`,
    },
  ]
}

/**
 * 创建 Vue 项目模板
 */
function createVueTemplate(config: ProjectGenerationConfig): GeneratedFile[] {
  const { name, description, features } = config

  return [
    {
      path: 'package.json',
      language: 'json',
      content: JSON.stringify(
        {
          name,
          version: '0.1.0',
          description,
          private: true,
          type: 'module',
          scripts: {
            dev: 'vite',
            build: 'vue-tsc && vite build',
            preview: 'vite preview',
          },
          dependencies: {
            vue: '^3.3.11',
            ...(features.includes('router') ? { 'vue-router': '^4.2.5' } : {}),
            ...(features.includes('state-management') ? { pinia: '^2.1.7' } : {}),
          },
          devDependencies: {
            '@vitejs/plugin-vue': '^4.5.2',
            typescript: '^5.2.2',
            vite: '^5.0.8',
            'vue-tsc': '^1.8.25',
          },
        },
        null,
        2
      ),
    },
    {
      path: 'vite.config.ts',
      language: 'typescript',
      content: `import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue()],
})
`,
    },
    {
      path: 'tsconfig.json',
      language: 'json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2020',
            useDefineForClassFields: true,
            module: 'ESNext',
            lib: ['ES2020', 'DOM', 'DOM.Iterable'],
            skipLibCheck: true,
            moduleResolution: 'bundler',
            allowImportingTsExtensions: true,
            resolveJsonModule: true,
            isolatedModules: true,
            noEmit: true,
            jsx: 'preserve',
            strict: true,
            noUnusedLocals: true,
            noUnusedParameters: true,
            noFallthroughCasesInSwitch: true,
          },
          include: ['src/**/*.ts', 'src/**/*.tsx', 'src/**/*.vue'],
          references: [{ path: './tsconfig.node.json' }],
        },
        null,
        2
      ),
    },
    {
      path: 'index.html',
      language: 'html',
      content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>${name}</title>
  </head>
  <body>
    <div id="app"></div>
    <script type="module" src="/src/main.ts"></script>
  </body>
</html>
`,
    },
    {
      path: 'src/main.ts',
      language: 'typescript',
      content: `import { createApp } from 'vue'
import App from './App.vue'
${features.includes('router') ? "import router from './router'" : ''}
${features.includes('state-management') ? "import { createPinia } from 'pinia'" : ''}

const app = createApp(App)

${features.includes('state-management') ? 'app.use(createPinia())' : ''}
${features.includes('router') ? 'app.use(router)' : ''}

app.mount('#app')
`,
    },
    {
      path: 'src/App.vue',
      language: 'vue',
      content: `<script setup lang="ts">
import { ref } from 'vue'

const count = ref(0)
</script>

<template>
  <div class="app">
    <h1>${name}</h1>
    <p>${description}</p>
    <div class="card">
      <button type="button" @click="count++">count is {{ count }}</button>
    </div>
  </div>
</template>

<style scoped>
.app {
  max-width: 1280px;
  margin: 0 auto;
  padding: 2rem;
  text-align: center;
}
</style>
`,
    },
    ...(features.includes('router')
      ? [
          {
            path: 'src/router/index.ts',
            language: 'typescript',
            content: `import { createRouter, createWebHistory } from 'vue-router'
import HomeView from '../views/HomeView.vue'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: HomeView,
    },
    {
      path: '/about',
      name: 'about',
      component: () => import('../views/AboutView.vue'),
    },
  ],
})

export default router
`,
          },
          {
            path: 'src/views/HomeView.vue',
            language: 'vue',
            content: `<script setup lang="ts">
</script>

<template>
  <main>
    <h1>Home</h1>
    <p>Welcome to ${name}</p>
  </main>
</template>
`,
          },
          {
            path: 'src/views/AboutView.vue',
            language: 'vue',
            content: `<script setup lang="ts">
</script>

<template>
  <main>
    <h1>About</h1>
    <p>${description}</p>
  </main>
</template>
`,
          },
        ]
      : []),
    {
      path: 'src/vite-env.d.ts',
      language: 'typescript',
      content: `/// <reference types="vite/client" />

declare module '*.vue' {
  import type { DefineComponent } from 'vue'
  const component: DefineComponent<{}, {}, any>
  export default component
}
`,
    },
    {
      path: 'README.md',
      language: 'markdown',
      content: `# ${name}

${description}

## 功能特性

${features.map((f) => `- ${f}`).join('\n')}

## 开始使用

\`\`\`bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build
\`\`\`
`,
    },
  ]
}

/**
 * 创建 Python 项目模板
 */
function createPythonTemplate(config: ProjectGenerationConfig): GeneratedFile[] {
  const { name, description, features } = config
  const packageName = name.toLowerCase().replace(/-/g, '_')

  return [
    {
      path: 'pyproject.toml',
      language: 'toml',
      content: `[build-system]
requires = ["hatchling"]
build-backend = "hatchling.build"

[project]
name = "${name}"
version = "0.1.0"
description = "${description}"
readme = "README.md"
requires-python = ">=3.9"
license = "MIT"
keywords = []
authors = [
  { name = "Author", email = "author@example.com" },
]
classifiers = [
  "Development Status :: 4 - Beta",
  "Programming Language :: Python",
  "Programming Language :: Python :: 3.9",
  "Programming Language :: Python :: 3.10",
  "Programming Language :: Python :: 3.11",
  "Programming Language :: Python :: 3.12",
]
dependencies = [
${features.includes('web-framework') ? '  "fastapi>=0.104.0",\n  "uvicorn[standard]>=0.24.0",' : ''}
${features.includes('data-processing') ? '  "pandas>=2.1.0",\n  "numpy>=1.26.0",' : ''}
${features.includes('testing') ? '  "pytest>=7.4.0",\n  "pytest-cov>=4.1.0",' : ''}
${features.includes('cli') ? '  "click>=8.1.0",' : ''}
${features.includes('http-client') ? '  "httpx>=0.25.0",' : ''}
]

[project.optional-dependencies]
dev = [
  "ruff>=0.1.0",
  "mypy>=1.7.0",
  "pre-commit>=3.5.0",
]

[project.scripts]
${packageName} = "${packageName}.cli:main"

[tool.hatch.version]
path = "src/${packageName}/__init__.py"

[tool.hatch.build.targets.wheel]
packages = ["src/${packageName}"]

[tool.ruff]
target-version = "py39"
line-length = 100

[tool.ruff.lint]
select = [
  "A",
  "ARG",
  "B",
  "C",
  "DTZ",
  "E",
  "EM",
  "F",
  "FBT",
  "I",
  "ICN",
  "ISC",
  "N",
  "PLC",
  "PLE",
  "PLR",
  "PLW",
  "Q",
  "RUF",
  "S",
  "T",
  "TID",
  "UP",
  "W",
  "YTT",
]

[tool.ruff.lint.pydocstyle]
convention = "google"

[tool.mypy]
python_version = "3.9"
warn_return_any = true
warn_unused_configs = true
`,
    },
    {
      path: `src/${packageName}/__init__.py`,
      language: 'python',
      content: `"""${description}"""

__version__ = "0.1.0"
`,
    },
    {
      path: `src/${packageName}/__main__.py`,
      language: 'python',
      content: `"""Entry point for ${name}."""

import sys

if __name__ == "__main__":
    sys.exit(0)
`,
    },
    ...(features.includes('cli')
      ? [
          {
            path: `src/${packageName}/cli.py`,
            language: 'python',
            content: `"""CLI for ${name}."""

import click

from ${packageName} import __version__


@click.group()
@click.version_option(version=__version__)
def main():
    """${description}"""
    pass


@main.command()
def hello():
    """Say hello."""
    click.echo("Hello, World!")


if __name__ == "__main__":
    main()
`,
          },
        ]
      : []),
    ...(features.includes('web-framework')
      ? [
          {
            path: `src/${packageName}/app.py`,
            language: 'python',
            content: `"""FastAPI application."""

from fastapi import FastAPI

from ${packageName} import __version__

app = FastAPI(
    title="${name}",
    description="${description}",
    version=__version__,
)


@app.get("/")
async def root():
    return {"message": "Hello World"}


@app.get("/health")
async def health():
    return {"status": "healthy"}
`,
          },
        ]
      : []),
    ...(features.includes('testing')
      ? [
          {
            path: 'tests/__init__.py',
            language: 'python',
            content: '',
          },
          {
            path: `tests/test_${packageName}.py`,
            language: 'python',
            content: `"""Tests for ${name}."""

import pytest

from ${packageName} import __version__


def test_version():
    assert __version__ == "0.1.0"
`,
          },
        ]
      : []),
    {
      path: 'README.md',
      language: 'markdown',
      content: `# ${name}

${description}

## 功能特性

${features.map((f) => `- ${f}`).join('\n')}

## 安装

\`\`\`bash
pip install -e ".[dev]"
\`\`\`

## 使用

\`\`\`python
import ${packageName}
\`\`\`

${features.includes('cli') ? `
## CLI

\`\`\`bash
${packageName} --help
\`\`\`
` : ''}

${features.includes('web-framework') ? `
## 运行 Web 服务

\`\`\`bash
uvicorn ${packageName}.app:app --reload
\`\`\`
` : ''}

## 开发

\`\`\`bash
# 运行测试
pytest

# 代码格式化
ruff format .
ruff check --fix .

# 类型检查
mypy src
\`\`\`
`,
    },
    {
      path: '.gitignore',
      language: 'gitignore',
      content: `# Byte-compiled / optimized / DLL files
__pycache__/
*.py[cod]
*$py.class

# C extensions
*.so

# Distribution / packaging
.Python
build/
develop-eggs/
dist/
downloads/
eggs/
.eggs/
lib/
lib64/
parts/
sdist/
var/
wheels/
pip-wheel-metadata/
share/python-wheels/
*.egg-info/
.installed.cfg
*.egg
MANIFEST

# PyInstaller
*.manifest
*.spec

# Installer logs
pip-log.txt
pip-delete-this-directory.txt

# Unit test / coverage reports
htmlcov/
.tox/
.nox/
.coverage
.coverage.*
.cache
nosetests.xml
coverage.xml
*.cover
*.py,cover
.hypothesis/
.pytest_cache/

# Environments
.env
.venv
env/
venv/
ENV/
env.bak/
venv.bak/

# IDEs
.vscode/
.idea/
*.swp
*.swo
*~

# macOS
.DS_Store
`,
    },
  ]
}

/**
 * 创建 Node.js 项目模板
 */
function createNodeJSTemplate(config: ProjectGenerationConfig): GeneratedFile[] {
  const { name, description, features } = config

  return [
    {
      path: 'package.json',
      language: 'json',
      content: JSON.stringify(
        {
          name,
          version: '1.0.0',
          description,
          main: 'dist/index.js',
          types: 'dist/index.d.ts',
          scripts: {
            build: 'tsc',
            dev: 'tsx watch src/index.ts',
            start: 'node dist/index.js',
            test: features.includes('testing') ? 'jest' : 'echo "Error: no test specified"',
            lint: 'eslint src/**/*.ts',
            format: 'prettier --write "src/**/*.ts"',
          },
          keywords: [],
          author: '',
          license: 'MIT',
          dependencies: {
            ...(features.includes('express') ? { express: '^4.18.2' } : {}),
            ...(features.includes('fastify') ? { fastify: '^4.24.0' } : {}),
            ...(features.includes('database') ? { prisma: '^5.6.0', '@prisma/client': '^5.6.0' } : {}),
            ...(features.includes('http-client') ? { axios: '^1.6.0' } : {}),
          },
          devDependencies: {
            '@types/node': '^20.9.0',
            typescript: '^5.2.2',
            tsx: '^4.1.0',
            ...(features.includes('express') ? { '@types/express': '^4.17.21' } : {}),
            ...(features.includes('testing') ? { jest: '^29.7.0', '@types/jest': '^29.5.0', 'ts-jest': '^29.1.0' } : {}),
            eslint: '^8.54.0',
            '@typescript-eslint/eslint-plugin': '^6.12.0',
            '@typescript-eslint/parser': '^6.12.0',
            prettier: '^3.1.0',
          },
        },
        null,
        2
      ),
    },
    {
      path: 'tsconfig.json',
      language: 'json',
      content: JSON.stringify(
        {
          compilerOptions: {
            target: 'ES2022',
            module: 'commonjs',
            lib: ['ES2022'],
            outDir: './dist',
            rootDir: './src',
            strict: true,
            esModuleInterop: true,
            skipLibCheck: true,
            forceConsistentCasingInFileNames: true,
            resolveJsonModule: true,
            declaration: true,
            declarationMap: true,
            sourceMap: true,
          },
          include: ['src/**/*'],
          exclude: ['node_modules', 'dist', '**/*.test.ts'],
        },
        null,
        2
      ),
    },
    {
      path: 'src/index.ts',
      language: 'typescript',
      content: `/**
 * ${description}
 */

export function hello(): string {
  return 'Hello, World!'
}

${features.includes('express') ? `
import express from 'express'

const app = express()
const PORT = process.env.PORT || 3000

app.use(express.json())

app.get('/', (req, res) => {
  res.json({ message: 'Hello, World!' })
})

app.get('/health', (req, res) => {
  res.json({ status: 'healthy' })
})

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`)
  })
}

export { app }
` : features.includes('fastify') ? `
import Fastify from 'fastify'

const fastify = Fastify({
  logger: true,
})

fastify.get('/', async () => {
  return { message: 'Hello, World!' }
})

fastify.get('/health', async () => {
  return { status: 'healthy' }
})

const start = async () => {
  try {
    await fastify.listen({ port: 3000 })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}

if (require.main === module) {
  start()
}

export { fastify }
` : ''}
`,
    },
    ...(features.includes('testing')
      ? [
          {
            path: 'jest.config.js',
            language: 'javascript',
            content: `module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: ['**/__tests__/**/*.ts', '**/?(*.)+(spec|test).ts'],
  transform: {
    '^.+\\.ts$': 'ts-jest',
  },
}
`,
          },
          {
            path: 'src/index.test.ts',
            language: 'typescript',
            content: `import { hello } from './index'

describe('hello', () => {
  it('should return "Hello, World!"', () => {
    expect(hello()).toBe('Hello, World!')
  })
})
`,
          },
        ]
      : []),
    {
      path: '.eslintrc.js',
      language: 'javascript',
      content: `module.exports = {
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaVersion: 2022,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint'],
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
  ],
  rules: {
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/no-explicit-any': 'warn',
  },
}
`,
    },
    {
      path: '.prettierrc',
      language: 'json',
      content: JSON.stringify(
        {
          semi: false,
          singleQuote: true,
          trailingComma: 'es5',
          printWidth: 100,
          tabWidth: 2,
        },
        null,
        2
      ),
    },
    {
      path: 'README.md',
      language: 'markdown',
      content: `# ${name}

${description}

## 功能特性

${features.map((f) => `- ${f}`).join('\n')}

## 安装

\`\`\`bash
npm install
\`\`\`

## 使用

\`\`\`bash
# 开发模式
npm run dev

# 构建
npm run build

# 运行
npm start
\`\`\`

${features.includes('testing') ? `
## 测试

\`\`\`bash
npm test
\`\`\`
` : ''}

## 项目结构

\`\`\`
src/
├── index.ts    # 入口文件
\`\`\`
`,
    },
    {
      path: '.gitignore',
      language: 'gitignore',
      content: `# Dependencies
node_modules/

# Build output
dist/
build/

# Environment variables
.env
.env.local
.env.*.local

# Logs
logs
*.log
npm-debug.log*

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Testing
coverage/

# Misc
*.tgz
`,
    },
  ]
}

/**
 * 创建通用项目模板
 */
function createGenericTemplate(config: ProjectGenerationConfig): GeneratedFile[] {
  const { name, description, features } = config

  return [
    {
      path: 'README.md',
      language: 'markdown',
      content: `# ${name}

${description}

## 功能特性

${features.map((f) => `- ${f}`).join('\n')}

## 项目结构

\`\`\`
.
├── README.md
└── .gitignore
\`\`\`

## 开始使用

1. 克隆此仓库
2. 根据项目类型安装依赖
3. 开始开发
`,
    },
    {
      path: '.gitignore',
      language: 'gitignore',
      content: `# IDE
.vscode/
.idea/
*.swp
*.swo
*~

# OS
.DS_Store
Thumbs.db

# Logs
*.log
logs/

# Temporary files
*.tmp
*.temp
.cache/
`,
    },
  ]
}

/**
 * 根据配置生成项目
 */
function generateProject(config: ProjectGenerationConfig): GeneratedProject {
  let files: GeneratedFile[] = []

  switch (config.type) {
    case 'react':
      files = createReactTemplate(config)
      break
    case 'vue':
      files = createVueTemplate(config)
      break
    case 'python':
      files = createPythonTemplate(config)
      break
    case 'nodejs':
      files = createNodeJSTemplate(config)
      break
    case 'flutter':
    case 'android':
    case 'generic':
    default:
      files = createGenericTemplate(config)
      break
  }

  return {
    config,
    files,
    structure: generateASCIITree(files),
  }
}

/**
 * 项目生成器工具
 */
export const projectGeneratorTool: Tool = {
  name: 'generate_project',
  description:
    '根据配置生成完整的项目结构和文件。支持 React、Vue、Python、Node.js 等多种项目类型。',
  parameters: [
    {
      name: 'name',
      type: 'string',
      description: '项目名称',
      required: true,
    },
    {
      name: 'type',
      type: 'string',
      description: '项目类型',
      required: true,
      enum: ['flutter', 'react', 'vue', 'android', 'python', 'nodejs', 'generic'],
    },
    {
      name: 'description',
      type: 'string',
      description: '项目描述',
      required: true,
    },
    {
      name: 'features',
      type: 'array',
      description: '项目功能特性列表',
      required: false,
    },
    {
      name: 'outputPath',
      type: 'string',
      description: '项目输出路径',
      required: false,
    },
  ],
  execute: async (args: {
    name: string
    type: ProjectGenerationConfig['type']
    description: string
    features?: string[]
    outputPath?: string
  }) => {
    const config: ProjectGenerationConfig = {
      name: args.name,
      type: args.type,
      description: args.description,
      features: args.features || [],
      outputPath: args.outputPath || undefined,
    }

    const project = generateProject(config)

    // 真实创建项目文件到本地
    const outputDir = args.outputPath || getDefaultProjectDir(args.name)
    const createdFiles: string[] = []
    const errors: string[] = []

    try {
      const api = getElectronAPI()
      if (api) {
        // 创建项目根目录
        try {
          await api.invoke('file:create-directory', outputDir)
        } catch (e) {
          errors.push(`创建目录失败: ${e}`)
        }

        // 创建所有文件
        for (const file of project.files) {
          const filePath = `${outputDir}/${file.path}`
          try {
            // 确保父目录存在
            const dir = filePath.substring(0, filePath.lastIndexOf('/'))
            if (dir) {
              try {
                await api.invoke('file:create-directory', dir)
              } catch {
                // 目录可能已存在
              }
            }
            // 写入文件
            await api.invoke('file:write', filePath, file.content)
            createdFiles.push(file.path)
          } catch (e: any) {
            errors.push(`写入文件 ${file.path} 失败: ${e}`)
          }
        }
      }
    } catch {
      // 非 Electron 环境，跳过文件创建
    }

    return {
      success: true,
      message: createdFiles.length > 0
        ? `✅ 项目已创建！共 ${createdFiles.length} 个文件已写入 ${outputDir}`
        : `项目结构已生成（共 ${project.files.length} 个文件）`,
      fullPath: outputDir,
      outputDir,
      createdFiles,
      errors: errors.length > 0 ? errors : undefined,
      project: {
        name: project.config.name,
        type: project.config.type,
        description: project.config.description,
        fileCount: project.files.length,
        structure: project.structure,
        files: project.files.map((f) => ({
          path: f.path,
          language: f.language,
          content: f.content,
          size: f.content.length,
        })),
      },
    }
  },
}

/**
 * 获取项目文件内容工具
 */
export const getProjectFileTool: Tool = {
  name: 'get_project_file',
  description: '获取生成项目中特定文件的完整内容。',
  parameters: [
    {
      name: 'projectName',
      type: 'string',
      description: '项目名称',
      required: true,
    },
    {
      name: 'filePath',
      type: 'string',
      description: '文件路径',
      required: true,
    },
  ],
  execute: async (args: { projectName: string; filePath: string }) => {
    // 这里应该有一个项目缓存机制
    // 简化实现，返回提示信息
    return {
      info: '请使用 generate_project 工具生成项目后，从返回结果中获取文件内容。',
      projectName: args.projectName,
      filePath: args.filePath,
    }
  },
}

/**
 * 分析项目需求工具
 */
export const analyzeProjectRequirementsTool: Tool = {
  name: 'analyze_project_requirements',
  description:
    '分析项目需求并推荐最佳的项目类型和技术栈。根据描述自动识别需要的功能特性。',
  parameters: [
    {
      name: 'description',
      type: 'string',
      description: '项目需求描述',
      required: true,
    },
  ],
  execute: async (args: { description: string }) => {
    const description = args.description.toLowerCase()

    // 分析项目类型
    let recommendedType: ProjectGenerationConfig['type'] = 'generic'
    const recommendedFeatures: string[] = []

    if (description.includes('react') || description.includes('前端') || description.includes('web')) {
      recommendedType = 'react'
      if (description.includes('路由') || description.includes('router')) {
        recommendedFeatures.push('router')
      }
      if (description.includes('状态') || description.includes('state')) {
        recommendedFeatures.push('state-management')
      }
      if (description.includes('样式') || description.includes('css') || description.includes('tailwind')) {
        recommendedFeatures.push('styling')
      }
    } else if (description.includes('vue')) {
      recommendedType = 'vue'
      if (description.includes('路由') || description.includes('router')) {
        recommendedFeatures.push('router')
      }
      if (description.includes('状态') || description.includes('pinia')) {
        recommendedFeatures.push('state-management')
      }
    } else if (description.includes('python') || description.includes('flask') || description.includes('django')) {
      recommendedType = 'python'
      if (description.includes('api') || description.includes('web') || description.includes('fastapi')) {
        recommendedFeatures.push('web-framework')
      }
      if (description.includes('数据') || description.includes('pandas')) {
        recommendedFeatures.push('data-processing')
      }
      if (description.includes('测试') || description.includes('test')) {
        recommendedFeatures.push('testing')
      }
      if (description.includes('命令行') || description.includes('cli')) {
        recommendedFeatures.push('cli')
      }
    } else if (description.includes('node') || description.includes('express') || description.includes('后端')) {
      recommendedType = 'nodejs'
      if (description.includes('express')) {
        recommendedFeatures.push('express')
      }
      if (description.includes('fastify')) {
        recommendedFeatures.push('fastify')
      }
      if (description.includes('数据库') || description.includes('database') || description.includes('prisma')) {
        recommendedFeatures.push('database')
      }
      if (description.includes('测试') || description.includes('test')) {
        recommendedFeatures.push('testing')
      }
    } else if (description.includes('flutter') || description.includes('移动')) {
      recommendedType = 'flutter'
    } else if (description.includes('android')) {
      recommendedType = 'android'
    }

    return {
      description: args.description,
      analysis: {
        recommendedType,
        recommendedFeatures,
        confidence: recommendedType !== 'generic' ? 'high' : 'low',
      },
      suggestion: `建议创建 ${recommendedType} 类型的项目，包含以下特性: ${recommendedFeatures.join(', ') || '基础功能'}`,
    }
  },
}

// 导出所有项目生成器工具
export const projectGeneratorTools = [
  projectGeneratorTool,
  getProjectFileTool,
  analyzeProjectRequirementsTool,
]

// 导出模板生成函数
export {
  createReactTemplate,
  createVueTemplate,
  createPythonTemplate,
  createNodeJSTemplate,
  createGenericTemplate,
  generateProject,
  generateASCIITree,
}

/**
 * 分析项目需求
 * 根据描述自动推荐项目类型和特性
 */
export async function analyzeProjectRequirements(description: string): Promise<{
  description: string
  analysis: {
    recommendedType: ProjectGenerationConfig['type']
    recommendedFeatures: string[]
    confidence: 'high' | 'low'
  }
  suggestion: string
}> {
  const lowerDesc = description.toLowerCase()

  // 分析项目类型
  let recommendedType: ProjectGenerationConfig['type'] = 'generic'
  const recommendedFeatures: string[] = []

  if (lowerDesc.includes('react') || lowerDesc.includes('前端') || lowerDesc.includes('web')) {
    recommendedType = 'react'
    if (lowerDesc.includes('路由') || lowerDesc.includes('router')) {
      recommendedFeatures.push('router')
    }
    if (lowerDesc.includes('状态') || lowerDesc.includes('state')) {
      recommendedFeatures.push('state-management')
    }
    if (lowerDesc.includes('样式') || lowerDesc.includes('css') || lowerDesc.includes('tailwind')) {
      recommendedFeatures.push('styling')
    }
  } else if (lowerDesc.includes('vue')) {
    recommendedType = 'vue'
    if (lowerDesc.includes('路由') || lowerDesc.includes('router')) {
      recommendedFeatures.push('router')
    }
    if (lowerDesc.includes('状态') || lowerDesc.includes('pinia')) {
      recommendedFeatures.push('state-management')
    }
  } else if (lowerDesc.includes('python') || lowerDesc.includes('flask') || lowerDesc.includes('django')) {
    recommendedType = 'python'
    if (lowerDesc.includes('api') || lowerDesc.includes('web') || lowerDesc.includes('fastapi')) {
      recommendedFeatures.push('web-framework')
    }
    if (lowerDesc.includes('数据') || lowerDesc.includes('pandas')) {
      recommendedFeatures.push('data-processing')
    }
    if (lowerDesc.includes('测试') || lowerDesc.includes('test')) {
      recommendedFeatures.push('testing')
    }
    if (lowerDesc.includes('命令行') || lowerDesc.includes('cli')) {
      recommendedFeatures.push('cli')
    }
  } else if (lowerDesc.includes('node') || lowerDesc.includes('express') || lowerDesc.includes('后端')) {
    recommendedType = 'nodejs'
    if (lowerDesc.includes('express')) {
      recommendedFeatures.push('express')
    }
    if (lowerDesc.includes('fastify')) {
      recommendedFeatures.push('fastify')
    }
    if (lowerDesc.includes('数据库') || lowerDesc.includes('database') || lowerDesc.includes('prisma')) {
      recommendedFeatures.push('database')
    }
    if (lowerDesc.includes('测试') || lowerDesc.includes('test')) {
      recommendedFeatures.push('testing')
    }
  } else if (lowerDesc.includes('flutter') || lowerDesc.includes('移动')) {
    recommendedType = 'flutter'
  } else if (lowerDesc.includes('android')) {
    recommendedType = 'android'
  }

  return {
    description,
    analysis: {
      recommendedType,
      recommendedFeatures,
      confidence: recommendedType !== 'generic' ? 'high' : 'low',
    },
    suggestion: `建议创建 ${recommendedType} 类型的项目，包含以下特性: ${recommendedFeatures.join(', ') || '基础功能'}`,
  }
}
