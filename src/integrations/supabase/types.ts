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
      clarity_bookings: {
        Row: {
          access_token: string
          completed_at: string | null
          concern: string | null
          consent_accepted: boolean
          contact_email: string | null
          created_at: string
          email: string
          emotional_end: number | null
          emotional_start: number | null
          feedback: string | null
          helpfulness_rating: number | null
          human_session_note: string | null
          human_session_preferred_at: string | null
          human_session_requested_at: string | null
          id: string
          name: string
          phone: string | null
          safety_reason: string | null
          safety_triggered: boolean
          scheduled_at: string | null
          started_at: string | null
          status: string
          summary: Json | null
          updated_at: string
          wants_human_session: boolean
          wants_subscription: boolean
        }
        Insert: {
          access_token?: string
          completed_at?: string | null
          concern?: string | null
          consent_accepted?: boolean
          contact_email?: string | null
          created_at?: string
          email: string
          emotional_end?: number | null
          emotional_start?: number | null
          feedback?: string | null
          helpfulness_rating?: number | null
          human_session_note?: string | null
          human_session_preferred_at?: string | null
          human_session_requested_at?: string | null
          id?: string
          name: string
          phone?: string | null
          safety_reason?: string | null
          safety_triggered?: boolean
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          summary?: Json | null
          updated_at?: string
          wants_human_session?: boolean
          wants_subscription?: boolean
        }
        Update: {
          access_token?: string
          completed_at?: string | null
          concern?: string | null
          consent_accepted?: boolean
          contact_email?: string | null
          created_at?: string
          email?: string
          emotional_end?: number | null
          emotional_start?: number | null
          feedback?: string | null
          helpfulness_rating?: number | null
          human_session_note?: string | null
          human_session_preferred_at?: string | null
          human_session_requested_at?: string | null
          id?: string
          name?: string
          phone?: string | null
          safety_reason?: string | null
          safety_triggered?: boolean
          scheduled_at?: string | null
          started_at?: string | null
          status?: string
          summary?: Json | null
          updated_at?: string
          wants_human_session?: boolean
          wants_subscription?: boolean
        }
        Relationships: []
      }
      clarity_messages: {
        Row: {
          booking_id: string
          content: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          booking_id: string
          content: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          booking_id?: string
          content?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "clarity_messages_booking_id_fkey"
            columns: ["booking_id"]
            isOneToOne: false
            referencedRelation: "clarity_bookings"
            referencedColumns: ["id"]
          },
        ]
      }
      clarity_slot_state: {
        Row: {
          capacity: number
          filled: number
          id: number
          updated_at: string
        }
        Insert: {
          capacity?: number
          filled?: number
          id?: number
          updated_at?: string
        }
        Update: {
          capacity?: number
          filled?: number
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      clarity_waitlist: {
        Row: {
          concern: string | null
          created_at: string
          email: string
          id: string
          name: string
          notified_at: string | null
          status: string
        }
        Insert: {
          concern?: string | null
          created_at?: string
          email: string
          id?: string
          name: string
          notified_at?: string | null
          status?: string
        }
        Update: {
          concern?: string | null
          created_at?: string
          email?: string
          id?: string
          name?: string
          notified_at?: string | null
          status?: string
        }
        Relationships: []
      }
      email_send_log: {
        Row: {
          created_at: string
          error_message: string | null
          id: string
          message_id: string | null
          metadata: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Insert: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email: string
          status: string
          template_name: string
        }
        Update: {
          created_at?: string
          error_message?: string | null
          id?: string
          message_id?: string | null
          metadata?: Json | null
          recipient_email?: string
          status?: string
          template_name?: string
        }
        Relationships: []
      }
      email_send_state: {
        Row: {
          auth_email_ttl_minutes: number
          batch_size: number
          id: number
          retry_after_until: string | null
          send_delay_ms: number
          transactional_email_ttl_minutes: number
          updated_at: string
        }
        Insert: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Update: {
          auth_email_ttl_minutes?: number
          batch_size?: number
          id?: number
          retry_after_until?: string | null
          send_delay_ms?: number
          transactional_email_ttl_minutes?: number
          updated_at?: string
        }
        Relationships: []
      }
      email_unsubscribe_tokens: {
        Row: {
          created_at: string
          email: string
          id: string
          token: string
          used_at: string | null
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          token: string
          used_at?: string | null
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          token?: string
          used_at?: string | null
        }
        Relationships: []
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
          alignment_updated_at: string | null
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
          value_alignment: Json
          value_alignment_score: number | null
        }
        Insert: {
          alignment_updated_at?: string | null
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
          value_alignment?: Json
          value_alignment_score?: number | null
        }
        Update: {
          alignment_updated_at?: string | null
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
          value_alignment?: Json
          value_alignment_score?: number | null
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
      invite_codes: {
        Row: {
          active: boolean
          code: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          id: string
          max_uses: number | null
          note: string | null
          updated_at: string
          uses: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          note?: string | null
          updated_at?: string
          uses?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          id?: string
          max_uses?: number | null
          note?: string | null
          updated_at?: string
          uses?: number
        }
        Relationships: []
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
          language: string | null
          source_type: string
          status: string
          tags: string[]
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
          language?: string | null
          source_type?: string
          status?: string
          tags?: string[]
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
          language?: string | null
          source_type?: string
          status?: string
          tags?: string[]
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
      profiles: {
        Row: {
          allow_analytics: boolean
          avatar_url: string | null
          bio: string | null
          birth_date: string | null
          created_at: string
          display_name: string | null
          email_notifications: boolean
          goal_reminders: boolean
          id: string
          language: string | null
          location: string | null
          marketing_emails: boolean
          mentor_replies: boolean
          profile_visibility: string
          reminder_time: string | null
          session_reminders: boolean
          share_insights: boolean
          share_progress: boolean
          timezone: string | null
          updated_at: string
          weekly_summary: boolean
        }
        Insert: {
          allow_analytics?: boolean
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          email_notifications?: boolean
          goal_reminders?: boolean
          id: string
          language?: string | null
          location?: string | null
          marketing_emails?: boolean
          mentor_replies?: boolean
          profile_visibility?: string
          reminder_time?: string | null
          session_reminders?: boolean
          share_insights?: boolean
          share_progress?: boolean
          timezone?: string | null
          updated_at?: string
          weekly_summary?: boolean
        }
        Update: {
          allow_analytics?: boolean
          avatar_url?: string | null
          bio?: string | null
          birth_date?: string | null
          created_at?: string
          display_name?: string | null
          email_notifications?: boolean
          goal_reminders?: boolean
          id?: string
          language?: string | null
          location?: string | null
          marketing_emails?: boolean
          mentor_replies?: boolean
          profile_visibility?: string
          reminder_time?: string | null
          session_reminders?: boolean
          share_insights?: boolean
          share_progress?: boolean
          timezone?: string | null
          updated_at?: string
          weekly_summary?: boolean
        }
        Relationships: []
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
      suppressed_emails: {
        Row: {
          created_at: string
          email: string
          id: string
          metadata: Json | null
          reason: string
        }
        Insert: {
          created_at?: string
          email: string
          id?: string
          metadata?: Json | null
          reason: string
        }
        Update: {
          created_at?: string
          email?: string
          id?: string
          metadata?: Json | null
          reason?: string
        }
        Relationships: []
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      value_assessments: {
        Row: {
          answers: Json
          completed_at: string | null
          created_at: string
          current_step: number
          id: string
          result: Json
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          result?: Json
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          answers?: Json
          completed_at?: string | null
          created_at?: string
          current_step?: number
          id?: string
          result?: Json
          status?: string
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
      vision_item_values: {
        Row: {
          created_at: string
          id: string
          rationale: string
          updated_at: string
          user_id: string
          value_id: string
          vision_item_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          rationale?: string
          updated_at?: string
          user_id: string
          value_id: string
          vision_item_id: string
        }
        Update: {
          created_at?: string
          id?: string
          rationale?: string
          updated_at?: string
          user_id?: string
          value_id?: string
          vision_item_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "vision_item_values_value_id_fkey"
            columns: ["value_id"]
            isOneToOne: false
            referencedRelation: "values"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vision_item_values_vision_item_id_fkey"
            columns: ["vision_item_id"]
            isOneToOne: false
            referencedRelation: "vision_items"
            referencedColumns: ["id"]
          },
        ]
      }
      vision_items: {
        Row: {
          category: string
          content: string
          created_at: string
          evidence: string
          horizon: string
          id: string
          linked_value_id: string | null
          status: string
          updated_at: string
          user_id: string
          why: string
        }
        Insert: {
          category: string
          content?: string
          created_at?: string
          evidence?: string
          horizon?: string
          id?: string
          linked_value_id?: string | null
          status?: string
          updated_at?: string
          user_id: string
          why?: string
        }
        Update: {
          category?: string
          content?: string
          created_at?: string
          evidence?: string
          horizon?: string
          id?: string
          linked_value_id?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          why?: string
        }
        Relationships: [
          {
            foreignKeyName: "vision_items_linked_value_id_fkey"
            columns: ["linked_value_id"]
            isOneToOne: false
            referencedRelation: "values"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      book_clarity_slot: {
        Args: {
          p_concern: string
          p_consent_accepted: boolean
          p_email: string
          p_name: string
          p_scheduled_at: string
        }
        Returns: Json
      }
      delete_email: {
        Args: { message_id: number; queue_name: string }
        Returns: boolean
      }
      email_queue_dispatch: { Args: never; Returns: undefined }
      enqueue_email: {
        Args: { payload: Json; queue_name: string }
        Returns: number
      }
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
      move_to_dlq: {
        Args: {
          dlq_name: string
          message_id: number
          payload: Json
          source_queue: string
        }
        Returns: number
      }
      read_email_batch: {
        Args: { batch_size: number; queue_name: string; vt: number }
        Returns: {
          message: Json
          msg_id: number
          read_ct: number
        }[]
      }
    }
    Enums: {
      app_role:
        | "potencialus_klientas"
        | "vartotojas"
        | "pro_vartotojas"
        | "admin"
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
    Enums: {
      app_role: [
        "potencialus_klientas",
        "vartotojas",
        "pro_vartotojas",
        "admin",
      ],
    },
  },
} as const
