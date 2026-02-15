import { useUserData } from '@/contexts/UserDataContext'
import type { Skill } from '@/lib/skills'
import { FileCode, Plug } from 'lucide-react'

interface SelectionPanelProps {
  onMcpChange?: () => void
  onSkillChange?: () => void
  compact?: boolean
}

export function SelectionPanel({
  onMcpChange,
  onSkillChange,
  compact = false,
}: SelectionPanelProps) {
  const { mcpSelection: mcp, skills, skillSelection, updateMCPSelection, updateSkillSelection } = useUserData()
  const selectedSkills = skills.filter((s: Skill) => skillSelection.includes(s.id))

  const hasAny = mcp != null || selectedSkills.length > 0

  if (!hasAny) return null

  return (
    <div
      className={compact ? 'flex items-center gap-2 flex-wrap' : 'flex flex-wrap gap-3 text-xs text-muted-foreground'}
    >
      {mcp != null && (
        <span className="flex items-center gap-1.5">
          <Plug className="w-3 h-3 shrink-0" />
          <span>
            MCP: {mcp.serverName} → {mcp.tool.name}
          </span>
          <button
            type="button"
            onClick={() => {
              updateMCPSelection(null)
              onMcpChange?.()
            }}
            className="text-muted-foreground hover:text-foreground underline"
          >
            Clear
          </button>
        </span>
      )}
      {selectedSkills.length > 0 && (
        <span className="flex items-center gap-1.5">
          <FileCode className="w-3 h-3 shrink-0" />
          <span>
            Skills: {selectedSkills.map((s: Skill) => s.name).join(', ')}
          </span>
          <button
            type="button"
            onClick={() => {
              updateSkillSelection([])
              onSkillChange?.()
            }}
            className="text-muted-foreground hover:text-foreground underline ml-0.5"
          >
            Clear
          </button>
        </span>
      )}
    </div>
  )
}
