import { Link, useParams } from 'react-router-dom'
import { PathTypeBadge } from '@/components/PathTypeBadge'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Badge } from '@/components/ui/badge'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Separator } from '@/components/ui/separator'
import { Skeleton } from '@/components/ui/skeleton'
import { usePathDetail } from '@/hooks/useWorkflowData'
import { flattenPathSteps } from '@/lib/normalizeBlueprint'
import type { PathType } from '@/types/database'
import { ArrowLeft } from 'lucide-react'

type LayerRow = { id: string; name: string; row_position: number }
type PathStepRow = {
  column_position: number
  steps: { id: string; name: string } | null
}
type CellRow = {
  id: string
  layer_id: string
  step_id: string
  content: string
}

type ScenarioNested = {
  id: string
  name: string
  phases?: {
    id: string
    name: string
    order_position: number
    service_lifecycles?: { id: string; name: string }
  }
}

export function PathDetailPage() {
  const { id } = useParams<{ id: string }>()
  const { data, loading, error } = usePathDetail(id)

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  if (error || !data) {
    return (
      <div>
        <Link
          to="/paths"
          className={cn(buttonVariants({ variant: 'ghost', size: 'sm' }), 'mb-4')}
        >
          <ArrowLeft className="mr-1 size-4" /> Back to paths
        </Link>
        <Alert variant="destructive">
          <AlertTitle>Could not load path</AlertTitle>
          <AlertDescription>{error ?? 'Path not found'}</AlertDescription>
        </Alert>
      </div>
    )
  }

  const pathName = data.name as string
  const pathType = data.path_type as PathType
  const scenario = (data.service_scenarios ?? null) as ScenarioNested | null
  const phase = scenario?.phases
  const lifecycle = phase?.service_lifecycles

  const layers = ((data.layers ?? []) as LayerRow[]).sort(
    (a, b) => a.row_position - b.row_position,
  )
  const steps = flattenPathSteps((data.path_steps ?? []) as PathStepRow[])
  const cells = (data.cells ?? []) as CellRow[]
  const cellByKey = new Map(
    cells.map((c) => [`${c.layer_id}:${c.step_id}`, c.content]),
  )

  return (
    <div className="space-y-8">
      <div>
        <Link
          to="/paths"
          className={cn(
            buttonVariants({ variant: 'ghost', size: 'sm' }),
            'mb-4 -ml-2',
          )}
        >
          <ArrowLeft className="mr-1 size-4" /> Paths
        </Link>
        <PageHeader
          title={pathName}
          description="Service blueprint: layers, steps, and cell content."
        >
          <PathTypeBadge type={pathType} />
        </PageHeader>
      </div>

      {(lifecycle || phase || scenario) && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Journey context</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2 text-sm">
            {lifecycle && (
              <Badge variant="secondary">{lifecycle.name}</Badge>
            )}
            {phase && (
              <Badge variant="outline">
                {phase.name} (order {phase.order_position})
              </Badge>
            )}
            {scenario && <Badge variant="outline">{scenario.name}</Badge>}
          </CardContent>
        </Card>
      )}

      <Separator />

      <section className="space-y-4">
        <h2 className="text-lg font-medium">Blueprint grid</h2>
        {layers.length === 0 || steps.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            No layers or steps on this path yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full min-w-[480px] border-collapse text-sm">
              <thead>
                <tr className="border-b bg-muted/40">
                  <th className="px-3 py-2 text-left font-medium">Layer</th>
                  {steps.map((step) => (
                    <th key={step.id} className="px-3 py-2 text-left font-medium">
                      {step.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {layers.map((layer) => (
                  <tr key={layer.id} className="border-b last:border-0">
                    <td className="px-3 py-2 font-medium align-top">{layer.name}</td>
                    {steps.map((step) => {
                      const content =
                        cellByKey.get(`${layer.id}:${step.id}`) ?? '—'
                      return (
                        <td
                          key={step.id}
                          className="px-3 py-2 align-top text-muted-foreground"
                        >
                          {content}
                        </td>
                      )
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {((data.cell_triggers ?? []) as Array<{
        id: string
        source_cell_id: string
        target_cell_id: string
      }>).length > 0 && (
        <section className="space-y-2">
          <h2 className="text-lg font-medium">Cell triggers</h2>
          <p className="text-sm text-muted-foreground">
            Dependencies between cells on this path.
          </p>
          <ul className="list-inside list-disc text-sm text-muted-foreground">
            {(
              data.cell_triggers as Array<{
                source_cell_id: string
                target_cell_id: string
              }>
            ).map((t, i) => (
              <li key={i}>
                {t.source_cell_id.slice(0, 8)}… → {t.target_cell_id.slice(0, 8)}…
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  )
}
