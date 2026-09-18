import { useRef, useState, type TouchEvent, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
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

const EDGE_THRESHOLD = 28
const SWIPE_THRESHOLD = 18

export default function AppShell() {
  const navigate = useNavigate()
  const qc = useQueryClient()

  const [activeIndex, setActiveIndex] = useState(1)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState(0)
  const [dragDirection, setDragDirection] = useState<-1 | 1 | 0>(0)
  const [screenWidth, setScreenWidth] = useState(() => typeof window !== 'undefined' ? window.innerWidth : 390)

  const startX = useRef<number | null>(null)
  const startY = useRef<number | null>(null)

  // Keep screenWidth updated
  useEffect(() => {
    const update = () => setScreenWidth(window.innerWidth)
    window.addEventListener('resize', update)
    return () => window.removeEventListener('resize', update)
  }, [])

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

  function isOverScrollableContent(e: TouchEvent): boolean {
    const target = e.target as HTMLElement
    if (!target) return false
    let el: HTMLElement | null = target
    while (el && el !== document.body) {
      const style = window.getComputedStyle(el)
      if ((style.overflow === 'auto' || style.overflow === 'scroll' || style.overflowX === 'auto' || style.overflowX === 'scroll') && el.scrollWidth > el.clientWidth) {
        return true
      }
      el = el.parentElement
    }
    return false
  }

  function onTouchStart(e: TouchEvent) {
    if (isOverScrollableContent(e)) return
    startX.current = e.touches[0].clientX
    startY.current = e.touches[0].clientY
    setIsDragging(false)
    setDragDirection(0)
  }

  function onTouchMove(e: TouchEvent) {
    if (startX.current === null || startY.current === null) return
    if (isOverScrollableContent(e)) {
      startX.current = null
      startY.current = null
      return
    }

    const deltaX = e.touches[0].clientX - startX.current
    const deltaY = e.touches[0].clientY - startY.current

    // Edge swipe from left -> go back
    if (!isDragging && activeIndex === 0 && startX.current < EDGE_THRESHOLD && deltaX > 15) {
      e.preventDefault()
      window.history.back()
      startX.current = null
      startY.current = null
      return
    }

    // Detect horizontal swipe intent - strict horizontal only
    if (!isDragging && Math.abs(deltaX) > Math.abs(deltaY) && Math.abs(deltaX) > SWIPE_THRESHOLD) {
      setIsDragging(true)
      setDragDirection(deltaX < 0 ? -1 : 1)
    }

    if (!isDragging) return

    e.preventDefault()

    // Simple linear resistance at edges
    let resistance = 1
    const absDeltaX = Math.abs(deltaX)

    if (activeIndex === 0 && deltaX > 0) {
      resistance = 1 / (1 + absDeltaX / 100)
    } else if (activeIndex === TABS.length - 1 && deltaX < 0) {
      resistance = 1 / (1 + absDeltaX / 100)
    }

    setDragOffset(deltaX * resistance)
  }

  function onTouchEnd() {
    if (startX.current === null || !isDragging) {
      setDragOffset(0)
      startX.current = null
      startY.current = null
      setIsDragging(false)
      setDragDirection(0)
      return
    }

    const displacement = dragOffset
    const threshold = screenWidth * 0.25

    const canGoNext = activeIndex < TABS.length - 1 && dragDirection === -1
    const canGoPrev = activeIndex > 0 && dragDirection === 1

    const shouldSwitch = Math.abs(displacement) > threshold
      && ((dragDirection === -1 && canGoNext) || (dragDirection === 1 && canGoPrev))

    if (shouldSwitch) {
      const newIndex = activeIndex + (dragDirection === -1 ? 1 : -1)
      setActiveIndex(newIndex)
      navigate(TABS[newIndex].path, { replace: true })
    }

    // Reset with CSS transition
    setDragOffset(0)
    startX.current = null
    startY.current = null
    setIsDragging(false)
    setDragDirection(0)
  }

  const handleTabChange = useCallback((index: number) => {
    if (index === activeIndex) return
    setActiveIndex(index)
    navigate(TABS[index].path, { replace: true })
  }, [activeIndex, navigate])

  // Total transform: base position + drag offset
  const transformX = -activeIndex * screenWidth + dragOffset

  return (
    <div
      onTouchStart={onTouchStart}
      onTouchMove={onTouchMove}
      onTouchEnd={onTouchEnd}
      onTouchCancel={() => {
        setDragOffset(0)
        startX.current = null
        startY.current = null
        setIsDragging(false)
        setDragDirection(0)
      }}
      className="mx-auto flex min-h-dvh w-full max-w-md flex-col"
    >
      <TopBar />
      <main className="relative flex-1 overflow-hidden">
        <PullToRefresh onRefresh={refresh}>
          <div
            className="flex h-full w-full overflow-x-hidden"
            style={{
              transform: `translateX(${transformX}px)`,
              transition: isDragging ? 'none' : 'transform 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
              willChange: 'transform',
            }}
          >
            {TABS.map(({ component: TabComponent }, i) => (
              <div
                key={i}
                role="tabpanel"
                id={`tabpanel-${i}`}
                aria-labelledby={`tab-${i}`}
                hidden={activeIndex !== i}
                className="w-full flex-shrink-0"
                style={{ width: screenWidth }}
              >
                <TabComponent />
              </div>
            ))}
          </div>
        </PullToRefresh>
      </main>
      <BottomNav activeIndex={activeIndex} onTabChange={handleTabChange} />
    </div>
  )
}