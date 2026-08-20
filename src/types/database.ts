/**
 * Supabase database types for the `public` schema.
 *
 * @see supabase/DATABASE.md — full schema, RLS, and connection docs
 * @see docs/erd.mmd — entity relationship diagram
 *
 * Regenerate after schema changes:
 *   npm run supabase:types
 *   npm run supabase:types:local
 */

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type PathType = 'happy' | 'unhappy' | 'exception' | 'alternative' | 'named'

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
        }
        Insert: {
          created_at?: string
          id: string
          title?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
        }
        Relationships: []
      }
      cell_dependencies: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          note: string | null
          source_cell_id: string
          target_cell_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          note?: string | null
          source_cell_id: string
          target_cell_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          note?: string | null
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
      cells: {
        Row: {
          content: string
          created_at: string
          summary: string | null
          form: string | null
          function: string | null
          id: string
          layer_id: string
          links: Json
          owner: string | null
          path_id: string
          perceived_owner: string | null
          picture: string | null
          search_tsv: unknown
          slot_position: number
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
          layer_id: string
          links?: Json
          owner?: string | null
          path_id: string
          perceived_owner?: string | null
          picture?: string | null
          search_tsv?: unknown
          slot_position?: number
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
          layer_id?: string
          links?: Json
          owner?: string | null
          path_id?: string
          perceived_owner?: string | null
          picture?: string | null
          search_tsv?: unknown
          slot_position?: number
          step_id?: string
          updated_at?: string
          value_props?: Json
        }
        Relationships: [
          {
            foreignKeyName: 'cells_layer_id_fkey'
            columns: ['layer_id']
            isOneToOne: false
            referencedRelation: 'layers'
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
          note: string | null
          observed_at: string | null
          proposition_question_key: string | null
          ref: string | null
          service_lifecycle_id: string
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
          note?: string | null
          observed_at?: string | null
          proposition_question_key?: string | null
          ref?: string | null
          service_lifecycle_id: string
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
          note?: string | null
          observed_at?: string | null
          proposition_question_key?: string | null
          ref?: string | null
          service_lifecycle_id?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'evidence_service_lifecycle_id_fkey'
            columns: ['service_lifecycle_id']
            isOneToOne: false
            referencedRelation: 'service_lifecycles'
            referencedColumns: ['id']
          },
        ]
      }
      findings: {
        Row: {
          cell_ids: string[]
          cell_keys: string[]
          check_name: string
          created_at: string
          fingerprint: string
          id: string
          note: string | null
          run_id: string
          service_lifecycle_id: string
          severity: string
          source: string
          status: string
          updated_at: string
        }
        Insert: {
          cell_ids?: string[]
          cell_keys?: string[]
          check_name: string
          created_at?: string
          fingerprint: string
          id?: string
          note?: string | null
          run_id: string
          service_lifecycle_id: string
          severity: string
          source: string
          status?: string
          updated_at?: string
        }
        Update: {
          cell_ids?: string[]
          cell_keys?: string[]
          check_name?: string
          created_at?: string
          fingerprint?: string
          id?: string
          note?: string | null
          run_id?: string
          service_lifecycle_id?: string
          severity?: string
          source?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'findings_service_lifecycle_id_fkey'
            columns: ['service_lifecycle_id']
            isOneToOne: false
            referencedRelation: 'service_lifecycles'
            referencedColumns: ['id']
          },
        ]
      }
      layers: {
        Row: {
          created_at: string
          id: string
          kpis: Json
          layer_role: string | null
          name: string
          owner_team: string | null
          path_id: string
          row_position: number
          tools: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          kpis?: Json
          layer_role?: string | null
          name: string
          owner_team?: string | null
          path_id: string
          row_position?: number
          tools?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          kpis?: Json
          layer_role?: string | null
          name?: string
          owner_team?: string | null
          path_id?: string
          row_position?: number
          tools?: Json
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
          column_position: number
          created_at: string
          path_id: string
          step_id: string
          updated_at: string
        }
        Insert: {
          column_position?: number
          created_at?: string
          path_id: string
          step_id: string
          updated_at?: string
        }
        Update: {
          column_position?: number
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
          path_type: PathType
          service_scenario_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          summary?: string | null
          id?: string
          name: string
          note?: string | null
          path_type: PathType
          service_scenario_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          summary?: string | null
          id?: string
          name?: string
          note?: string | null
          path_type?: PathType
          service_scenario_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'paths_service_scenario_id_fkey'
            columns: ['service_scenario_id']
            isOneToOne: false
            referencedRelation: 'service_scenarios'
            referencedColumns: ['id']
          },
        ]
      }
      phases: {
        Row: {
          business_impact: string | null
          created_at: string
          description: string | null
          id: string
          loops_to_phase_id: string | null
          name: string
          operational_requirements: string | null
          order_position: number
          service_lifecycle_id: string
          updated_at: string
        }
        Insert: {
          business_impact?: string | null
          created_at?: string
          description?: string | null
          id?: string
          loops_to_phase_id?: string | null
          name: string
          operational_requirements?: string | null
          order_position?: number
          service_lifecycle_id: string
          updated_at?: string
        }
        Update: {
          business_impact?: string | null
          created_at?: string
          description?: string | null
          id?: string
          loops_to_phase_id?: string | null
          name?: string
          operational_requirements?: string | null
          order_position?: number
          service_lifecycle_id?: string
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
            foreignKeyName: 'phases_service_lifecycle_id_fkey'
            columns: ['service_lifecycle_id']
            isOneToOne: false
            referencedRelation: 'service_lifecycles'
            referencedColumns: ['id']
          },
        ]
      }
      propositions: {
        Row: {
          created_at: string
          created_by: string | null
          delivery_cost: string | null
          funding: string | null
          partners: string | null
          pricing: string | null
          revenue_model: string | null
          service_lifecycle_id: string
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
          service_lifecycle_id: string
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
          service_lifecycle_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'propositions_service_lifecycle_id_fkey'
            columns: ['service_lifecycle_id']
            isOneToOne: true
            referencedRelation: 'service_lifecycles'
            referencedColumns: ['id']
          },
        ]
      }
      service_lifecycles: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      service_scenarios: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          order_position: number
          phase_id: string
          updated_at: string
          view_type: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          order_position?: number
          phase_id: string
          updated_at?: string
          view_type?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          order_position?: number
          phase_id?: string
          updated_at?: string
          view_type?: string
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
      services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          name: string
          slug: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          name: string
          slug: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          slug?: string
          updated_at?: string
        }
        Relationships: []
      }
      slice_items: {
        Row: {
          caption: string | null
          cell_ids: string[]
          cell_keys: string[]
          created_at: string
          created_by: string | null
          id: string
          illustration: Json | null
          narrative: string | null
          position: number
          slice_id: string
          updated_at: string
        }
        Insert: {
          caption?: string | null
          cell_ids?: string[]
          cell_keys?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          illustration?: Json | null
          narrative?: string | null
          position: number
          slice_id: string
          updated_at?: string
        }
        Update: {
          caption?: string | null
          cell_ids?: string[]
          cell_keys?: string[]
          created_at?: string
          created_by?: string | null
          id?: string
          illustration?: Json | null
          narrative?: string | null
          position?: number
          slice_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'slice_items_slice_id_fkey'
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
          description: string | null
          id: string
          locale: string
          origin: string
          position: number
          service_lifecycle_id: string
          slice_type: string
          title: string
          updated_at: string
        }
        Insert: {
          actor?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          locale?: string
          origin?: string
          position?: number
          service_lifecycle_id: string
          slice_type: string
          title: string
          updated_at?: string
        }
        Update: {
          actor?: string | null
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          locale?: string
          origin?: string
          position?: number
          service_lifecycle_id?: string
          slice_type?: string
          title?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'slices_service_lifecycle_id_fkey'
            columns: ['service_lifecycle_id']
            isOneToOne: false
            referencedRelation: 'service_lifecycles'
            referencedColumns: ['id']
          },
        ]
      }
      steps: {
        Row: {
          created_at: string
          id: string
          name: string
          service_scenario_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          service_scenario_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          service_scenario_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'steps_service_scenario_id_fkey'
            columns: ['service_scenario_id']
            isOneToOne: false
            referencedRelation: 'service_scenarios'
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
    }
    Functions: {
      search_blueprint: {
        Args: {
          embed_model?: string
          filter_layer_role?: string
          filter_path_type?: string
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
          layer: string
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
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}

export type AgentSessionRow = Database['public']['Tables']['agent_sessions']['Row']
export type AgentMessageRow = Database['public']['Tables']['agent_messages']['Row']
export type Cell = Database['public']['Tables']['cells']['Row']
export type CellDependency = Database['public']['Tables']['cell_dependencies']['Row']
export type Layer = Database['public']['Tables']['layers']['Row']
export type Path = Database['public']['Tables']['paths']['Row']
export type PathStep = Database['public']['Tables']['path_steps']['Row']
export type Phase = Database['public']['Tables']['phases']['Row']
export type Service = Database['public']['Tables']['services']['Row']
export type ServiceLifecycle = Database['public']['Tables']['service_lifecycles']['Row']
export type ServiceScenario = Database['public']['Tables']['service_scenarios']['Row']
export type Step = Database['public']['Tables']['steps']['Row']

export type Slice = Database['public']['Tables']['slices']['Row']
export type SliceItem = Database['public']['Tables']['slice_items']['Row']
export type Finding = Database['public']['Tables']['findings']['Row']
export type Evidence = Database['public']['Tables']['evidence']['Row']
export type Proposition = Database['public']['Tables']['propositions']['Row']
export type EvidenceCount = Database['public']['Views']['evidence_counts']['Row']
