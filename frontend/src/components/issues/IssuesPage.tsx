import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { useAuth } from '@/contexts/AuthContext'
import { useUserData } from '@/contexts/UserDataContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { socket } from '@/lib/socket'
import {
  fetchIssues,
  fetchIssue,
  updateIssue,
  deleteIssue,
  fetchIssueComments,
  addIssueComment,
  fetchProjects,
  exportIssue,
  type Issue,
  type IssueComment,
  type IssueStatus,
} from '@/lib/issues-api'
import { fetchTeamMembers } from '@/lib/teams-api'
import { IssueCreateForm } from './IssueCreateForm'
import { Group, Panel, Separator, useDefaultLayout } from 'react-resizable-panels'
import {
  Bug,
  GripVertical,
  Plus,
  Search,
  MessageSquare,
  ExternalLink,
  Image,
  CheckCircle2,
  XCircle,
  Loader2,
  Download,
  Trash2,
  Send,
} from 'lucide-react'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { cn } from '@/lib/utils'

function formatRelativeTime(ts: string | Date): string {
  const t = typeof ts === 'string' ? new Date(ts).getTime() : ts.getTime()
  const diff = Date.now() - t
  if (diff < 60_000) return 'Just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`
  return new Date(t).toLocaleDateString()
}

const STATUS_LABELS: Record<IssueStatus, string> = {
  open: 'Open',
  in_progress: 'In Progress',
  completed: 'Completed',
  closed: 'Closed',
}

const STATUS_VARIANTS: Record<IssueStatus, 'default' | 'secondary' | 'destructive' | 'outline' | 'success'> = {
  open: 'secondary',
  in_progress: 'default',
  completed: 'success',
  closed: 'outline',
}

const STATUS_BORDER: Record<IssueStatus, string> = {
  open: 'border-l-secondary',
  in_progress: 'border-l-primary',
  completed: 'border-l-success',
  closed: 'border-l-muted-foreground/50',
}

interface IssuesPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

function canEditIssue(issue: Issue, userId: string | undefined): boolean {
  if (!userId) return false
  if (issue.assigneeId) return issue.assigneeId === userId
  return issue.reporterId === userId
}

function canDeleteIssue(issue: Issue, userId: string | undefined): boolean {
  if (!userId) return false
  return issue.reporterId === userId || (issue.assigneeId != null && issue.assigneeId === userId)
}

export default function IssuesPage({ currentView, onNavigate }: IssuesPageProps) {
  const { user } = useAuth()
  const { teams } = useUserData()
  const { confirm } = useConfirm()
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [issues, setIssues] = useState<Issue[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filterTeamId, setFilterTeamId] = useState<string>('')
  const [filterProjectId, setFilterProjectId] = useState<string>('')
  const [filterStatus, setFilterStatus] = useState<string>('')
  const [searchQuery, setSearchQuery] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string }[]>([])
  const [detailIssueId, setDetailIssueId] = useState<string | null>(null)
  const [detailIssue, setDetailIssue] = useState<Issue | null>(null)
  const [detailComments, setDetailComments] = useState<IssueComment[]>([])
  const [detailMembers, setDetailMembers] = useState<{ userId: string; name: string | null; email: string | null }[]>([])
  const [detailLoading, setDetailLoading] = useState(false)
  const [newComment, setNewComment] = useState('')
  const [submittingComment, setSubmittingComment] = useState(false)
  const [rightPanelMode, setRightPanelMode] = useState<'empty' | 'create' | 'detail'>('empty')

  const { defaultLayout, onLayoutChanged } = useDefaultLayout({
    id: 'issues-split',
    panelIds: ['issues-list', 'issues-detail'],
    storage: typeof window !== 'undefined' ? localStorage : undefined,
  })

  const loadIssues = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchIssues({
        teamId: filterTeamId || undefined,
        projectId: filterProjectId || undefined,
        status: filterStatus || undefined,
      })
      setIssues(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load issues')
      setIssues([])
    } finally {
      setLoading(false)
    }
  }, [filterTeamId, filterProjectId, filterStatus])

  const loadProjects = useCallback(async () => {
    if (!filterTeamId) {
      setProjects([])
      return
    }
    try {
      const data = await fetchProjects(filterTeamId)
      setProjects(data)
    } catch {
      setProjects([])
    }
  }, [filterTeamId])

  useEffect(() => {
    loadIssues()
  }, [loadIssues])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

  useEffect(() => {
    if (filterTeamId && filterProjectId && !projects.some((p) => p.id === filterProjectId)) {
      setFilterProjectId('')
    }
  }, [filterTeamId, filterProjectId, projects])

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

  const filteredIssues = issues.filter((i) => {
    if (!searchQuery.trim()) return true
    const q = searchQuery.toLowerCase()
    return (
      i.title.toLowerCase().includes(q) ||
      i.description.toLowerCase().includes(q) ||
      i.tags.some((t) => t.toLowerCase().includes(q)) ||
      (i.jiraTicketId && i.jiraTicketId.toLowerCase().includes(q))
    )
  })

  const openDetail = useCallback(async (id: string) => {
    setRightPanelMode('detail')
    setDetailIssueId(id)
    setDetailLoading(true)
    setDetailIssue(null)
    setDetailComments([])
    setDetailMembers([])
    try {
      const [issue, comments] = await Promise.all([fetchIssue(id), fetchIssueComments(id)])
      setDetailIssue(issue)
      setDetailComments(comments)
      const members = await fetchTeamMembers(issue.teamId)
      setDetailMembers(members)
    } catch {
      setDetailIssue(null)
      setDetailComments([])
      setDetailMembers([])
    } finally {
      setDetailLoading(false)
    }
  }, [])

  const closeDetail = useCallback(() => {
    setRightPanelMode('empty')
    setDetailIssueId(null)
    setDetailIssue(null)
    setDetailComments([])
    setNewComment('')
    loadIssues()
  }, [loadIssues])

  const handleCreateSuccess = useCallback(
    (issueId: string) => {
      loadIssues()
      openDetail(issueId)
    },
    [loadIssues, openDetail]
  )

  const handleAddComment = useCallback(async () => {
    if (!detailIssueId || !newComment.trim()) return
    setSubmittingComment(true)
    try {
      const c = await addIssueComment(detailIssueId, newComment.trim())
      setDetailComments((prev) => [...prev, c])
      setNewComment('')
    } finally {
      setSubmittingComment(false)
    }
  }, [detailIssueId, newComment])

  const handleExport = useCallback(
    async (format: 'json' | 'csv') => {
      if (!detailIssueId) return
      const blob = await exportIssue(detailIssueId, format)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `issue-${detailIssueId}.${format}`
      a.click()
      URL.revokeObjectURL(url)
    },
    [detailIssueId]
  )

  return (
    <AppLayout
      currentView={currentView}
      onNavigate={onNavigate}
      isConnected={isConnected}
      title="Issues & Bug Reports"
      headerActions={
        <Button size="sm" className="gap-1.5" onClick={() => setRightPanelMode('create')}>
          <Plus className="w-4 h-4" />
          New Issue
        </Button>
      }
    >
      <Group
        className="flex-1 min-h-0"
        orientation="horizontal"
        id="issues-split"
        defaultLayout={defaultLayout ?? { 'issues-list': 35, 'issues-detail': 65 }}
        onLayoutChanged={onLayoutChanged}
        resizeTargetMinimumSize={{ fine: 8, coarse: 24 }}
      >
        <Panel
          id="issues-list"
          defaultSize="35"
          minSize="20"
          maxSize="60"
          className="flex flex-col min-w-0 border-r bg-muted/20 overflow-hidden"
        >
        <div className="p-4 border-b bg-card/50 shrink-0">
          <div className="flex flex-wrap gap-3 items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                placeholder="Search issues..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 bg-background/80"
              />
            </div>
            <Select
              value={filterTeamId || '__all__'}
              onValueChange={(v) => setFilterTeamId(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="All teams" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All teams</SelectItem>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterProjectId || '__all__'}
              onValueChange={(v) => setFilterProjectId(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All projects</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={filterStatus || '__all__'}
              onValueChange={(v) => setFilterStatus(v === '__all__' ? '' : v)}
            >
              <SelectTrigger className="w-[130px] h-9">
                <SelectValue placeholder="All statuses" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">All statuses</SelectItem>
                {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-4 space-y-2">
            {loading ? (
              <LoadingSpinner size="lg" label="Loading issues..." className="py-12" />
            ) : error ? (
              <Card className="border-destructive/50">
                <CardContent className="py-6 text-center text-muted-foreground">
                  {error}
                  <Button variant="outline" size="sm" className="mt-2" onClick={loadIssues}>
                    Retry
                  </Button>
                </CardContent>
              </Card>
            ) : filteredIssues.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
                  <Bug className="w-7 h-7 text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground">
                  {issues.length === 0 ? 'No issues yet' : 'No matching issues'}
                </p>
                <p className="text-sm text-muted-foreground mt-1 max-w-[240px]">
                  {issues.length === 0
                    ? 'Create your first issue to track bugs and feedback.'
                    : 'Try adjusting your filters or search query.'}
                </p>
                {issues.length === 0 && (
                  <Button className="mt-5" onClick={() => setRightPanelMode('create')}>
                    <Plus className="w-4 h-4 mr-2" />
                    New Issue
                  </Button>
                )}
              </div>
            ) : (
              filteredIssues.map((issue) => (
                <IssueCard
                  key={issue.id}
                  issue={issue}
                  canEdit={canEditIssue(issue, user?.id)}
                  onClick={() => openDetail(issue.id)}
                  onStatusChange={async (status) => {
                    await updateIssue(issue.id, { status })
                    loadIssues()
                    if (detailIssueId === issue.id) {
                      setDetailIssue((prev) => (prev?.id === issue.id ? { ...prev, status } : prev))
                    }
                  }}
                />
              ))
            )}
          </div>
        </ScrollArea>
        </Panel>

        <Separator
          className={cn(
            'w-3 shrink-0 bg-border transition-colors cursor-col-resize',
            'hover:bg-primary/20 flex items-center justify-center',
            'data-[separator]:hover:bg-primary/20'
          )}
        >
          <GripVertical className="w-4 h-4 text-muted-foreground/50 pointer-events-none" />
        </Separator>

        <Panel
          id="issues-detail"
          defaultSize="65"
          minSize="40"
          className="flex flex-col min-w-0 bg-background overflow-hidden"
        >
          {rightPanelMode === 'empty' && (
            <div className="flex-1 flex items-center justify-center p-12">
              <div className="text-center max-w-[280px]">
                <div className="w-16 h-16 rounded-2xl bg-muted/80 flex items-center justify-center mx-auto mb-5">
                  <Bug className="w-8 h-8 text-muted-foreground" />
                </div>
                <p className="font-semibold text-foreground text-lg">Select or create</p>
                <p className="text-sm text-muted-foreground mt-2">
                  Choose an issue from the list to view details, or create a new one to get started.
                </p>
                <Button className="mt-6" variant="outline" onClick={() => setRightPanelMode('create')}>
                  <Plus className="w-4 h-4 mr-2" />
                  New Issue
                </Button>
              </div>
            </div>
          )}

          {rightPanelMode === 'create' && (
            <div className="flex-1 overflow-auto">
              <div className="p-6 md:p-8 max-w-2xl">
                <div className="mb-6">
                  <h2 className="text-xl font-semibold tracking-tight">New Issue</h2>
                  <p className="text-sm text-muted-foreground mt-1">Report a bug or track feedback</p>
                </div>
                <IssueCreateForm
                  onSuccess={handleCreateSuccess}
                  onCancel={() => setRightPanelMode('empty')}
                  compact
                />
              </div>
            </div>
          )}

          {rightPanelMode === 'detail' && (
            <div className="flex-1 flex flex-col min-h-0">
              <div className="p-4 border-b shrink-0 flex items-center justify-between">
                <h2 className="font-semibold truncate flex items-center gap-2">
                  {detailLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin shrink-0" />
                  ) : (
                    <Bug className="w-5 h-5 shrink-0" />
                  )}
                  {detailIssue?.title ?? 'Issue details'}
                </h2>
                <Button variant="ghost" size="sm" onClick={closeDetail}>
                  Close
                </Button>
              </div>
              {detailLoading ? (
                <div className="flex-1 flex items-center justify-center text-muted-foreground">
                  <Loader2 className="w-6 h-6 animate-spin" />
                </div>
              ) : (
                detailIssue && (
                  <>
                    <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  <div className="flex flex-wrap gap-2 items-center">
                    <Badge variant={STATUS_VARIANTS[detailIssue.status]}>
                      {STATUS_LABELS[detailIssue.status]}
                    </Badge>
                    {detailIssue.jiraTicketId && (
                      <Badge variant="outline">{detailIssue.jiraTicketId}</Badge>
                    )}
                    {detailIssue.environment && (
                      <Badge variant="outline">{detailIssue.environment}</Badge>
                    )}
                    {detailIssue.tags.map((t) => (
                      <Badge key={t} variant="secondary">
                        {t}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {detailIssue.reporterName && `Reported by ${detailIssue.reporterName}`}
                    {detailIssue.assigneeName && ` · Assigned to ${detailIssue.assigneeName}`}
                    {' · '}
                    {formatRelativeTime(detailIssue.createdAt)}
                  </p>
                  {detailIssue.description && (
                    <div>
                      <h4 className="text-sm font-medium mb-1">Description</h4>
                      <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                        {detailIssue.description}
                      </p>
                    </div>
                  )}
                  {detailIssue.promptSteps.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2">Prompt chain</h4>
                      <div className="space-y-2">
                        {detailIssue.promptSteps.map((step, idx) => (
                          <div
                            key={idx}
                            className="rounded-md border p-2 text-sm bg-muted/30"
                          >
                            <p className="font-medium">{step.promptText}</p>
                            {step.expectedReply && (
                              <p className="text-muted-foreground mt-1">
                                Expected: {step.expectedReply}
                              </p>
                            )}
                            <div className="flex items-center gap-1 mt-1">
                              {step.envStatus === 'working' && (
                                <Badge variant="success" className="text-xs">
                                  <CheckCircle2 className="w-3 h-3 mr-0.5" />
                                  Working
                                </Badge>
                              )}
                              {step.envStatus === 'not_working' && (
                                <Badge variant="destructive" className="text-xs">
                                  <XCircle className="w-3 h-3 mr-0.5" />
                                  Not working
                                </Badge>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailIssue.links.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                        <ExternalLink className="w-4 h-4" />
                        Links
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {detailIssue.links.map((l, idx) => (
                          <a
                            key={idx}
                            href={l.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-sm text-primary hover:underline"
                          >
                            {l.label || l.url}
                          </a>
                        ))}
                      </div>
                    </div>
                  )}
                  {detailIssue.screenshots.length > 0 && (
                    <div>
                      <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                        <Image className="w-4 h-4" />
                        Screenshots
                      </h4>
                      <div className="grid grid-cols-2 gap-2">
                        {detailIssue.screenshots.map((s, idx) => (
                          <div key={idx} className="rounded border overflow-hidden">
                            {s.data ? (
                              <img
                                src={`data:${s.mimeType || 'image/png'};base64,${s.data}`}
                                alt={s.caption || 'Screenshot'}
                                className="w-full h-auto object-cover"
                              />
                            ) : (
                              <div className="aspect-video bg-muted flex items-center justify-center text-muted-foreground text-xs">
                                Image
                              </div>
                            )}
                            {s.caption && (
                              <p className="p-1 text-xs text-muted-foreground">{s.caption}</p>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  <div>
                    <h4 className="text-sm font-medium mb-2 flex items-center gap-1">
                      <MessageSquare className="w-4 h-4" />
                      Comments ({detailComments.length})
                    </h4>
                    <div className="space-y-3">
                      {detailComments.map((c) => (
                        <div
                          key={c.id}
                          className="rounded-md border p-3 bg-muted/20 text-sm"
                        >
                          <p className="font-medium text-foreground">{c.authorName ?? 'Unknown'}</p>
                          <p className="text-muted-foreground mt-1 whitespace-pre-wrap">
                            {c.content}
                          </p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {formatRelativeTime(c.createdAt)}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </ScrollArea>
              <div className="p-4 border-t shrink-0 space-y-3">
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Add a comment..."
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    rows={2}
                    className="resize-none"
                  />
                  <Button
                    size="icon"
                    onClick={handleAddComment}
                    disabled={!newComment.trim() || submittingComment}
                  >
                    {submittingComment ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Send className="w-4 h-4" />
                    )}
                  </Button>
                </div>
                <div className="flex flex-wrap gap-2 items-center">
                  {!canEditIssue(detailIssue, user?.id) && (
                    <span className="text-xs text-muted-foreground">Only the assigned person can change</span>
                  )}
                  <Select
                    value={detailIssue.status}
                    disabled={!canEditIssue(detailIssue, user?.id)}
                    onValueChange={(v) =>
                      updateIssue(detailIssue.id, { status: v as IssueStatus }).then(() => {
                        setDetailIssue((prev) => (prev ? { ...prev, status: v as IssueStatus } : prev))
                        loadIssues()
                      })
                    }
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUS_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select
                    value={detailIssue.assigneeId ?? '__none__'}
                    disabled={!canEditIssue(detailIssue, user?.id)}
                    onValueChange={(v) => {
                      const assigneeId = v === '__none__' ? null : v
                      updateIssue(detailIssue.id, { assigneeId }).then(() => {
                        setDetailIssue((prev) =>
                          prev
                            ? {
                                ...prev,
                                assigneeId,
                                assigneeName: assigneeId ? detailMembers.find((m) => m.userId === assigneeId)?.name ?? null : null,
                              }
                            : prev
                        )
                        loadIssues()
                      })
                    }}
                  >
                    <SelectTrigger className="w-[140px]">
                      <SelectValue placeholder="Unassigned" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">Unassigned</SelectItem>
                      {detailMembers.map((m) => (
                        <SelectItem key={m.userId} value={m.userId}>
                          {m.name || m.email || m.userId}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('json')}
                    title="Export as JSON"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    JSON
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleExport('csv')}
                    title="Export as CSV"
                  >
                    <Download className="w-4 h-4 mr-1" />
                    CSV
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    disabled={!canDeleteIssue(detailIssue, user?.id)}
                    title={!canDeleteIssue(detailIssue, user?.id) ? 'Only creator or assignee can delete' : undefined}
                    onClick={async () => {
                      const ok = await confirm({
                        title: 'Delete issue',
                        description: 'This cannot be undone.',
                        confirmLabel: 'Delete',
                        variant: 'destructive',
                      })
                      if (ok) {
                        await deleteIssue(detailIssue.id)
                        closeDetail()
                      }
                    }}
                  >
                    <Trash2 className="w-4 h-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>
                  </>
                )
              )}
            </div>
          )}
        </Panel>
      </Group>
    </AppLayout>
  )
}

function IssueCard({
  issue,
  canEdit,
  onClick,
  onStatusChange,
}: {
  issue: Issue
  canEdit: boolean
  onClick: () => void
  onStatusChange: (status: IssueStatus) => Promise<void>
}) {
  return (
    <Card
      className={cn(
        'cursor-pointer border-l-4 transition-all duration-200',
        'hover:bg-card hover:shadow-sm hover:border-primary/20',
        STATUS_BORDER[issue.status]
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <h3 className="font-semibold text-foreground truncate">{issue.title}</h3>
            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
              {issue.description || 'No description'}
            </p>
            <div className="flex flex-wrap gap-1.5 mt-3">
              <Badge variant={STATUS_VARIANTS[issue.status]} className="text-xs font-medium">
                {STATUS_LABELS[issue.status]}
              </Badge>
              {issue.jiraTicketId && (
                <Badge variant="outline" className="text-xs">
                  {issue.jiraTicketId}
                </Badge>
              )}
              {issue.environment && (
                <Badge variant="outline" className="text-xs">
                  {issue.environment}
                </Badge>
              )}
              {issue.tags.slice(0, 3).map((t) => (
                <Badge key={t} variant="secondary" className="text-xs font-normal">
                  {t}
                </Badge>
              ))}
            </div>
            <p className="text-xs text-muted-foreground mt-2.5">
              {issue.reporterName}
              <span className="mx-1.5">·</span>
              {formatRelativeTime(issue.updatedAt)}
              {issue.assigneeName && (
                <>
                  <span className="mx-1.5">·</span>
                  <span>{issue.assigneeName}</span>
                </>
              )}
            </p>
          </div>
          <div className="shrink-0" onClick={(e) => e.stopPropagation()}>
            <Select
              value={issue.status}
              disabled={!canEdit}
              onValueChange={(v) => onStatusChange(v as IssueStatus)}
            >
              <SelectTrigger
                className="w-[110px] h-8 text-xs"
                title={!canEdit ? 'Only the assigned person can change' : undefined}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(STATUS_LABELS) as IssueStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}
