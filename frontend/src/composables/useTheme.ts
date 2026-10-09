import { ref } from 'vue'
import { resolveTheme, type Theme } from '../lib/theme'

const KEY = 'btm.theme'

function readSaved(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

const theme = ref<Theme>(resolveTheme(readSaved(), prefersDark()))

function apply(t: Theme) {
  document.documentElement.setAttribute('data-theme', t)
}

/** Shared theme state; the choice sets `data-theme` on `<html>` and is saved. */
export function useTheme() {
  apply(theme.value)
  function toggle() {
    theme.value = theme.value === 'dark' ? 'light' : 'dark'
    apply(theme.value)
    try {
      localStorage.setItem(KEY, theme.value)
    } catch {
      /* storage unavailable: the choice lasts for this session only */
    }
  }
  return { theme, toggle }
}
