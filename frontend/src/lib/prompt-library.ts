export interface ChainStep {
  promptText: string
  expectedReply: string
}

export interface PromptEntry {
  id: string
  name: string
  promptText: string
  reply: string
  expectedReply: string
  /** Chain of follow-up prompt → expected reply steps */
  chainSteps: ChainStep[]
  createdAt: number
  updatedAt: number
}

export interface PromptCategory {
  id: string
  name: string
  prompts: PromptEntry[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'ai-utils-prompt-library'

export function loadPromptLibrary(): PromptCategory[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as PromptCategory[]
    if (!Array.isArray(parsed)) return []
    return parsed.map((cat) => ({
      ...cat,
      prompts: (cat.prompts ?? []).map((p) => ({
        ...p,
        chainSteps: Array.isArray(p.chainSteps) ? p.chainSteps : [],
      })),
    }))
  } catch {
    return []
  }
}

export function savePromptLibrary(categories: PromptCategory[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(categories))
}

export function createCategory(name: string): PromptCategory {
  const now = Date.now()
  return {
    id: `cat-${now}`,
    name,
    prompts: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function createPrompt(
  name: string,
  promptText: string,
  expectedReply = '',
  chainSteps: ChainStep[] = []
): PromptEntry {
  const now = Date.now()
  return {
    id: `prompt-${now}`,
    name,
    promptText,
    reply: '',
    expectedReply,
    chainSteps: Array.isArray(chainSteps) ? chainSteps : [],
    createdAt: now,
    updatedAt: now,
  }
}

export function getCategoriesWithPrompts(
  categories: PromptCategory[]
): PromptCategory[] {
  return categories
}

export function getPromptsByCategory(
  categories: PromptCategory[],
  categoryId: string
): PromptEntry[] {
  const cat = categories.find((c) => c.id === categoryId)
  return cat?.prompts ?? []
}
