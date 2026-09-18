import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { supabase, SUPABASE_READY } from '@/lib/supabase'
import { Capacitor } from '@capacitor/core'
import { App } from '@capacitor/app'
import { toast } from '@/components/ui/Toast'

interface AuthState {
  session: Session | null
  user: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthState | null>(null)

const DEFAULT_CATEGORIES = ['Food', 'Transport', 'Shopping', 'Bills', 'Health', 'Entertainment', 'Groceries', 'Others']
const DEFAULT_MODES = ['UPI', 'Cash', 'Card']

async function bootstrapUser(userId: string) {
  try {
    const { data: books, error: booksErr } = await supabase.from('books').select('id')
    if (booksErr) throw booksErr
    if (books && books.length > 0) return

    const { data: book, error: bookErr } = await supabase
      .from('books')
      .insert({ user_id: userId, name: 'Personal' })
      .select('id')
      .single()
    if (bookErr) throw bookErr
    if (!book) return

    const { error: catErr } = await supabase.from('categories').insert(
      DEFAULT_CATEGORIES.map((name, i) => ({ book_id: book.id, name, sort: i })),
    )
    if (catErr) throw catErr
    const { error: modeErr } = await supabase.from('payment_modes').insert(
      DEFAULT_MODES.map((name, i) => ({ book_id: book.id, name, sort: i })),
    )
    if (modeErr) throw modeErr
  } catch (e) {
    toast({
      tone: 'error',
      title: 'Setup incomplete',
      message: `Couldn't set up your first book: ${e instanceof Error ? e.message : String(e)}. Try creating one in Settings.`,
    })
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!SUPABASE_READY) {
      setLoading(false)
      return
    }

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setLoading(false)
      if (data.session?.user) void bootstrapUser(data.session.user.id)
    })

    const { data: sub } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      if (s?.user) void bootstrapUser(s.user.id)
    })

    // Handle OAuth redirect in native Capacitor apps
    if (Capacitor.isNativePlatform()) {
      const handleUrlOpen = async ({ url }: { url: string }) => {
        if (!url.startsWith('com.rupibook.app://auth/callback')) return
        try {
          const fragment = url.split('#')[1] ?? ''
          const query = url.split('?')[1]?.split('#')[0] ?? ''
          const params = new URLSearchParams(fragment)
          let access = params.get('access_token')
          let refresh = params.get('refresh_token')

          if (!access && query) {
            const qp = new URLSearchParams(query)
            const code = qp.get('code')
            if (code) {
              await supabase.auth.exchangeCodeForSession(code)
              return
            }
            access = qp.get('access_token')
            refresh = qp.get('refresh_token')
          }

          if (access && refresh) {
            await supabase.auth.setSession({ access_token: access, refresh_token: refresh })
          }
        } catch (e) {
          console.error('[Auth] callback handling failed:', e)
        }
      }
      App.addListener('appUrlOpen', handleUrlOpen)
      return () => {
        sub.subscription.unsubscribe()
        App.removeAllListeners()
      }
    }

    return () => sub.subscription.unsubscribe()
  }, [])

  async function signInWithGoogle() {
    const isNative = Capacitor.isNativePlatform()
    const redirectTo = isNative
      ? 'com.rupibook.app://auth/callback'
      : `${window.location.origin}/auth/callback`

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo },
    })
    if (error) toast({ tone: 'error', title: 'Sign-in failed', message: error.message })
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut()
    if (error) toast({ tone: 'error', title: 'Sign-out failed', message: error.message })
  }

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth outside AuthProvider')
  return ctx
}

/** Active book id — first book of the signed-in user. */
export function useActiveBookId(): string | null {
  const { user } = useAuth()
  const [bookId, setBookId] = useState<string | null>(null)

  useEffect(() => {
    if (!user) return setBookId(null)
    let cancelled = false

    ;(async () => {
      const stored = localStorage.getItem(`rb_book_${user.id}`)
      if (stored) {
        const { data } = await supabase.from('books').select('id').eq('id', stored).maybeSingle()
        if (!cancelled && data) return setBookId(stored)
        if (!cancelled && !data) localStorage.removeItem(`rb_book_${user.id}`)
      }
      const { data } = await supabase
        .from('books')
        .select('id')
        .eq('user_id', user.id)
        .order('created_at')
        .limit(1)
      if (!cancelled) setBookId(data?.[0]?.id ?? null)
    })()

    return () => { cancelled = true }
  }, [user])

  return bookId
}
