import type { MCPServerConfig } from './mcp-servers'

export interface MCPToolInfo {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

export interface MCPSelection {
  serverName: string
  serverConfig?: MCPServerConfig
  serverUrl?: string
  tool: MCPToolInfo
}

const STORAGE_KEY = 'ai-utils-mcp-selection'

export function loadMCPSelection(): MCPSelection | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw) as MCPSelection
  } catch {
    return null
  }
}

export function saveMCPSelection(selection: MCPSelection | null): void {
  if (selection === null) {
    localStorage.removeItem(STORAGE_KEY)
  } else {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(selection))
  }
}

export function clearMCPSelection(): void {
  localStorage.removeItem(STORAGE_KEY)
}
