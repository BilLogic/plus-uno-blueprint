import { PageHeader } from '@/components/PageHeader'
import { PathTypeBadge } from '@/components/PathTypeBadge'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { usePhases } from '@/hooks/useWorkflowData'
import type { PathType } from '@/types/database'

export function ServiceRequestsPage() {
  const { phases, loading, error, configured } = usePhases()

  return (
    <div>
      <PageHeader
        title="Phases"
        description="Ordered phases within service lifecycles, with scenarios and paths."
      />
      {!configured && (
        <Alert className="mb-6">
          <AlertTitle>Connect Supabase</AlertTitle>
          <AlertDescription>
            Configure environment variables to load phases from your database.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && <Skeleton className="h-64 w-full" />}
      {!loading && !error && (
        <Card>
          <CardHeader>
            <CardTitle>All phases</CardTitle>
            <CardDescription>
              {phases.length} phase{phases.length === 1 ? '' : 's'}
            </CardDescription>
          </CardHeader>
          <CardContent>
            {phases.length === 0 ? (
              <p className="text-sm text-muted-foreground">No phases found.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Order</TableHead>
                    <TableHead>Name</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead>Scenarios</TableHead>
                    <TableHead>Path</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {phases.map((phase) => {
                    const scenarios = (phase.service_scenarios ?? []) as Array<{
                      name: string
                      paths?: Array<{ name: string; path_type: PathType }>
                    }>
                    const firstPath = scenarios[0]?.paths?.[0]
                    return (
                      <TableRow key={phase.id as string}>
                        <TableCell>{phase.order_position as number}</TableCell>
                        <TableCell className="font-medium">
                          {(phase.name as string) ?? '—'}
                        </TableCell>
                        <TableCell className="max-w-md">
                          {(phase.description as string) ?? '—'}
                        </TableCell>
                        <TableCell>
                          {scenarios.length === 0
                            ? '—'
                            : scenarios.map((s) => s.name).join(', ')}
                        </TableCell>
                        <TableCell>
                          {firstPath ? (
                            <PathTypeBadge type={firstPath.path_type} />
                          ) : (
                            '—'
                          )}
                        </TableCell>
                      </TableRow>
                    )
                  })}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}
