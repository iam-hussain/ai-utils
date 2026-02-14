import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { MessageSquare, FlaskConical, FolderOpen, Settings, Plus, Plug, PlugZap, FileCode } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chat } from '@/lib/chat-history'

export type AppView = 'chat' | 'prompts' | 'saved' | 'mcp' | 'mcp-saved' | 'skills'

interface SidebarProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
  isConnected: boolean
  chats?: Chat[]
  currentChatId?: string | null
  onNewChat?: () => void
  onSelectChat?: (id: string) => void
}

export function Sidebar({
  currentView,
  onNavigate,
  isConnected,
  chats = [],
  currentChatId,
  onNewChat,
  onSelectChat,
}: SidebarProps) {
  return (
    <aside className="w-64 border-r bg-muted/20 hidden md:flex flex-col">
      <div className="p-4 border-b flex items-center justify-between">
        <h2 className="font-semibold text-lg tracking-tight">AI Utils</h2>
        {currentView === 'chat' && onNewChat ? (
          <Button variant="ghost" size="icon" onClick={onNewChat} aria-label="New chat">
            <Plus className="w-5 h-5" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon">
            <Plus className="w-5 h-5" />
          </Button>
        )}
      </div>
      <ScrollArea className="flex-1 p-2">
        <div className="space-y-1">
          <Button
            variant={currentView === 'chat' ? 'secondary' : 'ghost'}
            className="w-full justify-start text-left truncate font-normal"
            onClick={() => onNavigate('chat')}
          >
            <MessageSquare className="w-4 h-4 mr-2 shrink-0" />
            Chat
          </Button>
          {currentView === 'chat' && chats.length > 0 && (
            <div className="pl-6 pr-2 py-1 space-y-0.5">
              {chats.map((chat) => (
                <Button
                  key={chat.id}
                  variant={currentChatId === chat.id ? 'secondary' : 'ghost'}
                  className="w-full justify-start text-left truncate font-normal text-xs h-8"
                  onClick={() => onSelectChat?.(chat.id)}
                >
                  {chat.title}
                </Button>
              ))}
            </div>
          )}
          <Button
            variant={currentView === 'prompts' ? 'secondary' : 'ghost'}
            className="w-full justify-start text-left truncate font-normal text-muted-foreground data-[variant=secondary]:text-foreground"
            onClick={() => onNavigate('prompts')}
          >
            <FlaskConical className="w-4 h-4 mr-2 shrink-0" />
            Prompt Testing
          </Button>
          <Button
            variant={currentView === 'saved' ? 'secondary' : 'ghost'}
            className="w-full justify-start text-left truncate font-normal text-muted-foreground data-[variant=secondary]:text-foreground"
            onClick={() => onNavigate('saved')}
          >
            <FolderOpen className="w-4 h-4 mr-2 shrink-0" />
            Saved prompts
          </Button>
          <Button
            variant={currentView === 'mcp' ? 'secondary' : 'ghost'}
            className="w-full justify-start text-left truncate font-normal text-muted-foreground data-[variant=secondary]:text-foreground"
            onClick={() => onNavigate('mcp')}
          >
            <Plug className="w-4 h-4 mr-2 shrink-0" />
            MCP Server
          </Button>
          <Button
            variant={currentView === 'mcp-saved' ? 'secondary' : 'ghost'}
            className="w-full justify-start text-left truncate font-normal text-muted-foreground data-[variant=secondary]:text-foreground pl-6"
            onClick={() => onNavigate('mcp-saved')}
          >
            <PlugZap className="w-4 h-4 mr-2 shrink-0" />
            Saved MCP servers
          </Button>
          <Button
            variant={currentView === 'skills' ? 'secondary' : 'ghost'}
            className="w-full justify-start text-left truncate font-normal text-muted-foreground data-[variant=secondary]:text-foreground"
            onClick={() => onNavigate('skills')}
          >
            <FileCode className="w-4 h-4 mr-2 shrink-0" />
            Skills
          </Button>
        </div>
      </ScrollArea>
      <div className="p-4 border-t space-y-2">
        <Button variant="outline" className="w-full justify-start">
          <Settings className="w-4 h-4 mr-2" /> Settings
        </Button>
        <div className="flex items-center gap-2 text-xs text-muted-foreground px-2">
          <div
            className={cn(
              'w-2 h-2 rounded-full',
              isConnected ? 'bg-green-500' : 'bg-red-500'
            )}
          />
          {isConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>
    </aside>
  )
}
