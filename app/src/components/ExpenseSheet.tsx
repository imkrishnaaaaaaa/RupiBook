import { useEffect, useState } from 'react'
import { Trash2 } from 'lucide-react'
import Sheet from './ui/Sheet'
import Button from './ui/Button'
import { toast } from './ui/Toast'
import { useCatalog } from '@/hooks/data'
import { useDeleteExpense, useUpdateExpense } from '@/hooks/data'
import { fmtMoney, fmtDate } from '@/lib/format'
import type { ExpenseDetail } from '@/lib/types'

interface Props {
  expense: ExpenseDetail | null
  onClose: () => void
}

/** View / edit / delete a single expense. */
export default function ExpenseSheet({ expense, onClose }: Props) {
  const bookId = expense?.book_id ?? null
  const { data: catalog } = useCatalog(bookId)
  const update = useUpdateExpense(bookId)
  const del = useDeleteExpense(bookId)

  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [sourceId, setSourceId] = useState('')
  const [modeId, setModeId] = useState('')
  const [notes, setNotes] = useState('')
  const [confirming, setConfirming] = useState(false)

  useEffect(() => {
    if (!expense) return
    setAmount(String(expense.amount))
    setCategoryId((catalog?.categories.find(c => c.name === expense.category))?.id ?? '')
    setSourceId((catalog?.sources.find(s => s.name === expense.source))?.id ?? '')
    setModeId((catalog?.paymentModes.find(m => m.name === expense.payment_mode))?.id ?? '')
    setNotes(expense.notes)
    setConfirming(false)
  }, [expense, catalog])

  if (!expense) return null

  async function save() {
    try {
      await update.mutateAsync({
        id: expense!.id,
        amount: Number(amount),
        category_id: categoryId,
        source_id: sourceId || null,
        payment_mode_id: modeId || null,
        notes,
      })
      toast({ tone: 'success', title: 'Updated' })
      onClose()
    } catch (e) {
      toast({ tone: 'error', title: 'Update failed', message: e instanceof Error ? e.message : String(e) })
    }
  }

  async function remove() {
    await del.mutateAsync(expense!.id)
    toast({ tone: 'success', title: 'Deleted', message: fmtMoney(expense!.amount) })
    onClose()
  }

  const selectCls = 'w-full rounded-card border border-line bg-surface-2 px-3 py-2.5 text-sm text-text-1'

  return (
    <Sheet open={!!expense} onClose={onClose} title={fmtDate(expense.spent_at)}>
      <div className="space-y-4">
        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-3">Amount</span>
          <input
            type="number"
            inputMode="decimal"
            min="0"
            step="0.01"
            value={amount}
            onChange={e => setAmount(e.target.value)}
            className={selectCls}
          />
        </label>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-3">Category</span>
          <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={selectCls}>
            <option value="">—</option>
            {catalog?.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </label>

        <div className="grid grid-cols-2 gap-3">
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-3">Source</span>
            <select value={sourceId} onChange={e => setSourceId(e.target.value)} className={selectCls}>
              <option value="">—</option>
              {(catalog?.sources ?? [])
                .filter(s => !s.category_id || s.category_id === categoryId)
                .map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </label>
          <label className="block">
            <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-3">Paid via</span>
            <select value={modeId} onChange={e => setModeId(e.target.value)} className={selectCls}>
              <option value="">—</option>
              {catalog?.paymentModes.map(m => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
          </label>
        </div>

        <label className="block">
          <span className="mb-1.5 block text-xs font-semibold uppercase tracking-widest text-text-3">Note</span>
          <textarea rows={2} value={notes} onChange={e => setNotes(e.target.value)} className={selectCls} />
        </label>

        {expense.tags.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {expense.tags.map(t => (
              <span key={t} className="rounded-md bg-surface-2 px-2 py-0.5 text-[11px] font-medium text-text-2">#{t}</span>
            ))}
          </div>
        )}

        <Button onClick={() => void save()} loading={update.isPending} className="w-full py-3">
          Save changes
        </Button>

        {confirming ? (
          <Button variant="danger" onClick={() => void remove()} loading={del.isPending} className="w-full py-3">
            Tap again to delete permanently
          </Button>
        ) : (
          <button
            onClick={() => setConfirming(true)}
            className="tap-none flex w-full items-center justify-center gap-2 py-2 text-sm font-medium text-danger"
          >
            <Trash2 size={15} /> Delete expense
          </button>
        )}
      </div>
    </Sheet>
  )
}
