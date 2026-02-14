export interface MCPServerConfig {
  command: string
  args: string[]
}

export interface MCPServersConfig {
  mcpServers: Record<string, MCPServerConfig>
}

const STORAGE_KEY = 'ai-utils-mcp-servers'

const DEFAULT_SERVERS: MCPServersConfig = {
  mcpServers: {},
}

export function loadMCPServers(): MCPServersConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return { ...DEFAULT_SERVERS }
    const parsed = JSON.parse(raw) as MCPServersConfig
    if (!parsed.mcpServers || typeof parsed.mcpServers !== 'object') {
      return { ...DEFAULT_SERVERS }
    }
    return parsed
  } catch {
    return { ...DEFAULT_SERVERS }
  }
}

export function saveMCPServers(config: MCPServersConfig): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(config))
}

export function addMCPServer(name: string, config: MCPServerConfig): void {
  const current = loadMCPServers()
  current.mcpServers[name] = config
  saveMCPServers(current)
}

export function removeMCPServer(name: string): void {
  const current = loadMCPServers()
  delete current.mcpServers[name]
  saveMCPServers(current)
}

export function importMCPServers(config: MCPServersConfig): void {
  const current = loadMCPServers()
  current.mcpServers = { ...current.mcpServers, ...config.mcpServers }
  saveMCPServers(current)
}

export function exportMCPServers(): MCPServersConfig {
  return loadMCPServers()
}
