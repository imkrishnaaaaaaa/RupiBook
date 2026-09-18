import { Suspense, useEffect } from 'react'
import { BrowserRouter } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '@/context/AuthContext'
import { supabase, SUPABASE_READY } from '@/lib/supabase'
import { flush, markSynced } from '@/lib/offlineQueue'
import { ToastHost, toast } from '@/components/ui/Toast'
import { Skeleton } from '@/components/ui/Skeleton'
import AppShell from '@/components/layout/AppShell'
import Auth from '@/pages/Auth'
import SetupScreen from '@/pages/SetupScreen'

function PageFallback() {
  return (
    <div className="space-y-4 py-6">
      <Skeleton className="h-8 w-40" />
      <Skeleton className="h-32 w-full rounded-card" />
      <Skeleton className="h-20 w-full rounded-card" />
    </div>
  )
}

/** Signed-out users only ever see the login screen; signed-in never do. */
function Gate() {
  const { session, loading } = useAuth()
  const qc = useQueryClient()

  // Flush offline-queued expenses on mount + whenever connectivity returns.
  useEffect(() => {
    if (!session) return

    const run = async () => {
      const n = await flush(async (bookId, input) => {
        const { error } = await supabase.from('expenses').insert({ ...input, book_id: bookId })
        if (error) throw error
      })
      markSynced()
      if (n > 0) {
        await qc.invalidateQueries() // show the freshly synced rows
        toast({ tone: 'success', title: `Synced ${n} offline expense${n > 1 ? 's' : ''}` })
      }
    }
    const onOnline = () => void run()

    void run()
    window.addEventListener('online', onOnline)
    return () => window.removeEventListener('online', onOnline)
  }, [session, qc])

  if (!SUPABASE_READY) return <Suspense fallback={null}><SetupScreen /></Suspense>
  if (loading) return <div className="flex min-h-dvh items-center justify-center"><PageFallback /></div>
  if (!session) return <Suspense fallback={null}><Auth /></Suspense>

  return <AppShell />
}

export default function App() {
  return (
    <BrowserRouter>
      <ToastHost />
      <Gate />
    </BrowserRouter>
  )
}
