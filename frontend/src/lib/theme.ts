export type Theme = 'light' | 'dark'

/** The saved choice wins; a missing or unknown value falls back to the OS preference. */
export function resolveTheme(saved: string | null, prefersDark: boolean): Theme {
  if (saved === 'light' || saved === 'dark') return saved
  return prefersDark ? 'dark' : 'light'
}
