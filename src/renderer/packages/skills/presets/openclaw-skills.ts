import type { Skill } from '../types'

/**
 * OpenClaw 技能集
 * OpenClaw 是一个强大的自动化工具框架
 */
export const openclawSkills: Skill[] = [
  // OpenClaw 基础技能 1：自动化脚本生成
  {
    id: 'skill-openclaw-automation',
    name: 'OpenClaw 自动化脚本',
    description: '使用 OpenClaw 生成自动化脚本，支持文件操作、网络请求、数据处理等',
    triggerConditions: ['openclaw', '自动化脚本', 'automation', '批量处理'],
    promptTemplate: `使用 OpenClaw 生成自动化脚本：

任务描述：{{task}}

请生成：
1. OpenClaw 脚本代码
2. 配置说明
3. 使用方法
4. 注意事项`,
    toolSequence: ['web_search', 'generate_project'],
    successCount: 0,
    failureCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  },

  // OpenClaw 基础技能 2：数据抓取
  {
    id: 'skill-openclaw-scraper',
    name: 'OpenClaw 数据抓取',
    description: '使用 OpenClaw 进行网页数据抓取和解析',
    triggerConditions: ['抓取', '爬虫', 'scraper', '数据采集', '网页数据'],
    promptTemplate: `使用 OpenClaw 进行数据抓取：

目标网址：{{url}}
数据字段：{{fields}}

请生成：
1. 抓取脚本
2. 数据解析逻辑
3. 存储方案
4. 反爬策略`,
    toolSequence: ['web_search', 'fetch_webpage'],
    successCount: 0,
    failureCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  },

  // OpenClaw 基础技能 3：文件批量处理
  {
    id: 'skill-openclaw-batch-files',
    name: 'OpenClaw 批量文件处理',
    description: '使用 OpenClaw 批量处理文件，支持重命名、转换、压缩等操作',
    triggerConditions: ['批量处理', 'batch', '批量文件', '文件处理'],
    promptTemplate: `使用 OpenClaw 批量处理文件：

操作类型：{{operation}}
源目录：{{sourceDir}}
目标目录：{{targetDir}}
文件类型：{{fileTypes}}

请生成：
1. 批量处理脚本
2. 文件过滤规则
3. 处理逻辑
4. 错误处理`,
    toolSequence: [],
    successCount: 0,
    failureCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  },

  // OpenClaw 基础技能 4：API 集成
  {
    id: 'skill-openclaw-api-integration',
    name: 'OpenClaw API 集成',
    description: '使用 OpenClaw 集成第三方 API，处理认证、请求、响应',
    triggerConditions: ['API集成', 'API integration', '第三方API', '接口对接'],
    promptTemplate: `使用 OpenClaw 集成 API：

API 名称：{{apiName}}
API 文档：{{apiDoc}}
功能需求：{{requirements}}

请生成：
1. API 客户端代码
2. 认证处理
3. 请求封装
4. 响应处理
5. 错误处理`,
    toolSequence: ['web_search'],
    successCount: 0,
    failureCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  },
]
