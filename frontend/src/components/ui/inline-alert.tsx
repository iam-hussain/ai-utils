import { cn } from '@/lib/utils'

interface InlineAlertProps {
  variant?: 'error' | 'success' | 'warning'
  children: React.ReactNode
  className?: string
  role?: 'alert' | 'status'
}

const VARIANT_CLASS = {
  error: 'text-destructive bg-destructive/10',
  success: 'text-primary bg-primary/10',
  warning: 'text-amber-600 bg-amber-500/10',
} as const

export function InlineAlert({
  variant = 'error',
  children,
  className,
  role = 'alert',
}: InlineAlertProps) {
  return (
    <div
      role={role}
      className={cn(
        'flex items-center gap-3 rounded-lg px-4 py-3 text-sm',
        VARIANT_CLASS[variant],
        className
      )}
    >
      {children}
    </div>
  )
}
