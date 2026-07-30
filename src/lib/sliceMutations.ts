import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/database'

type Client = SupabaseClient<Database>

/** Delete a slice; slice_items cascade in the database. */
export async function deleteSlice(client: Client, sliceId: string): Promise<void> {
  const { error } = await client.from('slices').delete().eq('id', sliceId)
  if (error) throw new Error(error.message)
}
