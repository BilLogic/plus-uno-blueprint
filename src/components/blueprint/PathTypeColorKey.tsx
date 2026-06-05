import { PATH_TYPE_LABELS, PATH_TYPE_SWATCH_CLASSES } from '@/lib/pathTypeTheme'
import { cn } from '@/lib/utils'
import type { PathType } from '@/types/database'

type PathTypeColorKeyProps = {
  type: PathType
  className?: string
  size?: 'sm' | 'md'
}

export function PathTypeColorKey({
  type,
  className,
  size = 'sm',
}: PathTypeColorKeyProps) {
  return (
    <span
      className={cn(
        'inline-block shrink-0 rounded-full',
        size === 'sm' ? 'size-2.5' : 'size-3',
        PATH_TYPE_SWATCH_CLASSES[type],
        className,
      )}
      title={PATH_TYPE_LABELS[type]}
      aria-hidden
    />
  )
}
