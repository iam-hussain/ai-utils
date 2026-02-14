import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Settings, Wifi, WifiOff, Menu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface TopBarProps {
  title?: string
  isConnected: boolean
  actions?: React.ReactNode
  sidebarContent?: React.ReactNode
}

export function TopBar({ title, isConnected, actions, sidebarContent }: TopBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)

  return (
    <header className="h-12 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 gap-4 z-20">
      <div className="flex items-center gap-2 min-w-0">
        {sidebarContent && (
          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden h-8 w-8" aria-label="Open menu">
                <Menu className="w-5 h-5" />
              </Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-64 p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Navigation</SheetTitle>
              </SheetHeader>
              <div className="pt-6" onClick={() => setMobileOpen(false)}>
                {sidebarContent}
              </div>
            </SheetContent>
          </Sheet>
        )}
        <span className="font-semibold text-sm tracking-tight truncate">
          {title ?? 'AI Utils'}
        </span>
      </div>
      <div className="flex-1 min-w-0" />
      <div className="flex items-center gap-2 shrink-0">
        {actions}
        <div
          className={cn(
            'flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium',
            isConnected
              ? 'text-green-700 dark:text-green-400 bg-green-500/15'
              : 'text-destructive bg-destructive/10'
          )}
          aria-live="polite"
        >
          {isConnected ? (
            <Wifi className="w-3.5 h-3.5" />
          ) : (
            <WifiOff className="w-3.5 h-3.5" />
          )}
          {isConnected ? 'Connected' : 'Offline'}
        </div>
        <Button variant="ghost" size="icon" className="h-8 w-8" aria-label="Settings">
          <Settings className="w-4 h-4" />
        </Button>
      </div>
    </header>
  )
}
