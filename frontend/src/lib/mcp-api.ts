import { apiConfig } from './api'

const { baseUrl } = apiConfig

export interface CallToolPayload {
  url?: string
  command?: string
  args?: string[]
  toolName: string
  toolArgs?: Record<string, unknown>
}

export interface CallToolResult {
  content: Array<{ type: string; text?: string }>
  isError?: boolean
}

export async function callMCPTool(payload: CallToolPayload): Promise<CallToolResult> {
  const res = await fetch(`${baseUrl}/api/mcp/call-tool`, {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}
