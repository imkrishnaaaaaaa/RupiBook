import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import type { AutopayItem, Book, Budget, Category, ExpenseDetail, ExpenseInput, PaymentMode, Source } from '@/lib/types'

/* ── books ── */
export function useBooks(userId?: string) {
  return useQuery({
    queryKey: ['books', userId],
    enabled: !!userId,
    queryFn: async () =>
      (await supabase.from('books').select('*').eq('user_id', userId!).order('created_at'))
        .data as Book[] | null ?? [],
  })
}

/* ── catalog ── */
// Categories/sources/modes change rarely: mirrored to localStorage so rails
// render instantly and survive offline. Refresh points: catalog edits,
// manual sync, pull-to-refresh (all invalidate this query).
const CATALOG_CACHE = 'rb_catalog_v1'

type Catalog = { categories: Category[]; sources: Source[]; paymentModes: PaymentMode[] }

function readCatalogCache(bookId: string | null): (Catalog & { cachedAt: number }) | undefined {
  try {
    const raw = JSON.parse(localStorage.getItem(CATALOG_CACHE) ?? '')
    if (raw?.bookId === bookId && raw?.catalog) return { ...raw.catalog, cachedAt: raw.cachedAt ?? 0 }
  } catch { /* empty or corrupt */ }
  return undefined
}

export function useCatalog(bookId: string | null) {
  return useQuery({
    queryKey: ['catalog', bookId],
    enabled: !!bookId,
    staleTime: 30 * 60_000,
    initialData: () => {
      const c = readCatalogCache(bookId)
      return c ? { categories: c.categories, sources: c.sources, paymentModes: c.paymentModes } : undefined
    },
    initialDataUpdatedAt: () => readCatalogCache(bookId)?.cachedAt ?? 0,
    queryFn: async () => {
      let catalog: Catalog
      try {
        const [cats, srcs, modes] = await Promise.all([
          supabase.from('categories').select('*').eq('book_id', bookId!).order('sort'),
          supabase.from('sources').select('*').eq('book_id', bookId!).order('sort'),
          supabase.from('payment_modes').select('*').eq('book_id', bookId!).order('sort'),
        ])
        // Surface failures instead of rendering empty rails that look like data loss.
        const err = cats.error ?? srcs.error ?? modes.error
        if (err) throw err
        catalog = {
          categories: (cats.data ?? []) as Category[],
          sources: (srcs.data ?? []) as Source[],
          paymentModes: (modes.data ?? []) as PaymentMode[],
        }
      } catch (e) {
        // Offline: fall back to the mirror so the app stays usable.
        const cached = readCatalogCache(bookId)
        if (cached) return { categories: cached.categories, sources: cached.sources, paymentModes: cached.paymentModes }
        throw e
      }
      try {
        localStorage.setItem(CATALOG_CACHE, JSON.stringify({ bookId, catalog, cachedAt: Date.now() }))
      } catch { /* quota — cache is best-effort */ }
      return catalog
    },
  })
}

export interface ExpenseFilters {
  from?: string
  to?: string
  categoryId?: string
  search?: string
  limit?: number
}

export function expensesQuery(bookId: string, f: ExpenseFilters = {}) {
  let q = supabase
    .from('expense_details')
    .select('*')
    .eq('book_id', bookId)
    .order('spent_at', { ascending: false })
  if (f.from) q = q.gte('spent_at', f.from)
  if (f.to) q = q.lt('spent_at', f.to)
  if (f.categoryId) q = q.eq('category', f.categoryId)
  if (f.search) {
    // , ( ) are condition syntax in PostgREST or-filters; strip them so a
    // search like "samosa, chai" stays one condition instead of erroring.
    const term = f.search.replace(/[,()]/g, ' ').trim()
    if (term) q = q.or(`notes.ilike.%${term}%,category.ilike.%${term}%,source.ilike.%${term}%`)
  }
  return q.limit(f.limit ?? 500)
}

export function useExpenses(bookId: string | null, filters: ExpenseFilters = {}) {
  const key = JSON.stringify(filters)
  return useQuery({
    queryKey: ['expenses', bookId, key],
    enabled: !!bookId,
    placeholderData: prev => prev,
    queryFn: async () => {
      const { data, error } = await expensesQuery(bookId!, filters)
      if (error) throw error
      return (data ?? []) as ExpenseDetail[]
    },
  })
}

/* ── dashboard bundle: current month + trend + budgets ── */
export function useDashboard(bookId: string | null) {
  return useQuery({
    queryKey: ['dashboard', bookId],
    enabled: !!bookId,
    staleTime: 60_000,
    queryFn: async () => {
      const now = new Date()
      const months: string[] = []
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
        months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`)
      }
      const windowStart = new Date(`${months[0]}-01T00:00:00+05:30`)
      if (Number.isNaN(windowStart.getTime())) throw new Error(`bad month key ${months[0]}`)

      const [{ data: rows, error: expErr }, { data: budgetRows, error: budErr }] = await Promise.all([
        supabase
          .from('expense_details')
          .select('amount, category, spent_at')
          .eq('book_id', bookId!)
          .gte('spent_at', windowStart.toISOString())
          .limit(5000),
        supabase.from('budgets').select('*').eq('book_id', bookId!),
      ])
      // Throw so the dashboard shows an error state instead of fake zeros.
      if (expErr) throw expErr
      if (budErr) throw budErr

      const expenses = (rows ?? []) as { amount: number; category: string; spent_at: string }[]
      const budgets = (budgetRows ?? []) as Budget[]

      const byCategory: Record<string, number> = {}
      const byMonth: Record<string, number> = Object.fromEntries(months.map(m => [m, 0]))
      for (const e of expenses) {
        const mk = new Date(e.spent_at).toLocaleString('en-CA', { timeZone: 'Asia/Kolkata' }).slice(0, 7)
        if (byMonth[mk] !== undefined) byMonth[mk] += Number(e.amount)
        const thisMonth = months.at(-1)!
        if (mk === thisMonth) byCategory[e.category] = (byCategory[e.category] ?? 0) + Number(e.amount)
      }

      return { byCategory, byMonth, budgets, recentCount: expenses.length }
    },
  })
}

/* ── mutations ── */
export function useInvalidateExpenses() {
  const qc = useQueryClient()
  return () => {
    qc.invalidateQueries({ queryKey: ['expenses'] })
    qc.invalidateQueries({ queryKey: ['dashboard'] })
  }
}

/** Generic CRUD mutation factory — eliminates 10+ near-identical hooks. */
function createMutate<TArgs>({
  table,
  method, // 'insert' | 'update' | 'delete' | 'upsert'
  invalidateKeys = [],
  mutateFn,
  onConflict,
}: {
  table: string
  method: 'insert' | 'update' | 'delete' | 'upsert'
  invalidateKeys?: string[]
  mutateFn?: (args: TArgs, supabase: typeof import('@/lib/supabase').supabase) => Promise<unknown>
  onConflict?: string
}) {
  return function useMutate(bookId: string | null) {
    const qc = useQueryClient()
    return useMutation({
      mutationFn: async (args: TArgs) => {
        if (mutateFn) return mutateFn(args, supabase)
        const client = supabase.from(table)
        let result: { data: unknown; error: unknown } = { data: null, error: null }
        if (method === 'insert') {
          result = await client.insert({ ...args as Record<string, unknown>, book_id: bookId! }).select('id').single()
        } else if (method === 'update') {
          const { id, ...patch } = args as { id: string } & Record<string, unknown>
          result = await client.update(patch).eq('id', id)
        } else if (method === 'delete') {
          result = await client.delete().eq('id', args as string)
        } else if (method === 'upsert') {
          result = await client.upsert({ ...args as Record<string, unknown>, book_id: bookId! }, onConflict ? { onConflict } : undefined)
        }
        if (result.error) throw result.error
        return result.data
      },
      onSuccess: () => {
        invalidateKeys.forEach(k => qc.invalidateQueries({ queryKey: [k] }))
      },
    })
  }
}

// Expenses
export const useAddExpense = createMutate<ExpenseInput>({
  table: 'expenses',
  method: 'insert',
  invalidateKeys: ['expenses', 'dashboard'],
})
export const useUpdateExpense = createMutate<Partial<ExpenseInput> & { id: string }>({
  table: 'expenses',
  method: 'update',
  invalidateKeys: ['expenses', 'dashboard'],
})
export const useDeleteExpense = createMutate<string>({
  table: 'expenses',
  method: 'delete',
  invalidateKeys: ['expenses', 'dashboard'],
})

/** Undo = delete most recently created row in the book. */
export function useUndoLastExpense(bookId: string | null) {
  const invalidate = useInvalidateExpenses()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .from('expenses')
        .select('id')
        .eq('book_id', bookId!)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle()
      if (error) throw error
      if (!data) return null
      const { error: del } = await supabase.from('expenses').delete().eq('id', data.id)
      if (del) throw del
      return data.id
    },
    onSuccess: () => invalidate(),
  })
}

/* ── budgets ── */
export function useBudgets(bookId: string | null) {
  return useQuery({
    queryKey: ['budgets', bookId],
    enabled: !!bookId,
    queryFn: async () =>
      (await supabase.from('budgets').select('*').eq('book_id', bookId!)).data as Budget[] | null ?? [],
  })
}

/** Bulk upsert — one request saves the whole budgets form. */
export function useSaveAllBudgets(bookId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (rows: Array<Pick<Budget, 'category_id' | 'monthly_limit' | 'alert_threshold_pct'>>) => {
      const perCategory = rows.filter(r => r.category_id !== null)
      const overall = rows.find(r => r.category_id === null)

      if (perCategory.length) {
        const { error } = await supabase
          .from('budgets')
          .upsert(perCategory.map(r => ({ ...r, book_id: bookId! })), { onConflict: 'book_id,category_id' })
        if (error) throw error
      }

      if (overall) {
        const { data: existing } = await supabase
          .from('budgets')
          .select('id')
          .eq('book_id', bookId!)
          .is('category_id', null)
          .limit(1)
        const { error } = existing?.length
          ? await supabase.from('budgets').update({
              monthly_limit: overall.monthly_limit,
              alert_threshold_pct: overall.alert_threshold_pct,
            }).eq('id', existing[0].id)
          : await supabase.from('budgets').insert({ ...overall, book_id: bookId! })
        if (error) throw error
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['budgets'] })
      qc.invalidateQueries({ queryKey: ['dashboard'] })
    },
  })
}

/* ── autopay ── */
export function useAutopay(bookId: string | null) {
  return useQuery({
    queryKey: ['autopay', bookId],
    enabled: !!bookId,
    queryFn: async () =>
      (await supabase.from('autopay').select('*').eq('book_id', bookId!).order('day_of_month')).data as AutopayItem[] | null ?? [],
  })
}

export const useSaveAutopay = createMutate<Partial<AutopayItem> & { name: string; amount: number; category_id: string; day_of_month: number }>({
  table: 'autopay',
  method: 'upsert',
  invalidateKeys: ['autopay'],
  onConflict: 'book_id,name',
})

export const useDeleteAutopay = createMutate<string>({
  table: 'autopay',
  method: 'delete',
  invalidateKeys: ['autopay'],
})

/* ── catalog mutations ── */
export const useAddCategory = createMutate<string>({
  table: 'categories',
  method: 'insert',
  invalidateKeys: ['catalog'],
  mutateFn: async (name, sb) => {
    const { error } = await sb.from('categories').insert({ name, sort: 99 })
    if (error) throw error
  },
})

export const useDeleteCategory = createMutate<string>({
  table: 'categories',
  method: 'delete',
  invalidateKeys: ['catalog'],
})

/** Persist a full ordering of categories (sort = array index). */
export function useReorderCategories(bookId: string | null) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (orderedIds: string[]) => {
      const updates = orderedIds.map((id, sort) =>
        supabase.from('categories').update({ sort }).eq('id', id),
      )
      const results = await Promise.all(updates)
      const firstError = results.find(r => r.error)?.error
      if (firstError) throw firstError
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['catalog', bookId] }),
  })
}

export const useAddSource = createMutate<{ name: string; category_id: string | null }>({
  table: 'sources',
  method: 'insert',
  invalidateKeys: ['catalog'],
})

export const useDeleteSource = createMutate<string>({
  table: 'sources',
  method: 'delete',
  invalidateKeys: ['catalog'],
})

export const useAddMode = createMutate<string>({
  table: 'payment_modes',
  method: 'insert',
  invalidateKeys: ['catalog'],
})

export const useDeleteMode = createMutate<string>({
  table: 'payment_modes',
  method: 'delete',
  invalidateKeys: ['catalog'],
})

export function useAutopaySyncOnOpen(bookId: string | null) {
  useEffect(() => {
    if (!bookId) return
    const key = `rb_sync_${new Date().toDateString()}`
    if (localStorage.getItem(key)) return
    localStorage.setItem(key, '1')
    void supabase.rpc('log_due_autopay')
  }, [bookId])
}
