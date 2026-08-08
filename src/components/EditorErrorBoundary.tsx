import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Button } from '@/components/ui/button'

type Props = { children: ReactNode }
type State = { error: Error | null }

/**
 * A last line before the white screen.
 *
 * The editor is a large, always-mounted canvas; a throw anywhere in it used
 * to unmount the whole tree with no fallback, so a bug — or a mobile tab
 * running out of memory mid-render — showed the user a blank page. This
 * keeps a designed surface on screen and a way back, and logs the error
 * where a human can find it. A true OOM still kills the tab (nothing in JS
 * can catch that), but every recoverable throw now degrades instead of
 * disappearing.
 */
export class EditorErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[editor] uncaught error:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children
    return (
      <div className="flex h-full min-h-0 w-full items-center justify-center bg-background p-8">
        <div className="flex max-w-md flex-col items-start gap-3 rounded-lg border border-border bg-card p-6 shadow-sm">
          <h1 className="text-base font-semibold text-foreground">
            Something went wrong
          </h1>
          <p className="text-sm text-muted-foreground">
            The editor hit an error and stopped rendering. Reloading usually
            clears it. If it keeps happening on a specific phase or scenario,
            that view may be too heavy for this device.
          </p>
          <p className="w-full truncate rounded bg-muted px-2 py-1 font-mono text-xs text-muted-foreground">
            {error.message}
          </p>
          <Button size="sm" onClick={() => window.location.reload()}>
            Reload
          </Button>
        </div>
      </div>
    )
  }
}
