import { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useUserData } from '@/contexts/UserDataContext'
import type { SavedPromptSet } from '@/lib/saved-prompt-sets'
import { createSavedPromptSetCategory } from '@/lib/saved-prompt-sets'
import type { PromptMessage } from '@/lib/saved-prompt-sets'

interface SaveSetDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  messages: PromptMessage[]
  onSaved: () => void
}

export function SaveSetDialog({
  open,
  onOpenChange,
  messages,
  onSaved,
}: SaveSetDialogProps) {
  const {
    teams,
    promptScope,
    setPromptScope,
    savedPromptSetCategories,
    savedPromptSets,
    updateSavedPromptSetCategories,
  } = useUserData()

  const [name, setName] = useState('')
  const [scope, setScope] = useState<'personal' | string>(promptScope)
  const [action, setAction] = useState<'new' | 'replace'>('new')
  const [replaceId, setReplaceId] = useState<string>('')
  const [categoryId, setCategoryId] = useState<string>('')
  const [newCategoryName, setNewCategoryName] = useState('')
  const [useNewCategory, setUseNewCategory] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const payload: PromptMessage[] = messages
    .map((m) => ({ type: m.type, content: m.content.trim(), name: m.name, role: m.role }))
    .filter((m) => m.content.length > 0)

  const categories = scope === 'personal'
    ? savedPromptSetCategories
    : teams.find((t) => t.id === scope)?.savedPromptSetCategories ?? []

  const handleSave = async () => {
    setError(null)
    if (payload.length === 0) {
      setError('No messages to save')
      return
    }
    const trimmedName = name.trim() || 'Untitled'
    if (action === 'replace' && !replaceId) {
      setError('Select a set to replace')
      return
    }
    setSaving(true)
    try {
      if (scope !== promptScope) setPromptScope(scope)

      const targetCategories = scope === 'personal'
        ? savedPromptSetCategories
        : teams.find((t) => t.id === scope)?.savedPromptSetCategories ?? []
      const targetSets = scope === 'personal' ? savedPromptSets : teams.find((t) => t.id === scope)?.savedPromptSets ?? []

      if (action === 'replace') {
        const targetSet = targetSets.find((s) => s.id === replaceId)
        if (!targetSet) throw new Error('Set not found')
        const updated: SavedPromptSet = {
          ...targetSet,
          name: trimmedName,
          messages: payload,
        }
        const nextCategories = targetCategories.map((c) => ({
          ...c,
          sets: c.sets.map((s: SavedPromptSet) => (s.id === replaceId ? updated : s)),
          updatedAt: Date.now(),
        }))
        await updateSavedPromptSetCategories(nextCategories, scope)
      } else {
        const now = Date.now()
        const newSet: SavedPromptSet = {
          id: `set-${now}`,
          name: trimmedName,
          messages: payload,
          createdAt: now,
        }
        const targetCategoryId = useNewCategory ? null : (categoryId || targetCategories[0]?.id)
        if (useNewCategory && newCategoryName.trim()) {
          const newCat = createSavedPromptSetCategory(newCategoryName.trim())
          newCat.sets.push(newSet)
          const nextCategories = [...targetCategories, newCat]
          await updateSavedPromptSetCategories(nextCategories, scope)
        } else if (targetCategoryId) {
          const nextCategories = targetCategories.map((c) =>
            c.id === targetCategoryId
              ? { ...c, sets: [...c.sets, newSet], updatedAt: Date.now() }
              : c
          )
          await updateSavedPromptSetCategories(nextCategories, scope)
        } else {
          const newCat = createSavedPromptSetCategory('General')
          newCat.sets.push(newSet)
          await updateSavedPromptSetCategories([...targetCategories, newCat], scope)
        }
      }
      onSaved()
      onOpenChange(false)
      setName('')
      setReplaceId('')
      setCategoryId('')
      setNewCategoryName('')
      setUseNewCategory(false)
      setAction('new')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Save prompt set</DialogTitle>
          <DialogDescription>
            Save your messages as a new set or replace an existing one. Choose scope and category.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-4">
          <div className="grid gap-2">
            <label htmlFor="save-name" className="text-sm font-medium">
              Name
            </label>
            <Input
              id="save-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Untitled"
            />
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Scope</label>
            <Select value={scope} onValueChange={(v) => setScope(v)}>
              <SelectTrigger>
                <SelectValue />
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
          </div>

          <div className="grid gap-2">
            <label className="text-sm font-medium">Action</label>
            <Select value={action} onValueChange={(v) => setAction(v as 'new' | 'replace')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="new">New set</SelectItem>
                <SelectItem value="replace">Replace existing</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {action === 'replace' && (
            <div className="grid gap-2">
              <label className="text-sm font-medium">Replace</label>
              <Select value={replaceId} onValueChange={setReplaceId}>
                <SelectTrigger>
                  <SelectValue placeholder="Select set..." />
                </SelectTrigger>
                <SelectContent>
                  {categories.flatMap((c) =>
                    c.sets.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {c.name} → {s.name}
                      </SelectItem>
                    ))
                  )}
                </SelectContent>
              </Select>
            </div>
          )}

          {action === 'new' && (
            <>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="use-new-cat"
                  checked={useNewCategory}
                  onChange={(e) => setUseNewCategory(e.target.checked)}
                  className="rounded border-input"
                />
                <label htmlFor="use-new-cat" className="text-sm">
                  Create new category
                </label>
              </div>
              {useNewCategory ? (
                <div className="grid gap-2">
                  <label htmlFor="new-cat-name" className="text-sm font-medium">
                    Category name
                  </label>
                  <Input
                    id="new-cat-name"
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="e.g. Onboarding"
                  />
                </div>
              ) : (
                <div className="grid gap-2">
                  <label className="text-sm font-medium">Category</label>
                  <Select value={(categoryId || categories[0]?.id) ?? ''} onValueChange={setCategoryId}>
                    <SelectTrigger>
                      <SelectValue placeholder="Select category..." />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                      {categories.length === 0 && (
                        <SelectItem value="__general__" disabled>
                          (General will be created)
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
