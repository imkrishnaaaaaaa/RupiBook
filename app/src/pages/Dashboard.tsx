import { useMemo, useState } from 'react'
import {
  Bar, BarChart, CartesianGrid, Cell, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { ReceiptText } from 'lucide-react'
import { useActiveBookId } from '@/context/AuthContext'
import { useCatalog, useDashboard, useExpenses } from '@/hooks/data'
import { catIcon } from '@/lib/catIcons'
import { fmtCompact, fmtDayLabel, fmtMoney, monthRangeIST } from '@/lib/format'
import type { ExpenseDetail } from '@/lib/types'
import ExpenseSheet from '@/components/ExpenseSheet'
import SwipeableExpenseRow from '@/components/SwipeableExpenseRow'
import Button from '@/components/ui/Button'
import { Card, SectionTitle } from '@/components/ui/Card'
import { EmptyState, ListSkeleton, ProgressRing } from '@/components/ui/bits'

const PIE_COLORS = ['#2ce0a7', '#62a6ff', '#ffb224', '#ff6369', '#c084fc', '#4dd0e1', '#f48fb1', '#a3e635']

const tooltipStyle = {
  backgroundColor: 'var(--surface-2)',
  border: '1px solid var(--line)',
  borderRadius: 12,
  color: 'var(--text-1)',
  fontSize: 12,
}

/** Day-of-month in IST for an ISO timestamp. */
function istDay(iso: string): number {
  return Number(new Date(iso).toLocaleString('en-GB', { timeZone: 'Asia/Kolkata', day: 'numeric' }))
}

export default function Dashboard() {
  const bookId = useActiveBookId()
  const { data: dash, isLoading, isError, refetch } = useDashboard(bookId)
  const { data: catalog } = useCatalog(bookId)
  const range = monthRangeIST()
  const { data: monthRows } = useExpenses(bookId, { from: range.from, to: range.to, limit: 500 })
  const [selected, setSelected] = useState<ExpenseDetail | null>(null)

  const total = useMemo(
    () => Object.values(dash?.byCategory ?? {}).reduce((s, v) => s + v, 0),
    [dash],
  )
  const overall = dash?.budgets.find(b => b.category_id === null)
  const limit = Number(overall?.monthly_limit ?? 0)
  const pct = limit > 0 ? (total / limit) * 100 : 0

  const catName = useMemo(() => {
    const m = new Map<string, string>()
    catalog?.categories.forEach(c => m.set(c.id, c.name))
    return m
  }, [catalog])

  const pieData = useMemo(
    () => Object.entries(dash?.byCategory ?? {})
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value),
    [dash],
  )

  /* ── Daily rhythm (this month, per-day bars) ── */
  const dailyData = useMemo(() => {
    if (!monthRows) return []
    const now = new Date()
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()
    const map = new Map<number, number>()
    monthRows.forEach(e => {
      const d = istDay(e.spent_at)
      map.set(d, (map.get(d) ?? 0) + Number(e.amount))
    })
    return Array.from({ length: daysInMonth }, (_, i) => ({
      d: i + 1,
      total: Math.round(map.get(i + 1) ?? 0),
    }))
  }, [monthRows])

  /* ── Pace vs budget (cumulative actual vs ideal straight line) ── */
  const paceData = useMemo(() => {
    if (!dailyData.length || limit <= 0) return []
    const now = new Date()
    const todayDom = now.getMonth() === new Date().getMonth() ? now.getDate() : dailyData.length
    return dailyData.map(({ d }) => ({
      d,
      actual: d <= todayDom ? dailyData.slice(0, d).reduce((s, x) => s + x.total, 0) : undefined,
      ideal: Math.round((limit * d) / dailyData.length),
    }))
  }, [dailyData, limit])

  const projection = useMemo(() => {
    if (!paceData.length || limit <= 0) return null
    const todayDom = new Date().getDate()
    const last = paceData[Math.min(todayDom, paceData.length) - 1]
    if (!last?.actual || todayDom < 2) return null
    const days = paceData.length
    const projected = Math.round((last.actual / todayDom) * days)
    return { projected, over: projected > limit }
  }, [paceData, limit])

  /* ── Top merchants ── */
  const topSources = useMemo(() => {
    if (!monthRows) return []
    const m = new Map<string, number>()
    monthRows.forEach(e => {
      const k = e.source?.trim()
      if (!k) return
      m.set(k, (m.get(k) ?? 0) + Number(e.amount))
    })
    const max = Math.max(1, ...m.values())
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([name, value]) => ({ name, value, pct: (value / max) * 100 }))
  }, [monthRows])

  /* ── Payment mode split ── */
  const modeSplit = useMemo(() => {
    if (!monthRows) return []
    const m = new Map<string, number>()
    let sum = 0
    monthRows.forEach(e => {
      const k = e.payment_mode?.trim() || 'Unspecified'
      m.set(k, (m.get(k) ?? 0) + Number(e.amount))
      sum += Number(e.amount)
    })
    return [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .map(([name, value]) => ({ name, value, pct: sum > 0 ? (value / sum) * 100 : 0 }))
  }, [monthRows])

  const budgetRows = useMemo(() => {
    if (!dash) return []
    return dash.budgets
      .filter(b => b.category_id !== null)
      .map(b => {
        const name = catName.get(b.category_id!) ?? ''
        const spent = dash.byCategory[name] ?? 0
        const lim = Number(b.monthly_limit)
        return {
          id: b.id,
          name,
          spent,
          limit: lim,
          pct: lim > 0 ? (spent / lim) * 100 : 0,
          over: spent > lim && lim > 0,
        }
      })
      .sort((a, b) => b.pct - a.pct)
  }, [dash, catName])

  const trendData = useMemo(
    () => Object.entries(dash?.byMonth ?? {}).map(([m, v]) => ({
      m: new Date(Number(m.slice(0, 4)), Number(m.slice(5, 7)) - 1, 1)
        .toLocaleString('en-IN', { month: 'short' }),
      total: Math.round(v),
    })),
    [dash],
  )

  if (isError) {
    return (
      <div className="pt-6">
        <Card className="space-y-3 text-center">
          <p className="text-sm font-semibold text-danger">Could not load your data</p>
          <p className="text-xs text-text-3">Check your connection and try again.</p>
          <Button variant="secondary" onClick={() => void refetch()} className="w-full">Retry</Button>
        </Card>
      </div>
    )
  }

  if (isLoading || !catalog || !monthRows) {
    return (
      <div className="space-y-4 pt-6">
        <Card className="flex items-center gap-5">
          <div className="h-[116px] w-[116px] shrink-0 animate-pulse rounded-full bg-surface-3" />
          <div className="flex-1 space-y-3">
            <div className="h-3 w-20 animate-pulse rounded bg-surface-3" />
            <div className="h-7 w-32 animate-pulse rounded bg-surface-3" />
            <div className="h-2.5 w-24 animate-pulse rounded bg-surface-3" />
          </div>
        </Card>
        <ListSkeleton rows={5} />
      </div>
    )
  }

  const recent = monthRows.slice(0, 20)

  return (
    <div className="pt-6">
      {/* Hero */}
      <Card className="flex items-center gap-5">
        <ProgressRing pct={pct} size={116}>
          <span className="num text-lg font-bold text-text-1">{Math.round(pct)}%</span>
          <span className="text-[10px] uppercase tracking-widest text-text-3">of budget</span>
        </ProgressRing>
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-text-3">This month</p>
          <p className="num mt-1 font-display text-3xl font-bold tracking-tight text-text-1">{fmtMoney(total)}</p>
          <p className="mt-1 text-xs leading-relaxed text-text-2">
            {limit > 0
              ? <>of <span className="num">{fmtMoney(limit)}</span> ·{' '}
                {total > limit
                  ? <span className="font-semibold text-danger">over by {fmtMoney(total - limit)}</span>
                  : <><span className="num font-semibold text-brand">{fmtMoney(limit - total)}</span> left</>}
              </>
              : 'Set an overall limit in Settings → Budgets'}
          </p>
        </div>
      </Card>

      {/* By category */}
      {pieData.length > 0 && (
        <>
          <SectionTitle>Spending by category</SectionTitle>
          <Card>
            <ResponsiveContainer width="100%" height={200}>
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" innerRadius={56} outerRadius={80} paddingAngle={3} strokeWidth={0}>
                  {pieData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
                </Pie>
                <Tooltip contentStyle={tooltipStyle} formatter={(v) => fmtMoney(Number(v))} />
              </PieChart>
            </ResponsiveContainer>
            <div className="mt-1 flex flex-wrap justify-center gap-x-3 gap-y-1 pb-1">
              {pieData.map((p, i) => (
                <span key={p.name} className="flex items-center gap-1.5 text-[11px] text-text-2">
                  <i className="inline-block h-2 w-2 rounded-full" style={{ background: PIE_COLORS[i % PIE_COLORS.length] }} />
                  {p.name}
                </span>
              ))}
            </div>
          </Card>
        </>
      )}

      {/* Daily rhythm */}
      {dailyData.some(d => d.total > 0) && (
        <>
          <SectionTitle>Daily rhythm</SectionTitle>
          <Card>
            <ResponsiveContainer width="100%" height={150}>
              <BarChart data={dailyData}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-3)', fontSize: 10 }} interval={4} />
                <YAxis hide />
                <Tooltip
                  contentStyle={tooltipStyle}
                  cursor={{ fill: 'var(--surface-2)' }}
                  formatter={(v) => [fmtMoney(Number(v)), 'Spent']}
                  labelFormatter={(d) => `Day ${d}`}
                />
                <Bar dataKey="total" radius={[4, 4, 4, 4]} maxBarSize={14} fill="#62a6ff" fillOpacity={0.8} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}

      {/* Pace vs budget */}
      {paceData.length > 0 && (
        <>
          <SectionTitle>Pace vs budget</SectionTitle>
          <Card>
            <ResponsiveContainer width="100%" height={170}>
              <LineChart data={paceData}>
                <CartesianGrid vertical={false} stroke="var(--line)" />
                <XAxis dataKey="d" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-3)', fontSize: 10 }} interval={4} />
                <YAxis hide domain={[0, Math.max(limit, ...paceData.map(p => p.actual ?? 0)) * 1.05]} />
                <Tooltip contentStyle={tooltipStyle} labelFormatter={(d) => `Day ${d}`} formatter={(v) => fmtMoney(Number(v))} />
                <Line type="monotone" dataKey="actual" stroke="#2ce0a7" strokeWidth={2.5} dot={false} name="Actual" />
                <Line type="monotone" dataKey="ideal" stroke="#9ba2ae" strokeWidth={1.5} strokeDasharray="5 5" dot={false} name="Ideal pace" />
              </LineChart>
            </ResponsiveContainer>
            {projection && (
              <p className={`pb-1 text-center text-xs ${projection.over ? 'text-danger' : 'text-brand'}`}>
                At this pace ≈ <span className="num font-semibold">{fmtCompact(projection.projected)}</span> by month end ·{' '}
                {projection.over ? 'over budget' : 'within budget'}
              </p>
            )}
          </Card>
        </>
      )}

      {/* 6-month trend */}
      <SectionTitle>6-month trend</SectionTitle>
      <Card>
        <ResponsiveContainer width="100%" height={170}>
          <BarChart data={trendData}>
            <CartesianGrid vertical={false} stroke="var(--line)" />
            <XAxis dataKey="m" tickLine={false} axisLine={false} tick={{ fill: 'var(--text-3)', fontSize: 11 }} />
            <YAxis hide domain={[0, 'dataMax + 500']} />
            <Tooltip contentStyle={tooltipStyle} cursor={{ fill: 'var(--surface-2)' }} formatter={(v) => fmtMoney(Number(v))} />
            <Bar dataKey="total" radius={[8, 8, 8, 8]} maxBarSize={34} fill="#2ce0a7" fillOpacity={0.85} />
          </BarChart>
        </ResponsiveContainer>
        <p className="mt-1 pb-1 text-center text-[10px] text-text-3">
          busiest month {trendData.length ? fmtCompact(Math.max(...trendData.map(t => t.total))) : '—'}
        </p>
      </Card>

      {/* Top merchants */}
      {topSources.length > 0 && (
        <>
          <SectionTitle>Top merchants</SectionTitle>
          <Card className="space-y-3">
            {topSources.map(s => (
              <div key={s.name}>
                <div className="mb-1 flex items-center justify-between text-sm">
                  <span className="truncate font-medium text-text-1">{s.name}</span>
                  <span className="num shrink-0 pl-2 text-xs text-text-2">{fmtMoney(s.value)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full"
                    style={{ width: `${s.pct}%`, background: 'var(--info)', opacity: 0.75 }}
                  />
                </div>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Payment split */}
      {modeSplit.length > 0 && modeSplit[0].name !== 'Unspecified' && (
        <>
          <SectionTitle>How you pay</SectionTitle>
          <Card className="space-y-2.5">
            {modeSplit.map(m => (
              <div key={m.name} className="flex items-center gap-3 text-sm">
                <span className="w-24 shrink-0 truncate text-text-2">{m.name}</span>
                <div className="h-1.5 min-w-0 flex-1 overflow-hidden rounded-full bg-surface-3">
                  <div className="h-full rounded-full" style={{ width: `${m.pct}%`, background: 'var(--brand)' }} />
                </div>
                <span className="num w-11 shrink-0 text-right text-xs text-text-3">{Math.round(m.pct)}%</span>
              </div>
            ))}
          </Card>
        </>
      )}

      {/* Category budgets */}
      {budgetRows.length > 0 && (
        <>
          <SectionTitle>Category budgets</SectionTitle>
          <div className="space-y-3">
            {budgetRows.map(row => (
              <Card key={row.id} className="!p-3.5">
                <div className="mb-1.5 flex items-center justify-between text-sm">
                  <span className="font-medium text-text-1">{row.name}</span>
                  <span className={`num text-xs ${row.over ? 'text-danger' : 'text-text-2'}`}>
                    {fmtMoney(row.spent)} / {fmtMoney(row.limit)}
                    {row.over && ' · over'}
                  </span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-surface-3">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(row.pct, 100)}%`, background: row.over ? 'var(--danger)' : 'var(--brand)' }}
                  />
                </div>
              </Card>
            ))}
          </div>
        </>
      )}

      {/* Recent */}
      <SectionTitle>Recent expenses</SectionTitle>
      {recent.length === 0 ? (
        <EmptyState icon={<ReceiptText size={22} />} title="Nothing logged this month" hint="Use the Log tab to add your first expense." />
      ) : (
        <div className="space-y-2">
          {recent.map(e => {
            const Icon = catIcon(e.category)
            return (
              <SwipeableExpenseRow
                key={e.id}
                expense={e}
                onOpen={() => setSelected(e)}
                onEdit={setSelected}
                captureSwipe={true}
              >
                {(expense) => (
                  <Card className="flex items-center gap-3 !p-3 text-left">
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-2">
                      <Icon size={17} />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-sm font-medium text-text-1">{expense.category}{expense.source ? ` · ${expense.source}` : ''}</span>
                      <span className="block truncate text-xs text-text-3">{fmtDayLabel(expense.spent_at)}{expense.notes ? ` · ${expense.notes}` : ''}</span>
                    </span>
                    <span className="num shrink-0 text-sm font-bold text-text-1">{fmtMoney(expense.amount)}</span>
                  </Card>
                )}
              </SwipeableExpenseRow>
            )
          })}
        </div>
      )}

      <ExpenseSheet expense={selected} onClose={() => setSelected(null)} />
    </div>
  )
}
