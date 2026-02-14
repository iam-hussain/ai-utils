import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Sidebar, type AppView } from '@/components/layout/Sidebar'
import { socket } from '@/lib/socket'
import {
  loadSavedPromptSets,
  saveSavedPromptSets,
  setPromptSetToLoad,
  type SavedPromptSet,
} from '@/lib/saved-prompt-sets'
import { Pencil, Eye, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SavedPromptsPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function SavedPromptsPage({
  currentView,
  onNavigate,
}: SavedPromptsPageProps) {
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [sets, setSets] = useState<SavedPromptSet[]>(loadSavedPromptSets)

  useEffect(() => {
    saveSavedPromptSets(sets)
  }, [sets])

  useEffect(() => {
    function onConnect() {
      setIsConnected(true)
    }
    function onDisconnect() {
      setIsConnected(false)
    }
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    if (!socket.connected) socket.connect()
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

  const handleView = (set: SavedPromptSet) => {
    setPromptSetToLoad(set)
    onNavigate('prompts')
  }

  const handleEdit = (set: SavedPromptSet) => {
    setPromptSetToLoad(set)
    onNavigate('prompts')
  }

  const handleDelete = (id: string) => {
    setSets((prev) => prev.filter((s) => s.id !== id))
  }

  return (
    <div className="flex h-screen w-full bg-background overflow-hidden font-sans">
      <Sidebar currentView={currentView} onNavigate={onNavigate} isConnected={isConnected} />

      <main className="flex-1 flex flex-col min-w-0 bg-background overflow-hidden">
        <header className="h-14 border-b flex items-center px-6 bg-background/50 backdrop-blur sticky top-0 z-10">
          <h1 className="font-semibold text-sm">Saved prompts</h1>
        </header>

        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto p-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Saved prompt sets</CardTitle>
              </CardHeader>
              <CardContent>
                {sets.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No saved prompt sets yet. Save a set from Prompt Testing.</p>
                ) : (
                  <ul className="space-y-3">
                    {sets.map((set) => (
                      <li
                        key={set.id}
                        className="flex flex-col gap-2 rounded-lg border p-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm truncate">
                            {set.name || 'Untitled'}
                          </span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleView(set)}
                              aria-label="View prompt set"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => handleEdit(set)}
                              aria-label="Edit prompt set"
                            >
                              <Pencil className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(set.id)}
                              aria-label="Delete prompt set"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-1">
                          {set.messages.map((m, i) => (
                            <span
                              key={i}
                              className={cn(
                                'text-[10px] uppercase tracking-wider font-semibold px-1.5 py-0.5 rounded',
                                m.type === 'human' && 'bg-primary/20 text-primary-foreground',
                                m.type === 'system' && 'bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-200',
                                m.type === 'ai' && 'bg-muted text-muted-foreground',
                                m.type === 'tool' && 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-300',
                                m.type === 'function' && 'bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300',
                                m.type === 'chat' && 'bg-teal-100 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300'
                              )}
                            >
                              {m.type}
                            </span>
                          ))}
                        </div>
                        <p className="text-sm text-muted-foreground line-clamp-2 break-words">
                          {set.messages.map((m) => m.content).join(' · ')}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
      </main>
    </div>
  )
}
