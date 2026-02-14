import type { Skill } from './skills'

const STORAGE_KEY = 'ai-utils-skill-selection'

export function loadSkillSelection(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === 'string') : []
  } catch {
    return []
  }
}

export function saveSkillSelection(ids: string[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(ids))
}

export function toggleSkillSelection(id: string): string[] {
  const current = loadSkillSelection()
  const next = current.includes(id) ? current.filter((x) => x !== id) : [...current, id]
  saveSkillSelection(next)
  return next
}

export function clearSkillSelection(): void {
  localStorage.removeItem(STORAGE_KEY)
}

export function getSelectedSkills(skills: Skill[]): Skill[] {
  const ids = loadSkillSelection()
  return skills.filter((s) => ids.includes(s.id))
}
