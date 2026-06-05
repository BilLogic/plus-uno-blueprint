import { PathTypeColorKey } from '@/components/blueprint/PathTypeColorKey'
import { cn } from '@/lib/utils'
import type { PathType } from '@/types/database'

export type PathOption = {
  id: string
  name: string
  path_type: PathType
}

const MAX_PATHS_PER_COLUMN = 2

const PRIMARY_COLUMN_PATH_TYPES = new Set<PathType>(['happy', 'alternative'])
const SECONDARY_COLUMN_PATH_TYPES = new Set<PathType>(['unhappy', 'exception'])

export function formatPathPickerLabel(name: string): string {
  return name.replace(/^Warm-Up\s+/i, '')
}

function chunkPaths<T>(items: T[], size: number): T[][] {
  const chunks: T[][] = []
  for (let index = 0; index < items.length; index += size) {
    chunks.push(items.slice(index, index + size))
  }
  return chunks
}

/** Happy/alternate paths stack in the left column(s); sad/exception paths go to the right. */
export function groupPathsIntoColumns(paths: PathOption[]): PathOption[][] {
  const primary = paths.filter((path) => PRIMARY_COLUMN_PATH_TYPES.has(path.path_type))
  const secondary = paths.filter((path) =>
    SECONDARY_COLUMN_PATH_TYPES.has(path.path_type),
  )
  const other = paths.filter(
    (path) =>
      !PRIMARY_COLUMN_PATH_TYPES.has(path.path_type) &&
      !SECONDARY_COLUMN_PATH_TYPES.has(path.path_type),
  )

  return [
    ...chunkPaths(primary, MAX_PATHS_PER_COLUMN),
    ...chunkPaths(secondary, MAX_PATHS_PER_COLUMN),
    ...chunkPaths(other, MAX_PATHS_PER_COLUMN),
  ].filter((column) => column.length > 0)
}

type PathMultiSelectProps = {
  paths: PathOption[]
  selectedPathIds: string[]
  onToggle: (pathId: string) => void
  className?: string
  layout?: 'horizontal' | 'vertical'
  label?: string
}

function PathCheckbox({
  path,
  checked,
  onToggle,
  compact,
}: {
  path: PathOption
  checked: boolean
  onToggle: (pathId: string) => void
  compact: boolean
}) {
  const pathLabel = formatPathPickerLabel(path.name)

  return (
    <label
      className={cn(
        'inline-flex cursor-pointer items-center gap-2 rounded-md text-sm transition-colors',
        compact ? 'px-1 py-0.5' : 'px-1 py-1',
        checked && 'font-medium text-foreground',
        !checked && 'text-foreground/90',
      )}
    >
      <input
        type="checkbox"
        className="size-4 shrink-0 rounded border-input accent-primary"
        checked={checked}
        onChange={() => onToggle(path.id)}
        aria-label={`${checked ? 'Hide' : 'Show'} ${pathLabel}`}
      />
      <PathTypeColorKey type={path.path_type} />
      <span className="min-w-0 text-left">{pathLabel}</span>
    </label>
  )
}

export function PathMultiSelect({
  paths,
  selectedPathIds,
  onToggle,
  className,
  layout = 'horizontal',
  label = 'Paths to view',
}: PathMultiSelectProps) {
  const isVertical = layout === 'vertical'
  const columns = groupPathsIntoColumns(paths)

  return (
    <div
      className={cn('shrink-0', className)}
      onPointerDown={(e) => e.stopPropagation()}
      onClick={(e) => e.stopPropagation()}
    >
      <p
        className={cn(
          'text-sm font-medium text-foreground',
          isVertical && 'mb-2',
        )}
      >
        {label}
      </p>
      <div
        className={cn(
          'flex flex-row items-start gap-x-4',
          isVertical ? 'gap-y-2' : 'mt-1 gap-y-2 rounded-lg border border-border bg-background px-3 py-2.5',
        )}
      >
        {columns.map((column, columnIndex) => (
          <div
            key={column.map((path) => path.id).join('-')}
            className="flex min-w-0 flex-col gap-2"
            aria-label={
              columnIndex === 0 ? undefined : `Path column ${columnIndex + 1}`
            }
          >
            {column.map((path) => (
              <PathCheckbox
                key={path.id}
                path={path}
                checked={selectedPathIds.includes(path.id)}
                onToggle={onToggle}
                compact={!isVertical}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  )
}
