import type { EntityStatus } from '@/lib/entityStatus'
/**
 * Supabase database types for the `public` schema.
 *
 * @see supabase/DATABASE.md — full schema, RLS, and connection docs
 * @see docs/erd.mmd — entity relationship diagram
 *
 * Regenerate after schema changes:
 *   npm run supabase:types
 *   npm run supabase:types:local
 *
 * HAND-EDITED, 2026-08-30 (#178, then #187). `touchpoints`,
 * `cell_touchpoints`, the two placement RPCs and the two rename RPCs were
 * written by hand because neither generator runs on
 * the machine this landed from: `--linked` reports the project is not linked,
 * and the `--db-url` form needs Docker, which is not installed. The blocks
 * match the live schema exactly and are in the order the generator emits, so
 * the next successful run should be a no-op — if it is not, the generator is
 * right and these are wrong.
 *
 * HAND-EDITED, 2026-08-31 (#181). `resources` and `sync_cell_resources` were
 * added and `cells.links` removed, under the same rules — `20260830280000`
 * drops the column. `search_blueprint` KEEPS its `links` output column: the
 * RPC now builds that jsonb from `resources`, and the name on the wire is
 * uno-bot's to change rather than a schema rename's to make.
 *
 * HAND-EDITED, 2026-08-31 (#180) and 2026-09-02 (#277): the queue table and
 * its three RPCs came and went by hand under the same rules; `cell_touchpoints.name`,
 * `set_placement_touchpoint`, `remove_placement` and `restore_placement` too.
 * HAND-EDITED, 2026-08-30 (#179). `cells.picture` became `cells.frame`, and
 * the slide table took its own name, with `caption` → `title` and `illustration`
 * dropped. Renamed IN PLACE rather than resorted, which is this file's
 * standing convention for a rename — the generator's own ordering is not
 * alphabetical anyway, and moving a block makes a rename read as a deletion
 * and an addition in review.
 *
 * HAND-EDITED, 2026-08-30 (#176). `authoring_changes`, the `trash` view and
 * `record_authoring_change` were added by hand for the same reason and under
 * the same rules. `deleted_structure` needed no removal here: it was never in
 * this file, which is part of why nothing in the app could see that half the
 * record was durable and half was not.
 * HAND-EDITED, 2026-08-30 (#177). Neither generator runs on the machine this
 * landed from: `--linked` reports the project is not linked, and the
 * `--db-url` form needs Docker, which is not installed. So `20260830190000`'s
 * renames were applied here by hand — `findings` → `audit_findings`,
 * `business_model` → `business_models`, and the columns under them — against
 * the schema that migration produces, verified by replaying it into an empty
 * Postgres and reading the catalogue back. The next successful generator run
 * should be a no-op; if it is not, the generator is right and these are wrong.
 *
 * The two renamed tables were moved to their alphabetical positions, which is
 * where the generator emits them. The file is NOT alphabetical throughout, and
 * that is inherited rather than introduced: `services` and `scenarios` still
 * sit where `service_lifecycles` and `service_scenarios` sorted, because the
 * hand edits that renamed them did not re-sort. Sorting only what this change
 * touches keeps the diff readable; the rest goes right on the next real
 * generation.
 *
 * `scripts/check-database-names.mjs` rests its argument on this file arriving
 * by machine, so a hand edit weakens that premise until a real regeneration
 * confirms it. It is the reason the edit is recorded here rather than left to
 * be discovered.
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type PathKind = 'happy' | 'variant' | 'exception'

export type Database = {
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
            foreignKeyName: 'agent_messages_session_id_fkey'
            columns: ['session_id']
            isOneToOne: false
            referencedRelation: 'agent_sessions'
            referencedColumns: ['id']
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
      audit_findings: {
        Row: {
          cell_ids: string[]
          cell_keys: string[]
          check_key: string
          created_at: string
          fingerprint: string
          id: string
          summary: string | null
          run_id: string
          service_id: string
          severity: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          cell_ids?: string[]
          cell_keys?: string[]
          check_key: string
          created_at?: string
          fingerprint: string
          id?: string
          summary?: string | null
          run_id: string
          service_id: string
          severity: string
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          cell_ids?: string[]
          cell_keys?: string[]
          check_key?: string
          created_at?: string
          fingerprint?: string
          id?: string
          summary?: string | null
          run_id?: string
          service_id?: string
          severity?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'audit_findings_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
        ]
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
            foreignKeyName: 'business_models_service_id_fkey'
            columns: ['service_id']
            isOneToOne: true
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
        ]
      }
      cell_dependencies: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string | null
          source_cell_id: string
          target_cell_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name?: string | null
          source_cell_id: string
          target_cell_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string | null
          source_cell_id?: string
          target_cell_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'cell_dependencies_source_cell_id_fkey'
            columns: ['source_cell_id']
            isOneToOne: false
            referencedRelation: 'cells'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cell_dependencies_target_cell_id_fkey'
            columns: ['target_cell_id']
            isOneToOne: false
            referencedRelation: 'cells'
            referencedColumns: ['id']
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
            foreignKeyName: 'cell_touchpoints_cell_id_fkey'
            columns: ['cell_id']
            isOneToOne: false
            referencedRelation: 'cells'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cell_touchpoints_touchpoint_id_fkey'
            columns: ['touchpoint_id']
            isOneToOne: false
            referencedRelation: 'touchpoints'
            referencedColumns: ['id']
          },
        ]
      }
      cells: {
        Row: {
          content: string
          created_at: string
          summary: string | null
          form: string | null
          function: string | null
          id: string
          lane_id: string
          status: EntityStatus
          owner: string | null
          path_id: string
          perceived_owner: string | null
          frame: string | null
          search_tsv: unknown
          position: number
          step_id: string
          updated_at: string
          value_props: Json
        }
        Insert: {
          content?: string
          created_at?: string
          summary?: string | null
          form?: string | null
          function?: string | null
          id?: string
          lane_id: string
          status?: EntityStatus
          owner?: string | null
          path_id: string
          perceived_owner?: string | null
          frame?: string | null
          search_tsv?: unknown
          position?: number
          step_id: string
          updated_at?: string
          value_props?: Json
        }
        Update: {
          content?: string
          created_at?: string
          summary?: string | null
          form?: string | null
          function?: string | null
          id?: string
          lane_id?: string
          status?: EntityStatus
          owner?: string | null
          path_id?: string
          perceived_owner?: string | null
          frame?: string | null
          search_tsv?: unknown
          position?: number
          step_id?: string
          updated_at?: string
          value_props?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'cells_layer_id_fkey'
            columns: ['lane_id']
            isOneToOne: false
            referencedRelation: 'lanes'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cells_path_id_fkey'
            columns: ['path_id']
            isOneToOne: false
            referencedRelation: 'paths'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'cells_step_id_fkey'
            columns: ['step_id']
            isOneToOne: false
            referencedRelation: 'steps'
            referencedColumns: ['id']
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
            foreignKeyName: 'evidence_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
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
          owner_team: string | null
          path_id: string
          position: number
          tools: Json
          stakeholder_id: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kpis?: Json
          lane_role?: string | null
          name: string
          owner_team?: string | null
          path_id: string
          position?: number
          tools?: Json
          stakeholder_id?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kpis?: Json
          lane_role?: string | null
          name?: string
          owner_team?: string | null
          path_id?: string
          position?: number
          tools?: Json
          stakeholder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'layers_path_id_fkey'
            columns: ['path_id']
            isOneToOne: false
            referencedRelation: 'paths'
            referencedColumns: ['id']
          },
        ]
      }
      path_steps: {
        Row: {
          position: number
          created_at: string
          path_id: string
          step_id: string
          updated_at: string
        }
        Insert: {
          position?: number
          created_at?: string
          path_id: string
          step_id: string
          updated_at?: string
        }
        Update: {
          position?: number
          created_at?: string
          path_id?: string
          step_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'path_steps_path_id_fkey'
            columns: ['path_id']
            isOneToOne: false
            referencedRelation: 'paths'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'path_steps_step_id_fkey'
            columns: ['step_id']
            isOneToOne: false
            referencedRelation: 'steps'
            referencedColumns: ['id']
          },
        ]
      }
      paths: {
        Row: {
          created_at: string
          summary: string | null
          id: string
          name: string
          note: string | null
          kind: PathKind
          status: EntityStatus
          scenario_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          summary?: string | null
          id?: string
          name: string
          note?: string | null
          kind: PathKind
          status?: EntityStatus
          scenario_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          summary?: string | null
          id?: string
          name?: string
          note?: string | null
          kind?: PathKind
          status?: EntityStatus
          scenario_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'paths_service_scenario_id_fkey'
            columns: ['scenario_id']
            isOneToOne: false
            referencedRelation: 'scenarios'
            referencedColumns: ['id']
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
          position?: number
          service_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'phases_loops_to_phase_id_fkey'
            columns: ['loops_to_phase_id']
            isOneToOne: false
            referencedRelation: 'phases'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'phases_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
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
            foreignKeyName: 'resources_cell_id_fkey'
            columns: ['cell_id']
            isOneToOne: false
            referencedRelation: 'cells'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'resources_placement_in_cell_fkey'
            columns: ['cell_touchpoint_id', 'cell_id']
            isOneToOne: false
            referencedRelation: 'cell_touchpoints'
            referencedColumns: ['id', 'cell_id']
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          summary: string | null
          id: string
          name: string
          origin: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          summary?: string | null
          id?: string
          name: string
          origin?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          summary?: string | null
          id?: string
          name?: string
          origin?: string
          updated_at?: string
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          created_at: string
          id: string
          name: string
          position: number
          phase_id: string
          summary: string | null
          updated_at: string
          layout: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          position?: number
          phase_id: string
          summary?: string | null
          updated_at?: string
          layout?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          position?: number
          phase_id?: string
          summary?: string | null
          updated_at?: string
          layout?: string
        }
        Relationships: [
          {
            foreignKeyName: 'service_scenarios_phase_id_fkey'
            columns: ['phase_id']
            isOneToOne: false
            referencedRelation: 'phases'
            referencedColumns: ['id']
          },
        ]
      }
      slides: {
        Row: {
          title: string | null
          cell_ids: string[]
          cell_keys: string[]
          created_at: string
          created_by: string | null
          id: string
          narrative: string | null
          position: number
          slice_id: string
          updated_at: string
        }
        Insert: {
          title?: string | null
          cell_ids?: string[]
          cell_keys?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          narrative?: string | null
          position: number
          slice_id: string
          updated_at?: string
        }
        Update: {
          title?: string | null
          cell_ids?: string[]
          cell_keys?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          narrative?: string | null
          position?: number
          slice_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'slides_slice_id_fkey'
            columns: ['slice_id']
            isOneToOne: false
            referencedRelation: 'slices'
            referencedColumns: ['id']
          },
        ]
      }
      slices: {
        Row: {
          actor: string | null
          created_at: string
          created_by: string | null
          summary: string | null
          id: string
          locale: string
          authorship: string
          position: number
          service_id: string
          kind: string
          title: string
          stakeholder_id: string | null
          updated_at: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          created_by?: string | null
          summary?: string | null
          id?: string
          locale?: string
          authorship?: string
          position?: number
          service_id: string
          kind: string
          title: string
          stakeholder_id?: string | null
          updated_at?: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          created_by?: string | null
          summary?: string | null
          id?: string
          locale?: string
          authorship?: string
          position?: number
          service_id?: string
          kind?: string
          title?: string
          stakeholder_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'slices_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
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
          service_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          aliases?: string[]
          created_at?: string
          id?: string
          kind: string
          name: string
          service_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          aliases?: string[]
          created_at?: string
          id?: string
          kind?: string
          name?: string
          service_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'stakeholders_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
        ]
      }
      touchpoints: {
        Row: {
          created_at: string
          id: string
          kind: string
          name: string
          origin: string
          service_id: string
          stakeholder_id: string | null
          summary: string | null
          updated_at: string
          url: string | null
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          name: string
          origin: string
          service_id: string
          stakeholder_id?: string | null
          summary?: string | null
          updated_at?: string
          url?: string | null
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          name?: string
          origin?: string
          service_id?: string
          stakeholder_id?: string | null
          summary?: string | null
          updated_at?: string
          url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'touchpoints_service_id_fkey'
            columns: ['service_id']
            isOneToOne: false
            referencedRelation: 'services'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'touchpoints_stakeholder_id_fkey'
            columns: ['stakeholder_id']
            isOneToOne: false
            referencedRelation: 'stakeholders'
            referencedColumns: ['id']
          },
        ]
      }
      steps: {
        Row: {
          created_at: string
          id: string
          name: string
          scenario_id: string
          summary: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          scenario_id: string
          summary?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          scenario_id?: string
          summary?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'steps_service_scenario_id_fkey'
            columns: ['scenario_id']
            isOneToOne: false
            referencedRelation: 'scenarios'
            referencedColumns: ['id']
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
        Relationships: []
      }
    }
    Functions: {
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
      remove_placement: {
        Args: { p_placement_id: string }
        Returns: Json
      }
      rename_content_item: {
        Args: { p_content: string; p_from: string; p_to: string }
        Returns: string
      }
      rename_touchpoint: {
        Args: { p_touchpoint_id: string; p_name: string }
        Returns: Json
      }
      restore_cell_touchpoints: {
        Args: { p_cell_id: string; p_rows: Json }
        Returns: undefined
      }
      restore_featured_resources: {
        Args: { p_rows: Json }
        Returns: undefined
      }
      restore_placement: {
        Args: { p_row: Json; p_resources?: Json }
        Returns: Json
      }
      search_blueprint: {
        Args: {
          embed_model?: string
          filter_lane_role?: string
          filter_path_kind?: string
          filter_phase?: string
          filter_scenario?: string
          granularity?: string[]
          include?: string[]
          match_count?: number
          q?: string
          query_embedding?: string
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
      set_placement_touchpoint: {
        Args: { p_placement_id: string; p_touchpoint_id?: string | null; p_name?: string | null }
        Returns: Json
      }
      set_featured_resource: {
        Args: { p_resource_id: string; p_featured: boolean }
        Returns: Json
      }
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
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
