import { useState, useEffect, useCallback, useMemo } from 'react'
import { ReactFlow, Background, Controls, useNodesState, useEdgesState, getBezierPath, Handle, Position, type Node, type Edge, MarkerType, type EdgeProps } from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import { socket } from '@/lib/socket'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { useUserData } from '@/contexts/UserDataContext'
import {
  listAgentRuns,
  getAgentRun,
  getAgentAnalytics,
  createAgentRun,
  executeAgentRun,
  designAgentRun,
  deleteAgentRun,
  type AgentRunSummary,
  type AgentRunDetail,
  type AgentStep,
  type AgentAnalytics,
} from '@/lib/agent-runs-api'
import { Loader2, Zap, FileEdit, ChevronRight, Flame, CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp, Sparkles, Copy, Check, Maximize2, Minimize2, Trash2, RotateCw, Expand } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useConfirm } from '@/contexts/ConfirmContext'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

interface NexusArchitectPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

const POLL_INTERVAL_MS = 1500

const EXAMPLE_GOALS = [
  'Create a chatbot for customer support',
  'Analyze a CSV and produce a summary report',
  'Write a blog post from an outline',
]

function humanizeId(id: string): string {
  return id
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ')
}

function buildFlowFromRun(run: AgentRunDetail | null): { nodes: Node[]; edges: Edge[] } {
  if (!run?.agentDefinitions?.length) return { nodes: [], edges: [] }
  const steps = run.steps ?? []
  const stepByAgent = new Map(steps.map((s, i) => [s.agentId, { ...s, index: i }]))
  const agents = run.agentDefinitions
  const nodeWidth = 220
  const nodeHeight = 96
  const gap = 56
  const cols = Math.ceil(Math.sqrt(agents.length))
  const nodes: Node[] = agents.map((a, i) => {
    const step = stepByAgent.get(a.id)
    const status = step?.status ?? 'pending'
    const col = i % cols
    const row = Math.floor(i / cols)
    return {
      id: a.id,
      type: 'agent',
      position: { x: col * (nodeWidth + gap), y: row * (nodeHeight + gap) },
      data: {
        label: humanizeId(a.id),
        rawId: a.id,
        status,
        prompt: a.prompt?.slice(0, 80) + (a.prompt?.length > 80 ? '…' : ''),
      },
    }
  })
  const edges: Edge[] = []
  for (const a of agents) {
    const dep = a.dependencies ?? (a.inputSource ? [a.inputSource] : [])
    for (const d of dep) {
      if (agents.some((x) => x.id === d)) {
        edges.push({
          id: `${d}-${a.id}`,
          source: d,
          target: a.id,
          type: 'nexus',
          animated: true,
          markerEnd: { type: MarkerType.ArrowClosed },
        })
      }
    }
    if (a.nextStep && agents.some((x) => x.id === a.nextStep)) {
      edges.push({
        id: `${a.id}-${a.nextStep}`,
        source: a.id,
        target: a.nextStep,
        type: 'nexus',
        animated: true,
        markerEnd: { type: MarkerType.ArrowClosed },
      })
    }
  }
  return { nodes, edges }
}

function AgentNode({ data }: { data: { label?: string; status?: string; prompt?: string } }) {
  const status = data.status ?? 'pending'
  const StatusIcon = status === 'complete' ? CheckCircle2 : status === 'failed' ? XCircle : status === 'running' ? Loader2 : Clock
  const statusLabel = status === 'complete' ? 'Done' : status === 'failed' ? 'Failed' : status === 'running' ? 'Running' : 'Pending'
  return (
    <div
      className={cn(
        'w-[200px] rounded-xl border-2 shadow-sm backdrop-blur-md px-4 py-3 transition-all duration-300',
        'bg-card border-border',
        status === 'running' && 'animate-pulse-ring-primary border-primary/50',
        status === 'complete' && 'animate-pulse-ring-success border-success/30',
        status === 'failed' && 'animate-pulse-ring-destructive border-destructive/30'
      )}
    >
      <Handle type="target" position={Position.Left} className="!w-2.5 !h-2.5 !border-2 !border-primary !bg-background" />
      <Handle type="source" position={Position.Right} className="!w-2.5 !h-2.5 !border-2 !border-primary !bg-background" />
      <div className="font-semibold text-sm text-foreground">{data.label}</div>
      <p className="text-xs text-muted-foreground line-clamp-2 mt-1 min-h-[2rem]">{data.prompt}</p>
      <div className="mt-2 flex items-center gap-2">
        <StatusIcon
          className={cn(
            'w-3.5 h-3.5 shrink-0',
            status === 'running' && 'animate-spin text-primary',
            status === 'complete' && 'text-success',
            status === 'failed' && 'text-destructive',
            status === 'pending' && 'text-muted-foreground'
          )}
        />
        <span
          className={cn(
            'text-xs font-medium',
            status === 'running' && 'text-primary',
            status === 'complete' && 'text-success',
            status === 'failed' && 'text-destructive',
            status === 'pending' && 'text-muted-foreground'
          )}
        >
          {statusLabel}
        </span>
      </div>
    </div>
  )
}

const nodeTypes = { agent: AgentNode }

function NexusEdge({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition }: EdgeProps) {
  const [path] = getBezierPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  })
  return (
    <g>
      <defs>
        <linearGradient id={`grad-${id}`} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.8} />
          <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0.2} />
        </linearGradient>
      </defs>
      <path
        d={path}
        fill="none"
        stroke={`url(#grad-${id})`}
        strokeWidth={1.5}
        strokeDasharray="6 4"
        className="nexus-edge-flow"
      />
    </g>
  )
}

const edgeTypes = { nexus: NexusEdge }

const TRUNCATE_LEN = 300

function FinalResultCard({ output }: { output: string }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const [displayContent, setDisplayContent] = useState<string>('')

  useEffect(() => {
    let parsed: unknown
    try {
      parsed = JSON.parse(output)
    } catch {
      setDisplayContent(output)
      return
    }
    if (typeof parsed === 'object' && parsed !== null) {
      const obj = parsed as Record<string, unknown>
      const primary = obj.raw ?? obj.text ?? obj.content ?? obj.output ?? obj.result
      if (typeof primary === 'string') {
        setDisplayContent(primary)
      } else {
        setDisplayContent(JSON.stringify(parsed, null, 2))
      }
    } else if (typeof parsed === 'string') {
      setDisplayContent(parsed)
    } else {
      setDisplayContent(JSON.stringify(parsed, null, 2))
    }
  }, [output])

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(displayContent || output)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const handleExpandToggle = (e: React.MouseEvent) => {
    e.stopPropagation()
    e.preventDefault()
    setExpanded((prev) => !prev)
  }

  const isLong = displayContent.length > TRUNCATE_LEN
  const showContent = isLong && !expanded ? displayContent.slice(0, TRUNCATE_LEN) + '…' : displayContent

  return (
    <div className="rounded-xl border-2 border-success/30 bg-success/5 overflow-hidden mt-4 shadow-md">
      <div className="flex items-center justify-between px-4 py-3 bg-success/10 border-b border-success/20">
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-5 h-5 text-success shrink-0" />
          <p className="text-sm font-semibold text-foreground">Final Result</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleCopy}
            className="px-2 py-1.5 rounded-md hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5"
            title="Copy to clipboard"
          >
            {copied ? <Check className="w-4 h-4 text-success" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          {isLong && (
            <button
              type="button"
              onClick={handleExpandToggle}
              className="px-2 py-1.5 rounded-md hover:bg-muted/80 transition-colors text-muted-foreground hover:text-foreground text-xs font-medium flex items-center gap-1.5"
              title={expanded ? 'Show less' : 'Show more'}
            >
              {expanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
              {expanded ? 'Less' : 'More'}
            </button>
          )}
        </div>
      </div>
      <div className={cn('p-4', isLong && !expanded ? 'max-h-32 overflow-hidden' : 'max-h-[400px] overflow-y-auto')}>
        <pre
          className="text-sm font-mono text-foreground whitespace-pre-wrap break-words leading-relaxed"
          style={{ fontFamily: "'JetBrains Mono', ui-monospace, monospace" }}
        >
          {showContent}
        </pre>
      </div>
    </div>
  )
}

function JsonBlock({ label, data, maxHeight = 120, defaultExpanded = false }: { label: string; data: Record<string, unknown>; maxHeight?: number; defaultExpanded?: boolean }) {
  const [copied, setCopied] = useState(false)
  const [expanded, setExpanded] = useState(defaultExpanded)
  const str = JSON.stringify(data, null, 2)
  const isLong = str.length > 500
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation()
    navigator.clipboard.writeText(str)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }
  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <div className="flex items-center gap-2">
          {isLong && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setExpanded((p) => !p) }}
              className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
            >
              {expanded ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
              {expanded ? 'Less' : 'More'}
            </button>
          )}
          <button
            type="button"
            onClick={handleCopy}
            className="text-xs text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
          >
            {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
        </div>
      </div>
      <pre
        className="text-xs bg-muted/50 rounded-lg p-3 overflow-x-auto font-mono text-foreground overflow-y-auto border border-border/50"
        style={{
          maxHeight: expanded ? 320 : maxHeight,
          fontFamily: "'JetBrains Mono', ui-monospace, monospace",
          lineHeight: 1.5,
        }}
      >
        {str}
      </pre>
    </div>
  )
}

function TraceStepCard({
  step,
  index,
  isExpanded,
  onToggle,
}: {
  step: AgentStep
  index: number
  isExpanded: boolean
  onToggle: () => void
}) {
  const status = step.status
  const StatusIcon = status === 'complete' ? CheckCircle2 : status === 'failed' ? XCircle : status === 'running' ? Loader2 : Clock
  const hasDetails = (step.input && Object.keys(step.input).length > 0) || (step.output && Object.keys(step.output).length > 0) || step.error
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden shadow-sm transition-shadow hover:shadow-md">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/30 transition-colors rounded-xl"
      >
        <span className="flex items-center justify-center w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-bold shrink-0">
          {index + 1}
        </span>
        <span className="font-medium text-sm text-foreground flex-1 truncate">{humanizeId(step.agentId)}</span>
        <StatusIcon
          className={cn(
            'w-4 h-4 shrink-0',
            status === 'running' && 'animate-spin text-primary',
            status === 'complete' && 'text-success',
            status === 'failed' && 'text-destructive',
            status === 'pending' && 'text-muted-foreground'
          )}
        />
        {hasDetails && (isExpanded ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />)}
      </button>
      {isExpanded && hasDetails && (
        <div className="px-3 pb-3 pt-0 space-y-3 border-t border-border">
          {step.input && Object.keys(step.input).length > 0 && (
            <JsonBlock label="Input" data={step.input} maxHeight={100} />
          )}
          {step.output && Object.keys(step.output).length > 0 && (
            <JsonBlock label="Output" data={step.output} maxHeight={140} defaultExpanded={false} />
          )}
          {step.error && (
            <div>
              <p className="text-xs font-medium text-destructive mb-1">Error</p>
              <p className="text-xs text-destructive bg-destructive/10 rounded-lg p-3 border border-destructive/20">{step.error}</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default function NexusArchitectPage({ currentView, onNavigate }: NexusArchitectPageProps) {
  const { llmProvider } = useUserData()
  const { confirm } = useConfirm()
  const [isConnected] = useState(socket.connected)
  const [userGoal, setUserGoal] = useState('')
  const [runs, setRuns] = useState<AgentRunSummary[]>([])
  const [selectedRun, setSelectedRun] = useState<AgentRunDetail | null>(null)
  const [analytics, setAnalytics] = useState<AgentAnalytics[]>([])
  const [isCreating, setIsCreating] = useState(false)
  const [isDesigning, setIsDesigning] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [historyOpen, setHistoryOpen] = useState(true)
  const [expandedTraceSteps, setExpandedTraceSteps] = useState<Set<number>>(new Set())
  const [expandAllSteps, setExpandAllSteps] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [rerunningId, setRerunningId] = useState<string | null>(null)
  const [fullScreenTraceOpen, setFullScreenTraceOpen] = useState(false)

  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildFlowFromRun(selectedRun), [selectedRun])
  const [nodes, setNodes, onNodesChange] = useNodesState(initialNodes)
  const [edges, setEdges, onEdgesChange] = useEdgesState(initialEdges)

  useEffect(() => {
    setNodes(initialNodes)
    setEdges(initialEdges)
  }, [initialNodes, initialEdges, setNodes, setEdges])

  const loadRuns = useCallback(async () => {
    try {
      const data = await listAgentRuns()
      setRuns(data)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load runs')
    }
  }, [])

  const loadRunDetail = useCallback(async (id: string) => {
    try {
      const data = await getAgentRun(id)
      setSelectedRun(data)
      return data
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load run')
      return null
    }
  }, [])

  useEffect(() => {
    if (currentView === 'agent-architect') {
      loadRuns()
      getAgentAnalytics().then(setAnalytics).catch(() => setAnalytics([]))
    }
  }, [currentView, loadRuns])

  useEffect(() => {
    if (!selectedRun?.id) return
    const status = selectedRun.status
    if (status !== 'designing' && status !== 'running') return
    const t = setInterval(() => loadRunDetail(selectedRun.id), POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [selectedRun?.id, selectedRun?.status, loadRunDetail])

  const handleRun = async () => {
    if (!userGoal.trim()) return
    setError(null)
    setIsCreating(true)
    try {
      const created = await createAgentRun(userGoal.trim(), llmProvider)
      setRuns((prev) => [{ ...created, createdAt: created.createdAt ?? new Date().toISOString() }, ...prev])
      await executeAgentRun(created.id, llmProvider)
      await loadRunDetail(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDesign = async () => {
    if (!userGoal.trim()) return
    setError(null)
    setIsDesigning(true)
    try {
      const created = await createAgentRun(userGoal.trim(), llmProvider)
      setRuns((prev) => [{ ...created, createdAt: created.createdAt ?? new Date().toISOString() }, ...prev])
      await designAgentRun(created.id)
      await loadRunDetail(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to design')
    } finally {
      setIsDesigning(false)
    }
  }

  const toggleTraceStep = (idx: number) => {
    setExpandedTraceSteps((prev) => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx)
      else next.add(idx)
      return next
    })
  }

  const handleExpandAllSteps = () => {
    if (expandAllSteps) {
      setExpandedTraceSteps(new Set())
    } else if (selectedRun?.steps?.length) {
      setExpandedTraceSteps(new Set(selectedRun.steps.map((_, i) => i)))
    }
    setExpandAllSteps((p) => !p)
  }

  const handleDeleteRun = async (e: React.MouseEvent, runId: string) => {
    e.stopPropagation()
    const ok = await confirm({
      title: 'Delete run?',
      description: 'This cannot be undone.',
      confirmLabel: 'Delete',
      cancelLabel: 'Cancel',
      variant: 'destructive',
    })
    if (!ok) return
    setError(null)
    setDeletingId(runId)
    try {
      await deleteAgentRun(runId)
      setRuns((prev) => prev.filter((r) => r.id !== runId))
      if (selectedRun?.id === runId) setSelectedRun(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setDeletingId(null)
    }
  }

  const handleRerun = async (e: React.MouseEvent, runId: string) => {
    e.stopPropagation()
    setError(null)
    setRerunningId(runId)
    try {
      await executeAgentRun(runId, llmProvider)
      await loadRunDetail(runId)
      loadRuns()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rerun')
    } finally {
      setRerunningId(null)
    }
  }

  const totalCost = useMemo(() => {
    if (!selectedRun?.steps) return 0
    return selectedRun.steps.reduce((sum, s) => sum + (s.costUsd ?? 0), 0)
  }, [selectedRun?.steps])

  return (
    <AppLayout currentView={currentView} onNavigate={onNavigate} isConnected={isConnected}>
      <div className="flex flex-col h-full overflow-hidden bg-background">
        {/* Command bar */}
        <div className="shrink-0 px-4 pt-6 pb-4">
          <div className="max-w-2xl mx-auto">
            <h2 className="text-lg font-semibold text-foreground mb-1">Nexus Architect</h2>
            <p className="text-sm text-muted-foreground mb-4">
              Describe what you want to achieve. AI agents will design and run a workflow for you.
            </p>
            <div className="relative group">
              <div className="absolute -inset-0.5 rounded-xl opacity-60 group-focus-within:opacity-100 transition-opacity nexus-gradient-border" />
              <div className="relative flex rounded-xl overflow-hidden bg-background border border-input">
                <input
                  type="text"
                  placeholder="e.g. Create a chatbot for customer support..."
                  value={userGoal}
                  onChange={(e) => setUserGoal(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleRun()}
                  disabled={isCreating || isDesigning}
                  className="flex-1 bg-transparent px-4 py-3.5 text-foreground placeholder:text-muted-foreground text-base outline-none"
                />
                <div className="flex shrink-0 border-l border-border">
                  <button
                    type="button"
                    onClick={handleDesign}
                    disabled={!userGoal.trim() || isCreating || isDesigning}
                    className="px-4 py-3 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 text-sm"
                    title="Design workflow first, then run"
                  >
                    {isDesigning ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileEdit className="w-4 h-4" />}
                    Design
                  </button>
                  <button
                    type="button"
                    onClick={handleRun}
                    disabled={!userGoal.trim() || isCreating || isDesigning}
                    className="px-5 py-3 flex items-center gap-2 text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed rounded-r-xl"
                    title="Design and run in one step"
                  >
                    {isCreating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                    Run
                  </button>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap gap-2 mt-2">
              {EXAMPLE_GOALS.map((ex) => (
                <button
                  key={ex}
                  type="button"
                  onClick={() => setUserGoal(ex)}
                  className="text-xs px-2.5 py-1.5 rounded-md bg-muted/60 hover:bg-muted text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1.5"
                >
                  <Sparkles className="w-3 h-3" />
                  {ex}
                </button>
              ))}
            </div>
          </div>
        </div>
        {error && <p className="text-center text-sm text-destructive mb-2 px-4">{error}</p>}

        {/* Main layout */}
        <div className="flex-1 flex min-h-0">
          {/* Left sidebar */}
          <aside
            className={cn(
              'shrink-0 border-r border-border flex flex-col transition-all duration-300 overflow-hidden bg-card/80 backdrop-blur-sm',
              historyOpen ? 'w-56' : 'w-12'
            )}
          >
            <button
              type="button"
              onClick={() => setHistoryOpen(!historyOpen)}
              className="flex items-center gap-2 px-3 py-2.5 text-muted-foreground hover:text-foreground hover:bg-muted/50 text-sm"
            >
              <ChevronRight className={cn('w-4 h-4 transition-transform', historyOpen && 'rotate-90')} />
              {historyOpen && <span>Project History</span>}
            </button>
            {historyOpen && (
              <>
                <div className="flex-1 overflow-y-auto p-2 space-y-1">
                  {runs.length === 0 ? (
                    <div className="rounded-lg border border-dashed border-border p-4 text-center">
                      <p className="text-xs text-muted-foreground">No runs yet</p>
                      <p className="text-xs text-muted-foreground mt-1">Create one with Run or Design</p>
                    </div>
                  ) : (
                    runs.map((r) => (
                      <div
                        key={r.id}
                        className={cn(
                          'group rounded-lg transition-colors',
                          selectedRun?.id === r.id ? 'bg-accent' : 'hover:bg-muted/50'
                        )}
                      >
                        <button
                          type="button"
                          onClick={() => loadRunDetail(r.id)}
                          className={cn(
                            'w-full text-left px-3 py-2.5 rounded-lg',
                            selectedRun?.id === r.id ? 'text-accent-foreground' : ''
                          )}
                        >
                          <span className="block truncate text-sm font-medium text-foreground">{r.projectName}</span>
                          <span
                            className={cn(
                              'text-xs',
                              r.status === 'complete' && 'text-success',
                              r.status === 'failed' && 'text-destructive',
                              (r.status === 'running' || r.status === 'designing') && 'text-primary',
                              r.status === 'draft' && 'text-muted-foreground'
                            )}
                          >
                            {r.status}
                          </span>
                        </button>
                        <div className="flex items-center gap-0.5 px-2 pb-2">
                          <button
                            type="button"
                            onClick={(e) => handleRerun(e, r.id)}
                            disabled={(r.status === 'running' || r.status === 'designing') || rerunningId !== null}
                            className="p-1.5 rounded hover:bg-muted/80 text-muted-foreground hover:text-foreground disabled:opacity-50 disabled:cursor-not-allowed"
                            title={r.status === 'failed' ? 'Rerun' : 'Run again'}
                          >
                            {rerunningId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <RotateCw className="w-3.5 h-3.5" />}
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDeleteRun(e, r.id)}
                            disabled={deletingId !== null}
                            className="p-1.5 rounded hover:bg-destructive/20 text-muted-foreground hover:text-destructive disabled:opacity-50 disabled:cursor-not-allowed"
                            title="Delete"
                          >
                            {deletingId === r.id ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Trash2 className="w-3.5 h-3.5" />}
                          </button>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                {/* Token Burn widget */}
                <div className="p-3 border-t border-border">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                    <Flame className="w-3.5 h-3.5" />
                    Token Burn
                  </div>
                  <div className="space-y-1.5">
                    {analytics.slice(0, 5).map((a) => (
                      <div key={a.agentId} className="flex justify-between text-xs">
                        <span className="text-foreground truncate max-w-[80px]">{a.agentId}</span>
                        <span className="text-muted-foreground">${a.avgCostUsd}</span>
                      </div>
                    ))}
                    {selectedRun && totalCost > 0 && (
                      <div className="pt-1.5 mt-1.5 border-t border-border flex justify-between text-xs font-medium text-foreground">
                        <span>This run</span>
                        <span>${totalCost.toFixed(4)}</span>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}
          </aside>

          {/* Canvas */}
          <div className="flex-1 min-w-0 relative bg-background">
            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              fitView
              fitViewOptions={{ padding: 0.2 }}
              minZoom={0.2}
              maxZoom={2}
              proOptions={{ hideAttribution: true }}
              className="nexus-react-flow"
            >
              <Background color="hsl(var(--border))" gap={24} size={0.5} />
              <Controls className="nexus-controls" />
            </ReactFlow>
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-3">
                <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                  <Sparkles className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground text-sm font-medium">No workflow yet</p>
                <p className="text-muted-foreground text-xs max-w-[240px] text-center">
                  Enter a goal above and click Run or Design to see your agent workflow
                </p>
              </div>
            )}
          </div>

          {/* Right sidebar - Execution Trace */}
          <aside className="w-[420px] shrink-0 border-l border-border flex flex-col overflow-hidden bg-card/60">
            <div className="px-4 py-3.5 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Execution Trace</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">Step-by-step progress of your workflow</p>
                </div>
                {selectedRun && (selectedRun.steps?.length > 0 || selectedRun.finalOutput) && (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setFullScreenTraceOpen(true)}
                      className="text-xs px-2 py-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                      title="Full screen view"
                    >
                      <Expand className="w-3.5 h-3.5" />
                      Full screen
                    </button>
                    <button
                      type="button"
                      onClick={handleExpandAllSteps}
                      className="text-xs px-2 py-1 rounded-md hover:bg-muted/80 text-muted-foreground hover:text-foreground transition-colors flex items-center gap-1"
                    >
                      {expandAllSteps ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                      {expandAllSteps ? 'Collapse all' : 'Expand all'}
                    </button>
                  </div>
                )}
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-2">
              {selectedRun && (
                <div className="rounded-xl border border-border bg-gradient-to-br from-muted/40 to-muted/20 p-3.5 mb-2 shadow-sm">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Goal</p>
                  <p className="text-sm text-foreground mt-1 line-clamp-2 leading-relaxed">{selectedRun.userGoal}</p>
                  <div className="flex items-center gap-2 mt-2.5 flex-wrap">
                    <span
                      className={cn(
                        'text-xs font-medium px-2.5 py-1 rounded-md',
                        selectedRun.status === 'complete' && 'bg-success/20 text-success',
                        selectedRun.status === 'failed' && 'bg-destructive/20 text-destructive',
                        (selectedRun.status === 'running' || selectedRun.status === 'designing') && 'bg-primary/20 text-primary',
                        selectedRun.status === 'draft' && 'bg-muted text-muted-foreground'
                      )}
                    >
                      {selectedRun.status}
                    </span>
                    {totalCost > 0 && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <Flame className="w-3 h-3" />
                        ${totalCost.toFixed(4)}
                      </span>
                    )}
                  </div>
                </div>
              )}
              {!selectedRun ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <p className="text-sm text-muted-foreground">Select a run or create one to see the trace</p>
                </div>
              ) : !selectedRun.steps?.length ? (
                <div className="rounded-lg border border-dashed border-border p-6 text-center">
                  <Loader2 className="w-8 h-8 mx-auto text-muted-foreground animate-spin mb-2" />
                  <p className="text-sm text-muted-foreground">
                    {selectedRun.status === 'designing' || selectedRun.status === 'running' ? 'Running workflow...' : 'No steps yet'}
                  </p>
                </div>
              ) : (
                <>
                  {selectedRun.steps.map((step, i) => (
                    <TraceStepCard
                      key={`${step.agentId}-${i}`}
                      step={step}
                      index={i}
                      isExpanded={expandedTraceSteps.has(i)}
                      onToggle={() => toggleTraceStep(i)}
                    />
                  ))}
                  {selectedRun.finalOutput && <FinalResultCard output={selectedRun.finalOutput} />}
                  {selectedRun.error && (
                    <div className="rounded-lg border border-destructive/50 bg-destructive/10 p-3 mt-2">
                      <p className="text-xs font-semibold text-destructive mb-1">Error</p>
                      <p className="text-xs text-destructive">{selectedRun.error}</p>
                    </div>
                  )}
                </>
              )}
            </div>
          </aside>
        </div>
      </div>

      {/* Full screen trace dialog */}
      <Dialog open={fullScreenTraceOpen} onOpenChange={setFullScreenTraceOpen}>
        <DialogContent className="max-w-4xl w-[95vw] max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden [&>button]:right-4 [&>button]:top-4">
          <DialogHeader className="px-6 py-4 border-b border-border shrink-0">
            <DialogTitle className="text-base">
              {selectedRun?.projectName ?? 'Execution Trace'} — Full view
            </DialogTitle>
            {selectedRun?.userGoal && (
              <p className="text-sm text-muted-foreground mt-1">{selectedRun.userGoal}</p>
            )}
          </DialogHeader>
          <div className="flex-1 overflow-y-auto p-6 space-y-6">
            {selectedRun?.steps?.map((step, i) => (
              <div key={`${step.agentId}-${i}`} className="rounded-xl border border-border bg-card overflow-hidden">
                <div className="px-4 py-3 bg-muted/30 border-b border-border flex items-center gap-3">
                  <span className="flex items-center justify-center w-8 h-8 rounded-lg bg-primary/10 text-primary text-sm font-bold">
                    {i + 1}
                  </span>
                  <span className="font-semibold text-foreground">{humanizeId(step.agentId)}</span>
                  <span
                    className={cn(
                      'text-xs font-medium px-2 py-0.5 rounded',
                      step.status === 'complete' && 'bg-success/20 text-success',
                      step.status === 'failed' && 'bg-destructive/20 text-destructive',
                      step.status === 'running' && 'bg-primary/20 text-primary',
                      step.status === 'pending' && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {step.status}
                  </span>
                </div>
                <div className="p-4 space-y-4">
                  {step.input && Object.keys(step.input).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Input</p>
                      <pre className="text-sm bg-muted/50 rounded-lg p-4 overflow-x-auto font-mono text-foreground whitespace-pre-wrap break-words max-h-48 overflow-y-auto" style={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                        {JSON.stringify(step.input, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.output && Object.keys(step.output).length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider mb-2">Output</p>
                      <pre className="text-sm bg-muted/50 rounded-lg p-4 overflow-x-auto font-mono text-foreground whitespace-pre-wrap break-words max-h-64 overflow-y-auto" style={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                        {JSON.stringify(step.output, null, 2)}
                      </pre>
                    </div>
                  )}
                  {step.error && (
                    <div>
                      <p className="text-xs font-medium text-destructive uppercase tracking-wider mb-2">Error</p>
                      <p className="text-sm text-destructive bg-destructive/10 rounded-lg p-4">{step.error}</p>
                    </div>
                  )}
                </div>
              </div>
            ))}
            {selectedRun?.finalOutput && (
              <div className="rounded-xl border-2 border-success/30 bg-success/5 overflow-hidden">
                <div className="px-4 py-3 bg-success/10 border-b border-success/20 flex items-center gap-2">
                  <CheckCircle2 className="w-5 h-5 text-success" />
                  <p className="font-semibold text-foreground">Final Result</p>
                </div>
                <pre className="p-4 text-sm font-mono text-foreground whitespace-pre-wrap break-words max-h-96 overflow-y-auto" style={{ fontFamily: "'JetBrains Mono', monospace", lineHeight: 1.6 }}>
                  {(() => {
                    try {
                      const parsed = JSON.parse(selectedRun.finalOutput)
                      const primary = parsed?.raw ?? parsed?.text ?? parsed?.content ?? parsed?.output ?? parsed?.result
                      return typeof primary === 'string' ? primary : selectedRun.finalOutput
                    } catch {
                      return selectedRun.finalOutput
                    }
                  })()}
                </pre>
              </div>
            )}
            {selectedRun?.error && (
              <div className="rounded-xl border border-destructive/50 bg-destructive/10 p-4">
                <p className="text-sm font-semibold text-destructive mb-2">Run Error</p>
                <p className="text-sm text-destructive">{selectedRun.error}</p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <style>{`
        .nexus-gradient-border {
          background: linear-gradient(90deg, hsl(var(--primary)), hsl(var(--ring)), hsl(var(--primary)));
          background-size: 200% 200%;
          animation: nexus-gradient 3s ease infinite;
        }
        @keyframes nexus-gradient {
          0%, 100% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
        }
        @keyframes nexus-dash {
          to { stroke-dashoffset: -10; }
        }
        .nexus-edge-flow {
          animation: nexus-dash 1s linear infinite;
        }
        .animate-pulse-ring-primary {
          box-shadow: 0 0 0 1px hsl(var(--primary) / 0.4), 0 0 12px hsl(var(--primary) / 0.3);
          animation: pulse-ring-primary 1.5s ease-in-out infinite;
        }
        .animate-pulse-ring-success {
          box-shadow: 0 0 0 1px hsl(var(--success) / 0.4), 0 0 12px hsl(var(--success) / 0.3);
        }
        .animate-pulse-ring-destructive {
          box-shadow: 0 0 0 1px hsl(var(--destructive) / 0.4), 0 0 12px hsl(var(--destructive) / 0.3);
        }
        @keyframes pulse-ring-primary {
          0%, 100% { box-shadow: 0 0 0 1px hsl(var(--primary) / 0.4), 0 0 12px hsl(var(--primary) / 0.3); }
          50% { box-shadow: 0 0 0 3px hsl(var(--primary) / 0.2), 0 0 20px hsl(var(--primary) / 0.4); }
        }
        .nexus-react-flow { background: hsl(var(--background)) !important; }
        .nexus-controls button {
          background: hsl(var(--muted)) !important;
          color: hsl(var(--foreground)) !important;
          border-color: hsl(var(--border)) !important;
        }
        .nexus-controls button:hover {
          background: hsl(var(--accent)) !important;
        }
      `}</style>
    </AppLayout>
  )
}
