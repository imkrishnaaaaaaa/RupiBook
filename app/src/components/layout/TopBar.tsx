import { CloudUpload, RefreshCw } from 'lucide-react'
import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Avatar from '@/components/ui/Avatar'
import { useSyncStatus } from '@/hooks/useSync'

export default function TopBar() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const { pending, busy, syncNow } = useSyncStatus()

  return (
    // pt-safe-top — on phones that draw the app edge-to-edge (no reserved
    // status bar strip), this header would otherwise start at the very top
    // of the screen and the status bar would sit on top of the profile
    // button, eating its taps. BottomNav already does the equivalent thing
    // at the bottom (pb-safe-bottom); the top bar needs the same treatment.
    <header className="sticky top-0 z-30 w-full border-b border-line bg-surface/80 pt-safe-top backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        {/* Left: Logo + App Name — same file as the home-screen icon, not a
            hand-redrawn copy, so they can never visually drift apart. */}
        <div className="flex items-center gap-2">
          <img src="/icons/icon.svg" alt="" width={32} height={32} />
          <span className="font-display text-lg font-semibold text-text-1">RupiBook</span>
        </div>

        <div className="flex items-center gap-2">
          {/* Sync status — only shown when there's something to say
              (syncing, or offline items waiting). Nothing to show = nothing shown. */}
          {(busy || pending > 0) && (
            <button
              onClick={() => void syncNow()}
              disabled={busy}
              aria-label={busy ? 'Syncing' : `${pending} expense${pending > 1 ? 's' : ''} waiting to sync`}
              className="tap-none flex items-center gap-1 rounded-full border border-line bg-surface-2 px-2.5 py-1.5 text-xs font-medium text-text-2"
            >
              {busy ? <RefreshCw size={13} className="animate-spin" /> : <CloudUpload size={13} />}
              {!busy && pending}
            </button>
          )}

          {/* Right: Profile avatar */}
          <div className="relative">
            <button
              onClick={() => navigate('/profile')}
              className="p-0 bg-transparent"
              aria-label="Profile"
            >
              <Avatar
                src={user?.user_metadata?.avatar_url ?? null}
                name={user?.user_metadata?.full_name ?? null}
                email={user?.email ?? null}
                size={36}
                fallback="icon"
              />
            </button>
          </div>
        </div>
      </div>
    </header>
  )
}