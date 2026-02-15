import type React from 'react'
import { useState, useEffect } from 'react'
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
import NexusArchitectPage from '@/components/nexus-architect/NexusArchitectPage'
import type { AppView } from '@/components/layout/AppLayout'
import { isNexusArchitectEnabled } from '@/lib/feature-flags'

const ROUTE_MAP: Record<
  Exclude<AppView, 'agent-architect'>,
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
}

function App() {
  const { user, loading } = useAuth()
  const [view, setView] = useState<AppView>('chat')

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return <AuthPage />
  }

  return (
    <UserDataProvider>
      <ConfirmProvider>
        <AppContent view={view} setView={setView} />
      </ConfirmProvider>
    </UserDataProvider>
  )
}

function AppContent({
  view,
  setView,
}: {
  view: AppView
  setView: (v: AppView) => void
}) {
  useEffect(() => {
    if (view === 'agent-architect' && !isNexusArchitectEnabled) {
      setView('chat')
    }
  }, [view, setView])

  if (view === 'agent-architect') {
    if (!isNexusArchitectEnabled) {
      return <ChatLayout currentView="chat" onNavigate={setView} />
    }
    return <NexusArchitectPage currentView={view} onNavigate={setView} />
  }

  const Page = ROUTE_MAP[view] ?? PromptTestingPage
  return <Page currentView={view} onNavigate={setView} />
}

export default App
