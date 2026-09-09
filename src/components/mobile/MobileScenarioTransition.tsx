import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MOTION_FADE_MS, prefersReducedMotion } from '@/lib/motion'

type MobileScenarioTransitionProps = {
  scenarioId: string | null
  children: (displayedScenarioId: string | null) => ReactNode
}

/**
 * Mobile replaces one spatial world with another. Keep the outgoing board
 * mounted while it fades out, swap while fully transparent, then reveal the
 * incoming board after its mount-time fit has run.
 */
export function MobileScenarioTransition({
  scenarioId,
  children,
}: MobileScenarioTransitionProps) {
  const [displayedScenarioId, setDisplayedScenarioId] = useState(scenarioId)
  const displayedScenarioRef = useRef(displayedScenarioId)
  const [phase, setPhase] = useState<'idle' | 'out' | 'in'>('idle')

  useEffect(() => {
    if (scenarioId === displayedScenarioRef.current) return
    if (displayedScenarioRef.current === null || prefersReducedMotion()) {
      displayedScenarioRef.current = scenarioId
      setDisplayedScenarioId(scenarioId)
      setPhase('idle')
      return
    }

    setPhase('out')
    let frame = 0
    const timer = window.setTimeout(() => {
      displayedScenarioRef.current = scenarioId
      setDisplayedScenarioId(scenarioId)
      setPhase('in')
      frame = requestAnimationFrame(() => setPhase('idle'))
    }, MOTION_FADE_MS)
    return () => {
      window.clearTimeout(timer)
      cancelAnimationFrame(frame)
    }
  }, [scenarioId])

  return (
    <div
      className="absolute inset-0 flex min-h-0 flex-col"
      data-mobile-scenario-swap={phase}
      style={{
        opacity: phase === 'idle' ? 1 : 0,
        transition: `opacity ${MOTION_FADE_MS}ms ease-out`,
      }}
    >
      {children(displayedScenarioId)}
    </div>
  )
}
