import type { ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { ArrowLeft } from 'lucide-react'

/** Full-screen page pushed over the tab shell (Profile, Settings…), with a back button. */
export default function StackPage({ title, children }: { title: string; children: ReactNode }) {
  const navigate = useNavigate()

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center gap-3 border-b border-line bg-surface/80 px-4 backdrop-blur-xl">
        <button
          onClick={() => navigate(-1)}
          aria-label="Back"
          className="tap-none -ml-2 flex h-9 w-9 items-center justify-center rounded-full text-text-1"
        >
          <ArrowLeft size={20} />
        </button>
        <span className="font-display text-lg font-semibold text-text-1">{title}</span>
      </header>
      <main className="flex-1 px-4 pb-10">{children}</main>
    </div>
  )
}
