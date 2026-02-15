import {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
  type ReactNode,
} from 'react'
import { fetchMe, login, logout, register, updateProfile, changePassword, type AuthUser } from '@/lib/auth-api'

interface AuthContextValue {
  user: AuthUser | null
  loading: boolean
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string) => Promise<void>
  logout: () => Promise<void>
  updateProfile: (name: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
  refetch: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    try {
      const u = await fetchMe()
      setUser(u)
    } catch {
      setUser(null)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const handleLogin = useCallback(async (email: string, password: string) => {
    const u = await login(email, password)
    setUser(u)
  }, [])

  const handleRegister = useCallback(async (email: string, password: string) => {
    const u = await register(email, password)
    setUser(u)
  }, [])

  const handleLogout = useCallback(async () => {
    await logout()
    setUser(null)
  }, [])

  const handleUpdateProfile = useCallback(async (name: string) => {
    const u = await updateProfile(name)
    setUser(u)
  }, [])

  const handleChangePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await changePassword(currentPassword, newPassword)
  }, [])

  const value: AuthContextValue = {
    user,
    loading,
    login: handleLogin,
    register: handleRegister,
    logout: handleLogout,
    updateProfile: handleUpdateProfile,
    changePassword: handleChangePassword,
    refetch,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
