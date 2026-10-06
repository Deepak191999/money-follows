import { useTheme, type Theme } from '../theme'

const labels: Record<Theme, { glyph: string; name: string }> = {
  system: { glyph: '◐', name: 'System' },
  light: { glyph: '☀', name: 'Light' },
  dark: { glyph: '☾', name: 'Dark' },
}

export default function ThemeToggle() {
  const { theme, cycleTheme } = useTheme()
  const { glyph, name } = labels[theme]

  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycleTheme}
      aria-label={`Theme: ${name}. Click to change.`}
      title={`Theme: ${name}`}
    >
      <span aria-hidden="true">{glyph}</span> {name}
    </button>
  )
}
