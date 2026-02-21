import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUserData } from '@/contexts/UserDataContext'
import { createIssue, fetchProjects, type CreateIssuePayload } from '@/lib/issues-api'
import { DEFAULT_ENVIRONMENTS } from '@/lib/projects-api'
import { fetchTeamMembers } from '@/lib/teams-api'
import { Loader2, FileImage, X, ExternalLink, HelpCircle, Plus, GripVertical } from 'lucide-react'
import { cn } from '@/lib/utils'

interface IssueCreateFormProps {
  onSuccess: (issueId: string) => void
  onCancel: () => void
  compact?: boolean
}

function FormSection({
  title,
  children,
  className,
}: {
  title: string
  children: React.ReactNode
  className?: string
}) {
  return (
    <section className={cn('space-y-3', className)}>
      <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {title}
      </h3>
      {children}
    </section>
  )
}

function FormField({
  label,
  required,
  hint,
  tooltip,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  tooltip?: string
  children: React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-foreground flex items-center gap-1.5">
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
        {tooltip && (
          <span
            title={tooltip}
            className="text-muted-foreground cursor-help inline-flex"
            aria-label={tooltip}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </span>
        )}
      </label>
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      {children}
    </div>
  )
}

export function IssueCreateForm({ onSuccess, onCancel, compact = false }: IssueCreateFormProps) {
  const { teams } = useUserData()
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [teamId, setTeamId] = useState('')
  const [projectId, setProjectId] = useState('')
  const [assigneeId, setAssigneeId] = useState('')
  const [projects, setProjects] = useState<{ id: string; name: string; environments?: string[] }[]>([])
  const [members, setMembers] = useState<{ userId: string; name: string | null; email: string | null }[]>([])
  const [jiraTicketId, setJiraTicketId] = useState('')
  const [promptText, setPromptText] = useState('')
  const [nextPrompts, setNextPrompts] = useState<string[]>([])
  const [newPromptInput, setNewPromptInput] = useState('')
  const [envStatus, setEnvStatus] = useState<'working' | 'not_working' | 'unknown'>('unknown')
  const [links, setLinks] = useState<string[]>([])
  const [newLinkInput, setNewLinkInput] = useState('')
  const [screenshots, setScreenshots] = useState<{ data: string; caption?: string }[]>([])
  const [environment, setEnvironment] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const envOptions = projectId
    ? (projects.find((p) => p.id === projectId)?.environments ?? DEFAULT_ENVIRONMENTS)
    : DEFAULT_ENVIRONMENTS

  useEffect(() => {
    if (teams.length > 0 && !teamId) {
      setTeamId(teams[0]!.id)
    }
  }, [teams, teamId])

  useEffect(() => {
    if (teamId) {
      Promise.all([fetchProjects(teamId), fetchTeamMembers(teamId)]).then(([p, m]) => {
        setProjects(p)
        setProjectId((prev) => (prev && p.some((x) => x.id === prev) ? prev : ''))
        setMembers(m)
        setAssigneeId((prev) => (prev && m.some((x) => x.userId === prev) ? prev : ''))
      })
    } else {
      setProjects([])
      setMembers([])
      setProjectId('')
      setAssigneeId('')
      setEnvironment('')
    }
  }, [teamId])

  useEffect(() => {
    if (!projectId) setEnvironment('')
  }, [projectId])

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files?.length) return
    Array.from(files).forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        const result = reader.result as string
        const base64 = result.includes(',') ? result.split(',')[1] : result
        setScreenshots((prev) => [...prev, { data: base64!, caption: file.name }])
      }
      reader.readAsDataURL(file)
    })
  }

  const handleSubmit = async () => {
    if (!title.trim() || !teamId) {
      setError('Title and team are required')
      return
    }
    if (!projectId) {
      setError('Project is required')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const payload: CreateIssuePayload = {
        title: title.trim(),
        description: description.trim(),
        teamId,
        projectId: projectId || undefined,
        assigneeId: assigneeId || undefined,
        jiraTicketId: jiraTicketId.trim() || undefined,
        tags: [],
        promptSteps:
          promptText.trim() || envStatus !== 'unknown'
            ? [{ promptText: promptText.trim() || 'N/A', envStatus }]
            : [],
        nextPromptList: nextPrompts.filter(Boolean),
        links: links
          .filter((u) => u.trim().startsWith('http'))
          .map((url) => ({ url: url.trim() })),
        screenshots: screenshots.map((s) => ({ data: s.data, caption: s.caption })),
        environment: environment || undefined,
      }
      const issue = await createIssue(payload)
      onSuccess(issue.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create')
    } finally {
      setSubmitting(false)
    }
  }

  const rows = compact ? 2 : 4

  return (
    <div className="space-y-6">
      <FormSection title="Core details">
        <div className="space-y-4">
          <FormField label="Title" required hint="Brief summary of the issue">
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. Chat fails when sending long messages"
              className="h-10"
            />
          </FormField>
          <FormField label="Description (optional)" hint="Provide context and steps to reproduce">
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe the issue in detail..."
              rows={rows}
              className="resize-none"
            />
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Organization">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Team" required>
            <Select value={teamId} onValueChange={setTeamId}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select team" />
              </SelectTrigger>
              <SelectContent>
                {teams.map((t) => (
                  <SelectItem key={t.id} value={t.id}>
                    {t.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Project" required>
            <Select value={projectId || '__none__'} onValueChange={(v) => setProjectId(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Select project" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Select project</SelectItem>
                {projects.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Assignee">
            <Select value={assigneeId || '__none__'} onValueChange={(v) => setAssigneeId(v === '__none__' ? '' : v)}>
              <SelectTrigger className="h-10">
                <SelectValue placeholder="Unassigned" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">Unassigned</SelectItem>
                {members.map((m) => (
                  <SelectItem key={m.userId} value={m.userId}>
                    {m.name || m.email || m.userId}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField
            label="Jira ticket"
            tooltip="Link this issue to a Jira ticket. Type PROJ-123 or paste a full Jira URL — the ticket ID will be extracted automatically."
          >
            <div className="relative">
              <ExternalLink className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
              <Input
                value={jiraTicketId}
                onChange={(e) => setJiraTicketId(e.target.value)}
                onPaste={(e) => {
                  const pasted = e.clipboardData.getData('text').trim()
                  const match = pasted.match(/\/browse\/([A-Za-z0-9]+-[0-9]+)/i)
                  if (match) {
                    e.preventDefault()
                    setJiraTicketId(match[1] ?? pasted)
                  }
                }}
                placeholder="PROJ-123"
                className="h-10 pl-9 font-mono text-sm"
              />
            </div>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Status">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField label="Environment" tooltip="Where the issue occurs (configured per project)">
            <Select
              value={environment || '__none__'}
              onValueChange={(v) => setEnvironment(v === '__none__' ? '' : v)}
            >
              <SelectTrigger className="h-10">
                <SelectValue placeholder="None" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None</SelectItem>
                {envOptions.map((env) => (
                  <SelectItem key={env} value={env}>
                    {env}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FormField>
          <FormField label="Environment status" tooltip="Is the env working?">
            <Select value={envStatus} onValueChange={(v: 'working' | 'not_working' | 'unknown') => setEnvStatus(v)}>
              <SelectTrigger className="h-10">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="unknown">Unknown</SelectItem>
                <SelectItem value="working">Working</SelectItem>
                <SelectItem value="not_working">Not working</SelectItem>
              </SelectContent>
            </Select>
          </FormField>
        </div>
      </FormSection>

      <FormSection title="Prompt context">
        <div className="space-y-4">
              <FormField label="Affected prompt" hint="The prompt that triggered the issue">
                <Textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Paste the prompt or describe the flow..."
                  rows={compact ? 2 : 3}
                  className="resize-none"
                />
              </FormField>
              <FormField label="Next prompts" hint="Add follow-up prompts in sequence">
                <div className="space-y-2">
                  {nextPrompts.map((p, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
                    >
                      <GripVertical className="w-4 h-4 shrink-0 text-muted-foreground" />
                      <span className="flex-1 min-w-0 truncate font-mono">{p || '(empty)'}</span>
                      <button
                        type="button"
                        onClick={() => setNextPrompts((prev) => prev.filter((_, j) => j !== i))}
                        className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <div className="flex gap-2">
                    <Input
                      value={newPromptInput}
                      onChange={(e) => setNewPromptInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault()
                          const v = newPromptInput.trim()
                          if (v) {
                            setNextPrompts((prev) => [...prev, v])
                            setNewPromptInput('')
                          }
                        }
                      }}
                      placeholder="Add prompt to chain..."
                      className="flex-1 font-mono text-sm h-9"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        const v = newPromptInput.trim()
                        if (v) {
                          setNextPrompts((prev) => [...prev, v])
                          setNewPromptInput('')
                        }
                      }}
                      disabled={!newPromptInput.trim()}
                    >
                      <Plus className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              </FormField>
        </div>
      </FormSection>

      <FormSection title="Attachments">
        <FormField label="Links" hint="Add links in sequence">
          <div className="space-y-2">
            {links.map((url, i) => (
              <div
                key={i}
                className="flex items-center gap-2 rounded-md border bg-muted/20 px-3 py-2 text-sm"
              >
                <GripVertical className="w-4 h-4 shrink-0 text-muted-foreground" />
                <span className="flex-1 min-w-0 truncate font-mono text-xs">{url || '(empty)'}</span>
                <button
                  type="button"
                  onClick={() => setLinks((prev) => prev.filter((_, j) => j !== i))}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:bg-destructive/20 hover:text-destructive"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))}
            <div className="flex gap-2">
              <Input
                value={newLinkInput}
                onChange={(e) => setNewLinkInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    const v = newLinkInput.trim()
                    if (v && v.startsWith('http')) {
                      setLinks((prev) => [...prev, v])
                      setNewLinkInput('')
                    }
                  }
                }}
                placeholder="Add link (https://...)"
                className="flex-1 font-mono text-sm h-9"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  const v = newLinkInput.trim()
                  if (v && v.startsWith('http')) {
                    setLinks((prev) => [...prev, v])
                    setNewLinkInput('')
                  }
                }}
                disabled={!newLinkInput.trim().startsWith('http')}
              >
                <Plus className="w-4 h-4" />
              </Button>
            </div>
          </div>
        </FormField>
        <FormField label="Screenshots">
          <div className="space-y-3">
                <label className="flex flex-col items-center justify-center w-full h-24 border-2 border-dashed rounded-lg cursor-pointer bg-muted/30 hover:bg-muted/50 transition-colors border-muted-foreground/25">
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <FileImage className="w-8 h-8 mb-2 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">Drop images or click to upload</span>
                  </div>
                  <input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={handleFileChange}
                    className="hidden"
                  />
                </label>
                {screenshots.length > 0 && (
                  <div className="flex gap-2 flex-wrap">
                    {screenshots.map((s, i) => (
                      <div key={i} className="relative group">
                        <img
                          src={`data:image/png;base64,${s.data}`}
                          alt={s.caption}
                          className="w-20 h-20 object-cover rounded-lg border"
                        />
                        <button
                          type="button"
                          onClick={() => setScreenshots((p) => p.filter((_, j) => j !== i))}
                          className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
          </div>
        </FormField>
      </FormSection>

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      <div className="flex gap-3 pt-2 border-t">
        <Button variant="outline" onClick={onCancel} className="min-w-[100px]">
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={submitting} className="min-w-[140px]">
          {submitting ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : null}
          Create Issue
        </Button>
      </div>
    </div>
  )
}
