import { useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Clock, Delete, Tag } from 'lucide-react'
import { useActiveBookId } from '@/context/AuthContext'
import { useAddExpense, useAutopaySyncOnOpen, useCatalog, useUndoLastExpense } from '@/hooks/data'
import { catIcon } from '@/lib/catIcons'
import { fmtMoney, toLocalInput } from '@/lib/format'
import { enqueue } from '@/lib/offlineQueue'
import Button from '@/components/ui/Button'
import { toast } from '@/components/ui/Toast'

const KEYS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', '.', '0', 'back'] as const

const STOP_WORDS = new Set(['the','a','an','is','in','at','to','of','on','and','or','for','with','from','was','are','this','that'])

function buzz(pattern: number | number[] = 8) {
  navigator.vibrate?.(pattern)
}

/** True when a save failure looks like a connectivity problem, not bad data.
 *  PostgREST errors carry a code (23503 FK, 42501 RLS, …) — retrying those
 *  can never succeed, so they must not enter the offline queue. */
function looksOffline(e: unknown): boolean {
  if (!navigator.onLine) return true
  const err = e as { code?: string; message?: string }
  return !err.code && /network|fetch|load failed|timed?\s*out/i.test(err.message ?? '')
}

/** Tiny relative label for the time chip. */
function whenLabel(v: string): string {
  const picked = new Date(v)
  const now = new Date()
  const mins = Math.round((now.getTime() - picked.getTime()) / 60000)
  if (mins > -5 && mins < 5) return 'now'
  if (picked.toDateString() === now.toDateString())
    return picked.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
  const yest = new Date(now); yest.setDate(now.getDate() - 1)
  const day = picked.toDateString() === yest.toDateString()
    ? 'yesterday'
    : picked.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
  return `${day}, ${picked.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}`
}

export default function Log() {
  const bookId = useActiveBookId()
  useAutopaySyncOnOpen(bookId)

  const { data: catalog } = useCatalog(bookId)
  const addExpense = useAddExpense(bookId)
  const undoLast = useUndoLastExpense(bookId)

  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [sourceId, setSourceId] = useState<string | null>(null)
  const [modeId, setModeId] = useState<string | null>(null)
  const [notes, setNotes] = useState('')
  const [manualTags, setManualTags] = useState('')
  // null means "now": resolved fresh on every render and at save time, so an
  // idle app never sends a stale clock reading. A picked value replaces it;
  // clearing the field falls back to null (= now again).
  const [pickedWhen, setPickedWhen] = useState<string | null>(null)

  const category = catalog?.categories.find(c => c.id === categoryId) ?? null
  const source = catalog?.sources.find(s => s.id === sourceId) ?? null
  const sourcesForCategory = useMemo(
    () => (catalog?.sources ?? []).filter(s => !s.category_id || s.category_id === categoryId),
    [catalog, categoryId],
  )

  function press(k: string) {
    buzz()
    if (k === 'back') return setAmount(a => a.slice(0, -1))
    if (k === '.') return setAmount(a => (a.includes('.') ? a : a === '' ? '0.' : a + '.'))
    // max two decimals
    const [, dec] = amount.split('.')
    if (dec && dec.length >= 2) return
    if (amount === '0') return setAmount(k)
    setAmount(a => (a + k).slice(0, 9))
  }

  /** Selections + note words → final tag array. */
  const derivedTags = useMemo(() => {
    const words: string[] = []
    if (category) words.push(category.name)
    if (source) source.name.split('/').forEach(p => p.trim() && words.push(p.trim()))
    const mode = catalog?.paymentModes.find(m => m.id === modeId)
    if (mode) words.push(mode.name)
    notes.toLowerCase().split(/\s+/).forEach(w =>
      w.length > 2 && !STOP_WORDS.has(w) && words.push(w.replace(/[^a-z0-9]/g, '')))
    manualTags.split(/\s+/).forEach(t => t && words.push(t.replace(/^#/, '')))
    return [...new Set(words.map(w => w.toLowerCase()).filter(Boolean))]
  }, [category, source, modeId, catalog, notes, manualTags])

  const amountNum = parseFloat(amount || '0')
  const hasSources = sourcesForCategory.length > 0
  const hasModes = (catalog?.paymentModes.length ?? 0) > 0
  const canSave = amount !== '' && !Number.isNaN(amountNum) && !!categoryId && (!hasSources || !!sourceId) && (!hasModes || !!modeId) && !addExpense.isPending
  // Resolved per render: "now" while untouched, the picked value otherwise.
  const whenValue = pickedWhen ?? toLocalInput(new Date())

  function getSaveBlocker(): string | null {
    if (!amount || Number.isNaN(amountNum)) return 'Enter an amount'
    if (!categoryId) return 'Pick a category'
    if (hasSources && !sourceId) return 'Pick a source'
    if (hasModes && !modeId) return 'Pick a payment mode'
    return null
  }

  async function save() {
    const blocker = getSaveBlocker()
    if (blocker) {
      toast({ tone: 'info', title: blocker })
      return
    }
    const spentAt = new Date(whenValue).toISOString()
    try {
      await addExpense.mutateAsync({
        amount: amountNum,
        category_id: categoryId!,
        source_id: sourceId,
        payment_mode_id: modeId,
        notes: notes.trim(),
        tags: derivedTags,
        spent_at: spentAt,
      })
      toast({
        tone: 'success',
        title: `${fmtMoney(amountNum)} saved`,
        message: category?.name,
        action: { label: 'Undo', run: () => void undoLast.mutateAsync() },
      })
      setAmount(''); setCategoryId(null); setSourceId(null); setModeId(null)
      setNotes(''); setManualTags(''); setPickedWhen(null)
      buzz([12, 40, 18])
    } catch (e) {
      const input = {
        amount: amountNum,
        category_id: categoryId!,
        source_id: sourceId,
        payment_mode_id: modeId,
        notes: notes.trim(),
        tags: derivedTags,
        spent_at: spentAt,
      }

      if (looksOffline(e) && bookId) {
        // Connectivity failure — queue locally so nothing is ever lost.
        enqueue(bookId, input)
        toast({
          tone: 'info',
          title: 'Saved offline',
          message: 'Will sync automatically when you are back online.',
        })
        setAmount(''); setCategoryId(null); setSourceId(null); setModeId(null)
        setNotes(''); setManualTags(''); setPickedWhen(null)
      } else if (looksOffline(e)) {
        // Offline AND no book resolved yet — can't queue without knowing
        // which book it belongs to. Keep the form so nothing typed is lost.
        toast({ tone: 'error', title: 'Not saved', message: 'No book loaded yet — try again once the app finishes loading.' })
      } else {
        // Server rejected the row (FK, RLS, …) — retrying won't help.
        // Keep the form filled so nothing the user typed is lost.
        const msg = e instanceof Error ? e.message : 'Could not save this expense.'
        toast({ tone: 'error', title: 'Not saved', message: msg })
      }
    }
  }

  const chipBase = 'tap-none whitespace-nowrap rounded-full border px-3.5 py-2 text-sm font-medium transition-all active:scale-95'
  const saveLabel = amount ? `Save ${fmtMoney(amountNum)}` : 'Save'

  return (
    <div className="flex flex-col gap-5 pt-6">
      {/* Amount display */}
      <div className="text-center">
        <motion.p
          key={amount}
          initial={{ scale: 0.98 }}
          animate={{ scale: 1 }}
          className="num min-h-[56px] font-display text-5xl font-bold tracking-tight text-text-1"
        >
          ₹{amount || <span className="text-text-3">0</span>}
          {!amount && <span className="ml-1 inline-block h-10 w-0.5 animate-pulse bg-brand align-middle" />}
        </motion.p>
        {category && (
          <p className="mt-1 text-xs text-text-3">
            for <span className="font-semibold text-text-2">{category.name}</span>
            {source && <> at {source.name}</>}
          </p>
        )}
      </div>

      {/* Category rail */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-3 flex items-center gap-1">
          Category <span className="text-danger" aria-hidden="true">*</span>
        </p>
        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {(catalog?.categories ?? []).map(c => {
            const Icon = catIcon(c.name)
            const on = c.id === categoryId
            return (
              <button
                key={c.id}
                onClick={() => { buzz(); setCategoryId(c.id); setSourceId(null) }}
                className={`${chipBase} flex items-center gap-1.5 ${
                  on ? 'border-transparent bg-brand-tint text-brand' : 'border-line bg-surface text-text-2'
                }`}
              >
                <Icon size={15} />
                {c.name}
              </button>
            )
          })}
        </div>
      </div>

      {/* Source rail */}
      <AnimatePresence initial={false}>
        {sourcesForCategory.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-3 flex items-center gap-1">
              Source <span className="text-danger" aria-hidden="true">*</span>
            </p>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {sourcesForCategory.map(s => (
                <button
                  key={s.id}
                  onClick={() => { buzz(); setSourceId(s.id === sourceId ? null : s.id) }}
                  className={`${chipBase} ${s.id === sourceId ? 'border-transparent bg-brand-tint text-brand' : 'border-line bg-surface text-text-2'}`}
                >
                  {s.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Payment mode rail */}
      <AnimatePresence initial={false}>
        {(catalog?.paymentModes.length ?? 0) > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-text-3 flex items-center gap-1">
              Paid via <span className="text-danger" aria-hidden="true">*</span>
            </p>
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
              {catalog!.paymentModes.map(m => (
                <button
                  key={m.id}
                  onClick={() => { buzz(); setModeId(m.id === modeId ? null : m.id) }}
                  className={`${chipBase} ${m.id === modeId ? 'border-transparent bg-brand-tint text-brand' : 'border-line bg-surface text-text-2'}`}
                >
                  {m.name}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Note + optional time */}
      <input
        value={notes}
        onChange={e => setNotes(e.target.value)}
        placeholder="Note (optional)"
        className="w-full rounded-card border border-line bg-surface px-4 py-3 text-sm placeholder:text-text-3 focus-visible:outline-brand"
      />
      <div className="-mt-3 flex justify-end">
        <label className="flex cursor-pointer items-center gap-1 rounded-full bg-surface px-2.5 py-1 text-[11px] text-text-3 transition-colors hover:text-text-2">
          <Clock size={11} />
          {whenLabel(whenValue)}
          <input
            type="datetime-local"
            value={whenValue}
            max={toLocalInput(new Date())}
            onChange={e => setPickedWhen(e.target.value || null)}
            className="sr-only"
            aria-label="Expense date and time"
          />
        </label>
      </div>

      {/* Tags preview */}
      <AnimatePresence>
        {derivedTags.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="flex flex-wrap items-center gap-1.5"
          >
            <Tag size={12} className="text-text-3" />
            {derivedTags.map(t => (
              <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text-2">
                #{t}
              </span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Keypad */}
      <div className="grid grid-cols-3 gap-2.5">
        {KEYS.map(k => (
          <motion.button
            key={k}
            whileTap={{ scale: 0.94 }}
            onClick={() => press(k)}
            aria-label={k === 'back' ? 'Backspace' : k}
            className="tap-none flex h-14 items-center justify-center rounded-card border border-line bg-surface text-xl font-semibold text-text-1 shadow-card"
          >
            {k === 'back' ? <Delete size={20} /> : k}
          </motion.button>
        ))}
      </div>

      {/* Save */}
      <Button onClick={() => void save()} disabled={!canSave} loading={addExpense.isPending} className="h-13 py-3.5 text-base">
        <span key={saveLabel} className="tabular-nums">{saveLabel}</span>
      </Button>
    </div>
  )
}
