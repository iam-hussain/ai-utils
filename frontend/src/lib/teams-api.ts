import type { PromptCategory } from './prompt-library'
import type { SavedPromptSet, SavedPromptSetCategory } from './saved-prompt-sets'
import { apiConfig } from './api'

const { baseUrl, defaultOptions } = apiConfig

export interface TeamMember {
  userId: string
  role: 'read' | 'write'
}

export interface Team {
  id: string
  name: string
  ownerId: string
  memberIds: string[]
  members?: TeamMember[]
  memberCount: number
  isDiscoverable?: boolean
  promptLibrary: PromptCategory[]
  savedPromptSets: SavedPromptSet[]
  savedPromptSetCategories: SavedPromptSetCategory[]
  createdAt: string
  updatedAt: string
}

export interface DiscoverTeam {
  id: string
  name: string
  memberCount: number
}

export interface JoinRequest {
  id: string
  requesterId: string
  requesterName?: string
  requesterEmail?: string
  createdAt: string
}

export async function fetchTeams(): Promise<Team[]> {
  const res = await fetch(`${baseUrl}/api/teams`, defaultOptions)
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) throw new Error('Failed to fetch teams')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function createTeam(name: string): Promise<Team> {
  const res = await fetch(`${baseUrl}/api/teams`, {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to create team')
  }
  return res.json()
}

export async function fetchTeam(id: string): Promise<Team> {
  const res = await fetch(`${baseUrl}/api/teams/${id}`, defaultOptions)
  if (res.status === 404) throw new Error('Team not found')
  if (!res.ok) throw new Error('Failed to fetch team')
  const t = await res.json()
  return { ...t, id: t.id ?? t._id ?? id }
}

export async function updateTeamPrompts(
  teamId: string,
  data: {
    promptLibrary: PromptCategory[]
    savedPromptSets: SavedPromptSet[]
    savedPromptSetCategories: SavedPromptSetCategory[]
  }
): Promise<{
  promptLibrary: PromptCategory[]
  savedPromptSets: SavedPromptSet[]
  savedPromptSetCategories: SavedPromptSetCategory[]
}> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}/prompts`, {
    ...defaultOptions,
    method: 'PUT',
    body: JSON.stringify(data),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to update team prompts')
  }
  return res.json()
}

export async function inviteToTeam(teamId: string, email: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}/invite`, {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify({ email }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to invite')
  }
}

export async function leaveTeam(teamId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}/leave`, {
    ...defaultOptions,
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to leave team')
  }
}

export async function deleteTeam(teamId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}`, {
    ...defaultOptions,
    method: 'DELETE',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to delete team')
  }
}

export async function searchTeams(query: string): Promise<DiscoverTeam[]> {
  const res = await fetch(`${baseUrl}/api/teams/search?q=${encodeURIComponent(query)}`, defaultOptions)
  if (!res.ok) throw new Error('Failed to search teams')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function setTeamDiscoverable(teamId: string, isDiscoverable: boolean): Promise<void> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}/discoverable`, {
    ...defaultOptions,
    method: 'PUT',
    body: JSON.stringify({ isDiscoverable }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to update')
  }
}

export async function requestToJoinTeam(teamId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}/request`, {
    ...defaultOptions,
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to request join')
  }
}

export async function fetchJoinRequests(teamId: string): Promise<JoinRequest[]> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}/requests`, defaultOptions)
  if (!res.ok) throw new Error('Failed to fetch requests')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function approveJoinRequest(teamId: string, requestId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}/requests/${requestId}/approve`, {
    ...defaultOptions,
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to approve')
  }
}

export async function rejectJoinRequest(teamId: string, requestId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}/requests/${requestId}/reject`, {
    ...defaultOptions,
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to reject')
  }
}

export interface TeamMemberInfo {
  userId: string
  email: string | null
  name: string | null
  role: 'owner' | 'read' | 'write'
}

export async function fetchTeamMembers(teamId: string): Promise<TeamMemberInfo[]> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}/members`, defaultOptions)
  if (!res.ok) throw new Error('Failed to fetch members')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function updateMemberRole(
  teamId: string,
  memberId: string,
  role: 'read' | 'write'
): Promise<void> {
  const res = await fetch(`${baseUrl}/api/teams/${teamId}/members/${memberId}/role`, {
    ...defaultOptions,
    method: 'PUT',
    body: JSON.stringify({ role }),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to update role')
  }
}
