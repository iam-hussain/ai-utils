/**
 * Shared API configuration for all fetch calls.
 */

const API_BASE = import.meta.env.PROD ? '' : (import.meta.env.VITE_API_URL || 'http://localhost:3005')

export const apiConfig = {
  baseUrl: API_BASE,
  defaultOptions: {
    credentials: 'include' as RequestCredentials,
    headers: { 'Content-Type': 'application/json' },
  },
} as const

export function apiUrl(path: string): string {
  const base = API_BASE.endsWith('/') ? API_BASE.slice(0, -1) : API_BASE
  const p = path.startsWith('/') ? path : `/${path}`
  return `${base}${p}`
}
