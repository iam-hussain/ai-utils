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
