c/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  /** Local authoring key — dev server only, never set in a deploy env. */
  readonly VITE_SUPABASE_DEV_SERVICE_KEY?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
