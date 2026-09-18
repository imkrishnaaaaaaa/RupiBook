import { useCallback, useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { flush, queueSize, markSynced, lastSyncedAt, onQueueChanged } from '@/lib/offlineQueue'
import { supabase } from '@/lib/supabase'
import { toast } from '@/components/ui/Toast'

/** Shared sync status/action — used by the header status chip and the
 *  Settings sync panel, so the two never show conflicting state. */
export function useSyncStatus() {
  const qc = useQueryClient()
  const [pending, setPending] = useState(() => queueSize())
  const [busy, setBusy] = useState(false)
  const [lastSync, setLastSync] = useState(() => lastSyncedAt())

  // Queue changes elsewhere (an offline save, a flush from another mounted
  // instance of this hook) — stay in sync without a shared store.
  useEffect(() => onQueueChanged(() => setPending(queueSize())), [])

  const syncNow = useCallback(async (opts: { silent?: boolean } = {}) => {
    if (!navigator.onLine) {
      if (!opts.silent) toast({ tone: 'info', title: 'You are offline', message: 'Connect to the internet and try again.' })
      return
    }
    const before = queueSize()
    setBusy(true)
    try {
      const n = await flush(async (bookId, input) => {
        const { error } = await supabase.from('expenses').insert({ ...input, book_id: bookId })
        if (error) throw error
      })
      await qc.invalidateQueries()
      markSynced()
      setLastSync(Date.now())
      setPending(queueSize())
      if (!opts.silent && before > 0 && n > 0) {
        toast({ tone: 'success', title: `Synced ${n} expense${n > 1 ? 's' : ''}` })
      }
    } finally {
      setBusy(false)
    }
  }, [qc])

  return { pending, busy, lastSync, syncNow }
}
