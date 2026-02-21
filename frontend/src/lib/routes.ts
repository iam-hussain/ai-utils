import type { AppView } from '@/components/layout/Sidebar'

/** URL path for each sidebar menu view */
export const VIEW_PATHS: Record<AppView, string> = {
  chat: '/chat',
  prompts: '/prompts',
  saved: '/saved',
  'prompt-library': '/prompt-library',
  mcp: '/mcp',
  'mcp-saved': '/mcp-saved',
  skills: '/skills',
  teams: '/teams',
  'agent-architect': '/nexus-architect',
} as const

export const DEFAULT_PATH = VIEW_PATHS.chat

/** Resolve AppView from URL pathname */
export function pathToView(pathname: string): AppView | null {
  const normalized = pathname.replace(/\/$/, '') || '/'
  if (normalized === '/' || normalized === '') return 'chat'
  const entry = Object.entries(VIEW_PATHS).find(([, path]) => path === normalized)
  return entry ? (entry[0] as AppView) : null
}
