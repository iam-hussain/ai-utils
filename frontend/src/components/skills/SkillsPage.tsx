import { useState, useEffect, useCallback, useRef } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { useUserData } from '@/contexts/UserDataContext'
import { useConfirm } from '@/contexts/ConfirmContext'
import { createSkill, type Skill } from '@/lib/skills'
import { FileCode, Plus, Trash2, Pencil, Download, Upload, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SkillsPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function SkillsPage({ currentView, onNavigate }: SkillsPageProps) {
  const { skills, skillSelection, updateSkills, updateSkillSelection } = useUserData()
  const { confirm } = useConfirm()
  const selectedIds = skillSelection
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

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

  const handleAdd = useCallback(() => {
    if (!name.trim()) return
    const skill = createSkill(name.trim(), content.trim())
    updateSkills([skill, ...skills])
    setName('')
    setContent('')
    setIsAdding(false)
  }, [name, content, skills, updateSkills])

  const handleEdit = useCallback((skill: Skill) => {
    setEditingId(skill.id)
    setName(skill.name)
    setContent(skill.content)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !name.trim()) return
    updateSkills(
      skills.map((s) =>
        s.id === editingId
          ? { ...s, name: name.trim(), content: content.trim(), updatedAt: Date.now() }
          : s
      )
    )
    setEditingId(null)
    setName('')
    setContent('')
  }, [editingId, name, content, skills, updateSkills])

  const handleDelete = useCallback(async (skill: Skill) => {
    const ok = await confirm({
      title: 'Delete skill',
      description: `Delete "${skill.name}"? This cannot be undone.`,
      confirmLabel: 'Delete',
      variant: 'destructive',
    })
    if (!ok) return
    updateSkills(skills.filter((s) => s.id !== skill.id))
    if (editingId === skill.id) {
      setEditingId(null)
      setName('')
      setContent('')
    }
  }, [editingId, skills, updateSkills, confirm])

  const handleExport = useCallback((skill: Skill) => {
    const blob = new Blob([skill.content], { type: 'text/markdown' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${skill.name.replace(/\s+/g, '-')}.md`
    a.click()
    URL.revokeObjectURL(url)
  }, [])

  const handleImport = useCallback(() => {
    fileInputRef.current?.click()
  }, [])

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = reader.result as string
      const baseName = file.name.replace(/\.md$/i, '') || file.name
      const skill = createSkill(baseName, text)
      updateSkills([skill, ...skills])
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [skills, updateSkills])

  const handleToggleSelect = useCallback((skill: Skill) => {
    const next = selectedIds.includes(skill.id)
      ? selectedIds.filter((x) => x !== skill.id)
      : [...selectedIds, skill.id]
    updateSkillSelection(next)
  }, [selectedIds, updateSkillSelection])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setIsAdding(false)
    setName('')
    setContent('')
  }, [])

  const editingOrAdding = editingId !== null || isAdding

  return (
    <AppLayout currentView={currentView} onNavigate={onNavigate} isConnected={isConnected}>
      <header className="h-14 shrink-0 border-b flex items-center justify-between px-4 sm:px-6 bg-background/80 backdrop-blur sticky top-0 z-10">
        <div>
          <h1 className="font-semibold text-base">Skills</h1>
          <p className="text-xs text-muted-foreground mt-0.5">
            Markdown context for Chat and Prompts — {skills.length} {skills.length === 1 ? 'skill' : 'skills'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={handleImport} className="gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            Import .md
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept=".md"
            className="hidden"
            onChange={handleFileChange}
          />
          <Button size="sm" onClick={() => setIsAdding(true)} disabled={isAdding} className="gap-1.5">
            <Plus className="w-3.5 h-3.5" />
            Add skill
          </Button>
        </div>
      </header>

      <ScrollArea className="flex-1">
        <div className="max-w-3xl mx-auto p-6 space-y-6">
          {editingOrAdding && (
            <Card className="border-primary/30">
              <CardContent className="p-4 space-y-4">
                <h2 className="font-medium text-sm">
                  {editingId ? 'Edit skill' : 'New skill'}
                </h2>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Name</label>
                  <Input
                    placeholder="e.g. Code review guidelines"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    className="h-9"
                  />
                </div>
                <div className="space-y-2">
                  <label className="text-xs font-medium text-muted-foreground">Markdown content</label>
                  <textarea
                    placeholder="Write your skill content in Markdown..."
                    value={content}
                    onChange={(e) => setContent(e.target.value)}
                    className="w-full min-h-[180px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono resize-y focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button
                    size="sm"
                    onClick={editingId ? handleSaveEdit : handleAdd}
                    disabled={!name.trim()}
                    className="gap-1.5"
                  >
                    {editingId ? 'Save changes' : 'Add skill'}
                  </Button>
                  <Button variant="ghost" size="sm" onClick={cancelEdit}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {skills.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-16 px-6 text-center">
                <div className="rounded-2xl bg-muted/50 p-6 mb-4">
                  <FileCode className="w-12 h-12 text-muted-foreground/60" />
                </div>
                <h2 className="font-medium text-base mb-1">No skills yet</h2>
                <p className="text-sm text-muted-foreground max-w-sm mb-6">
                  Skills are Markdown snippets that get injected into your Chat and Prompt Testing context. Import from .md files or create new ones.
                </p>
                <div className="flex flex-wrap gap-2 justify-center">
                  <Button onClick={handleImport} variant="outline" className="gap-2">
                    <Upload className="w-4 h-4" />
                    Import .md
                  </Button>
                  <Button onClick={() => setIsAdding(true)} className="gap-2">
                    <Plus className="w-4 h-4" />
                    Add skill
                  </Button>
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <h2 className="text-xs font-medium uppercase tracking-wider text-muted-foreground px-1">
                Your skills
              </h2>
              <ul className="space-y-3">
                {skills.map((skill) => (
                  <li
                    key={skill.id}
                    className={cn(
                      'rounded-xl border bg-card overflow-hidden transition-all',
                      'hover:border-border/80',
                      editingId === skill.id && 'ring-2 ring-primary border-primary/30'
                    )}
                  >
                    <div className="flex items-start gap-4 p-4">
                      <div className="rounded-lg bg-muted/50 p-2.5 shrink-0">
                        <FileCode className="w-4 h-4 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="font-medium text-sm">{skill.name}</div>
                        <p className="text-xs text-muted-foreground mt-1 line-clamp-2 font-mono">
                          {skill.content || '(empty)'}
                        </p>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button
                          size="sm"
                          variant={selectedIds.includes(skill.id) ? 'default' : 'outline'}
                          className="gap-1.5"
                          onClick={() => handleToggleSelect(skill)}
                        >
                          {selectedIds.includes(skill.id) ? <Check className="w-3.5 h-3.5" /> : null}
                          {selectedIds.includes(skill.id) ? 'Selected' : 'Select'}
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleEdit(skill)}
                          aria-label="Edit"
                        >
                          <Pencil className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8"
                          onClick={() => handleExport(skill)}
                          aria-label="Export as .md"
                        >
                          <Download className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-muted-foreground hover:text-destructive"
                          onClick={() => handleDelete(skill)}
                          aria-label={`Delete ${skill.name}`}
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </ScrollArea>
    </AppLayout>
  )
}
