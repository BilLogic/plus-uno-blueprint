import { useEffect, useState } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTheme } from 'next-themes'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type ThemeToggleProps = {
  className?: string
  size?: 'icon-sm' | 'icon-xs'
}

/**
 * Light/dark switch for the app shell.
 *
 * Renders a placeholder until mounted: `next-themes` cannot know the resolved
 * theme before hydration (it reads `localStorage` and the OS preference in an
 * effect), so painting an icon on the first pass would flash the wrong one on
 * every load for anyone not on the default. The placeholder keeps the same box
 * so the header does not reflow when the real icon arrives.
 *
 * The presentation stage is exempt — it pins `.dark` on its own subtree
 * regardless of this setting, because a projected slide is always dark.
 */
export function ThemeToggle({ className, size = 'icon-xs' }: ThemeToggleProps) {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const isDark = resolvedTheme === 'dark'

  return (
    <Button
      type="button"
      variant="ghost"
      size={size}
      className={cn(
        'shrink-0 text-muted-foreground hover:text-foreground',
        className,
      )}
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Switch to light theme' : 'Switch to dark theme'}
      disabled={!mounted}
    >
      {!mounted ? (
        <span className="size-3.5" aria-hidden />
      ) : isDark ? (
        <Sun className="size-3.5" aria-hidden />
      ) : (
        <Moon className="size-3.5" aria-hidden />
      )}
    </Button>
  )
}
