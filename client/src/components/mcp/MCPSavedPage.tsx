import { useState, useEffect, useCallback } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sidebar, type AppView } from '@/components/layout/Sidebar'
import {
  loadMCPServers,
  removeMCPServer,
  exportMCPServers,
  type MCPServerConfig,
} from '@/lib/mcp-servers'
import { saveMCPSelection, loadMCPSelection, type MCPSelection } from '@/lib/mcp-selection'
import { PlugZap, Loader2, Trash2, Copy, ArrowLeft, Check } from 'lucide-react'

interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

interface MCPConnectResult {
  tools: MCPTool[]
  serverInfo?: { name: string; version?: string }
}

const API_BASE = import.meta.env.PROD ? '' : 'http://localhost:3000'

async function connect(
  payload: { command: string; args: string[] }
): Promise<MCPConnectResult> {
  const res = await fetch(`${API_BASE}/api/mcp/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

interface MCPSavedPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function MCPSavedPage({ currentView, onNavigate }: MCPSavedPageProps) {
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [servers, setServers] = useState(loadMCPServers)
  const [connectingServer, setConnectingServer] = useState<string | null>(null)
  const [result, setResult] = useState<MCPConnectResult | null>(null)
  const [connectedServerName, setConnectedServerName] = useState<string | null>(null)
  const [connectedServerConfig, setConnectedServerConfig] = useState<MCPServerConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<MCPSelection | null>(() => loadMCPSelection())

  useEffect(() => {
    setServers(loadMCPServers())
  }, [])

  useEffect(() => {
    setSelection(loadMCPSelection())
  }, [result])

  useEffect(() => {
    function onConnect() {
      setIsConnected(true)
    }
    function onDisconnect() {
      setIsConnected(false)
    }
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    if (!socket.connected) socket.connect()
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  const handleConnect = useCallback(async (name: string, config: MCPServerConfig) => {
    setConnectingServer(name)
    setError(null)
    setResult(null)
    setConnectedServerName(null)
    setConnectedServerConfig(null)

    try {
      setResult(await connect({ command: config.command, args: config.args }))
      setConnectedServerName(name)
      setConnectedServerConfig(config)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setConnectingServer(null)
    }
  }, [])

  const handleSelectTool = useCallback(
    (tool: MCPTool) => {
      if (!connectedServerName || !connectedServerConfig) return
      const sel: MCPSelection = {
        serverName: connectedServerName,
        serverConfig: connectedServerConfig,
        tool: { name: tool.name, description: tool.description, inputSchema: tool.inputSchema },
      }
      saveMCPSelection(sel)
      setSelection(sel)
    },
    [connectedServerName, connectedServerConfig]
  )

  const handleRemove = useCallback((name: string) => {
    removeMCPServer(name)
    setServers(loadMCPServers())
  }, [])

  const handleCopyConfig = useCallback(() => {
    const config = exportMCPServers()
    navigator.clipboard.writeText(JSON.stringify(config, null, 2))
  }, [])

  const serverEntries = Object.entries(servers.mcpServers)

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar currentView={currentView} onNavigate={onNavigate} isConnected={isConnected} />

      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        <header className="h-14 border-b flex items-center px-6 bg-background/50 backdrop-blur sticky top-0 z-10 gap-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('mcp')}
            className="gap-1 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <h1 className="font-semibold text-sm">Saved MCP servers</h1>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-2xl mx-auto p-6 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <PlugZap className="w-4 h-4" />
                  Saved servers ({serverEntries.length})
                </CardTitle>
                {serverEntries.length > 0 && (
                  <Button variant="outline" size="sm" onClick={handleCopyConfig} className="gap-1">
                    <Copy className="w-3 h-3" />
                    Copy config
                  </Button>
                )}
              </CardHeader>
              <CardContent>
                {serverEntries.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    No saved MCP servers. Add servers from the MCP Server page.
                  </p>
                ) : (
                  <ul className="space-y-2">
                    {serverEntries.map(([name, config]) => (
                      <li
                        key={name}
                        className="flex items-center justify-between gap-2 rounded-lg border p-3"
                      >
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm truncate">{name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {config.command} {config.args.join(' ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            size="sm"
                            onClick={() => handleConnect(name, config)}
                            disabled={connectingServer !== null}
                          >
                            {connectingServer === name ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              'Connect'
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => handleRemove(name)}
                            aria-label="Remove"
                          >
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                {error}
              </div>
            )}

            {result && (
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">
                    Tools ({result.tools.length})
                    {result.serverInfo && (
                      <span className="text-muted-foreground font-normal ml-2">
                        — {result.serverInfo.name}
                        {result.serverInfo.version && ` v${result.serverInfo.version}`}
                      </span>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.tools.length > 0 ? (
                    <ul className="space-y-4">
                      {result.tools.map((tool) => {
                        const isSelected =
                          selection?.serverName === connectedServerName &&
                          selection?.tool.name === tool.name
                        return (
                          <li key={tool.name} className="rounded-lg border p-4 bg-card">
                            <div className="flex items-start justify-between gap-2">
                              <div className="font-medium text-sm">{tool.name}</div>
                              <Button
                                size="sm"
                                variant={isSelected ? 'default' : 'outline'}
                                className="gap-1 shrink-0"
                                onClick={() => handleSelectTool(tool)}
                              >
                                {isSelected ? <Check className="w-3 h-3" /> : null}
                                {isSelected ? 'Selected' : 'Select for Chat & Prompts'}
                              </Button>
                            </div>
                            {tool.description && (
                              <p className="text-sm text-muted-foreground mt-1">
                                {tool.description}
                              </p>
                            )}
                            {tool.inputSchema && (
                              <details className="mt-2">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                                  Input schema
                                </summary>
                                <pre className="mt-1 text-xs bg-muted/50 rounded p-2 overflow-x-auto">
                                  {JSON.stringify(tool.inputSchema, null, 2)}
                                </pre>
                              </details>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">No tools exposed by this server.</p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}
