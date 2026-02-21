import { useState, useEffect, useCallback } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
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
import { InlineAlert } from '@/components/ui/inline-alert'
import { LoadingSpinner } from '@/components/ui/loading-spinner'
import {
  createTeam,
  inviteToTeam,
  leaveTeam,
  deleteTeam,
  searchTeams,
  setTeamDiscoverable,
  requestToJoinTeam,
  fetchJoinRequests,
  approveJoinRequest,
  rejectJoinRequest,
  updateMemberRole,
  fetchTeamMembers,
  type Team,
  type DiscoverTeam,
  type JoinRequest,
  type TeamMemberInfo,
} from '@/lib/teams-api'
import {
  fetchInvites,
  acceptInvite,
  declineInvite,
  type TeamInvite,
} from '@/lib/invites-api'
import { useAuth } from '@/contexts/AuthContext'
import { useUserData } from '@/contexts/UserDataContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import {
  Users,
  Plus,
  UserPlus,
  LogOut,
  Trash2,
  Loader2,
  Mail,
  Check,
  X,
  Search,
  Globe,
  GlobeLock,
  UserCog,
  ChevronDown,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface TeamsPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function TeamsPage({ currentView, onNavigate }: TeamsPageProps) {
  const { user } = useAuth()
  const { teams, setPromptScope, refresh } = useUserData()
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newTeamName, setNewTeamName] = useState('')
  const [inviteEmail, setInviteEmail] = useState<Record<string, string>>({})
  const [inviting, setInviting] = useState<Record<string, boolean>>({})
  const [invites, setInvites] = useState<TeamInvite[]>([])
  const [acceptingId, setAcceptingId] = useState<string | null>(null)
  const [decliningId, setDecliningId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [searchResults, setSearchResults] = useState<DiscoverTeam[]>([])
  const [searching, setSearching] = useState(false)
  const [requestingId, setRequestingId] = useState<string | null>(null)
  const [joinRequests, setJoinRequests] = useState<Record<string, JoinRequest[]>>({})
  const [requestsLoading, setRequestsLoading] = useState<Record<string, boolean>>({})
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null)
  const [discoverableLoading, setDiscoverableLoading] = useState<Record<string, boolean>>({})
  const [roleLoading, setRoleLoading] = useState<Record<string, boolean>>({})
  const [teamMembers, setTeamMembers] = useState<Record<string, TeamMemberInfo[]>>({})
  const [membersLoading, setMembersLoading] = useState<Record<string, boolean>>({})
  const [error, setError] = useState<string | null>(null)
  const { confirm } = useConfirm()

  const loadTeams = useCallback(async () => {
    try {
      await refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load teams')
    } finally {
      setLoading(false)
    }
  }, [refresh])

  const loadInvites = useCallback(async () => {
    try {
      const data = await fetchInvites()
      setInvites(data)
    } catch {
      setInvites([])
    }
  }, [])

  useEffect(() => {
    loadTeams()
  }, [loadTeams])

  useEffect(() => {
    loadInvites()
  }, [loadInvites])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery.trim().length >= 2) {
        setSearching(true)
        searchTeams(searchQuery.trim())
          .then(setSearchResults)
          .catch(() => setSearchResults([]))
          .finally(() => setSearching(false))
      } else {
        setSearchResults([])
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchQuery])

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
    const name = newTeamName.trim()
    if (!name) return
    setCreating(true)
    setError(null)
    try {
      await createTeam(name)
      await loadTeams()
      setNewTeamName('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create team')
    } finally {
      setCreating(false)
    }
  }, [newTeamName, loadTeams])

  const handleInvite = useCallback(
    async (teamId: string) => {
      const email = inviteEmail[teamId]?.trim()
      if (!email) return
      setInviting((prev) => ({ ...prev, [teamId]: true }))
      setError(null)
      try {
        await inviteToTeam(teamId, email)
        await loadInvites()
        refresh()
        setInviteEmail((prev) => ({ ...prev, [teamId]: '' }))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to invite')
      } finally {
        setInviting((prev) => ({ ...prev, [teamId]: false }))
      }
    },
    [inviteEmail, loadInvites, refresh]
  )

  const handleAcceptInvite = useCallback(
    async (inviteId: string) => {
      setAcceptingId(inviteId)
      setError(null)
      try {
        await acceptInvite(inviteId)
        await loadInvites()
        await loadTeams()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to accept')
      } finally {
        setAcceptingId(null)
      }
    },
    [loadInvites, loadTeams]
  )

  const handleDeclineInvite = useCallback(
    async (inviteId: string) => {
      setDecliningId(inviteId)
      setError(null)
      try {
        await declineInvite(inviteId)
        await loadInvites()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to decline')
      } finally {
        setDecliningId(null)
      }
    },
    [loadInvites]
  )

  const handleRequestJoin = useCallback(
    async (teamId: string) => {
      setRequestingId(teamId)
      setError(null)
      try {
        await requestToJoinTeam(teamId)
        setSearchResults((prev) => prev.filter((t) => t.id !== teamId))
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to request join')
      } finally {
        setRequestingId(null)
      }
    },
    []
  )

  const loadTeamMembers = useCallback(async (teamId: string) => {
    setMembersLoading((prev) => ({ ...prev, [teamId]: true }))
    try {
      const data = await fetchTeamMembers(teamId)
      setTeamMembers((prev) => ({ ...prev, [teamId]: data }))
    } catch {
      setTeamMembers((prev) => ({ ...prev, [teamId]: [] }))
    } finally {
      setMembersLoading((prev) => ({ ...prev, [teamId]: false }))
    }
  }, [])

  const loadJoinRequests = useCallback(async (teamId: string) => {
    setRequestsLoading((prev) => ({ ...prev, [teamId]: true }))
    try {
      const data = await fetchJoinRequests(teamId)
      setJoinRequests((prev) => ({ ...prev, [teamId]: data }))
    } catch {
      setJoinRequests((prev) => ({ ...prev, [teamId]: [] }))
    } finally {
      setRequestsLoading((prev) => ({ ...prev, [teamId]: false }))
    }
  }, [])

  const handleApproveRequest = useCallback(
    async (teamId: string, requestId: string) => {
      setError(null)
      try {
        await approveJoinRequest(teamId, requestId)
        await loadJoinRequests(teamId)
        await loadTeams()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve')
      }
    },
    [loadJoinRequests, loadTeams]
  )

  const handleRejectRequest = useCallback(
    async (teamId: string, requestId: string) => {
      setError(null)
      try {
        await rejectJoinRequest(teamId, requestId)
        await loadJoinRequests(teamId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject')
      }
    },
    [loadJoinRequests]
  )

  const handleToggleDiscoverable = useCallback(
    async (teamId: string, current: boolean) => {
      setDiscoverableLoading((prev) => ({ ...prev, [teamId]: true }))
      setError(null)
      try {
        await setTeamDiscoverable(teamId, !current)
        await loadTeams()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update')
      } finally {
        setDiscoverableLoading((prev) => ({ ...prev, [teamId]: false }))
      }
    },
    [loadTeams]
  )

  const handleUpdateRole = useCallback(
    async (teamId: string, memberId: string, role: 'read' | 'write') => {
      const key = `${teamId}-${memberId}`
      setRoleLoading((prev) => ({ ...prev, [key]: true }))
      setError(null)
      try {
        await updateMemberRole(teamId, memberId, role)
        await loadTeams()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to update role')
      } finally {
        setRoleLoading((prev) => ({ ...prev, [key]: false }))
      }
    },
    [loadTeams]
  )

  const handleLeave = useCallback(
    async (team: Team) => {
      const ok = await confirm({
        title: 'Leave team',
        description: `Leave "${team.name}"? You will lose access to shared prompts.`,
        confirmLabel: 'Leave',
        variant: 'destructive',
      })
      if (!ok) return
      setError(null)
      try {
        await leaveTeam(team.id)
        await loadTeams()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to leave')
      }
    },
    [loadTeams, confirm]
  )

  const handleDelete = useCallback(
    async (team: Team) => {
      const ok = await confirm({
        title: 'Delete team',
        description: `Delete "${team.name}"? This cannot be undone. All shared prompts will be lost.`,
        confirmLabel: 'Delete',
        variant: 'destructive',
      })
      if (!ok) return
      setError(null)
      try {
        await deleteTeam(team.id)
        await loadTeams()
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to delete')
      }
    },
    [loadTeams, confirm]
  )

  const isOwner = (team: Team) => team.ownerId === user?.id

  const getMemberRole = (team: Team, memberId: string): 'read' | 'write' => {
    const member = team.members?.find((m) => m.userId === memberId)
    return (member?.role as 'read' | 'write') ?? 'write'
  }

  return (
    <AppLayout currentView={currentView} onNavigate={onNavigate} isConnected={isConnected} title="Teams">
      <div className="flex flex-col h-full overflow-hidden">
        <PageHeader
          title="Teams"
          subtitle="Share prompt library and saved prompts with your team"
          actions={
            <div className="flex items-center gap-2">
              <Input
                placeholder="New team name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                className="w-40 sm:w-48 h-9"
                disabled={creating}
              />
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={creating || !newTeamName.trim()}
                className="gap-1.5 shrink-0"
              >
                {creating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
                Create team
              </Button>
            </div>
          }
        />

        <PageContent>
          <div className="space-y-8">
          {error && <InlineAlert>{error}</InlineAlert>}

          {invites.length > 0 && (
            <section>
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1 mb-3">
                Pending invites
              </h2>
              <ul className="space-y-2">
                {invites.map((inv) => (
                  <li
                    key={inv.id}
                    className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3"
                  >
                    <div>
                      <p className="font-medium text-sm">{inv.teamName}</p>
                      <p className="text-xs text-muted-foreground">
                        Invited by {inv.inviterName ?? inv.inviterEmail ?? 'someone'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        size="sm"
                        variant="default"
                        className="gap-1"
                        onClick={() => handleAcceptInvite(inv.id)}
                        disabled={acceptingId === inv.id}
                      >
                        {acceptingId === inv.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Check className="w-3 h-3" />
                        )}
                        Accept
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="gap-1"
                        onClick={() => handleDeclineInvite(inv.id)}
                        disabled={decliningId === inv.id}
                      >
                        {decliningId === inv.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <X className="w-3 h-3" />
                        )}
                        Decline
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1 mb-3">
              Discover teams
            </h2>
            <div className="space-y-3">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Search teams by name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9"
                  />
                </div>
              </div>
              {searching && (
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </div>
              )}
              {searchResults.length > 0 && (
                <ul className="space-y-2">
                  {searchResults.map((team) => (
                    <li
                      key={team.id}
                      className="flex items-center justify-between gap-4 rounded-lg border bg-card px-4 py-3"
                    >
                      <div>
                        <p className="font-medium text-sm">{team.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
                        </p>
                      </div>
                      <Button
                        size="sm"
                        variant="secondary"
                        className="gap-1"
                        onClick={() => handleRequestJoin(team.id)}
                        disabled={requestingId === team.id}
                      >
                        {requestingId === team.id ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <UserPlus className="w-3 h-3" />
                        )}
                        Request to join
                      </Button>
                    </li>
                  ))}
                </ul>
              )}
              {searchQuery.length >= 2 && !searching && searchResults.length === 0 && (
                <p className="text-sm text-muted-foreground">No teams found</p>
              )}
            </div>
          </section>

          {loading ? (
            <LoadingSpinner size="lg" label="Loading teams..." className="py-16" />
          ) : teams.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="rounded-2xl bg-muted/50 p-6 mb-4">
                  <Users className="w-12 h-12 text-muted-foreground/60" />
                </div>
                <h2 className="font-medium text-base mb-1">No teams yet</h2>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Create a team to share your prompt library and saved prompts with colleagues. Invite members by
                  email or let others discover and request to join.
                </p>
                <div className="flex gap-2">
                  <Input
                    placeholder="Team name"
                    value={newTeamName}
                    onChange={(e) => setNewTeamName(e.target.value)}
                    className="w-48"
                  />
                  <Button
                    onClick={handleCreate}
                    disabled={creating || !newTeamName.trim()}
                    className="gap-2"
                  >
                    <Plus className="w-4 h-4" />
                    Create team
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <section>
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1 mb-3">
                Your teams
              </h2>
              <ul className="space-y-3">
                {teams.map((team) => (
                  <li
                    key={team.id}
                    className={cn(
                      'rounded-xl border bg-card overflow-hidden transition-colors',
                      'hover:border-border/80'
                    )}
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium text-sm flex items-center gap-2">
                            {team.name}
                            {isOwner(team) && (
                              <span className="text-[10px] font-normal text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                                Owner
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'} ·{' '}
                            {team.promptLibrary.length} categories · {team.savedPromptSets.length} saved sets
                          </p>
                        </div>
                        <div className="flex items-center gap-1 shrink-0">
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                              setPromptScope(team.id)
                              onNavigate('prompt-library')
                            }}
                          >
                            Prompt Library
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="gap-1.5"
                            onClick={() => {
                              setPromptScope(team.id)
                              onNavigate('saved')
                            }}
                          >
                            Saved prompts
                          </Button>
                        </div>
                      </div>

                      {isOwner(team) && (
                        <div className="mt-4 pt-4 border-t space-y-4">
                          <div className="flex flex-wrap items-center gap-2">
                            <Input
                              placeholder="Invite by email"
                              value={inviteEmail[team.id] ?? ''}
                              onChange={(e) =>
                                setInviteEmail((prev) => ({ ...prev, [team.id]: e.target.value }))
                              }
                              onKeyDown={(e) => e.key === 'Enter' && handleInvite(team.id)}
                              className="h-8 w-44 text-xs"
                            />
                            <Button
                              size="sm"
                              variant="secondary"
                              className="h-8 gap-1"
                              onClick={() => handleInvite(team.id)}
                              disabled={inviting[team.id] || !inviteEmail[team.id]?.trim()}
                            >
                              {inviting[team.id] ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : (
                                <UserPlus className="w-3 h-3" />
                              )}
                              Invite
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() => {
                                setExpandedTeamId((prev) => (prev === team.id ? null : team.id))
                                if (expandedTeamId !== team.id) {
                                  loadJoinRequests(team.id)
                                  loadTeamMembers(team.id)
                                }
                              }}
                            >
                              <Mail className="w-3 h-3" />
                              {joinRequests[team.id]?.length ?? 0} requests
                              <ChevronDown
                                className={cn('w-3 h-3 transition-transform', expandedTeamId === team.id && 'rotate-180')}
                              />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-8 gap-1"
                              onClick={() =>
                                handleToggleDiscoverable(team.id, team.isDiscoverable ?? false)
                              }
                              disabled={discoverableLoading[team.id]}
                              title={team.isDiscoverable ? 'Hide from search' : 'Allow others to find and request to join'}
                            >
                              {discoverableLoading[team.id] ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : team.isDiscoverable ? (
                                <Globe className="w-3 h-3 text-primary" />
                              ) : (
                                <GlobeLock className="w-3 h-3" />
                              )}
                              {team.isDiscoverable ? 'Discoverable' : 'Not discoverable'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(team)}
                            >
                              <Trash2 className="w-3 h-3 mr-1" />
                              Delete team
                            </Button>
                          </div>

                          {expandedTeamId === team.id && (
                            <div className="space-y-3">
                              {requestsLoading[team.id] ? (
                                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  Loading requests...
                                </div>
                              ) : (joinRequests[team.id] ?? []).length > 0 ? (
                                <div>
                                  <p className="text-xs font-medium text-muted-foreground mb-2">Join requests</p>
                                  <ul className="space-y-2">
                                    {(joinRequests[team.id] ?? []).map((req) => (
                                      <li
                                        key={req.id}
                                        className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2"
                                      >
                                        <span className="text-sm">
                                          {req.requesterName ?? req.requesterEmail ?? 'Unknown'}
                                        </span>
                                        <div className="flex gap-1">
                                          <Button
                                            size="sm"
                                            variant="default"
                                            className="h-7 gap-1"
                                            onClick={() => handleApproveRequest(team.id, req.id)}
                                          >
                                            <Check className="w-3 h-3" />
                                            Approve
                                          </Button>
                                          <Button
                                            size="sm"
                                            variant="outline"
                                            className="h-7 gap-1"
                                            onClick={() => handleRejectRequest(team.id, req.id)}
                                          >
                                            <X className="w-3 h-3" />
                                            Reject
                                          </Button>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground">No pending join requests</p>
                              )}

                              <div>
                                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1">
                                  <UserCog className="w-3 h-3" />
                                  Member roles
                                </p>
                                {membersLoading[team.id] ? (
                                  <div className="flex items-center gap-2 text-sm text-muted-foreground py-2">
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Loading members...
                                  </div>
                                ) : (
                                  <ul className="space-y-2">
                                    {(teamMembers[team.id] ?? [])
                                      .filter((m) => m.role !== 'owner')
                                      .map((member) => (
                                        <li
                                          key={member.userId}
                                          className="flex items-center justify-between gap-4 rounded-lg border bg-muted/30 px-3 py-2"
                                        >
                                          <span className="text-sm truncate text-muted-foreground" title={member.userId}>
                                            {member.name || member.email || 'Member'}
                                          </span>
                                          <Select
                                            value={getMemberRole(team, member.userId)}
                                            onValueChange={(role) =>
                                              handleUpdateRole(team.id, member.userId, role as 'read' | 'write')
                                            }
                                            disabled={roleLoading[`${team.id}-${member.userId}`]}
                                          >
                                            <SelectTrigger className="h-7 w-24">
                                              <SelectValue />
                                            </SelectTrigger>
                                            <SelectContent>
                                              <SelectItem value="read">Read only</SelectItem>
                                              <SelectItem value="write">Can edit</SelectItem>
                                            </SelectContent>
                                          </Select>
                                        </li>
                                      ))}
                                    {(teamMembers[team.id] ?? []).filter((m) => m.role !== 'owner').length === 0 && (
                                      <p className="text-sm text-muted-foreground">No members yet</p>
                                    )}
                                  </ul>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {!isOwner(team) && (
                        <div className="mt-4 pt-4 border-t">
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-8 text-muted-foreground"
                            onClick={() => handleLeave(team)}
                          >
                            <LogOut className="w-3 h-3 mr-1" />
                            Leave team
                          </Button>
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
          </div>
        </PageContent>
      </div>
    </AppLayout>
  )
}
