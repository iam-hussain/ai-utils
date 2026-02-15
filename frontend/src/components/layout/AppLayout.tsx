import type { Chat } from '@/lib/chat-history'
import { Sidebar, type AppView } from './Sidebar'
import { ChatHistorySidebar } from './ChatHistorySidebar'
import { TopBar } from './TopBar'

export type { AppView } from './Sidebar'

interface AppLayoutProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
  isConnected: boolean
  title?: string
  headerActions?: React.ReactNode
  children: React.ReactNode
  chats?: Chat[]
  currentChatId?: string | null
  onSelectChat?: (id: string) => void
  onNewChat?: () => void
  onDeleteChat?: (id: string) => void
  onClearAllHistory?: () => void
}

export function AppLayout({
  currentView,
  onNavigate,
  isConnected,
  title,
  headerActions,
  children,
  chats = [],
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClearAllHistory,
}: AppLayoutProps) {
  const showChatHistory = currentView === 'chat' && onSelectChat && onNewChat

  return (
    <div className="flex flex-col h-dvh h-screen min-h-0 w-full max-w-full bg-background overflow-hidden font-sans">
      <TopBar
        title={title}
        isConnected={isConnected}
        actions={headerActions}
        sidebarContent={
          <Sidebar
            currentView={currentView}
            onNavigate={onNavigate}
            embedded
          />
        }
      />
      <div className="flex flex-1 min-h-0">
        <Sidebar
          currentView={currentView}
          onNavigate={onNavigate}
        />
        {showChatHistory && (
          <div className="hidden md:flex shrink-0">
            <ChatHistorySidebar
              chats={chats}
              currentChatId={currentChatId ?? null}
              onSelectChat={onSelectChat}
              onNewChat={onNewChat}
              onDeleteChat={onDeleteChat}
              onClearAllHistory={onClearAllHistory}
            />
          </div>
        )}
        <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {children}
        </main>
      </div>
    </div>
  )
}
