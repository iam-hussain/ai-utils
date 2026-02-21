import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContent } from '@/components/layout/PageContent'
import { EmptyState } from '@/components/ui/empty-state'
import { InlineAlert } from '@/components/ui/inline-alert'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import { useUserData } from '@/contexts/UserDataContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { socket } from '@/lib/socket'
import {
  fetchProjects,
  createProject,
  updateProject,
  addTeamToProject,
  removeTeamFromProject,
  deleteProject,
  DEFAULT_ENVIRONMENTS,
  type Project,
} from '@/lib/projects-api'
import { FolderKanban, Plus, Users, Trash2, Loader2, ChevronDown, ChevronRight, Server, X } from 'lucide-react'

interface ProjectsPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function ProjectsPage({ currentView, onNavigate }: ProjectsPageProps) {
  const { teams } = useUserData()
  const { confirm } = useConfirm()
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [newProjectName, setNewProjectName] = useState('')
  const [newProjectDescription, setNewProjectDescription] = useState('')
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null)
  const [addTeamProjectId, setAddTeamProjectId] = useState<string | null>(null)
  const [addTeamId, setAddTeamId] = useState('')
  const [addingTeam, setAddingTeam] = useState(false)
  const [removingTeamId, setRemovingTeamId] = useState<string | null>(null)
  const [newEnv, setNewEnv] = useState('')
  const [updatingEnvs, setUpdatingEnvs] = useState(false)

  const loadProjects = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchProjects()
      setProjects(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load projects')
      setProjects([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadProjects()
  }, [loadProjects])

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

  const handleCreate = useCallback(async () => {
    const name = newProjectName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      await createProject(name, [], newProjectDescription.trim() || undefined)
      await loadProjects()
      setNewProjectName('')
      setNewProjectDescription('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create project')
    } finally {
      setCreating(false)
    }
  }, [newProjectName, newProjectDescription, loadProjects])

  const handleAddTeam = useCallback(
    async (projectId: string) => {
      if (!addTeamId) return
      setAddingTeam(true)
      setError(null)
      try {
        await addTeamToProject(projectId, addTeamId)
        await loadProjects()
        setAddTeamProjectId(null)
        setAddTeamId('')
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to add team')
      } finally {
        setAddingTeam(false)
      }
    },
    [addTeamId, loadProjects]
  )

  const handleUpdateEnvironments = useCallback(
    async (projectId: string, environments: string[]) => {
      setUpdatingEnvs(true)
      setError(null)
      try {
        await updateProject(projectId, { environments })
        await loadProjects()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update environments')
      } finally {
        setUpdatingEnvs(false)
      }
    },
    [loadProjects]
  )

  const handleRemoveTeam = useCallback(
    async (projectId: string, teamId: string) => {
      const key = `${projectId}-${teamId}`
      setRemovingTeamId(key)
      setError(null)
      try {
        await removeTeamFromProject(projectId, teamId)
        await loadProjects()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to remove team')
      } finally {
        setRemovingTeamId(null)
      }
    },
    [loadProjects]
  )

  const handleDelete = useCallback(
    async (project: Project) => {
      const ok = await confirm({
        title: 'Delete project',
        description: `Delete "${project.name}"? This cannot be undone. Issues in this project will be unassigned.`,
        confirmLabel: 'Delete',
        variant: 'destructive',
      })
      if (!ok) return
      setError(null)
      try {
        await deleteProject(project.id)
        await loadProjects()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete')
      }
    },
    [loadProjects, confirm]
  )

  const getTeamName = (teamId: string) => teams.find((t) => t.id === teamId)?.name ?? teamId

  return (
    <AppLayout
      currentView={currentView}
      onNavigate={onNavigate}
      isConnected={isConnected}
      title="Projects"
    >
      <div className="flex flex-col h-full overflow-hidden">
        <PageHeader
          subtitle="Group issues by project. Add teams to share projects across your organization."
        />

        <PageContent>
          <div className="space-y-4">
            {error && <InlineAlert>{error}</InlineAlert>}

            <div className="flex gap-3 items-end">
              <div className="flex-1 space-y-2">
                <Input
                  placeholder="New project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  disabled={creating}
                />
                <Textarea
                  placeholder="Description (optional)"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  rows={1}
                  className="resize-none"
                  disabled={creating}
                />
              </div>
              <Button
                onClick={handleCreate}
                disabled={creating || !newProjectName.trim()}
                className="gap-1.5 shrink-0"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                Create project
              </Button>
            </div>

            {loading ? (
              <LoadingSpinner size="lg" label="Loading projects..." className="py-12" />
            ) : projects.length === 0 ? (
              <EmptyState
                icon={<FolderKanban />}
                title="No projects yet"
                description="Create a project and add teams to organize issues across your organization."
              />
            ) : (
              <div className="space-y-2">
                {projects.map((project) => {
                  const isExpanded = expandedProjectId === project.id
                  const projectTeams = project.teamIds ?? []
                  const availableTeams = teams.filter((t) => !projectTeams.includes(t.id))

                  return (
                    <Card key={project.id}>
                      <div
                        className="flex items-center gap-2 p-4 cursor-pointer hover:bg-muted/30 transition-colors"
                        onClick={() => setExpandedProjectId(isExpanded ? null : project.id)}
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4 shrink-0 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-4 h-4 shrink-0 text-muted-foreground" />
                        )}
                        <FolderKanban className="w-5 h-5 shrink-0 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <h3 className="font-medium truncate">{project.name}</h3>
                          {project.description && (
                            <p className="text-sm text-muted-foreground truncate mt-0.5">
                              {project.description}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {projectTeams.length} team{projectTeams.length !== 1 ? 's' : ''}
                          </p>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation()
                            handleDelete(project)
                          }}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>

                      {isExpanded && (
                        <div className="border-t px-4 py-3 space-y-4">
                          <div>
                            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                              <Server className="w-4 h-4" />
                              Environments
                            </h4>
                            <p className="text-xs text-muted-foreground mb-2">
                              Used when creating issues (e.g. DEV, SIT, UAT, PT, PROD)
                            </p>
                            <div className="flex flex-wrap gap-1.5 mb-2">
                              {(project.environments ?? DEFAULT_ENVIRONMENTS).map((env) => (
                                <span
                                  key={env}
                                  className="inline-flex items-center gap-1 rounded-md bg-muted px-2 py-1 text-xs font-medium"
                                >
                                  {env}
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const next = (project.environments ?? DEFAULT_ENVIRONMENTS).filter(
                                        (e) => e !== env
                                      )
                                      if (next.length > 0) handleUpdateEnvironments(project.id, next)
                                    }}
                                    className="rounded hover:bg-destructive/20 p-0.5"
                                    disabled={updatingEnvs}
                                  >
                                    <X className="w-3 h-3" />
                                  </button>
                                </span>
                              ))}
                            </div>
                            <div className="flex gap-2">
                              <Input
                                placeholder="Add env (e.g. PROD)"
                                value={newEnv}
                                onChange={(e) => setNewEnv(e.target.value.toUpperCase())}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') {
                                    const v = newEnv.trim()
                                    if (v) {
                                      const envs = project.environments ?? DEFAULT_ENVIRONMENTS
                                      if (!envs.includes(v)) {
                                        handleUpdateEnvironments(project.id, [...envs, v])
                                        setNewEnv('')
                                      }
                                    }
                                  }
                                }}
                                className="max-w-[140px] h-8 text-sm"
                                disabled={updatingEnvs}
                              />
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  const v = newEnv.trim()
                                  if (v) {
                                    const envs = project.environments ?? DEFAULT_ENVIRONMENTS
                                    if (!envs.includes(v)) {
                                      handleUpdateEnvironments(project.id, [...envs, v])
                                      setNewEnv('')
                                    }
                                  }
                                }}
                                disabled={!newEnv.trim() || updatingEnvs}
                              >
                                Add
                              </Button>
                            </div>
                          </div>
                          <div>
                            <h4 className="text-sm font-medium flex items-center gap-1.5 mb-2">
                              <Users className="w-4 h-4" />
                              Teams
                            </h4>
                          {projectTeams.length > 0 ? (
                            <ul className="space-y-1">
                              {projectTeams.map((tid) => (
                                <li
                                  key={tid}
                                  className="flex items-center justify-between gap-2 rounded-md bg-muted/50 px-3 py-2 text-sm"
                                >
                                  <span>{getTeamName(tid)}</span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    className="h-7 text-destructive hover:text-destructive"
                                    onClick={() => handleRemoveTeam(project.id, tid)}
                                    disabled={removingTeamId === `${project.id}-${tid}`}
                                  >
                                    {removingTeamId === `${project.id}-${tid}` ? (
                                      <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                      'Remove'
                                    )}
                                  </Button>
                                </li>
                              ))}
                            </ul>
                          ) : (
                            <p className="text-sm text-muted-foreground">No teams added yet.</p>
                          )}

                          {availableTeams.length > 0 && (
                            <div className="flex gap-2 items-center">
                              <Select
                                value={addTeamProjectId === project.id ? addTeamId || '__none__' : '__none__'}
                                onValueChange={(v) => {
                                  if (addTeamProjectId !== project.id) setAddTeamProjectId(project.id)
                                  setAddTeamId(v === '__none__' ? '' : v)
                                }}
                              >
                                <SelectTrigger className="w-[200px]">
                                  <SelectValue placeholder="Add team..." />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="__none__">Add team...</SelectItem>
                                  {availableTeams.map((t) => (
                                    <SelectItem key={t.id} value={t.id}>
                                      {t.name}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <Button
                                size="sm"
                                onClick={() => handleAddTeam(project.id)}
                                disabled={
                                  !addTeamId || addingTeam || addTeamProjectId !== project.id
                                }
                              >
                                {addingTeam && addTeamProjectId === project.id ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  'Add'
                                )}
                              </Button>
                            </div>
                          )}
                          </div>
                        </div>
                      )}
                    </Card>
                  )
                })}
              </div>
            )}
          </div>
        </PageContent>
      </div>
    </AppLayout>
  )
}
