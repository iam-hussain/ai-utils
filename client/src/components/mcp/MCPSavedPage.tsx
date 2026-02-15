import { useState, useEffect, useCallback } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { useUserData } from '@/contexts/UserDataContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import type { MCPServerConfig } from '@/lib/mcp-servers'
import {
  PlugZap,
  Loader2,
  Trash2,
  Copy,
  ArrowLeft,
  Check,
  Plus,
  ChevronDown,
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
  const { mcpServers, mcpSelection: selection, updateMCPServers, updateMCPSelection } = useUserData()
  const { confirm } = useConfirm()
  const servers = { mcpServers }
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [connectingServer, setConnectingServer] = useState<string | null>(null)
  const [result, setResult] = useState<MCPConnectResult | null>(null)
  const [connectedServerName, setConnectedServerName] = useState<string | null>(null)
  const [connectedServerConfig, setConnectedServerConfig] = useState<MCPServerConfig | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

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
      updateMCPSelection({
        serverName: connectedServerName,
        serverConfig: connectedServerConfig,
        tool: { name: tool.name, description: tool.description, inputSchema: tool.inputSchema },
      })
    },
    [connectedServerName, connectedServerConfig, updateMCPSelection]
  )

  const handleCopyConfig = useCallback(() => {
    navigator.clipboard.writeText(JSON.stringify({ mcpServers }, null, 2))
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [mcpServers])

  const handleRemove = useCallback(async (name: string) => {
    const ok = await confirm({
      title: 'Remove server',
      description: `Remove "${name}"? This cannot be undone.`,
      confirmLabel: 'Remove',
      variant: 'destructive',
    })
    if (!ok) return
    const next = { ...mcpServers }
    delete next[name]
    updateMCPServers(next)
    if (connectedServerName === name) {
      setResult(null)
      setConnectedServerName(null)
      setConnectedServerConfig(null)
    }
  }, [connectedServerName, mcpServers, updateMCPServers, confirm])

  const serverEntries = Object.entries(servers.mcpServers)

  return (
    <AppLayout currentView={currentView} onNavigate={onNavigate} isConnected={isConnected}>
      <header className="h-14 shrink-0 border-b flex items-center justify-between px-6 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => onNavigate('mcp')}
            className="gap-1.5 -ml-2"
          >
            <ArrowLeft className="w-4 h-4" />
            Back
          </Button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="font-semibold text-base">Saved MCP servers</h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {serverEntries.length} {serverEntries.length === 1 ? 'server' : 'servers'} saved
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {serverEntries.length > 0 && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyConfig}
              className="gap-1.5"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-primary" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
              {copied ? 'Copied' : 'Copy config'}
            </Button>
          )}
          <Button size="sm" onClick={() => onNavigate('mcp')} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add server
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {serverEntries.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="rounded-2xl bg-muted/50 p-6 mb-4">
                  <Server className="w-12 h-12 text-muted-foreground/60" />
                </div>
                <h2 className="font-medium text-base mb-1">No servers yet</h2>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Add MCP servers from the MCP Server page. They will appear here for quick connect and tool selection.
                </p>
                <Button onClick={() => onNavigate('mcp')} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Add MCP server
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">
                Servers
              </h2>
              <ul className="space-y-3">
                {serverEntries.map(([name, config]) => (
                  <li
                    key={name}
                    className={cn(
                      'rounded-xl border bg-card overflow-hidden transition-colors',
                      'hover:border-border/80',
                      connectedServerName === name && 'ring-1 ring-primary/20 border-primary/30'
                    )}
                  >
                    <div className="flex items-center gap-4 p-4">
                      <div className="rounded-lg bg-muted/50 p-2.5 shrink-0">
                        <PlugZap className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">{name}</div>
                        <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
                          <span className="text-[11px] font-mono text-muted-foreground bg-muted/50 px-2 py-0.5 rounded">
                            {config.command}
                          </span>
                          {config.args.slice(0, 2).map((arg, i) => (
                            <span
                              key={i}
                              className="text-[11px] font-mono text-muted-foreground truncate max-w-[220px]"
                              title={arg}
                            >
                              {arg}
                            </span>
                          ))}
                          {config.args.length > 2 && (
                            <span className="text-[11px] text-muted-foreground">
                              +{config.args.length - 2} more
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="sm"
                          onClick={() => handleConnect(name, config)}
                          disabled={connectingServer !== null}
                          className="gap-1.5"
                        >
                          {connectingServer === name ? (
                            <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          ) : (
                            <>
                              <Server className="w-3.5 h-3.5" />
                              Connect
                            </>
                          )}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleRemove(name)}
                          aria-label={`Remove ${name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {error && (
            <div
              className="flex items-center gap-3 text-sm text-destructive bg-destructive/10 rounded-lg px-4 py-3"
              role="alert"
            >
              {error}
            </div>
          )}

          {result && connectedServerName && (
            <section className="space-y-4">
              <div className="flex items-center gap-2">
                <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                  Tools from {connectedServerName}
                </h2>
                {result.serverInfo && (
                  <span className="text-[11px] text-muted-foreground">
                    — {result.serverInfo.name}
                    {result.serverInfo.version && ` v${result.serverInfo.version}`}
                  </span>
                )}
              </div>
              <Card>
                <CardContent className="p-0">
                  {result.tools.length > 0 ? (
                    <ul className="divide-y divide-border">
                      {result.tools.map((tool) => {
                        const isSelected =
                          selection?.serverName === connectedServerName &&
                          selection?.tool.name === tool.name
                        return (
                          <li
                            key={tool.name}
                            className={cn(
                              'p-4 transition-colors first:rounded-t-lg last:rounded-b-lg',
                              isSelected ? 'bg-primary/5 border-l-2 border-l-primary' : 'hover:bg-muted/30'
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
                                <summary className="text-[11px] text-muted-foreground cursor-pointer hover:text-foreground list-none [&::-webkit-details-marker]:hidden">
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
                    <div className="py-12 text-center">
                      <p className="text-sm text-muted-foreground">
                        No tools exposed by this server.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </section>
          )}
        </div>
      </ScrollArea>
    </AppLayout>
  )
}
