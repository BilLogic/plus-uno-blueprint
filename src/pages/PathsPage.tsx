import { Link } from 'react-router-dom'
import { PathTypeBadge } from '@/components/PathTypeBadge'
import { PageHeader } from '@/components/PageHeader'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { buttonVariants } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { usePaths } from '@/hooks/useWorkflowData'
import { AlertCircle } from 'lucide-react'

export function PathsPage() {
  const { paths, loading, error, configured } = usePaths()

  return (
    <div>
      <PageHeader
        title="Paths"
        description="Blueprint paths within service scenarios (happy, unhappy, exception, alternative)."
      />
      {!configured && (
        <Alert className="mb-6">
          <AlertTitle>Connect Supabase</AlertTitle>
          <AlertDescription>
            Configure environment variables to load paths from your database.
          </AlertDescription>
        </Alert>
      )}
      {error && (
        <Alert variant="destructive" className="mb-6">
          <AlertCircle />
          <AlertTitle>Failed to load paths</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      {loading && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-36" />
          ))}
        </div>
      )}
      {!loading && !error && paths.length === 0 && (
        <Card className="border-dashed">
          <CardHeader>
            <CardTitle>No paths yet</CardTitle>
            <CardDescription>
              Run migrations and seed data, or create paths in Supabase Studio.
            </CardDescription>
          </CardHeader>
        </Card>
      )}
      {!loading && paths.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {paths.map((path) => (
            <Card key={path.id} className="flex flex-col">
              <CardHeader>
                <PathTypeBadge type={path.path_type} />
                <CardTitle className="mt-2">{path.name}</CardTitle>
                <CardDescription>
                  Updated {new Date(path.updated_at).toLocaleDateString()}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex-1" />
              <CardFooter>
                <Link
                  to={`/paths/${path.id}`}
                  className={cn(buttonVariants(), 'w-full')}
                >
                  Open blueprint
                </Link>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
