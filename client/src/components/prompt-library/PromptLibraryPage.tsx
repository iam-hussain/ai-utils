import { useState, useEffect, useCallback, useRef } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { useUserData } from '@/contexts/UserDataContext'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  createCategory,
  createPrompt,
  type PromptEntry,
  type ChainStep,
} from '@/lib/prompt-library'
import { setPromptFromLibrary } from '@/lib/prompt-library-load'
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet'
import {
  FolderPlus,
  Plus,
  Pencil,
  Trash2,
  Play,
  ArrowRight,
  FolderOpen,
  FileText,
  Link2,
  Menu,
} from 'lucide-react'
import { useConfirm } from '@/contexts/ConfirmContext'
import { cn } from '@/lib/utils'

interface PromptLibraryPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function PromptLibraryPage({
  currentView,
  onNavigate,
}: PromptLibraryPageProps) {
  const { promptLibrary: categories, updatePromptLibrary, teams, promptScope, setPromptScope, llmProvider, canEditTeam } = useUserData()
  const { confirm } = useConfirm()
  const isTeamReadOnly = promptScope !== 'personal' && !canEditTeam(promptScope)
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [selectedCategoryId, setSelectedCategoryId] = useState<string | null>(null)
  const [editingPromptId, setEditingPromptId] = useState<string | null>(null)
  const [newCategoryName, setNewCategoryName] = useState('')
  const [promptName, setPromptName] = useState('')
  const [promptText, setPromptText] = useState('')
  const [expectedReply, setExpectedReply] = useState('')
  const [chainSteps, setChainSteps] = useState<ChainStep[]>([])
  const [runningPromptId, setRunningPromptId] = useState<string | null>(null)
  const chainRunRef = useRef<{
    promptId: string
    stepIndex: number
    messages: Array<{ type: 'human' | 'ai'; content: string }>
    chainSteps: ChainStep[]
  } | null>(null)
  const [isAddingPrompt, setIsAddingPrompt] = useState(false)
  const [isAddingCategory, setIsAddingCategory] = useState(false)
  const [categorySheetOpen, setCategorySheetOpen] = useState(false)

  useEffect(() => {
    function onConnect() {
      setIsConnected(true)
    }
    function onDisconnect() {
      setIsConnected(false)
    }
    function onTestResult(data: { content: string }) {
      const chain = chainRunRef.current
      if (!chain) {
        updatePromptLibrary(
          categories.map((cat) => ({
            ...cat,
            prompts: cat.prompts.map((p) =>
              p.id === runningPromptId ? { ...p, reply: data.content, updatedAt: Date.now() } : p
            ),
          }))
        )
        setRunningPromptId(null)
        return
      }
      const nextMessages = [...chain.messages, { type: 'ai' as const, content: data.content }]
      if (chain.stepIndex < chain.chainSteps.length) {
        const step = chain.chainSteps[chain.stepIndex]!
        socket.emit('test_prompt', {
          messages: [
            ...nextMessages.map((m) => ({ type: m.type, content: m.content })),
            { type: 'human', content: step.promptText },
          ],
          llmProvider,
        })
        chainRunRef.current = {
          promptId: chain.promptId,
          stepIndex: chain.stepIndex + 1,
          messages: [...nextMessages, { type: 'human' as const, content: step.promptText }],
          chainSteps: chain.chainSteps,
        }
      } else {
        updatePromptLibrary(
          categories.map((cat) => ({
            ...cat,
            prompts: cat.prompts.map((p) =>
              p.id === chain.promptId ? { ...p, reply: data.content, updatedAt: Date.now() } : p
            ),
          }))
        )
        setRunningPromptId(null)
        chainRunRef.current = null
      }
    }
    function onTestError() {
      setRunningPromptId(null)
      chainRunRef.current = null
    }

    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    socket.on('test_prompt_result', onTestResult)
    socket.on('test_prompt_error', onTestError)
    if (!socket.connected) socket.connect()

    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
      socket.off('test_prompt_result', onTestResult)
      socket.off('test_prompt_error', onTestError)
    }
  }, [runningPromptId, categories, updatePromptLibrary])

  const selectedCategory = categories.find((c) => c.id === selectedCategoryId)
  const prompts = selectedCategory?.prompts ?? []

  const handleAddCategory = useCallback(() => {
    if (!newCategoryName.trim()) return
    const cat = createCategory(newCategoryName.trim())
    updatePromptLibrary([cat, ...categories])
    setSelectedCategoryId(cat.id)
    setNewCategoryName('')
    setIsAddingCategory(false)
  }, [newCategoryName, categories, updatePromptLibrary])

  const handleAddPrompt = useCallback(() => {
    if (!selectedCategoryId || !promptText.trim()) return
    const prompt = createPrompt(
      promptName.trim() || 'Untitled',
      promptText.trim(),
      expectedReply.trim(),
      chainSteps.filter((s) => s.promptText.trim() || s.expectedReply.trim())
    )
    updatePromptLibrary(
      categories.map((c) =>
        c.id === selectedCategoryId
          ? { ...c, prompts: [...c.prompts, prompt], updatedAt: Date.now() }
          : c
      )
    )
    setPromptName('')
    setPromptText('')
    setExpectedReply('')
    setChainSteps([])
    setIsAddingPrompt(false)
  }, [selectedCategoryId, promptName, promptText, expectedReply, chainSteps, categories, updatePromptLibrary])

  const handleEditPrompt = useCallback((p: PromptEntry) => {
    setEditingPromptId(p.id)
    setPromptName(p.name)
    setPromptText(p.promptText)
    setExpectedReply(p.expectedReply)
    setChainSteps(p.chainSteps ?? [])
  }, [])

  const handleSavePrompt = useCallback(() => {
    if (!editingPromptId || !selectedCategoryId) return
    updatePromptLibrary(
      categories.map((c) =>
        c.id === selectedCategoryId
          ? {
            ...c,
            prompts: c.prompts.map((p) =>
              p.id === editingPromptId
                ? {
                  ...p,
                  name: promptName.trim() || 'Untitled',
                  promptText: promptText.trim(),
                  expectedReply: expectedReply.trim(),
                  chainSteps: chainSteps.filter((s) => s.promptText.trim() || s.expectedReply.trim()),
                  updatedAt: Date.now(),
                }
                : p
            ),
            updatedAt: Date.now(),
          }
          : c
      )
    )
    setEditingPromptId(null)
    setPromptName('')
    setPromptText('')
    setExpectedReply('')
    setChainSteps([])
  }, [editingPromptId, selectedCategoryId, promptName, promptText, expectedReply, chainSteps, categories, updatePromptLibrary])

  const handleDeletePrompt = useCallback(
    async (id: string) => {
      if (!selectedCategoryId) return
      const ok = await confirm({
        title: 'Delete prompt',
        description: 'Delete this prompt?',
        confirmLabel: 'Delete',
        variant: 'destructive',
      })
      if (!ok) return
      updatePromptLibrary(
        categories.map((c) =>
          c.id === selectedCategoryId
            ? {
              ...c,
              prompts: c.prompts.filter((p) => p.id !== id),
              updatedAt: Date.now(),
            }
            : c
        )
      )
      if (editingPromptId === id) {
        setEditingPromptId(null)
        setPromptName('')
        setPromptText('')
        setExpectedReply('')
        setChainSteps([])
      }
    },
    [selectedCategoryId, editingPromptId, categories, updatePromptLibrary, confirm]
  )

  const handleDeleteCategory = useCallback(async (id: string) => {
    const ok = await confirm({
      title: 'Delete category',
      description: 'Delete this category and all its prompts?',
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    updatePromptLibrary(categories.filter((c) => c.id !== id))
    if (selectedCategoryId === id) setSelectedCategoryId(null)
  }, [selectedCategoryId, categories, updatePromptLibrary, confirm])

  const handleRunPrompt = useCallback((p: PromptEntry) => {
    setRunningPromptId(p.id)
    const steps = p.chainSteps ?? []
    if (steps.length > 0) {
      chainRunRef.current = {
        promptId: p.id,
        stepIndex: 0,
        messages: [{ type: 'human' as const, content: p.promptText }],
        chainSteps: steps,
      }
    } else {
      chainRunRef.current = null
    }
    socket.emit('test_prompt', {
      messages: [{ type: 'human', content: p.promptText }],
      llmProvider,
    })
  }, [llmProvider])

  const handleLoadToTesting = useCallback(
    (p: PromptEntry) => {
      setPromptFromLibrary({ promptText: p.promptText, expectedReply: p.expectedReply })
      onNavigate('prompts')
    },
    [onNavigate]
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
                  {cat.prompts.length}
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
              <div className="pt-6 flex flex-col flex-1 min-w-0 overflow-hidden">
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
            <h1 className="font-semibold text-sm">Prompt Library</h1>
            <p className="text-xs text-muted-foreground">
              {categories.length} {categories.length === 1 ? 'category' : 'categories'}
              {selectedCategory && ` · ${prompts.length} prompts`}
            </p>
          </div>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        <aside className="hidden md:flex w-56 shrink-0 border-r flex-col bg-muted/20">
          {categorySidebarContent}
        </aside>

        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          {selectedCategory ? (
            <>
              <div className="p-4 border-b flex items-center justify-between">
                <h2 className="font-medium text-sm">{selectedCategory.name}</h2>
                {!isTeamReadOnly && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="gap-2"
                    onClick={() => setIsAddingPrompt(true)}
                  >
                    <Plus className="w-4 h-4" />
                    Add prompt
                  </Button>
                )}
              </div>

              {!isTeamReadOnly && isAddingPrompt && (
                <div className="p-4 border-b space-y-4 bg-muted/20">
                  <Input
                    placeholder="Prompt name (optional)"
                    value={promptName}
                    onChange={(e) => setPromptName(e.target.value)}
                    className="text-sm"
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Prompt</label>
                    <textarea
                      placeholder="Your prompt text..."
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm resize-y"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Expected reply (optional)</label>
                    <textarea
                      placeholder="Expected AI response..."
                      value={expectedReply}
                      onChange={(e) => setExpectedReply(e.target.value)}
                      className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm resize-y"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <label className="text-xs font-medium text-muted-foreground">Chain reply (follow-up steps)</label>
                    </div>
                    {chainSteps.map((step, i) => (
                      <div key={i} className="flex gap-2 items-start rounded-lg border p-3 bg-background">
                        <div className="flex-1 space-y-2 min-w-0">
                          <Input
                            placeholder="Follow-up prompt"
                            value={step.promptText}
                            onChange={(e) =>
                              setChainSteps((s) =>
                                s.map((x, j) => (j === i ? { ...x, promptText: e.target.value } : x))
                              )
                            }
                            className="text-sm h-8"
                          />
                          <Input
                            placeholder="Expected reply"
                            value={step.expectedReply}
                            onChange={(e) =>
                              setChainSteps((s) =>
                                s.map((x, j) => (j === i ? { ...x, expectedReply: e.target.value } : x))
                              )
                            }
                            className="text-sm h-8"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setChainSteps((s) => s.filter((_, j) => j !== i))}
                          aria-label="Remove step"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setChainSteps((s) => [...s, { promptText: '', expectedReply: '' }])}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add chain step
                    </Button>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleAddPrompt} disabled={!promptText.trim()}>
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setIsAddingPrompt(false)
                        setPromptName('')
                        setPromptText('')
                        setExpectedReply('')
                        setChainSteps([])
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              {editingPromptId && (
                <div className="p-4 border-b space-y-4 bg-muted/20">
                  <Input
                    placeholder="Prompt name (optional)"
                    value={promptName}
                    onChange={(e) => setPromptName(e.target.value)}
                    className="text-sm"
                  />
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Prompt</label>
                    <textarea
                      placeholder="Your prompt text..."
                      value={promptText}
                      onChange={(e) => setPromptText(e.target.value)}
                      className="w-full min-h-[80px] rounded-md border bg-background px-3 py-2 text-sm resize-y"
                      rows={3}
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-xs font-medium text-muted-foreground">Expected reply (optional)</label>
                    <textarea
                      placeholder="Expected AI response..."
                      value={expectedReply}
                      onChange={(e) => setExpectedReply(e.target.value)}
                      className="w-full min-h-[60px] rounded-md border bg-background px-3 py-2 text-sm resize-y"
                      rows={2}
                    />
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Link2 className="w-3.5 h-3.5 text-muted-foreground" />
                      <label className="text-xs font-medium text-muted-foreground">Chain reply (follow-up steps)</label>
                    </div>
                    {chainSteps.map((step, i) => (
                      <div key={i} className="flex gap-2 items-start rounded-lg border p-3 bg-background">
                        <div className="flex-1 space-y-2 min-w-0">
                          <Input
                            placeholder="Follow-up prompt"
                            value={step.promptText}
                            onChange={(e) =>
                              setChainSteps((s) =>
                                s.map((x, j) => (j === i ? { ...x, promptText: e.target.value } : x))
                              )
                            }
                            className="text-sm h-8"
                          />
                          <Input
                            placeholder="Expected reply"
                            value={step.expectedReply}
                            onChange={(e) =>
                              setChainSteps((s) =>
                                s.map((x, j) => (j === i ? { ...x, expectedReply: e.target.value } : x))
                              )
                            }
                            className="text-sm h-8"
                          />
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 shrink-0 text-muted-foreground hover:text-destructive"
                          onClick={() => setChainSteps((s) => s.filter((_, j) => j !== i))}
                          aria-label="Remove step"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      variant="outline"
                      size="sm"
                      className="gap-1.5"
                      onClick={() => setChainSteps((s) => [...s, { promptText: '', expectedReply: '' }])}
                    >
                      <Plus className="w-3.5 h-3.5" />
                      Add chain step
                    </Button>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button size="sm" onClick={handleSavePrompt} disabled={!promptText.trim()}>
                      Save
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setEditingPromptId(null)
                        setPromptName('')
                        setPromptText('')
                        setExpectedReply('')
                        setChainSteps([])
                      }}
                    >
                      Cancel
                    </Button>
                  </div>
                </div>
              )}

              <ScrollArea className="flex-1">
                <div className="p-4 space-y-4">
                  {prompts.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 text-center">
                      <FileText className="w-12 h-12 text-muted-foreground/50 mb-4" />
                      <p className="text-sm text-muted-foreground mb-4">
                        No prompts in this category
                      </p>
                      {!isTeamReadOnly && (
                        <Button size="sm" onClick={() => setIsAddingPrompt(true)}>
                          Add prompt
                        </Button>
                      )}
                    </div>
                  ) : (
                    prompts.map((p) => (
                      <div
                        key={p.id}
                        className={cn(
                          'rounded-xl border bg-card overflow-hidden',
                          'hover:border-border/80'
                        )}
                      >
                        <div className="p-4">
                          <div className="flex items-start justify-between gap-3 mb-3">
                            <h3 className="font-medium text-sm">{p.name || 'Untitled'}</h3>
                            <div className="flex items-center gap-1 shrink-0">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleRunPrompt(p)}
                                disabled={runningPromptId !== null}
                                aria-label="Run prompt"
                              >
                                {runningPromptId === p.id ? (
                                  <span className="animate-pulse">...</span>
                                ) : (
                                  <Play className="w-4 h-4" />
                                )}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => handleLoadToTesting(p)}
                                aria-label="Load to Prompt Testing"
                              >
                                <ArrowRight className="w-4 h-4" />
                              </Button>
                              {!isTeamReadOnly && (
                                <>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8"
                                    onClick={() => handleEditPrompt(p)}
                                    aria-label="Edit"
                                  >
                                    <Pencil className="w-4 h-4" />
                                  </Button>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive"
                                    onClick={() => handleDeletePrompt(p.id)}
                                    aria-label="Delete"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </Button>
                                </>
                              )}
                            </div>
                          </div>

                          <div className="space-y-3 text-sm">
                            <div>
                              <span className="text-[10px] font-medium uppercase text-muted-foreground">
                                Prompt
                              </span>
                              <p className="mt-0.5 text-muted-foreground whitespace-pre-wrap line-clamp-3">
                                {p.promptText || '—'}
                              </p>
                            </div>
                            {p.reply && (
                              <div>
                                <span className="text-[10px] font-medium uppercase text-muted-foreground">
                                  Reply
                                </span>
                                <p className="mt-0.5 text-muted-foreground whitespace-pre-wrap line-clamp-3">
                                  {p.reply}
                                </p>
                              </div>
                            )}
                            {(p.chainSteps?.length ?? 0) > 0 && (
                              <div className="flex items-center gap-1.5">
                                <Link2 className="w-3 h-3 text-muted-foreground" />
                                <span className="text-[10px] font-medium text-muted-foreground">
                                  {p.chainSteps!.length} chain step{p.chainSteps!.length !== 1 ? 's' : ''}
                                </span>
                              </div>
                            )}
                            {p.expectedReply && (
                              <div>
                                <span className="text-[10px] font-medium uppercase text-muted-foreground">
                                  Expected Reply
                                </span>
                                <p className="mt-0.5 text-muted-foreground whitespace-pre-wrap line-clamp-3">
                                  {p.expectedReply}
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </ScrollArea>
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <FolderOpen className="w-16 h-16 text-muted-foreground/40 mb-4" />
              <p className="text-sm text-muted-foreground mb-2">
                Select a category or create one
              </p>
              {!isTeamReadOnly && (
                <Button size="sm" onClick={() => setIsAddingCategory(true)}>
                  Add category
                </Button>
              )}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
