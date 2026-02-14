import { useState } from 'react'
import ChatLayout from '@/components/chat/ChatLayout'
import PromptTestingPage from '@/components/prompt-testing/PromptTestingPage'
import SavedPromptsPage from '@/components/saved-prompts/SavedPromptsPage'
import MCPPage from '@/components/mcp/MCPPage'
import MCPSavedPage from '@/components/mcp/MCPSavedPage'
import SkillsPage from '@/components/skills/SkillsPage'
import type { AppView } from '@/components/layout/Sidebar'

function App() {
  const [view, setView] = useState<AppView>('chat')

  if (view === 'chat') {
    return <ChatLayout currentView={view} onNavigate={setView} />
  }
  if (view === 'saved') {
    return <SavedPromptsPage currentView={view} onNavigate={setView} />
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
  return <PromptTestingPage currentView={view} onNavigate={setView} />
}

export default App
