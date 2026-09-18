import { useEffect, useState } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { useActiveBookId, useAuth } from '@/context/AuthContext'
import { useAutopay, useBooks, useCatalog, useSaveAllBudgets, useSaveAutopay, useDeleteAutopay, useBudgets } from '@/hooks/data'
import { useSyncStatus } from '@/hooks/useSync'
import Button from '@/components/ui/Button'
import Sheet from '@/components/ui/Sheet'
import CatalogSheet from '@/components/CatalogSheet'
import { Card, SectionTitle } from '@/components/ui/Card'
import { toast } from '@/components/ui/Toast'
import { fmtMoney } from '@/lib/format'
import type { Budget } from '@/lib/types'

export default function Settings() {
  const { user } = useAuth()
  const qc = useQueryClient()
  const bookId = useActiveBookId()
  const { data: books } = useBooks(user?.id)
  const activeBook = books?.find(b => b.id === bookId)

  const [newBook, setNewBook] = useState('')
  const [budgetSheet, setBudgetSheet] = useState(false)
  const [autopaySheet, setAutopaySheet] = useState(false)
  const [catalogSheet, setCatalogSheet] = useState(false)

  function switchBook(id: string) {
    if (!user) return
    localStorage.setItem(`rb_book_${user.id}`, id)
    qc.invalidateQueries() // every query is book-scoped
    toast({ tone: 'success', title: 'Switched book' })
  }

  async function createBook() {
    const name = newBook.trim()
    if (!name || !user) return
    const { supabase } = await import('@/lib/supabase')
    const { error } = await supabase.from('books').insert({ user_id: user.id, name }).select('id').single()
    if (error) return toast({ tone: 'error', title: 'Create failed', message: error.message })
    setNewBook('')
    await qc.invalidateQueries({ queryKey: ['books'] })
    toast({ tone: 'success', title: `Book "${name}" created` })
  }

  return (
    <div className="pt-6">
      {/* Account */}
      <SectionTitle>Account</SectionTitle>
      <Card>
        <p className="truncate text-sm font-semibold text-text-1">{user?.email}</p>
        <p className="mt-0.5 text-xs text-text-3">Signed in with Google</p>
      </Card>

      {/* Books */}
      <SectionTitle>Books</SectionTitle>
      <Card className="space-y-2">
        {(books ?? []).map(b => (
          <button
            key={b.id}
            onClick={() => switchBook(b.id)}
            className={`tap-none flex w-full items-center justify-between rounded-full border px-4 py-2.5 text-sm font-medium transition-colors ${
              b.id === bookId ? 'border-transparent bg-brand-tint text-brand' : 'border-line bg-surface-2 text-text-2'
            }`}
          >
            {b.name}
            {b.id === bookId && <span className="text-[10px] font-bold uppercase tracking-widest">active</span>}
          </button>
        ))}
        <div className="flex gap-2 pt-1">
          <input
            value={newBook}
            onChange={e => setNewBook(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && void createBook()}
            placeholder="New book name…"
            className="w-full rounded-full border border-line bg-surface-2 px-4 py-2 text-sm outline-none placeholder:text-text-3 focus:border-brand"
          />
          <Button variant="secondary" onClick={() => void createBook()} disabled={!newBook.trim()} className="!px-3">
            <Plus size={16} />
          </Button>
        </div>
        <p className="text-[11px] text-text-3">
          Active: <span className="font-semibold">{activeBook?.name}</span> · categories/sources are per-book.
        </p>
      </Card>

      {/* Budgets + Autopay + Catalog */}
      <SectionTitle>Planning</SectionTitle>
      <Card className="space-y-2">
        <ManagerRow label="Budgets" hint="Overall + per-category limits" onClick={() => setBudgetSheet(true)} />
        <ManagerRow label="Autopay" hint="Recurring expenses, logged automatically" onClick={() => setAutopaySheet(true)} />
        <ManagerRow label="Categories & sources" hint="Chip rails on the Log page" onClick={() => setCatalogSheet(true)} />
      </Card>

      <BudgetsSheet open={budgetSheet} onClose={() => setBudgetSheet(false)} bookId={bookId} />
      <AutopaySheet open={autopaySheet} onClose={() => setAutopaySheet(false)} bookId={bookId} />
      <CatalogSheet open={catalogSheet} onClose={() => setCatalogSheet(false)} bookId={bookId} />

      <SyncSection />

      <p className="mt-8 text-center text-[11px] text-text-3">
        RupiBook v{__APP_VERSION__} · React + Supabase · your data, row-level secured
      </p>
    </div>
  )
}

function ManagerRow({ label, hint, onClick }: { label: string; hint: string; onClick: () => void }) {
  return (
    <button onClick={onClick} className="tap-none flex w-full items-center justify-between rounded-card border border-line bg-surface-2 px-4 py-3 text-left transition-colors hover:bg-surface-3">
      <span>
        <span className="block text-sm font-semibold text-text-1">{label}</span>
        <span className="block text-xs text-text-3">{hint}</span>
      </span>
      <span aria-hidden className="text-text-3">›</span>
    </button>
  )
}

/* ── Data — manual sync of offline queue ── */
function relative(ts: number): string {
  if (!ts) return 'never'
  const mins = Math.round((Date.now() - ts) / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins} min ago`
  const hrs = Math.round(mins / 60)
  if (hrs < 24) return `${hrs} hr ago`
  return new Date(ts).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
}

function SyncSection() {
  const { pending, busy, lastSync, syncNow } = useSyncStatus()

  return (
    <>
      <SectionTitle>Data</SectionTitle>
      <Card>
        <button
          onClick={() => void syncNow()}
          disabled={busy}
          className="tap-none flex w-full items-center justify-between rounded-card border border-line bg-surface-2 px-4 py-3 text-left transition-colors hover:bg-surface-3"
        >
          <span>
            <span className="block text-sm font-semibold text-text-1">{busy ? 'Syncing…' : 'Sync now'}</span>
            <span className="block text-xs text-text-3">
              {pending > 0 ? `${pending} offline ${pending === 1 ? 'entry' : 'entries'} waiting` : 'All offline entries are saved'}
            </span>
          </span>
          <span aria-hidden className="text-text-3">›</span>
        </button>
        <p className="mt-2 px-1 text-[11px] text-text-3">
          Last synced: <span className="font-medium">{relative(lastSync)}</span> · pull down on any page to refresh
        </p>
      </Card>
    </>
  )
}

/* ── Budgets — edit everything, save once ── */
function BudgetsSheet({ open, onClose, bookId }: { open: boolean; onClose: () => void; bookId: string | null }) {
  const { data: budgets } = useBudgets(bookId)
  const { data: catalog } = useCatalog(bookId)
  const saveAll = useSaveAllBudgets(bookId)

  const [overall, setOverall] = useState('')
  const [threshold, setThreshold] = useState(80)
  const [drafts, setDrafts] = useState<Record<string, string>>({})

  // Seed the whole form each time the sheet opens
  useEffect(() => {
    if (!open || !budgets) return
    const o = budgets.find(b => b.category_id === null)
    setOverall(o ? String(o.monthly_limit) : '')
    setThreshold(o?.alert_threshold_pct ?? 80)
    const d: Record<string, string> = {}
    budgets.forEach(b => { if (b.category_id) d[b.category_id] = String(b.monthly_limit) })
    setDrafts(d)
  }, [open, budgets])

  function save() {
    if (!catalog) return
    const rows: Array<Pick<Budget, 'category_id' | 'monthly_limit' | 'alert_threshold_pct'>> = [
      { category_id: null, monthly_limit: Number(overall) || 0, alert_threshold_pct: threshold },
    ]
    catalog.categories.forEach(c => {
      const v = drafts[c.id]
      if (v !== undefined && v.trim() !== '') rows.push({ category_id: c.id, monthly_limit: Number(v) || 0, alert_threshold_pct: threshold })
    })
    saveAll.mutate(rows, {
      onSuccess: () => { toast({ tone: 'success', title: 'Budgets saved' }); onClose() },
      onError: e => toast({ tone: 'error', title: 'Save failed', message: e.message }),
    })
  }

  const inputCls = 'min-w-0 flex-1 rounded-card border border-line bg-surface-2 px-3 py-2 text-sm outline-none focus:border-brand'

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Budgets"
      footer={
        <Button onClick={save} loading={saveAll.isPending} disabled={!catalog} className="w-full py-3">
          Save budgets
        </Button>
      }
    >
      <div className="space-y-5">
        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-text-3">Monthly limit · overall</p>
          <input
            type="number" inputMode="decimal" min="0"
            value={overall}
            onChange={e => setOverall(e.target.value)}
            placeholder="e.g. 30000"
            className={`w-full ${inputCls}`}
          />
        </div>

        <div>
          <p className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-text-3">Per-category limits</p>
          <div className="space-y-2">
            {(catalog?.categories ?? []).map(c => (
              <div key={c.id} className="flex items-center gap-2">
                <span className="w-28 shrink-0 truncate text-sm text-text-2">{c.name}</span>
                <input
                  type="number" inputMode="decimal" min="0" placeholder="—"
                  value={drafts[c.id] ?? ''}
                  onChange={e => setDrafts(d => ({ ...d, [c.id]: e.target.value }))}
                  className={inputCls}
                />
              </div>
            ))}
          </div>
          <p className="mt-2 text-[11px] text-text-3">Blank = unchanged · 0 removes a limit</p>
        </div>

        <label className="block">
          <span className="mb-1 block text-xs text-text-3">
            Alert threshold: <span className="num font-semibold text-text-2">{threshold}%</span>
          </span>
          <input
            type="range" min={50} max={100} step={5}
            value={threshold}
            onChange={e => setThreshold(Number(e.target.value))}
            className="w-full accent-[var(--brand)]"
          />
        </label>
      </div>
    </Sheet>
  )
}

/* ── Autopay ── */
function AutopaySheet({ open, onClose, bookId }: { open: boolean; onClose: () => void; bookId: string | null }) {
  const { data: items } = useAutopay(bookId)
  const { data: catalog } = useCatalog(bookId)
  const save = useSaveAutopay(bookId)
  const del = useDeleteAutopay(bookId)

  const [name, setName] = useState('')
  const [amount, setAmount] = useState('')
  const [categoryId, setCategoryId] = useState('')
  const [day, setDay] = useState(1)

  function add() {
    if (!name.trim() || !Number(amount)) {
      toast({ tone: 'info', title: 'Name and amount required' })
      return
    }
    save.mutate(
      { name: name.trim(), amount: Number(amount), category_id: categoryId, day_of_month: day, active: true },
      {
        onSuccess: () => {
          setName(''); setAmount('')
          toast({ tone: 'success', title: 'Autopay added' })
        },
        onError: e => toast({ tone: 'error', title: 'Failed', message: e.message }),
      },
    )
  }

  return (
    <Sheet open={open} onClose={onClose} title="Autopay">
      <div className="space-y-4">
        <div className="space-y-2">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Bill name (Rent, Netflix…)"
            className="w-full rounded-card border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand" />
          <div className="grid grid-cols-3 gap-2">
            <input type="number" inputMode="decimal" min="0" value={amount} onChange={e => setAmount(e.target.value)} placeholder="₹ amount"
              className="col-span-1 rounded-card border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand" />
            <select value={categoryId} onChange={e => setCategoryId(e.target.value)}
              className="col-span-2 rounded-card border border-line bg-surface-2 px-3 py-2.5 text-sm outline-none focus:border-brand">
              <option value="">Category…</option>
              {catalog?.categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          <label className="block text-xs text-text-3">
            Day of month: <span className="num font-semibold text-text-2">{day}</span>
            <input type="range" min={1} max={28} value={day} onChange={e => setDay(Number(e.target.value))} className="mt-1 w-full accent-[var(--brand)]" />
          </label>
          <Button onClick={add} loading={save.isPending} disabled={!name.trim() || !categoryId} className="w-full py-2.5">
            Add recurring expense
          </Button>
        </div>

        <div className="space-y-2 border-t border-line pt-4">
          {(items ?? []).map(i => (
            <div key={i.id} className="flex items-center justify-between rounded-card border border-line bg-surface-2 px-3.5 py-2.5">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-text-1">{i.name}</p>
                <p className="text-xs text-text-3">
                  Day {i.day_of_month} · <span className="num">{fmtMoney(Number(i.amount))}</span>
                  {i.last_logged_ym ? ` · last: ${i.last_logged_ym}` : ' · not yet logged'}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  onClick={() => save.mutate({ ...i, active: !i.active })}
                  role="switch"
                  aria-checked={i.active}
                  className={`relative h-6 w-10 rounded-full transition-colors ${i.active ? 'bg-brand' : 'bg-surface-3'}`}
                >
                  <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${i.active ? 'left-[18px]' : 'left-0.5'}`} />
                </button>
                <button
                  aria-label={`Delete ${i.name}`}
                  onClick={() => del.mutate(i.id)}
                  className="tap-none p-1 text-xs text-danger"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
          {items?.length === 0 && <p className="py-2 text-center text-xs text-text-3">No recurring items yet.</p>}
        </div>
      </div>
    </Sheet>
  )
}