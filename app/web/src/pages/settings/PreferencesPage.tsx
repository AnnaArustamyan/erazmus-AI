import type { ThemeMode } from '../../components/ErasmusChatWorkspace.types'
import type { UserPreferences } from '../../preferences'

export function PreferencesPage({
  preferences,
  onChange,
}: {
  preferences: UserPreferences
  onChange: (next: UserPreferences) => void
}) {
  return (
    <div>
      <h1 className="mb-1 text-lg font-semibold">Preferences</h1>
      <p className="mb-5 text-sm text-app-text-dim">Stored on this device. Theme survives refresh.</p>
      <div className="max-w-md space-y-5">
        <fieldset>
          <legend className="mb-2 text-sm font-medium">Theme</legend>
          <div className="flex gap-2">
            {(['dark', 'light'] as ThemeMode[]).map((mode) => (
              <button
                key={mode}
                type="button"
                aria-pressed={preferences.theme === mode}
                onClick={() => onChange({ ...preferences, theme: mode })}
                className={`rounded-lg border px-3 py-1.5 text-sm capitalize ${
                  preferences.theme === mode
                    ? 'border-app-accent bg-app-accent-soft'
                    : 'border-app-border'
                }`}
              >
                {mode}
              </button>
            ))}
          </div>
        </fieldset>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={preferences.enterToSend}
            onChange={(e) => onChange({ ...preferences, enterToSend: e.target.checked })}
          />
          Press Enter to send (Shift+Enter for a new line)
        </label>
      </div>
    </div>
  )
}
