import { AnimatePresence, motion } from 'framer-motion'
import { useEffect, type ReactNode } from 'react'
import { X } from 'lucide-react'

interface Props {
  open: boolean
  onClose: () => void
  title: string
  children: ReactNode
}

/** Bottom sheet — the primary modal pattern on mobile. */
export default function Sheet({ open, onClose, title, children }: Props) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [open, onClose])

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.button
            aria-label="Close"
            className="fixed inset-0 z-50 bg-overlay backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-md rounded-t-sheet border-t border-line bg-surface pb-safe-bottom shadow-pop"
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ type: 'spring', stiffness: 380, damping: 38 }}
          >
            <div className="flex items-center justify-between px-5 pt-4">
              <h2 className="font-display text-base font-semibold text-text-1">{title}</h2>
              <button aria-label="Close" onClick={onClose} className="tap-none rounded-full p-1.5 text-text-3 hover:bg-surface-2">
                <X size={18} />
              </button>
            </div>
            <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong" />
            <div className="max-h-[72dvh] overflow-y-auto px-5 pb-6 pt-4">{children}</div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  )
}
