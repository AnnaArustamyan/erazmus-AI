import { useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'

export function SecurityPage() {
  const { changePassword, logout } = useAuth()
  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [status, setStatus] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      await changePassword(currentPassword, newPassword)
      setStatus('Password updated')
      setCurrentPassword('')
      setNewPassword('')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not change password')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Security</h1>
      <p className="mb-5 text-sm text-app-text-dim">Change your password or sign out of this device.</p>
      <form onSubmit={(e) => void onSubmit(e)} className="mb-8 max-w-md space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Current password</span>
          <input
            type="password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full rounded-lg border border-app-border bg-app-panel px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">New password</span>
          <input
            type="password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            className="w-full rounded-lg border border-app-border bg-app-panel px-3 py-2 text-sm"
          />
        </label>
        {error && (
          <p role="alert" className="text-xs text-app-danger">
            {error}
          </p>
        )}
        {status && (
          <p role="status" className="text-xs text-app-accent">
            {status}
          </p>
        )}
        <button
          type="submit"
          disabled={saving || currentPassword.length < 6 || newPassword.length < 6}
          className="rounded-lg bg-app-text px-3 py-2 text-sm font-semibold text-app-bg disabled:opacity-40"
        >
          {saving ? 'Updating…' : 'Update password'}
        </button>
      </form>
      <button
        type="button"
        onClick={() => void logout()}
        className="rounded-lg border border-app-danger/40 px-3 py-2 text-sm font-medium text-app-danger"
      >
        Sign out
      </button>
    </div>
  )
}
