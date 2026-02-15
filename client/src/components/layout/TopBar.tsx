import { useState } from 'react'
import { Button } from '@/components/ui/button'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet'
import { Avatar, AvatarFallback } from '@/components/ui/avatar'
import { SettingsSheet } from '@/components/settings/SettingsSheet'
import { Settings, Wifi, WifiOff, Menu, Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'

interface TopBarProps {
  title?: string
  isConnected: boolean
  actions?: React.ReactNode
  sidebarContent?: React.ReactNode
}

function getInitials(email: string, name?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    return name.slice(0, 2).toUpperCase()
  }
  const local = email.split('@')[0]
  return local ? local.slice(0, 2).toUpperCase() : '?'
}

export function TopBar({ title, isConnected, actions, sidebarContent }: TopBarProps) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const displayName = user?.name?.trim() || user?.email || ''

  return (
    <header className="h-12 shrink-0 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 flex items-center px-4 sm:px-6 gap-2 sm:gap-4 z-20 pt-[env(safe-area-inset-top)]">
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
        <Button
          variant="ghost"
          size="icon"
          className="h-8 w-8"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </Button>
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
        {user && (
          <Button
            variant="ghost"
            size="sm"
            className="gap-2 h-8 px-2 max-w-[140px]"
            onClick={() => setSettingsOpen(true)}
            aria-label="Open settings"
          >
            <Avatar className="h-6 w-6">
              <AvatarFallback className="text-xs bg-primary/10 text-primary">
                {getInitials(user.email, user.name)}
              </AvatarFallback>
            </Avatar>
            <span className="truncate text-sm font-medium hidden sm:inline">
              {displayName || user.email}
            </span>
            <Settings className="w-4 h-4 shrink-0 sm:hidden" />
          </Button>
        )}
        {user && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 hidden sm:flex"
            aria-label="Settings"
            onClick={() => setSettingsOpen(true)}
          >
            <Settings className="w-4 h-4" />
          </Button>
        )}
        <SettingsSheet open={settingsOpen} onOpenChange={setSettingsOpen} />
      </div>
    </header>
  )
}
