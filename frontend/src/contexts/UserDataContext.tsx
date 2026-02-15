import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { useAuth } from '@/contexts/AuthContext'
import { fetchUserData, saveUserData, type UserDataPayload } from '@/lib/user-data-api'
import { fetchTeams, updateTeamPrompts, type Team } from '@/lib/teams-api'
import type { PromptCategory } from '@/lib/prompt-library'
import type { Skill } from '@/lib/skills'
import type { MCPSelection } from '@/lib/mcp-selection'
import type { SavedPromptSet, SavedPromptSetCategory } from '@/lib/saved-prompt-sets'

const DEFAULT_DATA: UserDataPayload = {
  skills: [],
  promptLibrary: [],
  mcpServers: {},
  mcpSelection: null,
  skillSelection: [],
  savedPromptSets: [],
  savedPromptSetCategories: [],
  llmProvider: 'openai',
}

export type PromptScope = 'personal' | string

interface UserDataContextValue extends UserDataPayload {
  loading: boolean
  teams: Team[]
  promptScope: PromptScope
  setPromptScope: (scope: PromptScope) => void
  canEditTeam: (teamId: string) => boolean
  updateSkills: (skills: Skill[]) => Promise<void>
  updatePromptLibrary: (promptLibrary: PromptCategory[]) => Promise<void>
  updateMCPServers: (mcpServers: Record<string, { command: string; args: string[] }>) => Promise<void>
  updateMCPSelection: (mcpSelection: MCPSelection | null) => Promise<void>
  updateSkillSelection: (skillSelection: string[]) => Promise<void>
  updateSavedPromptSets: (savedPromptSets: SavedPromptSet[]) => Promise<void>
  updateSavedPromptSetCategories: (savedPromptSetCategories: SavedPromptSetCategory[], scope?: PromptScope) => Promise<void>
  updateLLMProvider: (llmProvider: import('@/lib/user-data-api').LLMProvider) => Promise<void>
  refresh: () => Promise<void>
}

const UserDataContext = createContext<UserDataContextValue | null>(null)

export function UserDataProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [data, setData] = useState<UserDataPayload>(DEFAULT_DATA)
  const [teams, setTeams] = useState<Team[]>([])
  const [promptScope, setPromptScopeState] = useState<PromptScope>('personal')
  const [loading, setLoading] = useState(true)

  const setPromptScope = useCallback((scope: PromptScope) => {
    setPromptScopeState(scope)
  }, [])

  const refresh = useCallback(async () => {
    if (!user) {
      setData(DEFAULT_DATA)
      setTeams([])
      setLoading(false)
      return
    }
    setLoading(true)
    try {
      const [fetched, teamsData] = await Promise.all([fetchUserData(), fetchTeams()])
      setData(fetched)
      setTeams(teamsData)
    } catch {
      setData(DEFAULT_DATA)
      setTeams([])
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    refresh()
  }, [refresh])

  useEffect(() => {
    if (promptScope !== 'personal' && !teams.some((t) => t.id === promptScope)) {
      setPromptScopeState('personal')
    }
  }, [promptScope, teams])

  const save = useCallback(
    async (partial: Partial<UserDataPayload>) => {
      const next = { ...data, ...partial }
      setData(next)
      if (user) {
        try {
          const saved = await saveUserData(next)
          setData(saved)
        } catch {
          setData(data)
        }
      }
    },
    [data, user]
  )

  const updateSkills = useCallback(
    (skills: Skill[]) => save({ skills }),
    [save]
  )
  const updatePromptLibrary = useCallback(
    async (promptLibrary: PromptCategory[]) => {
      if (promptScope === 'personal') {
        await save({ promptLibrary })
      } else {
        const team = teams.find((t) => t.id === promptScope)
        if (team) {
          try {
            await updateTeamPrompts(promptScope, {
              promptLibrary,
              savedPromptSets: team.savedPromptSets,
              savedPromptSetCategories: team.savedPromptSetCategories,
            })
            setTeams((prev) =>
              prev.map((t) =>
                t.id === promptScope ? { ...t, promptLibrary } : t
              )
            )
          } catch {
            await refresh()
          }
        }
      }
    },
    [save, promptScope, teams, refresh]
  )
  const updateMCPServers = useCallback(
    (mcpServers: Record<string, { command: string; args: string[] }>) => save({ mcpServers }),
    [save]
  )
  const updateMCPSelection = useCallback(
    (mcpSelection: MCPSelection | null) => save({ mcpSelection }),
    [save]
  )
  const updateSkillSelection = useCallback(
    (skillSelection: string[]) => save({ skillSelection }),
    [save]
  )
  const updateLLMProvider = useCallback(
    (llmProvider: import('@/lib/user-data-api').LLMProvider) => save({ llmProvider }),
    [save]
  )

  const updateSavedPromptSets = useCallback(
    async (savedPromptSets: SavedPromptSet[]) => {
      const existing = data.savedPromptSetCategories
      const nextCategories: SavedPromptSetCategory[] =
        existing.length > 0
          ? (() => {
              const result: SavedPromptSetCategory[] = []
              const assigned = new Set<string>()
              for (const c of existing) {
                const catSets = savedPromptSets.filter((s) => {
                  const wasHere = c.sets.some((cs) => cs.id === s.id)
                  if (wasHere) assigned.add(s.id)
                  return wasHere
                })
                result.push({ ...c, sets: catSets, updatedAt: Date.now() })
              }
              const unassigned = savedPromptSets.filter((s) => !assigned.has(s.id))
              if (unassigned.length > 0 && result.length > 0) {
                result[0]!.sets.push(...unassigned)
              } else if (unassigned.length > 0) {
                result.push({ id: `cat-${Date.now()}`, name: 'General', sets: unassigned, createdAt: Date.now(), updatedAt: Date.now() })
              }
              return result
            })()
          : [{ id: `cat-${Date.now()}`, name: 'General', sets: savedPromptSets, createdAt: Date.now(), updatedAt: Date.now() }]
      if (promptScope === 'personal') {
        await save({ savedPromptSets, savedPromptSetCategories: nextCategories })
      } else {
        const team = teams.find((t) => t.id === promptScope)
        if (team) {
          try {
            await updateTeamPrompts(promptScope, {
              promptLibrary: team.promptLibrary,
              savedPromptSets,
              savedPromptSetCategories: nextCategories,
            })
            setTeams((prev) =>
              prev.map((t) =>
                t.id === promptScope ? { ...t, savedPromptSets, savedPromptSetCategories: nextCategories } : t
              )
            )
          } catch {
            await refresh()
          }
        }
      }
    },
    [save, promptScope, teams, refresh, data.savedPromptSetCategories]
  )

  const updateSavedPromptSetCategories = useCallback(
    async (savedPromptSetCategories: SavedPromptSetCategory[], targetScope?: PromptScope) => {
      const scope = targetScope ?? promptScope
      const savedPromptSets = savedPromptSetCategories.flatMap((c) => c.sets)
      if (scope === 'personal') {
        await save({ savedPromptSetCategories, savedPromptSets })
      } else {
        const team = teams.find((t) => t.id === scope)
        if (team) {
          try {
            await updateTeamPrompts(scope, {
              promptLibrary: team.promptLibrary,
              savedPromptSets,
              savedPromptSetCategories,
            })
            setTeams((prev) =>
              prev.map((t) =>
                t.id === scope ? { ...t, savedPromptSetCategories, savedPromptSets } : t
              )
            )
          } catch {
            await refresh()
          }
        }
      }
    },
    [save, promptScope, teams, refresh]
  )

  const effectivePromptLibrary =
    promptScope === 'personal'
      ? data.promptLibrary
      : teams.find((t) => t.id === promptScope)?.promptLibrary ?? data.promptLibrary
  const effectiveSavedPromptSets =
    promptScope === 'personal'
      ? data.savedPromptSets
      : teams.find((t) => t.id === promptScope)?.savedPromptSets ?? data.savedPromptSets
  const effectiveSavedPromptSetCategories =
    promptScope === 'personal'
      ? data.savedPromptSetCategories
      : teams.find((t) => t.id === promptScope)?.savedPromptSetCategories ?? data.savedPromptSetCategories

  const canEditTeam = useCallback(
    (teamId: string): boolean => {
      if (!user?.id) return false
      const team = teams.find((t) => t.id === teamId)
      if (!team) return false
      if (team.ownerId === user.id) return true
      const member = team.members?.find((m) => m.userId === user.id)
      return (member?.role ?? 'write') === 'write'
    },
    [teams, user?.id]
  )

  const value: UserDataContextValue = {
    ...data,
    promptLibrary: effectivePromptLibrary,
    savedPromptSets: effectiveSavedPromptSets,
    savedPromptSetCategories: effectiveSavedPromptSetCategories,
    loading,
    teams,
    promptScope,
    setPromptScope,
    canEditTeam,
    updateSkills,
    updatePromptLibrary,
    updateMCPServers,
    updateMCPSelection,
    updateSkillSelection,
    updateSavedPromptSets,
    updateSavedPromptSetCategories,
    updateLLMProvider,
    refresh,
  }

  return <UserDataContext.Provider value={value}>{children}</UserDataContext.Provider>
}

export function useUserData(): UserDataContextValue {
  const ctx = useContext(UserDataContext)
  if (!ctx) throw new Error('useUserData must be used within UserDataProvider')
  return ctx
}
