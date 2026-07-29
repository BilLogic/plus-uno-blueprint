import type { ReactNode } from 'react'
import { AlertTriangle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

type InlineNoticeProps = {
  variant?: 'info' | 'warning'
  children: ReactNode
  className?: string
}

/**
 * Minimal inline notice — the project has no toast/sonner component, so
 * mutation conflicts and transient errors surface as an inline strip next to
 * the control that produced them (no new dependency).
 */
export function InlineNotice({
  variant = 'info',
  children,
  className,
}: InlineNoticeProps) {
  const Icon = variant === 'warning' ? AlertTriangle : Info
  return (
    <div
      role="status"
      className={cn(
        'flex items-start gap-1.5 rounded-md border px-2 py-1.5 text-xs leading-snug',
        variant === 'warning'
          ? 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300'
          : 'border-border bg-muted/50 text-muted-foreground',
        className,
      )}
    >
      <Icon className="mt-px size-3.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}
