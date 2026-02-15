import { useState } from 'react'
import { useUserData } from '@/contexts/UserDataContext'
import type { Skill } from '@/lib/skills'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { ScrollArea } from '@/components/ui/scroll-area'
import { FileCode, Plug, Plus, Check } from 'lucide-react'
import { cn } from '@/lib/utils'

interface ToolsSkillsPickerProps {
  onNavigate?: (view: 'mcp-saved' | 'skills') => void
  compact?: boolean
}

export function ToolsSkillsPicker({
  onNavigate,
  compact = false,
}: ToolsSkillsPickerProps) {
  const {
    mcpSelection,
    skills,
    skillSelection,
    updateMCPSelection,
    updateSkillSelection,
  } = useUserData()
  const [open, setOpen] = useState(false)
  const selectedSkills = skills.filter((s) => skillSelection.includes(s.id))
  const hasAny = mcpSelection != null || selectedSkills.length > 0

  const handleToggleSkill = (skill: Skill) => {
    const next = skillSelection.includes(skill.id)
      ? skillSelection.filter((id) => id !== skill.id)
      : [...skillSelection, skill.id]
    updateSkillSelection(next)
  }

  const handleClearTool = () => {
    updateMCPSelection(null)
  }

  const handleClearSkills = () => {
    updateSkillSelection([])
  }

  return (
    <>
      <div
        className={cn(
          'flex items-center gap-2 flex-wrap',
          compact && 'gap-1.5'
        )}
      >
        <Button
          variant="outline"
          size="sm"
          onClick={() => setOpen(true)}
          className={cn(
            'gap-1.5 shrink-0',
            hasAny && 'border-primary/50 bg-primary/5 hover:bg-primary/10'
          )}
        >
          <Plus className="w-3.5 h-3.5 shrink-0" />
          {hasAny ? 'Tools & skills' : 'Add tools & skills'}
          {hasAny && (
            <span className="text-xs font-medium tabular-nums bg-primary/20 px-1.5 py-0.5 rounded">
              {selectedSkills.length + (mcpSelection ? 1 : 0)}
            </span>
          )}
        </Button>

        {hasAny && (
          <div className="flex items-center gap-1.5 flex-wrap">
            {mcpSelection && (
              <span
                className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-primary/10 text-primary border border-primary/20"
                title={`MCP: ${mcpSelection.serverName} → ${mcpSelection.tool.name}`}
              >
                <Plug className="w-3 h-3 shrink-0" />
                <span className="truncate max-w-[100px] sm:max-w-[140px]">
                  {mcpSelection.tool.name}
                </span>
                <button
                  type="button"
                  onClick={handleClearTool}
                  className="rounded p-0.5 -mr-0.5 text-muted-foreground hover:text-foreground hover:bg-primary/20 transition-colors"
                  aria-label="Clear tool"
                >
                  ×
                </button>
              </span>
            )}
            {selectedSkills.length > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium bg-muted text-foreground border border-border">
                <FileCode className="w-3 h-3 shrink-0" />
                <span>
                  {selectedSkills.length} skill{selectedSkills.length !== 1 ? 's' : ''}
                </span>
                <button
                  type="button"
                  onClick={handleClearSkills}
                  className="rounded p-0.5 -mr-0.5 text-muted-foreground hover:text-foreground hover:bg-muted-foreground/20 transition-colors"
                  aria-label="Clear skills"
                >
                  ×
                </button>
              </span>
            )}
          </div>
        )}
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle>Tools & skills</DialogTitle>
          </DialogHeader>
          <ScrollArea className="flex-1 -mx-1 pr-2">
            <div className="space-y-6 py-2">
              {/* MCP Tool */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <Plug className="w-4 h-4" />
                  MCP tool
                </h3>
                {mcpSelection ? (
                  <div className="flex items-center justify-between gap-2 p-3 rounded-lg border bg-muted/30">
                    <div className="min-w-0">
                      <p className="text-sm font-medium truncate">
                        {mcpSelection.tool.name}
                      </p>
                      <p className="text-xs text-muted-foreground truncate">
                        {mcpSelection.serverName}
                      </p>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        handleClearTool()
                        onNavigate?.('mcp-saved')
                        setOpen(false)
                      }}
                    >
                      Change
                    </Button>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground mb-2">
                    Select a tool from your saved MCP servers.
                  </p>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    onNavigate?.('mcp-saved')
                    setOpen(false)
                  }}
                >
                  {mcpSelection ? 'Select different tool' : 'Select MCP tool'}
                </Button>
              </div>

              {/* Skills */}
              <div>
                <h3 className="text-sm font-medium mb-2 flex items-center gap-2">
                  <FileCode className="w-4 h-4" />
                  Skills
                </h3>
                {skills.length === 0 ? (
                  <p className="text-sm text-muted-foreground mb-2">
                    No skills yet. Add skills from the Skills page.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-[200px] overflow-y-auto">
                    {skills.map((skill) => {
                      const isSelected = skillSelection.includes(skill.id)
                      return (
                        <button
                          key={skill.id}
                          type="button"
                          onClick={() => handleToggleSkill(skill)}
                          className={cn(
                            'w-full flex items-center gap-3 p-2.5 rounded-lg border text-left transition-colors',
                            isSelected
                              ? 'border-primary/50 bg-primary/10'
                              : 'border-border hover:bg-muted/50'
                          )}
                        >
                          <span
                            className={cn(
                              'w-5 h-5 rounded border flex items-center justify-center shrink-0',
                              isSelected
                                ? 'bg-primary border-primary text-primary-foreground'
                                : 'border-muted-foreground/50'
                            )}
                          >
                            {isSelected ? (
                              <Check className="w-3 h-3" />
                            ) : null}
                          </span>
                          <span className="text-sm font-medium truncate flex-1">
                            {skill.name}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                )}
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full mt-2"
                  onClick={() => {
                    onNavigate?.('skills')
                    setOpen(false)
                  }}
                >
                  {skills.length === 0 ? 'Add skills' : 'Manage skills'}
                </Button>
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </>
  )
}
