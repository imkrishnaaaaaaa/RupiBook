import { useState } from 'react'
import { LogOut, MoonStar, Settings } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { applyTheme, getStoredTheme, type Theme } from '@/lib/theme'
import { useNavigate } from 'react-router-dom'
import Button from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import Avatar from '@/components/ui/Avatar'

const THEMES: { key: Theme; label: string; icon: typeof MoonStar }[] = [
  { key: 'dark', label: 'Dark', icon: MoonStar },
  { key: 'light', label: 'Light', icon: MoonStar },
  { key: 'system', label: 'System', icon: MoonStar },
]

export default function Profile() {
  const { user, signOut } = useAuth()
  const navigate = useNavigate()
  const displayName = user?.user_metadata?.full_name ?? user?.email?.split('@')[0] ?? 'User'
  const [currentTheme, setCurrentTheme] = useState<Theme>(() => getStoredTheme())

  return (
    <div className="pt-6">
      {/* Profile header */}
      <Card className="flex items-center gap-4">
        <Avatar
          src={user?.user_metadata?.avatar_url ?? null}
          name={user?.user_metadata?.full_name ?? null}
          email={user?.email ?? null}
          size={64}
          fallback="icon"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold text-text-1">{displayName}</p>
          <p className="text-xs text-text-3">{user?.email}</p>
          <p className="text-xs text-text-3 mt-0.5">Signed in with Google</p>
        </div>
      </Card>

      {/* Quick actions */}
      <SectionTitle>Quick actions</SectionTitle>
      <Card className="space-y-2">
        <button
          onClick={() => navigate('/settings')}
          className="tap-none flex w-full items-center gap-3 rounded-card border border-line bg-surface-2 px-4 py-3 text-left transition-colors hover:bg-surface-3"
        >
          <Settings size={20} className="shrink-0 text-text-2" />
          <span className="font-medium text-text-1">Settings</span>
        </button>
        <Button variant="secondary" onClick={() => void signOut()} className="w-full justify-start gap-3">
          <LogOut size={20} /> Sign out
        </Button>
      </Card>

      {/* Appearance */}
      <SectionTitle>Appearance</SectionTitle>
      <Card className="flex gap-2">
        {THEMES.map(t => (
          <button
            key={t.key}
            onClick={() => { applyTheme(t.key); setCurrentTheme(t.key) }}
            data-theme={t.key}
            className={`tap-none flex flex-1 items-center justify-center gap-1.5 rounded-full border py-2.5 text-sm font-semibold transition-colors ${
              currentTheme === t.key ? 'border-transparent bg-brand-tint text-brand' : 'border-line bg-surface-2 text-text-2'
            }`}
          >
            <t.icon size={14} /> {t.label}
          </button>
        ))}
      </Card>

      <p className="mt-8 text-center text-[11px] text-text-3">
        RupiBook v{__APP_VERSION__} · React + Capacitor + Supabase · row-level secured
      </p>
    </div>
  )
}