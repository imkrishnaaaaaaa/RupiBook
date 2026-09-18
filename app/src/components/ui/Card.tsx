import type { HTMLAttributes } from 'react'

export function Card({ className = '', ...rest }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={`rounded-card border border-line bg-surface p-4 shadow-card ${className}`}
      {...rest}
    />
  )
}

export function SectionTitle({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="mb-2 mt-6 flex items-center justify-between first:mt-0">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-text-3">{children}</h2>
      {action}
    </div>
  )
}
