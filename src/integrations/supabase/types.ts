export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      action_plans: {
        Row: {
          created_at: string
          goal_id: string | null
          id: string
          session_id: string | null
          status: string
          steps: Json
          summary: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          goal_id?: string | null
          id?: string
          session_id?: string | null
          status?: string
          steps?: Json
          summary?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          goal_id?: string | null
          id?: string
          session_id?: string | null
          status?: string
          steps?: Json
          summary?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "action_plans_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      goal_tasks: {
        Row: {
          ai_generated: boolean
          created_at: string
          depth: number
          description: string | null
          done: boolean
          done_at: string | null
          due_date: string | null
          estimate: string | null
          goal_id: string
          id: string
          parent_id: string | null
          sort_order: number
          title: string
          updated_at: string
          user_id: string
          why: string | null
        }
        Insert: {
          ai_generated?: boolean
          created_at?: string
          depth?: number
          description?: string | null
          done?: boolean
          done_at?: string | null
          due_date?: string | null
          estimate?: string | null
          goal_id: string
          id?: string
          parent_id?: string | null
          sort_order?: number
          title: string
          updated_at?: string
          user_id: string
          why?: string | null
        }
        Update: {
          ai_generated?: boolean
          created_at?: string
          depth?: number
          description?: string | null
          done?: boolean
          done_at?: string | null
          due_date?: string | null
          estimate?: string | null
          goal_id?: string
          id?: string
          parent_id?: string | null
          sort_order?: number
          title?: string
          updated_at?: string
          user_id?: string
          why?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "goal_tasks_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "goal_tasks_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "goal_tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      goals: {
        Row: {
          created_at: string
          description: string | null
          id: string
          linked_plan_id: string | null
          linked_value_id: string | null
          progress: number
          status: string
          target_date: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          linked_plan_id?: string | null
          linked_value_id?: string | null
          progress?: number
          status?: string
          target_date?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          linked_plan_id?: string | null
          linked_value_id?: string | null
          progress?: number
          status?: string
          target_date?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "goals_linked_value_id_fkey"
            columns: ["linked_value_id"]
            isOneToOne: false
            referencedRelation: "values"
            referencedColumns: ["id"]
          },
        ]
      }
      journal_entries: {
        Row: {
          created_at: string
          id: string
          patterns: Json
          session_id: string | null
          summary: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          patterns?: Json
          session_id?: string | null
          summary: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          patterns?: Json
          session_id?: string | null
          summary?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "journal_entries_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_chunks: {
        Row: {
          chunk_index: number
          content: string
          created_at: string
          document_id: string
          embedding: string
          id: string
          user_id: string
        }
        Insert: {
          chunk_index: number
          content: string
          created_at?: string
          document_id: string
          embedding: string
          id?: string
          user_id: string
        }
        Update: {
          chunk_index?: number
          content?: string
          created_at?: string
          document_id?: string
          embedding?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "knowledge_chunks_document_id_fkey"
            columns: ["document_id"]
            isOneToOne: false
            referencedRelation: "knowledge_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      knowledge_documents: {
        Row: {
          byte_size: number | null
          chunk_count: number
          created_at: string
          error: string | null
          file_path: string | null
          id: string
          source_type: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          byte_size?: number | null
          chunk_count?: number
          created_at?: string
          error?: string | null
          file_path?: string | null
          id?: string
          source_type?: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          byte_size?: number | null
          chunk_count?: number
          created_at?: string
          error?: string | null
          file_path?: string | null
          id?: string
          source_type?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      mentor_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          sources: Json | null
          thread_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          sources?: Json | null
          thread_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          sources?: Json | null
          thread_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "mentor_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      mentor_threads: {
        Row: {
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          session_id: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          session_id: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          session_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      priorities: {
        Row: {
          created_at: string
          done: boolean
          due_date: string | null
          id: string
          linked_goal_id: string | null
          linked_plan_id: string | null
          linked_value_id: string | null
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          linked_goal_id?: string | null
          linked_plan_id?: string | null
          linked_value_id?: string | null
          title: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          id?: string
          linked_goal_id?: string | null
          linked_plan_id?: string | null
          linked_value_id?: string | null
          title?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "priorities_linked_goal_id_fkey"
            columns: ["linked_goal_id"]
            isOneToOne: false
            referencedRelation: "goals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "priorities_linked_value_id_fkey"
            columns: ["linked_value_id"]
            isOneToOne: false
            referencedRelation: "values"
            referencedColumns: ["id"]
          },
        ]
      }
      progress_snapshots: {
        Row: {
          created_at: string
          emotional_end: number | null
          emotional_start: number | null
          id: string
          session_id: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          emotional_end?: number | null
          emotional_start?: number | null
          id?: string
          session_id?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          emotional_end?: number | null
          emotional_start?: number | null
          id?: string
          session_id?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "progress_snapshots_session_id_fkey"
            columns: ["session_id"]
            isOneToOne: false
            referencedRelation: "sessions"
            referencedColumns: ["id"]
          },
        ]
      }
      sessions: {
        Row: {
          active_belief: string | null
          active_column: string | null
          active_topic: string | null
          client_name: string | null
          created_at: string
          emotional_current: number | null
          emotional_end: number | null
          emotional_start: number | null
          grid: Json
          id: string
          mode: string
          patterns: Json
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          active_belief?: string | null
          active_column?: string | null
          active_topic?: string | null
          client_name?: string | null
          created_at?: string
          emotional_current?: number | null
          emotional_end?: number | null
          emotional_start?: number | null
          grid?: Json
          id?: string
          mode?: string
          patterns?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          active_belief?: string | null
          active_column?: string | null
          active_topic?: string | null
          client_name?: string | null
          created_at?: string
          emotional_current?: number | null
          emotional_end?: number | null
          emotional_start?: number | null
          grid?: Json
          id?: string
          mode?: string
          patterns?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      values: {
        Row: {
          created_at: string
          id: string
          name: string
          rank: number
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          name: string
          rank?: number
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          name?: string
          rank?: number
          user_id?: string
        }
        Relationships: []
      }
      vision: {
        Row: {
          content: string
          created_at: string
          horizon_years: number
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: string
          created_at?: string
          horizon_years: number
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          horizon_years?: number
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      match_knowledge: {
        Args: { match_count?: number; query_embedding: string }
        Returns: {
          chunk_id: string
          content: string
          document_id: string
          document_title: string
          similarity: number
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

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
