import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'

export const THEME_KEY = 'theme'

export type Theme = 'light' | 'dark' | 'system'

/** Also the order the navbar button cycles through. */
export const themes: Theme[] = ['system', 'light', 'dark']

function isTheme(value: unknown): value is Theme {
  return typeof value === 'string' && (themes as string[]).includes(value)
}

/**
 * localStorage throws in a private window and when site data is blocked, so every
 * access is guarded: a theme we cannot remember is better than an app that crashes.
 */
function readStoredTheme(): Theme {
  try {
    const stored = localStorage.getItem(THEME_KEY)
    return isTheme(stored) ? stored : 'system'
  } catch {
    return 'system'
  }
}

/**
 * 'system' removes the attribute so the prefers-color-scheme media query in
 * styles.css decides; 'light' and 'dark' pin it and win over that query.
 */
export function applyTheme(theme: Theme) {
  const root = document.documentElement
  if (theme === 'system') root.removeAttribute('data-theme')
  else root.dataset.theme = theme
}

interface ThemeContextValue {
  theme: Theme
  setTheme: (next: Theme) => void
  cycleTheme: () => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>(readStoredTheme)

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  const setTheme = useCallback((next: Theme) => {
    setThemeState(next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      /* not persisted; the choice still applies for this session */
    }
  }, [])

  const cycleTheme = useCallback(() => {
    setTheme(themes[(themes.indexOf(theme) + 1) % themes.length])
  }, [theme, setTheme])

  return (
    <ThemeContext.Provider value={{ theme, setTheme, cycleTheme }}>{children}</ThemeContext.Provider>
  )
}

export function useTheme(): ThemeContextValue {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used inside ThemeProvider')
  return ctx
}
