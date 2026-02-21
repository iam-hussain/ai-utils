import type React from 'react'
import { useEffect } from 'react'
import { BrowserRouter, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuth } from '@/contexts/AuthContext'
import { UserDataProvider } from '@/contexts/UserDataContext'
import { ConfirmProvider } from '@/contexts/ConfirmContext'
import { AuthPage } from '@/components/auth/AuthPage'
import ChatLayout from '@/components/chat/ChatLayout'
import PromptTestingPage from '@/components/prompt-testing/PromptTestingPage'
import SavedPromptsPage from '@/components/saved-prompts/SavedPromptsPage'
import PromptLibraryPage from '@/components/prompt-library/PromptLibraryPage'
import MCPPage from '@/components/mcp/MCPPage'
import MCPSavedPage from '@/components/mcp/MCPSavedPage'
import SkillsPage from '@/components/skills/SkillsPage'
import TeamsPage from '@/components/teams/TeamsPage'
import ProjectsPage from '@/components/projects/ProjectsPage'
import IssuesPage from '@/components/issues/IssuesPage'
import IssueCreatePage from '@/components/issues/IssueCreatePage'
import NexusArchitectPage from '@/components/nexus-architect/NexusArchitectPage'
import SettingsPage from '@/components/settings/SettingsPage'
import type { AppView } from '@/components/layout/AppLayout'
import { isNexusArchitectEnabled } from '@/lib/feature-flags'
import { VIEW_PATHS, pathToView, DEFAULT_PATH } from '@/lib/routes'

const ROUTE_MAP: Record<
  Exclude<AppView, 'agent-architect' | 'issues-new'>,
  React.ComponentType<{ currentView: AppView; onNavigate: (v: AppView) => void }>
> = {
  chat: ChatLayout,
  prompts: PromptTestingPage,
  saved: SavedPromptsPage,
  'prompt-library': PromptLibraryPage,
  mcp: MCPPage,
  'mcp-saved': MCPSavedPage,
  skills: SkillsPage,
  teams: TeamsPage,
  projects: ProjectsPage,
  issues: IssuesPage,
  settings: SettingsPage,
}

function App() {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-3 bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" aria-hidden />
        <p className="text-sm text-muted-foreground">Loading...</p>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <BrowserRouter>
      <UserDataProvider>
        <ConfirmProvider>
          <AppContent />
        </ConfirmProvider>
      </UserDataProvider>
    </BrowserRouter>
  )
}

function AppContent() {
  const location = useLocation()
  const navigate = useNavigate()
  const pathname = location.pathname.replace(/\/$/, '') || '/'
  if (pathname === '/' || pathname === '') {
    return <Navigate to={DEFAULT_PATH} replace />
  }
  const view = pathToView(location.pathname) ?? 'chat'

  const setView = (v: AppView) => {
    navigate(VIEW_PATHS[v])
  }

  useEffect(() => {
    if (view === 'agent-architect' && !isNexusArchitectEnabled) {
      navigate(DEFAULT_PATH)
    }
  }, [view, navigate])

  if (view === 'agent-architect') {
    if (!isNexusArchitectEnabled) {
      return <ChatLayout currentView="chat" onNavigate={setView} />
    }
    return <NexusArchitectPage currentView={view} onNavigate={setView} />
  }

  if (view === 'issues-new') {
    return <IssueCreatePage currentView="issues" onNavigate={setView} />
  }

  const Page = ROUTE_MAP[view] ?? ChatLayout
  return <Page currentView={view} onNavigate={setView} />
}

export default App
