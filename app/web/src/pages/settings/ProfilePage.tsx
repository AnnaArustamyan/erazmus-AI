import { useEffect, useState, type FormEvent } from 'react'
import { useAuth } from '../../auth/AuthContext'

export function ProfilePage() {
  const { profile, saveProfileName } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [status, setStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (profile?.name != null) setName(profile.name)
  }, [profile?.name])

  async function onSubmit(event: FormEvent) {
    event.preventDefault()
    setSaving(true)
    setError(null)
    setStatus(null)
    try {
      await saveProfileName(name)
      setStatus('Saved')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Profile</h1>
      <p className="mb-5 text-sm text-app-text-dim">Your name is shown in the workspace. Email is read-only.</p>
      <form onSubmit={(e) => void onSubmit(e)} className="max-w-md space-y-4">
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-lg border border-app-border bg-app-panel px-3 py-2 text-sm"
          />
        </label>
        <label className="block text-sm">
          <span className="mb-1 block font-medium">Email</span>
          <input
            value={profile?.email ?? ''}
            readOnly
            className="w-full rounded-lg border border-app-border bg-app-panel-2 px-3 py-2 text-sm text-app-text-dim"
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
          disabled={saving || !name.trim()}
          className="rounded-lg bg-app-text px-3 py-2 text-sm font-semibold text-app-bg disabled:opacity-40"
        >
          {saving ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
