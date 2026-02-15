export interface ChatMessage {
  id: string
  content: string
  type: 'human' | 'system' | 'ai'
  timestamp: string
  audioData?: string
}

export interface Chat {
  id: string
  title: string
  messages: ChatMessage[]
  createdAt: number
  updatedAt: number
}

const STORAGE_KEY = 'ai-utils-chat-history'

export function loadChats(): Chat[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Chat[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

export function saveChats(chats: Chat[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(chats))
}

/** Load chats from server if available, else from localStorage */
export async function loadChatsFromServer(): Promise<Chat[]> {
  try {
    const { fetchChats } = await import('./chat-api')
    return await fetchChats()
  } catch {
    return loadChats()
  }
}

let syncTimeout: ReturnType<typeof setTimeout> | null = null

/** Persist chats to server (fire-and-forget, debounced) */
export function syncChatsToServer(chats: Chat[]): void {
  if (syncTimeout) clearTimeout(syncTimeout)
  syncTimeout = setTimeout(() => {
    syncTimeout = null
    import('./chat-api').then(({ upsertChat }) => {
      chats.forEach((chat) => upsertChat(chat).catch(() => {}))
    }).catch(() => {})
  }, 500)
}

export function createChat(): Chat {
  const now = Date.now()
  return {
    id: `chat-${now}`,
    title: 'New Chat',
    messages: [],
    createdAt: now,
    updatedAt: now,
  }
}

export function getChatTitleFromMessages(messages: ChatMessage[]): string {
  const firstHuman = messages.find((m) => m.type === 'human')
  if (!firstHuman?.content) return 'New Chat'
  const trimmed = firstHuman.content.trim()
  return trimmed.length > 40 ? `${trimmed.slice(0, 40)}...` : trimmed
}
