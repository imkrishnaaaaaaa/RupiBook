import type { ButtonHTMLAttributes } from 'react'
import { Loader2 } from 'lucide-react'

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const STYLES: Record<Variant, string> = {
  primary: 'bg-brand text-on-brand hover:brightness-110 active:brightness-95',
  secondary: 'border border-line bg-surface-2 text-text-1 hover:bg-surface-3',
  ghost: 'text-text-2 hover:bg-surface-2',
  danger: 'bg-danger-tint text-danger border border-line hover:brightness-110',
}

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  loading?: boolean
}

export default function Button({ variant = 'primary', loading, className = '', children, disabled, ...rest }: Props) {
  return (
    <button
      disabled={disabled || loading}
      className={`tap-none inline-flex items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-50 ${STYLES[variant]} ${className}`}
      {...rest}
    >
      {loading && <Loader2 size={16} className="animate-spin" />}
      {children}
    </button>
  )
}
