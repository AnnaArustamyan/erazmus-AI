import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchProfile,
  loginAccount,
  logoutAccount,
  refreshSession,
  registerAccount,
  type AuthSession,
  type AuthUser,
  type UserProfile,
} from '../api/authClient'

// Refresh this long before the access token actually expires, so a slow
// request never races an expiry that lands mid-flight.
const REFRESH_MARGIN_MS = 60_000
const MIN_REFRESH_DELAY_MS = 5_000

interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  profile: UserProfile | null
  isAuthenticating: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  refreshProfile: () => Promise<void>
  /** Cheap local sync after a chat response, instead of a full refetch. */
  setProfileTokensUsed: (tokensUsed: number) => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const login = useCallback(async (email: string, password: string) => {
    setIsAuthenticating(true)
    setError(null)
    try {
      const nextSession = await loginAccount({ email, password })
      setSession(nextSession)
    } catch (err) {
      console.error('[auth] login failed', err)
      setError(err instanceof Error ? err.message : 'Login failed')
      throw err
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const register = useCallback(async (email: string, password: string, name: string) => {
    setIsAuthenticating(true)
    setError(null)
    try {
      await registerAccount({ email, password, name: name || undefined })
      const nextSession = await loginAccount({ email, password })
      setSession(nextSession)
    } catch (err) {
      console.error('[auth] registration failed', err)
      setError(err instanceof Error ? err.message : 'Registration failed')
      throw err
    } finally {
      setIsAuthenticating(false)
    }
  }, [])

  const logout = useCallback(async () => {
    const token = session?.accessToken
    setSession(null)
    setProfile(null)
    if (token) {
      await logoutAccount(token).catch((err) => console.error('[auth] logout request failed', err))
    }
  }, [session])

  const clearError = useCallback(() => setError(null), [])

  const refreshProfile = useCallback(async () => {
    if (!session) return
    const nextProfile = await fetchProfile(session.accessToken).catch((err) => {
      console.error('[auth] refreshProfile failed', err)
      return null
    })
    if (nextProfile) setProfile(nextProfile)
  }, [session])

  const setProfileTokensUsed = useCallback((tokensUsed: number) => {
    setProfile((prev) => (prev ? { ...prev, tokensUsed } : prev))
  }, [])

  // Loads the profile (name, plan, token usage) once a session exists.
  useEffect(() => {
    if (!session) {
      setProfile(null)
      return
    }
    let cancelled = false
    fetchProfile(session.accessToken)
      .then((nextProfile) => {
        if (!cancelled) setProfile(nextProfile)
      })
      .catch((err) => {
        // Non-fatal: the workspace just falls back to default token display.
        console.error('[auth] failed to load profile', err)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  // Silently renews the session before the access token expires, so users
  // aren't dropped back to the login screen after ~1h of activity. Each
  // successful refresh reschedules itself off the new session's expiry.
  useEffect(() => {
    if (!session) return

    const msUntilExpiry = session.expiresAt * 1000 - Date.now()
    const delay = Math.max(msUntilExpiry - REFRESH_MARGIN_MS, MIN_REFRESH_DELAY_MS)

    const timer = window.setTimeout(() => {
      refreshSession(session.refreshToken)
        .then(setSession)
        .catch((err) => {
          console.error('[auth] silent session refresh failed, signing out', err)
          setSession(null)
        })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [session])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      profile,
      isAuthenticating,
      error,
      login,
      register,
      logout,
      clearError,
      refreshProfile,
      setProfileTokensUsed,
    }),
    [
      session,
      profile,
      isAuthenticating,
      error,
      login,
      register,
      logout,
      clearError,
      refreshProfile,
      setProfileTokensUsed,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return ctx
}
