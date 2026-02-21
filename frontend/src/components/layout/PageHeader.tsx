import { cn } from '@/lib/utils'

interface PageHeaderProps {
  title?: string
  subtitle?: string
  actions?: React.ReactNode
  children?: React.ReactNode
  className?: string
}

export function PageHeader({ title, subtitle, actions, children, className }: PageHeaderProps) {
  return (
    <header
      className={cn(
        'shrink-0 border-b bg-muted/30 flex items-center justify-between gap-4 px-4 sm:px-6 py-4',
        className
      )}
    >
      {children ?? (
        <>
          <div className="min-w-0">
            {title && <h1 className="text-base font-semibold truncate">{title}</h1>}
            {subtitle && (
              <p className="text-sm text-muted-foreground mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          {actions && <div className="shrink-0 flex items-center gap-2">{actions}</div>}
        </>
      )}
    </header>
  )
}
