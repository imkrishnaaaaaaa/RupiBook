import { Database, ExternalLink } from 'lucide-react'

/** Shown when backend env vars are missing — never crash the tester. */
export default function SetupScreen() {
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6">
      <div className="rounded-card border border-line bg-surface p-6 text-center shadow-card">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-tint">
          <Database size={26} className="text-brand" />
        </div>
        <h1 className="font-display text-xl font-bold text-text-1">Backend not configured</h1>
        <p className="mt-2 text-sm leading-relaxed text-text-2">
          Create a free Supabase project, run <code className="rounded bg-surface-2 px-1">supabase/schema.sql</code>,
          then fill <code className="rounded bg-surface-2 px-1">app/.env.local</code>.
        </p>
        <ol className="mt-4 space-y-1.5 text-left text-xs text-text-2">
          <li>1. supabase.com → New project (no card needed)</li>
          <li>2. SQL Editor → paste schema.sql → Run</li>
          <li>3. Enable Google provider in Authentication</li>
          <li>4. cp app/.env.example app/.env.local → fill values</li>
        </ol>
        <a
          href="https://supabase.com/dashboard"
          target="_blank"
          rel="noreferrer"
          className="tap-none mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-brand"
        >
          Open Supabase dashboard <ExternalLink size={14} />
        </a>
        <p className="mt-4 border-t border-line pt-3 text-[11px] text-text-3">
          Full guide: docs/SUPABASE_SETUP.md · restart <code>npm run dev</code> after saving .env.local
        </p>
      </div>
    </div>
  )
}
