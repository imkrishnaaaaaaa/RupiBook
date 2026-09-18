import { fmtMoney, fmtDayLabel } from '@/lib/format'
import type { ExpenseDetail } from '@/lib/types'
import { catIcon } from '@/lib/catIcons'
import { Card } from '@/components/ui/Card'

interface ExpenseRowProps {
  expense: ExpenseDetail
  onOpen?: () => void
  children?: (expense: ExpenseDetail) => React.ReactNode
}

/** Tap to open — edit and delete both live inside ExpenseSheet. */
export default function ExpenseRow({ expense, onOpen, children }: ExpenseRowProps) {
  const Icon = catIcon(expense.category)

  return (
    <div onClick={onOpen} className="tap-none cursor-pointer">
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
    </div>
  )
}
