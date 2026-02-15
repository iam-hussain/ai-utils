import { apiConfig } from './api'

const { baseUrl, defaultOptions } = apiConfig

export interface AuthUser {
  id: string
  email: string
  name?: string
}

export async function updateProfile(name: string): Promise<AuthUser> {
  const res = await fetch(`${baseUrl}/api/auth/profile`, {
    ...defaultOptions,
    method: 'PATCH',
    body: JSON.stringify({ name }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Failed to update profile')
  return data.user
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  const res = await fetch(`${baseUrl}/api/auth/change-password`, {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify({ currentPassword, newPassword }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Failed to change password')
}

export async function fetchMe(): Promise<AuthUser | null> {
  const res = await fetch(`${baseUrl}/api/auth/me`, defaultOptions)
  if (res.status === 401) return null
  if (!res.ok) throw new Error('Failed to fetch user')
  const { user } = await res.json()
  return user
}

export async function register(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${baseUrl}/api/auth/register`, {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Registration failed')
  return data.user
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const res = await fetch(`${baseUrl}/api/auth/login`, {
    ...defaultOptions,
    method: 'POST',
    body: JSON.stringify({ email, password }),
  })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(data.error ?? 'Login failed')
  return data.user
}

export async function logout(): Promise<void> {
  await fetch(`${baseUrl}/api/auth/logout`, {
    ...defaultOptions,
    method: 'POST',
  })
}
