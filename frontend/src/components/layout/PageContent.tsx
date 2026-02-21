import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface PageContentProps {
  children: React.ReactNode
  className?: string
  maxWidth?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | '4xl' | 'full'
  noScroll?: boolean
}

const MAX_WIDTH_CLASS = {
  sm: 'max-w-sm',
  md: 'max-w-md',
  lg: 'max-w-lg',
  xl: 'max-w-xl',
  '2xl': 'max-w-2xl',
  '3xl': 'max-w-3xl',
  '4xl': 'max-w-4xl',
  full: 'max-w-full',
} as const

export function PageContent({
  children,
  className,
  maxWidth = '3xl',
  noScroll = false,
}: PageContentProps) {
  const content = (
    <div className={cn('mx-auto w-full p-4 sm:p-6', MAX_WIDTH_CLASS[maxWidth], className)}>
      {children}
    </div>
  )

  if (noScroll) {
    return <div className="flex-1 min-h-0 overflow-auto">{content}</div>
  }

  return (
    <ScrollArea className="flex-1">
      {content}
    </ScrollArea>
  )
}
