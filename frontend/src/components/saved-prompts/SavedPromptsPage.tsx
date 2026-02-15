import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { socket } from '@/lib/socket'
import { useUserData } from '@/contexts/UserDataContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { setPromptSetToLoad } from '@/lib/saved-prompt-sets'
import { createSavedPromptSetCategory, type SavedPromptSet } from '@/lib/saved-prompt-sets'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import { Pencil, Eye, Trash2, FolderOpen, FolderPlus, ArrowRight, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

function formatRelativeTime(ts: number): string {
  const diff = Date.now() - ts
  if (diff < 60_000) return 'Just now'
  if (diff < 3600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86400_000) return `${Math.floor(diff / 3600_000)}h ago`
  if (diff < 604800_000) return `${Math.floor(diff / 86400_000)}d ago`
  return new Date(ts).toLocaleDateString()
}

interface SavedPromptsPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function SavedPromptsPage({
  currentView,
  onNavigate,
}: SavedPromptsPageProps) {
  const {
    savedPromptSetCategories: categories,
    updateSavedPromptSetCategories,
    teams,
    promptScope,
    setPromptScope,
    canEditTeam,
  } = useUserData()
  const { confirm } = useConfirm()
  const isTeamReadOnly = promptScope !== 'personal' && !canEditTeam(promptScope)
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)
  const sets = selectedCategory?.sets ?? []
  const totalSets = categories.reduce((acc, c) => acc + c.sets.length, 0)

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

  useEffect(() => {
    if (categories.length > 0 && !selectedCategoryId) {
      setSelectedCategoryId(categories[0]!.id)
    }
    if (selectedCategoryId && !categories.some((c) => c.id === selectedCategoryId)) {
      setSelectedCategoryId(categories[0]?.id ?? null)
    }
  }, [categories, selectedCategoryId])

  const handleAddCategory = useCallback(() => {
    if (!newCategoryName.trim()) return
    const cat = createSavedPromptSetCategory(newCategoryName.trim())
    updateSavedPromptSetCategories([...categories, cat])
    setSelectedCategoryId(cat.id)
    setNewCategoryName('')
    setIsAddingCategory(false)
  }, [newCategoryName, categories, updateSavedPromptSetCategories])

  const handleView = useCallback(
    (set: SavedPromptSet) => {
      setPromptSetToLoad(set)
      onNavigate('prompts')
    },
    [onNavigate]
  )

  const handleEdit = useCallback(
    (set: SavedPromptSet) => {
      setPromptSetToLoad(set)
      onNavigate('prompts')
    },
    [onNavigate]
  )

  const handleDeleteSet = useCallback(
    async (set: SavedPromptSet) => {
      if (!selectedCategoryId) return
      const ok = await confirm({
        title: 'Delete set',
        description: `Delete "${set.name || 'Untitled'}"? This cannot be undone.`,
        confirmLabel: 'Delete',
        variant: 'destructive',
      })
      if (!ok) return
      const nextCategories = categories.map((c) =>
        c.id === selectedCategoryId
          ? { ...c, sets: c.sets.filter((s) => s.id !== set.id), updatedAt: Date.now() }
          : c
      )
      updateSavedPromptSetCategories(nextCategories)
    },
    [selectedCategoryId, categories, updateSavedPromptSetCategories, confirm]
  )

  const handleDeleteCategory = useCallback(
    async (id: string) => {
      const ok = await confirm({
        title: 'Delete category',
        description: 'Delete this category and all its sets?',
        confirmLabel: 'Delete',
        variant: 'destructive',
      })
      if (!ok) return
      updateSavedPromptSetCategories(categories.filter((c) => c.id !== id))
      if (selectedCategoryId === id) setSelectedCategoryId(categories.find((c) => c.id !== id)?.id ?? null)
    },
    [selectedCategoryId, categories, updateSavedPromptSetCategories, confirm]
  )

  const categorySidebarContent = (
    <>
      {!isTeamReadOnly && (
        <div className="p-3 border-b">
          <Button
            variant="outline"
            size="sm"
            className="w-full gap-2"
            onClick={() => setIsAddingCategory(true)}
          >
            <FolderPlus className="w-4 h-4" />
            Add category
          </Button>
        </div>
      )}
      {!isTeamReadOnly && isAddingCategory && (
        <div className="p-3 border-b flex gap-2">
          <Input
            placeholder="Category name"
            value={newCategoryName}
            onChange={(e) => setNewCategoryName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleAddCategory()}
            className="h-8 text-sm"
            autoFocus
          />
          <Button size="sm" onClick={handleAddCategory}>
            Add
          </Button>
        </div>
      )}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-0.5">
          {categories.map((cat) => (
            <div
              key={cat.id}
              className={cn(
                'group flex items-center gap-2 rounded-md px-2 py-1.5 cursor-pointer',
                selectedCategoryId === cat.id && 'bg-primary/10 text-primary'
              )}
            >
              <button
                type="button"
                className="flex-1 flex items-center gap-2 min-w-0 text-left"
                onClick={() => {
                  setSelectedCategoryId(cat.id)
                  setCategorySheetOpen(false)
                }}
              >
                <FolderOpen className="w-4 h-4 shrink-0" />
                <span className="truncate text-sm">{cat.name}</span>
                <span className="text-xs text-muted-foreground shrink-0">
                  {cat.sets.length}
                </span>
              </button>
              {!isTeamReadOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 opacity-0 group-hover:opacity-100"
                  onClick={(e) => {
                    e.stopPropagation()
                    handleDeleteCategory(cat.id)
                  }}
                  aria-label="Delete category"
                >
                  <Trash2 className="w-3 h-3" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </ScrollArea>
    </>
  )

  return (
    <AppLayout currentView={currentView} onNavigate={onNavigate} isConnected={isConnected}>
      <header className="h-12 shrink-0 border-b flex items-center justify-between px-4 sm:px-6 gap-2 sm:gap-4 bg-background/50 backdrop-blur sticky top-0 z-10">
        <div className="flex items-center gap-2 sm:gap-4 min-w-0">
          <Sheet open={categorySheetOpen} onOpenChange={setCategorySheetOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-9 w-9 shrink-0" aria-label="Categories">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0 flex flex-col">
              <SheetHeader className="sr-only">
                <SheetTitle>Categories</SheetTitle>
              </SheetHeader>
              <div className="pt-6 flex flex-col flex-1 min-h-0 overflow-hidden">
                {categorySidebarContent}
              </div>
            </SheetContent>
          </Sheet>
          <Select value={promptScope} onValueChange={setPromptScope}>
            <SelectTrigger className="w-[140px] sm:w-[180px] h-8 text-xs shrink-0">
              <SelectValue placeholder="Scope" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="personal">Personal</SelectItem>
              {teams.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  Team: {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <div>
            <h1 className="font-semibold text-sm">Saved prompts</h1>
            <p className="text-xs text-muted-foreground">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
              {selectedCategory && ` · ${totalSets} sets`}
            </p>
          </div>
        </div>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5"
          onClick={() => onNavigate('prompts')}
        >
          <ArrowRight className="w-3.5 h-3.5" />
          Prompt Testing
        </Button>
      </header>

      {totalSets === 0 && categories.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-16 px-6 text-center">
          <div className="rounded-2xl bg-muted/50 p-8 mb-6">
            <FolderOpen className="w-14 h-14 text-muted-foreground/60" />
          </div>
          <h2 className="font-semibold text-lg mb-2">No prompt sets yet</h2>
          <p className="text-sm text-muted-foreground max-w-sm mb-6">
            Create and save prompt sets from Prompt Testing. They’ll appear here for quick access.
          </p>
          <Button onClick={() => onNavigate('prompts')} className="gap-2">
            <ArrowRight className="w-4 h-4" />
            Go to Prompt Testing
          </Button>
        </div>
      ) : (
        <div className="flex-1 flex min-h-0">
          <aside className="hidden md:flex w-56 shrink-0 border-r flex-col bg-muted/20">
            {categorySidebarContent}
          </aside>

          <ScrollArea className="flex-1 min-w-0">
            <div className="max-w-4xl mx-auto p-4 sm:p-6">
              {selectedCategory && sets.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-16 px-6 text-center">
                  <p className="text-sm text-muted-foreground mb-4">
                    No sets in &quot;{selectedCategory.name}&quot;. Save from Prompt Testing.
                  </p>
                  <Button onClick={() => onNavigate('prompts')} variant="outline" className="gap-2">
                    <ArrowRight className="w-4 h-4" />
                    Prompt Testing
                  </Button>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {sets.map((set) => (
                    <div
                      key={set.id}
                      className={cn(
                        'group rounded-xl border bg-card overflow-hidden transition-all duration-200',
                        'hover:border-border/80 hover:shadow-md hover:shadow-black/5',
                        'focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2'
                      )}
                    >
                      <div className="p-4">
                        <div className="flex items-start justify-between gap-3 mb-3">
                          <h3 className="font-medium text-sm truncate flex-1 min-w-0">
                            {set.name || 'Untitled'}
                          </h3>
                          <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8 text-muted-foreground hover:text-foreground"
                              onClick={() => handleView(set)}
                              aria-label="View"
                            >
                              <Eye className="w-4 h-4" />
                            </Button>
                            {!isTeamReadOnly && (
                              <>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                  onClick={() => handleEdit(set)}
                                  aria-label="Edit"
                                >
                                  <Pencil className="w-4 h-4" />
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-destructive"
                                  onClick={() => handleDeleteSet(set)}
                                  aria-label="Delete"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap gap-1.5 mb-3">
                          {set.messages.map((m, i) => (
                            <span
                              key={i}
                              className={cn(
                                'text-[10px] font-medium uppercase tracking-wider px-2 py-0.5 rounded-md',
                                m.type === 'human' && 'bg-primary/15 text-primary',
                                m.type === 'system' && 'bg-amber-500/15 text-amber-700 dark:text-amber-400',
                                m.type === 'ai' && 'bg-muted text-muted-foreground',
                                m.type === 'tool' && 'bg-sky-500/15 text-sky-700 dark:text-sky-400',
                                m.type === 'function' && 'bg-indigo-500/15 text-indigo-700 dark:text-indigo-400',
                                m.type === 'chat' && 'bg-teal-500/15 text-teal-700 dark:text-teal-400'
                              )}
                            >
                              {m.type}
                            </span>
                          ))}
                        </div>

                        <p className="text-xs text-muted-foreground line-clamp-2 break-words leading-relaxed">
                          {set.messages.map((m) => m.content).join(' · ') || 'Empty'}
                        </p>

                        <div className="flex items-center justify-between mt-4 pt-3 border-t">
                          <span className="text-[11px] text-muted-foreground">
                            {formatRelativeTime(set.createdAt)}
                          </span>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs gap-1 -mr-2"
                            onClick={() => handleView(set)}
                          >
                            Open
                            <ArrowRight className="w-3 h-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
    </AppLayout>
  )
}
