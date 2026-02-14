import { useState, useEffect, useCallback } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import {
  loadMCPServers,
  saveMCPServers,
  addMCPServer,
  importMCPServers,
  type MCPServerConfig,
  type MCPServersConfig,
} from '@/lib/mcp-servers'
import { saveMCPSelection, loadMCPSelection, type MCPSelection } from '@/lib/mcp-selection'
import { Plug, Loader2, CheckCircle, AlertCircle, Plus, FileJson, ArrowRight, Check } from 'lucide-react'

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
  payload: { url: string } | { command: string; args: string[] }
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

export default function MCPPage({
  currentView,
  onNavigate,
}: {
  currentView: AppView
  onNavigate: (view: AppView) => void
}) {
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [servers, setServers] = useState<MCPServersConfig>(loadMCPServers)

  const [newName, setNewName] = useState('')
  const [newCommand, setNewCommand] = useState('npx')
  const [newArgs, setNewArgs] = useState('mcp-remote, https://observability.mcp.cloudflare.com/mcp')
  const [importJson, setImportJson] = useState('')

  const [url, setUrl] = useState('')
  const [isConnecting, setIsConnecting] = useState(false)
  const [result, setResult] = useState<MCPConnectResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [selection, setSelection] = useState<MCPSelection | null>(() => loadMCPSelection())

  useEffect(() => {
    saveMCPServers(servers)
  }, [servers])

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

    addMCPServer(name, { command: newCommand.trim() || 'npx', args })
    setServers(loadMCPServers())
    setNewName('')
    setNewCommand('npx')
    setNewArgs('mcp-remote, https://observability.mcp.cloudflare.com/mcp')
  }, [newName, newCommand, newArgs])

  const handleSelectTool = useCallback(
    (tool: MCPTool) => {
      const sel: MCPSelection = {
        serverName: 'quick-connect',
        serverUrl: url.trim(),
        tool: { name: tool.name, description: tool.description, inputSchema: tool.inputSchema },
      }
      saveMCPSelection(sel)
      setSelection(sel)
    },
    [url]
  )

  const handleImport = useCallback(() => {
    setError(null)
    try {
      const parsed = JSON.parse(importJson) as { mcpServers?: Record<string, MCPServerConfig> }
      if (parsed.mcpServers && typeof parsed.mcpServers === 'object') {
        importMCPServers({ mcpServers: parsed.mcpServers })
        setServers(loadMCPServers())
        setImportJson('')
      } else {
        setError('Invalid format: expected { mcpServers: { ... } }')
      }
    } catch {
      setError('Invalid JSON')
    }
  }, [importJson])

  return (
    <AppLayout currentView={currentView} onNavigate={onNavigate} isConnected={isConnected}>
      <header className="h-12 shrink-0 border-b flex items-center px-6 bg-background/50 backdrop-blur sticky top-0 z-10">
        <h1 className="font-semibold text-sm">MCP Server</h1>
      </header>

        <div className="flex-1 overflow-y-auto p-6">
          <div className="max-w-2xl mx-auto space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <Plug className="w-4 h-4" />
                  Add MCP Server (command + args)
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Add servers in mcpServers format. Example: npx + mcp-remote for HTTP URLs.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Name</label>
                  <Input
                    placeholder="cloudflare-observability"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Command</label>
                  <Input
                    placeholder="npx"
                    value={newCommand}
                    onChange={(e) => setNewCommand(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Args (comma-separated)</label>
                  <Input
                    placeholder="mcp-remote, https://observability.mcp.cloudflare.com/mcp"
                    value={newArgs}
                    onChange={(e) => setNewArgs(e.target.value)}
                  />
                </div>
                <Button onClick={handleAddServer} disabled={!newName.trim()} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add server
                </Button>

                <div className="border-t pt-4 mt-4">
                  <label className="text-sm font-medium block mb-2">Import from JSON</label>
                  <textarea
                    placeholder='{"mcpServers":{"cloudflare-observability":{"command":"npx","args":["mcp-remote","https://observability.mcp.cloudflare.com/mcp"]}}}'
                    value={importJson}
                    onChange={(e) => setImportJson(e.target.value)}
                    className="w-full min-h-[80px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                  />
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={handleImport}
                    disabled={!importJson.trim()}
                    className="mt-2 gap-1"
                  >
                    <FileJson className="w-3 h-3" />
                    Import
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="pt-6">
                <Button
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => onNavigate('mcp-saved')}
                >
                  View saved MCP servers
                  <ArrowRight className="w-4 h-4" />
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Quick connect (URL)</CardTitle>
                <p className="text-sm text-muted-foreground">
                  Connect directly via Streamable HTTP URL for one-off tests.
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex gap-2">
                  <Input
                    type="url"
                    placeholder="https://example.com/mcp"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleConnectUrl()}
                    className="flex-1"
                    disabled={isConnecting}
                  />
                  <Button onClick={handleConnectUrl} disabled={isConnecting || !url.trim()}>
                    {isConnecting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      'Connect'
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {error && (
              <div className="flex items-center gap-2 text-sm text-destructive bg-destructive/10 rounded-lg p-3">
                <AlertCircle className="w-4 h-4 shrink-0" />
                {error}
              </div>
            )}

            {result && (
              <>
                <div className="flex items-center gap-2 text-sm text-green-600 dark:text-green-400 bg-green-500/10 rounded-lg p-3">
                  <CheckCircle className="w-4 h-4 shrink-0" />
                  Connected successfully
                  {result.serverInfo && (
                    <span className="text-muted-foreground">
                      — {result.serverInfo.name}
                      {result.serverInfo.version && ` v${result.serverInfo.version}`}
                    </span>
                  )}
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tools ({result.tools.length})</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {result.tools.length > 0 ? (
                      <ul className="space-y-4">
                        {result.tools.map((tool) => {
                          const isSelected =
                            selection?.serverUrl === url.trim() &&
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
                                  {isSelected ? (
                                    <Check className="w-3 h-3" />
                                  ) : null}
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
              </>
            )}
          </div>
        </div>
    </AppLayout>
  )
}
