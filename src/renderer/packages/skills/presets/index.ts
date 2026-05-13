import { skillsStore } from '../store'
import { basicSkills } from './basic-skills'
import { openclawSkills } from './openclaw-skills'

export { basicSkills } from './basic-skills'
export { openclawSkills } from './openclaw-skills'

/**
 * 导入预设技能到技能库
 */
export async function importPresetSkills(): Promise<void> {
  const allPresets = [...basicSkills, ...openclawSkills]
  const existingSkills = skillsStore.getState().skills
  const existingIds = new Set(existingSkills.map((s) => s.id))

  const newSkills = allPresets.filter((s) => !existingIds.has(s.id))

  if (newSkills.length > 0) {
    skillsStore.getState().importSkills(newSkills)
    console.log(`已导入 ${newSkills.length} 个预设技能`)
  }
}

/**
 * 获取所有预设技能
 */
export function getAllPresetSkills() {
  return [...basicSkills, ...openclawSkills]
}
