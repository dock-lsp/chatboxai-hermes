import type { Skill } from '../types'

/**
 * 基础技能模板
 * 这些技能会在首次使用时自动导入到技能库
 */
export const basicSkills: Skill[] = [
  // 技能 1：代码审查
  {
    id: 'skill-code-review',
    name: '代码审查',
    description: '对代码进行全面的审查，检查代码质量、潜在问题和改进建议',
    triggerConditions: ['代码审查', 'code review', '检查代码', '审查代码', 'review'],
    promptTemplate: `请对以下代码进行全面的审查：

\`\`\`
{{code}}
\`\`\`

请从以下方面进行分析：
1. 代码质量和可读性
2. 潜在的 bug 和安全问题
3. 性能优化建议
4. 最佳实践建议
5. 可维护性评估`,
    toolSequence: [],
    successCount: 0,
    failureCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  },

  // 技能 2：文档生成
  {
    id: 'skill-doc-generator',
    name: '文档生成',
    description: '根据代码自动生成文档，包括函数说明、参数描述、使用示例',
    triggerConditions: ['生成文档', '写文档', 'document', '文档', 'API文档'],
    promptTemplate: `请为以下代码生成详细的文档：

\`\`\`
{{code}}
\`\`\`

请生成：
1. 模块概述
2. 函数/方法说明
3. 参数描述
4. 返回值说明
5. 使用示例
6. 注意事项`,
    toolSequence: [],
    successCount: 0,
    failureCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  },

  // 技能 3：错误诊断
  {
    id: 'skill-error-diagnosis',
    name: '错误诊断',
    description: '分析错误信息，诊断问题原因并提供解决方案',
    triggerConditions: ['错误', '报错', 'error', 'bug', '异常', '诊断'],
    promptTemplate: `请分析以下错误信息：

错误信息：
\`\`\`
{{error}}
\`\`\`

相关代码：
\`\`\`
{{code}}
\`\`\`

请提供：
1. 错误原因分析
2. 问题定位
3. 解决方案
4. 预防措施`,
    toolSequence: [],
    successCount: 0,
    failureCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  },

  // 技能 4：代码重构
  {
    id: 'skill-refactor',
    name: '代码重构',
    description: '重构代码以提高可读性、性能和可维护性',
    triggerConditions: ['重构', 'refactor', '优化代码', '改进代码'],
    promptTemplate: `请重构以下代码：

\`\`\`
{{code}}
\`\`\`

重构目标：{{goal}}

请提供：
1. 重构后的代码
2. 重构说明
3. 改进点列表
4. 性能对比（如适用）`,
    toolSequence: [],
    successCount: 0,
    failureCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  },

  // 技能 5：测试生成
  {
    id: 'skill-test-generator',
    name: '测试生成',
    description: '为代码自动生成单元测试',
    triggerConditions: ['生成测试', '写测试', 'test', '单元测试', '测试用例'],
    promptTemplate: `请为以下代码生成单元测试：

\`\`\`
{{code}}
\`\`\`

测试框架：{{framework}}

请生成：
1. 测试用例
2. 边界条件测试
3. 异常情况测试
4. 测试覆盖率说明`,
    toolSequence: [],
    successCount: 0,
    failureCount: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  },
]
