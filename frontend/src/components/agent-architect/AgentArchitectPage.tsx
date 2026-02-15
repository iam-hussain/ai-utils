import { useState, useEffect, useCallback } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { useUserData } from '@/contexts/UserDataContext'
import {
  listAgentRuns,
  getAgentRun,
  listGhostRuns,
  getAgentAnalytics,
  createAgentRun,
  executeAgentRun,
  designAgentRun,
  updateAgentDefinitions,
  resumeAgentRun,
  forkAgentRun,
  createGhostRun,
  promoteGhostToLive,
  runCritic,
  updateAgentRunTitle,
  generateAgentRunTitle,
  type AgentRunSummary,
  type AgentRunDetail,
  type AgentStep,
  type AgentAnalytics,
  type AgentDefinition,
} from '@/lib/agent-runs-api'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from '@/components/ui/dialog'
import { ChevronDown, ChevronRight, Loader2, Zap, GitFork, Ghost, ArrowUp, AlertTriangle, Pencil, Sparkles, FileEdit, CheckCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

interface AgentArchitectPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

const POLL_INTERVAL_MS = 1500

export default function AgentArchitectPage({ currentView, onNavigate }: AgentArchitectPageProps) {
  const { llmProvider } = useUserData()
  const [isConnected] = useState(socket.connected)
  const [userGoal, setUserGoal] = useState('')
  const [pauseBeforeStep, setPauseBeforeStep] = useState<number | ''>('')
  const [runs, setRuns] = useState<AgentRunSummary[]>([])
  const [selectedRun, setSelectedRun] = useState<AgentRunDetail | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expandedSteps, setExpandedSteps] = useState<Set<string>>(new Set())
  const [forkDialog, setForkDialog] = useState<{
    stepIndex: number
    agentId: string
    agentPrompt: string
    runId: string
  } | null>(null)
  const [isForking, setIsForking] = useState(false)
  const [ghostDialog, setGhostDialog] = useState<{ runId: string; agents: { id: string; prompt: string }[] } | null>(null)
  const [ghostRuns, setGhostRuns] = useState<AgentRunDetail[]>([])
  const [isGhosting, setIsGhosting] = useState(false)
  const [isRunningCritic, setIsRunningCritic] = useState(false)
  const [analytics, setAnalytics] = useState<AgentAnalytics[]>([])
  const [resumeHint, setResumeHint] = useState('')
  const [isResuming, setIsResuming] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false)
  const [titleEdit, setTitleEdit] = useState('')
  const [isSavingTitle, setIsSavingTitle] = useState(false)
  const [isGeneratingTitle, setIsGeneratingTitle] = useState(false)
  const [isDesigning, setIsDesigning] = useState(false)
  const [editingAgents, setEditingAgents] = useState<AgentDefinition[] | null>(null)
  const [isSavingAgents, setIsSavingAgents] = useState(false)

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
    if (!selectedRun?.id || selectedRun.ghostOfRunId) return
    listGhostRuns(selectedRun.id)
      .then((ids) => Promise.all(ids.map((g) => getAgentRun(g.id))))
      .then(setGhostRuns)
      .catch(() => setGhostRuns([]))
  }, [selectedRun?.id, selectedRun?.ghostOfRunId])

  useEffect(() => {
    if (!selectedRun?.id) return
    const status = selectedRun.status
    if (status !== 'designing' && status !== 'running') return
    const t = setInterval(() => loadRunDetail(selectedRun.id), POLL_INTERVAL_MS)
    return () => clearInterval(t)
  }, [selectedRun?.id, selectedRun?.status, loadRunDetail])

  useEffect(() => {
    if (selectedRun?.status === 'draft' && selectedRun.agentDefinitions?.length) {
      setEditingAgents(selectedRun.agentDefinitions)
    } else {
      setEditingAgents(null)
    }
  }, [selectedRun?.status, selectedRun?.agentDefinitions])

  useEffect(() => {
    if (selectedRun?.status === 'complete' || selectedRun?.status === 'failed') {
      getAgentAnalytics().then(setAnalytics).catch(() => { })
    }
  }, [selectedRun?.status])

  const handleCreateAndRun = async () => {
    if (!userGoal.trim()) return
    setError(null)
    setIsCreating(true)
    try {
      const created = await createAgentRun(userGoal.trim(), llmProvider)
      setRuns((prev) => [{ ...created, createdAt: created.createdAt ?? new Date().toISOString() }, ...prev])
      const breakpoints =
        typeof pauseBeforeStep === 'number' && pauseBeforeStep >= 0
          ? [{ type: 'pause_before_step' as const, stepIndex: pauseBeforeStep }]
          : undefined
      await executeAgentRun(created.id, llmProvider, { breakpoints })
      await loadRunDetail(created.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create/execute')
    } finally {
      setIsCreating(false)
    }
  }

  const handleDesignOnly = async () => {
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

  const handleGreenlight = async () => {
    if (!selectedRun?.id) return
    setError(null)
    setIsCreating(true)
    try {
      const breakpoints =
        typeof pauseBeforeStep === 'number' && pauseBeforeStep >= 0
          ? [{ type: 'pause_before_step' as const, stepIndex: pauseBeforeStep }]
          : undefined
      await executeAgentRun(selectedRun.id, llmProvider, { breakpoints })
      await loadRunDetail(selectedRun.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to execute')
    } finally {
      setIsCreating(false)
    }
  }

  const handleSaveAgentDefinitions = async () => {
    if (!selectedRun?.id || !editingAgents?.length) return
    setError(null)
    setIsSavingAgents(true)
    try {
      const { agentDefinitions } = await updateAgentDefinitions(selectedRun.id, editingAgents)
      setSelectedRun((prev) => (prev ? { ...prev, agentDefinitions } : null))
      setRuns((prev) => prev.map((r) => (r.id === selectedRun.id ? { ...r } : r)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update agents')
    } finally {
      setIsSavingAgents(false)
    }
  }

  const handleForkClick = (stepIndex: number, agentId: string, agentPrompt: string) => {
    if (!selectedRun?.id) return
    setForkDialog({ stepIndex, agentId, agentPrompt, runId: selectedRun.id })
  }

  const handleForkConfirm = async (editedPrompt?: string) => {
    if (!forkDialog || !selectedRun) return
    setError(null)
    setIsForking(true)
    try {
      const forked = await forkAgentRun(forkDialog.runId, {
        stepIndex: forkDialog.stepIndex,
        editedAgentId: editedPrompt ? forkDialog.agentId : undefined,
        editedPrompt: editedPrompt || undefined,
      })
      setRuns((prev) => [{ ...forked, createdAt: forked.createdAt ?? new Date().toISOString() }, ...prev])
      await executeAgentRun(forked.id, llmProvider, {
        editedAgentId: editedPrompt ? forkDialog.agentId : undefined,
        editedPrompt: editedPrompt || undefined,
      })
      setForkDialog(null)
      await loadRunDetail(forked.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fork')
    } finally {
      setIsForking(false)
    }
  }

  const handleGhostClick = () => {
    if (!selectedRun?.id || !selectedRun.agentDefinitions?.length) return
    setGhostDialog({
      runId: selectedRun.id,
      agents: selectedRun.agentDefinitions.map((a) => ({ id: a.id, prompt: a.prompt })),
    })
  }

  const handleGhostConfirm = async (agentId: string, newPrompt: string) => {
    if (!ghostDialog || !selectedRun) return
    setError(null)
    setIsGhosting(true)
    try {
      const ghost = await createGhostRun(ghostDialog.runId, agentId, newPrompt)
      setRuns((prev) => [{ ...ghost, createdAt: ghost.createdAt ?? new Date().toISOString() }, ...prev])
      await executeAgentRun(ghost.id, llmProvider)
      setGhostDialog(null)
      const fullGhost = await getAgentRun(ghost.id)
      setGhostRuns((prev) => [fullGhost, ...prev])
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to create ghost')
    } finally {
      setIsGhosting(false)
    }
  }

  const handleResume = async () => {
    if (!selectedRun?.id) return
    setError(null)
    setIsResuming(true)
    try {
      await resumeAgentRun(selectedRun.id, resumeHint.trim() || 'Continue.')
      setResumeHint('')
      await loadRunDetail(selectedRun.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to resume')
    } finally {
      setIsResuming(false)
    }
  }

  const handleSaveTitle = async () => {
    if (!selectedRun?.id || !titleEdit.trim()) {
      setEditingTitle(false)
      return
    }
    setIsSavingTitle(true)
    try {
      await updateAgentRunTitle(selectedRun.id, titleEdit.trim())
      setSelectedRun((prev) => (prev ? { ...prev, projectName: titleEdit.trim() } : null))
      setRuns((prev) => prev.map((r) => (r.id === selectedRun.id ? { ...r, projectName: titleEdit.trim() } : r)))
      setEditingTitle(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to update title')
    } finally {
      setIsSavingTitle(false)
    }
  }

  const handleGenerateTitle = async () => {
    if (!selectedRun?.id) return
    setIsGeneratingTitle(true)
    try {
      const { projectName } = await generateAgentRunTitle(selectedRun.id)
      setSelectedRun((prev) => (prev ? { ...prev, projectName } : null))
      setRuns((prev) => prev.map((r) => (r.id === selectedRun.id ? { ...r, projectName } : r)))
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to generate title')
    } finally {
      setIsGeneratingTitle(false)
    }
  }

  const handleRunCritic = async () => {
    if (!selectedRun?.id) return
    setError(null)
    setIsRunningCritic(true)
    try {
      await runCritic(selectedRun.id)
      await loadRunDetail(selectedRun.id)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to run critic')
    } finally {
      setIsRunningCritic(false)
    }
  }

  const handlePromoteGhost = async (ghostId: string) => {
    if (!selectedRun?.id) return
    try {
      await promoteGhostToLive(selectedRun.id, ghostId)
      await loadRunDetail(selectedRun.id)
      loadRuns()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to promote')
    }
  }

  const toggleStep = (agentId: string) => {
    setExpandedSteps((prev) => {
      const next = new Set(prev)
      if (next.has(agentId)) next.delete(agentId)
      else next.add(agentId)
      return next
    })
  }

  const statusColor = (status: string) => {
    switch (status) {
      case 'complete':
        return 'text-success'
      case 'failed':
      case 'paused':
        return 'text-destructive'
      case 'running':
      case 'designing':
        return 'text-primary'
      case 'draft':
        return 'text-accent-foreground'
      default:
        return 'text-muted-foreground'
    }
  }

  return (
    <AppLayout currentView={currentView} onNavigate={onNavigate} isConnected={isConnected}>
      <div className="flex flex-col h-full overflow-hidden">
        <div className="p-4 border-b shrink-0">
          <h1 className="text-lg font-semibold text-foreground mb-3">Agent Architect</h1>
          <p className="text-sm text-muted-foreground mb-3">
            Describe your goal. The Meta-Agent will design a team of specialized agents. Use Design to review the plan
            before execution, or Run to design and execute in one step.
          </p>
          <div className="flex gap-2">
            <textarea
              className="flex-1 min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring resize-y"
              placeholder="e.g. Analyze this CSV and produce a summary report with charts..."
              value={userGoal}
              onChange={(e) => setUserGoal(e.target.value)}
              disabled={isCreating || isDesigning}
            />
            <div className="flex flex-col gap-1 shrink-0">
              <label className="text-xs text-muted-foreground">Pause before step (optional)</label>
              <input
                type="number"
                min={0}
                className="w-20 rounded border border-input bg-background px-2 py-1 text-sm"
                placeholder="—"
                value={pauseBeforeStep}
                onChange={(e) => setPauseBeforeStep(e.target.value === '' ? '' : parseInt(e.target.value, 10))}
                disabled={isCreating || isDesigning}
              />
            </div>
            <Button
              variant="outline"
              onClick={handleDesignOnly}
              disabled={!userGoal.trim() || isCreating || isDesigning}
              className="shrink-0"
              title="Design workflow only (review before execution)"
            >
              {isDesigning ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <FileEdit className="w-4 h-4 mr-1.5" />
                  Design
                </>
              )}
            </Button>
            <Button
              onClick={handleCreateAndRun}
              disabled={!userGoal.trim() || isCreating || isDesigning}
              className="shrink-0"
            >
              {isCreating ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <>
                  <Zap className="w-4 h-4 mr-1.5" />
                  Run
                </>
              )}
            </Button>
          </div>
          {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
        </div>

        <div className="flex-1 flex min-h-0 overflow-hidden">
          <div className="w-64 shrink-0 border-r overflow-y-auto p-3">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-2">
              Recent runs
            </h3>
            {runs.length === 0 ? (
              <p className="text-sm text-muted-foreground">No runs yet</p>
            ) : (
              <ul className="space-y-1">
                {runs.map((r) => (
                  <li key={r.id}>
                    <button
                      type="button"
                      onClick={() => loadRunDetail(r.id)}
                      className={cn(
                        'w-full text-left px-2 py-1.5 rounded text-sm truncate',
                        selectedRun?.id === r.id
                          ? 'bg-accent text-accent-foreground'
                          : 'hover:bg-muted text-foreground'
                      )}
                    >
                      <span className="block truncate">{r.projectName}</span>
                      <span className={cn('text-xs', statusColor(r.status))}>{r.status}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-4">
            {!selectedRun ? (
              <p className="text-muted-foreground text-sm">Select a run or create a new one</p>
            ) : (
              <div className="space-y-4">
                <Card>
                  <CardHeader className="pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        {editingTitle ? (
                          <div className="flex items-center gap-2">
                            <input
                              className="flex-1 rounded border border-input bg-background px-2 py-1 text-base font-semibold"
                              value={titleEdit}
                              onChange={(e) => setTitleEdit(e.target.value)}
                              onBlur={handleSaveTitle}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveTitle()
                                if (e.key === 'Escape') {
                                  setTitleEdit(selectedRun.projectName)
                                  setEditingTitle(false)
                                }
                              }}
                              autoFocus
                              disabled={isSavingTitle}
                            />
                            <Button size="sm" variant="ghost" onClick={() => setEditingTitle(false)} disabled={isSavingTitle}>
                              Cancel
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 group">
                            <CardTitle className="text-base truncate">{selectedRun.projectName}</CardTitle>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                              onClick={() => {
                                setTitleEdit(selectedRun.projectName)
                                setEditingTitle(true)
                              }}
                              title="Edit title"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                            {(selectedRun.projectName === 'Untitled' || !selectedRun.projectName?.trim()) && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-7 text-xs"
                                onClick={handleGenerateTitle}
                                disabled={isGeneratingTitle}
                                title="Generate title with AI"
                              >
                                {isGeneratingTitle ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
                                Generate
                              </Button>
                            )}
                          </div>
                        )}
                        <p className="text-sm text-muted-foreground">{selectedRun.userGoal}</p>
                        <span className={cn('text-xs font-medium', statusColor(selectedRun.status))}>
                          {selectedRun.status}
                          {(selectedRun.status === 'running' || selectedRun.status === 'designing') && (
                            <Loader2 className="inline w-3 h-3 ml-1 animate-spin" />
                          )}
                          {selectedRun.status === 'draft' && (
                            <Button
                              size="sm"
                              className="ml-2"
                              onClick={handleGreenlight}
                              disabled={isCreating}
                              title="Execute the plan"
                            >
                              {isCreating ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <>
                                  <CheckCircle className="w-4 h-4 mr-1.5" />
                                  Run
                                </>
                              )}
                            </Button>
                          )}
                        </span>
                      </div>
                      {selectedRun.status === 'paused' && (
                        <div className="flex flex-col gap-2">
                          <textarea
                            className="min-h-[60px] w-48 rounded border border-input bg-background px-2 py-1 text-sm"
                            placeholder="Type a hint for the agent..."
                            value={resumeHint}
                            onChange={(e) => setResumeHint(e.target.value)}
                            disabled={isResuming}
                          />
                          <Button size="sm" onClick={handleResume} disabled={isResuming}>
                            {isResuming ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Resume with hint'}
                          </Button>
                        </div>
                      )}
                      {!selectedRun.ghostOfRunId &&
                        (selectedRun.status === 'complete' || selectedRun.status === 'failed') &&
                        selectedRun.agentDefinitions?.length && (
                          <>
                            <Button variant="outline" size="sm" onClick={handleRunCritic} disabled={isRunningCritic} title="Run fact-check critic">
                              {isRunningCritic ? <Loader2 className="w-4 h-4 animate-spin mr-1.5" /> : <AlertTriangle className="w-4 h-4 mr-1.5" />}
                              Run Critic
                            </Button>
                            <Button variant="outline" size="sm" onClick={handleGhostClick} title="Shadow test">
                              <Ghost className="w-4 h-4 mr-1.5" />
                              Shadow test
                            </Button>
                          </>
                        )}
                    </div>
                  </CardHeader>
                </Card>

                {selectedRun.status === 'draft' && selectedRun.missionBrief && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Mission Brief</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Strategic overview of the workflow. Review and edit agent prompts below before running.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {selectedRun.missionBrief.summary && (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Summary</h4>
                          <p className="text-sm">{selectedRun.missionBrief.summary}</p>
                        </div>
                      )}
                      {selectedRun.missionBrief.inputs?.length ? (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Inputs</h4>
                          <ul className="text-sm list-disc list-inside space-y-0.5">{selectedRun.missionBrief.inputs.map((i, idx) => <li key={idx}>{i}</li>)}</ul>
                        </div>
                      ) : null}
                      {selectedRun.missionBrief.stages?.length ? (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Stages</h4>
                          <ol className="text-sm list-decimal list-inside space-y-0.5">{selectedRun.missionBrief.stages.map((s, idx) => <li key={idx}>{s}</li>)}</ol>
                        </div>
                      ) : null}
                      {selectedRun.missionBrief.successCriteria?.length ? (
                        <div>
                          <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground mb-1">Success criteria</h4>
                          <ul className="text-sm list-disc list-inside space-y-0.5">{selectedRun.missionBrief.successCriteria.map((c, idx) => <li key={idx}>{c}</li>)}</ul>
                        </div>
                      ) : null}
                    </CardContent>
                  </Card>
                )}

                {selectedRun.status === 'draft' && editingAgents && editingAgents.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Agent prompts</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Edit agent prompts before execution. Click Save to apply changes.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      {editingAgents.map((agent, idx) => (
                        <div key={agent.id} className="space-y-1">
                          <label className="text-sm font-medium">{agent.id}</label>
                          <textarea
                            className="w-full min-h-[80px] rounded-lg border border-input bg-background px-3 py-2 text-sm font-mono resize-y"
                            value={agent.prompt}
                            onChange={(e) =>
                              setEditingAgents((prev) =>
                                prev ? prev.map((a, i) => (i === idx ? { ...a, prompt: e.target.value } : a)) : prev
                              )
                            }
                            disabled={isSavingAgents}
                          />
                        </div>
                      ))}
                      <Button size="sm" onClick={handleSaveAgentDefinitions} disabled={isSavingAgents}>
                        {isSavingAgents ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save changes'}
                      </Button>
                    </CardContent>
                  </Card>
                )}

                {!selectedRun.ghostOfRunId && ghostRuns.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Ghost runs (shadow tests)</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Compare live vs ghost outputs. Promote the ghost to replace the live agent prompt.
                      </p>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {ghostRuns.map((ghost) => (
                        <div
                          key={ghost.id}
                          className="rounded-lg border p-3 space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <span className="font-medium text-sm">{ghost.projectName}</span>
                            <span className={cn('text-xs', statusColor(ghost.status))}>{ghost.status}</span>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-xs">
                            <div>
                              <p className="text-muted-foreground mb-1">Live</p>
                              <pre className="bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono max-h-32">
                                {selectedRun.finalOutput ?? '(none)'}
                              </pre>
                            </div>
                            <div>
                              <p className="text-muted-foreground mb-1">Ghost</p>
                              <pre className="bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono max-h-32">
                                {ghost.finalOutput ?? ghost.error ?? '(running...)'}
                              </pre>
                            </div>
                          </div>
                          {ghost.status === 'complete' && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handlePromoteGhost(ghost.id)}
                              title="Promote ghost to live"
                            >
                              <ArrowUp className="w-4 h-4 mr-1.5" />
                              Promote to live
                            </Button>
                          )}
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {selectedRun.steps && selectedRun.steps.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Trace</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {selectedRun.steps.map((step, idx) => (
                        <StepCard
                          key={step.agentId}
                          step={step}
                          expanded={expandedSteps.has(step.agentId)}
                          onToggle={() => toggleStep(step.agentId)}
                          hasContradiction={!!(step.criticResult?.contradictions?.length)}
                          contradictionSeverity={step.criticResult?.severity}
                          onFork={
                            selectedRun.status === 'complete' || selectedRun.status === 'failed'
                              ? () => handleForkClick(idx, step.agentId, selectedRun.agentDefinitions?.[idx]?.prompt ?? '')
                              : undefined
                          }
                        />
                      ))}
                    </CardContent>
                  </Card>
                )}

                {selectedRun.finalOutput && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Final output</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <pre className="text-xs bg-muted/50 rounded p-3 overflow-x-auto whitespace-pre-wrap font-mono">
                        {selectedRun.finalOutput}
                      </pre>
                    </CardContent>
                  </Card>
                )}

                {selectedRun.error && (
                  <p className="text-sm text-destructive">{selectedRun.error}</p>
                )}

                {analytics.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Token burn analytics</CardTitle>
                      <p className="text-sm text-muted-foreground">
                        Per-agent success rate, avg cost, and speed across all runs
                      </p>
                    </CardHeader>
                    <CardContent>
                      <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b">
                              <th className="text-left py-2 font-medium">Agent ID</th>
                              <th className="text-left py-2 font-medium">Runs</th>
                              <th className="text-left py-2 font-medium">Success rate</th>
                              <th className="text-left py-2 font-medium">Avg cost</th>
                              <th className="text-left py-2 font-medium">Speed (sec)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {analytics.map((a) => (
                              <tr key={a.agentId} className="border-b">
                                <td className="py-2">{a.agentId}</td>
                                <td className="py-2">{a.totalRuns}</td>
                                <td className="py-2">{a.successRate}%</td>
                                <td className="py-2">${a.avgCostUsd}</td>
                                <td className="py-2">{a.avgDurationSec}s</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </CardContent>
                  </Card>
                )}
              </div>
            )}
          </div>
        </div>

        <GhostDialog
          open={!!ghostDialog}
          onOpenChange={(open) => !open && setGhostDialog(null)}
          agents={ghostDialog?.agents ?? []}
          onConfirm={handleGhostConfirm}
          isGhosting={isGhosting}
        />
        <ForkDialog
          open={!!forkDialog}
          onOpenChange={(open) => !open && setForkDialog(null)}
          stepIndex={forkDialog?.stepIndex ?? 0}
          agentId={forkDialog?.agentId ?? ''}
          agentPrompt={forkDialog?.agentPrompt ?? ''}
          onConfirm={handleForkConfirm}
          isForking={isForking}
        />
      </div>
    </AppLayout>
  )
}

function GhostDialog({
  open,
  onOpenChange,
  agents,
  onConfirm,
  isGhosting,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  agents: { id: string; prompt: string }[]
  onConfirm: (agentId: string, newPrompt: string) => void
  isGhosting: boolean
}) {
  const [selectedAgentId, setSelectedAgentId] = useState(agents[0]?.id ?? '')
  const [newPrompt, setNewPrompt] = useState('')
  useEffect(() => {
    if (open) {
      setSelectedAgentId(agents[0]?.id ?? '')
      setNewPrompt(agents.find((a) => a.id === agents[0]?.id)?.prompt ?? '')
    }
  }, [open, agents])
  useEffect(() => {
    const a = agents.find((x) => x.id === selectedAgentId)
    if (a) setNewPrompt(a.prompt)
  }, [selectedAgentId, agents])

  const handleConfirm = () => {
    if (selectedAgentId && newPrompt.trim()) onConfirm(selectedAgentId, newPrompt.trim())
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Shadow test (Ghost mode)</DialogTitle>
          <DialogDescription>
            Run a ghost agent with a new prompt alongside the live run. Compare outputs side-by-side.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <div>
            <label className="text-sm font-medium">Agent to test</label>
            <select
              className="mt-1 w-full rounded-lg border border-input bg-background px-3 py-2 text-sm"
              value={selectedAgentId}
              onChange={(e) => setSelectedAgentId(e.target.value)}
              disabled={isGhosting}
            >
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.id}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="text-sm font-medium">New prompt for ghost</label>
            <textarea
              className="mt-1 w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm resize-y"
              value={newPrompt}
              onChange={(e) => setNewPrompt(e.target.value)}
              disabled={isGhosting}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isGhosting}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={!selectedAgentId || !newPrompt.trim() || isGhosting}>
            {isGhosting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Ghost className="w-4 h-4 mr-1.5" />}
            Create ghost and run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function ForkDialog({
  open,
  onOpenChange,
  stepIndex,
  agentId,
  agentPrompt,
  onConfirm,
  isForking,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  stepIndex: number
  agentId: string
  agentPrompt: string
  onConfirm: (editedPrompt?: string) => void
  isForking: boolean
}) {
  const [editedPrompt, setEditedPrompt] = useState(agentPrompt)
  useEffect(() => {
    if (open) setEditedPrompt(agentPrompt)
  }, [open, agentPrompt])

  const handleConfirm = () => {
    const prompt = editedPrompt.trim()
    onConfirm(prompt !== agentPrompt ? prompt : undefined)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Fork from step {stepIndex + 1}</DialogTitle>
          <DialogDescription>
            Re-run from step {stepIndex + 1} ({agentId}) without re-executing earlier steps. Optionally edit the agent
            prompt below.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <label className="text-sm font-medium">Agent prompt (optional edit)</label>
          <textarea
            className="w-full min-h-[120px] rounded-lg border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-y"
            value={editedPrompt}
            onChange={(e) => setEditedPrompt(e.target.value)}
            disabled={isForking}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isForking}>
            Cancel
          </Button>
          <Button onClick={handleConfirm} disabled={isForking}>
            {isForking ? <Loader2 className="w-4 h-4 animate-spin" /> : <GitFork className="w-4 h-4 mr-1.5" />}
            Fork and Run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function StepCard({
  step,
  expanded,
  onToggle,
  onFork,
  hasContradiction,
  contradictionSeverity,
}: {
  step: AgentStep
  expanded: boolean
  onToggle: () => void
  onFork?: () => void
  hasContradiction?: boolean
  contradictionSeverity?: 'low' | 'medium' | 'high'
}) {
  return (
    <div
      className={cn(
        'rounded-lg border bg-card',
        hasContradiction && 'border-destructive/60 bg-destructive/5'
      )}
    >
      <div className="flex items-center">
        <button
          type="button"
          onClick={onToggle}
          className="flex-1 flex items-center gap-2 px-3 py-2 text-left hover:bg-muted/50 rounded-t-lg min-w-0"
        >
          {expanded ? (
            <ChevronDown className="w-4 h-4 shrink-0" />
          ) : (
            <ChevronRight className="w-4 h-4 shrink-0" />
          )}
          <span className="font-medium truncate">{step.agentName ?? step.agentId}</span>
          <span
            className={cn(
              'text-xs shrink-0',
              step.status === 'complete' && 'text-success',
              step.status === 'failed' && 'text-destructive',
              step.status === 'running' && 'text-primary',
              step.status === 'pending' && 'text-muted-foreground'
            )}
          >
            {step.status}
            {hasContradiction && (
              <span title={`Contradiction: ${contradictionSeverity}`}>
                <AlertTriangle className="inline w-3 h-3 ml-1 text-destructive" />
              </span>
            )}
          </span>
        </button>
        {onFork && (
          <Button
            variant="ghost"
            size="sm"
            className="shrink-0 h-8 px-2"
            onClick={(e) => {
              e.stopPropagation()
              onFork()
            }}
            title="Fork from this step"
          >
            <GitFork className="w-4 h-4" />
          </Button>
        )}
      </div>
      {expanded && (
        <div className="px-3 pb-3 pt-0 space-y-2 text-sm">
          {step.input && Object.keys(step.input).length > 0 && (
            <div>
              <span className="text-muted-foreground">Input:</span>
              <pre className="mt-1 text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono">
                {JSON.stringify(step.input, null, 2)}
              </pre>
            </div>
          )}
          {step.output && Object.keys(step.output).length > 0 && (
            <div>
              <span className="text-muted-foreground">Output:</span>
              <pre className="mt-1 text-xs bg-muted/50 rounded p-2 overflow-x-auto whitespace-pre-wrap font-mono">
                {JSON.stringify(step.output, null, 2)}
              </pre>
            </div>
          )}
          {step.error && <p className="text-destructive text-xs">{step.error}</p>}
          {(step.tokensIn ?? step.tokensOut ?? step.durationMs ?? step.costUsd) && (
            <div className="text-xs text-muted-foreground">
              {step.tokensIn != null && `Tokens in: ${step.tokensIn}`}
              {step.tokensOut != null && ` | Out: ${step.tokensOut}`}
              {step.durationMs != null && ` | ${(step.durationMs / 1000).toFixed(1)}s`}
              {step.costUsd != null && ` | $${step.costUsd.toFixed(4)}`}
            </div>
          )}
          {step.criticResult?.contradictions?.length ? (
            <div>
              <span className="text-muted-foreground">Critic (contradictions):</span>
              <ul className="mt-1 text-xs text-destructive list-disc list-inside">
                {step.criticResult.contradictions.map((c, i) => (
                  <li key={i}>{c}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
