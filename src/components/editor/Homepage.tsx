import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { useEditor } from '@/contexts/EditorContext'
import { cn } from '@/lib/utils'

const CONCEPT_TABS = [
  {
    value: 'what-is-plus',
    label: 'What is PLUS?',
  },
  {
    value: 'who-are-tutors',
    label: 'Who are Tutors?',
  },
  {
    value: 'what-is-a-service-blueprint',
    label: 'What is a Service Blueprint?',
  },
] as const

type ConceptTabValue = (typeof CONCEPT_TABS)[number]['value']

/**
 * Orientation homepage — header + concept tabs.
 * Tab bodies are filled in as content is defined.
 */
export function Homepage() {
  const { enterCanvas } = useEditor()
  const [activeTab, setActiveTab] = useState<ConceptTabValue>(
    CONCEPT_TABS[0].value,
  )
  const listRef = useRef<HTMLDivElement>(null)
  const triggerRefs = useRef(new Map<string, HTMLElement>())
  const [indicator, setIndicator] = useState({ left: 0, width: 0, ready: false })

  const setTriggerRef = useCallback(
    (value: string) => (node: HTMLElement | null) => {
      if (node) triggerRefs.current.set(value, node)
      else triggerRefs.current.delete(value)
    },
    [],
  )

  const updateIndicator = useCallback(() => {
    const list = listRef.current
    const trigger = triggerRefs.current.get(activeTab)
    if (!list || !trigger) return

    const listRect = list.getBoundingClientRect()
    const triggerRect = trigger.getBoundingClientRect()
    setIndicator({
      left: triggerRect.left - listRect.left,
      width: triggerRect.width,
      ready: true,
    })
  }, [activeTab])

  useLayoutEffect(() => {
    updateIndicator()
  }, [updateIndicator])

  useEffect(() => {
    const list = listRef.current
    if (!list) return

    const observer = new ResizeObserver(() => updateIndicator())
    observer.observe(list)
    for (const trigger of triggerRefs.current.values()) {
      observer.observe(trigger)
    }

    window.addEventListener('resize', updateIndicator)
    return () => {
      observer.disconnect()
      window.removeEventListener('resize', updateIndicator)
    }
  }, [updateIndicator])

  return (
    <div
      className="relative flex h-full min-h-0 flex-col overflow-y-auto bg-background"
      data-homepage
    >
      <div className="mx-auto flex w-full max-w-5xl flex-col px-8 py-10 sm:px-10 sm:py-12 lg:py-14">
        <header className="flex flex-col gap-3 pb-10">
          <div className="flex items-start justify-between gap-4">
            <h1 className="text-3xl font-semibold tracking-tight text-foreground sm:text-[2.25rem] sm:leading-tight">
              Uno Blueprint
            </h1>
            <Button
              type="button"
              onClick={enterCanvas}
              // The one primary action on the landing page, so it takes the
              // brand fill — which is the Button's own `default` variant. It
              // used to restate `bg-primary` and its hover here at a different
              // alpha than the variant used, which is how the two drifted.
              className="h-9 shrink-0 px-3.5 font-semibold"
            >
              View PLUS Blueprints
            </Button>
          </div>
          <p className="text-base leading-relaxed text-muted-foreground">
            A repository of the service experiences PLUS supports for tutors
            from Discovery to Post-Session activities.
          </p>
        </header>

        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (typeof value === 'string') {
              setActiveTab(value as ConceptTabValue)
            }
          }}
          className="gap-6"
        >
          <TabsList
            ref={listRef}
            variant="line"
            className="relative h-auto w-full justify-between gap-0 rounded-none border-b border-border p-0"
          >
            {CONCEPT_TABS.map((tab) => (
              <TabsTrigger
                key={tab.value}
                ref={setTriggerRef(tab.value)}
                value={tab.value}
                className={cn(
                  'h-auto flex-none rounded-none px-0 pb-3 pt-0 text-sm font-medium',
                  'text-muted-foreground transition-colors duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                  'hover:text-foreground data-active:text-foreground',
                  // Hide the default after-underline; we animate a shared indicator instead.
                  'after:hidden',
                )}
              >
                {tab.label}
              </TabsTrigger>
            ))}
            <span
              aria-hidden
              className={cn(
                'pointer-events-none absolute bottom-[-1px] h-0.5 bg-foreground',
                'transition-[left,width,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]',
                indicator.ready ? 'opacity-100' : 'opacity-0',
              )}
              style={{ left: indicator.left, width: indicator.width }}
            />
          </TabsList>

          <TabsContent value="what-is-plus" className="mt-0">
            <div className="grid grid-cols-[auto_1fr] items-start gap-4 sm:gap-5">
              <div className="flex items-start justify-start">
                <img
                  src="/homepage/plus-icon.png"
                  alt="PLUS"
                  width={80}
                  height={80}
                  className="size-16 rounded-[1.15rem] sm:size-20"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  PLUS Personalized Learning
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  PLUS Personalized Learning is a hybrid human-AI tutoring
                  platform with 500+ tutors, used across 13+ schools, supporting
                  5,000+ middle school students through real-time, in-class math
                  tutoring sessions
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent value="who-are-tutors" className="mt-0">
            <div className="grid grid-cols-[auto_1fr] items-start gap-4 sm:gap-5">
              <div className="flex items-start justify-start">
                <img
                  src="/homepage/tutor-illustration.png"
                  alt="PLUS tutor"
                  width={220}
                  height={220}
                  className="size-44 rounded-xl border border-border bg-white object-contain sm:size-52"
                />
              </div>
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  Tutors
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  Tutors at PLUS are university students working part time.
                  Before they run sessions, they complete onboarding and lesson
                  modules. In each tutoring session they typically support about
                  5–6 students, guided by the PLUS app built by the PLUS team.
                </p>
              </div>
            </div>
          </TabsContent>

          <TabsContent
            value="what-is-a-service-blueprint"
            className="mt-0"
          >
            <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,36rem)_1fr] lg:gap-8">
              <img
                src="/homepage/blueprint-anatomy.svg"
                alt="Anatomy of a service blueprint showing steps, lanes, ideas, triggers, and lines of interaction and visibility"
                className="h-auto w-full max-w-xl rounded-xl border border-border bg-white object-contain"
              />
              <div className="flex min-w-0 flex-col gap-2">
                <h3 className="text-lg font-semibold tracking-tight text-foreground sm:text-xl">
                  Service blueprints
                </h3>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  A service blueprint is a structured map of how an experience
                  is delivered over time. It shows what happens at each step,
                  who is involved in each lane, and how actions connect.
                </p>
                <p className="text-sm leading-relaxed text-muted-foreground sm:text-base">
                  A blueprint makes the full delivery visible so teams can
                  align on how work should happen, spot gaps, and improve the
                  experience with shared clarity instead of assumption.
                </p>
              </div>
            </div>
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
