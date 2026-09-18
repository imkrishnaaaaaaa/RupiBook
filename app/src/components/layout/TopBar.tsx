import { useAuth } from '@/context/AuthContext'
import { useNavigate } from 'react-router-dom'
import Avatar from '@/components/ui/Avatar'

function RupiBookLogo({ size = 32 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#31D7A5" />
          <stop offset="100%" stopColor="#18B98E" />
        </linearGradient>
        <linearGradient id="wallet" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#0E4537" />
          <stop offset="100%" stopColor="#08392F" />
        </linearGradient>
        <linearGradient id="symbol" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#2CE0A7" />
          <stop offset="100%" stopColor="#18B98E" />
        </linearGradient>
      </defs>

      {/* Rounded square background (matches app icon) */}
      <rect x="4" y="4" width="92" height="92" rx="18" fill="url(#bg)" />

      {/* Wallet shape */}
      <rect x="18" y="42" width="64" height="36" rx="8" fill="url(#wallet)" />

      {/* Wallet top edge highlight */}
      <path d="M22 46 H78" stroke="#276E5C" strokeWidth="2" opacity="0.6" />

      {/* ₹ symbol (combined R + rupee) */}
      <g fill="none" stroke="url(#symbol)" strokeWidth="7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M50 28 V54" />
        <path d="M38 34 H62" />
        <path d="M38 42 H60" />
        <path d="M50 30 C65 26 72 32 72 40 C72 48 62 52 50 53" />
        <path d="M54 53 L66 62" />
      </g>
    </svg>
  )
}

export default function TopBar() {
  const { user } = useAuth()
  const navigate = useNavigate()

  return (
    <header className="sticky top-0 z-30 w-full border-b border-line bg-surface/80 backdrop-blur-xl">
      <div className="mx-auto flex h-14 max-w-md items-center justify-between px-4">
        {/* Left: Logo + App Name */}
        <div className="flex items-center gap-2">
          <RupiBookLogo size={32} />
          <span className="font-display text-lg font-semibold text-text-1">RupiBook</span>
        </div>

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
    </header>
  )
}