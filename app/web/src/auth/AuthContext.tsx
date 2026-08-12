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
  changePassword as changePasswordRequest,
  fetchProfile,
  loadStoredSession,
  loginAccount,
  logoutAccount,
  persistSession,
  refreshSession,
  registerAccount,
  updateProfileName,
  type AuthSession,
  type AuthUser,
  type UserProfile,
} from '../api/authClient'

const REFRESH_MARGIN_MS = 60_000
const MIN_REFRESH_DELAY_MS = 5_000

interface AuthContextValue {
  user: AuthUser | null
  accessToken: string | null
  profile: UserProfile | null
  isAuthenticating: boolean
  isRestoring: boolean
  error: string | null
  login: (email: string, password: string) => Promise<void>
  register: (email: string, password: string, name: string) => Promise<void>
  logout: () => Promise<void>
  clearError: () => void
  refreshProfile: () => Promise<void>
  setProfileTokensUsed: (tokensUsed: number) => void
  saveProfileName: (name: string) => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [isAuthenticating, setIsAuthenticating] = useState(false)
  const [isRestoring, setIsRestoring] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const applySession = useCallback((next: AuthSession | null) => {
    persistSession(next)
    setSession(next)
    if (!next) setProfile(null)
  }, [])

  const login = useCallback(async (email: string, password: string) => {
    setIsAuthenticating(true)
    setError(null)
    try {
      const nextSession = await loginAccount({ email, password })
      applySession(nextSession)
    } catch (err) {
      console.error('[auth] login failed', err)
      setError(err instanceof Error ? err.message : 'Login failed')
      throw err
    } finally {
      setIsAuthenticating(false)
    }
  }, [applySession])

  const register = useCallback(async (email: string, password: string, name: string) => {
    setIsAuthenticating(true)
    setError(null)
    try {
      await registerAccount({ email, password, name: name || undefined })
      const nextSession = await loginAccount({ email, password })
      applySession(nextSession)
    } catch (err) {
      console.error('[auth] registration failed', err)
      setError(err instanceof Error ? err.message : 'Registration failed')
      throw err
    } finally {
      setIsAuthenticating(false)
    }
  }, [applySession])

  const logout = useCallback(async () => {
    const token = session?.accessToken ?? null
    applySession(null)
    if (token) {
      await logoutAccount(token).catch((err) => console.error('[auth] logout request failed', err))
    }
  }, [session, applySession])

  const clearError = useCallback(() => setError(null), [])

  const refreshProfile = useCallback(async () => {
    const nextProfile = await fetchProfile(session?.accessToken).catch((err) => {
      console.error('[auth] refreshProfile failed', err)
      return null
    })
    if (nextProfile) setProfile(nextProfile)
  }, [session])

  const setProfileTokensUsed = useCallback((tokensUsed: number) => {
    setProfile((prev) => (prev ? { ...prev, tokensUsed } : prev))
  }, [])

  const saveProfileName = useCallback(
    async (name: string) => {
      const next = await updateProfileName(session?.accessToken ?? null, name)
      setProfile(next)
    },
    [session],
  )

  const changePassword = useCallback(
    async (currentPassword: string, newPassword: string) => {
      await changePasswordRequest(session?.accessToken ?? null, currentPassword, newPassword)
    },
    [session],
  )

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const stored = loadStoredSession()
        const now = Date.now()
        if (stored) {
          const expired = stored.expiresAt * 1000 <= now + REFRESH_MARGIN_MS
          const next = expired ? await refreshSession(stored.refreshToken) : stored
          if (cancelled) return
          applySession(next)
          return
        }
        try {
          await fetchProfile(null)
          const next = await refreshSession()
          if (!cancelled) applySession(next)
        } catch {
          if (!cancelled) applySession(null)
        }
      } catch (err) {
        console.error('[auth] session restore failed', err)
        if (!cancelled) applySession(null)
      } finally {
        if (!cancelled) setIsRestoring(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [applySession])

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
        console.error('[auth] failed to load profile', err)
      })
    return () => {
      cancelled = true
    }
  }, [session])

  useEffect(() => {
    if (!session) return

    const msUntilExpiry = session.expiresAt * 1000 - Date.now()
    const delay = Math.max(msUntilExpiry - REFRESH_MARGIN_MS, MIN_REFRESH_DELAY_MS)

    const timer = window.setTimeout(() => {
      refreshSession(session.refreshToken)
        .then((next) => applySession(next))
        .catch((err) => {
          console.error('[auth] silent session refresh failed, signing out', err)
          applySession(null)
        })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [session, applySession])

  const value = useMemo<AuthContextValue>(
    () => ({
      user: session?.user ?? null,
      accessToken: session?.accessToken ?? null,
      profile,
      isAuthenticating,
      isRestoring,
      error,
      login,
      register,
      logout,
      clearError,
      refreshProfile,
      setProfileTokensUsed,
      saveProfileName,
      changePassword,
    }),
    [
      session,
      profile,
      isAuthenticating,
      isRestoring,
      error,
      login,
      register,
      logout,
      clearError,
      refreshProfile,
      setProfileTokensUsed,
      saveProfileName,
      changePassword,
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
