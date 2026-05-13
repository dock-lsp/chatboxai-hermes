/**
 * CI/CD 配置生成器工具
 * 用于生成 GitHub Actions、Dockerfile、docker-compose.yml 等配置文件
 */

import type { Tool } from '../types'

// ==================== GitHub Actions 工作流生成器 ====================

/**
 * GitHub Actions 工作流模板
 */
const githubActionsTemplates: Record<string, (options: any) => string> = {
  // Node.js 项目模板
  nodejs: (options: {
    name: string
    nodeVersion?: string
    includeTest?: boolean
    includeDeploy?: boolean
  }) => {
    const nodeVersion = options.nodeVersion || '20'
    const includeTest = options.includeTest !== false
    const includeDeploy = options.includeDeploy || false

    return `# ${options.name} - CI/CD 工作流
# 由 ChatboxAI Agent 自动生成

name: ${options.name}

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        node-version: [${nodeVersion}]
    
    steps:
      - name: 检出代码
        uses: actions/checkout@v4
      
      - name: 设置 Node.js \${{ matrix.node-version }}
        uses: actions/setup-node@v4
        with:
          node-version: \${{ matrix.node-version }}
          cache: 'npm'
      
      - name: 安装依赖
        run: npm ci
      
      - name: 构建
        run: npm run build
${includeTest ? `      
      - name: 运行测试
        run: npm test
` : ''}${includeDeploy ? `
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: 检出代码
        uses: actions/checkout@v4
      
      - name: 部署
        run: |
          echo "部署步骤 - 请根据实际情况修改"
          # npm run deploy
` : ''}
`
  },

  // Python 项目模板
  python: (options: {
    name: string
    pythonVersion?: string
    includeTest?: boolean
    includeDeploy?: boolean
  }) => {
    const pythonVersion = options.pythonVersion || '3.11'
    const includeTest = options.includeTest !== false

    return `# ${options.name} - CI/CD 工作流
# 由 ChatboxAI Agent 自动生成

name: ${options.name}

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        python-version: [${pythonVersion}]
    
    steps:
      - name: 检出代码
        uses: actions/checkout@v4
      
      - name: 设置 Python \${{ matrix.python-version }}
        uses: actions/setup-python@v5
        with:
          python-version: \${{ matrix.python-version }}
          cache: 'pip'
      
      - name: 安装依赖
        run: |
          python -m pip install --upgrade pip
          pip install -r requirements.txt
${includeTest ? `      
      - name: 运行测试
        run: |
          pip install pytest pytest-cov
          pytest tests/ -v --cov=src
` : ''}
`
  },

  // Flutter 项目模板
  flutter: (options: { name: string; includeTest?: boolean }) => {
    const includeTest = options.includeTest !== false

    return `# ${options.name} - CI/CD 工作流
# 由 ChatboxAI Agent 自动生成

name: ${options.name}

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: 检出代码
        uses: actions/checkout@v4
      
      - name: 设置 Flutter
        uses: subosito/flutter-action@v2
        with:
          flutter-version: '3.x'
          channel: 'stable'
      
      - name: 获取依赖
        run: flutter pub get
      
      - name: 分析代码
        run: flutter analyze
${includeTest ? `      
      - name: 运行测试
        run: flutter test
` : ''}      
      - name: 构建 APK
        run: flutter build apk --release
`
  },

  // React 项目模板
  react: (options: {
    name: string
    nodeVersion?: string
    includeTest?: boolean
    includeDeploy?: boolean
  }) => {
    const nodeVersion = options.nodeVersion || '20'
    const includeTest = options.includeTest !== false
    const includeDeploy = options.includeDeploy || false

    return `# ${options.name} - CI/CD 工作流
# 由 ChatboxAI Agent 自动生成

name: ${options.name}

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: 检出代码
        uses: actions/checkout@v4
      
      - name: 设置 Node.js ${nodeVersion}
        uses: actions/setup-node@v4
        with:
          node-version: '${nodeVersion}'
          cache: 'npm'
      
      - name: 安装依赖
        run: npm ci
      
      - name: 构建
        run: npm run build
${includeTest ? `      
      - name: 运行测试
        run: npm test
` : ''}      
      - name: 上传构建产物
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: dist/
${includeDeploy ? `
  deploy:
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    
    steps:
      - name: 检出代码
        uses: actions/checkout@v4
      
      - name: 下载构建产物
        uses: actions/download-artifact@v4
        with:
          name: build
          path: dist/
      
      - name: 部署到 GitHub Pages
        uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: \${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
` : ''}
`
  },

  // Vue 项目模板
  vue: (options: {
    name: string
    nodeVersion?: string
    includeTest?: boolean
    includeDeploy?: boolean
  }) => {
    // Vue 模板与 React 类似
    return githubActionsTemplates.react(options)
  },

  // 通用模板
  generic: (options: { name: string }) => {
    return `# ${options.name} - CI/CD 工作流
# 由 ChatboxAI Agent 自动生成
# 请根据项目需求修改此文件

name: ${options.name}

on:
  push:
    branches: [ main, master ]
  pull_request:
    branches: [ main, master ]

jobs:
  build:
    runs-on: ubuntu-latest
    
    steps:
      - name: 检出代码
        uses: actions/checkout@v4
      
      - name: 安装依赖
        run: |
          echo "请根据项目类型添加依赖安装命令"
      
      - name: 构建
        run: |
          echo "请根据项目类型添加构建命令"
      
      - name: 测试
        run: |
          echo "请根据项目类型添加测试命令"
`
  },
}

/**
 * 生成 GitHub Actions 工作流工具
 */
export const generateGitHubActionsTool: Tool = {
  name: 'cicd_github_actions',
  description: '生成 GitHub Actions 工作流配置（.github/workflows/ci.yml）。支持 Node.js、Python、Flutter、React、Vue 等项目类型。',
  parameters: [
    {
      name: 'name',
      type: 'string',
      description: '工作流名称',
      required: true,
    },
    {
      name: 'type',
      type: 'string',
      description: '项目类型: nodejs|python|flutter|react|vue|generic',
      required: true,
      enum: ['nodejs', 'python', 'flutter', 'react', 'vue', 'generic'],
    },
    {
      name: 'nodeVersion',
      type: 'string',
      description: 'Node.js 版本（默认 20）',
      required: false,
    },
    {
      name: 'pythonVersion',
      type: 'string',
      description: 'Python 版本（默认 3.11）',
      required: false,
    },
    {
      name: 'includeTest',
      type: 'boolean',
      description: '是否包含测试步骤（默认 true）',
      required: false,
    },
    {
      name: 'includeDeploy',
      type: 'boolean',
      description: '是否包含部署步骤（默认 false）',
      required: false,
    },
  ],
  execute: async (args: {
    name: string
    type: string
    nodeVersion?: string
    pythonVersion?: string
    includeTest?: boolean
    includeDeploy?: boolean
  }) => {
    const template = githubActionsTemplates[args.type]
    if (!template) {
      return {
        success: false,
        error: `不支持的项目类型: ${args.type}`,
        supportedTypes: Object.keys(githubActionsTemplates),
      }
    }

    const content = template(args)

    return {
      success: true,
      filename: '.github/workflows/ci.yml',
      content,
      type: args.type,
      message: `GitHub Actions 工作流已生成`,
      nextSteps: [
        '1. 将生成的配置保存到 .github/workflows/ci.yml',
        '2. 根据项目需求修改配置',
        '3. 推送到 GitHub 仓库',
        '4. 在 GitHub Actions 页面查看运行状态',
      ],
    }
  },
}

// ==================== Dockerfile 生成器 ====================

/**
 * Dockerfile 模板
 */
const dockerfileTemplates: Record<string, (options: any) => string> = {
  // Node.js Dockerfile
  nodejs: (options: {
    port?: number
    buildCommand?: string
    startCommand?: string
  }) => {
    const port = options.port || 3000
    const buildCommand = options.buildCommand || 'npm run build'
    const startCommand = options.startCommand || 'npm start'

    return `# Node.js Dockerfile
# 由 ChatboxAI Agent 自动生成

# 构建阶段
FROM node:20-alpine AS builder

WORKDIR /app

# 复制 package 文件
COPY package*.json ./

# 安装依赖
RUN npm ci

# 复制源代码
COPY . .

# 构建
RUN ${buildCommand}

# 生产阶段
FROM node:20-alpine AS production

WORKDIR /app

# 复制构建产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package*.json ./

# 设置环境变量
ENV NODE_ENV=production
ENV PORT=${port}

# 暴露端口
EXPOSE ${port}

# 启动命令
CMD ["sh", "-c", "${startCommand}"]
`
  },

  // Python Dockerfile
  python: (options: { port?: number }) => {
    const port = options.port || 8000

    return `# Python Dockerfile
# 由 ChatboxAI Agent 自动生成

FROM python:3.11-slim

WORKDIR /app

# 安装系统依赖
RUN apt-get update && apt-get install -y \\
    gcc \\
    && rm -rf /var/lib/apt/lists/*

# 复制依赖文件
COPY requirements.txt .

# 安装 Python 依赖
RUN pip install --no-cache-dir -r requirements.txt

# 复制源代码
COPY . .

# 设置环境变量
ENV PYTHONUNBUFFERED=1
ENV PORT=${port}

# 暴露端口
EXPOSE ${port}

# 启动命令（请根据实际情况修改）
CMD ["python", "main.py"]
`
  },

  // Nginx Dockerfile
  nginx: (options: { port?: number }) => {
    const port = options.port || 80

    return `# Nginx Dockerfile
# 由 ChatboxAI Agent 自动生成
# 用于静态文件服务

FROM nginx:alpine

# 复制静态文件
COPY dist/ /usr/share/nginx/html/

# 复制 Nginx 配置（可选）
# COPY nginx.conf /etc/nginx/nginx.conf

# 暴露端口
EXPOSE ${port}

# 启动 Nginx
CMD ["nginx", "-g", "daemon off;"]
`
  },

  // 多阶段构建 Dockerfile
  'multi-stage': (options: {
    port?: number
    buildCommand?: string
    startCommand?: string
  }) => {
    const port = options.port || 3000

    return `# 多阶段构建 Dockerfile
# 由 ChatboxAI Agent 自动生成
# 优化镜像大小和安全性的最佳实践

# 阶段 1: 依赖安装
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

# 阶段 2: 构建
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# 阶段 3: 生产镜像
FROM node:20-alpine AS runner
WORKDIR /app

# 安全: 使用非 root 用户
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 appuser

# 复制必要文件
COPY --from=builder /app/dist ./dist
COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./

# 设置权限
RUN chown -R appuser:nodejs /app
USER appuser

# 环境变量
ENV NODE_ENV=production
ENV PORT=${port}

EXPOSE ${port}

CMD ["node", "dist/index.js"]
`
  },
}

/**
 * 生成 Dockerfile 工具
 */
export const generateDockerfileTool: Tool = {
  name: 'cicd_dockerfile',
  description: '生成 Dockerfile 配置。支持 Node.js、Python、Nginx 和多阶段构建。',
  parameters: [
    {
      name: 'type',
      type: 'string',
      description: '类型: nodejs|python|nginx|multi-stage',
      required: true,
      enum: ['nodejs', 'python', 'nginx', 'multi-stage'],
    },
    {
      name: 'port',
      type: 'number',
      description: '暴露端口',
      required: false,
    },
    {
      name: 'buildCommand',
      type: 'string',
      description: '构建命令',
      required: false,
    },
    {
      name: 'startCommand',
      type: 'string',
      description: '启动命令',
      required: false,
    },
  ],
  execute: async (args: {
    type: string
    port?: number
    buildCommand?: string
    startCommand?: string
  }) => {
    const template = dockerfileTemplates[args.type]
    if (!template) {
      return {
        success: false,
        error: `不支持的类型: ${args.type}`,
        supportedTypes: Object.keys(dockerfileTemplates),
      }
    }

    const content = template(args)

    return {
      success: true,
      filename: 'Dockerfile',
      content,
      type: args.type,
      message: `Dockerfile 已生成`,
      nextSteps: [
        '1. 将生成的配置保存为 Dockerfile',
        '2. 构建镜像: docker build -t myapp .',
        '3. 运行容器: docker run -p 3000:3000 myapp',
      ],
    }
  },
}

// ==================== Docker Compose 生成器 ====================

/**
 * 生成 docker-compose.yml 内容
 */
function generateDockerComposeContent(options: {
  services: Array<{ name: string; image?: string; port?: number; env?: Record<string, string> }>
  includeRedis?: boolean
  includePostgres?: boolean
  includeNginx?: boolean
}): string {
  const services: string[] = []
  const volumes: string[] = []

  // 添加用户自定义服务
  for (const service of options.services) {
    const serviceName = service.name || 'app'
    const image = service.image || 'node:20-alpine'
    const port = service.port || 3000

    let serviceConfig = `  ${serviceName}:
    image: ${image}
    restart: unless-stopped
    ports:
      - "${port}:${port}"`

    if (service.env && Object.keys(service.env).length > 0) {
      serviceConfig += `
    environment:`
      for (const [key, value] of Object.entries(service.env)) {
        serviceConfig += `
      - ${key}=${value}`
      }
    }

    services.push(serviceConfig)
  }

  // 添加 Redis
  if (options.includeRedis) {
    services.push(`  redis:
    image: redis:7-alpine
    restart: unless-stopped
    ports:
      - "6379:6379"
    volumes:
      - redis_data:/data
    command: redis-server --appendonly yes`)
    volumes.push('redis_data:')
  }

  // 添加 PostgreSQL
  if (options.includePostgres) {
    services.push(`  postgres:
    image: postgres:15-alpine
    restart: unless-stopped
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=app
    volumes:
      - postgres_data:/var/lib/postgresql/data`)
    volumes.push('postgres_data:')
  }

  // 添加 Nginx
  if (options.includeNginx) {
    services.push(`  nginx:
    image: nginx:alpine
    restart: unless-stopped
    ports:
      - "80:80"
      - "443:443"
    volumes:
      - ./nginx.conf:/etc/nginx/nginx.conf:ro
      - ./dist:/usr/share/nginx/html:ro`)
  }

  let content = `# Docker Compose 配置
# 由 ChatboxAI Agent 自动生成

version: '3.8'

services:
${services.join('\n\n')}
`

  if (volumes.length > 0) {
    content += `
volumes:
${volumes.map((v) => `  ${v}`).join('\n')}
`
  }

  return content
}

/**
 * 生成 docker-compose.yml 工具
 */
export const generateDockerComposeTool: Tool = {
  name: 'cicd_docker_compose',
  description: '生成 docker-compose.yml 配置。支持自定义服务、Redis、PostgreSQL、Nginx 等。',
  parameters: [
    {
      name: 'services',
      type: 'array',
      description: '服务列表，格式: [{name: "服务名", image: "镜像", port: 端口}]',
      required: true,
    },
    {
      name: 'includeRedis',
      type: 'boolean',
      description: '是否包含 Redis',
      required: false,
    },
    {
      name: 'includePostgres',
      type: 'boolean',
      description: '是否包含 PostgreSQL',
      required: false,
    },
    {
      name: 'includeNginx',
      type: 'boolean',
      description: '是否包含 Nginx',
      required: false,
    },
  ],
  execute: async (args: {
    services: Array<{ name: string; image?: string; port?: number; env?: Record<string, string> }>
    includeRedis?: boolean
    includePostgres?: boolean
    includeNginx?: boolean
  }) => {
    const content = generateDockerComposeContent(args)

    const includedServices: string[] = []
    if (args.includeRedis) includedServices.push('Redis')
    if (args.includePostgres) includedServices.push('PostgreSQL')
    if (args.includeNginx) includedServices.push('Nginx')

    return {
      success: true,
      filename: 'docker-compose.yml',
      content,
      services: args.services.map((s) => s.name),
      includedServices,
      message: `docker-compose.yml 已生成`,
      nextSteps: [
        '1. 将生成的配置保存为 docker-compose.yml',
        '2. 启动服务: docker-compose up -d',
        '3. 查看日志: docker-compose logs -f',
        '4. 停止服务: docker-compose down',
      ],
    }
  },
}

// ==================== 其他 CI/CD 相关工具 ====================

/**
 * 生成 .dockerignore 文件工具
 */
export const generateDockerignoreTool: Tool = {
  name: 'cicd_dockerignore',
  description: '生成 .dockerignore 文件，优化 Docker 构建上下文',
  parameters: [],
  execute: async () => {
    const content = `# .dockerignore
# 由 ChatboxAI Agent 自动生成

# 依赖目录
node_modules
npm-debug.log
yarn-error.log
yarn.lock
package-lock.json

# 构建输出
dist
build
.next
out

# Git
.git
.gitignore

# Docker
Dockerfile
docker-compose*.yml
.dockerignore

# IDE
.idea
.vscode
*.swp
*.swo

# 测试
coverage
.nyc_output
*.test.js
*.spec.js

# 环境变量
.env
.env.*
!.env.example

# 文档
README.md
CHANGELOG.md
docs

# 其他
.DS_Store
Thumbs.db
*.log
`

    return {
      success: true,
      filename: '.dockerignore',
      content,
      message: '.dockerignore 已生成',
    }
  },
}

/**
 * 生成 .gitignore 文件工具
 */
export const generateGitignoreTool: Tool = {
  name: 'cicd_gitignore',
  description: '生成 .gitignore 文件',
  parameters: [
    {
      name: 'type',
      type: 'string',
      description: '项目类型: nodejs|python|flutter|react|vue|generic',
      required: false,
      enum: ['nodejs', 'python', 'flutter', 'react', 'vue', 'generic'],
    },
  ],
  execute: async (args: { type?: string }) => {
    const type = args.type || 'nodejs'

    const commonIgnores = `# 依赖
node_modules/
__pycache__/
*.pyc
.pyo
.pyd

# 构建输出
dist/
build/
out/
.next/

# 环境变量
.env
.env.local
.env.*.local

# IDE
.idea/
.vscode/
*.swp
*.swo

# 系统文件
.DS_Store
Thumbs.db

# 日志
*.log
npm-debug.log*
yarn-debug.log*
`

    const typeSpecificIgnores: Record<string, string> = {
      nodejs: `
# Node.js
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.npm
.yarn-integrity

# 测试覆盖率
coverage/
.nyc_output/
`,
      python: `
# Python
__pycache__/
*.py[cod]
*$py.class
.Python
venv/
ENV/
env/
.venv/
*.egg-info/
dist/
build/
.pytest_cache/
.mypy_cache/
`,
      flutter: `
# Flutter/Dart
.dart_tool/
.flutter-plugins
.flutter-plugins-dependencies
.packages
.pub-cache/
.pub/
build/
.fvm/
`,
      react: `
# React
node_modules/
build/
dist/
.cache/
.parcel-cache/
.next/
out/
`,
      vue: `
# Vue
node_modules/
dist/
.cache/
`,
      generic: '',
    }

    const content = commonIgnores + (typeSpecificIgnores[type] || '')

    return {
      success: true,
      filename: '.gitignore',
      content,
      type,
      message: `.gitignore 已生成 (${type} 项目)`,
    }
  },
}

// ==================== 导出 ====================

/**
 * CI/CD Builder 工具集合
 */
export const cicdBuilderTools = [
  generateGitHubActionsTool,
  generateDockerfileTool,
  generateDockerComposeTool,
  generateDockerignoreTool,
  generateGitignoreTool,
]
