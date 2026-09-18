import { AnimatePresence, motion } from 'framer-motion'
import { useSyncExternalStore, useRef, useState, type TouchEvent } from 'react'
import { CheckCircle2, Info, TriangleAlert, X } from 'lucide-react'

interface Toast {
  id: number
  title: string
  message?: string
  tone?: 'success' | 'error' | 'info'
  action?: { label: string; run: () => void }
}

let toasts: Toast[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() { listeners.forEach(l => l()) }

export function toast(t: Omit<Toast, 'id'>) {
  const id = nextId++
  toasts = [...toasts.slice(-2), { ...t, id }]
  emit()
  setTimeout(() => {
    toasts = toasts.filter(x => x.id !== id)
    emit()
  }, t.action ? 6000 : 2800)
}

function dismiss(id: number) {
  toasts = toasts.filter(x => x.id !== id)
  emit()
}

function subscribe(l: () => void) {
  listeners.add(l)
  return () => listeners.delete(l)
}

const ICONS = {
  success: <CheckCircle2 size={14} className="shrink-0 text-brand" />,
  error: <TriangleAlert size={14} className="shrink-0 text-danger" />,
  info: <Info size={14} className="shrink-0 text-info" />,
}

function ToastItem({ item, onDismiss }: { item: Toast; onDismiss: (id: number) => void }) {
  const [offset, setOffset] = useState(0)
  const [isSwiping, setIsSwiping] = useState(false)
  const startX = useRef<number | null>(null)
  const SWIPE_THRESHOLD = 80

  function onTouchStart(e: TouchEvent) {
    startX.current = e.touches[0].clientX
    setIsSwiping(false)
  }

  function onTouchMove(e: TouchEvent) {
    if (startX.current === null) return
    const delta = e.touches[0].clientX - startX.current
    if (!isSwiping && Math.abs(delta) > 5) {
      setIsSwiping(true)
    }
    if (!isSwiping) return
    e.stopPropagation()
    const newOffset = Math.min(Math.max(delta, -120), 120)
    setOffset(newOffset)
  }

  function onTouchEnd() {
    if (startX.current === null) return
    startX.current = null
    if (isSwiping && Math.abs(offset) > SWIPE_THRESHOLD) {
      onDismiss(item.id)
    } else {
      setOffset(0)
    }
    setIsSwiping(false)
  }

  return (
    <motion.div
      style={{ x: offset }}
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      initial={{ opacity: 0, y: -20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -10, scale: 0.95 }}
      transition={{ type: 'spring', stiffness: 500, damping: 34 }}
      role="status"
      className="pointer-events-auto flex min-h-10 w-full max-w-sm items-center gap-2 rounded-xl border border-line bg-surface-2/95 py-2 px-3 shadow-[var(--shadow-float)] backdrop-blur-xl"
    >
      {ICONS[item.tone ?? 'info']}
      <div className="flex-1 min-w-0">
        <p className="truncate text-sm font-semibold text-text-1">{item.title}</p>
        {item.message && (
          <p className="truncate text-xs font-normal text-text-3">{item.message}</p>
        )}
      </div>
      {item.action && (
        <button
          onClick={e => { e.stopPropagation(); item.action!.run(); onDismiss(item.id) }}
          className="tap-none shrink-0 rounded-full bg-brand-tint px-3 py-1.5 text-xs font-bold text-brand"
        >
          {item.action.label}
        </button>
      )}
      <button
        onClick={e => { e.stopPropagation(); onDismiss(item.id) }}
        className="tap-none shrink-0 p-1 text-text-3 hover:text-text-1"
        aria-label="Dismiss"
      >
        <X size={14} />
      </button>
    </motion.div>
  )
}

/** Toast pinned below top bar, swipe to dismiss, tap to dismiss. */
export function ToastHost() {
  const items = useSyncExternalStore(subscribe, () => toasts)

  return (
    <div className="pointer-events-none fixed top-16 left-4 right-4 z-[100] flex flex-col gap-2">
      <AnimatePresence initial={false}>
        {items.map(t => (
          <ToastItem key={t.id} item={t} onDismiss={dismiss} />
        ))}
      </AnimatePresence>
    </div>
  )
}