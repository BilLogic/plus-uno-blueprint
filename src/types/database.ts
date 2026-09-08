import type { EntityStatus } from '@/lib/entityStatus'
/**
 * Supabase database types for the `public` schema.
 *
 * @see supabase/DATABASE.md — full schema, RLS, and connection docs
 * @see docs/erd.mmd — entity relationship diagram
 *
 * GENERATED, 2026-09-08, from the production project through the Supabase
 * connector. Every hand-edited block this file carried is gone: the two
 * placement RPCs, the two rename RPCs, `touchpoints`, `cell_touchpoints`,
 * `resources`, `services.entity_examples` and the rest now read the way the
 * generator emits them, and the whole `Functions` map — fifty-one entries
 * where the hand-maintained file had thirteen — arrived at once.
 *
 * The hand edits were not wrong. `cells_layer_id_fkey` and `layers_path_id_fkey`
 * were, and they had survived a migration that renamed both constraints,
 * because nothing regenerates a file that is written by hand.
 *
 * HOW IT WAS GENERATED, since neither documented path works here. `npm run
 * supabase:types` needs `--linked`, and the CLI account on this machine has no
 * access to the project; `npm run supabase:types:local` and the `--db-url`
 * form both need Docker, which is not installed. The connector has the
 * privilege the CLI lacks and needs neither, so it is the path that works
 * today — and the one to use again.
 *
 * THREE LAYERS ARE RE-APPLIED BY HAND, deliberately, and they are the whole of
 * what is not the generator's:
 *
 *  1. `paths.kind` is typed `PathKind`, rather than the generator's `string`.
 *     The column carries a check constraint naming exactly those three values,
 *     and a constraint is the one thing the generator cannot see; narrowing
 *     here is what makes an invalid value a type error at the call site
 *     instead of a Postgres error at runtime.
 *
 *     `cells.status` and `paths.status` are typed `EntityStatus` on the same
 *     reasoning, but WITHOUT the same backing: both are `text not null default
 *     'live'` and no migration constrains them. The narrowing is a promise the
 *     application keeps, not one the database enforces, so a row written by
 *     anything else can hold a value this type says is impossible. Making it
 *     true is a migration, not an edit here.
 *  2. The row aliases at the foot of the file — `Cell`, `Lane`, `Path` and the
 *     rest — are this app's vocabulary over the generated shapes and have no
 *     generated equivalent.
 *  3. An argument whose SQL default is NULL is typed `?: T | null`, not the
 *     generator's `?: T`. Postgres accepts NULL for those and call sites pass
 *     it — `record_authoring_change(agent_session_id)` and
 *     `set_placement_touchpoint(p_touchpoint_id, p_name)` are the ones that
 *     bite immediately. The rule is mechanical: read the defaults out of
 *     `pg_get_function_arguments` and widen the ones that say `DEFAULT NULL`.
 *
 * Re-apply all three after any regeneration, or the app silently loses a check
 * it had — or stops compiling. Nothing else in this file is hand-written; if a
 * fourth layer appears, it belongs in this list or it does not belong at all.
 *
 * Regenerate after schema changes:
 *   npm run supabase:types           (needs a linked project)
 *   npm run supabase:types:local     (needs Docker)
 *   or the Supabase connector's type generator, as above
 *
 * `scripts/check-database-names.mjs` rests its argument on this file arriving
 * by machine. As of this change it does again.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

/**
 * The path kinds this app draws. Hand-written: `paths.kind` is a text column
 * with a check constraint, and the generator cannot see a constraint.
 */
export type PathKind = 'happy' | 'variant' | 'exception'

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      agent_messages: {
        Row: {
          created_at: string
          id: string
          kind: string
          payload: Json
          seq: number
          session_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          payload: Json
          seq: number
          session_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          payload?: Json
          seq?: number
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "agent_messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "agent_sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      agent_sessions: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string | null
        }
        Insert: {
          created_at?: string
          id: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string | null
        }
        Relationships: []
      }
      audit_findings: {
        Row: {
          cell_ids: string[]
          cell_keys: string[]
          check_key: string
          created_at: string
          fingerprint: string
          id: string
          run_id: string
          service_id: string
          severity: string
          source: string
          status: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          cell_ids?: string[]
          cell_keys?: string[]
          check_key: string
          created_at?: string
          fingerprint: string
          id?: string
          run_id: string
          service_id: string
          severity: string
          source: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          cell_ids?: string[]
          cell_keys?: string[]
          check_key?: string
          created_at?: string
          fingerprint?: string
          id?: string
          run_id?: string
          service_id?: string
          severity?: string
          source?: string
          status?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "audit_findings_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      authoring_changes: {
        Row: {
          affected_slices: Json
          agent_session_id: string | null
          args: Json
          at: string
          author: string
          author_id: string | null
          deleted_kind: string | null
          fn: string
          id: string
          label: string | null
          payload: Json | null
          revert: Json | null
        }
        Insert: {
          affected_slices?: Json
          agent_session_id?: string | null
          args?: Json
          at?: string
          author?: string
          author_id?: string | null
          deleted_kind?: string | null
          fn: string
          id?: string
          label?: string | null
          payload?: Json | null
          revert?: Json | null
        }
        Update: {
          affected_slices?: Json
          agent_session_id?: string | null
          args?: Json
          at?: string
          author?: string
          author_id?: string | null
          deleted_kind?: string | null
          fn?: string
          id?: string
          label?: string | null
          payload?: Json | null
          revert?: Json | null
        }
        Relationships: []
      }
      business_models: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_cost: string | null
          funding: string | null
          partners: string | null
          pricing: string | null
          revenue_model: string | null
          service_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          delivery_cost?: string | null
          funding?: string | null
          partners?: string | null
          pricing?: string | null
          revenue_model?: string | null
          service_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          delivery_cost?: string | null
          funding?: string | null
          partners?: string | null
          pricing?: string | null
          revenue_model?: string | null
          service_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "business_models_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: true
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      cell_dependencies: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string | null
          note: string | null
          source_cell_id: string
          target_cell_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name?: string | null
          note?: string | null
          source_cell_id: string
          target_cell_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string | null
          note?: string | null
          source_cell_id?: string
          target_cell_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cell_dependencies_source_cell_id_fkey"
            columns: ["source_cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cell_dependencies_target_cell_id_fkey"
            columns: ["target_cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
        ]
      }
      cell_touchpoints: {
        Row: {
          cell_id: string
          created_at: string
          id: string
          name: string | null
          origin: string
          position: number
          role: string | null
          summary: string | null
          touchpoint_id: string | null
          updated_at: string
        }
        Insert: {
          cell_id: string
          created_at?: string
          id?: string
          name?: string | null
          origin: string
          position: number
          role?: string | null
          summary?: string | null
          touchpoint_id?: string | null
          updated_at?: string
        }
        Update: {
          cell_id?: string
          created_at?: string
          id?: string
          name?: string | null
          origin?: string
          position?: number
          role?: string | null
          summary?: string | null
          touchpoint_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cell_touchpoints_cell_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cell_touchpoints_touchpoint_id_fkey"
            columns: ["touchpoint_id"]
            isOneToOne: false
            referencedRelation: "touchpoints"
            referencedColumns: ["id"]
          },
        ]
      }
      cells: {
        Row: {
          cell_key: string | null
          content: string
          created_at: string
          form: string | null
          frame: string | null
          function: string | null
          id: string
          lane_id: string
          origin: string
          owner: string | null
          path_id: string
          perceived_owner: string | null
          position: number
          search_tsv: unknown
          status: EntityStatus
          step_id: string
          summary: string | null
          updated_at: string
          value_props: Json
        }
        Insert: {
          cell_key?: string | null
          content?: string
          created_at?: string
          form?: string | null
          frame?: string | null
          function?: string | null
          id?: string
          lane_id: string
          origin?: string
          owner?: string | null
          path_id: string
          perceived_owner?: string | null
          position?: number
          search_tsv?: unknown
          status?: EntityStatus
          step_id: string
          summary?: string | null
          updated_at?: string
          value_props?: Json
        }
        Update: {
          cell_key?: string | null
          content?: string
          created_at?: string
          form?: string | null
          frame?: string | null
          function?: string | null
          id?: string
          lane_id?: string
          origin?: string
          owner?: string | null
          path_id?: string
          perceived_owner?: string | null
          position?: number
          search_tsv?: unknown
          status?: EntityStatus
          step_id?: string
          summary?: string | null
          updated_at?: string
          value_props?: Json
        }
        Relationships: [
          {
            foreignKeyName: "cells_lane_id_fkey"
            columns: ["lane_id"]
            isOneToOne: false
            referencedRelation: "lanes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cells_path_matches_lane_fkey"
            columns: ["lane_id", "path_id"]
            isOneToOne: false
            referencedRelation: "lanes"
            referencedColumns: ["id", "path_id"]
          },
          {
            foreignKeyName: "cells_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      evidence: {
        Row: {
          added_by: string | null
          cell_id: string | null
          cell_key: string | null
          created_at: string
          created_by: string | null
          excerpt: string | null
          id: string
          kind: string
          observed_at: string | null
          proposition_question_key: string | null
          ref: string | null
          service_id: string
          title: string
          updated_at: string
        }
        Insert: {
          added_by?: string | null
          cell_id?: string | null
          cell_key?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          kind: string
          observed_at?: string | null
          proposition_question_key?: string | null
          ref?: string | null
          service_id: string
          title: string
          updated_at?: string
        }
        Update: {
          added_by?: string | null
          cell_id?: string | null
          cell_key?: string | null
          created_at?: string
          created_by?: string | null
          excerpt?: string | null
          id?: string
          kind?: string
          observed_at?: string | null
          proposition_question_key?: string | null
          ref?: string | null
          service_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "evidence_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      lanes: {
        Row: {
          created_at: string
          id: string
          kpis: Json
          lane_role: string | null
          name: string
          origin: string
          owner_team: string | null
          path_id: string
          position: number
          stakeholder_id: string | null
          tools: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kpis?: Json
          lane_role?: string | null
          name: string
          origin?: string
          owner_team?: string | null
          path_id: string
          position?: number
          stakeholder_id?: string | null
          tools?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kpis?: Json
          lane_role?: string | null
          name?: string
          origin?: string
          owner_team?: string | null
          path_id?: string
          position?: number
          stakeholder_id?: string | null
          tools?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "lanes_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lanes_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      path_steps: {
        Row: {
          created_at: string
          path_id: string
          position: number
          step_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          path_id: string
          position?: number
          step_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          path_id?: string
          position?: number
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "path_steps_path_id_fkey"
            columns: ["path_id"]
            isOneToOne: false
            referencedRelation: "paths"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "path_steps_step_id_fkey"
            columns: ["step_id"]
            isOneToOne: false
            referencedRelation: "steps"
            referencedColumns: ["id"]
          },
        ]
      }
      paths: {
        Row: {
          created_at: string
          id: string
          kind: PathKind
          name: string
          note: string | null
          origin: string
          scenario_id: string
          status: EntityStatus
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: PathKind
          name: string
          note?: string | null
          origin?: string
          scenario_id: string
          status?: EntityStatus
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: PathKind
          name?: string
          note?: string | null
          origin?: string
          scenario_id?: string
          status?: EntityStatus
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "paths_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      phases: {
        Row: {
          business_impact: string | null
          created_at: string
          id: string
          loops_to_phase_id: string | null
          name: string
          operational_requirements: string | null
          origin: string
          position: number
          service_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          business_impact?: string | null
          created_at?: string
          id?: string
          loops_to_phase_id?: string | null
          name: string
          operational_requirements?: string | null
          origin?: string
          position?: number
          service_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          business_impact?: string | null
          created_at?: string
          id?: string
          loops_to_phase_id?: string | null
          name?: string
          operational_requirements?: string | null
          origin?: string
          position?: number
          service_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "phases_loops_to_phase_id_fkey"
            columns: ["loops_to_phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "phases_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      resources: {
        Row: {
          cell_id: string
          cell_touchpoint_id: string | null
          created_at: string
          featured: boolean
          id: string
          kind: string
          name: string
          origin: string
          position: number
          updated_at: string
          url: string | null
        }
        Insert: {
          cell_id: string
          cell_touchpoint_id?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          kind?: string
          name: string
          origin: string
          position: number
          updated_at?: string
          url?: string | null
        }
        Update: {
          cell_id?: string
          cell_touchpoint_id?: string | null
          created_at?: string
          featured?: boolean
          id?: string
          kind?: string
          name?: string
          origin?: string
          position?: number
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "resources_cell_id_fkey"
            columns: ["cell_id"]
            isOneToOne: false
            referencedRelation: "cells"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "resources_placement_in_cell_fkey"
            columns: ["cell_touchpoint_id", "cell_id"]
            isOneToOne: false
            referencedRelation: "cell_touchpoints"
            referencedColumns: ["id", "cell_id"]
          },
        ]
      }
      scenarios: {
        Row: {
          created_at: string
          id: string
          layout: string
          name: string
          note: string | null
          origin: string
          phase_id: string
          position: number
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          layout?: string
          name: string
          note?: string | null
          origin?: string
          phase_id: string
          position?: number
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          layout?: string
          name?: string
          note?: string | null
          origin?: string
          phase_id?: string
          position?: number
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "scenarios_phase_id_fkey"
            columns: ["phase_id"]
            isOneToOne: false
            referencedRelation: "phases"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          entity_examples: Json
          id: string
          name: string
          origin: string
          slug: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          entity_examples?: Json
          id?: string
          name: string
          origin?: string
          slug?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          entity_examples?: Json
          id?: string
          name?: string
          origin?: string
          slug?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      slices: {
        Row: {
          actor: string | null
          authorship: string
          created_at: string
          created_by: string | null
          id: string
          kind: string
          locale: string
          position: number
          service_id: string
          stakeholder_id: string | null
          summary: string | null
          title: string
          updated_at: string
        }
        Insert: {
          actor?: string | null
          authorship?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind: string
          locale?: string
          position?: number
          service_id: string
          stakeholder_id?: string | null
          summary?: string | null
          title: string
          updated_at?: string
        }
        Update: {
          actor?: string | null
          authorship?: string
          created_at?: string
          created_by?: string | null
          id?: string
          kind?: string
          locale?: string
          position?: number
          service_id?: string
          stakeholder_id?: string | null
          summary?: string | null
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slices_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "slices_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      slides: {
        Row: {
          cell_ids: string[]
          cell_keys: string[]
          created_at: string
          created_by: string | null
          id: string
          narrative: string | null
          position: number
          slice_id: string
          title: string | null
          updated_at: string
        }
        Insert: {
          cell_ids?: string[]
          cell_keys?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          narrative?: string | null
          position: number
          slice_id: string
          title?: string | null
          updated_at?: string
        }
        Update: {
          cell_ids?: string[]
          cell_keys?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          narrative?: string | null
          position?: number
          slice_id?: string
          title?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "slides_slice_id_fkey"
            columns: ["slice_id"]
            isOneToOne: false
            referencedRelation: "slices"
            referencedColumns: ["id"]
          },
        ]
      }
      stakeholders: {
        Row: {
          aliases: string[]
          created_at: string
          id: string
          kind: string
          name: string
          parent_id: string | null
          summary: string | null
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          id?: string
          kind: string
          name: string
          parent_id?: string | null
          summary?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          id?: string
          kind?: string
          name?: string
          parent_id?: string | null
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "stakeholders_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
      steps: {
        Row: {
          created_at: string
          id: string
          name: string
          origin: string
          scenario_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          origin?: string
          scenario_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          origin?: string
          scenario_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "steps_scenario_id_fkey"
            columns: ["scenario_id"]
            isOneToOne: false
            referencedRelation: "scenarios"
            referencedColumns: ["id"]
          },
        ]
      }
      touchpoints: {
        Row: {
          aliases: string[] | null
          created_at: string
          icon_url: string | null
          id: string
          kind: string
          name: string
          origin: string
          stakeholder_id: string | null
          summary: string | null
          tone: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          aliases?: string[] | null
          created_at?: string
          icon_url?: string | null
          id?: string
          kind?: string
          name: string
          origin: string
          stakeholder_id?: string | null
          summary?: string | null
          tone?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          aliases?: string[] | null
          created_at?: string
          icon_url?: string | null
          id?: string
          kind?: string
          name?: string
          origin?: string
          stakeholder_id?: string | null
          summary?: string | null
          tone?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "touchpoints_stakeholder_id_fkey"
            columns: ["stakeholder_id"]
            isOneToOne: false
            referencedRelation: "stakeholders"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      evidence_counts: {
        Row: {
          cell_id: string | null
          n: number | null
        }
        Relationships: []
      }
      trash: {
        Row: {
          affected_slices: Json | null
          deleted_at: string | null
          deleted_by: string | null
          id: string | null
          kind: string | null
          label: string | null
          payload: Json | null
        }
        Insert: {
          affected_slices?: Json | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string | null
          kind?: string | null
          label?: string | null
          payload?: Json | null
        }
        Update: {
          affected_slices?: Json | null
          deleted_at?: string | null
          deleted_by?: string | null
          id?: string | null
          kind?: string | null
          label?: string | null
          payload?: Json | null
        }
        Relationships: []
      }
    }
    Functions: {
      add_lane: {
        Args: {
          at_position?: number | null
          lane_role?: string | null
          name: string
          scenario_id: string
        }
        Returns: string[]
      }
      add_step: {
        Args: { at_position?: number | null; name: string; path_id: string }
        Returns: string
      }
      cell_natural_key: { Args: { cell_id: string }; Returns: string }
      clear_cell_dependency: {
        Args: { dependency_id: string }
        Returns: undefined
      }
      create_path: {
        Args: {
          kind?: string
          lane_source_path_id?: string | null
          name: string
          scenario_id: string
        }
        Returns: string
      }
      create_phase: {
        Args: { name: string; service_id: string; summary?: string | null }
        Returns: string
      }
      create_scenario: {
        Args: {
          lane_set?: Json
          lane_source_path_id?: string | null
          layout?: string
          name: string
          path_name?: string
          phase_id: string
          step_count?: number
        }
        Returns: Json
      }
      delete_cell: { Args: { cell_id: string }; Returns: string }
      delete_path: { Args: { path_id: string }; Returns: string }
      delete_scenario: { Args: { scenario_id: string }; Returns: string }
      deletion_impact: {
        Args: { kind: string; scope_id?: string | null; target_id: string }
        Returns: Json
      }
      duplicate_path: {
        Args: {
          copy_cells?: boolean
          copy_dependencies?: boolean
          kind?: string
          name: string
          source_path_id: string
        }
        Returns: string
      }
      duplicate_scenario: {
        Args: { name: string; source_scenario_id: string }
        Returns: string
      }
      is_service_account: { Args: never; Returns: boolean }
      key_slug: { Args: { value: string }; Returns: string }
      mint_cell_key: {
        Args: { lane_id: string; path_id: string; step_id: string }
        Returns: string
      }
      owns_agent_session: { Args: { session_owner: string }; Returns: boolean }
      record_authoring_change: {
        Args: {
          agent_session_id?: string | null
          args?: Json
          author?: string
          fn: string
          revert?: Json | null
        }
        Returns: string
      }
      remove_lane: {
        Args: { lane_name: string; scenario_id: string }
        Returns: string
      }
      remove_lanes: { Args: { lane_ids: string[] }; Returns: string }
      remove_placement: { Args: { p_placement_id: string }; Returns: Json }
      remove_step: {
        Args: { path_id: string; step_id: string }
        Returns: string
      }
      rename_content_item: {
        Args: { p_content: string; p_from: string; p_to: string }
        Returns: string
      }
      rename_owner_tag: {
        Args: { from_name: string; to_name: string }
        Returns: string[]
      }
      rename_path: {
        Args: { new_name: string; path_id: string }
        Returns: undefined
      }
      rename_phase: {
        Args: { new_name: string; phase_id: string }
        Returns: undefined
      }
      rename_scenario: {
        Args: { new_name: string; scenario_id: string }
        Returns: undefined
      }
      rename_touchpoint: {
        Args: { p_name: string; p_touchpoint_id: string }
        Returns: Json
      }
      reorder_lanes: {
        Args: { lane_names: string[]; scenario_id: string }
        Returns: undefined
      }
      reorder_steps: {
        Args: { path_id: string; step_ids: string[] }
        Returns: undefined
      }
      restore_cell_touchpoints: {
        Args: { p_cell_id: string; p_rows: Json }
        Returns: undefined
      }
      restore_featured_resources: { Args: { p_rows: Json }; Returns: undefined }
      restore_placement: {
        Args: { p_resources?: Json; p_row: Json }
        Returns: Json
      }
      schema_comments: {
        Args: never
        Returns: {
          column_name: string
          comment: string
          relation: string
        }[]
      }
      search_blueprint: {
        Args: {
          embed_model?: string | null
          filter_lane_role?: string | null
          filter_path_kind?: string | null
          filter_phase?: string | null
          filter_scenario?: string | null
          granularity?: string[]
          include?: string[]
          match_count?: number
          q?: string | null
          query_embedding?: string | null
          rrf_k?: number
        }
        Returns: {
          description: string
          id: string
          kind: string
          lane: string
          links: Json
          matched_by: string
          path: string
          phase: string
          rrf_score: number
          scenario: string
          similarity: number
          snippet: string
          step: string
          title: string
          total_matched: number
          updated_at: string
        }[]
      }
      set_cell_dependency: {
        Args: {
          kind?: string
          name?: string | null
          source_cell_id: string
          target_cell_id: string
        }
        Returns: string
      }
      set_featured_resource: {
        Args: { p_featured: boolean; p_resource_id: string }
        Returns: Json
      }
      set_path_steps: {
        Args: { path_id: string; step_ids: string[] }
        Returns: undefined
      }
      set_placement_touchpoint: {
        Args: {
          p_name?: string | null
          p_placement_id: string
          p_touchpoint_id?: string | null
        }
        Returns: Json
      }
      slices_referencing: { Args: { cell_ids: string[] }; Returns: Json }
      sync_cell_resources: {
        Args: { p_cell_id: string; p_rows: Json }
        Returns: undefined
      }
      sync_cell_touchpoints: {
        Args: { p_cell_id: string; p_names: string[] }
        Returns: Json
      }
      sync_placement_resources: {
        Args: { p_placement_id: string; p_rows: Json }
        Returns: undefined
      }
      update_scenario_layout: {
        Args: { layout: string; scenario_id: string }
        Returns: undefined
      }
      upsert_cell: {
        Args: {
          content: string
          lane_id: string
          path_id: string
          step_id: string
        }
        Returns: string
      }
      value_sets: {
        Args: never
        Returns: {
          column_name: string
          definition: string
          name: string
          relation: string
          source: string
        }[]
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

export type AgentSessionRow = Database['public']['Tables']['agent_sessions']['Row']
export type AgentMessageRow = Database['public']['Tables']['agent_messages']['Row']
export type Cell = Database['public']['Tables']['cells']['Row']
export type CellDependency = Database['public']['Tables']['cell_dependencies']['Row']
export type Lane = Database['public']['Tables']['lanes']['Row']
export type Path = Database['public']['Tables']['paths']['Row']
export type PathStep = Database['public']['Tables']['path_steps']['Row']
export type Phase = Database['public']['Tables']['phases']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type Scenario = Database['public']['Tables']['scenarios']['Row']
export type Stakeholder = Database['public']['Tables']['stakeholders']['Row']
export type Step = Database['public']['Tables']['steps']['Row']

export type Slice = Database['public']['Tables']['slices']['Row']
export type Slide = Database['public']['Tables']['slides']['Row']
export type Finding = Database['public']['Tables']['audit_findings']['Row']
export type Evidence = Database['public']['Tables']['evidence']['Row']
export type BusinessModel = Database['public']['Tables']['business_models']['Row']
export type EvidenceCount = Database['public']['Views']['evidence_counts']['Row']
export type AuthoringChange =
  Database['public']['Tables']['authoring_changes']['Row']
export type TrashEntry = Database['public']['Views']['trash']['Row']
