const LOAD_KEY = 'ai-utils-load-from-prompt-library'

export interface PromptLibraryLoad {
  promptText: string
  expectedReply: string
}

export function setPromptFromLibrary(data: PromptLibraryLoad): void {
  sessionStorage.setItem(LOAD_KEY, JSON.stringify(data))
}

export function getPromptFromLibrary(): PromptLibraryLoad | null {
  try {
    const raw = sessionStorage.getItem(LOAD_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as PromptLibraryLoad
    sessionStorage.removeItem(LOAD_KEY)
    return data
  } catch {
    return null
  }
}
