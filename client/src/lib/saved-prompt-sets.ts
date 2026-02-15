export type MessageRole = 'human' | 'system' | 'ai' | 'tool' | 'function' | 'chat'

export interface PromptMessage {
  type: MessageRole
  content: string
  /** Required for function messages */
  name?: string
  /** Required for chat messages (user, assistant, system) */
  role?: string
}

export interface SavedPromptSet {
  id: string
  name: string
  messages: PromptMessage[]
  createdAt: number
}

export interface SavedPromptSetCategory {
  id: string
  name: string
  sets: SavedPromptSet[]
  createdAt: number
  updatedAt: number
}

export function createSavedPromptSetCategory(name: string): SavedPromptSetCategory {
  const now = Date.now()
  return {
    id: `cat-${now}`,
    name,
    sets: [],
    createdAt: now,
    updatedAt: now,
  }
}

/** Flatten categories to a single array of sets (for backward compat / migration) */
export function flattenCategories(categories: SavedPromptSetCategory[]): SavedPromptSet[] {
  return categories.flatMap((c) => c.sets)
}

/** Convert flat array to single default category (migration) */
export function flatToCategories(sets: SavedPromptSet[]): SavedPromptSetCategory[] {
  if (sets.length === 0) return [createSavedPromptSetCategory('General')]
  const now = Date.now()
  return [
    {
      id: `cat-${now}`,
      name: 'General',
      sets,
      createdAt: now,
      updatedAt: now,
    },
  ]
}

const STORAGE_KEY = 'ai-utils-saved-prompt-sets'
const LOAD_KEY = 'ai-utils-load-prompt-set'

export function loadSavedPromptSets(): SavedPromptSet[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedPromptSet[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveSavedPromptSets(sets: SavedPromptSet[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(sets))
}

export function setPromptSetToLoad(set: SavedPromptSet | null): void {
  if (set === null) {
    sessionStorage.removeItem(LOAD_KEY)
  } else {
    sessionStorage.setItem(LOAD_KEY, JSON.stringify(set))
  }
}

export function getPromptSetToLoad(): SavedPromptSet | null {
  try {
    const raw = sessionStorage.getItem(LOAD_KEY)
    if (!raw) return null
    const set = JSON.parse(raw) as SavedPromptSet
    sessionStorage.removeItem(LOAD_KEY)
    return set
  } catch {
    return null
  }
}
