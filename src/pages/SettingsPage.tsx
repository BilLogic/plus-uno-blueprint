import { PageHeader } from '@/components/PageHeader'
import { SupabaseServicesTable } from '@/components/SupabaseServicesTable'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card'

export function SettingsPage() {
  return (
    <div className="space-y-8">
      <PageHeader
        title="Settings"
        description="Environment configuration and legacy service catalog."
      />
      <Card>
        <CardHeader>
          <CardTitle>Environment</CardTitle>
          <CardDescription>
            Required variables for the Vite app (see <code>.env.example</code>).
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 font-mono text-sm">
          <p>
            <span className="text-muted-foreground">VITE_SUPABASE_URL</span>
          </p>
          <p>
            <span className="text-muted-foreground">VITE_SUPABASE_ANON_KEY</span>
          </p>
        </CardContent>
      </Card>
      <SupabaseServicesTable />
    </div>
  )
}
