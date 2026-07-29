import { ExternalLink } from 'lucide-react'
import { URL_LINK_TYPE } from '@/lib/blueprintTechDescriptions'
import type { CellLink } from '@/types/blueprint'

type ResourceRow = {
  id: string
  label: string
  url: string
}

type CellResourcesTabProps = {
  links: CellLink[]
  /** Figma link resolved by the panel (added when not already listed). */
  figmaUrl: string | null
}

/** Resources tab: the cell's `links` (UI copy says "Resources"). */
export function CellResourcesTab({ links, figmaUrl }: CellResourcesTabProps) {
  const rows: ResourceRow[] = links.flatMap((link, index) => {
    if (link.type !== URL_LINK_TYPE || !link.url?.trim()) return []
    const url = link.url.trim()
    const label =
      link.label.trim() || (/figma\.com/i.test(url) ? 'Figma' : 'Link')
    return [{ id: `link-${index}`, label, url }]
  })

  if (figmaUrl && !rows.some((row) => row.url === figmaUrl)) {
    rows.push({ id: 'link-figma', label: 'Figma', url: figmaUrl })
  }

  if (rows.length === 0) {
    return (
      <p className="text-xs text-muted-foreground">
        No resources linked to this cell.
      </p>
    )
  }

  return (
    <ul className="flex flex-col">
      {rows.map((row) => (
        <li key={row.id} className="border-b border-border/35 last:border-0">
          <a
            href={row.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex w-full min-w-0 items-center gap-[7px] px-2 py-1.5 text-xs leading-snug font-normal text-foreground/90 transition-colors hover:bg-neutral-100 hover:text-foreground focus-visible:ring-1 focus-visible:ring-ring focus-visible:outline-none dark:hover:bg-foreground/[0.08]"
          >
            <ExternalLink
              className="size-3 shrink-0 text-muted-foreground/70"
              aria-hidden
            />
            <span className="min-w-0 truncate">{row.label}</span>
          </a>
        </li>
      ))}
    </ul>
  )
}
