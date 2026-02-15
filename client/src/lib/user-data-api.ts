import type { PromptCategory } from './prompt-library'
import type { Skill } from './skills'
import type { MCPSelection } from './mcp-selection'
import type { SavedPromptSet, SavedPromptSetCategory } from './saved-prompt-sets'
import { apiConfig } from './api'

const { baseUrl, defaultOptions } = apiConfig

export type LLMProvider = 'openai' | 'anthropic' | 'google'

export interface UserDataPayload {
  skills: Skill[]
  promptLibrary: PromptCategory[]
  mcpServers: Record<string, { command: string; args: string[] }>
  mcpSelection: MCPSelection | null
  skillSelection: string[]
  savedPromptSets: SavedPromptSet[]
  savedPromptSetCategories: SavedPromptSetCategory[]
  llmProvider: LLMProvider
}

export async function fetchUserData(): Promise<UserDataPayload> {
  const res = await fetch(`${baseUrl}/api/user-data`, defaultOptions)
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) throw new Error('Failed to fetch user data')
  return res.json()
}

export async function saveUserData(data: UserDataPayload): Promise<UserDataPayload> {
  const res = await fetch(`${baseUrl}/api/user-data`, {
    ...defaultOptions,
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) throw new Error('Failed to save user data')
  return res.json()
}
