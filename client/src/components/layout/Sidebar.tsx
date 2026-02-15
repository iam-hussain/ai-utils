import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  MessageSquare,
  FlaskConical,
  FolderOpen,
  Library,
  Plug,
  PlugZap,
  FileCode,
  ChevronRight,
  Users,
  Workflow,
} from 'lucide-react'
import { cn } from '@/lib/utils'
export type AppView = 'chat' | 'prompts' | 'saved' | 'prompt-library' | 'mcp' | 'mcp-saved' | 'skills' | 'teams' | 'agent-architect'

interface SidebarProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
  isConnected?: boolean
  embedded?: boolean
}

const NAV_GROUPS = [
  {
    label: 'Chat',
    items: [
      { id: 'chat' as const, label: 'Chat', icon: MessageSquare },
    ],
  },
  {
    label: 'Prompts',
    items: [
      { id: 'prompts' as const, label: 'Prompt Testing', icon: FlaskConical },
      { id: 'saved' as const, label: 'Saved prompts', icon: FolderOpen },
      { id: 'prompt-library' as const, label: 'Prompt Library', icon: Library },
    ],
  },
  {
    label: 'Team',
    items: [
      { id: 'teams' as const, label: 'Teams', icon: Users },
      { id: 'agent-architect' as const, label: 'Nexus Architect', icon: Workflow },
    ],
  },
  {
    label: 'Integrations',
    items: [
      { id: 'mcp' as const, label: 'MCP Server', icon: Plug },
      { id: 'mcp-saved' as const, label: 'Saved MCP', icon: PlugZap },
      { id: 'skills' as const, label: 'Skills', icon: FileCode },
    ],
  },
] as const

export function Sidebar({
  currentView,
  onNavigate,
  embedded = false,
}: SidebarProps) {
  const content = (
    <ScrollArea className="flex-1">
      <nav className="p-3 space-y-6">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="space-y-1">
            <h3 className="px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
              {group.label}
            </h3>
            <div className="space-y-0.5">
              {group.items.map((item) => {
                const isActive = currentView === item.id
                const Icon = item.icon
                return (
                  <Button
                    key={item.id}
                    variant={isActive ? 'secondary' : 'ghost'}
                    size="sm"
                    className={cn(
                      'w-full justify-start font-normal h-9',
                      !isActive && 'text-muted-foreground hover:text-foreground'
                    )}
                    onClick={() => onNavigate(item.id)}
                  >
                    <Icon className="w-4 h-4 mr-2.5 shrink-0" />
                    <span className="truncate flex-1 text-left">{item.label}</span>
                    {isActive && <ChevronRight className="w-3.5 h-3.5 shrink-0 opacity-60" />}
                  </Button>
                )
              })}
            </div>
          </div>
        ))}
      </nav>
    </ScrollArea>
  )

  if (embedded) {
    return <div className="w-56 flex flex-col">{content}</div>
  }

  return (
    <aside className="w-56 shrink-0 border-r bg-muted/30 flex flex-col hidden md:flex">
      {content}
    </aside>
  )
}
