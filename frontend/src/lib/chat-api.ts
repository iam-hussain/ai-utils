import { apiConfig } from './api'

const { baseUrl, defaultOptions } = apiConfig

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

export async function fetchChats(): Promise<Chat[]> {
  const res = await fetch(`${baseUrl}/api/chats`, defaultOptions)
  if (!res.ok) throw new Error('Failed to fetch chats')
  return res.json()
}

export async function fetchChat(id: string): Promise<Chat | null> {
  const res = await fetch(`${baseUrl}/api/chats/${id}`, defaultOptions)
  if (res.status === 404) return null
  if (!res.ok) throw new Error('Failed to fetch chat')
  return res.json()
}

export async function createChat(chat: Chat): Promise<Chat> {
  const res = await fetch(`${baseUrl}/api/chats`, {
    ...defaultOptions,
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chat),
  })
  if (!res.ok) throw new Error('Failed to create chat')
  return res.json()
}

export async function updateChat(id: string, chat: Partial<Chat>): Promise<Chat> {
  const res = await fetch(`${baseUrl}/api/chats/${id}`, {
    ...defaultOptions,
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(chat),
  })
  if (!res.ok) throw new Error('Failed to update chat')
  return res.json()
}

export async function deleteChat(id: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/chats/${id}`, { ...defaultOptions, method: 'DELETE' })
  if (!res.ok && res.status !== 404) throw new Error('Failed to delete chat')
}

export async function deleteAllChats(): Promise<{ deletedCount: number }> {
  const res = await fetch(`${baseUrl}/api/chats`, { ...defaultOptions, method: 'DELETE' })
  if (!res.ok) throw new Error('Failed to delete chats')
  return res.json()
}

/** Create or update chat (upsert) */
export async function upsertChat(chat: Chat): Promise<Chat> {
  const res = await fetch(`${baseUrl}/api/chats/${chat.id}`, {
    ...defaultOptions,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...chat, updatedAt: Date.now() }),
  })
  if (!res.ok) throw new Error('Failed to upsert chat')
  return res.json()
}
