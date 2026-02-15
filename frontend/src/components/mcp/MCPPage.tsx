import { useState, useEffect, useCallback } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { useUserData } from '@/contexts/UserDataContext'
import type { MCPServerConfig } from '@/lib/mcp-servers'
import {
  Plug,
  Loader2,
  CheckCircle,
  AlertCircle,
  Plus,
  FileJson,
  ArrowRight,
  Check,
  ChevronDown,
  Zap,
  Server,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface MCPTool {
  name: string
  description?: string
  inputSchema?: Record<string, unknown>
}

interface MCPConnectResult {
  tools: MCPTool[]
  serverInfo?: { name: string; version?: string }
}

import { apiConfig } from '@/lib/api'

async function connect(
  payload: { url: string } | { command: string; args: string[] }
): Promise<MCPConnectResult> {
  const res = await fetch(`${apiConfig.baseUrl}/api/mcp/connect`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  })
  const data = await res.json()
  if (!res.ok) throw new Error(data.error ?? `HTTP ${res.status}`)
  return data
}

export default function MCPPage({
  currentView,
  onNavigate,
}: {
  currentView: AppView
  onNavigate: (view: AppView) => void
}) {
  const { mcpServers, mcpSelection: selection, updateMCPServers, updateMCPSelection } = useUserData()
  const servers = { mcpServers }
  const [isConnected, setIsConnected] = useState(socket.connected)

  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('npx')
  const [newArgs, setNewArgs] = useState('mcp-remote, https://observability.mcp.cloudflare.com/mcp')
  const [importJson, setImportJson] = useState('')
  const [showImport, setShowImport] = useState(false)

  const [url, setUrl] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [result, setResult] = useState<MCPConnectResult | null>(null)
  const [error, setError] = useState<string | null>(null)

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

  const handleConnectUrl = useCallback(async () => {
    const trimmed = url.trim()
    if (!trimmed) return

    setIsConnecting(true)
    setError(null)
    setResult(null)

    try {
      setResult(await connect({ url: trimmed }))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Connection failed')
    } finally {
      setIsConnecting(false)
    }
  }, [url])

  const handleAddServer = useCallback(() => {
    const name = newName.trim()
    if (!name) return

    const args = newArgs
      .split(',')
      .map((a) => a.trim())
      .filter(Boolean)
    if (args.length === 0) return

    updateMCPServers({
      ...mcpServers,
      [name]: { command: newCommand.trim() || 'npx', args },
    })
    setNewName('')
    setNewCommand('npx')
    setNewArgs('mcp-remote, https://observability.mcp.cloudflare.com/mcp')
  }, [newName, newCommand, newArgs, mcpServers, updateMCPServers])

  const handleSelectTool = useCallback(
    (tool: MCPTool) => {
      updateMCPSelection({
        serverName: 'quick-connect',
        serverUrl: url.trim(),
        tool: { name: tool.name, description: tool.description, inputSchema: tool.inputSchema },
      })
    },
    [url, updateMCPSelection]
  )

  const handleImport = useCallback(() => {
    setError(null)
    try {
      const parsed = JSON.parse(importJson) as { mcpServers?: Record<string, MCPServerConfig> }
      if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
        updateMCPServers({ ...mcpServers, ...parsed.mcpServers })
        setImportJson('')
      } else {
        setError('Invalid format: expected { mcpServers: { ... } }')
      }
    } catch {
      setError('Invalid JSON')
    }
  }, [importJson, mcpServers, updateMCPServers])

  const savedCount = Object.keys(servers.mcpServers).length

  return (
    <AppLayout currentView={currentView} onNavigate={onNavigate} isConnected={isConnected}>
      <header className="h-14 shrink-0 border-b flex items-center justify-between px-4 sm:px-6 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-base">MCP Server</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Connect Model Context Protocol servers to use tools in Chat and Prompts
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 shrink-0"
          onClick={() => onNavigate('mcp-saved')}
        >
          <Server className="w-4 h-4" />
          Saved servers
          {savedCount > 0 && (
            <span className="ml-1 min-w-[1.25rem] h-5 px-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium flex items-center justify-center">
              {savedCount}
            </span>
          )}
          <ArrowRight className="w-3.5 h-3.5" />
        </Button>
      </header>

      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto p-6 space-y-8">
          {/* Quick Connect — primary action first */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-4 h-4 text-primary" />
              <h2 className="font-medium text-sm">Quick connect</h2>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-4">
                <p className="text-xs text-muted-foreground mb-3">
                  Connect via Streamable HTTP URL for one-off tests. No need to save.
                </p>
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://observability.mcp.cloudflare.com/mcp"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConnectUrl()}
                    className="flex-1 h-10 font-mono text-sm"
                    disabled={isConnecting}
                  />
                  <Button
                    onClick={handleConnectUrl}
                    disabled={isConnecting || !url.trim()}
                    className="h-10 px-5 shrink-0"
                  >
                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Connect'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Add server */}
          <section>
            <div className="flex items-center gap-2 mb-3">
              <Plug className="w-4 h-4 text-muted-foreground" />
              <h2 className="font-medium text-sm">Add server</h2>
            </div>
            <Card className="overflow-hidden">
              <CardContent className="p-4 space-y-4">
                <p className="text-xs text-muted-foreground">
                  Add servers in Claude Desktop / mcpServers format. Command runs locally; args can include HTTP URLs.
                </p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Name</label>
                    <Input
                      placeholder="cloudflare-observability"
                      value={newName}
                      onChange={(e) => setNewName(e.target.value)}
                      className="h-9"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-xs font-medium text-muted-foreground">Command</label>
                    <Input
                      placeholder="npx"
                      value={newCommand}
                      onChange={(e) => setNewCommand(e.target.value)}
                      className="h-9 font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <label className="text-xs font-medium text-muted-foreground">Args (comma-separated)</label>
                    <Input
                      placeholder="mcp-remote, https://observability.mcp.cloudflare.com/mcp"
                      value={newArgs}
                      onChange={(e) => setNewArgs(e.target.value)}
                      className="h-9 font-mono text-xs"
                    />
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    onClick={handleAddServer}
                    disabled={!newName.trim()}
                    size="sm"
                    className="gap-2"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add server
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="gap-1.5 text-muted-foreground"
                    onClick={() => setShowImport((v) => !v)}
                  >
                    <FileJson className="w-3.5 h-3.5" />
                    {showImport ? 'Hide import' : 'Import from JSON'}
                    <ChevronDown
                      className={cn('w-3.5 h-3.5 transition-transform', showImport && 'rotate-180')}
                    />
                  </Button>
                </div>
                {showImport && (
                  <div className="pt-4 border-t space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Paste mcpServers JSON</label>
                    <textarea
                      placeholder='{"mcpServers":{"my-server":{"command":"npx","args":["mcp-remote","https://..."]}}}'
                      value={importJson}
                      onChange={(e) => setImportJson(e.target.value)}
                      className="w-full min-h-[72px] rounded-md border border-input bg-muted/30 px-3 py-2 text-xs font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleImport}
                      disabled={!importJson.trim()}
                      className="gap-1.5"
                    >
                      <FileJson className="w-3.5 h-3.5" />
                      Import
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          </section>

          {/* Alerts */}
          {error && (
            <div
              className="flex items-center gap-3 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3"
              role="alert"
            >
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Connection result */}
          {result && (
            <section className="space-y-4">
              <div className="flex items-center gap-3 text-sm bg-primary/10 text-primary rounded-lg px-4 py-3">
                <CheckCircle className="w-4 h-4 shrink-0" />
                <span>
                  Connected
                  {result.serverInfo && (
                    <span className="text-muted-foreground font-normal">
                      {' '}
                      — {result.serverInfo.name}
                      {result.serverInfo.version && ` v${result.serverInfo.version}`}
                    </span>
                  )}
                </span>
              </div>

              <Card>
                <CardHeader className="pb-2">
                  <CardTitle className="text-sm font-medium">
                    Tools ({result.tools.length})
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {result.tools.length > 0 ? (
                    <ul className="space-y-3">
                      {result.tools.map((tool) => {
                        const isSelected =
                          selection?.serverUrl === url.trim() &&
                          selection?.tool.name === tool.name
                        return (
                          <li
                            key={tool.name}
                            className={cn(
                              'rounded-lg border p-4 transition-colors',
                              isSelected ? 'border-primary bg-primary/5' : 'bg-card hover:bg-muted/30'
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="font-medium text-sm">{tool.name}</div>
                                {tool.description && (
                                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">
                                    {tool.description}
                                  </p>
                                )}
                              </div>
                              <Button
                                size="sm"
                                variant={isSelected ? 'default' : 'outline'}
                                className="gap-1.5 shrink-0"
                                onClick={() => handleSelectTool(tool)}
                              >
                                {isSelected ? <Check className="w-3.5 h-3.5" /> : null}
                                {isSelected ? 'Selected' : 'Select'}
                              </Button>
                            </div>
                            {tool.inputSchema && (
                              <details className="mt-3 group">
                                <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground list-none [&::-webkit-details-marker]:hidden">
                                  <span className="inline-flex items-center gap-1">
                                    Input schema
                                    <ChevronDown className="w-3 h-3 transition-transform group-open:rotate-180" />
                                  </span>
                                </summary>
                                <pre className="mt-2 text-[11px] bg-muted/50 rounded-md p-3 overflow-x-auto font-mono">
                                  {JSON.stringify(tool.inputSchema, null, 2)}
                                </pre>
                              </details>
                            )}
                          </li>
                        )
                      })}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground py-4 text-center">
                      No tools exposed by this server.
                    </p>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
