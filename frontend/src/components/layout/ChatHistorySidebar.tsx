import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chat } from '@/lib/chat-history'

interface ChatHistorySidebarProps {
  chats: Chat[]
  currentChatId: string | null
  onSelectChat: (id: string) => void
  onNewChat: () => void
  onDeleteChat?: (id: string) => void
  onClearAllHistory?: () => void
  /** When true, renders without aside wrapper (for use inside Sheet) */
  embedded?: boolean
}

export function ChatHistorySidebar({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
  onDeleteChat,
  onClearAllHistory,
  embedded = false,
}: ChatHistorySidebarProps) {
  const content = (
    <>
      <div className="p-2 border-b shrink-0">
        <Button
          size="sm"
          variant="outline"
          className="w-full gap-2"
          onClick={onNewChat}
        >
          <Plus className="w-4 h-4" />
          New chat
        </Button>
      </div>
      <ScrollArea className="flex-1">
        <nav className="p-2 space-y-0.5">
          <h3 className="px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            History
          </h3>
          {chats.length === 0 ? (
            <p className="px-2 py-2 text-xs text-muted-foreground">No chats yet</p>
          ) : (
            chats.map((chat) => (
              <div
                key={chat.id}
                className={cn(
                  'group flex items-center gap-1 rounded-md',
                  currentChatId === chat.id && 'bg-secondary'
                )}
              >
                <Button
                  variant={currentChatId === chat.id ? 'secondary' : 'ghost'}
                  size="sm"
                  className={cn(
                    'flex-1 min-w-0 justify-start font-normal h-8 text-xs px-2',
                    currentChatId !== chat.id && 'text-muted-foreground hover:text-foreground'
                  )}
                  onClick={() => onSelectChat(chat.id)}
                >
                  <span className="truncate flex-1 text-left">{chat.title}</span>
                </Button>
                {onDeleteChat && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 shrink-0 opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive transition-opacity"
                    onClick={(e) => {
                      e.stopPropagation()
                      onDeleteChat(chat.id)
                    }}
                    aria-label={`Delete ${chat.title}`}
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                )}
              </div>
            ))
          )}
        </nav>
      </ScrollArea>
      {onClearAllHistory && chats.length > 0 && (
        <div className="p-2 border-t shrink-0">
          <Button
            size="sm"
            variant="ghost"
            className="w-full gap-2 text-muted-foreground hover:text-destructive"
            onClick={onClearAllHistory}
          >
            <Trash2 className="w-4 h-4" />
            Clear all history
          </Button>
        </div>
      )}
    </>
  )

  if (embedded) {
    return <div className="w-full flex flex-col flex-1 min-h-0">{content}</div>
  }

  return (
    <aside className="w-52 shrink-0 border-r bg-muted/20 hidden md:flex md:flex-col">
      {content}
    </aside>
  )
}
