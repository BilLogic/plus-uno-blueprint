import { Menu, MoreHorizontal, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ThemeToggle } from '@/components/editor/ThemeToggle'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

/**
 * The phone's top chrome: nav · title · theme · agent · overflow.
 *
 * Extracted from MobileShell as a Phase-2 seam (plan 2026-08-16-002): the
 * redesign replaces this bar's contents, and a component swap beats surgery
 * on the middle of the shell. Behaviour here is IDENTICAL to the inline
 * original — icon buttons carry a 44px hit area (size-11), the glyphs stay
 * small.
 */
export function MobileTopBar({
  title,
  canAgent,
  onOpenNav,
  onOpenAgent,
}: {
  title: string
  canAgent: boolean
  onOpenNav: () => void
  onOpenAgent: () => void
}) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-0.5 border-b border-border px-1">
      <Button
        variant="ghost"
        size="icon-sm"
        className="size-11"
        aria-label="Open navigation"
        onClick={onOpenNav}
      >
        <Menu />
      </Button>
      <h1 className="min-w-0 flex-1 truncate text-sm font-medium text-foreground">
        {title}
      </h1>
      <ThemeToggle size="icon-sm" />
      {canAgent ? (
        <Button
          variant="ghost"
          size="icon-sm"
          className="size-11"
          aria-label="Ask the agent"
          onClick={onOpenAgent}
        >
          <Sparkles />
        </Button>
      ) : null}
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button
              variant="ghost"
              size="icon-sm"
              className="size-11"
              aria-label="More"
            >
              <MoreHorizontal />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem disabled>
            Editing is available on desktop
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </header>
  )
}
