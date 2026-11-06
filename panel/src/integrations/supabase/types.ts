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
      admin_audit_log: {
        Row: {
          action: string
          admin_email: string | null
          admin_user_id: string | null
          created_at: string
          diff: Json
          id: string
          ip_address: string | null
          target_id: string | null
          target_table: string
          user_agent: string | null
        }
        Insert: {
          action: string
          admin_email?: string | null
          admin_user_id?: string | null
          created_at?: string
          diff?: Json
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table: string
          user_agent?: string | null
        }
        Update: {
          action?: string
          admin_email?: string | null
          admin_user_id?: string | null
          created_at?: string
          diff?: Json
          id?: string
          ip_address?: string | null
          target_id?: string | null
          target_table?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      admin_credentials: {
        Row: {
          admin_key: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          admin_key: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          admin_key?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      admin_otp_codes: {
        Row: {
          attempts: number
          code_hash: string
          created_at: string
          expires_at: string
          id: string
          ip_address: string | null
          used: boolean
          user_id: string
        }
        Insert: {
          attempts?: number
          code_hash: string
          created_at?: string
          expires_at: string
          id?: string
          ip_address?: string | null
          used?: boolean
          user_id: string
        }
        Update: {
          attempts?: number
          code_hash?: string
          created_at?: string
          expires_at?: string
          id?: string
          ip_address?: string | null
          used?: boolean
          user_id?: string
        }
        Relationships: []
      }
      admin_telegram: {
        Row: {
          chat_id: string
          created_at: string
          updated_at: string
          user_id: string
        }
        Insert: {
          chat_id: string
          created_at?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          chat_id?: string
          created_at?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      ai_usage_logs: {
        Row: {
          action: string
          created_at: string
          id: string
          input_tokens: number
          ip: string | null
          latency_ms: number
          license_key: string | null
          model: string
          output_tokens: number
          status: string
          total_tokens: number
        }
        Insert: {
          action: string
          created_at?: string
          id?: string
          input_tokens?: number
          ip?: string | null
          latency_ms?: number
          license_key?: string | null
          model: string
          output_tokens?: number
          status?: string
          total_tokens?: number
        }
        Update: {
          action?: string
          created_at?: string
          id?: string
          input_tokens?: number
          ip?: string | null
          latency_ms?: number
          license_key?: string | null
          model?: string
          output_tokens?: number
          status?: string
          total_tokens?: number
        }
        Relationships: []
      }
      burp_presets: {
        Row: {
          body_template: Json
          created_at: string
          description: string | null
          enabled: boolean
          headers_template: Json
          id: string
          kind: string
          method: string
          name: string
          requires_hb_license: boolean
          slug: string
          sort_order: number
          updated_at: string
          url_template: string
        }
        Insert: {
          body_template?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          headers_template?: Json
          id?: string
          kind?: string
          method?: string
          name: string
          requires_hb_license?: boolean
          slug: string
          sort_order?: number
          updated_at?: string
          url_template: string
        }
        Update: {
          body_template?: Json
          created_at?: string
          description?: string | null
          enabled?: boolean
          headers_template?: Json
          id?: string
          kind?: string
          method?: string
          name?: string
          requires_hb_license?: boolean
          slug?: string
          sort_order?: number
          updated_at?: string
          url_template?: string
        }
        Relationships: []
      }
      burp_requests: {
        Row: {
          created_at: string
          headers: Json | null
          id: string
          method: string
          payload: Json | null
          response_body: string | null
          response_status: number | null
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          headers?: Json | null
          id?: string
          method: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          headers?: Json | null
          id?: string
          method?: string
          payload?: Json | null
          response_body?: string | null
          response_status?: number | null
          url?: string
          user_id?: string
        }
        Relationships: []
      }
      extension_kill_switch: {
        Row: {
          blocked_versions: string[]
          enforce_hmac: boolean
          id: string
          message: string | null
          min_allowed_version: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          blocked_versions?: string[]
          enforce_hmac?: boolean
          id?: string
          message?: string | null
          min_allowed_version: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          blocked_versions?: string[]
          enforce_hmac?: boolean
          id?: string
          message?: string | null
          min_allowed_version?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      extension_versions: {
        Row: {
          changelog: string | null
          created_at: string
          file_path: string | null
          id: string
          is_alert_active: boolean
          version: string
        }
        Insert: {
          changelog?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          is_alert_active?: boolean
          version: string
        }
        Update: {
          changelog?: string | null
          created_at?: string
          file_path?: string | null
          id?: string
          is_alert_active?: boolean
          version?: string
        }
        Relationships: []
      }
      fraud_alert_state: {
        Row: {
          cooldown_until: string | null
          event_type: string
          id: string
          last_alert_at: string | null
          last_count: number
          updated_at: string
        }
        Insert: {
          cooldown_until?: string | null
          event_type: string
          id?: string
          last_alert_at?: string | null
          last_count?: number
          updated_at?: string
        }
        Update: {
          cooldown_until?: string | null
          event_type?: string
          id?: string
          last_alert_at?: string | null
          last_count?: number
          updated_at?: string
        }
        Relationships: []
      }
      fraud_event_reviews: {
        Row: {
          admin_email: string | null
          admin_user_id: string | null
          created_at: string
          event_key: string
          id: string
          note: string | null
          status: string
        }
        Insert: {
          admin_email?: string | null
          admin_user_id?: string | null
          created_at?: string
          event_key: string
          id?: string
          note?: string | null
          status: string
        }
        Update: {
          admin_email?: string | null
          admin_user_id?: string | null
          created_at?: string
          event_key?: string
          id?: string
          note?: string | null
          status?: string
        }
        Relationships: []
      }
      fraud_events: {
        Row: {
          created_at: string
          details: Json | null
          device_id: string | null
          endpoint: string | null
          event_type: string
          id: string
          ip_address: string | null
          license_key: string | null
          severity: string
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          details?: Json | null
          device_id?: string | null
          endpoint?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          license_key?: string | null
          severity: string
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          details?: Json | null
          device_id?: string | null
          endpoint?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          license_key?: string | null
          severity?: string
          user_agent?: string | null
        }
        Relationships: []
      }
      heartbeats: {
        Row: {
          device_id: string
          first_seen: string
          ip_address: string | null
          last_seen: string
          license_key: string | null
          metadata: Json
          pings_today: number
          pings_total: number
          url: string | null
          user_agent: string | null
          version: string | null
        }
        Insert: {
          device_id: string
          first_seen?: string
          ip_address?: string | null
          last_seen?: string
          license_key?: string | null
          metadata?: Json
          pings_today?: number
          pings_total?: number
          url?: string | null
          user_agent?: string | null
          version?: string | null
        }
        Update: {
          device_id?: string
          first_seen?: string
          ip_address?: string | null
          last_seen?: string
          license_key?: string | null
          metadata?: Json
          pings_today?: number
          pings_total?: number
          url?: string | null
          user_agent?: string | null
          version?: string | null
        }
        Relationships: []
      }
      license_validation_attempts: {
        Row: {
          created_at: string
          device_id: string | null
          id: string
          ip_address: string | null
          license_key: string | null
          reason: string | null
          success: boolean
          user_agent: string | null
        }
        Insert: {
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          license_key?: string | null
          reason?: string | null
          success: boolean
          user_agent?: string | null
        }
        Update: {
          created_at?: string
          device_id?: string | null
          id?: string
          ip_address?: string | null
          license_key?: string | null
          reason?: string | null
          success?: boolean
          user_agent?: string | null
        }
        Relationships: []
      }
      licenses: {
        Row: {
          activated: boolean | null
          activated_at: string | null
          active: boolean | null
          client_email: string | null
          client_phone: string | null
          created_at: string
          created_by: string | null
          device_change_count: number
          device_history: Json | null
          device_id: string | null
          duration_days: number | null
          editing_seconds: number | null
          expires_at: string | null
          expiry_date: string | null
          force_logout_at: string | null
          fraud_score: number | null
          id: string
          is_daily: boolean | null
          last_device_change: string | null
          last_hwid_reset: string | null
          last_ip: string | null
          license_key: string
          lifetime: boolean | null
          max_sessions: number
          max_uses: number | null
          prompts_count: number | null
          security_alerts: Json
          status: Database["public"]["Enums"]["license_status"]
          updated_at: string
          user_id: string | null
          user_name: string | null
          uses: number | null
        }
        Insert: {
          activated?: boolean | null
          activated_at?: string | null
          active?: boolean | null
          client_email?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          device_change_count?: number
          device_history?: Json | null
          device_id?: string | null
          duration_days?: number | null
          editing_seconds?: number | null
          expires_at?: string | null
          expiry_date?: string | null
          force_logout_at?: string | null
          fraud_score?: number | null
          id?: string
          is_daily?: boolean | null
          last_device_change?: string | null
          last_hwid_reset?: string | null
          last_ip?: string | null
          license_key: string
          lifetime?: boolean | null
          max_sessions?: number
          max_uses?: number | null
          prompts_count?: number | null
          security_alerts?: Json
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
          uses?: number | null
        }
        Update: {
          activated?: boolean | null
          activated_at?: string | null
          active?: boolean | null
          client_email?: string | null
          client_phone?: string | null
          created_at?: string
          created_by?: string | null
          device_change_count?: number
          device_history?: Json | null
          device_id?: string | null
          duration_days?: number | null
          editing_seconds?: number | null
          expires_at?: string | null
          expiry_date?: string | null
          force_logout_at?: string | null
          fraud_score?: number | null
          id?: string
          is_daily?: boolean | null
          last_device_change?: string | null
          last_hwid_reset?: string | null
          last_ip?: string | null
          license_key?: string
          lifetime?: boolean | null
          max_sessions?: number
          max_uses?: number | null
          prompts_count?: number | null
          security_alerts?: Json
          status?: Database["public"]["Enums"]["license_status"]
          updated_at?: string
          user_id?: string | null
          user_name?: string | null
          uses?: number | null
        }
        Relationships: []
      }
      notifications: {
        Row: {
          created_at: string
          id: string
          link: string | null
          message: string
          title: string
        }
        Insert: {
          created_at?: string
          id?: string
          link?: string | null
          message: string
          title: string
        }
        Update: {
          created_at?: string
          id?: string
          link?: string | null
          message?: string
          title?: string
        }
        Relationships: []
      }
      packages: {
        Row: {
          created_at: string
          duration_days: number | null
          features: string[] | null
          id: string
          is_active: boolean
          is_popular: boolean
          name: string
          price: number
          sort_order: number
        }
        Insert: {
          created_at?: string
          duration_days?: number | null
          features?: string[] | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name: string
          price: number
          sort_order?: number
        }
        Update: {
          created_at?: string
          duration_days?: number | null
          features?: string[] | null
          id?: string
          is_active?: boolean
          is_popular?: boolean
          name?: string
          price?: number
          sort_order?: number
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number | null
          created_at: string
          customer_email: string | null
          customer_name: string
          customer_number: string
          files_url: string | null
          id: string
          license_key: string | null
          metadata: Json | null
          payment_status: string
          plan_name: string
          reseller_id: string | null
          updated_at: string
        }
        Insert: {
          amount?: number | null
          created_at?: string
          customer_email?: string | null
          customer_name: string
          customer_number: string
          files_url?: string | null
          id?: string
          license_key?: string | null
          metadata?: Json | null
          payment_status?: string
          plan_name: string
          reseller_id?: string | null
          updated_at?: string
        }
        Update: {
          amount?: number | null
          created_at?: string
          customer_email?: string | null
          customer_name?: string
          customer_number?: string
          files_url?: string | null
          id?: string
          license_key?: string | null
          metadata?: Json | null
          payment_status?: string
          plan_name?: string
          reseller_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          bio: string | null
          created_at: string | null
          full_name: string | null
          id: string
          updated_at: string | null
        }
        Insert: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id: string
          updated_at?: string | null
        }
        Update: {
          avatar_url?: string | null
          bio?: string | null
          created_at?: string | null
          full_name?: string | null
          id?: string
          updated_at?: string | null
        }
        Relationships: []
      }
      project_download_logs: {
        Row: {
          created_at: string | null
          id: string
          license_key: string | null
          project_id: string
          status: string
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          id?: string
          license_key?: string | null
          project_id: string
          status: string
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          id?: string
          license_key?: string | null
          project_id?: string
          status?: string
          user_id?: string | null
        }
        Relationships: []
      }
      proxies: {
        Row: {
          active: boolean
          city: string | null
          country: string | null
          created_at: string
          host: string
          id: string
          last_checked: string | null
          last_egress_ip: string | null
          last_status: string | null
          notes: string | null
          password: string | null
          port: number
          protocol: string
          updated_at: string
          username: string | null
        }
        Insert: {
          active?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          host: string
          id?: string
          last_checked?: string | null
          last_egress_ip?: string | null
          last_status?: string | null
          notes?: string | null
          password?: string | null
          port: number
          protocol?: string
          updated_at?: string
          username?: string | null
        }
        Update: {
          active?: boolean
          city?: string | null
          country?: string | null
          created_at?: string
          host?: string
          id?: string
          last_checked?: string | null
          last_egress_ip?: string | null
          last_status?: string | null
          notes?: string | null
          password?: string | null
          port?: number
          protocol?: string
          updated_at?: string
          username?: string | null
        }
        Relationships: []
      }
      rate_limits_license: {
        Row: {
          event_type: string
          license_key: string
          request_count: number | null
          window_start: string | null
        }
        Insert: {
          event_type: string
          license_key: string
          request_count?: number | null
          window_start?: string | null
        }
        Update: {
          event_type?: string
          license_key?: string
          request_count?: number | null
          window_start?: string | null
        }
        Relationships: []
      }
      request_nonces: {
        Row: {
          created_at: string | null
          id: string
          nonce: string
        }
        Insert: {
          created_at?: string | null
          id?: string
          nonce: string
        }
        Update: {
          created_at?: string | null
          id?: string
          nonce?: string
        }
        Relationships: []
      }
      reseller_api_logs: {
        Row: {
          action: string
          created_at: string
          endpoint: string
          error: string | null
          id: string
          ip: string | null
          metadata: Json | null
          reseller_id: string | null
          status: string
          tokens: number | null
        }
        Insert: {
          action: string
          created_at?: string
          endpoint: string
          error?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          reseller_id?: string | null
          status: string
          tokens?: number | null
        }
        Update: {
          action?: string
          created_at?: string
          endpoint?: string
          error?: string | null
          id?: string
          ip?: string | null
          metadata?: Json | null
          reseller_id?: string | null
          status?: string
          tokens?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "reseller_api_logs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_credit_packages: {
        Row: {
          amount: number
          created_at: string | null
          credits: number
          id: string
          is_active: boolean | null
          name: string
          token_type: string | null
        }
        Insert: {
          amount: number
          created_at?: string | null
          credits: number
          id?: string
          is_active?: boolean | null
          name: string
          token_type?: string | null
        }
        Update: {
          amount?: number
          created_at?: string | null
          credits?: number
          id?: string
          is_active?: boolean | null
          name?: string
          token_type?: string | null
        }
        Relationships: []
      }
      reseller_credit_transactions: {
        Row: {
          amount: number
          created_at: string | null
          description: string | null
          id: string
          package_id: string | null
          payment_id: string | null
          reseller_id: string
          status: string
          token_type: string | null
          type: string
        }
        Insert: {
          amount: number
          created_at?: string | null
          description?: string | null
          id?: string
          package_id?: string | null
          payment_id?: string | null
          reseller_id: string
          status?: string
          token_type?: string | null
          type: string
        }
        Update: {
          amount?: number
          created_at?: string | null
          description?: string | null
          id?: string
          package_id?: string | null
          payment_id?: string | null
          reseller_id?: string
          status?: string
          token_type?: string | null
          type?: string
        }
        Relationships: [
          {
            foreignKeyName: "reseller_credit_transactions_package_id_fkey"
            columns: ["package_id"]
            isOneToOne: false
            referencedRelation: "reseller_credit_packages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "reseller_credit_transactions_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
      }
      reseller_features: {
        Row: {
          created_at: string
          enabled: boolean
          feature_key: string
          id: string
          reseller_id: string
          updated_at: string
          value: Json
        }
        Insert: {
          created_at?: string
          enabled?: boolean
          feature_key: string
          id?: string
          reseller_id: string
          updated_at?: string
          value?: Json
        }
        Update: {
          created_at?: string
          enabled?: boolean
          feature_key?: string
          id?: string
          reseller_id?: string
          updated_at?: string
          value?: Json
        }
        Relationships: []
      }
      resellers: {
        Row: {
          api_key_hash: string | null
          api_key_prefix: string | null
          api_status: string | null
          created_at: string
          credits: number
          email: string | null
          id: string
          license_key: string | null
          tokens_7d: number | null
          tokens_annual: number | null
          tokens_daily: number | null
          tokens_lifetime: number | null
          tokens_monthly: number | null
          updated_at: string
          user_id: string | null
        }
        Insert: {
          api_key_hash?: string | null
          api_key_prefix?: string | null
          api_status?: string | null
          created_at?: string
          credits?: number
          email?: string | null
          id?: string
          license_key?: string | null
          tokens_7d?: number | null
          tokens_annual?: number | null
          tokens_daily?: number | null
          tokens_lifetime?: number | null
          tokens_monthly?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          api_key_hash?: string | null
          api_key_prefix?: string | null
          api_status?: string | null
          created_at?: string
          credits?: number
          email?: string | null
          id?: string
          license_key?: string | null
          tokens_7d?: number | null
          tokens_annual?: number | null
          tokens_daily?: number | null
          tokens_lifetime?: number | null
          tokens_monthly?: number | null
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "fk_resellers_user_id"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      security_bans: {
        Row: {
          ban_type: string
          created_at: string
          created_by: string | null
          id: string
          reason: string | null
          value: string
        }
        Insert: {
          ban_type: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          value: string
        }
        Update: {
          ban_type?: string
          created_at?: string
          created_by?: string | null
          id?: string
          reason?: string | null
          value?: string
        }
        Relationships: []
      }
      security_logs: {
        Row: {
          created_at: string | null
          event_type: string
          id: string
          ip_address: string | null
          metadata: Json | null
          status: string
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_type: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          status: string
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_type?: string
          id?: string
          ip_address?: string | null
          metadata?: Json | null
          status?: string
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      sessions: {
        Row: {
          created_at: string
          created_ip: string | null
          created_ua: string | null
          device_id: string | null
          id: string
          is_active: boolean
          is_revoked: boolean
          last_heartbeat: string
          license_id: string
          session_id: string
        }
        Insert: {
          created_at?: string
          created_ip?: string | null
          created_ua?: string | null
          device_id?: string | null
          id?: string
          is_active?: boolean
          is_revoked?: boolean
          last_heartbeat?: string
          license_id: string
          session_id: string
        }
        Update: {
          created_at?: string
          created_ip?: string | null
          created_ua?: string | null
          device_id?: string | null
          id?: string
          is_active?: boolean
          is_revoked?: boolean
          last_heartbeat?: string
          license_id?: string
          session_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "sessions_license_id_fkey"
            columns: ["license_id"]
            isOneToOne: false
            referencedRelation: "licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      usage_logs: {
        Row: {
          client_license: string
          created_at: string
          error_message: string | null
          id: string
          message: string | null
          project_id: string | null
          reseller_id: string | null
          status: string | null
        }
        Insert: {
          client_license: string
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string | null
          project_id?: string | null
          reseller_id?: string | null
          status?: string | null
        }
        Update: {
          client_license?: string
          created_at?: string
          error_message?: string | null
          id?: string
          message?: string | null
          project_id?: string | null
          reseller_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "usage_logs_reseller_id_fkey"
            columns: ["reseller_id"]
            isOneToOne: false
            referencedRelation: "resellers"
            referencedColumns: ["id"]
          },
        ]
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
          role?: Database["public"]["Enums"]["app_role"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      ban_identifier: {
        Args: { p_reason?: string; p_type: string; p_value: string }
        Returns: string
      }
      check_rate_limit: {
        Args: {
          p_event_type: string
          p_limit: number
          p_user_id: string
          p_window_minutes: number
        }
        Returns: boolean
      }
      check_rate_limit_ip: {
        Args: {
          p_event_type: string
          p_ip: string
          p_limit: number
          p_window_minutes: number
        }
        Returns: boolean
      }
      check_rate_limit_license: {
        Args: {
          p_event_type: string
          p_license_key: string
          p_limit: number
          p_window_minutes: number
        }
        Returns: boolean
      }
      cleanup_old_nonces: { Args: never; Returns: undefined }
      cleanup_stale_sessions: { Args: never; Returns: undefined }
      consume_nonce: { Args: { p_nonce: string }; Returns: boolean }
      create_license_with_token: {
        Args: {
          p_client_email: string
          p_client_phone: string
          p_duration_days: number
          p_is_daily?: boolean
          p_license_key: string
          p_max_sessions: number
          p_user_name: string
        }
        Returns: undefined
      }
      create_license_with_token_service: {
        Args: {
          p_client_email: string
          p_client_phone: string
          p_created_by: string
          p_duration_days: number
          p_is_daily?: boolean
          p_license_key: string
          p_max_sessions: number
          p_user_name: string
        }
        Returns: undefined
      }
      find_reseller_by_api_key_hash: {
        Args: { p_hash: string }
        Returns: {
          api_key_hash: string | null
          api_key_prefix: string | null
          api_status: string | null
          created_at: string
          credits: number
          email: string | null
          id: string
          license_key: string | null
          tokens_7d: number | null
          tokens_annual: number | null
          tokens_daily: number | null
          tokens_lifetime: number | null
          tokens_monthly: number | null
          updated_at: string
          user_id: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "resellers"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      force_remote_logout: {
        Args: { p_license_id: string }
        Returns: undefined
      }
      get_admin_header_metrics: { Args: never; Returns: Json }
      get_monitoring_errors: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_severities?: string[]
          p_since?: string
        }
        Returns: Json
      }
      get_monitoring_heartbeats: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      get_monitoring_metrics: { Args: never; Returns: Json }
      get_monitoring_top: { Args: { p_hours?: number }; Returns: Json }
      get_monitoring_validations: {
        Args: {
          p_limit?: number
          p_offset?: number
          p_only_failed?: boolean
          p_search?: string
          p_since?: string
        }
        Returns: Json
      }
      get_pilantrinhas: {
        Args: {
          p_hide_fp?: boolean
          p_limit?: number
          p_max_risk?: number
          p_min_risk?: number
          p_offset?: number
          p_patterns?: string[]
          p_search?: string
          p_severities?: string[]
          p_since: string
        }
        Returns: Json
      }
      get_pilantrinhas_aggregates: { Args: { p_since: string }; Returns: Json }
      get_pilantrinhas_events: {
        Args: { p_key: string; p_limit?: number; p_since: string }
        Returns: {
          created_at: string
          details: Json | null
          device_id: string | null
          endpoint: string | null
          event_type: string
          id: string
          ip_address: string | null
          license_key: string | null
          severity: string
          user_agent: string | null
        }[]
        SetofOptions: {
          from: "*"
          to: "fraud_events"
          isOneToOne: false
          isSetofReturn: true
        }
      }
      get_real_active_session_count: { Args: never; Returns: number }
      get_reseller_stats: { Args: never; Returns: Json }
      increment_license_editing_time: {
        Args: { l_key: string; seconds: number }
        Returns: undefined
      }
      increment_license_prompts: { Args: { l_key: string }; Returns: undefined }
      increment_license_prompts_counter: {
        Args: { l_key: string }
        Returns: undefined
      }
      increment_license_uses: { Args: { l_key: string }; Returns: undefined }
      increment_reseller_credits:
        | {
            Args: { amount_to_add: number; reseller_uuid: string }
            Returns: undefined
          }
        | {
            Args: {
              amount_to_add: number
              reseller_uuid: string
              type_of_token: string
            }
            Returns: undefined
          }
      insert_api_log: {
        Args: {
          p_action: string
          p_endpoint: string
          p_error?: string
          p_ip?: string
          p_meta?: Json
          p_reseller_id: string
          p_status: string
          p_tokens: number
        }
        Returns: undefined
      }
      is_admin: { Args: never; Returns: boolean }
      log_fraud_event: {
        Args: {
          p_details?: Json
          p_device_id?: string
          p_endpoint?: string
          p_event_type: string
          p_ip?: string
          p_license_key?: string
          p_severity: string
          p_user_agent?: string
        }
        Returns: undefined
      }
      log_prompt_usage: {
        Args: { l_key: string; p_message?: string; p_status?: string }
        Returns: undefined
      }
      mark_fraud_event_resolved: {
        Args: { p_event_id: string; p_note?: string; p_resolved?: boolean }
        Returns: undefined
      }
      purge_old_admin_audit_log: { Args: { p_days?: number }; Returns: number }
      purge_old_fraud_events: { Args: { p_days?: number }; Returns: number }
      purge_old_heartbeats: { Args: { p_days?: number }; Returns: number }
      purge_old_license_validation_attempts: {
        Args: { p_days?: number }
        Returns: number
      }
      purge_old_reseller_api_logs: {
        Args: { p_days?: number }
        Returns: number
      }
      purge_old_security_logs: { Args: { p_days?: number }; Returns: number }
      purge_old_usage_logs: { Args: { p_days?: number }; Returns: number }
      register_device_change: {
        Args: { p_license_id: string }
        Returns: undefined
      }
      release_license_access: {
        Args: { p_license_id: string }
        Returns: undefined
      }
      reset_heartbeats_pings_today: { Args: never; Returns: undefined }
      run_maintenance_purges: { Args: never; Returns: Json }
      search_licenses_admin: {
        Args: {
          p_created_by?: string
          p_limit?: number
          p_offset?: number
          p_search?: string
          p_status?: string
        }
        Returns: Json
      }
      set_reseller_api_key: {
        Args: { p_hash: string; p_prefix: string }
        Returns: undefined
      }
      sync_expired_licenses: { Args: never; Returns: undefined }
      unban_identifier: {
        Args: { p_type: string; p_value: string }
        Returns: undefined
      }
      unmark_fraud_event_review: {
        Args: { p_event_key: string }
        Returns: number
      }
    }
    Enums: {
      app_role: "admin" | "reseller" | "user"
      license_status: "active" | "trial" | "expired" | "revoked"
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
      app_role: ["admin", "reseller", "user"],
      license_status: ["active", "trial", "expired", "revoked"],
    },
  },
} as const
