import { useRef, useState, useCallback, useEffect, useLayoutEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { LayoutDashboard, Plus, Search } from 'lucide-react'
import BottomNav from './BottomNav'
import TopBar from './TopBar'
import PullToRefresh from './PullToRefresh'
import { flush, markSynced } from '@/lib/offlineQueue'
import { supabase } from '@/lib/supabase'
import Dashboard from '@/pages/Dashboard'
import Log from '@/pages/Log'
import Analytics from '@/pages/Analytics'

const TABS = [
  { path: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, component: Dashboard },
  { path: '/log', label: 'Add', icon: Plus, component: Log },
  { path: '/analytics', label: 'Search', icon: Search, component: Analytics },
] as const

const DEFAULT_TAB_PATH = '/log'

function tabIndexForPath(pathname: string): number {
  const i = TABS.findIndex(t => t.path === pathname)
  return i === -1 ? TABS.findIndex(t => t.path === DEFAULT_TAB_PATH) : i
}

export default function AppShell() {
  const navigate = useNavigate()
  const location = useLocation()
  const qc = useQueryClient()

  const [activeIndex, setActiveIndex] = useState(() => tabIndexForPath(location.pathname))
  // Only promote to its own GPU layer while actually sliding — leaving
  // will-change:transform on permanently, next to TopBar's backdrop-blur,
  // is what caused the occasional blurry/stuck-compositing tab content.
  const [isAnimating, setIsAnimating] = useState(false)
  // Width of the rendered app column, not the browser window — the column is
  // capped at max-w-md, so on any wider viewport (any desktop browser) those
  // two differ. Sizing panels off window.innerWidth pushed centered content
  // (the Add page's amount display, charts, …) off the visible edge.
  const [screenWidth, setScreenWidth] = useState(0)

  const containerRef = useRef<HTMLDivElement>(null)

  useLayoutEffect(() => {
    const update = () => setScreenWidth(containerRef.current?.clientWidth ?? window.innerWidth)
    update()
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

  // URL is the source of truth: land on Add by default, and stay in
  // sync when the browser back/forward buttons change the path.
  useEffect(() => {
    if (!TABS.some(t => t.path === location.pathname)) {
      navigate(DEFAULT_TAB_PATH, { replace: true })
      return
    }
    setActiveIndex(tabIndexForPath(location.pathname))
  }, [location.pathname, navigate])

  useEffect(() => { setIsAnimating(true) }, [activeIndex])

  async function refresh() {
    if (navigator.onLine) {
      await flush(async (bookId, input) => {
        const { error } = await supabase.from('expenses').insert({ ...input, book_id: bookId })
        if (error) throw error
      })
      markSynced()
    }
    await qc.invalidateQueries()
  }

  const handleTabChange = useCallback((index: number) => {
    if (index === activeIndex) return
    setActiveIndex(index)
    navigate(TABS[index].path, { replace: true })
  }, [activeIndex, navigate])

  const transformX = -activeIndex * screenWidth

  return (
    <div ref={containerRef} className="mx-auto flex min-h-dvh w-full max-w-md flex-col">
      <TopBar />
      <main className="relative flex-1 overflow-hidden">
        <PullToRefresh onRefresh={refresh}>
          {/* Fixed clipping viewport — must NOT carry the transform itself,
              or sliding it moves its own clip boundary off-screen along with
              the content. The transform lives on the row inside instead. */}
          <div className="h-full w-full overflow-hidden">
            <div
              className="flex h-full w-full"
              style={{
                transform: `translateX(${transformX}px)`,
                transition: 'transform 320ms cubic-bezier(0.22, 1, 0.36, 1)',
                willChange: isAnimating ? 'transform' : 'auto',
              }}
              onTransitionEnd={() => setIsAnimating(false)}
            >
              {TABS.map(({ component: TabComponent }, i) => (
                <div
                  key={i}
                  role="tabpanel"
                  id={`tabpanel-${i}`}
                  aria-labelledby={`tab-${i}`}
                  aria-hidden={activeIndex !== i}
                  // Not `hidden` — that's display:none, which pulls the panel out
                  // of this flex row and collapses the others to position 0,
                  // fighting the translateX math. `inert` keeps its flex slot
                  // while dropping pointer/keyboard/AT access.
                  inert={activeIndex !== i}
                  className="w-full flex-shrink-0 overflow-y-auto px-4 pb-28"
                  style={{ width: screenWidth, height: '100%' }}
                >
                  <TabComponent />
                </div>
              ))}
            </div>
          </div>
        </PullToRefresh>
      </main>
      <BottomNav activeIndex={activeIndex} onTabChange={handleTabChange} />
    </div>
  )
}