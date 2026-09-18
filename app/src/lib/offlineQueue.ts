import type { ExpenseInput } from './types'

/**
 * Offline queue: failed saves land here and flush when connectivity returns.
 * ponytail: localStorage queue — swap to SQLite (Capacitor) in the Android phase.
 */

const KEY = 'rb_offline_queue'

interface QueuedExpense extends ExpenseInput {
  book_id: string
  queued_at: string
}

function read(): QueuedExpense[] {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? '[]') as QueuedExpense[]
  } catch {
    return []
  }
}

function write(items: QueuedExpense[]) {
  try {
    if (items.length === 0) localStorage.removeItem(KEY)
    else localStorage.setItem(KEY, JSON.stringify(items))
  } catch { /* quota — drop silently, nothing else to do */ }
}

export function queueSize(): number {
  return read().length
}

export function enqueue(bookId: string, input: ExpenseInput): void {
  const items = read()
  items.push({ ...input, book_id: bookId, queued_at: new Date().toISOString() })
  write(items)
}

/** Try to push everything queued. Returns how many synced. */
export async function flush(
  insert: (bookId: string, input: ExpenseInput) => Promise<void>,
): Promise<number> {
  const items = read()
  if (!items.length || !navigator.onLine) return 0

  const remaining: QueuedExpense[] = []
  let synced = 0

  for (const item of items) {
    try {
      await insert(item.book_id, item)
      synced++
    } catch {
      remaining.push(item) // still failing — keep for next attempt
    }
  }
  write(remaining)
  return synced
}

/* ── last synced timestamp (Settings display + refresh points) ── */
const LAST_SYNC_KEY = 'rb_last_sync'

export function lastSyncedAt(): number {
  return Number(localStorage.getItem(LAST_SYNC_KEY) ?? 0)
}

export function markSynced(): void {
  try { localStorage.setItem(LAST_SYNC_KEY, String(Date.now())) } catch { /* ignore */ }
}
