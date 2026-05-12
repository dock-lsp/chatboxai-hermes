<h1 align="center">
<img src='./doc/statics/icon.png' width='30'>
<span>万象Chat</span>
</h1>
<p align="center">
    <em>永久免费的 AI 桌面客户端，支持多模型、图片生成、联网搜索、文件解析</em>
</p>

<p align="center">
<a href="#features">
<img alt="Free" src="https://img.shields.io/badge/-永久免费-green?style=flat-square&logo=shield&logoColor=white" />
</a>
<a href="#features">
<img alt="Privacy" src="https://img.shields.io/badge/-本地优先-blue?style=flat-square&logo=lock&logoColor=white" />
</a>
</p>

---

## 万象Chat

万象Chat 是基于 Chatbox 社区版的开源分支，**已完全移除付费/许可系统**，所有功能永久免费开放。

> 基于 GPLv3 许可证。代码源自 [Chatbox Community Edition](https://github.com/chatboxai/chatbox)。

### 🆓 完全免费、无限制

- ✅ 无需激活许可证
- ✅ 无付费墙 / 无等级限制
- ✅ 所有 AI 模型均可使用
- ✅ 图片生成不受限制
- ✅ 联网搜索免费开放
- ✅ 文件解析免费开放

---

## 功能

### 🤖 AI 模型支持
- **多模型接入**：OpenAI (ChatGPT)、Azure OpenAI、Claude、Google Gemini Pro
- **本地模型**：Ollama（llama2、Mistral、Mixtral、codellama 等）
- **自定义后端**：支持配置私有 API 后端

### 🎨 图片生成
- DALL-E-3 图片生成
- ChatboxAI 内置图片生成
- 多种比例和风格可选

### 🌐 联网搜索
- 内置搜索引擎
- Bing / Tavily / Querit 等多种搜索后端

### 📄 文件解析
- 支持 PDF、Word、Excel、PPT 等格式
- 本地 + 云端解析双模式
- 大文件自动分块处理

### 🖥️ 用户体验
- 数据本地存储，隐私无忧
- Markdown / LaTeX / 代码高亮
- 深色主题 / 多种语言
- 流式回复 / 快捷提示词库

---

## 下载安装

### Android APK
从 [GitHub Actions](https://github.com/qq00150610-cpu/chatboxai/actions) 下载最新构建产物：
- `wanxiang-debug.apk` — Debug 版本
- `wanxiang-release.apk` — Release 版本

### 桌面端 (Windows/Mac/Linux)
```bash
git clone https://github.com/qq00150610-cpu/chatboxai.git
cd chatboxai
pnpm install
pnpm run dev
```

---

## 开发指南

### 环境要求
- Node.js 20.x ~ 22.x
- pnpm 10.x+
- Git

### 快速开始
```bash
git clone https://github.com/qq00150610-cpu/chatboxai.git
cd chatboxai
pnpm install
pnpm run dev          # 开发模式
pnpm run build        # 生产构建
```

### 项目结构
```
chatboxai/
├── src/
│   ├── main/           # Electron 主进程
│   ├── renderer/       # React 渲染层 (UI)
│   ├── preload/        # Electron 预加载脚本
│   └── shared/         # 共享工具/类型
├── android/            # Capacitor Android 配置
├── .github/workflows/  # CI/CD 自动构建
└── package.json
```

---

## 许可证

[GPLv3](./LICENSE)
