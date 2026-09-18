import { useRef, useState, type TouchEvent } from 'react'
import { motion, useMotionValue, useSpring, useTransform, useVelocity } from 'framer-motion'
import { Trash2, Edit2 } from 'lucide-react'
import { toast } from '@/components/ui/Toast'
import { useDeleteExpense } from '@/hooks/data'
import { fmtMoney } from '@/lib/format'
import type { ExpenseDetail } from '@/lib/types'
import { catIcon } from '@/lib/catIcons'
import { fmtDayLabel } from '@/lib/format'
import { Card } from '@/components/ui/Card'
import Sheet from '@/components/ui/Sheet'
import Button from '@/components/ui/Button'

const ACTION_WIDTH = 96
const THRESHOLD_RATIO = 0.35

interface SwipeableExpenseRowProps {
  expense: ExpenseDetail
  onOpen?: () => void
  onEdit?: (expense: ExpenseDetail) => void
  children?: (expense: ExpenseDetail) => React.ReactNode
  captureSwipe?: boolean
}

export default function SwipeableExpenseRow({
  expense,
  onOpen,
  onEdit,
  children,
  captureSwipe = true,
}: SwipeableExpenseRowProps) {
  const [isSwiping, setIsSwiping] = useState(false)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const startX = useRef<number | null>(null)
  const startTime = useRef<number>(0)

  // Motion values for iOS-like spring physics
  const x = useMotionValue(0)
  const springX = useSpring(x, { stiffness: 320, damping: 24, mass: 1.1 })
  const velocity = useVelocity(x)

  const deleteMutate = useDeleteExpense(expense.book_id)

  function buzz(pattern: number | number[] = 8) {
    navigator.vibrate?.(pattern)
  }

  function handleDeleteTap() {
    setConfirmOpen(true)
  }

  async function confirmDelete() {
    setConfirmOpen(false)
    try {
      await deleteMutate.mutateAsync(expense.id)
      toast({ tone: 'success', title: 'Deleted', message: fmtMoney(expense.amount) })
      buzz([12, 40, 18])
    } catch (e) {
      toast({ tone: 'error', title: 'Delete failed', message: e instanceof Error ? e.message : String(e) })
    }
    x.set(0)
  }

  function handleEdit() {
    x.set(0)
    onEdit?.(expense)
  }

  function handleOpen() {
    if (x.get() === 0) onOpen?.()
  }

  const onTouchStart = (e: TouchEvent) => {
    if (captureSwipe) e.stopPropagation()
    startX.current = e.touches[0].clientX
    startTime.current = Date.now()
    setIsSwiping(false)
  }

  const onTouchMove = (e: TouchEvent) => {
    if (startX.current === null) return
    const delta = e.touches[0].clientX - startX.current

    if (!isSwiping && Math.abs(delta) > 8) {
      setIsSwiping(true)
    }
    if (!isSwiping) return

    if (captureSwipe) e.stopPropagation()
    e.preventDefault()

    // iOS-like rubber band resistance - exponential curve
    const absDelta = Math.abs(delta)
    const resistance = 1 / (1 + Math.pow(absDelta / 140, 1.7))
    const maxDrag = ACTION_WIDTH * 1.6
    const clamped = Math.max(-maxDrag, Math.min(maxDrag, delta * resistance))
    x.set(clamped)
  }

  const onTouchEnd = () => {
    if (startX.current === null) return
    startX.current = null
    setIsSwiping(false)

    const currentX = x.get()
    const currentVelocity = velocity.get()
    const threshold = ACTION_WIDTH * THRESHOLD_RATIO
    const velocityThreshold = 300

    // Left swipe (positive) -> Edit
    const shouldEdit = currentX > threshold || (currentVelocity > velocityThreshold && currentX > 0)
    // Right swipe (negative) -> Delete
    const shouldDelete = currentX < -threshold || (currentVelocity < -velocityThreshold && currentX < 0)

    if (shouldEdit) {
      // Snap to edit position with bounce
      x.set(ACTION_WIDTH)
      setTimeout(() => handleEdit(), 160)
    } else if (shouldDelete) {
      // Snap to delete position, stay open for tap
      x.set(-ACTION_WIDTH)
    } else {
      // Spring back with natural bounce
      x.set(0)
    }
  }

  const onTouchCancel = () => {
    startX.current = null
    setIsSwiping(false)
    x.set(0)
  }

  // Progress for action buttons - use x (direct finger) during drag, springX after release
  const progressSource = isSwiping ? x : springX

  // Progress 0-1 for each action
  // editProgress: 0 at x=0, 1 at x=ACTION_WIDTH (swipe left reveals edit)
  const editProgress = useTransform(progressSource, [0, ACTION_WIDTH * 0.3, ACTION_WIDTH], [0, 0.5, 1])
  // deleteProgress: 0 at x=0, 1 at x=-ACTION_WIDTH (swipe right reveals delete)
  const deleteProgress = useTransform(progressSource, [0, -ACTION_WIDTH * 0.3, -ACTION_WIDTH], [0, 0.5, 1])

  const Icon = catIcon(expense.category)

  return (
    <motion.div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={onTouchCancel}
      className="relative overflow-hidden"
    >
      {/* Background actions - revealed by transform */}
      <div className="absolute inset-0 flex h-full w-full items-center justify-between">
        {/* Edit action (swipe left/positive -> reveal from right edge) */}
        <motion.div
          style={{
            // Hidden at x=ACTION_WIDTH (off right), visible at x=0
            x: useTransform(editProgress, [0, 1], [ACTION_WIDTH, 0]),
            opacity: useTransform(editProgress, [0, 0.2, 1], [0, 0.5, 1]),
            scale: useTransform(editProgress, [0, 0.3, 1], [0.8, 0.95, 1]),
          }}
          className="flex h-full items-center justify-end w-[96px] pr-4"
        >
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleEdit}
            className="flex items-center gap-2 rounded-xl bg-info px-4 py-3 text-white font-medium shadow-lg"
            aria-label="Edit expense"
          >
            <Edit2 size={20} />
            <span>Edit</span>
          </motion.button>
        </motion.div>

        {/* Delete action (swipe right/negative -> reveal from left edge) */}
        <motion.div
          style={{
            // Hidden at x=-ACTION_WIDTH (off left), visible at x=0
            x: useTransform(deleteProgress, [0, 1], [-ACTION_WIDTH, 0]),
            opacity: useTransform(deleteProgress, [0, 0.2, 1], [0, 0.5, 1]),
            scale: useTransform(deleteProgress, [0, 0.3, 1], [0.8, 0.95, 1]),
          }}
          className="flex h-full items-center justify-start w-[96px] pl-4"
        >
          <motion.button
            whileTap={{ scale: 0.9 }}
            onClick={handleDeleteTap}
            className="flex items-center gap-2 rounded-xl bg-danger px-4 py-3 text-white font-medium shadow-lg"
            aria-label="Delete expense"
          >
            <Trash2 size={20} />
            <span>Delete</span>
          </motion.button>
        </motion.div>
      </div>

      {/* Foreground content */}
      <motion.div
        style={{ x: springX }}
        onClick={handleOpen}
        className="tap-none relative bg-surface rounded-card border border-line"
      >
        {children ? (
          children(expense)
        ) : (
          <Card className="flex items-center gap-3 !p-3 text-left">
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-2">
              <Icon size={17} />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-text-1">{expense.category}{expense.source ? ` · ${expense.source}` : ''}{expense.payment_mode ? <span className="text-text-3"> · {expense.payment_mode}</span> : null}</span>
              <span className="block truncate text-xs text-text-3">{fmtDayLabel(expense.spent_at)}{expense.notes ? ` · ${expense.notes}` : ''}</span>
            </span>
            <span className="num shrink-0 text-sm font-bold text-text-1">{fmtMoney(expense.amount)}</span>
          </Card>
        )}
      </motion.div>

      <Sheet open={confirmOpen} onClose={() => { setConfirmOpen(false); x.set(0) }} title="Delete expense?">
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-card border border-line bg-surface-2 p-3">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-text-2">
              <Icon size={16} />
            </span>
            <span className="min-w-0 flex-1 truncate text-sm text-text-1">{expense.category}{expense.source ? ` · ${expense.source}` : ''}</span>
            <span className="num shrink-0 text-sm font-bold text-text-1">{fmtMoney(expense.amount)}</span>
          </div>
          <p className="text-xs text-text-3">This can't be undone.</p>
          <div className="flex gap-2">
            <Button variant="secondary" onClick={() => { setConfirmOpen(false); x.set(0) }} className="flex-1">Cancel</Button>
            <Button variant="danger" onClick={() => void confirmDelete()} loading={deleteMutate.isPending} className="flex-1">Delete</Button>
          </div>
        </div>
      </Sheet>
    </motion.div>
  )
}