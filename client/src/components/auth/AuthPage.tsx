import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { useTheme } from '@/contexts/ThemeContext'
import { Input } from '@/components/ui/input'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { Sun, Moon } from 'lucide-react'
import { cn } from '@/lib/utils'

type AuthMode = 'login' | 'register'

export function AuthPage() {
  const { login, register } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [mode, setMode] = useState<AuthMode>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)
    try {
      if (mode === 'login') {
        await login(email, password)
      } else {
        await register(email, password)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh min-h-screen flex items-center justify-center bg-background p-4 sm:p-6 pb-[calc(1rem+env(safe-area-inset-bottom))] relative">
      <Button
        variant="ghost"
        size="icon"
        className="absolute top-4 right-4 h-9 w-9"
        onClick={toggleTheme}
        aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      >
        {theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </Button>
      <Card className="w-full max-w-sm">
        <CardHeader>
          <CardTitle>{mode === 'login' ? 'Sign in' : 'Create account'}</CardTitle>
          <CardDescription>
            {mode === 'login'
              ? 'Enter your email and password to continue'
              : 'Register with your email and password'}
          </CardDescription>
        </CardHeader>
        <form onSubmit={handleSubmit}>
          <CardContent className="space-y-4">
            {error && (
              <div
                className="text-sm text-destructive bg-destructive/10 rounded-md px-3 py-2"
                role="alert"
              >
                {error}
              </div>
            )}
            <div className="space-y-2">
              <label htmlFor="auth-email" className="text-sm font-medium">
                Email
              </label>
              <Input
                id="auth-email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
            <div className="space-y-2">
              <label htmlFor="auth-password" className="text-sm font-medium">
                Password
              </label>
              <Input
                id="auth-password"
                type="password"
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={mode === 'register' ? 6 : undefined}
                disabled={loading}
              />
              {mode === 'register' && (
                <p className="text-xs text-muted-foreground">At least 6 characters</p>
              )}
            </div>
          </CardContent>
          <CardFooter className="flex flex-col gap-4">
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? 'Please wait...' : mode === 'login' ? 'Sign in' : 'Create account'}
            </Button>
            <button
              type="button"
              onClick={() => {
                setMode(mode === 'login' ? 'register' : 'login')
                setError(null)
              }}
              className={cn(
                'text-sm text-muted-foreground hover:text-foreground transition-colors'
              )}
            >
              {mode === 'login'
                ? "Don't have an account? Sign up"
                : 'Already have an account? Sign in'}
            </button>
          </CardFooter>
        </form>
      </Card>
    </div>
  )
}
