import { useState, useEffect, useCallback } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import {
  loadSavedPromptSets,
  saveSavedPromptSets,
  getPromptSetToLoad,
  type MessageRole,
  type PromptMessage,
  type SavedPromptSet,
} from '@/lib/saved-prompt-sets'
import { loadMCPSelection } from '@/lib/mcp-selection'
import { loadSkills, type Skill } from '@/lib/skills'
import { getSelectedSkills } from '@/lib/skill-selection'
import { callMCPTool } from '@/lib/mcp-api'
import { SelectionPanel } from '@/components/selection-panel/SelectionPanel'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Play, Save, Trash2, Plus, Loader2, Wrench } from 'lucide-react'
import { cn } from '@/lib/utils'

const MESSAGE_TYPES: { value: MessageRole; label: string }[] = [
  { value: 'human', label: 'Human' },
  { value: 'system', label: 'System' },
  { value: 'ai', label: 'AI' },
  { value: 'tool', label: 'Tool' },
  { value: 'function', label: 'Function' },
  { value: 'chat', label: 'Chat' },
]

interface ComposerMessage {
  id: string
  type: MessageRole
  content: string
  name?: string
  role?: string
}

function createBlock(type: MessageRole): ComposerMessage {
  const base = { id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`, type, content: '' }
  if (type === 'function') return { ...base, name: 'function' }
  if (type === 'chat') return { ...base, role: 'user' }
  return base
}

interface PromptTestingPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function PromptTestingPage({
  currentView,
  onNavigate,
}: PromptTestingPageProps) {
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [messages, setMessages] = useState<ComposerMessage[]>(() => [createBlock('human')])
  const [testResult, setTestResult] = useState<string | null>(null)
  const [isTesting, setIsTesting] = useState(false)
  const [testError, setTestError] = useState<string | null>(null)
  const [mcpSelection, setMcpSelection] = useState(() => loadMCPSelection())
  const [isCallingTool, setIsCallingTool] = useState(false)

  const refreshSelection = useCallback(() => {
    setMcpSelection(loadMCPSelection())
  }, [])

  useEffect(() => {
    refreshSelection()
  }, [currentView, refreshSelection])

  useEffect(() => {
    const toLoad = getPromptSetToLoad()
    if (toLoad?.messages?.length) {
      setMessages(
        toLoad.messages.map((m) => ({
          id: `msg-${Date.now()}-${Math.random().toString(36).slice(2)}`,
          type: m.type,
          content: m.content,
          name: m.name,
          role: m.role,
        }))
      )
    }
  }, [])

  useEffect(() => {
    function onConnect() {
      setIsConnected(true)
    }
    function onDisconnect() {
      setIsConnected(false)
    }
    function onTestResult(data: { content: string }) {
      setTestResult(data.content)
      setIsTesting(false)
      setTestError(null)
    }
    function onTestError(data: { message: string }) {
      setTestError(data.message)
      setIsTesting(false)
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('test_prompt_result', onTestResult)
    socket.on('test_prompt_error', onTestError)
    if (!socket.connected) socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('test_prompt_result', onTestResult)
      socket.off('test_prompt_error', onTestError)
    }
  }, [])

  const addMessage = useCallback((type: MessageRole) => {
    setMessages((prev) => [...prev, createBlock(type)])
  }, [])

  const updateMessage = useCallback((id: string, content: string) => {
    setMessages((prev) => prev.map((m) => (m.id === id ? { ...m, content } : m)))
  }, [])

  const updateMessageMeta = useCallback(
    (id: string, updates: { name?: string; role?: string }) => {
      setMessages((prev) =>
        prev.map((m) => (m.id === id ? { ...m, ...updates } : m))
      )
    },
    []
  )

  const removeMessage = useCallback((id: string) => {
    setMessages((prev) => {
      const next = prev.filter((m) => m.id !== id)
      return next.length > 0 ? next : [createBlock('human')]
    })
  }, [])

  const handleTest = useCallback(() => {
    let payload = messages.map((m) => ({ type: m.type, content: m.content.trim(), name: m.name, role: m.role }))
    const skills = getSelectedSkills(loadSkills())
    if (skills.length > 0) {
      const skillContent = skills.map((s: Skill) => `## ${s.name}\n\n${s.content}`).join('\n\n---\n\n')
      const systemPrefix = `[Context from selected skills]\n\n${skillContent}\n\n---\n\n`
      const firstSystemIdx = payload.findIndex((m) => m.type === 'system')
      if (firstSystemIdx >= 0) {
        payload = payload.map((m, i) =>
          i === firstSystemIdx ? { ...m, content: systemPrefix + m.content } : m
        )
      } else {
        payload = [
          { type: 'system' as const, content: systemPrefix, name: undefined, role: undefined },
          ...payload,
        ]
      }
    }
    const hasContent = payload.some((m) => m.content.length > 0)
    if (!hasContent) return
    setTestResult(null)
    setTestError(null)
    setIsTesting(true)
    socket.emit('test_prompt', { messages: payload })
  }, [messages])

  const handleCallTool = useCallback(async () => {
    const sel = loadMCPSelection()
    if (!sel) return
    const promptText = messages.find((m) => m.type === 'human')?.content?.trim() ?? ''
    setIsCallingTool(true)
    setTestError(null)
    try {
      const payload =
        sel.serverUrl != null
          ? { url: sel.serverUrl, toolName: sel.tool.name, toolArgs: { query: promptText } }
          : sel.serverConfig != null
            ? {
              command: sel.serverConfig.command,
              args: sel.serverConfig.args,
              toolName: sel.tool.name,
              toolArgs: { query: promptText },
            }
            : null
      if (!payload) throw new Error('Invalid MCP selection')
      const result = await callMCPTool(payload)
      const text =
        result.content?.find((c) => c.type === 'text')?.text ??
        JSON.stringify(result.content ?? result)
      setTestResult(text)
    } catch (err) {
      setTestError(err instanceof Error ? err.message : 'Tool call failed')
    } finally {
      setIsCallingTool(false)
    }
  }, [messages])

  const handleSave = useCallback(() => {
    const payload: PromptMessage[] = messages
      .map((m) => ({ type: m.type, content: m.content.trim(), name: m.name, role: m.role }))
      .filter((m) => m.content.length > 0)
    if (payload.length === 0) return
    const name = window.prompt('Name for this prompt set', 'Untitled') ?? 'Untitled'
    const now = Date.now()
    const newSet: SavedPromptSet = {
      id: `set-${now}`,
      name: name.trim() || 'Untitled',
      messages: payload,
      createdAt: now,
    }
    const sets = loadSavedPromptSets()
    saveSavedPromptSets([...sets, newSet])
    onNavigate('saved')
  }, [messages, onNavigate])

  return (
    <AppLayout
      currentView={currentView}
      onNavigate={onNavigate}
      isConnected={isConnected}
    >
      <header className="h-12 shrink-0 border-b flex items-center justify-between gap-4 px-6 bg-background/50 backdrop-blur sticky top-0 z-10">
          <h1 className="font-semibold text-sm shrink-0">Prompt Testing</h1>
          <SelectionPanel onMcpChange={refreshSelection} onSkillChange={refreshSelection} />
        </header>

        <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-0 min-h-0">
          {/* Left: Composer */}
          <div className="border-r flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 flex flex-col flex-1 min-h-0 gap-4">
              <Card className="flex flex-col flex-1 min-h-0">
                <CardHeader className="pb-2">
                  <CardTitle className="text-base">Messages</CardTitle>
                  <p className="text-xs text-muted-foreground">
                    Add Human, System, AI, or Tool messages and test together.
                  </p>
                </CardHeader>
                <CardContent className="flex flex-col flex-1 min-h-0 gap-4 pb-6">
                  <div className="flex flex-wrap gap-1 shrink-0">
                    {MESSAGE_TYPES.map(({ value, label }) => (
                      <Button
                        key={value}
                        variant="outline"
                        size="sm"
                        onClick={() => addMessage(value)}
                        className="gap-1"
                      >
                        <Plus className="w-3 h-3" />
                        {label}
                      </Button>
                    ))}
                  </div>

                  <div className="flex-1 min-h-0 overflow-y-auto">
                    <ul className="space-y-3 p-1">
                      {messages.map((msg) => (
                        <li
                          key={msg.id}
                          className={cn(
                            'rounded-lg border p-3 space-y-2 text-foreground',
                            msg.type === 'human' && 'border-primary/25 bg-primary/5 dark:bg-primary/15 dark:border-primary/30',
                            msg.type === 'system' && 'border-amber-200/80 dark:border-amber-700/60 bg-amber-50/70 dark:bg-amber-950/40',
                            msg.type === 'ai' && 'border-border bg-muted/50 dark:bg-muted/60',
                            msg.type === 'tool' && 'border-sky-200/80 dark:border-sky-700/60 bg-sky-50/70 dark:bg-sky-950/40',
                            msg.type === 'function' && 'border-indigo-200/80 dark:border-indigo-700/60 bg-indigo-50/70 dark:bg-indigo-950/40',
                            msg.type === 'chat' && 'border-teal-200/80 dark:border-teal-700/60 bg-teal-50/70 dark:bg-teal-950/40'
                          )}
                        >
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span
                                className={cn(
                                  'text-[10px] uppercase tracking-wider font-semibold',
                                  msg.type === 'human' && 'text-primary dark:text-foreground',
                                  msg.type === 'system' && 'text-amber-800 dark:text-foreground',
                                  msg.type === 'ai' && 'text-muted-foreground dark:text-foreground',
                                  msg.type === 'tool' && 'text-sky-800 dark:text-foreground',
                                  msg.type === 'function' && 'text-indigo-800 dark:text-foreground',
                                  msg.type === 'chat' && 'text-teal-800 dark:text-foreground'
                                )}
                              >
                                {msg.type}
                              </span>
                              {msg.type === 'function' && (
                                <input
                                  type="text"
                                  value={msg.name ?? 'function'}
                                  onChange={(e) => updateMessageMeta(msg.id, { name: e.target.value })}
                                  placeholder="function name"
                                  className="h-7 w-24 rounded border border-input bg-background px-2 text-xs"
                                  aria-label="Function name"
                                />
                              )}
                              {msg.type === 'chat' && (
                                <Select
                                  value={msg.role ?? 'user'}
                                  onValueChange={(v) => updateMessageMeta(msg.id, { role: v })}
                                >
                                  <SelectTrigger className="h-7 w-24 text-xs">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="user">user</SelectItem>
                                    <SelectItem value="assistant">assistant</SelectItem>
                                    <SelectItem value="system">system</SelectItem>
                                  </SelectContent>
                                </Select>
                              )}
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-destructive"
                              onClick={() => removeMessage(msg.id)}
                              aria-label="Remove message"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </div>
                          <textarea
                            value={msg.content}
                            onChange={(e) => updateMessage(msg.id, e.target.value)}
                            placeholder={`${msg.type} message...`}
                            className="w-full min-h-[80px] rounded-md border border-input bg-background px-2 py-1.5 text-sm text-foreground ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring resize-y"
                            aria-label={`${msg.type} content`}
                          />
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="flex flex-wrap gap-2 shrink-0 items-center">
                    <SelectionPanel
                      compact
                      onMcpChange={refreshSelection}
                      onSkillChange={refreshSelection}
                    />
                    <Button
                      onClick={handleTest}
                      disabled={
                        isTesting ||
                        !messages.some((m) => m.content.trim().length > 0)
                      }
                      className="gap-2"
                    >
                      {isTesting ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Play className="w-4 h-4" />
                      )}
                      Test prompt
                    </Button>
                    {mcpSelection && (
                      <Button
                        variant="outline"
                        onClick={handleCallTool}
                        disabled={isCallingTool}
                        className="gap-2"
                      >
                        {isCallingTool ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Wrench className="w-4 h-4" />
                        )}
                        Call tool
                      </Button>
                    )}
                    <Button
                      variant="secondary"
                      onClick={handleSave}
                      disabled={
                        !messages.some((m) => m.content.trim().length > 0)
                      }
                      className="gap-2"
                    >
                      <Save className="w-4 h-4" />
                      Save set
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Right: Test result */}
          <div className="flex flex-col min-h-0 overflow-hidden">
            <div className="p-4 flex flex-col flex-1 min-h-0">
              <Card className="flex flex-col flex-1 min-h-0">
                <CardHeader className="shrink-0">
                  <CardTitle className="text-base">Test result</CardTitle>
                </CardHeader>
                <CardContent className="flex-1 min-h-0 overflow-y-auto pt-0">
                  {testError && (
                    <p className="text-sm text-destructive mb-2">{testError}</p>
                  )}
                  {testResult !== null ? (
                    <pre className="whitespace-pre-wrap text-sm text-muted-foreground bg-muted/50 rounded-lg p-4 border">
                      {testResult}
                    </pre>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Run a test to see the model response here.
                    </p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
    </AppLayout>
  )
}
