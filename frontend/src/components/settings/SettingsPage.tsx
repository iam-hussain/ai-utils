import { useState, useEffect, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent } from '@/components/ui/card'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { AppLayout, type AppView } from '@/components/layout/AppLayout'
import { PageHeader } from '@/components/layout/PageHeader'
import { PageContent } from '@/components/layout/PageContent'
import { useAuth } from '@/contexts/AuthContext'
import { useUserData } from '@/contexts/UserDataContext'
import { useTheme } from '@/contexts/ThemeContext'
import { socket } from '@/lib/socket'
import {
  User,
  Lock,
  LogOut,
  Eye,
  EyeOff,
  Cpu,
  Palette,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SettingsPageProps {
  currentView: AppView
  onNavigate: (view: AppView) => void
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

export default function SettingsPage({ currentView, onNavigate }: SettingsPageProps) {
  const { user, updateProfile, changePassword, logout } = useAuth()
  const { llmProvider, updateLLMProvider } = useUserData()
  const { theme, setTheme } = useTheme()
  const [isConnected, setIsConnected] = useState(socket.connected)

  const [name, setName] = useState(user?.name ?? '')
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showCurrentPw, setShowCurrentPw] = useState(false)
  const [showNewPw, setShowNewPw] = useState(false)
  const [showConfirmPw, setShowConfirmPw] = useState(false)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileSuccess, setProfileSuccess] = useState(false)
  const [passwordError, setPasswordError] = useState<string | null>(null)
  const [passwordSuccess, setPasswordSuccess] = useState(false)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)

  useEffect(() => {
    if (user) setName(user.name ?? '')
  }, [user])

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

  useEffect(() => {
    const onConnect = () => setIsConnected(true)
    const onDisconnect = () => setIsConnected(false)
    socket.on('connect', onConnect)
    socket.on('disconnect', onDisconnect)
    if (!socket.connected) socket.connect()
    return () => {
      socket.off('connect', onConnect)
      socket.off('disconnect', onDisconnect)
    }
  }, [])

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
    <AppLayout
      currentView={currentView}
      onNavigate={onNavigate}
      isConnected={isConnected}
      title="Settings"
    >
      <div className="flex flex-col h-full overflow-hidden">
        <PageHeader
          subtitle="Manage your account, preferences, and security"
        />

        <PageContent>
          <div className="space-y-6">
            {/* Profile */}
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <User className="w-4 h-4" />
                Profile
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Your display name and email. Name appears in the top bar and on your activity.
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-4 mb-6">
                  <div className="h-14 w-14 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-lg">
                    {user ? getInitials(user.email, user.name) : '?'}
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{displayName}</p>
                    <p className="text-sm text-muted-foreground truncate">{user?.email}</p>
                  </div>
                </div>
                <form onSubmit={handleProfileSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="profile-name" className="text-xs font-medium text-muted-foreground">
                      Display name
                    </label>
                    <Input
                      id="profile-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Your name"
                      className="mt-1.5 h-10"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-medium text-muted-foreground">Email</label>
                    <Input value={user?.email ?? ''} disabled className="mt-1.5 h-10 bg-muted" />
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
          </section>

          {/* Security */}
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Lock className="w-4 h-4" />
                Security
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Change your password to keep your account secure. Use a strong, unique password.
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <form onSubmit={handlePasswordSubmit} className="space-y-4">
                  <div>
                    <label htmlFor="current-password" className="text-xs font-medium text-muted-foreground">
                      Current password
                    </label>
                    <div className="relative mt-1.5">
                      <Input
                        id="current-password"
                        type={showCurrentPw ? 'text' : 'password'}
                        value={currentPassword}
                        onChange={(e) => setCurrentPassword(e.target.value)}
                        placeholder="••••••••"
                        className="h-10 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-10 w-10"
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
                    <div className="relative mt-1.5">
                      <Input
                        id="new-password"
                        type={showNewPw ? 'text' : 'password'}
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        className="h-10 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-10 w-10"
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
                              'h-1.5 flex-1 rounded-full transition-colors',
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
                    <div className="relative mt-1.5">
                      <Input
                        id="confirm-password"
                        type={showConfirmPw ? 'text' : 'password'}
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder="••••••••"
                        minLength={6}
                        className="h-10 pr-10"
                      />
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="absolute right-0 top-0 h-10 w-10"
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
            </Card>
          </section>

          {/* Preferences */}
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Cpu className="w-4 h-4" />
                AI preferences
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Choose the default model for Chat and Prompt Testing.
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Default AI model</label>
                  <Select
                    value={llmProvider}
                    onValueChange={(v) => updateLLMProvider(v as 'openai' | 'anthropic' | 'google')}
                  >
                    <SelectTrigger className="mt-1.5 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="openai">OpenAI</SelectItem>
                      <SelectItem value="anthropic">Anthropic Claude</SelectItem>
                      <SelectItem value="google">Google Gemini</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Appearance */}
          <section className="space-y-4">
            <div>
              <h2 className="text-sm font-semibold flex items-center gap-2">
                <Palette className="w-4 h-4" />
                Appearance
              </h2>
              <p className="text-xs text-muted-foreground mt-1">
                Customize how the app looks. Changes apply immediately.
              </p>
            </div>
            <Card>
              <CardContent className="pt-6">
                <div>
                  <label className="text-xs font-medium text-muted-foreground">Theme</label>
                  <Select value={theme} onValueChange={(v) => setTheme(v as 'light' | 'dark')}>
                    <SelectTrigger className="mt-1.5 h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="light">Light</SelectItem>
                      <SelectItem value="dark">Dark</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </CardContent>
            </Card>
          </section>

          {/* Sign out */}
          <section>
            <Button
              variant="outline"
              size="sm"
              className="w-full gap-2 text-muted-foreground hover:text-destructive hover:border-destructive/50"
              onClick={() => logout()}
            >
              <LogOut className="w-4 h-4" />
              Sign out
            </Button>
          </section>
          </div>
        </PageContent>
      </div>
    </AppLayout>
  )
}
