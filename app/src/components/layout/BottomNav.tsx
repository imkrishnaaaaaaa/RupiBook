import { forwardRef, useCallback } from 'react'
import { LayoutDashboard, Plus, Search } from 'lucide-react'

const TABS = [
  { label: 'Dashboard', icon: LayoutDashboard },
  { label: 'Add', icon: Plus },
  { label: 'Search', icon: Search },
] as const

interface BottomNavProps {
  activeIndex: number
  onTabChange: (index: number) => void
}

const BottomNav = forwardRef<HTMLElement, BottomNavProps>(function BottomNav({ activeIndex, onTabChange }, ref) {
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowLeft' && index > 0) {
      e.preventDefault()
      onTabChange(index - 1)
    } else if (e.key === 'ArrowRight' && index < TABS.length - 1) {
      e.preventDefault()
      onTabChange(index + 1)
    } else if (e.key === 'Home') {
      e.preventDefault()
      onTabChange(0)
    } else if (e.key === 'End') {
      e.preventDefault()
      onTabChange(TABS.length - 1)
    }
  }, [onTabChange])

  return (
    <nav
      ref={ref}
      aria-label="Main navigation"
      role="tablist"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[calc(var(--spacing-safe-bottom)+10px)]"
    >
      <div className="mx-auto max-w-md">
        {/* A fixed backdrop-blur element sitting over actively-scrolling
            content (the expense list) needs its own stable compositing
            layer, or Chromium can visibly smear/blur it while the list
            scrolls underneath — this is the one that was still happening. */}
        <div
          className="pointer-events-auto flex items-center justify-around rounded-full border border-line bg-surface/90 p-1.5 shadow-[var(--shadow-float)] backdrop-blur-xl"
          style={{ willChange: 'transform' }}
        >
          {TABS.map(({ label, icon: Icon }, index) => (
            <button
              key={index}
              role="tab"
              aria-selected={activeIndex === index}
              aria-controls={`tabpanel-${index}`}
              id={`tab-${index}`}
              onClick={() => onTabChange(index)}
              onKeyDown={(e) => handleKeyDown(e, index)}
              tabIndex={activeIndex === index ? 0 : -1}
              className="tap-none relative flex-1"
            >
              <span className="relative flex flex-col items-center gap-0.5 rounded-full py-2">
                {activeIndex === index && (
                  <span
                    className="absolute inset-0 rounded-full bg-brand-tint"
                    style={{
                      transition: 'all 200ms cubic-bezier(0.25, 0.46, 0.45, 0.94)',
                    }}
                  />
                )}
                <Icon
                  size={activeIndex === index ? 23 : 20}
                  strokeWidth={activeIndex === index ? 2.6 : 1.8}
                  className={`relative transition-all duration-200 ${activeIndex === index ? 'text-brand' : 'text-text-3'}`}
                />
                <span
                  className={`relative text-[10px] font-medium tracking-wide transition-all duration-200 ${
                    activeIndex === index ? 'text-brand' : 'text-text-3'
                  }`}
                >
                  {label}
                </span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </nav>
  )
})

export default BottomNav