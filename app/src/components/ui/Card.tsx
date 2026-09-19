import type { HTMLAttributes } from 'react'

type Variant = 'default' | 'flat' | 'hero'

const VARIANTS: Record<Variant, string> = {
  // Grouped content — charts, filters, budget rows. The workhorse container.
  default: 'rounded-card border border-line bg-surface p-4 shadow-card',
  // Repeated rows (expense list items) — a boxed card per row reads as
  // heavier the more of them there are. Flat keeps the list feeling like
  // one continuous list, not a stack of identical boxes.
  flat: 'rounded-card bg-surface-2 p-4',
  // The one thing per page allowed to look important. Used once (the
  // Dashboard "this month" summary), never for repeated content.
  hero: 'rounded-card border border-brand-tint bg-gradient-to-br from-brand-tint to-surface p-4 shadow-card',
}

export function Card({ className = '', variant = 'default', ...rest }: HTMLAttributes<HTMLDivElement> & { variant?: Variant }) {
  return (
    <div
      className={`${VARIANTS[variant]} ${className}`}
      {...rest}
    />
  )
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-3 mt-7 flex items-center justify-between first:mt-0">
      <h2 className="font-display text-[15px] font-semibold text-text-1">{children}</h2>
      {action}
    </div>
  )
}
