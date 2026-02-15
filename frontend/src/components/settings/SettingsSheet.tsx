import { useState, useEffect, useCallback } from 'react'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from '@/components/ui/sheet'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { useAuth } from '@/contexts/AuthContext'
import { useUserData } from '@/contexts/UserDataContext'
import { User, Lock, LogOut, Eye, EyeOff, ChevronDown, ChevronRight, Cpu } from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsSheetProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

function getInitials(email: string, name?: string): string {
  if (name?.trim()) {
    const parts = name.trim().split(/\s+/)
    if (parts.length >= 2) {
      return (parts[0]![0]! + parts[1]![0]!).toUpperCase()
    }
    return name.slice(0, 2).toUpperCase()
  }
  const local = email.split('@')[0]
  return local ? local.slice(0, 2).toUpperCase() : '?'
}

function getPasswordStrength(password: string): 'weak' | 'medium' | 'strong' {
  if (!password) return 'weak'
  let score = 0
  if (password.length >= 6) score++
  if (password.length >= 10) score++
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++
  if (/\d/.test(password)) score++
  if (/[^a-zA-Z0-9]/.test(password)) score++
  if (score <= 2) return 'weak'
  if (score <= 4) return 'medium'
  return 'strong'
}

export function SettingsSheet({ open, onOpenChange }: SettingsSheetProps) {
  const { user, updateProfile, changePassword, logout } = useAuth()
  const { llmProvider, updateLLMProvider } = useUserData()
  const [name, setName] = useState(user?.name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [passwordSectionOpen, setPasswordSectionOpen] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (open && user) {
      setName(user.name ?? '')
    }
  }, [open, user])

  const dismissSuccess = useCallback((setter: (v: boolean) => void, delay = 3000) => {
    const t = setTimeout(() => setter(false), delay)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    if (profileSuccess) return dismissSuccess(setProfileSuccess)
  }, [profileSuccess, dismissSuccess])

  useEffect(() => {
    if (passwordSuccess) return dismissSuccess(setPasswordSuccess)
  }, [passwordSuccess, dismissSuccess])

  const nameChanged = (user?.name ?? '').trim() !== name.trim()

  const handleProfileSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setProfileError(null)
    setProfileSuccess(false)
    setSavingProfile(true)
    try {
      await updateProfile(name.trim())
      setProfileSuccess(true)
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Failed to update')
    } finally {
      setSavingProfile(false)
    }
  }

  const handlePasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setPasswordError(null)
    setPasswordSuccess(false)
    if (newPassword !== confirmPassword) {
      setPasswordError('New passwords do not match')
      return
    }
    if (newPassword.length < 6) {
      setPasswordError('New password must be at least 6 characters')
      return
    }
    setSavingPassword(true)
    try {
      await changePassword(currentPassword, newPassword)
      setPasswordSuccess(true)
      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Failed to change password')
    } finally {
      setSavingPassword(false)
    }
  }

  const displayName = user?.name?.trim() || user?.email || 'User'
  const newPwStrength = getPasswordStrength(newPassword)

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full max-w-[min(100vw-2rem,28rem)] sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="px-6 pt-6 pb-4 border-b shrink-0">
          <SheetTitle>Settings</SheetTitle>
        </SheetHeader>
        <ScrollArea className="flex-1">
          <div className="p-6 space-y-6">
            {/* Profile */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <User className="w-4 h-4" />
                  Profile
                </CardTitle>
                <CardDescription>
                  Update your display name. This appears in the top bar.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold">
                    {user ? getInitials(user.email, user.name) : '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{displayName}</p>
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
                <form onSubmit={handleProfileSubmit} className="space-y-3">
                  <div>
                    <label htmlFor="profile-name" className="text-xs font-medium text-muted-foreground">
                      Display name
                    </label>
                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="mt-1"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                    <Input value={user?.email ?? ''} disabled className="mt-1 bg-muted" />
                    <p className="text-xs text-muted-foreground mt-1">Email cannot be changed</p>
                  </div>
                  {profileError && (
                    <p className="text-sm text-destructive" role="alert">
                      {profileError}
                    </p>
                  )}
                  {profileSuccess && (
                    <p className="text-sm text-success" role="status">
                      Profile updated
                    </p>
                  )}
                  <Button type="submit" size="sm" disabled={savingProfile || !nameChanged}>
                    {savingProfile ? 'Saving...' : 'Save profile'}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Default LLM */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Cpu className="w-4 h-4" />
                  Default AI model
                </CardTitle>
                <CardDescription>
                  Choose which LLM to use for Chat and Prompt Testing.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <Select value={llmProvider} onValueChange={(v) => updateLLMProvider(v as 'openai' | 'anthropic' | 'google')}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="openai">OpenAI</SelectItem>
                    <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                    <SelectItem value="google">Google Gemini</SelectItem>
                  </SelectContent>
                </Select>
              </CardContent>
            </Card>

            {/* Change password */}
            <Card>
              <CardHeader className="pb-3">
                <button
                  type="button"
                  className="flex w-full items-center justify-between text-left"
                  onClick={() => setPasswordSectionOpen((o) => !o)}
                >
                  <div>
                    <CardTitle className="text-sm font-semibold flex items-center gap-2">
                      <Lock className="w-4 h-4" />
                      Change password
                    </CardTitle>
                    <CardDescription>
                      Update your password to keep your account secure.
                    </CardDescription>
                  </div>
                  {passwordSectionOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
              </CardHeader>
              {passwordSectionOpen && (
                <CardContent>
                  <form onSubmit={handlePasswordSubmit} className="space-y-3">
                    <div>
                      <label htmlFor="current-password" className="text-xs font-medium text-muted-foreground">
                        Current password
                      </label>
                      <div className="relative mt-1">
                        <Input
                          id="current-password"
                          type={showCurrentPw ? 'text' : 'password'}
                          value={currentPassword}
                          onChange={(e) => setCurrentPassword(e.target.value)}
                          placeholder="••••••••"
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowCurrentPw((s) => !s)}
                          aria-label={showCurrentPw ? 'Hide password' : 'Show password'}
                        >
                          {showCurrentPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    <div>
                      <label htmlFor="new-password" className="text-xs font-medium text-muted-foreground">
                        New password
                      </label>
                      <div className="relative mt-1">
                        <Input
                          id="new-password"
                          type={showNewPw ? 'text' : 'password'}
                          value={newPassword}
                          onChange={(e) => setNewPassword(e.target.value)}
                          placeholder="••••••••"
                          minLength={6}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowNewPw((s) => !s)}
                          aria-label={showNewPw ? 'Hide password' : 'Show password'}
                        >
                          {showNewPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                      {newPassword && (
                        <div className="mt-1.5 flex gap-1">
                          {(['weak', 'medium', 'strong'] as const).map((level) => (
                            <div
                              key={level}
                              className={cn(
                                'h-1 flex-1 rounded-full transition-colors',
                                newPwStrength === level
                                  ? level === 'weak'
                                    ? 'bg-destructive'
                                    : level === 'medium'
                                      ? 'bg-primary'
                                      : 'bg-success'
                                  : 'bg-muted'
                              )}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <label htmlFor="confirm-password" className="text-xs font-medium text-muted-foreground">
                        Confirm new password
                      </label>
                      <div className="relative mt-1">
                        <Input
                          id="confirm-password"
                          type={showConfirmPw ? 'text' : 'password'}
                          value={confirmPassword}
                          onChange={(e) => setConfirmPassword(e.target.value)}
                          placeholder="••••••••"
                          minLength={6}
                          required
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="absolute right-0 top-0 h-full px-3"
                          onClick={() => setShowConfirmPw((s) => !s)}
                          aria-label={showConfirmPw ? 'Hide password' : 'Show password'}
                        >
                          {showConfirmPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </Button>
                      </div>
                    </div>
                    {passwordError && (
                      <p className="text-sm text-destructive" role="alert">
                        {passwordError}
                      </p>
                    )}
                    {passwordSuccess && (
                      <p className="text-sm text-success" role="status">
                        Password changed
                      </p>
                    )}
                    <Button type="submit" size="sm" disabled={savingPassword}>
                      {savingPassword ? 'Changing...' : 'Change password'}
                    </Button>
                  </form>
                </CardContent>
              )}
            </Card>

            {/* Sign out */}
            <div className="pt-2">
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
                onClick={() => {
                  logout()
                  onOpenChange(false)
                }}
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </Button>
            </div>
          </div>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
