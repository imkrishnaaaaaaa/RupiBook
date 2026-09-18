import { useRef, useState, type ReactNode, type TouchEvent } from 'react'
import { motion, useMotionValue, useSpring, useTransform } from 'framer-motion'
import { Loader2, RefreshCw } from 'lucide-react'
import { toast } from '@/components/ui/Toast'

const THRESHOLD = 64
const MAX_PULL = 96

/** Mobile pull-to-refresh for the app shell. Pull down at scroll-top to run
 *  onRefresh (re-fetch queries + flush the offline queue). */
export default function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<void>; children: ReactNode }) {
  const pull = useMotionValue(0)
  const springPull = useSpring(pull, { stiffness: 180, damping: 18, mass: 1.2 })
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const startY = useRef<number | null>(null)

  // The active tab panel scrolls internally now (not the document), so "at
  // top" means the nearest scrollable ancestor of the touch, not the page.
  function atTop(target: EventTarget | null): boolean {
    let el = target as HTMLElement | null
    while (el && el !== document.body) {
      if (el.scrollHeight > el.clientHeight) return el.scrollTop <= 0
      el = el.parentElement
    }
    return true
  }

  function onStart(e: TouchEvent) {
    if (atTop(e.target) && !busy) startY.current = e.touches[0].clientY
  }

  function onMove(e: TouchEvent) {
    if (startY.current === null) return
    const delta = e.touches[0].clientY - startY.current
    if (delta <= 8 || !atTop(e.target)) { pull.set(0); setDone(false); return }
    
    // iOS-like rubber band resistance - exponential curve
    const resistance = 1 / (1 + Math.pow((delta - 8) / 100, 1.6))
    const clamped = Math.min(MAX_PULL, (delta - 8) * resistance * 0.5)
    pull.set(clamped)
  }

  async function onEnd() {
    const distance = pull.get()
    startY.current = null
    pull.set(0)
    if (distance < THRESHOLD || busy) return
    setBusy(true)
    try {
      await onRefresh()
      setDone(true)
      // PWA: hard refresh after successful sync
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.getRegistration().then(reg => reg?.update())
      }
      toast({ tone: 'success', title: 'Synced', message: 'All data is up to date' })
    } catch (e) {
      toast({ tone: 'error', title: 'Sync failed', message: e instanceof Error ? e.message : 'Try again' })
    } finally {
      setBusy(false)
      // Clear the checkmark after a moment
      setTimeout(() => setDone(false), 1200)
    }
  }

  const indicatorOpacity = useTransform(springPull, [0, 12, THRESHOLD], [0, 0.4, 1])
  const loaderRotation = useTransform(springPull, [0, THRESHOLD], [0, 360])

  return (
    <div
      onTouchStart={onStart}
      onTouchMove={onMove}
      onTouchEnd={() => void onEnd()}
      onTouchCancel={() => { startY.current = null; pull.set(0) }}
    >
      <motion.div
        style={{ height: busy ? 28 : springPull }}
        className="flex items-center justify-center overflow-hidden text-text-3"
      >
        {(springPull.get() > 12 || busy || done) && (
          <motion.div
            style={{
              opacity: indicatorOpacity,
              rotate: busy ? loaderRotation : 0,
            }}
          >
            {done ? (
              <RefreshCw size={18} className="text-brand" />
            ) : (
              <Loader2 size={18} className={`animate-spin ${!busy && pull.get() < THRESHOLD ? 'opacity-50' : ''}`} />
            )}
          </motion.div>
        )}
      </motion.div>
      {children}
    </div>
  )
}