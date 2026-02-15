import { useState } from 'react'
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
  if (view === 'chat') {
    return <ChatLayout currentView={view} onNavigate={setView} />
  }
  if (view === 'saved') {
    return <SavedPromptsPage currentView={view} onNavigate={setView} />
  }
  if (view === 'prompt-library') {
    return <PromptLibraryPage currentView={view} onNavigate={setView} />
  }
  if (view === 'mcp') {
    return <MCPPage currentView={view} onNavigate={setView} />
  }
  if (view === 'mcp-saved') {
    return <MCPSavedPage currentView={view} onNavigate={setView} />
  }
  if (view === 'skills') {
    return <SkillsPage currentView={view} onNavigate={setView} />
  }
  if (view === 'teams') {
    return <TeamsPage currentView={view} onNavigate={setView} />
  }
  if (view === 'agent-architect') {
    return <NexusArchitectPage currentView={view} onNavigate={setView} />
  }
  return <PromptTestingPage currentView={view} onNavigate={setView} />
}

export default App
