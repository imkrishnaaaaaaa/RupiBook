export function fmtMoney(n: number | string, opts: { paise?: boolean } = {}): string {
  const v = Number(n) || 0
  const hasPaise = Math.round(v * 100) % 100 !== 0
  return '₹' + v.toLocaleString('en-IN', {
    minimumFractionDigits: opts.paise || hasPaise ? 2 : 0,
    maximumFractionDigits: 2,
  })
}

export function fmtCompact(n: number): string {
  if (n >= 1_00_000) return '₹' + (n / 1_00_000).toFixed(n % 1_00_000 === 0 ? 0 : 1) + 'L'
  if (n >= 1000) return '₹' + (n / 1000).toFixed(n % 1000 === 0 ? 0 : 1) + 'k'
  return '₹' + Math.round(n)
}

/** Date → value usable by <input type="datetime-local"> in local time. */
export function toLocalInput(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

export function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  })
}

export function fmtDayLabel(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yest = new Date(today)
  yest.setDate(today.getDate() - 1)
  const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString()
  if (sameDay(d, today)) return 'Today'
  if (sameDay(d, yest)) return 'Yesterday'
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

/** Current month key in IST, e.g. '2026-08' */
export function currentMonthKey(): string {
  // en-CA gives YYYY-MM-DD; slice the month. TZ-safe via toLocaleString.
  return new Date().toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)
}

export function monthRangeIST(monthKey = currentMonthKey()): { from: string; to: string } {
  const [y, m] = monthKey.split('-').map(Number)
  // IST midnight, not UTC midnight (which is 05:30 IST and shifts day-one
  // expenses into the previous month).
  const from = new Date(`${monthKey}-01T00:00:00+05:30`)
  const next = m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, '0')}`
  const to = new Date(`${next}-01T00:00:00+05:30`)
  return { from: from.toISOString(), to: to.toISOString() }
}
