import { apiConfig } from './api'

const { baseUrl, defaultOptions } = apiConfig

export interface TeamInvite {
  id: string
  teamId: string
  teamName: string
  inviterName?: string
  inviterEmail?: string
  createdAt: string
}

export async function fetchInvites(): Promise<TeamInvite[]> {
  const res = await fetch(`${baseUrl}/api/invites`, defaultOptions)
  if (res.status === 401) throw new Error('Unauthorized')
  if (!res.ok) throw new Error('Failed to fetch invites')
  const data = await res.json()
  return Array.isArray(data) ? data : []
}

export async function acceptInvite(inviteId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/invites/${inviteId}/accept`, {
    ...defaultOptions,
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to accept invite')
  }
}

export async function declineInvite(inviteId: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/invites/${inviteId}/decline`, {
    ...defaultOptions,
    method: 'POST',
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({}))
    throw new Error(err.error ?? 'Failed to decline invite')
  }
}
