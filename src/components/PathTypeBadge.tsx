import { Badge } from '@/components/ui/badge'
import type { PathType } from '@/types/database'
import { cn } from '@/lib/utils'

const labels: Record<PathType, string> = {
  happy: 'Happy path',
  unhappy: 'Unhappy path',
  exception: 'Exception',
  alternative: 'Alternative',
}

const variants: Record<PathType, string> = {
  happy: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-400',
  unhappy: 'bg-amber-500/15 text-amber-800 dark:text-amber-400',
  exception: 'bg-red-500/15 text-red-700 dark:text-red-400',
  alternative: 'bg-blue-500/15 text-blue-700 dark:text-blue-400',
}

export function PathTypeBadge({ type }: { type: PathType }) {
  return (
    <Badge variant="outline" className={cn('border-transparent', variants[type])}>
      {labels[type]}
    </Badge>
  )
}
