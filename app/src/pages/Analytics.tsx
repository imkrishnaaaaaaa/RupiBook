import { useMemo, useState } from 'react'
import { Search, X } from 'lucide-react'
import { useActiveBookId } from '@/context/AuthContext'
import { useCatalog, useExpenses } from '@/hooks/data'
import { catIcon } from '@/lib/catIcons'
import { fmtDayLabel, fmtMoney, currentMonthKey, monthRangeIST } from '@/lib/format'
import type { ExpenseDetail } from '@/lib/types'
import ExpenseSheet from '@/components/ExpenseSheet'
import ExpenseRow from '@/components/ExpenseRow'
import Button from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { EmptyState, ListSkeleton } from '@/components/ui/bits'

type Preset = 'month' | '3m' | 'all'

function presetRange(p: Preset): { from?: string; to?: string; label: string } {
  if (p === 'month') return { ...monthRangeIST(), label: 'This month' }
  if (p === '3m') {
    // Two months back, IST midnight, so the window matches the month tabs.
    const nowKey = currentMonthKey()
    const [y, m] = nowKey.split('-').map(Number)
    const startM = m - 2
    const startY = startM < 1 ? y - 1 : y
    const sm = ((startM + 11) % 12) + 1
    const key = `${startY}-${String(sm).padStart(2, '0')}`
    return {
      from: new Date(`${key}-01T00:00:00+05:30`).toISOString(),
      to: monthRangeIST().to,
      label: 'Last 3 months',
    }
  }
  return { label: 'All time' }
}

export default function Analytics() {
  const bookId = useActiveBookId()
  const { data: catalog } = useCatalog(bookId)
  const [open, setOpen] = useState<ExpenseDetail | null>(null)

  const [preset, setPreset] = useState<Preset>('month')
  const [categoryId, setCategoryId] = useState<string | null>(null)
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')

  const range = useMemo(() => presetRange(preset), [preset])
  // The chips select a category id, but expense_details only carries the
  // category's name (no category_id column) — resolve id -> name here.
  const categoryName = catalog?.categories.find(c => c.id === categoryId)?.name
  const { data: results, isFetching } = useExpenses(bookId, {
    ...range,
    category: categoryName,
    search: search || undefined,
    limit: 1000,
  })

  const summary = useMemo(() => {
    const rows = results ?? []
    const total = rows.reduce((s, e) => s + Number(e.amount), 0)
    const byCat: Record<string, number> = {}
    rows.forEach(e => { byCat[e.category] = (byCat[e.category] ?? 0) + Number(e.amount) })
    const top = Object.entries(byCat).sort(([, a], [, b]) => b - a)[0]
    return { count: rows.length, total, top: top?.[0] ?? '—' }
  }, [results])

  function reset() {
    setPreset('month'); setCategoryId(null); setSearchInput(''); setSearch('')
  }

  const chip = (on: boolean) =>
    `tap-none whitespace-nowrap rounded-full border px-3 py-1.5 text-xs font-semibold transition-all active:scale-95 ${
      on ? 'border-transparent bg-brand-tint text-brand' : 'border-line bg-surface text-text-2'
    }`

  return (
    <div className="pt-6">
      {/* Summary */}
      <Card className="grid grid-cols-3 gap-2 text-center !p-3.5">
        <div>
          <p className="num font-display text-lg font-bold text-text-1">{fmtMoney(summary.total)}</p>
          <p className="text-[10px] uppercase tracking-widest text-text-3">Total</p>
        </div>
        <div className="border-x border-line">
          <p className="num font-display text-lg font-bold text-text-1">{summary.count}</p>
          <p className="text-[10px] uppercase tracking-widest text-text-3">Entries</p>
        </div>
        <div>
          <p className="truncate font-display text-lg font-bold text-text-1">{summary.top}</p>
          <p className="text-[10px] uppercase tracking-widest text-text-3">Top category</p>
        </div>
      </Card>

      {/* Filters */}
      <SectionTitle
        action={
          <button onClick={reset} className="tap-none text-xs font-semibold text-brand">Reset</button>
        }
      >
        Filters · {range.label}
      </SectionTitle>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {(['month', '3m', 'all'] as Preset[]).map(p => (
          <button key={p} onClick={() => setPreset(p)} className={chip(p === preset)}>
            {presetRange(p).label}
          </button>
        ))}
      </div>

      <div className="no-scrollbar -mx-4 mt-2 flex gap-2 overflow-x-auto px-4 pb-1">
        <button onClick={() => setCategoryId(null)} className={chip(categoryId === null)}>All</button>
        {catalog?.categories.map(c => (
          <button key={c.id} onClick={() => setCategoryId(c.id === categoryId ? null : c.id)} className={chip(c.id === categoryId)}>
            {c.name}
          </button>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-2 rounded-full border border-line bg-surface px-4 py-2.5 focus-within:border-brand">
        <Search size={16} className="shrink-0 text-text-3" />
        <input
          value={searchInput}
          onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && setSearch(searchInput.trim())}
          placeholder="Search notes, category, source…"
          className="w-full bg-transparent text-sm outline-none placeholder:text-text-3"
        />
        {searchInput && (
          <button aria-label="Clear" className="tap-none text-text-3" onClick={() => { setSearchInput(''); setSearch('') }}>
            <X size={15} />
          </button>
        )}
        <Button variant="secondary" className="!px-3 !py-1.5 text-xs" onClick={() => setSearch(searchInput.trim())}>
          Go
        </Button>
      </div>

      {/* Results */}
      <SectionTitle>Results</SectionTitle>
      {isFetching && !results ? (
        <ListSkeleton rows={6} />
      ) : !results || results.length === 0 ? (
        <EmptyState icon={<Search size={22} />} title="No matching expenses" hint="Try widening the date range or clearing filters." />
      ) : (
        <div className="space-y-2">
          {results.map(e => {
            const Icon = catIcon(e.category)
            return (
              <ExpenseRow
                key={e.id}
                expense={e}
                onOpen={() => setOpen(e)}
              >
                {(expense) => (
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
              </ExpenseRow>
            )
          })}
        </div>
      )}

      <ExpenseSheet expense={open} onClose={() => setOpen(null)} readOnly />
    </div>
  )
}
