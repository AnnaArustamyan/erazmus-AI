import { useCallback, useId, useState, type FormEvent } from 'react'
import { AlertTriangle, Moon, Sun } from 'lucide-react'
import { useAuth } from '../auth/AuthContext'
import type { ThemeMode } from './ErasmusChatWorkspace.types'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MIN_PASSWORD_LENGTH = 6

type AuthMode = 'sign-in' | 'sign-up'

interface FieldErrors {
  email?: string
  password?: string
}

interface LoginScreenProps {
  theme: ThemeMode
  onThemeChange: (theme: ThemeMode) => void
}

export function LoginScreen({ theme, onThemeChange }: LoginScreenProps) {
  const { login, register, isAuthenticating, error, clearError } = useAuth()
  const [mode, setMode] = useState<AuthMode>('sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [name, setName] = useState('')
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})

  const emailId = useId()
  const passwordId = useId()
  const nameId = useId()

  const switchMode = useCallback(
    (next: AuthMode) => {
      setMode(next)
      setFieldErrors({})
      clearError()
    },
    [clearError],
  )

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault()

      const nextFieldErrors: FieldErrors = {}
      if (!EMAIL_PATTERN.test(email.trim())) {
        nextFieldErrors.email = 'Enter a valid email address.'
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        nextFieldErrors.password = `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`
      }
      setFieldErrors(nextFieldErrors)
      if (Object.keys(nextFieldErrors).length > 0) return

      try {
        if (mode === 'sign-in') {
          await login(email.trim(), password)
        } else {
          await register(email.trim(), password, name.trim())
        }
      } catch {
        // surfaced via context `error`
      }
    },
    [email, password, name, mode, login, register],
  )

  return (
    <div
      data-theme={theme}
      data-testid="erasmus-login-screen"
      className="workspace-shell relative flex min-h-screen w-full items-center justify-center px-4 text-app-text"
    >
      <div className="absolute right-4 top-4">
        <div
          role="group"
          aria-label="Theme"
          className="flex items-center border border-app-border bg-app-surface p-0.5"
        >
          <button
            type="button"
            aria-label="Light theme"
            aria-pressed={theme === 'light'}
            onClick={() => onThemeChange('light')}
            className={`flex h-7 w-8 items-center justify-center focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
              theme === 'light' ? 'bg-app-panel-2 text-app-text' : 'text-app-text-dim'
            }`}
          >
            <Sun size={13} />
          </button>
          <button
            type="button"
            aria-label="Dark theme"
            aria-pressed={theme === 'dark'}
            onClick={() => onThemeChange('dark')}
            className={`flex h-7 w-8 items-center justify-center focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
              theme === 'dark' ? 'bg-app-panel-2 text-app-text' : 'text-app-text-dim'
            }`}
          >
            <Moon size={13} />
          </button>
        </div>
      </div>

      <div className="w-full max-w-sm border border-app-border bg-app-surface p-7">
        <div className="mb-7">
          <div className="font-display text-[1.65rem] font-semibold tracking-tight text-app-text">
            Erasmus AI
          </div>
          <p className="mt-1.5 text-sm leading-relaxed text-app-text-dim">
            Sign in to draft Erasmus+ applications under Programme Guide pass rules.
          </p>
        </div>

        <div
          role="tablist"
          aria-label="Authentication mode"
          className="mb-5 flex rounded-lg border border-app-border p-0.5"
        >
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sign-in'}
            onClick={() => switchMode('sign-in')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
              mode === 'sign-in' ? 'bg-app-accent-soft text-app-text' : 'text-app-text-dim'
            }`}
          >
            Sign in
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={mode === 'sign-up'}
            onClick={() => switchMode('sign-up')}
            className={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors focus-visible:outline-2 focus-visible:outline-app-accent focus-visible:outline-offset-2 ${
              mode === 'sign-up' ? 'bg-app-accent-soft text-app-text' : 'text-app-text-dim'
            }`}
          >
            Create account
          </button>
        </div>

        {error && (
          <p
            role="alert"
            className="mb-4 flex items-start gap-1.5 rounded-lg border border-app-danger/40 bg-app-bg px-3 py-2 text-xs font-medium text-app-danger"
          >
            <AlertTriangle size={13} className="mt-0.5 shrink-0" aria-hidden="true" />
            {error}
          </p>
        )}

        <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-3.5">
          {mode === 'sign-up' && (
            <div className="flex flex-col gap-1.5">
              <label htmlFor={nameId} className="text-xs font-medium text-app-text-dim">
                Name (optional)
              </label>
              <input
                id={nameId}
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none focus:border-app-accent"
              />
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor={emailId} className="text-xs font-medium text-app-text-dim">
              Email
            </label>
            <input
              id={emailId}
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={Boolean(fieldErrors.email)}
              aria-describedby={fieldErrors.email ? `${emailId}-error` : undefined}
              className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none focus:border-app-accent"
            />
            {fieldErrors.email && (
              <p id={`${emailId}-error`} className="text-xs text-app-danger">
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor={passwordId} className="text-xs font-medium text-app-text-dim">
              Password
            </label>
            <input
              id={passwordId}
              type="password"
              autoComplete={mode === 'sign-in' ? 'current-password' : 'new-password'}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              aria-invalid={Boolean(fieldErrors.password)}
              aria-describedby={fieldErrors.password ? `${passwordId}-error` : undefined}
              className="rounded-lg border border-app-border bg-app-bg px-3 py-2 text-sm text-app-text outline-none focus:border-app-accent"
            />
            {fieldErrors.password && (
              <p id={`${passwordId}-error`} className="text-xs text-app-danger">
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            disabled={isAuthenticating}
            className="mt-1.5 flex h-9 items-center justify-center rounded-lg bg-app-text text-sm font-semibold text-app-bg disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isAuthenticating ? 'Please wait…' : mode === 'sign-in' ? 'Sign in' : 'Create account'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default LoginScreen
