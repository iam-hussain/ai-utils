export interface Skill {
  id: string
  name: string
  content: string
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'ai-utils-skills'

export function loadSkills(): Skill[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Skill[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSkills(skills: Skill[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(skills))
}

export function createSkill(name: string, content: string): Skill {
  const now = Date.now()
  return {
    id: `skill-${now}`,
    name,
    content,
    createdAt: now,
    updatedAt: now,
  }
}
