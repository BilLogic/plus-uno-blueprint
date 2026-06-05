import { Link } from 'react-router-dom'
import { ArrowRight, GitBranch, Layers } from 'lucide-react'
import { ConnectionBanner } from '@/components/ConnectionBanner'
import { PageHeader } from '@/components/PageHeader'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { usePaths, usePhases, useServiceLifecycles } from '@/hooks/useWorkflowData'

export function HomePage() {
  const { paths, loading: pathsLoading } = usePaths()
  const { phases, loading: phasesLoading } = usePhases()
  const { lifecycles, loading: lifecyclesLoading } = useServiceLifecycles()

  return (
    <div className="space-y-8">
      <PageHeader
        title="PLUS Service Hub"
        description="Service lifecycles, phases, scenarios, and blueprint paths with layers, steps, and cells."
      />
      <ConnectionBanner />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Lifecycles</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {lifecyclesLoading ? '—' : lifecycles.length}
            </CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground">
            End-to-end service journeys
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Paths</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {pathsLoading ? '—' : paths.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              to="/paths"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              View paths <ArrowRight className="ml-1 size-4" />
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2">
            <CardDescription>Phases</CardDescription>
            <CardTitle className="text-3xl font-semibold tabular-nums">
              {phasesLoading ? '—' : phases.length}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <Link
              to="/requests"
              className={cn(buttonVariants({ variant: 'outline', size: 'sm' }))}
            >
              View phases <ArrowRight className="ml-1 size-4" />
            </Link>
          </CardContent>
        </Card>
      </div>
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <GitBranch className="mb-2 size-5 text-muted-foreground" />
            <CardTitle>Blueprint paths</CardTitle>
            <CardDescription>
              Happy, unhappy, exception, and alternative paths hold layers, steps,
              and cells.
            </CardDescription>
          </CardHeader>
        </Card>
        <Card>
          <CardHeader>
            <Layers className="mb-2 size-5 text-muted-foreground" />
            <CardTitle>Phases & scenarios</CardTitle>
            <CardDescription>
              Ordered phases contain scenarios; each scenario can define multiple
              paths.
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </div>
  )
}
