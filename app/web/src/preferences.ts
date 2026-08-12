import type { ThemeMode } from './components/ErasmusChatWorkspace.types'

export interface UserPreferences {
  theme: ThemeMode
  enterToSend: boolean
}

const KEY = 'ea.preferences'

const DEFAULTS: UserPreferences = {
  theme: 'dark',
  enterToSend: true,
}

export function loadPreferences(): UserPreferences {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return { ...DEFAULTS }
    const parsed = JSON.parse(raw) as Partial<UserPreferences>
    return {
      theme: parsed.theme === 'light' || parsed.theme === 'dark' ? parsed.theme : DEFAULTS.theme,
      enterToSend: typeof parsed.enterToSend === 'boolean' ? parsed.enterToSend : DEFAULTS.enterToSend,
    }
  } catch {
    return { ...DEFAULTS }
  }
}

export function savePreferences(prefs: UserPreferences): void {
  localStorage.setItem(KEY, JSON.stringify(prefs))
}

const CONVERSATION_KEY = 'ea.activeConversationId'

export function loadActiveConversationId(): string | null {
  try {
    return localStorage.getItem(CONVERSATION_KEY)
  } catch {
    return null
  }
}

export function saveActiveConversationId(id: string | undefined): void {
  try {
    if (!id) localStorage.removeItem(CONVERSATION_KEY)
    else localStorage.setItem(CONVERSATION_KEY, id)
  } catch {
    // ignore quota / private mode
  }
}
