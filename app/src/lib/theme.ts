export type Theme = 'dark' | 'light' | 'system'

const KEY = 'rb_theme'

export function getStoredTheme(): Theme {
  const v = localStorage.getItem(KEY)
  return v === 'light' || v === 'system' ? v : 'dark'
}

export function applyTheme(theme: Theme) {
  localStorage.setItem(KEY, theme)
  const dark =
    theme === 'dark' ||
    (theme === 'system' && window.matchMedia('(prefers-color-scheme: dark)').matches)
  document.documentElement.classList.toggle('dark', dark)
}

export function watchSystemTheme(onChange: () => void) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}
