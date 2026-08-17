import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'

/**
 * The agent's entry point on the phone: a bottom bar with one button (a
 * floating circle read as clutter over the canvas). Hidden entirely for
 * read-only tiers — the same rule as everywhere else in the chrome:
 * viewers get no agent affordance. The bar is a flex child of the shell,
 * so the canvas ends where it begins; nothing floats over content.
 */
export function MobileAgentBar({
  canAgent,
  onOpen,
}: {
  canAgent: boolean
  onOpen: () => void
}) {
  if (!canAgent) return null
  return (
    <nav
      aria-label="Agent"
      className="flex shrink-0 items-center border-t border-border bg-background px-4 py-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]"
    >
      <Button
        variant="secondary"
        size="sm"
        className="h-11 flex-1"
        aria-label="Ask the agent"
        onClick={onOpen}
      >
        <Sparkles /> Ask the agent
      </Button>
    </nav>
  )
}
