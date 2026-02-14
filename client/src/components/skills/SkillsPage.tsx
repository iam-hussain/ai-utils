import { useState, useEffect, useCallback, useRef } from 'react'
import { socket } from '@/lib/socket'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import {
  loadSkills,
  saveSkills,
  createSkill,
  type Skill,
} from '@/lib/skills'
import { loadSkillSelection, toggleSkillSelection } from '@/lib/skill-selection'
import { FileCode, Plus, Trash2, Pencil, Download, Upload, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SkillsPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
}

export default function SkillsPage({ currentView, onNavigate }: SkillsPageProps) {
  const [isConnected, setIsConnected] = useState(socket.connected)
  const [skills, setSkills] = useState<Skill[]>(() => loadSkills())
  const [selectedIds, setSelectedIds] = useState<string[]>(() => loadSkillSelection())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [content, setContent] = useState('')
  const [isAdding, setIsAdding] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    saveSkills(skills)
  }, [skills])

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
    setSkills((prev) => [skill, ...prev])
    setName('')
    setContent('')
    setIsAdding(false)
  }, [name, content])

  const handleEdit = useCallback((skill: Skill) => {
    setEditingId(skill.id)
    setName(skill.name)
    setContent(skill.content)
  }, [])

  const handleSaveEdit = useCallback(() => {
    if (!editingId || !name.trim()) return
    setSkills((prev) =>
      prev.map((s) =>
        s.id === editingId
          ? { ...s, name: name.trim(), content: content.trim(), updatedAt: Date.now() }
          : s
      )
    )
    setEditingId(null)
    setName('')
    setContent('')
  }, [editingId, name, content])

  const handleDelete = useCallback((id: string) => {
    setSkills((prev) => prev.filter((s) => s.id !== id))
    if (editingId === id) {
      setEditingId(null)
      setName('')
      setContent('')
    }
  }, [editingId])

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
      setSkills((prev) => [skill, ...prev])
    }
    reader.readAsText(file)
    e.target.value = ''
  }, [])

  const handleToggleSelect = useCallback((skill: Skill) => {
    setSelectedIds(toggleSkillSelection(skill.id))
  }, [])

  const cancelEdit = useCallback(() => {
    setEditingId(null)
    setIsAdding(false)
    setName('')
    setContent('')
  }, [])

  const editingOrAdding = editingId !== null || isAdding

  return (
    <AppLayout currentView={currentView} onNavigate={onNavigate} isConnected={isConnected}>
      <header className="h-12 shrink-0 border-b flex items-center px-6 bg-background/50 backdrop-blur sticky top-0 z-10">
        <h1 className="font-semibold text-sm">Skills</h1>
      </header>

        <ScrollArea className="flex-1">
          <div className="max-w-3xl mx-auto p-6 space-y-6">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle className="text-base flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  Markdown Skills
                </CardTitle>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleImport} className="gap-1">
                    <Upload className="w-3 h-3" />
                    Import .md
                  </Button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".md"
                    className="hidden"
                    onChange={handleFileChange}
                  />
                  <Button
                    size="sm"
                    onClick={() => setIsAdding(true)}
                    disabled={isAdding}
                    className="gap-1"
                  >
                    <Plus className="w-3 h-3" />
                    Add skill
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground mb-4">
                  Add skills as Markdown files. Import from .md files or create new ones.
                </p>

                {editingOrAdding && (
                  <div className="rounded-lg border p-4 bg-muted/30 space-y-4 mb-4">
                    <Input
                      placeholder="Skill name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                    />
                    <textarea
                      placeholder="Markdown content..."
                      value={content}
                      onChange={(e) => setContent(e.target.value)}
                      className="w-full min-h-[200px] rounded-md border border-input bg-background px-3 py-2 text-sm font-mono"
                    />
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={editingId ? handleSaveEdit : handleAdd}
                        disabled={!name.trim()}
                      >
                        {editingId ? 'Save' : 'Add'}
                      </Button>
                      <Button variant="ghost" size="sm" onClick={cancelEdit}>
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}

                {skills.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No skills yet. Add one or import from a .md file.</p>
                ) : (
                  <ul className="space-y-3">
                    {skills.map((skill) => (
                      <li
                        key={skill.id}
                        className={cn(
                          'rounded-lg border p-4',
                          editingId === skill.id && 'ring-2 ring-ring'
                        )}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span className="font-medium text-sm truncate">{skill.name}</span>
                          <div className="flex items-center gap-1 shrink-0">
                            <Button
                              size="sm"
                              variant={selectedIds.includes(skill.id) ? 'default' : 'outline'}
                              className="gap-1"
                              onClick={() => handleToggleSelect(skill)}
                            >
                              {selectedIds.includes(skill.id) ? (
                                <Check className="w-3 h-3" />
                              ) : null}
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
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => handleDelete(skill.id)}
                              aria-label="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2 font-mono">
                          {skill.content || '(empty)'}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          </div>
        </ScrollArea>
    </AppLayout>
  )
}
