import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Plus } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { Chat } from '@/lib/chat-history'

interface ChatHistorySidebarProps {
  chats: Chat[]
  currentChatId: string | null
  onSelectChat: (id: string) => void
  onNewChat: () => void
}

export function ChatHistorySidebar({
  chats,
  currentChatId,
  onSelectChat,
  onNewChat,
}: ChatHistorySidebarProps) {
  return (
    <aside className="w-52 shrink-0 border-r bg-muted/20 flex flex-col hidden md:flex">
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
              <Button
                key={chat.id}
                variant={currentChatId === chat.id ? 'secondary' : 'ghost'}
                size="sm"
                className={cn(
                  'w-full justify-start font-normal h-8 text-xs px-2',
                  currentChatId !== chat.id && 'text-muted-foreground hover:text-foreground'
                )}
                onClick={() => onSelectChat(chat.id)}
              >
                <span className="truncate flex-1 text-left">{chat.title}</span>
              </Button>
            ))
          )}
        </nav>
      </ScrollArea>
    </aside>
  )
}
